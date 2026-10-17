import { getSharedAudioContext, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'

// ホームランダービーの こうかおん。音声ファイルは つかわず、その場で ならす。

type Note = [frequency: number, at: number, length: number, type?: OscillatorType]
type Noise = [at: number, length: number, filter: BiquadFilterType, frequency: number]
type Sound = { notes: Note[]; noise?: Noise[]; volume?: number }

const SOUNDS = {
  tap: { notes: [[880, 0, .06, 'square']], volume: .05 },
  pitch: { notes: [[392, 0, .05, 'triangle']], noise: [[0, .22, 'bandpass', 1400]], volume: .07 },
  swing: { notes: [], noise: [[0, .16, 'bandpass', 900], [.04, .12, 'bandpass', 2200]], volume: .12 },
  // カキーン！
  hit: { notes: [[1760, 0, .09, 'square'], [2637, 0, .16, 'triangle'], [1319, .03, .22, 'triangle']], noise: [[0, .05, 'highpass', 3000]], volume: .11 },
  homerun: { notes: [[523, .05, .12], [659, .17, .12], [784, .29, .12], [1047, .41, .4], [1319, .41, .4, 'sine']], noise: [[.4, .9, 'bandpass', 1200]] },
  foul: { notes: [[523, 0, .12, 'triangle'], [392, .12, .2, 'triangle']], volume: .09 },
  safe: { notes: [[523, 0, .1], [784, .1, .2]] },
  miss: { notes: [[262, 0, .1, 'triangle'], [196, .02, .12, 'square']], noise: [[0, .1, 'lowpass', 1100]], volume: .12 },
  stop: { notes: [[1175, 0, .05, 'square'], [880, .05, .08, 'square']], volume: .05 },
  clear: { notes: [[523, 0, .14], [659, .14, .14], [784, .28, .14], [1047, .42, .2], [784, .62, .12], [1047, .74, .5]] },
  fail: { notes: [[392, 0, .18, 'triangle'], [349, .18, .18, 'triangle'], [330, .36, .35, 'triangle']], volume: .09 },
} satisfies Record<string, Sound>

export type DerbySound = keyof typeof SOUNDS

export function playDerbySound(kind: DerbySound): void {
  if (!isSoundEnabled()) return
  try {
    const context = getSharedAudioContext()
    if (!context) return
    const sound: Sound = SOUNDS[kind]
    const volume = sound.volume ?? .1
    const now = context.currentTime
    for (const [frequency, at, length, type = 'triangle'] of sound.notes) playTone(context, frequency, now + at, length, volume, type)
    for (const [at, length, filter, frequency] of sound.noise ?? []) playNoiseBurst(context, now + at, length, volume * .8, filter, frequency)
  } catch {
    // 音が でなくても、え と もじ だけで あそべる。
  }
}
