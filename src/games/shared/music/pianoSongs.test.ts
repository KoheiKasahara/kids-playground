import { describe, expect, test } from 'vitest'
import { PIANO_NOTES } from './notes'
import { PIANO_SONGS, findPianoSong, type PianoSong, validatePianoSong } from './pianoSongs'

// Issue #343で監査した、従来は0.5拍休符が追加されていたフレーズ接続箇所。
const PHRASE_END_NOTE_INDEXES: Readonly<Record<string, readonly number[]>> = {
  'twinkle-twinkle-little-star': [7, 15, 23, 31, 39],
  'mary-had-a-little-lamb': [7, 15],
  'ode-to-joy': [15],
  'london-bridge': [6, 12, 19],
  // 反復音の途中（音符15→16）は、意図した半拍休符のため監査対象から除く。
  'kaeru-no-uta': [7],
  'row-row-row-your-boat': [9, 21],
  'old-macdonald-had-a-farm': [6, 11, 19, 24, 34, 46, 53],
  chocho: [12, 27, 34, 41, 47],
  'jingle-bells': [5, 10, 25, 31, 36],
  'happy-birthday': [5, 11, 18],
  'going-home': [5, 10, 16],
  'brahms-lullaby': [],
  'vivaldi-spring': [6, 14, 22],
  'eine-kleine-nachtmusik': [],
  'can-can': [],
  'fur-elise': [],
}

/**
 * 各曲の拍子（1小節の拍数）と弱起の拍数。拍はその曲の`tempoBpm`の1拍で数える。
 * 小節線をまたぐ音があれば、音価の書き間違いでリズムがずれているとみなす。
 */
const SONG_METERS: Readonly<Record<string, { readonly beatsPerBar: number; readonly pickupBeats: number }>> = {
  'twinkle-twinkle-little-star': { beatsPerBar: 4, pickupBeats: 0 },
  'mary-had-a-little-lamb': { beatsPerBar: 4, pickupBeats: 0 },
  'ode-to-joy': { beatsPerBar: 4, pickupBeats: 0 },
  'london-bridge': { beatsPerBar: 4, pickupBeats: 0 },
  'kaeru-no-uta': { beatsPerBar: 4, pickupBeats: 0 },
  // 8分の6拍子を、付点4分音符2拍で数える。
  'row-row-row-your-boat': { beatsPerBar: 2, pickupBeats: 0 },
  'old-macdonald-had-a-farm': { beatsPerBar: 4, pickupBeats: 0 },
  // 4分の2拍子を、8分音符4拍で数える。
  chocho: { beatsPerBar: 4, pickupBeats: 0 },
  'jingle-bells': { beatsPerBar: 4, pickupBeats: 0 },
  'happy-birthday': { beatsPerBar: 3, pickupBeats: 1 },
  'going-home': { beatsPerBar: 4, pickupBeats: 0 },
  'brahms-lullaby': { beatsPerBar: 3, pickupBeats: 1 },
  'vivaldi-spring': { beatsPerBar: 4, pickupBeats: 1 },
  'eine-kleine-nachtmusik': { beatsPerBar: 4, pickupBeats: 0 },
  // 4分の2拍子を、4分音符2拍で数える。
  'can-can': { beatsPerBar: 2, pickupBeats: 0 },
  // 8分の3拍子を、16分音符を半拍として3拍で数える。
  'fur-elise': { beatsPerBar: 3, pickupBeats: 1 },
}

const EXPECTED_OPENING_NOTE_IDS: Readonly<Record<string, readonly string[]>> = {
  'twinkle-twinkle-little-star': ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4'],
  'mary-had-a-little-lamb': ['E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4'],
  'ode-to-joy': ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4'],
  'london-bridge': ['G4', 'A4', 'G4', 'F4', 'E4', 'F4', 'G4'],
  'kaeru-no-uta': ['C4', 'D4', 'E4', 'F4', 'E4', 'D4', 'C4'],
  'row-row-row-your-boat': ['C4', 'C4', 'C4', 'D4', 'E4'],
  'old-macdonald-had-a-farm': ['C5', 'C5', 'C5', 'G4', 'A4', 'A4', 'G4'],
  chocho: ['G4', 'E4', 'E4', 'F4', 'D4', 'D4', 'C4'],
  'jingle-bells': ['E4', 'E4', 'E4', 'E4', 'E4', 'E4'],
  'happy-birthday': ['C4', 'C4', 'D4', 'C4', 'F4', 'E4'],
  'going-home': ['E4', 'G4', 'G4', 'E4', 'D4', 'C4'],
  'brahms-lullaby': ['E4', 'E4', 'G4', 'E4', 'E4', 'G4'],
  'vivaldi-spring': ['C4', 'E4', 'E4', 'E4', 'D4', 'C4', 'G4'],
  'eine-kleine-nachtmusik': ['G4', 'D4', 'G4', 'D4', 'G4', 'D4', 'G4', 'B4', 'D5'],
  'can-can': ['C4', 'D4', 'F4', 'E4', 'D4', 'G4', 'G4', 'G4'],
  'fur-elise': ['E5', 'D#5', 'E5', 'D#5', 'E5', 'B4', 'D5', 'C5', 'A4'],
}

