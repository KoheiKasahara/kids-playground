import { getSharedAudioContext, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'

export type SugorokuSound = 'select' | 'start' | 'roll' | 'dice' | 'step' | 'good' | 'bad' | 'warp' | 'rest' | 'goal'

/** 1マス すすむ たびに ドレミと あがる おと（かぞえる てがかりにも なる）。 */
const STEP_SCALE = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5]

type Note = readonly [frequency: number, at: number, duration: number, volume: number, type?: OscillatorType]

const NOTES: Record<Exclude<SugorokuSound, 'roll' | 'step'>, readonly Note[]> = {
  select: [[659.25, 0, 0.1, 0.12]],
  start: [[523.25, 0, 0.14, 0.13], [659.25, 0.1, 0.14, 0.13], [783.99, 0.2, 0.22, 0.13]],
  dice: [[880, 0, 0.12, 0.13, 'square'], [1318.5, 0.07, 0.16, 0.1]],
  good: [[659.25, 0, 0.12, 0.14], [783.99, 0.09, 0.12, 0.14], [1046.5, 0.18, 0.26, 0.14]],
  bad: [[493.88, 0, 0.16, 0.13], [392, 0.13, 0.16, 0.13], [329.63, 0.26, 0.28, 0.13]],
  warp: [[783.99, 0, 0.1, 0.12], [987.77, 0.06, 0.1, 0.12], [1174.66, 0.12, 0.1, 0.12], [1567.98, 0.18, 0.24, 0.12]],
  rest: [[392, 0, 0.24, 0.12], [329.63, 0.22, 0.34, 0.11]],
  goal: [
    [523.25, 0, 0.14, 0.15], [659.25, 0.12, 0.14, 0.15], [783.99, 0.24, 0.14, 0.15],
    [1046.5, 0.36, 0.3, 0.15], [783.99, 0.62, 0.12, 0.14], [1046.5, 0.74, 0.5, 0.16],
  ],
}

export function playSugorokuSound(kind: SugorokuSound, step = 0): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    if (kind === 'roll') {
      // サイコロが ころころ ころがる カラカラ。
      for (let hit = 0; hit < 5; hit++) playNoiseBurst(ctx, now + hit * 0.09, 0.05, 0.22 - hit * 0.02, 'bandpass', 2400 + (hit % 2) * 900)
      return
    }
    if (kind === 'step') {
      playTone(ctx, STEP_SCALE[Math.max(0, step) % STEP_SCALE.length]!, now, 0.12, 0.11, 'triangle')
      return
    }
    for (const [frequency, at, duration, volume, type = 'triangle'] of NOTES[kind]) {
      playTone(ctx, frequency, now + at, duration, volume, type)
    }
  } catch {
    // おとが でなくても、サイコロの め・コマの うごき・もじで あそべる。
  }
}
