import { COLS, ROWS } from './town'

/** ズームごとに、ちずの みじかい へんへ ならぶ マスの かず（さいしょは ちず ぜんぶが みえる）。 */
const ZOOM_SPANS = [COLS, 9, 6, 4] as const
export const ZOOM_LEVELS = ZOOM_SPANS.length
/** さいしょの ズームで めざす 1マスの おおきさ（px）。ゆびで おしやすく、まわりも みえる おおきさ。 */
const COMFORT_TILE = 64

/** みえる わくの おおきさと ズームから、1マスの おおきさ（px）を きめる。 */
export function tileSizeFor(width: number, height: number, zoom: number): number {
  if (zoom <= 0) return Math.max(16, Math.floor(Math.min(width / COLS, height / ROWS)))
  const span = ZOOM_SPANS[Math.min(zoom, ZOOM_LEVELS - 1)]
  return Math.min(150, Math.max(28, Math.floor(Math.min(width, height) / span)))
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
