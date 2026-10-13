// いきものの ドット絵を、だえんたい（たまご形）を くみあわせた 立体から やきつける。
// スーパーファミコン後期の 絵に ちかづける ための しあげ:
// ・パレットは かげを あお むらさきへ、ひかりを きいろへ ずらした 8だん（色相シフト）。
// ・あみかけ（ディザ）は つかわず、だんの さかいめの はぐれドットを そうじして かたまりで ぬる。
// ・ひかりの ほうから レイを とばして、てまえの 部品が おとす かげを つける。
// ・ふちどりは まっくろに せず、となりの いろの いちばん くらい いろ（あかるい がわは すこし うすく）。
// ・はねは すけて みえる ガラス、こうかの 線や つぶは さいごに うえから かく。
//
// ざひょうは x が みぎ、y が した、z が てまえ。もけいは 64×48 の ます目で くみたて、
// やきつける ときに scale ばいの こまかさ（DETAIL なら 128×96 ドット）で しらべる。

/** もけいの ます目の おおきさ。 */
export const SPRITE_W = 64
export const SPRITE_H = 48
/** ふつうの こまかさ（1ます を なんドットに するか）。 */
export const DETAIL = 2

/**
 * A/B/C は いきものごとの いろ。
 * E め、W ひかり、T した、M くちの なか、K くろい くちの なか、F きば・ほね、
 * P えだ、G ひかる あお、S いと・すな。
 */
export type Mat = 'A' | 'B' | 'C' | 'E' | 'W' | 'T' | 'M' | 'K' | 'F' | 'P' | 'G' | 'S'

/**
 * もようを きめる ための ばしょ。くだ では l が ながさ方向の きょり（ます）、s が よこ（-1〜1、+ が おなか がわ）。
 * fine は こまかく かく とき（うろこの すじ など、こまかい もようを たす）。
 */
export type Ctx = { t: number; l: number; s: number; u: number; v: number; w: number; fine: boolean }
/** いろの しゅるい。うしろに - を つけると 1だん くらく（うろこの すじ など）。 */
export type Paint = Mat | `${Mat}-` | null
export type Pattern = (c: Ctx) => Paint

type Prim = {
  x: number; y: number; z: number
  rx: number; ry: number; rz: number
  ca: number; sa: number
  mat: Mat
  gloss: number
  pat?: Pattern
  t: number; l: number; dx: number; dy: number
  /** おなじ 部品なら うちがわの 線を ひかない。 */
  part: number
  /** 0 より おおきいと すけて みえる（はね）。 */
  glass: number
  /** ひかりに かんけいなく あかるい。 */
  glow: boolean
}

export type Opt = { z?: number; rz?: number; a?: number; mat?: Mat; gloss?: number; pat?: Pattern; glass?: number; glow?: boolean }
export type Num = number | ((t: number) => number)
export type Pt = readonly [number, number]
export type P3 = readonly [number, number, number]

const val = (n: Num, t: number) => typeof n === 'number' ? n : n(t)

export const frac = (v: number) => v - Math.floor(v)
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** 0→1 を なめらかに。 */
export const ease = (t: number) => { const k = clamp(t); return k * k * (3 - 2 * k) }
/** t が a〜b の あいだで 0→1→0 と ふくらむ。 */
export const bump = (t: number, a: number, b: number) => t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI)
export const TAU = Math.PI * 2

