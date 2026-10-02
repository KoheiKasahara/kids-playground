// ドット絵を つくるための ちいさな どうぐばこ。
// 乱数・なめらかな ノイズ・ディザ（ベイヤー行列）・色の へんかん・canvas の よういを まとめる。
// ここは DOM を さわらない 純粋な 計算だけにして、テストや 地形生成から つかえるように する。

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

const smooth = (t: number) => t * t * (3 - 2 * t)

/** 格子点の ハッシュを なめらかに つないだ 0〜1 の バリューノイズ。 */
export function valueNoise(x: number, y: number, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const fx = smooth(x - x0), fy = smooth(y - y0)
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed)
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

/** いくつかの 大きさの ノイズを かさねた もの（0〜1）。 */
export function fbm(x: number, y: number, seed = 0, octaves = 3) {
  let sum = 0, amp = 1, norm = 0, f = 1
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * f, y * f, seed + i * 101) * amp
    norm += amp
    amp *= .5
    f *= 2
  }
  return sum / norm
}

/** 4x4 ベイヤー行列（0〜1 未満）。SFC の ような こまかい あみかけ に つかう。 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16)
export function bayer(x: number, y: number) {
  return BAYER[(y & 3) * 4 + (x & 3)]
}

/**
 * 0〜1 の あかるさを パレットの 番号へ。境目だけ ベイヤーで まぜて、
 * のっぺりした グラデーションではなく ドット絵らしい 段を つくる。
 */
export function rampIndex(t: number, levels: number, x: number, y: number, spread = .5) {
  const v = Math.max(0, Math.min(.9999, t)) * levels + (bayer(x, y) - .5) * spread
  return Math.max(0, Math.min(levels - 1, Math.floor(v)))
}

export type Rgb = readonly [number, number, number]

export function hex(color: string): Rgb {
  const n = parseInt(color.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** ImageData の Uint32 へ そのまま かける 色（リトルエンディアン前提の ABGR）。 */
export function packRgb([r, g, b]: Rgb, a = 255) {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
}

export function pack(color: string, a = 255) {
  return packRgb(hex(color), a)
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export function rgbCss([r, g, b]: Rgb, a = 1) {
  return a >= 1 ? `rgb(${r | 0} ${g | 0} ${b | 0})` : `rgb(${r | 0} ${g | 0} ${b | 0} / ${a})`
}

/** Uint32 の ピクセルから r,g,b を とりだす。 */
export function unpack(p: number): Rgb {
  return [p & 255, (p >>> 8) & 255, (p >>> 16) & 255]
}

/** jsdom など canvas が つかえない 場所では null を かえす。 */
export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, w)
  canvas.height = Math.max(1, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false
  return { canvas, ctx }
}

/** Uint32 の ピクセル配列から canvas を つくる。 */
export function canvasFromPixels(w: number, h: number, pixels: Uint32Array): HTMLCanvasElement | null {
  const made = makeCanvas(w, h)
  if (!made) return null
  const image = made.ctx.createImageData(w, h)
  new Uint32Array(image.data.buffer).set(pixels)
  made.ctx.putImageData(image, 0, 0)
  return made.canvas
}

/** period で くりかえす バリューノイズ（しきつめても つなぎめが でない）。 */
export function periodicNoise(x: number, y: number, period: number, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const fx = smooth(x - x0), fy = smooth(y - y0)
  const m = (v: number) => ((v % period) + period) % period
  const a = hash2(m(x0), m(y0), seed), b = hash2(m(x0 + 1), m(y0), seed)
  const c = hash2(m(x0), m(y0 + 1), seed), d = hash2(m(x0 + 1), m(y0 + 1), seed)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}
