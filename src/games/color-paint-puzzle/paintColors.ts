// うごくぬりえのパレット定義。
// 色はcolorId（例: 'red'）で状態に保持し、hexは表示直前にfindPaintColorで引く
// （Phase 2で「塗った色のまま絵を動かす」ような再利用をしやすくするため）。

export type PaintColorId =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'brown'

export type PaintColor = {
  id: PaintColorId
  label: string
  hex: string
}

export const PAINT_COLORS: readonly PaintColor[] = [
  { id: 'red', label: 'あか', hex: '#e8453c' },
  { id: 'orange', label: 'オレンジ', hex: '#f76707' },
  { id: 'yellow', label: 'きいろ', hex: '#fcc419' },
  { id: 'green', label: 'みどり', hex: '#37b24d' },
  { id: 'blue', label: 'あお', hex: '#1c7ed6' },
  { id: 'purple', label: 'むらさき', hex: '#9c36b5' },
  { id: 'pink', label: 'ピンク', hex: '#f06595' },
  { id: 'brown', label: 'ちゃいろ', hex: '#8b5a2b' },
]

export const DEFAULT_PAINT_COLOR_ID: PaintColorId = 'red'

export function findPaintColor(id: PaintColorId): PaintColor | undefined {
  return PAINT_COLORS.find((color) => color.id === id)
}

/** まだ塗られていないエリアの塗り色（ぬりえの紙の色）。 */
export const UNPAINTED_FILL = '#fffdf7'