export function hash(x: number, y: number, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** なめらかな ゆらぎ（0〜1）。 */
export function noise(x: number, y: number, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

/** とおる 点を なめらかに つなぐ（カトマル・ロム）。 */
export function spline(points: readonly Pt[], t: number): Pt {
  const n = points.length - 1
  if (n <= 0) return points[0]
  const f = clamp(t, 0, .99999) * n
  const i = Math.floor(f), u = f - i
  const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[Math.min(n, i + 1)], p3 = points[Math.min(n, i + 2)]
  const k = (a: number, b: number, c: number, d: number) =>
    .5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u)
  return [k(p0[0], p1[0], p2[0], p3[0]), k(p0[1], p1[1], p2[1], p3[1])]
}

// ---------------- いろ ----------------

export type Rgb = [number, number, number]

export function hexRgb(color: string): Rgb {
  const n = parseInt(color.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function mixRgb(a: readonly number[], b: readonly number[], t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function rgbHsv([r, g, b]: readonly number[]): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (!d) return [0, 0, max]
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, d / max, max]
}
function hsvRgb(h: number, s: number, v: number): Rgb {
  const f = (n: number) => { const k = (n + h / 60) % 6; return 255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) }
  return [f(5), f(3), f(1)]
}
/** h を target の ほうへ、さいだい deg ど ずらす。 */
function towards(h: number, target: number, deg: number) {
  const d = ((target - h + 540) % 360) - 180
  return (h + Math.sign(d) * Math.min(Math.abs(d), deg) + 360) % 360
}

/** 1つの いろから 8だんの パレットを つくる（0 くらい → 6 あかるい、7 は つやの ひかり）。かげは あお むらさき、ひかりは きいろへ ずらす。 */
export function makeRamp(base: string): Rgb[] {
  const [h, s, v] = rgbHsv(hexRgb(base))
  // いろみの ない いろは、かげだけ すこし あおく する。
  const hue = s < .06 ? 235 : h
  const dark = (k: number, amt: number, hueDeg: number) => hsvRgb(towards(hue, 250, hueDeg), clamp(s * (1 + .08 * k) + .035 * k), v * amt)
  const light = (amt: number, hueDeg: number, sat: number) => hsvRgb(towards(h, 52, hueDeg), clamp(s * sat), v + (1 - v) * amt)
  return [
    dark(4, .34, 24), dark(3, .48, 17), dark(2, .63, 11), dark(1, .81, 5), hexRgb(base),
    light(.24, 4, .9), light(.48, 8, .74), light(.74, 11, .52),
  ]
}

const FIXED: Record<Exclude<Mat, 'A' | 'B' | 'C'>, string> = {
  E: '#1b1f2e', W: '#fffdf0', T: '#d9475f', M: '#e0879b', K: '#2c2633', F: '#efe7cf', P: '#7d5b3e', G: '#5fd8ff', S: '#e3dccb',
}

// ---------------- もけいを くみたてる ----------------

export class Model {
  prims: Prim[] = []
  fx: { x: number; y: number; c: Rgb; a: number }[] = []
  private parts = 0

  ell(x: number, y: number, rx: number, ry: number, o: Opt = {}) {
    const a = o.a ?? 0
    this.prims.push({
      x, y, z: o.z ?? 0, rx: Math.max(.3, rx), ry: Math.max(.3, ry), rz: o.rz ?? Math.min(rx, ry), ca: Math.cos(a), sa: Math.sin(a),
      mat: o.mat ?? 'A', gloss: o.gloss ?? .35, pat: o.pat, t: 0, l: 0, dx: Math.cos(a), dy: Math.sin(a), part: this.parts++, glass: o.glass ?? 0, glow: !!o.glow,
    })
    return this
  }

  /** ほそながい くだ（あし・とげ）。r と z は ながさ方向で かえられる。 */
  tube(points: readonly Pt[], r: Num, o: Omit<Opt, 'z' | 'a'> & { z?: Num; flat?: number } = {}) {
    return this.path(t => { const [x, y] = spline(points, t); return [x, y, val(o.z ?? 0, t)] }, r, o)
  }

  /**
   * くだを 関数で かく。f(t) は t（0〜1、からだに くっついた いち）の 立体の ざひょう。
   * ヘビの からだなど、うごいても もようが ずれない ように t ごとに ならべる。
   */
  path(f: (t: number) => P3, r: Num, o: Omit<Opt, 'z' | 'a'> & { flat?: number; step?: number } = {}) {
    const part = this.parts++
    const pts: P3[] = []
    // まず こまかく しらべて ながさを はかる。
    const probe = 64
    let total = 0
    let prev = f(0)
    for (let i = 1; i <= probe; i++) { const p = f(i / probe); total += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p }
    const n = Math.max(2, Math.ceil(total / (o.step ?? .5)))
    for (let i = 0; i <= n; i++) pts.push(f(i / n))
    let l = 0
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const [x, y, z] = pts[i]
      if (i > 0) l += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1])
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)]
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const rr = Math.max(.3, val(r, t))
      this.prims.push({
        x, y, z, rx: rr, ry: rr, rz: rr * (o.flat ?? 1), ca: 1, sa: 0, mat: o.mat ?? 'A', gloss: o.gloss ?? .35, pat: o.pat,
        t, l, dx: (b[0] - a[0]) / len, dy: (b[1] - a[1]) / len, part, glass: o.glass ?? 0, glow: !!o.glow,
      })
    }
    return this
  }

  /** め（ひかりの てん つき）。 */
  eye(x: number, y: number, r: number, z: number, mat: Mat = 'E') {
    return this.ell(x, y, r, r, { z, mat, gloss: 0, pat: c => c.u < -.05 && c.v < -.05 && c.u * c.u + c.v * c.v < .55 ? 'W' : null })
  }

  /** こうかの ドット（ふちどりの うえに かく）。 */
  dot(x: number, y: number, color: string, alpha = 1) {
    this.fx.push({ x: Math.round(x), y: Math.round(y), c: hexRgb(color), a: alpha })
    return this
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string, alpha = 1) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
    for (let i = 0; i <= n; i++) this.dot(lerp(x0, x1, i / n), lerp(y0, y1, i / n), color, alpha)
    return this
  }
}

