// パーツ（だえん・カプセル・ひれ・はこ・つぼ など）を かさねて、
// ひだりうえからの ひかりで かげを つけた ドット絵に「やきつける」 ちいさな エンジン。
// SFC / PS の ドット絵の ように、
//   - 1パーツ 5だんの ランプ色 ＋ ベイヤーの あみかけで まるみを だす
//   - そとがわの ふちどりは まっくろではなく、となりの 色の いちばん こい 色（セルアウト）
//   - かさなった パーツの さかいめには うすい かげの 線
// を じどうで つける。

import { bayer, fbm, hex, mix, packRgb, rampIndex, type Rgb } from './pixel'

/** こい → あかるい の 5色。 */
export type Ramp = readonly [string, string, string, string, string]

export type Sample = {
  /** ひょうめんの むき（x みぎ・y した・z てまえ）。 */
  nx: number; ny: number; nz: number
  /** パーツの なかでの いち（だえん: -1〜1、カプセル: u じく方向 0〜1・v よこ -1〜1、はこ: 0〜1）。 */
  u: number; v: number
  /** スプライトの なかの ピクセル。 */
  px: number; py: number
}

export type Pat = { ramp?: Ramp; shift?: number; alpha?: number; flat?: number; skip?: boolean } | undefined

type Base = {
  ramp: Ramp
  /** とうめい度（ひれ・クラゲ）。 */
  alpha?: number
  /** うえに かさなった とき、したの パーツに かげ線を おとす。 */
  edge?: boolean
  /** かげを つけず この あかるさ（0〜1）で ぬる。 */
  flat?: number
  /** つやの つよさ。 */
  gloss?: number
  /** あかるさの ずらし。 */
  shift?: number
  /** もようなど。 */
  pat?: (s: Sample) => Pat
}

export type Prim =
  | (Base & { t: 'ell'; x: number; y: number; rx: number; ry: number; rot?: number })
  | (Base & { t: 'cap'; x1: number; y1: number; x2: number; y2: number; r1: number; r2: number })
  | (Base & { t: 'poly'; pts: readonly (readonly [number, number])[] })
  | (Base & { t: 'rect'; x: number; y: number; w: number; h: number; bevel?: number })
  | (Base & { t: 'blob'; x: number; y: number; rx: number; ry: number; seed: number; rough: number; flatBottom?: boolean })
  | (Base & { t: 'lathe'; x: number; y0: number; y1: number; r: (v: number) => number })
  | { t: 'eye'; x: number; y: number; r: number; iris?: string; dark?: string }
  | { t: 'px'; x: number; y: number; color: string; alpha?: number }

/** ひかりの むき（ひだり うえ てまえ から）。 */
const L = (() => { const v = [-.45, -.68, .58]; const n = Math.hypot(v[0], v[1], v[2]); return v.map(c => c / n) as [number, number, number] })()
/** はんしゃの ための ハーフベクトル（しせんは てまえ）。 */
const HV = (() => { const v = [L[0], L[1], L[2] + 1]; const n = Math.hypot(v[0], v[1], v[2]); return v.map(c => c / n) as [number, number, number] })()

