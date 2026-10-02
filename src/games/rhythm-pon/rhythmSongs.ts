import { findPianoSong, type PianoSong } from '../shared/music/pianoSongs'

export type RhythmSongId =
  | 'twinkle-twinkle-little-star'
  | 'ode-to-joy'
  | 'going-home'
  | 'brahms-lullaby'
  | 'vivaldi-spring'
  | 'eine-kleine-nachtmusik'
  | 'can-can'
  | 'fur-elise'

export type RhythmSongDefinition = {
  readonly id: RhythmSongId
  /** カードに出す、ひらがな中心の曲名。 */
  readonly title: string
  readonly composer: string
  /** リズムゲーム用のテンポ。ピアノの自動演奏より遅くして、4〜6歳でも追いつけるようにする。 */
  readonly tempoBpm: number
  /** 1〜3。カードの「♪」の数。 */
  readonly level: 1 | 2 | 3
  readonly emoji: string
  /** ステージの色（背景・ライト）。 */
  readonly theme: { readonly sky: string; readonly glow: string }
}

/**
 * ピアノと共有する曲データのうち、クラシック（作曲者の没後70年以上）の曲だけを並べる。
 * 旋律そのものは shared/music/pianoSongs を正とし、ここにはリズムゲーム固有の見せ方だけを持つ。
 */
export const RHYTHM_SONGS: readonly RhythmSongDefinition[] = [
  { id: 'twinkle-twinkle-little-star', title: 'きらきらぼし', composer: 'モーツァルト へんきょく', tempoBpm: 84, level: 1, emoji: '⭐', theme: { sky: '#2b2a78', glow: '#ffd84d' } },
  { id: 'ode-to-joy', title: 'よろこびのうた', composer: 'ベートーヴェン', tempoBpm: 88, level: 1, emoji: '🎺', theme: { sky: '#1f4f8f', glow: '#7fe3ff' } },
  { id: 'going-home', title: 'とおき山に日はおちて', composer: 'ドヴォルザーク', tempoBpm: 76, level: 1, emoji: '🌄', theme: { sky: '#6a2c63', glow: '#ffa35c' } },
  { id: 'brahms-lullaby', title: 'こもりうた', composer: 'ブラームス', tempoBpm: 84, level: 2, emoji: '🌙', theme: { sky: '#1d2c63', glow: '#c9b6ff' } },
  { id: 'vivaldi-spring', title: 'はる', composer: 'ヴィヴァルディ', tempoBpm: 84, level: 2, emoji: '🌸', theme: { sky: '#3f6b3a', glow: '#ffb3d1' } },
  { id: 'eine-kleine-nachtmusik', title: 'アイネ・クライネ', composer: 'モーツァルト', tempoBpm: 88, level: 2, emoji: '🎻', theme: { sky: '#3a2468', glow: '#ffe07a' } },
  { id: 'can-can', title: 'てんごくと じごく', composer: 'オッフェンバック', tempoBpm: 104, level: 3, emoji: '🏃', theme: { sky: '#7a1f3d', glow: '#ffcf3f' } },
  { id: 'fur-elise', title: 'エリーゼのために', composer: 'ベートーヴェン', tempoBpm: 100, level: 3, emoji: '💌', theme: { sky: '#223a5c', glow: '#9ff2d8' } },
]

export function findRhythmSong(id: string): RhythmSongDefinition | undefined {
  return RHYTHM_SONGS.find((song) => song.id === id)
}

/** リズムゲームの曲に対応する、ピアノと共有の旋律データ。 */
export function melodyForRhythmSong(song: RhythmSongDefinition): PianoSong {
  const melody = findPianoSong(song.id)
  if (!melody) throw new Error(`共有曲データがありません: ${song.id}`)
  return melody
}
