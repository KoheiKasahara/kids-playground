import { getSharedAudioContext, getSoundOutput, isSoundEnabled, playNoiseBurst } from '../../audio/sound'

/**
 * リズムぽんぽん の打楽器と効果音。すべて共有AudioContextで合成し、音源ファイルは追加しない。
 * メロディ（ピアノの録音音源）は shared/music/pianoAudio 側で鳴らす。
 */

type VoiceOptions = {
  type: OscillatorType
  frequency: number
  /** 指定すると、鳴り終わりまでにこの高さへ滑らせる（キックの「どん」など）。 */
  frequencyEnd?: number
  duration: number
  volume: number
  attack?: number
}

function voice(context: AudioContext, when: number, options: VoiceOptions): void {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const attack = options.attack ?? 0.004
  oscillator.type = options.type
  oscillator.frequency.setValueAtTime(options.frequency, when)
  if (options.frequencyEnd) oscillator.frequency.exponentialRampToValueAtTime(options.frequencyEnd, when + options.duration)
  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(options.volume, when + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + options.duration)
  oscillator.connect(gain)
  gain.connect(getSoundOutput(context))
  oscillator.start(when)
  oscillator.stop(when + options.duration + 0.02)
}

function audio(): AudioContext | undefined {
  if (!isSoundEnabled()) return undefined
  return getSharedAudioContext()
}

/** 共有AudioContextの今の時刻（秒）。打楽器を先読みで予約するための基準。 */
export function audioNow(): number | undefined {
  return audio()?.currentTime
}

export type DrumHit = 'kick' | 'clap' | 'shaker'

/** 拍に合わせた、やさしい伴奏の打楽器。whenは共有AudioContextの時刻。 */
export function scheduleDrum(hit: DrumHit, when: number, accent = false): void {
  const context = audio()
  if (!context) return
  const at = Math.max(when, context.currentTime)
  if (hit === 'kick') {
    voice(context, at, { type: 'sine', frequency: 150, frequencyEnd: 46, duration: 0.3, volume: accent ? 0.34 : 0.22 })
    voice(context, at, { type: 'triangle', frequency: 90, frequencyEnd: 40, duration: 0.12, volume: 0.08 })
  } else if (hit === 'clap') {
    playNoiseBurst(context, at, 0.14, accent ? 0.1 : 0.07, 'bandpass', 1500)
    playNoiseBurst(context, at + 0.012, 0.1, 0.05, 'bandpass', 2300)
  } else {
    playNoiseBurst(context, at, 0.05, accent ? 0.035 : 0.022, 'highpass', 7200)
  }
}

/** 「3・2・1」の木魚のような こつん。 */
export function scheduleCountTick(when: number, last: boolean): void {
  const context = audio()
  if (!context) return
  const at = Math.max(when, context.currentTime)
  voice(context, at, { type: 'sine', frequency: last ? 1320 : 990, duration: 0.14, volume: 0.16 })
  voice(context, at, { type: 'triangle', frequency: last ? 2640 : 1980, duration: 0.05, volume: 0.05 })
}

/** 「すごい！」のきらきら。ピアノの音に重ねるので小さめ。 */
export function playSparkle(perfect: boolean): void {
  const context = audio()
  if (!context) return
  const now = context.currentTime
  const notes = perfect ? [2093, 2637, 3136] : [1760]
  notes.forEach((frequency, index) => {
    voice(context, now + index * 0.045, { type: 'sine', frequency, duration: 0.32, volume: perfect ? 0.045 : 0.035 })
  })
}

/** ノーツのないところをタップしたときの、ぽこっ という小さな音。 */
export function playEmptyTap(): void {
  const context = audio()
  if (!context) return
  voice(context, context.currentTime, { type: 'sine', frequency: 520, frequencyEnd: 300, duration: 0.09, volume: 0.06 })
}

/** 「れんぞく」の節目（10・20…）で鳴る、上がっていく音。 */
export function playComboChime(): void {
  const context = audio()
  if (!context) return
  const now = context.currentTime
  ;[1047, 1319, 1568, 2093].forEach((frequency, index) => {
    voice(context, now + index * 0.06, { type: 'triangle', frequency, duration: 0.22, volume: 0.05 })
  })
}

/** さいごまで えんそう できたときの ファンファーレ。 */
export function playFanfare(stars: number): void {
  const context = audio()
  if (!context) return
  const now = context.currentTime + 0.05
  const melody: readonly [number, number, number][] = [
    [523.25, 0, 0.16], [659.25, 0.16, 0.16], [783.99, 0.32, 0.16], [1046.5, 0.5, 0.7],
  ]
  for (const [frequency, offset, duration] of melody) {
    voice(context, now + offset, { type: 'triangle', frequency, duration, volume: 0.14 })
    voice(context, now + offset, { type: 'sine', frequency: frequency * 2, duration, volume: 0.03 })
  }
  // ★の数だけ、ちいさな きらきらを足す。
  for (let index = 0; index < stars; index += 1) {
    voice(context, now + 0.9 + index * 0.22, { type: 'sine', frequency: 2093 + index * 300, duration: 0.4, volume: 0.05 })
  }
  for (const frequency of [261.63, 329.63, 392]) {
    voice(context, now + 0.5, { type: 'sine', frequency, duration: 1.2, volume: 0.05, attack: 0.02 })
  }
}

/** ボタンを押したときの軽い音。 */
export function playSelect(): void {
  const context = audio()
  if (!context) return
  const now = context.currentTime
  voice(context, now, { type: 'sine', frequency: 660, duration: 0.1, volume: 0.07 })
  voice(context, now + 0.06, { type: 'sine', frequency: 990, duration: 0.12, volume: 0.06 })
}
