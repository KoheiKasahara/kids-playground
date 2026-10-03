/**
 * 効果音の「聞こえの大きさ」を、騒音計と同じ方法（A特性・時定数 Fast の最大値, LAFmax）で測る。
 * A特性は人の耳と同じく低い音・高すぎる音を弱く数えるので、スマホやタブレットの小さなスピーカーで
 * 低音が聞こえにくいことも含めて、ゲームの効果音どうしを公平に比べられる。
 * Fast（125ms）の時間重みは短い「ピッ」が長い音よりやや小さく聞こえる耳の性質に合わせたもの。
 * 値はフルスケールの正弦波（1kHz）を -3.0 とする dB で返す。
 */

const FAST_TIME_CONSTANT_SECONDS = 0.125

type Section = { b0: number; b1: number; a1: number }

/** アナログの1次の高域通過 s/(s+p) と低域通過 p/(s+p) を、双一次変換でデジタル化する。 */
function firstOrder(kind: 'highpass' | 'lowpass', poleHz: number, sampleRate: number): Section {
  const p = 2 * Math.PI * poleHz
  const k = 2 * sampleRate
  const a0 = k + p
  return kind === 'highpass'
    ? { b0: k / a0, b1: -k / a0, a1: (p - k) / a0 }
    : { b0: p / a0, b1: p / a0, a1: (p - k) / a0 }
}

/** IEC 61672 の A 特性（20.6Hz×2, 107.7Hz, 737.9Hz の高域通過と 12194Hz×2 の低域通過）。 */
function aWeightingSections(sampleRate: number): Section[] {
  return [
    firstOrder('highpass', 20.598997, sampleRate),
    firstOrder('highpass', 20.598997, sampleRate),
    firstOrder('highpass', 107.65265, sampleRate),
    firstOrder('highpass', 737.86223, sampleRate),
    firstOrder('lowpass', 12194.217, sampleRate),
    firstOrder('lowpass', 12194.217, sampleRate),
  ]
}

/** 1kHz で 0dB になるよう、デジタルフィルタの応答から倍率を求める。 */
function gainAt(sections: Section[], frequency: number, sampleRate: number): number {
  const w = (2 * Math.PI * frequency) / sampleRate
  let magnitude = 1
  for (const { b0, b1, a1 } of sections) {
    const numerator = Math.hypot(b0 + b1 * Math.cos(w), -b1 * Math.sin(w))
    const denominator = Math.hypot(1 + a1 * Math.cos(w), -a1 * Math.sin(w))
    magnitude *= numerator / denominator
  }
  return magnitude
}

const weightingCache = new Map<number, { sections: Section[]; scale: number }>()

function aWeight(signal: Float32Array, sampleRate: number): Float64Array {
  let weighting = weightingCache.get(sampleRate)
  if (!weighting) {
    const sections = aWeightingSections(sampleRate)
    weighting = { sections, scale: 1 / gainAt(sections, 1000, sampleRate) }
    weightingCache.set(sampleRate, weighting)
  }
  const output = Float64Array.from(signal, (value) => value * weighting.scale)
  for (const { b0, b1, a1 } of weighting.sections) {
    let x1 = 0
    let y1 = 0
    for (let i = 0; i < output.length; i++) {
      const x = output[i]
      const y = b0 * x + b1 * x1 - a1 * y1
      x1 = x
      y1 = y
      output[i] = y
    }
  }
  return output
}

export type LoudnessResult = {
  /** A特性・Fast の最大レベル [dB]。フルスケールの 1kHz 正弦波が -3.0。無音なら -Infinity。 */
  level: number
  /** サンプルの最大振幅 [dBFS]。 */
  peakDb: number
}

export function measureLoudness(signal: Float32Array, sampleRate: number): LoudnessResult {
  let peak = 0
  for (const value of signal) peak = Math.max(peak, Math.abs(value))
  const weighted = aWeight(signal, sampleRate)
  const coefficient = 1 / (FAST_TIME_CONSTANT_SECONDS * sampleRate)
  let smoothed = 0
  let maxPower = 0
  for (const value of weighted) {
    smoothed += (value * value - smoothed) * coefficient
    if (smoothed > maxPower) maxPower = smoothed
  }
  return {
    level: maxPower > 0 ? 10 * Math.log10(maxPower) : -Infinity,
    peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
  }
}

/** 複数の音の大きさを、パワーで平均して 1 つの値にまとめる（大きい音ほど効く、耳の感じ方に近いまとめ方）。 */
export function powerMeanDb(values: readonly number[]): number {
  const finite = values.filter(Number.isFinite)
  if (finite.length === 0) return -Infinity
  const mean = finite.reduce((sum, value) => sum + 10 ** (value / 10), 0) / finite.length
  return 10 * Math.log10(mean)
}