function pointInPoly(x: number, y: number, pts: readonly (readonly [number, number])[]) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** その ピクセルが パーツの なかなら、むきと いちを かえす。 */
export function hit(p: Prim, px: number, py: number): Sample | null {
  switch (p.t) {
    case 'ell': {
      let dx = px - p.x, dy = py - p.y
      if (p.rot) { const c = Math.cos(-p.rot), s = Math.sin(-p.rot); [dx, dy] = [dx * c - dy * s, dx * s + dy * c] }
      const u = dx / p.rx, v = dy / p.ry
      const d = u * u + v * v
      if (d > 1) return null
      let nx = u, ny = v
      if (p.rot) { const c = Math.cos(p.rot), s = Math.sin(p.rot); [nx, ny] = [u * c - v * s, u * s + v * c] }
      return { nx, ny, nz: Math.sqrt(Math.max(0, 1 - d)), u, v, px, py }
    }
    case 'cap': {
      const ax = p.x2 - p.x1, ay = p.y2 - p.y1
      const len2 = ax * ax + ay * ay || 1
      let t = ((px - p.x1) * ax + (py - p.y1) * ay) / len2
      t = Math.max(0, Math.min(1, t))
      const cx = p.x1 + ax * t, cy = p.y1 + ay * t
      const r = p.r1 + (p.r2 - p.r1) * t
      const dx = px - cx, dy = py - cy
      const d = Math.hypot(dx, dy)
      if (d > r) return null
      const k = d / (r || 1)
      const nz = Math.sqrt(Math.max(0, 1 - k * k))
      const len = Math.sqrt(len2)
      const side = (dx * -ay + dy * ax) / len / (r || 1)
      return { nx: dx / (r || 1), ny: dy / (r || 1), nz, u: t, v: side, px, py }
    }
    case 'poly': {
      if (!pointInPoly(px, py, p.pts)) return null
      return { nx: 0, ny: 0, nz: 1, u: 0, v: 0, px, py }
    }
    case 'rect': {
      const u = (px - p.x) / p.w, v = (py - p.y) / p.h
      if (u < 0 || u > 1 || v < 0 || v > 1) return null
      const b = p.bevel ?? 1.5
      const l = px - p.x, r = p.x + p.w - px, t = py - p.y, bo = p.y + p.h - py
      let nx = 0, ny = 0
      if (l < b) nx = -1; else if (r < b) nx = 1
      if (t < b) ny = -1; else if (bo < b) ny = 1
      const n = Math.hypot(nx, ny, 1.2)
      return { nx: nx / n, ny: ny / n, nz: 1.2 / n, u, v, px, py }
    }
    case 'blob': {
      const dx = (px - p.x) / p.rx, dy = (py - p.y) / p.ry
      if (p.flatBottom && dy > .55) return null
      const ang = Math.atan2(dy, dx)
      const wob = 1 + (fbm(Math.cos(ang) * 1.6 + 3, Math.sin(ang) * 1.6 + 3, p.seed, 3) - .5) * p.rough
      const d = Math.hypot(dx, dy) / wob
      if (d > 1) return null
      // でこぼこの むき: ノイズの かたむきを すこし まぜる。
      const e = .35
      const n0 = fbm(px * .35, py * .35, p.seed + 7, 2)
      const gx = fbm(px * .35 + e, py * .35, p.seed + 7, 2) - n0
      const gy = fbm(px * .35, py * .35 + e, p.seed + 7, 2) - n0
      const nz = Math.sqrt(Math.max(0, 1 - d * d))
      const nx = dx / wob * .9 - gx * 3, ny = dy / wob * .9 - gy * 3
      const n = Math.hypot(nx, ny, nz) || 1
      return { nx: nx / n, ny: ny / n, nz: nz / n, u: dx, v: dy, px, py }
    }
    case 'lathe': {
      if (py < p.y0 || py > p.y1) return null
      const v = (py - p.y0) / (p.y1 - p.y0)
      const r = p.r(v)
      const dx = (px - p.x) / r
      if (!(r > 0) || Math.abs(dx) > 1) return null
      // たての かたむき（ふくらみ）も すこし いれる。
      const dv = .02
      const slope = (p.r(Math.min(1, v + dv)) - p.r(Math.max(0, v - dv))) / (2 * dv * (p.y1 - p.y0))
      const nz = Math.sqrt(Math.max(0, 1 - dx * dx))
      const ny = -slope * nz
      const n = Math.hypot(dx, ny, nz) || 1
      return { nx: dx / n, ny: ny / n, nz: nz / n, u: dx, v, px, py }
    }
    default:
      return null
  }
}

function shade(p: Exclude<Prim, { t: 'eye' } | { t: 'px' }>, s: Sample, pat: Pat) {
  const flat = pat?.flat ?? p.flat
  if (flat !== undefined) return flat + (p.shift ?? 0) + (pat?.shift ?? 0)
  const diffuse = Math.max(0, s.nx * L[0] + s.ny * L[1] + s.nz * L[2])
  const spec = Math.pow(Math.max(0, s.nx * HV[0] + s.ny * HV[1] + s.nz * HV[2]), 18) * (p.gloss ?? 0)
  // したからの はねかえりの ひかり（みずの なかの あかるさ）。
  const bounce = Math.max(0, s.ny) * .12
  return .16 + diffuse * .8 + spec + bounce + (p.shift ?? 0) + (pat?.shift ?? 0)
}

export type BakeOptions = {
  /** そとの ふちどり。'self' は となりの 色の いちばん こい 色。 */
  outline?: 'self' | 'none' | string
  /** ふちどりの とうめい度。 */
  outlineAlpha?: number
}

const rgbCache = new Map<string, Rgb>()
function rgbOf(c: string) {
  let v = rgbCache.get(c)
  if (!v) { v = hex(c); rgbCache.set(c, v) }
  return v
}

/**
 * パーツの ならびを w×h の ピクセルに やきつける。
 * かえりは ABGR の Uint32（canvasFromPixels で そのまま え に なる）。
 */
