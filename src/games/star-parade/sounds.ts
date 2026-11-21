import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

function chime(notes: readonly number[], interval: number, duration: number): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    notes.forEach((frequency, index) => {
      const start = now + index * interval
      playTone(ctx, frequency, start, duration, 0.14, 'triangle')
      playTone(ctx, frequency * 2, start, 0.09, 0.04, 'sine')
    })
  } catch {
    // 星の数と打ち上げの演出は、音声を利用できない端末でも進める。
  }
}

export function playStart(): void {
  chime([392, 523, 784], 0.095, 0.16)
}

export function playGrow(): void {
  chime([784, 1047], 0.065, 0.19)
}

export function playShrink(): void {
  chime([659, 523], 0.105, 0.17)
}

export function playJump(): void {
  chime([587, 880], 0.045, 0.08)
}

export function playHit(): void {
  chime([415, 294, 220], 0.04, 0.14)
}

export function playFinish(): void {
  chime([523, 659, 784, 1047, 1319], 0.1, 0.35)
}
