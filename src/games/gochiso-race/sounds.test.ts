import { describe, expect, test } from 'vitest'
import { BGM_BARS, bgmMelody, freq } from './sounds'

describe('gochiso-race music', () => {
  test('note names become frequencies', () => {
    expect(freq('A4')).toBeCloseTo(440)
    expect(freq('C5')).toBeCloseTo(523.25, 1)
    expect(freq('Bb2')).toBeCloseTo(116.54, 1)
    expect(freq('nope')).toBe(0)
  })

  test('the race music has 8 steps per bar and only real notes', () => {
    const melody = bgmMelody()
    expect(melody).toHaveLength(BGM_BARS * 8)
    expect(freq(melody[0])).toBeGreaterThan(0)
    for (const step of melody) {
      if (step === '-' || step === '.') continue
      expect(freq(step), step).toBeGreaterThan(200)
      expect(freq(step), step).toBeLessThan(1700)
    }
  })
})
