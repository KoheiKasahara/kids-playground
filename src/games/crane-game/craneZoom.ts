/** ズームの上限。2.4倍まで寄るとケースの中の景品が画面いっぱいになる。 */
export const MAX_ZOOM = 2.4

/** 寄り具合を 1（ぜんたい）〜 MAX_ZOOM に収める。 */
export function clampZoom(value: number): number {
  return Number.isFinite(value) ? Math.min(MAX_ZOOM, Math.max(1, value)) : 1
}
