import { findPianoNote, type PianoNoteId } from './notes'

type PianoSongNote = {
  readonly kind: 'note'
  readonly noteId: PianoNoteId
  readonly startMs: number
  readonly durationMs: number
}

type PianoSongRest = {
  readonly kind: 'rest'
  readonly startMs: number
  readonly durationMs: number
}

export type PianoSongTimelineItem = PianoSongNote | PianoSongRest

export type PianoSong = {
  readonly id: string
  readonly title: string
  readonly tempoBpm: number
  readonly timeline: readonly PianoSongTimelineItem[]
  readonly totalDurationMs: number
}

type SongStep = readonly [noteId: PianoNoteId | 'rest', beats: number]

type SongDefinition = {
  readonly id: string
  readonly title: string
  readonly tempoBpm: number
  readonly steps: readonly SongStep[]
}

function defineSong({ id, title, tempoBpm, steps }: SongDefinition): PianoSong {
  const beatMs = 60_000 / tempoBpm
  let startMs = 0
  const timeline: PianoSongTimelineItem[] = []

  for (const [noteId, beats] of steps) {
    const durationMs = Math.round(beats * beatMs)
    if (noteId === 'rest') {
      timeline.push({ kind: 'rest', startMs, durationMs })
    } else {
      timeline.push({ kind: 'note', noteId, startMs, durationMs })
    }
    startMs += durationMs
  }

  return { id, title, tempoBpm, timeline, totalDurationMs: startMs }
}

/**
 * パブリックドメインの旋律を、このアプリのC4〜C5鍵盤向けに独自に単旋律化した曲データ。
 * 演奏側は曲ごとの分岐を持たず、このタイムラインをそのまま再生する。
 * Issue #343の全曲監査では、既存の休符はすべてフレーズ末尾に一律で置かれた0.5拍の待ち時間だったため削除した。
 * 将来、音楽的に必要な休符がある曲ではSongStepの`rest`を使用できる。
 */
