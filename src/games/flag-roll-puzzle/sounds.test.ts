import { describe, expect, test } from 'vitest'
import { BGM_BARS, bgmMelody, freq, playPuzzleSound, startBgm, type PuzzleSound } from './sounds'

const ALL_SOUNDS: readonly PuzzleSound[] = [
  'pick', 'place', 'rotate', 'remove', 'blocked', 'clearAll', 'flag', 'drop', 'return',
  'stopped', 'goalOne', 'clear',
  'wood', 'bumper', 'jump', 'cannonLoad', 'cannonFire', 'spinner', 'conveyor', 'seesaw', 'fan', 'bubble', 'warp',
]

describe('flag-roll-puzzle sounds', () => {
  test('おとの なまえを しゅうはすうに する', () => {
    expect(freq('A4')).toBeCloseTo(440)
    expect(freq('C5')).toBeCloseTo(523.25, 1)
    expect(freq('H2')).toBe(0)
  })

  test('BGM は 1しょうせつ 8こ で、うたえる たかさの おとだけ', () => {
    const melody = bgmMelody()
    expect(melody).toHaveLength(BGM_BARS * 8)
    expect(freq(melody[0])).toBeGreaterThan(0)
    for (const step of melody) {
      if (step === '-' || step === '.') continue
      expect(freq(step), step).toBeGreaterThan(250)
      expect(freq(step), step).toBeLessThan(1500)
    }
  })

  test('おとが だせない ところでも とまらない', () => {
    for (const kind of ALL_SOUNDS) expect(() => playPuzzleSound(kind)).not.toThrow()
    const stop = startBgm()
    expect(() => stop()).not.toThrow()
  })
})
