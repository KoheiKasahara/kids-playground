import { describe, expect, test } from 'vitest'
import { BLACK_NOTES, PIANO_NOTES, WHITE_NOTES, findPianoNote, midiToFrequency } from './notes'

describe('piano notes', () => {
  test('C4〜C5を自然な半音順で定義する', () => {
    expect(PIANO_NOTES.map((note) => note.id)).toEqual([
      'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5',
    ])
    expect(WHITE_NOTES.map((note) => note.id)).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'])
    expect(WHITE_NOTES).toHaveLength(8)
    expect(BLACK_NOTES).toHaveLength(5)
    expect(BLACK_NOTES.map((note) => note.whiteKeyIndex)).toEqual([0, 1, 3, 4, 5])
  })

  test('A4は440Hzで、IDからノートを参照できる', () => {
    expect(midiToFrequency(69)).toBe(440)
    expect(findPianoNote('A4')?.frequency).toBe(440)
    expect(findPianoNote('C#4')?.isBlack).toBe(true)
    expect(findPianoNote('C5')?.frequency).toBeCloseTo(523.251, 3)
  })
})