describe('PIANO_SONGS', () => {
  test('童謡10曲とクラシック6曲を一意なIDで登録する', () => {
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
      'とおき山に日はおちて',
      'ブラームスのこもりうた',
      'はる（四季）',
      'アイネ・クライネ・ナハトムジーク',
      'てんごくとじごく',
      'エリーゼのために',
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
    expect(EXPECTED_OPENING_NOTE_IDS['old-macdonald-had-a-farm']).toEqual(['C5', 'C5', 'C5', 'G4', 'A4', 'A4', 'G4'])
    expect(EXPECTED_OPENING_NOTE_IDS['old-macdonald-had-a-farm']).not.toEqual(twinkleOpening)
  })

  test('すべての曲データは有効で、使用音はC4〜E5の17鍵に限定される', () => {
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

  test('ハッピーバースデーの最終フレーズはシ♭・ラを含む正しい下降になる', () => {
    const notes = findPianoSong('happy-birthday')!.timeline.filter((item) => item.kind === 'note')
    expect(notes.slice(-6).map((item) => item.noteId)).toEqual(['A#4', 'A#4', 'A4', 'F4', 'G4', 'F4'])
  })

  test('すべての曲で、音符が小節線をまたがず拍子どおりに並ぶ', () => {
    expect(Object.keys(SONG_METERS).sort()).toEqual(PIANO_SONGS.map((song) => song.id).sort())

    for (const song of PIANO_SONGS) {
      const { beatsPerBar, pickupBeats } = SONG_METERS[song.id]
      const beatMs = 60_000 / song.tempoBpm
      // 音価をmsへ丸めた誤差が曲の後半で積み重なる分を吸収する幅（拍）。半拍のずれは検出できる。
      const tolerance = 0.05
      const barOffset = (ms: number) => {
        const beats = ms / beatMs - pickupBeats
        return beats - Math.floor(beats / beatsPerBar + tolerance) * beatsPerBar
      }
      // 最後の音は余韻として小節の終わりより長く伸ばしてよい。
      for (const item of song.timeline.slice(0, -1)) {
        const end = barOffset(item.startMs) + item.durationMs / beatMs
        expect(end, `${song.title} ${item.startMs}ms`).toBeLessThanOrEqual(beatsPerBar + tolerance)
      }
      const last = song.timeline.at(-1)!
      expect(barOffset(last.startMs), `${song.title} の最後の音は小節の途中から始まらない`).toBeLessThan(beatsPerBar)
    }
  })

  test('かえるのうたは「くわっ」4回を半拍休符で区切り、「けけけけ けけけけ」を8分音符で鳴らす', () => {
    const timeline = findPianoSong('kaeru-no-uta')!.timeline.slice(14)
    const detachedPart = timeline.slice(0, 8)

    for (let index = 0; index < detachedPart.length; index += 2) {
      expect(detachedPart[index]).toMatchObject({ kind: 'note', noteId: 'C4', durationMs: 268 })
      expect(detachedPart[index + 1]).toMatchObject({ kind: 'rest', durationMs: 268 })
    }
    const rest = timeline.slice(8)
    expect(rest.every((item) => item.kind === 'note')).toBe(true)
    expect(rest.map((item) => (item.kind === 'note' ? item.noteId : 'rest'))).toEqual([
      'C4', 'C4', 'D4', 'D4', 'E4', 'E4', 'F4', 'F4', 'E4', 'D4', 'C4',
    ])
    expect(rest.slice(0, 8).every((item) => item.durationMs === 268)).toBe(true)
    expect(rest.at(-1)).toMatchObject({ noteId: 'C4', durationMs: 1_071 })
  })

  test('ゆかいな牧場は低いソへ下がり、高いミ・レからドへ戻る', () => {
    const notes = findPianoSong('old-macdonald-had-a-farm')!.timeline.filter((item) => item.kind === 'note')
    expect(notes.slice(0, 12).map((item) => item.noteId)).toEqual([
      'C5', 'C5', 'C5', 'G4', 'A4', 'A4', 'G4', 'E5', 'E5', 'D5', 'D5', 'C5',
    ])
    expect(notes.slice(-5).map((item) => item.noteId)).toEqual(['E5', 'E5', 'D5', 'D5', 'C5'])
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
