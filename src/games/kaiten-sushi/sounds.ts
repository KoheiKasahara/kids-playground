import { getSharedAudioContext, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'

// おすしやさんの こうかおん。音声ファイルは つかわず、その場で ピコピコ ならす。

type Note = [frequency: number, at: number, length: number, type?: OscillatorType]
type Noise = [at: number, length: number, filter: BiquadFilterType, frequency: number]
type Sound = { notes: Note[]; noise?: Noise[]; volume?: number }

const SOUNDS = {
  tap: { notes: [[880, 0, .06, 'square']], volume: .05 },
  pick: { notes: [[659, 0, .07, 'square'], [988, .06, .09, 'square']], volume: .05 },
  make: { notes: [[523, 0, .12], [659, .1, .12], [784, .2, .12], [1047, .3, .3]], noise: [[.3, .25, 'highpass', 6000]] },
  send: { notes: [[523, 0, .08, 'square'], [784, .07, .14, 'square']], noise: [[0, .22, 'bandpass', 1800]], volume: .07 },
  placed: { notes: [[392, 0, .08, 'triangle'], [523, .05, .1, 'triangle']] },
  wish: { notes: [[1047, 0, .07, 'square'], [1319, .07, .1, 'square']], volume: .045 },
  grab: { notes: [[587, 0, .06, 'triangle'], [880, .05, .1, 'triangle']] },
  bite: { notes: [[330, 0, .05, 'square']], noise: [[0, .06, 'lowpass', 900]], volume: .06 },
  yummy: { notes: [[659, 0, .1], [784, .09, .1], [1047, .18, .22]] },
  spicy: { notes: [[1568, 0, .12, 'sine'], [1397, .1, .12, 'sine'], [1175, .2, .3, 'sine']], noise: [[0, .4, 'highpass', 4000]] },
  sparkle: { notes: [[1319, 0, .1, 'sine'], [1568, .07, .1, 'sine'], [2093, .14, .12, 'sine'], [2637, .21, .25, 'sine']] },
  train: { notes: [[784, 0, .3, 'sine'], [622, .28, .45, 'sine']], volume: .12 },
  gacha: { notes: [[220, .05, .04, 'square'], [220, .25, .04, 'square'], [220, .45, .04, 'square'], [880, .62, .12]], noise: [[0, .12, 'bandpass', 1200], [.2, .12, 'bandpass', 1400], [.4, .12, 'bandpass', 1600]] },
  prize: { notes: [[523, 0, .1], [659, .1, .1], [784, .2, .1], [1047, .3, .15], [1319, .45, .15], [1568, .6, .4]] },
  removed: { notes: [[294, 0, .08, 'triangle']], noise: [[0, .18, 'lowpass', 700]], volume: .07 },
} satisfies Record<string, Sound>

export type SushiSound = keyof typeof SOUNDS

export function playSushiSound(kind: SushiSound): void {
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
