import { describe, expect, test } from 'vitest'
import { BLACK_NOTES, PIANO_NOTES, WHITE_NOTES, findPianoNote, midiToFrequency } from './notes'

describe('piano notes', () => {
  test('C4〜B4を自然な半音順で定義する', () => {
    expect(PIANO_NOTES.map((note) => note.id)).toEqual([
      'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
    ])
    expect(WHITE_NOTES).toHaveLength(7)
    expect(BLACK_NOTES).toHaveLength(5)
  })

  test('A4は440Hzで、IDからノートを参照できる', () => {
    expect(midiToFrequency(69)).toBe(440)
    expect(findPianoNote('A4')?.frequency).toBe(440)
    expect(findPianoNote('C#4')?.isBlack).toBe(true)
  })
})
