import { getSharedAudioContext, getSoundOutput, isSoundEnabled, playTone } from '../../audio/sound'

export type FrogVoice = 'meadow' | 'sunny' | 'sky'

// ド・ミ・ソ。声が低い子ほど、のどを長くふくらませて歌う。
const VOICES = {
  meadow: { pitch: 261.63, duration: 0.32, volume: 0.23 },
  sunny: { pitch: 329.63, duration: 0.25, volume: 0.21 },
  sky: { pitch: 392, duration: 0.21, volume: 0.2 },
} as const

export function playFrog(voice: FrogVoice): void {
  const ctx = isSoundEnabled() ? getSharedAudioContext() : undefined
  if (!ctx) return

  const { pitch, duration, volume } = VOICES[voice]
  const start = ctx.currentTime
  const end = start + duration
  const throat = ctx.createOscillator()
  const mouth = ctx.createBiquadFilter()
  const gain = ctx.createGain()

  throat.type = 'sawtooth'
  throat.frequency.setValueAtTime(pitch * 0.85, start)
  throat.frequency.exponentialRampToValueAtTime(pitch, start + 0.025)
  throat.frequency.setValueAtTime(pitch, end - 0.06)
  throat.frequency.exponentialRampToValueAtTime(pitch * 0.88, end)

  // 口が開く「ケ」と、丸くすぼまる「ロ」を一つの息で鳴らす。
  mouth.type = 'lowpass'
  mouth.Q.value = 5
  mouth.frequency.setValueAtTime(pitch * 2, start)
  mouth.frequency.exponentialRampToValueAtTime(pitch * 5.5, start + 0.035)
  mouth.frequency.exponentialRampToValueAtTime(pitch * 1.7, end)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + 0.015)
  gain.gain.linearRampToValueAtTime(volume * 0.3, start + 0.065)
  gain.gain.linearRampToValueAtTime(volume, start + 0.095)
  gain.gain.linearRampToValueAtTime(0, end)

  throat.connect(mouth).connect(gain).connect(getSoundOutput(ctx))
  throat.start(start)
  throat.stop(end)
}

export function playPondTap(): void {
  const ctx = isSoundEnabled() ? getSharedAudioContext() : undefined
  if (!ctx) return
  playTone(ctx, 740, ctx.currentTime, 0.09, 0.13, 'sine')
  playTone(ctx, 990, ctx.currentTime + 0.045, 0.1, 0.08, 'sine')
}
