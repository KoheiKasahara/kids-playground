// ドット絵を つくるための ちいさな どうぐばこ（乱数・ハッシュ・ディザ・色・canvas）。
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

/** もじれつから きまる 32bit の かず（FNV-1a）。おなじ ことばなら いつも おなじ。 */
export function hashText(text: string) {
  let h = 0x811c9dc5
  for (const ch of text) {
    h ^= ch.codePointAt(0) ?? 0
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
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
export type Palette = Record<string, string>

/** jsdom など canvas が つかえない 場所では null。 */
export function makeCanvas(w: number, h: number): { canvas: Img; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(w))
  canvas.height = Math.max(1, Math.ceil(h))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false
  return { canvas, ctx }
}

/** 1もじ＝1ドットの え（'.' は とうめい）を canvas に する。 */
export function spriteCanvas(rows: readonly string[], palette: Palette, flip = false): Img | null {
  const h = rows.length
  const w = Math.max(...rows.map(r => r.length))
  const made = makeCanvas(w, h)
  if (!made) return null
  const { ctx } = made
  for (let y = 0; y < h; y++) {
    const row = rows[y]
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(flip ? w - 1 - x : x, y, 1, 1)
    }
  }
  return made.canvas
}

/** まわりに 1ドットの ふちどりを つける（とうめいで ない ところの となり）。 */
export function outlined(src: Img, color: string): Img | null {
  const made = makeCanvas(src.width + 2, src.height + 2)
  const sctx = src.getContext('2d')
  if (!made || !sctx) return null
  const data = sctx.getImageData(0, 0, src.width, src.height).data
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < src.width && y < src.height && data[(y * src.width + x) * 4 + 3] > 0
  made.ctx.fillStyle = color
  for (let y = -1; y <= src.height; y++) {
    for (let x = -1; x <= src.width; x++) {
      if (solid(x, y)) continue
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) made.ctx.fillRect(x + 1, y + 1, 1, 1)
    }
  }
  made.ctx.drawImage(src, 1, 1)
  return made.canvas
}

/** 白く ひかった え（ダメージの ちかちか）。 */
export function flashed(src: Img, color = '#ffffff'): Img | null {
  const made = makeCanvas(src.width, src.height)
  if (!made) return null
  made.ctx.drawImage(src, 0, 0)
  made.ctx.globalCompositeOperation = 'source-in'
  made.ctx.fillStyle = color
  made.ctx.fillRect(0, 0, src.width, src.height)
  return made.canvas
}

export function hexRgb(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function mixHex(a: string, b: string, t: number) {
  const [ar, ag, ab] = hexRgb(a), [br, bg, bb] = hexRgb(b)
  const f = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${f(ar, br)}${f(ag, bg)}${f(ab, bb)}`
}
