import { createToneNodes, getSharedAudioContext, isSoundEnabled } from '../../audio/sound'

export function journeySound(kind: 'horn' | 'switch' | 'station' | 'boost' | 'rail') {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  const notes = kind === 'horn' ? [392, 523.25] : kind === 'station' ? [659, 523, 784] : kind === 'boost' ? [440, 660, 880] : kind === 'switch' ? [620, 830] : [160]
  notes.forEach((frequency, i) => {
    const start = now + i * (kind === 'horn' ? 0.06 : 0.1)
    const duration = kind === 'horn' ? 0.65 : kind === 'rail' ? 0.045 : 0.18
    const { oscillator, gain } = createToneNodes(ctx, frequency, start, duration, kind === 'rail' ? 0.009 : 0.035, kind === 'horn' ? 'triangle' : 'sine')
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    oscillator.start(start)
    oscillator.stop(start + duration)
  })
}