export const PIANO_SONGS: readonly PianoSong[] = [
  defineSong({
    id: 'twinkle-twinkle-little-star',
    title: 'きらきらぼし',
    tempoBpm: 106,
    steps: [
      ['C4', 1], ['C4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
      ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2],
      ['G4', 1], ['G4', 1], ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 2],
      ['G4', 1], ['G4', 1], ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 2],
      ['C4', 1], ['C4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
      ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2],
    ],
  }),
  defineSong({
    id: 'mary-had-a-little-lamb',
    title: 'メリーさんのひつじ',
    tempoBpm: 112,
    steps: [
      ['E4', 1], ['D4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['E4', 2],
      ['D4', 1], ['D4', 1], ['D4', 2], ['E4', 1], ['G4', 1], ['G4', 2],
      ['E4', 1], ['D4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['E4', 1], ['E4', 1],
      ['D4', 1], ['D4', 1], ['E4', 1], ['D4', 1], ['C4', 2],
    ],
  }),
  defineSong({
    id: 'ode-to-joy',
    title: 'よろこびのうた',
    tempoBpm: 110,
    steps: [
      ['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
      ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1.5], ['D4', 0.5], ['D4', 2],
      ['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
      ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['D4', 1.5], ['C4', 0.5], ['C4', 2],
    ],
  }),
  defineSong({
    id: 'london-bridge',
    title: 'ロンドンばし',
    tempoBpm: 116,
    steps: [
      ['G4', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['F4', 1], ['G4', 2],
      ['D4', 1], ['E4', 1], ['F4', 1], ['E4', 1], ['F4', 1], ['G4', 2],
      ['G4', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['F4', 1], ['G4', 2],
      ['D4', 1], ['G4', 1], ['E4', 1], ['C4', 2],
    ],
  }),
  defineSong({
    id: 'kaeru-no-uta',
    title: 'かえるのうた',
    tempoBpm: 112,
    steps: [
      ['C4', 1], ['D4', 1], ['E4', 1], ['F4', 1], ['E4', 1], ['D4', 1], ['C4', 2],
      ['E4', 1], ['F4', 1], ['G4', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 2],
      ['C4', 1], ['C4', 1], ['C4', 1], ['C4', 1], ['D4', 1], ['D4', 1], ['D4', 1], ['D4', 1],
      ['E4', 1], ['E4', 1], ['F4', 1], ['F4', 1], ['E4', 1], ['D4', 1], ['C4', 2],
    ],
  }),
  defineSong({
    id: 'row-row-row-your-boat',
    title: 'こげこげボート',
    tempoBpm: 104,
    steps: [
      ['C4', 1], ['C4', 1], ['C4', 1.5], ['D4', 0.5], ['E4', 1],
      ['E4', 1], ['D4', 0.5], ['E4', 0.5], ['F4', 1], ['G4', 2],
      ['C5', 1], ['C5', 0.5], ['C5', 0.5], ['G4', 0.5], ['G4', 0.5], ['E4', 0.5], ['E4', 0.5], ['C4', 0.5], ['C4', 0.5], ['G4', 0.5], ['F4', 0.5], ['E4', 0.5], ['D4', 0.5], ['C4', 2],
    ],
  }),
  defineSong({
    id: 'old-macdonald-had-a-farm',
    title: 'ゆかいな牧場',
    tempoBpm: 108,
    steps: [
      ['C4', 1], ['C4', 1], ['C4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
      ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2],
      ['G4', 1], ['G4', 1], ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 2],
      ['C4', 1], ['C4', 1], ['C4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
    ],
  }),
  defineSong({
    id: 'chocho',
    title: 'ちょうちょう',
    tempoBpm: 112,
    steps: [
      ['G4', 1], ['E4', 1], ['E4', 1], ['F4', 1], ['D4', 1], ['D4', 1], ['C4', 2],
      ['D4', 1], ['E4', 1], ['F4', 1], ['G4', 1], ['G4', 1], ['G4', 1], ['G4', 2],
      ['G4', 1], ['E4', 1], ['E4', 1], ['F4', 1], ['D4', 1], ['D4', 1], ['C4', 2],
      ['E4', 1], ['G4', 1], ['G4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2],
    ],
  }),
  defineSong({
    id: 'jingle-bells',
    title: 'ジングルベル',
    tempoBpm: 126,
    steps: [
      ['E4', 1], ['E4', 1], ['E4', 2], ['E4', 1], ['E4', 1], ['E4', 2],
      ['E4', 1], ['G4', 1], ['C4', 1.5], ['D4', 0.5], ['E4', 4],
      ['F4', 1], ['F4', 1], ['F4', 1.5], ['F4', 0.5], ['F4', 1], ['E4', 1], ['E4', 1], ['E4', 0.5], ['E4', 0.5],
      ['E4', 1], ['D4', 1], ['D4', 1], ['E4', 1], ['D4', 2], ['G4', 2],
    ],
  }),
  defineSong({
    id: 'happy-birthday',
    title: 'ハッピーバースデー',
    tempoBpm: 96,
    steps: [
      ['C4', 0.75], ['C4', 0.25], ['D4', 1], ['C4', 1], ['F4', 1], ['E4', 2],
      ['C4', 0.75], ['C4', 0.25], ['D4', 1], ['C4', 1], ['G4', 1], ['F4', 2],
      ['C4', 0.75], ['C4', 0.25], ['C5', 1], ['A4', 1], ['F4', 1], ['E4', 1], ['D4', 2],
      ['A4', 0.75], ['A4', 0.25], ['G4', 1], ['F4', 1], ['G4', 1], ['F4', 2],
    ],
  }),
]

export function findPianoSong(id: string): PianoSong | undefined {
  return PIANO_SONGS.find((song) => song.id === id)
}

/** 曲データを増やす際に、テストから共通して検証するための最小バリデーション。 */
export function validatePianoSong(song: PianoSong): string[] {
  const errors: string[] = []
  if (!song.id) errors.push('曲IDがありません')
  if (!song.title) errors.push('曲名がありません')
  if (!Number.isFinite(song.tempoBpm) || song.tempoBpm <= 0) errors.push('テンポが不正です')
  if (!Number.isFinite(song.totalDurationMs) || song.totalDurationMs <= 0) errors.push('総再生時間が不正です')
  if (song.timeline.length === 0) errors.push('音符データがありません')

  let previousEndMs = 0
  for (const item of song.timeline) {
    if (!Number.isFinite(item.startMs) || item.startMs !== previousEndMs) errors.push('開始タイミングが不正です')
    if (!Number.isFinite(item.durationMs) || item.durationMs <= 0) errors.push('音価が不正です')
    if (item.kind === 'note' && !findPianoNote(item.noteId)) errors.push(`未定義の音符です: ${item.noteId}`)
    previousEndMs = item.startMs + item.durationMs
  }
  if (previousEndMs !== song.totalDurationMs) errors.push('総再生時間がタイムラインと一致しません')
  return errors
}
