export const PAPER_WIDTH = 960
export const PAPER_HEIGHT = 720
export const ROLLER_PAPER_HEIGHT = 960
export const STAMP_SCALE = 1.65

// Shared vector paths keep the picker, toy roller and painted marks identical.
export const PATTERNS = [
  { id: 'flower', name: 'おはな', spacing: 37, path: 'M0-9 C-15-28-29-8-13 0 C-30 10-12 28 0 13 C12 28 30 10 13 0 C29-8 15-28 0-9Z', detail: 'M5 1 A5 5 0 1 1-5 1 A5 5 0 1 1 5 1' },
  { id: 'star', name: 'ほし', spacing: 36, path: 'M0-22 6-7 22-7 10 4 14 21 0 12-14 21-10 4-22-7-6-7Z', detail: 'M-3-10 0-16 3-8Z' },
  { id: 'paw', name: 'あしあと', spacing: 31, path: 'M-12 5 C-18 21 18 21 12 5 L5-3 Q0-8-5-3Z M-11-10 A5 7 0 1 1-21-10 A5 7 0 1 1-11-10 M0-17 A5 7 0 1 1-10-17 A5 7 0 1 1 0-17 M11-17 A5 7 0 1 1 1-17 A5 7 0 1 1 11-17 M22-9 A5 7 0 1 1 12-9 A5 7 0 1 1 22-9', detail: '' },
  { id: 'heart', name: 'ハート', spacing: 36, path: 'M0 21 C-40-4-17-31 0-13 C17-31 40-4 0 21Z', detail: 'M-14-9 Q-9-16-5-9 Q-11-12-14-5Z' },
  { id: 'stripe', name: 'しましま', spacing: 15, path: 'M-7-23 H7 V23 H-7Z', detail: 'M-7-16 H7 V-12 H-7Z' },
  { id: 'circle', name: 'まる', spacing: 32, path: 'M0-20 A20 20 0 1 1 0 20 A20 20 0 1 1 0-20Z', detail: 'M0-11 A11 11 0 1 0 0 11 A11 11 0 1 0 0-11Z' },
  { id: 'ribbon', name: 'リボン', spacing: 37, path: 'M-2-5 C-13-22-29-17-23 1 C-18 15-8 11 0 5 C8 11 18 15 23 1 C29-17 13-22 2-5 L14 22 0 13-14 22Z', detail: 'M-5-6 H5 V5 H-5Z' },
  { id: 'note', name: 'おんぷ', spacing: 32, path: 'M3-23 H10 V8 C10 21-12 24-16 12 C-19 2-8-5 3 0Z', detail: 'M5-18 H9 V-13 H5Z' },
] as const
export type Pattern = typeof PATTERNS[number]

export const COLORS = [
  { name: 'ももいろ', value: '#e95482' },
  { name: 'オレンジ', value: '#ed9234' },
  { name: 'きいろ', value: '#d5ad18' },
  { name: 'みどり', value: '#36a784' },
  { name: 'あお', value: '#408dcc' },
  { name: 'むらさき', value: '#9362cd' },
] as const

export const ROLLER_COLORS = [
  ...COLORS,
  { name: 'あか', value: '#e44640' },
  { name: 'みずいろ', value: '#63bfd5' },
  { name: 'ちゃいろ', value: '#8b654e' },
  { name: 'しろ', value: '#fffaf0' },
] as const

export const PAPERS = [
  { id: 'plain', name: 'しろ', color: '#fffdf8', icon: '□' },
  { id: 'sky', name: 'そら', color: '#e4f3fc', icon: '☁' },
  { id: 'meadow', name: 'はらっぱ', color: '#eaf5df', icon: '❀' },
  { id: 'night', name: 'よぞら', color: '#263657', icon: '☾' },
] as const
export type Paper = typeof PAPERS[number]
