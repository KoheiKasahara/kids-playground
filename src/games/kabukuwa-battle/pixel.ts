// ドット絵を つくるための ちいさな どうぐばこ（乱数・ディザ・色・canvas）。
// canvas が つかえない ところ（テストなど）では makeCanvas が null を かえすので、絵なしで すすむ。

/** 32bit の 種から いつも 同じ ならびを だす 乱数（mulberry32）。 */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 座標から きまる 0〜1 の ハッシュ。 */
export function hash2(x: number, y: number, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** 4x4 ベイヤー行列（0〜1 未満）。レトロゲームの ような あみかけに つかう。 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16)
export function bayer(x: number, y: number) {
  return BAYER[(y & 3) * 4 + (x & 3)]
}

/** 0〜1 の あたいを だんかいの ばんごうへ。さかいめだけ ベイヤーで まぜる。 */
export function ditherIndex(t: number, levels: number, x: number, y: number) {
  const v = Math.max(0, Math.min(.9999, t)) * (levels - 1) + bayer(x, y) - .5
  return Math.max(0, Math.min(levels - 1, Math.round(v)))
}

export type Img = HTMLCanvasElement

/** jsdom など canvas が つかえない 場所では null。 */
export function makeCanvas(w: number, h: number): { canvas: Img; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(w))
  canvas.height = Math.max(1, Math.ceil(h))
  let ctx: CanvasRenderingContext2D | null
  try { ctx = canvas.getContext('2d') } catch { return null }
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false
  return { canvas, ctx }
}

export type Rgb = readonly [number, number, number]

export function hex(color: string): Rgb {
  const n = parseInt(color.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function mixHex(a: string, b: string, t: number) {
  const [ar, ag, ab] = hex(a), [br, bg, bb] = hex(b)
  const f = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${f(ar, br)}${f(ag, bg)}${f(ab, bb)}`
}

/** RGBA を 1つの 32bit（ImageData の Uint32 ならび、リトルエンディアン）に する。 */
export function packRgb(c: Rgb, alpha = 255) {
  return ((alpha << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0
}
