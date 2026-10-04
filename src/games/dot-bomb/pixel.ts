// ドット絵を つくるための ちいさな どうぐばこ（乱数・ディザ・色・canvas・まる・ふちどり）。
// canvas が つかえない ところ（テストなど）では makeCanvas が null を かえすので、絵なしで すすむ。

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

/** ひだりはんぶんを かがみうつしに して ぜんぶの ぎょうに する。 */
export function mirrorRows(half: readonly string[]) {
  return half.map(r => r + [...r].reverse().join(''))
}

export function flipped(src: Img | null): Img | null {
  if (!src) return null
  const made = makeCanvas(src.width, src.height)
  if (!made) return null
  made.ctx.translate(src.width, 0)
  made.ctx.scale(-1, 1)
  made.ctx.drawImage(src, 0, 0)
  return made.canvas
}

/** まわりに 1ドットの ふちどりを つける（とうめいで ない ところの となり）。 */
export function outlined(src: Img | null, color: string, diagonal = false): Img | null {
  if (!src) return null
  const made = makeCanvas(src.width + 2, src.height + 2)
  const sctx = src.getContext('2d')
  if (!made || !sctx) return null
  const data = sctx.getImageData(0, 0, src.width, src.height).data
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < src.width && y < src.height && data[(y * src.width + x) * 4 + 3] > 0
  made.ctx.fillStyle = color
  for (let y = -1; y <= src.height; y++) {
    for (let x = -1; x <= src.width; x++) {
      if (solid(x, y)) continue
      const near = solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)
        || (diagonal && (solid(x - 1, y - 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1) || solid(x + 1, y + 1)))
      if (near) made.ctx.fillRect(x + 1, y + 1, 1, 1)
    }
  }
  made.ctx.drawImage(src, 1, 1)
  return made.canvas
}

/** すべての ドットを 1しょくで ぬった かげ・ひかり用の え。 */
export function silhouette(src: Img | null, color: string): Img | null {
  if (!src) return null
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

/** ドットの まる（ぬりつぶし）。 */
export function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color
  const r2 = r * r
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    let x0 = Infinity, x1 = -Infinity
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + .5 - cx, dy = y + .5 - cy
      if (dx * dx + dy * dy <= r2) { x0 = Math.min(x0, x); x1 = Math.max(x1, x) }
    }
    if (x1 >= x0) ctx.fillRect(x0, y, x1 - x0 + 1, 1)
  }
}

/** ドットの だえん（ぬりつぶし）。 */
export function oval(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
  if (rx <= 0 || ry <= 0) return
  ctx.fillStyle = color
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    let x0 = Infinity, x1 = -Infinity
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry
      if (dx * dx + dy * dy <= 1) { x0 = Math.min(x0, x); x1 = Math.max(x1, x) }
    }
    if (x1 >= x0) ctx.fillRect(x0, y, x1 - x0 + 1, 1)
  }
}

/**
 * 光が ひだりうえから あたった たま。colors は あかるい じゅん。
 * さかいめは ベイヤーで まぜて、むかしの ゲームの ような かげに する。
 */
export function shadedOval(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, colors: readonly string[], light = { x: -.45, y: -.55 }) {
  if (rx <= 0 || ry <= 0) return
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry
      const d2 = dx * dx + dy * dy
      if (d2 > 1) continue
      const dz = Math.sqrt(1 - d2)
      const lit = Math.max(0, (-dx * light.x - dy * light.y + dz * .75) / 1.25)
      const t = 1 - Math.max(0, Math.min(1, lit))
      const v = Math.max(0, Math.min(.9999, t)) * (colors.length - 1) + bayer(x, y) - .5
      const i = Math.max(0, Math.min(colors.length - 1, Math.round(v)))
      ctx.fillStyle = colors[i]
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

/** 1ドットの せん（ブレゼンハム）。 */
export function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) {
  ctx.fillStyle = color
  let x = Math.round(x0), y = Math.round(y0)
  const ex = Math.round(x1), ey = Math.round(y1)
  const dx = Math.abs(ex - x), dy = -Math.abs(ey - y)
  const sx = x < ex ? 1 : -1, sy = y < ey ? 1 : -1
  let err = dx + dy
  for (let i = 0; i < 400; i++) {
    ctx.fillRect(x, y, 1, 1)
    if (x === ex && y === ey) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x += sx }
    if (e2 <= dx) { err += dx; y += sy }
  }
}
