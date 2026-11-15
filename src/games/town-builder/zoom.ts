import { COLS, ROWS } from './town'

/** ズームごとに、みえる わくの みじかい へんへ ならぶ マスの かず。ちず ぜんぶは「ちず」で みる。 */
const ZOOM_SPANS = [20, 14, 9, 6, 4] as const
export const ZOOM_LEVELS = ZOOM_SPANS.length
/** さいしょの ズームで めざす 1マスの おおきさ（px）。ゆびで おしやすく、まわりも みえる おおきさ。 */
const COMFORT_TILE = 64
/** みえる わくの そとに よぶんに えがく マスの かず（スクロールの とちゅうで すきまを みせない）。 */
const MARGIN = 2

/** みえる わくの おおきさと ズームから、1マスの おおきさ（px）を きめる。 */
export function tileSizeFor(width: number, height: number, zoom: number): number {
  const span = ZOOM_SPANS[Math.max(0, Math.min(zoom, ZOOM_LEVELS - 1))]
  return Math.min(150, Math.max(24, Math.floor(Math.min(width, height) / span)))
}

/** がめんの おおきさに あわせた さいしょの ズーム（スマホでも タブレットでも マスが おおきく みえる）。 */
export function comfortableZoom(width: number, height: number): number {
  let best = 1
  for (let zoom = 1; zoom < ZOOM_LEVELS; zoom += 1) {
    const distance = Math.abs(tileSizeFor(width, height, zoom) - COMFORT_TILE)
    if (distance < Math.abs(tileSizeFor(width, height, best) - COMFORT_TILE)) best = zoom
  }
  return best
}

/** みて いる ばしょ。ちず ぜんたいを 0〜1 と した ときの、わくの まんなか。 */
export type ViewCenter = { readonly x: number; readonly y: number }
/** えがく マスの はんい（りょうはしを ふくむ）。 */
export type TileRange = { readonly col0: number; readonly col1: number; readonly row0: number; readonly row1: number }

function span(center: number, view: number, tile: number, count: number): [number, number] {
  const total = count * tile
  if (total <= view) return [0, count - 1]
  const start = Math.max(0, Math.min(total - view, center * total - view / 2))
  return [Math.max(0, Math.floor(start / tile) - MARGIN), Math.min(count - 1, Math.floor((start + view) / tile) + MARGIN)]
}

/** ひろい ちずでも かるく うごくよう、みえて いる マスと その まわり だけを えがく。 */
export function visibleRange(center: ViewCenter, width: number, height: number, tile: number): TileRange {
  const [col0, col1] = span(center.x, width, tile, COLS)
  const [row0, row1] = span(center.y, height, tile, ROWS)
  return { col0, col1, row0, row1 }
}

/** マスの まんなかを みる ための ばしょ。 */
export function centerOfTile(index: number): ViewCenter {
  return { x: ((index % COLS) + 0.5) / COLS, y: (Math.floor(index / COLS) + 0.5) / ROWS }
}

/** みて いる ばしょの まんなかの マス。 */
export function tileAtCenter(center: ViewCenter): number {
  const col = Math.max(0, Math.min(COLS - 1, Math.floor(center.x * COLS)))
  const row = Math.max(0, Math.min(ROWS - 1, Math.floor(center.y * ROWS)))
  return row * COLS + col
}
