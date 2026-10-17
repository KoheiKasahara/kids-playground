// ドット絵を かくための ちいさな どうぐばこ。
// ここは DOM を さわらない 計算だけにして、テストからも すべての くみあわせを かいて たしかめられるように する。
// 色は ImageData の Uint32 へ そのまま かける ABGR（リトルエンディアン前提）で もつ。

/** こい → あかるい の 5だんの 色。 */
export type Ramp = readonly [string, string, string, string, string]

export function hex(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgb(r: number, g: number, b: number, a = 255): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return ((c(a) << 24) | (c(b) << 16) | (c(g) << 8) | c(r)) >>> 0
}

export function pack(color: string, a = 255): number {
  const [r, g, b] = hex(color)
  return rgb(r, g, b, a)
}

export function unpack(p: number): [number, number, number, number] {
  return [p & 255, (p >>> 8) & 255, (p >>> 16) & 255, p >>> 24]
}

/** 2つの 色を まぜる（t=0 で a、t=1 で b）。 */
export function mixPacked(a: number, b: number, t: number): number {
  const [ar, ag, ab, aa] = unpack(a)
  const [br, bg, bb, ba] = unpack(b)
  return rgb(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t, aa + (ba - aa) * t)
}

const OUTLINE_TINT = pack('#2a1626')

/** ふちどり用に、となりの 色を こく して すこし むらさきへ よせる（セルアウト）。 */
export function outlineOf(p: number, strength = .62): number {
  const [r, g, b] = unpack(p)
  const [tr, tg, tb] = unpack(OUTLINE_TINT)
  const k = 1 - strength
  return rgb(r * k + tr * strength * .9, g * k + tg * strength * .9, b * k + tb * strength * .9)
}

/** 4x4 ベイヤー行列（0〜1 未満）。グラデーションの さかいめを あみかけに する。 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16)
export function bayer(x: number, y: number): number {
  return BAYER[(y & 3) * 4 + (x & 3)]
}

/** 0〜1 の あかるさを 0〜4 の だんへ。さかいめだけ ベイヤーで まぜる。 */
export function level(light: number, x: number, y: number, spread = .55): number {
  const v = Math.max(0, Math.min(.9999, light)) * 5 + (bayer(x, y) - .5) * spread
  return Math.max(0, Math.min(4, Math.floor(v)))
}

/** 座標から きまる 0〜1 の ハッシュ。 */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** 32bit の 種から いつも 同じ ならびを だす 乱数（mulberry32）。 */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** パレットを もった 5だんの 色を 1かいだけ packed に する。 */
export function packRamp(ramp: Ramp): readonly number[] {
  return ramp.map(c => pack(c))
}

/** 0 を とうめいと して あつかう ピクセルの いれもの。 */
export class PixelBuffer {
  readonly w: number
  readonly h: number
  readonly data: Uint32Array

  constructor(w: number, h: number) {
    this.w = Math.max(1, Math.floor(w))
    this.h = Math.max(1, Math.floor(h))
    this.data = new Uint32Array(this.w * this.h)
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h
  }

  get(x: number, y: number): number {
    return this.inside(x, y) ? this.data[y * this.w + x] : 0
  }

  set(x: number, y: number, color: number): void {
    x = Math.floor(x)
    y = Math.floor(y)
    if (this.inside(x, y)) this.data[y * this.w + x] = color
  }

  /** うすい 色を かさねる（かげ・ひかり）。とうめいな ところには ぬらない。 */
  tint(x: number, y: number, color: number, amount: number): void {
    x = Math.floor(x)
    y = Math.floor(y)
    if (!this.inside(x, y)) return
    const i = y * this.w + x
    const base = this.data[i]
    if (!base) return
    this.data[i] = mixPacked(base, color, amount) | 0xff000000
  }

  /** だえんの なかに うすい 色を かさねる（かげ・ほっぺ）。 */
  tintEllipse(cx: number, cy: number, rx: number, ry: number, color: number, amount: number): void {
    this.ellipse(cx, cy, rx, ry, (_nx, _ny, x, y) => {
      this.tint(x, y, color, amount)
      return 0
    })
  }

