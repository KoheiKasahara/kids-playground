import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

// まちづくりの こうかおん。おんせい ファイルは つかわず、Web Audio で その ばで つくる。

export type TownSound = 'select' | 'build' | 'road' | 'water' | 'erase' | 'undo' | 'grow' | 'view' | 'ride'

type Phrase = { notes: readonly number[]; gap: number; duration: number; volume: number; type: OscillatorType }

const PHRASES: Record<TownSound, Phrase> = {
  select: { notes: [988], gap: 0, duration: 0.08, volume: 0.12, type: 'triangle' },
  build: { notes: [523, 784], gap: 0.08, duration: 0.16, volume: 0.16, type: 'triangle' },
  road: { notes: [392, 523], gap: 0.05, duration: 0.11, volume: 0.15, type: 'triangle' },
  water: { notes: [880, 1175], gap: 0.06, duration: 0.12, volume: 0.13, type: 'sine' },
  erase: { notes: [392, 262], gap: 0.07, duration: 0.14, volume: 0.15, type: 'triangle' },
  undo: { notes: [659, 494], gap: 0.07, duration: 0.12, volume: 0.13, type: 'triangle' },
  grow: { notes: [523, 659, 784, 1047, 784, 1047], gap: 0.11, duration: 0.22, volume: 0.16, type: 'triangle' },
  // 3D で みる ときの ふわっと あがる おとと、のりものに のる ときの ぷっぷー。
  view: { notes: [392, 523, 659, 784], gap: 0.07, duration: 0.16, volume: 0.15, type: 'triangle' },
  ride: { notes: [659, 659, 523], gap: 0.13, duration: 0.1, volume: 0.15, type: 'triangle' },
}

export function playTownSound(kind: TownSound): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const phrase = PHRASES[kind]
    phrase.notes.forEach((note, index) => {
      playTone(ctx, note, ctx.currentTime + index * phrase.gap, phrase.duration, phrase.volume, phrase.type)
    })
  } catch {
    // おとが でなくても、たてものの うごきで あそべる。
  }
}
