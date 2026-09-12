import { createToneNodes, getSharedAudioContext, isSoundEnabled } from '../../audio/sound'

export type CraneSoundKind = 'motor' | 'stop' | 'clack' | 'grab' | 'miss' | 'slip' | 'get' | 'bump'

const NOTES: Record<CraneSoundKind, number[]> = {
  motor: [118, 132],
  stop: [176],
  clack: [520, 320],
  grab: [540, 760],
  miss: [320, 224],
  slip: [700, 480, 300],
  get: [523.25, 659.25, 783.99, 1046.5],
  bump: [132],
}

/** クレーンゲームの効果音。音源ファイルを持たず、共有のAudioContextで短い音を合成する。 */
export function craneSound(kind: CraneSoundKind, strength = 1): void {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  const type: OscillatorType = kind === 'motor' ? 'sawtooth' : kind === 'bump' ? 'triangle' : kind === 'clack' || kind === 'stop' ? 'square' : 'sine'
  const gap = kind === 'get' ? 0.1 : kind === 'clack' ? 0.035 : 0.07
  const duration = kind === 'motor' ? 0.13 : kind === 'bump' ? 0.09 : kind === 'clack' || kind === 'stop' ? 0.04 : kind === 'get' ? 0.2 : 0.14
  const volume = (kind === 'bump' ? 0.016 : kind === 'motor' ? 0.013 : kind === 'get' ? 0.042 : 0.028) * Math.min(1, Math.max(0.2, strength))
  NOTES[kind].forEach((frequency, index) => {
    const start = now + index * gap
    const { oscillator, gain } = createToneNodes(ctx, frequency, start, duration, volume, type)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    oscillator.start(start)
    oscillator.stop(start + duration)
  })
}
