import { describe, expect, test } from 'vitest'
import { ROOM_TYPES } from './data'
import { BGM_BARS, ROOM_VOICE, bgmMelody, freq, playHouseSound, startBgm } from './sounds'

describe('house-builder sounds', () => {
  test('おとの なまえを しゅうはすうに する', () => {
    expect(freq('A4')).toBeCloseTo(440)
    expect(freq('C5')).toBeCloseTo(523.25, 1)
    expect(freq('Bb5')).toBeCloseTo(932.33, 1)
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

  test('どの へやにも タップした ときの おとが ある', () => {
    for (const type of ROOM_TYPES) expect(ROOM_VOICE[type.id], type.id).toBeTruthy()
  })

  test('おとが だせない ところでも とまらない', () => {
    expect(() => playHouseSound('complete')).not.toThrow()
    const stop = startBgm()
    expect(() => stop()).not.toThrow()
  })
})
