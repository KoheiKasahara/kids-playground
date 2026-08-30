import { describe, expect, test } from 'vitest'
import { PIANO_NOTES } from './notes'
import {
  INSTRUMENT_SPECS,
  PIANO_SAMPLE_DEFINITIONS,
  findPianoSample,
  resolveInstrumentSample,
} from './pianoSamples'

describe('piano sample mapping', () => {
  test('C4〜C5の13鍵すべてを個別の同音程サンプルへ対応付ける', () => {
    expect(PIANO_SAMPLE_DEFINITIONS).toHaveLength(13)
    expect(PIANO_SAMPLE_DEFINITIONS.map((sample) => sample.noteId)).toEqual(PIANO_NOTES.map((note) => note.id))
    expect(new Set(PIANO_SAMPLE_DEFINITIONS.map((sample) => sample.noteId)).size).toBe(13)
    expect(new Set(PIANO_SAMPLE_DEFINITIONS.map((sample) => sample.url)).size).toBe(13)
    expect(PIANO_SAMPLE_DEFINITIONS.every((sample) => sample.url.endsWith('.mp3'))).toBe(true)
    expect(PIANO_SAMPLE_DEFINITIONS.every((sample) => sample.gain > 0)).toBe(true)
  })

  test('C4/C5境界と黒鍵5本を公式配布時のフラット表記へ正しく対応付ける', () => {
    expect(findPianoSample('C4')?.sourceFile).toBe('Piano.mf.C4.aiff')
    expect(findPianoSample('C5')?.sourceFile).toBe('Piano.mf.C5.aiff')
    expect(['C#4', 'D#4', 'F#4', 'G#4', 'A#4'].map((noteId) => findPianoSample(noteId)?.sourceFile)).toEqual([
      'Piano.mf.Db4.aiff',
      'Piano.mf.Eb4.aiff',
      'Piano.mf.Gb4.aiff',
      'Piano.mf.Ab4.aiff',
      'Piano.mf.Bb4.aiff',
    ])
  })

  test('4楽器は公式アンカーだけを定義し、全13鍵を最近傍移調で解決する', () => {
    expect(INSTRUMENT_SPECS.map((spec) => spec.id)).toEqual(['piano', 'violin', 'trumpet', 'flute', 'xylophone'])
    expect(INSTRUMENT_SPECS.map((spec) => spec.samples.length)).toEqual([13, 5, 4, 4, 3])
    expect(INSTRUMENT_SPECS.map((spec) => spec.maxPitchShift)).toEqual([0, 2, 2, 2, 3])
    for (const instrument of INSTRUMENT_SPECS) {
      for (const note of PIANO_NOTES) {
        const resolved = resolveInstrumentSample(instrument.id, note.id)
        expect(resolved).toBeDefined()
        expect(resolved?.playbackRate).toBeGreaterThan(0)
        expect(resolved?.definition.url).toMatch(/\.mp3$/)
        expect(Math.abs(resolved?.pitchShiftSemitones ?? Infinity)).toBeLessThanOrEqual(instrument.maxPitchShift)
      }
    }
    expect(resolveInstrumentSample('violin', 'C#4')?.definition.noteId).toBe('C4')
    expect(resolveInstrumentSample('xylophone', 'D#4')?.definition.noteId).toBe('C4')
  })
})