// ---------------- やきつけ ----------------

const LIGHT = (() => { const l = [-.52, -.74, .66]; const k = Math.hypot(...l); return l.map(v => v / k) })()
const HALF = (() => { const h = [LIGHT[0], LIGHT[1], LIGHT[2] + 1]; const k = Math.hypot(...h); return h.map(v => v / k) })()
const INK = hexRgb('#140f1d')
const SPARK = hexRgb('#fffdf2')

/** ドット絵の 1コマ。index は いろばんごう（0 は とうめい）、palette は RGBA を 1つの かずに まとめた もの。 */
export type Frame = { w: number; h: number; index: Uint8Array | Uint16Array; palette: Uint32Array }

const pack = (c: readonly number[], a: number) => ((Math.round(a * 255) << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0

/** コマを RGBA の ならびに ひろげる。 */
export function rgbaOf(frame: Frame, out = new Uint8ClampedArray(frame.w * frame.h * 4)) {
  const view = new Uint32Array(out.buffer, out.byteOffset, frame.w * frame.h)
  for (let k = 0; k < view.length; k++) view[k] = frame.palette[frame.index[k]]
  return out
}

const LEVELS = 7
const SPEC = 7

/** もけいを ドット絵に する。colors は A/B/C の いろ。tint は からだ ぜんたいを すこし かえる（きせつの いろ など）。 */
export function rasterize(model: Model, colors: readonly [string, string, string], tint?: { color: string; amount: number }, scale = DETAIL): Frame {
  const w = SPRITE_W * scale, h = SPRITE_H * scale, n = w * h
  const base = (c: string) => tint && tint.amount > 0 ? makeRamp(c).map(rgb => mixRgb(rgb, hexRgb(tint.color), tint.amount * .6 * (rgb[0] + rgb[1] + rgb[2]) / 765 + tint.amount * .25)) : makeRamp(c)
  const ramps = {
    A: base(colors[0]), B: base(colors[1]), C: base(colors[2]),
    ...Object.fromEntries(Object.entries(FIXED).map(([k, c]) => [k, makeRamp(c)])),
  } as Record<Mat, Rgb[]>
  /** ドットの まんなかの、もけいの ます目での いち。 */
  const at = (i: number) => (i + .5) / scale

  const prims = model.prims
  const depth = new Float32Array(n).fill(-Infinity)
  const owner = new Int32Array(n).fill(-1)
  const lu = new Float32Array(n), lv = new Float32Array(n), lw = new Float32Array(n)
  const glassOwner = new Int32Array(n).fill(-1)
  const glassDepth = new Float32Array(n).fill(-Infinity)

  prims.forEach((p, index) => {
    const reach = Math.max(p.rx, p.ry)
    const i0 = Math.max(0, Math.floor((p.x - reach) * scale)), i1 = Math.min(w - 1, Math.ceil((p.x + reach) * scale))
    const j0 = Math.max(0, Math.floor((p.y - reach) * scale)), j1 = Math.min(h - 1, Math.ceil((p.y + reach) * scale))
    for (let j = j0; j <= j1; j++) {
      const dy = at(j) - p.y
      for (let i = i0; i <= i1; i++) {
        const dx = at(i) - p.x
        const u = (dx * p.ca + dy * p.sa) / p.rx, v = (-dx * p.sa + dy * p.ca) / p.ry
        const d = 1 - u * u - v * v
        if (d <= 0) continue
        const ww = Math.sqrt(d)
        const z = p.z + p.rz * ww
        const k = j * w + i
        if (p.glass > 0) {
          if (z > glassDepth[k]) { glassDepth[k] = z; glassOwner[k] = index }
          continue
        }
        if (z > depth[k]) { depth[k] = z; owner[k] = index; lu[k] = u; lv[k] = v; lw[k] = ww }
      }
    }
  })

  // 1. ひかりの だんかい と もよう。
  const level = new Int8Array(n).fill(-1)
  const mats: Mat[] = new Array(n)
  const spec = new Float32Array(n)
  for (let k = 0; k < n; k++) {
    const index = owner[k]
    if (index < 0) continue
    const p = prims[index]
    const i = k % w, j = (k - i) / w
    const u = lu[k], v = lv[k], ww = lw[k]
    const nx0 = u / p.rx, ny0 = v / p.ry, nz0 = ww / p.rz
    const nx = nx0 * p.ca - ny0 * p.sa, ny = nx0 * p.sa + ny0 * p.ca
    const nl = Math.hypot(nx, ny, nz0) || 1
    const N = [nx / nl, ny / nl, nz0 / nl]
    let mat = p.mat, darker = 0
    if (p.pat) {
      const dx = at(i) - p.x, dy = at(j) - p.y
      // よこ方向: ねている くだは 面の むき（した むきが +）、たっている くだは すすむ むきの みぎが +。
      const side = (-dx * p.dy + dy * p.dx) / Math.max(p.rx, p.ry)
      const up = Math.max(0, Math.min(1, (Math.abs(p.dy) - .45) / .35))
      const s = N[1] * (1 - up) + side * up
      const hit = p.pat({ t: p.t, l: p.l, s, u, v, w: ww, fine: scale > 1 })
      if (hit) { mat = hit[0] as Mat; darker = hit.length > 1 ? 1 : 0 }
    }
    mats[k] = mat
    if (p.glow || mat === 'W') { level[k] = LEVELS - 1; continue }
    const lambert = (N[0] * LIGHT[0] + N[1] * LIGHT[1] + N[2] * LIGHT[2] + .3) / 1.3
    const value = .14 + .9 * Math.max(0, lambert) + (1 - N[2]) * .05
    level[k] = Math.max(0, (value < .27 ? 0 : value < .39 ? 1 : value < .51 ? 2 : value < .63 ? 3 : value < .76 ? 4 : value < .89 ? 5 : 6) - darker)
    spec[k] = Math.pow(Math.max(0, N[0] * HALF[0] + N[1] * HALF[1] + N[2] * HALF[2]), 22) * p.gloss
  }

  // 2. てまえの 部品が おとす かげ（ひかりの ほうへ レイを とばす）。
  const sx = -LIGHT[0], sy = -LIGHT[1]
  const sl = Math.hypot(sx, sy)
  const stepX = -sx / sl, stepY = -sy / sl, stepZ = LIGHT[2] / Math.hypot(LIGHT[0], LIGHT[1])
  const isPart = (a: number, b: number) => {
    const pa = prims[a], pb = prims[b]
    return pa.part === pb.part && Math.abs(pa.l - pb.l) < (pa.rx + pb.rx) * 1.6
  }
  const shade = new Int8Array(n)
  const reach = 7 * scale
  for (let k = 0; k < n; k++) {
    if (owner[k] < 0 || prims[owner[k]].glow) continue
    const i = k % w, j = (k - i) / w
    const d = depth[k]
    for (let s = 1; s <= reach; s++) {
      const qi = Math.round(i + stepX * s), qj = Math.round(j + stepY * s)
      if (qi < 0 || qj < 0 || qi >= w || qj >= h) break
      const q = qj * w + qi
      if (owner[q] < 0 || isPart(owner[q], owner[k])) continue
      if (depth[q] > d + stepZ * (s / scale) + .8) { shade[k] = s <= 3 * scale ? 3 : 2; break }
    }
  }
  for (let k = 0; k < n; k++) {
    if (shade[k] && level[k] > 0 && mats[k] !== 'W') { level[k] = Math.max(0, level[k] - shade[k]); spec[k] = 0 }
  }

  // 3. はぐれドットの そうじ（まわりと ちがう ひとつぶを、まわりの だんへ）。
  const cleaned = level.slice()
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const k = j * w + i
      if (level[k] < 0 || mats[k] === 'W' || mats[k] === 'E') continue
      const a = level[k - 1], b = level[k + 1], c = level[k - w], d = level[k + w]
      if (a < 0 || b < 0 || c < 0 || d < 0) continue
      if (mats[k - 1] !== mats[k] || mats[k + 1] !== mats[k] || mats[k - w] !== mats[k] || mats[k + w] !== mats[k]) continue
      if (a === level[k] || b === level[k] || c === level[k] || d === level[k]) continue
      // 4つの うち 3つ いじょう おなじ なら、それに そろえる。
      if ((a === b && (a === c || a === d)) || (a === c && a === d)) cleaned[k] = a
      else if (b === c && b === d) cleaned[k] = b
    }
  }

  // 4. いろを ぬる。
  const color: (Rgb | null)[] = new Array(n).fill(null)
  for (let k = 0; k < n; k++) {
    if (cleaned[k] < 0) continue
    const ramp = ramps[mats[k]]
    let c = ramp[Math.max(0, Math.min(LEVELS - 1, cleaned[k]))]
    if (spec[k] > .55) c = mixRgb(ramp[SPEC], SPARK, .55)
    else if (spec[k] > .3) c = ramp[SPEC]
    else if (spec[k] > .2) c = ramp[LEVELS - 1]
    color[k] = c
  }

  // 5. うちがわの 線: てまえの 部品の うしろがわ（おくゆきが とぶ ところ）を くらく。
  const out = color.slice()
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i
      if (owner[k] < 0 || prims[owner[k]].glow) continue
      const near = [i > 0 ? k - 1 : -1, i < w - 1 ? k + 1 : -1, j > 0 ? k - w : -1, j < h - 1 ? k + w : -1]
      if (near.some(q => q >= 0 && owner[q] >= 0 && !isPart(owner[q], owner[k]) && depth[q] > depth[k] + 2)) {
        const ramp = ramps[mats[k]]
        out[k] = mixRgb(ramp[0], INK, .35)
      }
    }
  }

  // 6. そとがわの ふちどり: となりの いろの いちばん くらい いろ。ひかりの がわ（ひだり・うえ）は すこし うすく。
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i
      if (owner[k] >= 0) continue
      const below = j < h - 1 ? k + w : -1, right = i < w - 1 ? k + 1 : -1, above = j > 0 ? k - w : -1, left = i > 0 ? k - 1 : -1
      const lit = [below, right].find(q => q >= 0 && owner[q] >= 0)
      const dim = [above, left].find(q => q >= 0 && owner[q] >= 0)
      const q = lit ?? dim
      if (q === undefined) continue
      const ramp = ramps[mats[q]]
      out[k] = lit !== undefined && dim === undefined && cleaned[q] >= 4 ? mixRgb(ramp[0], INK, .25) : mixRgb(ramp[0], INK, .62)
    }
  }

  // 7. すける はね。
  const alpha = new Float32Array(n)
  for (let k = 0; k < n; k++) if (out[k]) alpha[k] = 1
  for (let k = 0; k < n; k++) {
    const gi = glassOwner[k]
    if (gi < 0) continue
    const p = prims[gi]
    if (owner[k] >= 0 && depth[k] > glassDepth[k]) continue
    const i = k % w, j = (k - i) / w
    const dx = at(i) - p.x, dy = at(j) - p.y
    const u = (dx * p.ca + dy * p.sa) / p.rx, v = (-dx * p.sa + dy * p.ca) / p.ry
    const mat = (p.pat?.({ t: p.t, l: p.l, s: 0, u, v, w: 0, fine: scale > 1 })?.[0] as Mat | undefined) ?? p.mat
    const ramp = ramps[mat]
    const edge = u * u + v * v > .78
    const tone = mat !== p.mat ? ramp[1] : edge ? ramp[3] : ramp[6]
    const a = mat !== p.mat || edge ? Math.min(1, p.glass + .35) : p.glass
    if (out[k]) { out[k] = mixRgb(out[k]!, tone, a); continue }
    out[k] = tone
    alpha[k] = a
  }

  // 8. こうか（1ます ぶんの ドットで）。
  for (const f of model.fx) {
    for (let dj = 0; dj < scale; dj++) {
      for (let di = 0; di < scale; di++) {
        const i = f.x * scale + di, j = f.y * scale + dj
        if (i < 0 || j < 0 || i >= w || j >= h) continue
        const k = j * w + i
        if (out[k] && alpha[k] >= 1) { out[k] = mixRgb(out[k]!, f.c, f.a); continue }
        out[k] = f.c
        alpha[k] = Math.max(alpha[k], f.a)
      }
    }
  }

  // 9. いろばんごうに まとめる。
  const colorsIn = new Map<number, number>([[0, 0]])
  const keys = new Uint32Array(n)
  for (let k = 0; k < n; k++) {
    const c = out[k]
    const key = c ? pack(c, alpha[k]) : 0
    keys[k] = key
    if (!colorsIn.has(key)) colorsIn.set(key, colorsIn.size)
  }
  const index = colorsIn.size > 256 ? new Uint16Array(n) : new Uint8Array(n)
  for (let k = 0; k < n; k++) index[k] = colorsIn.get(keys[k])!
  return { w, h, index, palette: Uint32Array.from(colorsIn.keys()) }
}