  /** しかくの なかに うすい 色を かさねる。 */
  tintRect(x0: number, y0: number, x1: number, y1: number, color: number, amount: number): void {
    for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) this.tint(x, y, color, amount)
  }

  rect(x: number, y: number, w: number, h: number, color: number): void {
    for (let yy = Math.floor(y); yy < y + h; yy++) for (let xx = Math.floor(x); xx < x + w; xx++) this.set(xx, yy, color)
  }

  /** だえんの なかを 1ピクセルずつ しらべて ぬる。fn が 0 を かえしたら ぬらない。 */
  ellipse(cx: number, cy: number, rx: number, ry: number, fn: (nx: number, ny: number, x: number, y: number) => number): void {
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx)
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + .5 - cx) / rx, ny = (y + .5 - cy) / ry
        if (nx * nx + ny * ny > 1) continue
        const c = fn(nx, ny, x, y)
        if (c) this.set(x, y, c)
      }
    }
  }

  /** はんい内で inside() が true の ところを fn の 色で ぬる。 */
  fill(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => number): void {
    for (let y = Math.floor(y0); y <= y1; y++) {
      for (let x = Math.floor(x0); x <= x1; x++) {
        const c = fn(x, y)
        if (c) this.set(x, y, c)
      }
    }
  }

  /** 1ピクセルの 線（ブレゼンハム）。 */
  line(x0: number, y0: number, x1: number, y1: number, color: number | ((x: number, y: number, t: number) => number)): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    const n = Math.max(dx, -dy) || 1
    let err = dx + dy, x = x0, y = y0, i = 0
    for (;;) {
      const c = typeof color === 'number' ? color : color(x, y, i / n)
      if (c) this.set(x, y, c)
      if (x === x1 && y === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x += sx }
      if (e2 <= dx) { err += dx; y += sy }
      i++
    }
  }

  /** ほかの バッファを とうめい以外 かさねる。 */
  draw(src: PixelBuffer, dx: number, dy: number, mask?: (x: number, y: number) => boolean): void {
    dx = Math.round(dx)
    dy = Math.round(dy)
    for (let y = 0; y < src.h; y++) {
      const ty = y + dy
      if (ty < 0 || ty >= this.h) continue
      for (let x = 0; x < src.w; x++) {
        const c = src.data[y * src.w + x]
        if (!c) continue
        if (mask && !mask(x, y)) continue
        const tx = x + dx
        if (tx < 0 || tx >= this.w) continue
        this.data[ty * this.w + tx] = c
      }
    }
  }

  /** そとがわの 1ピクセルに、となりの 色を こくした ふちを つける。 */
  outline(strength = .62): void {
    const out = new Uint32Array(this.data)
    const { w, h, data } = this
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[y * w + x]) continue
        const n = (x > 0 && data[y * w + x - 1]) || (x < w - 1 && data[y * w + x + 1])
          || (y > 0 && data[(y - 1) * w + x]) || (y < h - 1 && data[(y + 1) * w + x])
        if (n) out[y * w + x] = outlineOf(n, strength)
      }
    }
    this.data.set(out)
  }

  /** ぬってある ピクセルの かず。 */
  count(): number {
    let n = 0
    for (const c of this.data) if (c) n++
    return n
  }

  /** ぬってある はんい（なければ null）。 */
  bounds(): { x0: number; y0: number; x1: number; y1: number } | null {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!this.data[y * this.w + x]) continue
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 }
  }
}

/**
 * もじの え（1もじ＝1ピクセル）から バッファを つくる。'.' と ' ' は とうめい。
 * 手で うったほうが きれいな ちいさな ものは、これで かく。
 */
export function fromArt(rows: readonly string[], palette: Readonly<Record<string, string>>): PixelBuffer {
  const w = Math.max(...rows.map(r => r.length))
  const buf = new PixelBuffer(w, rows.length)
  const packed: Record<string, number> = {}
  for (const [k, v] of Object.entries(palette)) packed[k] = pack(v)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.' || ch === ' ') continue
      const c = packed[ch]
      if (c === undefined) throw new Error(`palette に ない もじ: ${ch}`)
      buf.set(x, y, c)
    }
  })
  return buf
}

/** よこに うらがえす。 */
export function flipX(src: PixelBuffer): PixelBuffer {
  const out = new PixelBuffer(src.w, src.h)
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) out.data[y * src.w + (src.w - 1 - x)] = src.data[y * src.w + x]
  return out
}
