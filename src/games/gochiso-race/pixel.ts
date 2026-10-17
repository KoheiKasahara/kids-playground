// ドット絵を つくるための ちいさな どうぐばこ。
// canvas が つかえない ところ（テストなど）では makeCanvas が null を かえすので、絵なしで すすむ。

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

/** まわりに 1ドットの ふちどりを つけた え（1ドットずつ おおきく なる）。 */
export function outlinedSprite(rows: readonly string[], palette: Palette, line: string): Img | null {
  const grid = new Grid(Math.max(...rows.map(r => r.length)) + 2, rows.length + 2)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]]
      if (color) grid.set(x + 1, y + 1, color)
    }
  })
  grid.outline(line)
  return grid.toCanvas()
}

/** 16しんすうの いろを くらく（マイナスで あかるく）する。 */
export function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.round(Math.max(0, Math.min(255, amount >= 0 ? v * (1 - amount) : v + (255 - v) * -amount)))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('')}`
}

/** いつも おなじに なる 0〜1 の ばらつき。 */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** 4x4 ベイヤー行列（0〜1 未満）。むかしの ゲーム機の ような あみかけに つかう。 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16)
export function bayer(x: number, y: number): number {
  return BAYER[(y & 3) * 4 + (x & 3)]
}

/**
 * ドットを 1つずつ ぬる ための ます目。まる・しかくを ぬって、さいごに ふちどりを つける。
 * ox・oy だけ ずらして かけるので、はみだす みみや しっぽの ぶんの よはくを とれる。
 */
export class Grid {
  readonly w: number
  readonly h: number
  readonly ox: number
  readonly oy: number
  private readonly px: (string | null)[]

  constructor(w: number, h: number, ox = 0, oy = 0) {
    this.w = w
    this.h = h
    this.ox = ox
    this.oy = oy
    this.px = Array<string | null>(w * h).fill(null)
  }

  private index(x: number, y: number): number {
    const gx = Math.floor(x) + this.ox
    const gy = Math.floor(y) + this.oy
    return gx < 0 || gy < 0 || gx >= this.w || gy >= this.h ? -1 : gy * this.w + gx
  }

  get(x: number, y: number): string | null {
    const i = this.index(x, y)
    return i < 0 ? null : this.px[i]
  }

  set(x: number, y: number, color: string | null): void {
    const i = this.index(x, y)
    if (i >= 0) this.px[i] = color
  }

  /** (cx, cy) を まんなかに した だえんの なかを ぬる。only が あれば その いろの ところだけ。 */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string, only?: (current: string | null) => boolean): void {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        if (!inEllipse(x, y, cx, cy, rx, ry)) continue
        if (only && !only(this.get(x, y))) continue
        this.set(x, y, color)
      }
    }
  }

  /** だえんの ふちに 1ドットの せんを ひいてから ぬる（まえに ある ものを くっきり みせる）。 */
  ellipseLined(cx: number, cy: number, rx: number, ry: number, color: string, line: string): void {
    this.ellipse(cx, cy, rx + 1, ry + 1, line, current => current !== null)
    this.ellipse(cx, cy, rx, ry, color)
  }

  /** だえんの みぎしたの ふちに かげを つける。 */
  shadeRim(cx: number, cy: number, rx: number, ry: number, from: string, to: string): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (this.get(x, y) !== from) continue
        if (inEllipse(x, y, cx, cy, rx, ry) && !inEllipse(x, y, cx - 1.2, cy - 1.2, rx, ry)) this.set(x, y, to)
      }
    }
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, color)
  }

  /** さんかくの なかを ぬる。 */
  triangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, color: string): void {
    const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx))
    const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy))
    const side = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2)
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + .5, py = y + .5
        const d1 = side(px, py, ax, ay, bx, by), d2 = side(px, py, bx, by, cx, cy), d3 = side(px, py, cx, cy, ax, ay)
        const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0
        if (!(neg && pos)) this.set(x, y, color)
      }
    }
  }

  /** ならんだ てんを ふとさ r の まるで つなぐ（しっぽ・はな など）。 */
  path(points: readonly (readonly [number, number])[], r: number, color: string, line?: string): void {
    if (line) for (const [x, y] of points) this.ellipse(x, y, r + 1, r + 1, line, current => current !== null)
    for (const [x, y] of points) this.ellipse(x, y, r, r, color)
  }

  /** ぬった ところの まわりに 1ドットの ふちどりを つける。 */
  outline(color: string): void {
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < this.w && y < this.h && this.px[y * this.w + x] !== null
    const edge: number[] = []
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (solid(x, y)) continue
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) edge.push(y * this.w + x)
      }
    }
    for (const i of edge) this.px[i] = color
  }

  toCanvas(): Img | null {
    const made = makeCanvas(this.w, this.h)
    if (!made) return null
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const color = this.px[y * this.w + x]
        if (!color) continue
        made.ctx.fillStyle = color
        made.ctx.fillRect(x, y, 1, 1)
      }
    }
    return made.canvas
  }
}

export function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x + .5 - cx) / rx
  const dy = (y + .5 - cy) / ry
  return dx * dx + dy * dy <= 1
}

/** ドットの まる（ぼかさない）。 */
export function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - y * y) + .25))
    ctx.fillRect(Math.round(cx) - half, Math.round(cy) + y, half * 2 + 1, 1)
  }
}
