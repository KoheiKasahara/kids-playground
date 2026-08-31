import { describe, expect, test } from 'vitest'
import { PIANO_NOTES } from './notes'
import { PIANO_SONGS, findPianoSong, type PianoSong, validatePianoSong } from './pianoSongs'

// Issue #343で監査した、従来は0.5拍休符が追加されていたフレーズ接続箇所。
const PHRASE_END_NOTE_INDEXES: Readonly<Record<string, readonly number[]>> = {
  'twinkle-twinkle-little-star': [7, 15, 23, 31, 39],
  'mary-had-a-little-lamb': [7, 15],
  'ode-to-joy': [15],
  'london-bridge': [6, 12, 19],
  'kaeru-no-uta': [7, 15],
  'row-row-row-your-boat': [5, 11],
  'old-macdonald-had-a-farm': [7, 13, 21],
  chocho: [7, 15, 23],
  'jingle-bells': [5, 10],
  'happy-birthday': [5, 11, 18],
}

const EXPECTED_OPENING_NOTE_IDS: Readonly<Record<string, readonly string[]>> = {
  'twinkle-twinkle-little-star': ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4'],
  'mary-had-a-little-lamb': ['E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4'],
  'ode-to-joy': ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4'],
  'london-bridge': ['G4', 'A4', 'G4', 'F4', 'E4', 'F4', 'G4'],
  'kaeru-no-uta': ['C4', 'D4', 'E4', 'F4', 'E4', 'D4', 'C4'],
  'row-row-row-your-boat': ['C4', 'C4', 'C4', 'D4', 'E4'],
  'old-macdonald-had-a-farm': ['C4', 'C4', 'C4', 'G4', 'A4', 'A4', 'G4'],
  chocho: ['G4', 'E4', 'E4', 'F4', 'D4', 'D4', 'C4'],
  'jingle-bells': ['E4', 'E4', 'E4', 'E4', 'E4', 'E4'],
  'happy-birthday': ['C4', 'C4', 'D4', 'C4', 'F4', 'E4'],
}

describe('PIANO_SONGS', () => {
  test('Phase 3の10曲を一意なIDで登録する', () => {
    expect(PIANO_SONGS.map((song) => song.title)).toEqual([
      'きらきらぼし',
      'メリーさんのひつじ',
      'よろこびのうた',
      'ロンドンばし',
      'かえるのうた',
      'こげこげボート',
      'ゆかいな牧場',
      'ちょうちょう',
      'ジングルベル',
      'ハッピーバースデー',
    ])
    expect(new Set(PIANO_SONGS.map((song) => song.id)).size).toBe(PIANO_SONGS.length)
  })

  test('曲IDから同じ曲データを取得でき、全曲の冒頭メロディが曲名と対応する', () => {
    expect(Object.keys(EXPECTED_OPENING_NOTE_IDS).sort()).toEqual(PIANO_SONGS.map((song) => song.id).sort())

    for (const song of PIANO_SONGS) {
      expect(findPianoSong(song.id)).toBe(song)
      const opening = song.timeline
        .filter((item) => item.kind === 'note')
        .slice(0, EXPECTED_OPENING_NOTE_IDS[song.id].length)
        .map((item) => item.noteId)
      expect(opening, song.title).toEqual(EXPECTED_OPENING_NOTE_IDS[song.id])
    }
  })

  test('報告された曲は別曲の冒頭データを参照しない', () => {
    const twinkleOpening = EXPECTED_OPENING_NOTE_IDS['twinkle-twinkle-little-star']
    const previousLondonOpening = ['C4', 'D4', 'E4', 'D4', 'C4', 'D4', 'E4']

    expect(EXPECTED_OPENING_NOTE_IDS['london-bridge']).toEqual(['G4', 'A4', 'G4', 'F4', 'E4', 'F4', 'G4'])
    expect(EXPECTED_OPENING_NOTE_IDS['london-bridge']).not.toEqual(previousLondonOpening)
    expect(EXPECTED_OPENING_NOTE_IDS['old-macdonald-had-a-farm']).toEqual(['C4', 'C4', 'C4', 'G4', 'A4', 'A4', 'G4'])
    expect(EXPECTED_OPENING_NOTE_IDS['old-macdonald-had-a-farm']).not.toEqual(twinkleOpening)
  })

  test('すべての曲データは有効で、使用音はC4〜C5の13鍵に限定される', () => {
    const validNoteIds = new Set(PIANO_NOTES.map((note) => note.id))

    for (const song of PIANO_SONGS) {
      expect(validatePianoSong(song)).toEqual([])
      const notes = song.timeline.filter((item) => item.kind === 'note')
      expect(notes.length).toBeGreaterThan(0)
      expect(notes.every((item) => validNoteIds.has(item.noteId))).toBe(true)
      expect(Math.min(...notes.map((item) => PIANO_NOTES.findIndex((note) => note.id === item.noteId)))).toBeGreaterThanOrEqual(0)
      expect(Math.max(...notes.map((item) => PIANO_NOTES.findIndex((note) => note.id === item.noteId)))).toBeLessThan(PIANO_NOTES.length)
    }
  })

  test('監査した全曲のフレーズ接続箇所に追加の無音時間を入れない', () => {
    for (const song of PIANO_SONGS) {
      const notes = song.timeline.filter((item) => item.kind === 'note')

      for (const phraseEndIndex of PHRASE_END_NOTE_INDEXES[song.id]) {
        const phraseEnd = notes[phraseEndIndex]
        const nextPhraseStart = notes[phraseEndIndex + 1]
        expect(nextPhraseStart.startMs).toBe(phraseEnd.startMs + phraseEnd.durationMs)
      }
    }
  })

  test('曲データは音楽的に必要な休符を引き続き表現できる', () => {
    const songWithIntentionalRest: PianoSong = {
      id: 'intentional-rest',
      title: '意図した休符',
      tempoBpm: 120,
      timeline: [
        { kind: 'note', noteId: 'C4', startMs: 0, durationMs: 500 },
        { kind: 'rest', startMs: 500, durationMs: 250 },
        { kind: 'note', noteId: 'G4', startMs: 750, durationMs: 500 },
      ],
      totalDurationMs: 1_250,
    }

    expect(validatePianoSong(songWithIntentionalRest)).toEqual([])
  })
})