export function bake(prims: readonly Prim[], w: number, h: number, opts: BakeOptions = {}): Uint32Array {
  const n = w * h
  const out = new Uint32Array(n)
  const owner = new Int16Array(n).fill(-1)
  const level = new Int8Array(n)
  const ramps: (Ramp | null)[] = new Array(n).fill(null)
  const alphas = new Float32Array(n)
  const shapes = prims.map((p, i) => ({ p, i })).filter(e => e.p.t !== 'eye' && e.p.t !== 'px') as { p: Exclude<Prim, { t: 'eye' } | { t: 'px' }>; i: number }[]

  const sampleAt = (x: number, y: number, from: number) => {
    for (let k = from; k >= 0; k--) {
      const { p, i } = shapes[k]
      const s = hit(p, x + .5, y + .5)
      if (!s) continue
      const pat = p.pat?.(s)
      if (pat?.skip) continue
      const ramp = pat?.ramp ?? p.ramp
      const b = shade(p, s, pat)
      const li = rampIndex(b, 5, x, y, .6)
      return { k, i, ramp, li, alpha: pat?.alpha ?? p.alpha ?? 1 }
    }
    return null
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const top = sampleAt(x, y, shapes.length - 1)
      if (!top) continue
      const o = y * w + x
      let color = rgbOf(top.ramp[top.li])
      let alpha = top.alpha
      if (alpha < 1) {
        // すけている ところは したの パーツと まぜる。
        const under = sampleAt(x, y, top.k - 1)
        if (under) {
          color = mix(rgbOf(under.ramp[under.li]), color, alpha)
          alpha = Math.max(alpha, under.alpha)
        }
      }
      owner[o] = top.i
      level[o] = top.li
      ramps[o] = top.ramp
      alphas[o] = alpha
      out[o] = packRgb(color, Math.round(alpha * 255))
    }
  }

  // かさなりの かげ線: うえの パーツ（edge）の まわりの、したの パーツを すこし くらく。
  const shadowed = new Uint8Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = y * w + x
      const a = owner[o]
      if (a < 0) continue
      const pa = prims[a] as Base & { t: string }
      if (!pa.edge) continue
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const q = ny * w + nx
        const b = owner[q]
        if (b < 0 || b >= a || shadowed[q]) continue
        const ramp = ramps[q]
        if (!ramp) continue
        shadowed[q] = 1
        const li = Math.max(0, level[q] - 2)
        out[q] = packRgb(rgbOf(ramp[li]), Math.round(alphas[q] * 255))
      }
    }
  }

  // め と 1ドット。
  for (const p of prims) {
    if (p.t === 'px') {
      const x = Math.floor(p.x), y = Math.floor(p.y)
      if (x < 0 || y < 0 || x >= w || y >= h) continue
      out[y * w + x] = packRgb(rgbOf(p.color), Math.round((p.alpha ?? 1) * 255))
      owner[y * w + x] = owner[y * w + x] < 0 ? 0 : owner[y * w + x]
      continue
    }
    if (p.t !== 'eye') continue
    const r = p.r
    for (let y = Math.floor(p.y - r - 1); y <= Math.ceil(p.y + r + 1); y++) {
      for (let x = Math.floor(p.x - r - 1); x <= Math.ceil(p.x + r + 1); x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue
        const d = Math.hypot(x + .5 - p.x, y + .5 - p.y)
        const o = y * w + x
        if (d <= r) out[o] = packRgb(rgbOf(p.dark ?? '#10081a'))
        else if (p.iris && d <= r + .9) out[o] = packRgb(rgbOf(p.iris))
        else continue
        if (owner[o] < 0) owner[o] = 0
      }
    }
    // ひかりの てん。
    const hx = Math.floor(p.x - r * .45), hy = Math.floor(p.y - r * .45)
    if (hx >= 0 && hy >= 0 && hx < w && hy < h) out[hy * w + hx] = packRgb([255, 255, 255])
  }

  // そとの ふちどり。
  const outline = opts.outline ?? 'self'
  if (outline !== 'none') {
    const oa = Math.round((opts.outlineAlpha ?? 1) * 255)
    const fixed = outline === 'self' ? null : rgbOf(outline)
    const add: [number, number][] = []
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = y * w + x
        if (owner[o] >= 0) continue
        let best = -1, lit = false
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const q = ny * w + nx
          if (owner[q] < 0 || (out[q] >>> 24) < 90) continue
          best = q
          // みぎ か した に ほんたいが ある → ひかりの あたる がわの ふち。
          lit = dx > 0 || dy > 0
          break
        }
        if (best >= 0) add.push([o, best * 2 + (lit ? 1 : 0)])
      }
    }
    for (const [o, code] of add) {
      const q = code >> 1, lit = (code & 1) === 1
      const ramp = ramps[q]
      const c = fixed ?? (ramp ? mix(rgbOf(ramp[0]), [8, 6, 20], lit ? 0 : .35) : [16, 8, 26] as Rgb)
      out[o] = packRgb(c, Math.min(oa, Math.round(Math.max(.55, alphas[q] || 1) * 255)))
    }
  }
  return out
}

/** とおくの ものは みずの 色に すこし とける（くうきえんきん）。 */
export function fade(pixels: Uint32Array, water: string, t: number): Uint32Array {
  const w = rgbOf(water)
  const out = new Uint32Array(pixels.length)
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i]
    const a = p >>> 24
    if (!a) continue
    const c = mix([p & 255, (p >>> 8) & 255, (p >>> 16) & 255], w, t)
    out[i] = packRgb(c, a)
  }
  return out
}

/** よこに はんてん。 */
export function flipX(pixels: Uint32Array, w: number, h: number): Uint32Array {
  const out = new Uint32Array(pixels.length)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = pixels[y * w + (w - 1 - x)]
  return out
}

/** たての しまもよう などに つかう、なめらかな 0〜1 の ステップ。 */
export function band(x: number, from: number, to: number) {
  return x >= from && x <= to
}

/** ベイヤーで まだらに えらぶ（とくいな あみかけ）。 */
export function dither(px: number, py: number, t: number) {
  return bayer(Math.floor(px), Math.floor(py)) < t
}
