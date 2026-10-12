import { getSharedAudioContext, getSoundOutput, isSoundEnabled, playTone } from '../../audio/sound'

function notes(frequencies: number[], duration: number, volume: number) {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    frequencies.forEach((frequency, index) => {
      playTone(ctx, frequency, ctx.currentTime + index * 0.12, duration, volume, 'triangle')
    })
  } catch {
    // The bounce and result stay visible when audio is unavailable.
  }
}

export function playTapSound() {
  notes([260, 180], 0.07, 0.18)
}

export function playStartSound() {
  notes([392, 523.25], 0.18, 0.14)
}

export function playFinishSound() {
  notes([523.25, 659.25, 783.99, 1046.5], 0.32, 0.16)
}

// ---------------- BGM（8ビットの おまつり ばやし） ----------------

/** ヨナぬきの わふう メロディ。すうじは D から なんはんおん うえか、`-` は のばす、`.` は やすみ（1つ = 8ぶおんぷ）。 */
const MELODY = (
  '7 . 7 9 12 - 9 7 | 5 - 7 - 2 - - - | 5 . 5 7 9 - 7 5 | 2 - 0 - 2 - - - | '
  + '12 - 14 - 12 9 7 - | 9 - 12 - 9 7 5 - | 7 . 7 5 2 - 5 7 | 0 - - - - - . .'
).split(/\s+/).filter((s) => s !== '|')
/** 1しょうせつ ごとの ベースの ねいろ（D から なんはんおん）。 */
const BASS = [0, -5, 5, -5, 5, 0, -5, 0]
const BPM = 132
const BASE_HZ = 587.33
const hz = (semi: number) => BASE_HZ * 2 ** (semi / 12)

function blip(ctx: AudioContext, dest: AudioNode, type: OscillatorType, f: number, at: number, dur: number, vol: number, f2?: number) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, at)
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + dur)
  g.gain.setValueAtTime(vol, at)
  g.gain.setValueAtTime(vol, at + dur * 0.7)
  g.gain.linearRampToValueAtTime(0, at + dur)
  o.connect(g).connect(dest)
  o.start(at)
  o.stop(at + dur + 0.02)
}

let noiseBuffer: AudioBuffer | undefined
function hit(ctx: AudioContext, dest: AudioNode, at: number, dur: number, vol: number, filter: BiquadFilterType, f: number) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate)
    // 8ビットらしく ざらっと した ノイズ（すこし だんかいを あらくする）。
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 4) data.fill(Math.random() < 0.5 ? -1 : 1, i, i + 4)
  }
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const bf = ctx.createBiquadFilter()
  bf.type = filter
  bf.frequency.value = f
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(bf).connect(g).connect(dest)
  src.start(at)
  src.stop(at + dur + 0.02)
}

/** とりくみ ちゅうの BGM を ながす。とめる かんすうを かえす。 */
export function startBgm(): () => void {
  const ctx = isSoundEnabled() ? getSharedAudioContext() : undefined
  if (!ctx) return () => {}
  const master = ctx.createGain()
  master.gain.value = 0.5
  master.connect(getSoundOutput(ctx))
  const step = 60 / BPM / 2
  let index = 0
  let next = ctx.currentTime + 0.15
  const schedule = () => {
    while (next < ctx.currentTime + 0.25) {
      const i = index % MELODY.length
      const s = MELODY[i]!
      if (s !== '-' && s !== '.') {
        let len = 1
        while (MELODY[(i + len) % MELODY.length] === '-' && len < 8) len++
        blip(ctx, master, 'square', hz(Number(s)), next, len * step * 0.9, 0.04)
      }
      const beat = i % 8
      const root = hz(BASS[Math.floor(i / 8)]! - 24)
      // ベースは ぽん・ぽん と はずむ。
      const bassStep = [1, 0, 2, 0, 1, 1, 2, 0][beat]
      if (bassStep) blip(ctx, master, 'triangle', root * bassStep, next, step * 0.85, 0.1)
      // たいこ の「ドン」と ひょうしぎ の「カッ」。
      if (beat === 0 || beat === 4) blip(ctx, master, 'triangle', 140, next, 0.16, 0.16, 45)
      if (beat === 6) hit(ctx, master, next, 0.06, 0.05, 'bandpass', 2600)
      if (beat % 2 === 1) hit(ctx, master, next, 0.025, 0.018, 'highpass', 8000)
      index++
      next += step
    }
  }
  schedule()
  const timer = setInterval(schedule, 60)
  return () => {
    clearInterval(timer)
    try {
      const t = ctx.currentTime
      master.gain.setValueAtTime(master.gain.value, t)
      master.gain.linearRampToValueAtTime(0, t + 0.25)
      setTimeout(() => { try { master.disconnect() } catch { /* もう きれている */ } }, 350)
    } catch {
      // とめられなくても おすもうは つづく。
    }
  }
}
