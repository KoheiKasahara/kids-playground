import { describe, expect, test } from 'vitest'
import { PIANO_NOTES } from './notes'
import { PIANO_SONGS, validatePianoSong } from './pianoSongs'

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
})
