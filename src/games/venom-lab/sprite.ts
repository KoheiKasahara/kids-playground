// いきものの ドット絵を、だえんたい（たまご形）を くみあわせた 立体から やきつける。
// カブクワバトルと おなじように、1ドットずつ いちばん てまえの 面を さがして、
// 面の むきで あかるさを きめ、パレットの だんかいと ベイヤーの あみかけで ぬる。
// さいごに そとがわと、まえ・うしろが かさなる ところに ふちどりを つける。
//
// ざひょうは x が みぎ、y が した（ドット）、z が てまえ。

import type { SpriteKind } from './data'

export const SPRITE_W = 64
export const SPRITE_H = 48

/** A/B/C は いきものごとの いろ、E は め、W は めの ひかり。 */
type Mat = 'A' | 'B' | 'C' | 'E' | 'W'

/** もようを きめる ための ばしょ。t は くだ（からだ・あし）の ながさ方向（0〜1）、s は よこ方向（-1〜1）。 */
type Ctx = { t: number; s: number; u: number; v: number; x: number; y: number }
type Pattern = (c: Ctx) => Mat | null

type Prim = {
  x: number; y: number; z: number
  rx: number; ry: number; rz: number
  /** がめんの なかでの かたむき。 */
  a: number
  mat: Mat
  gloss: number
  pat?: Pattern
  /** くだの とき: ながさ方向の いち・すすむ むき。 */
  t: number; dx: number; dy: number
}

type Opt = { z?: number; rz?: number; a?: number; mat?: Mat; gloss?: number; pat?: Pattern }
type Num = number | ((t: number) => number)
type Pt = readonly [number, number]

// ---------------- いろ ----------------

function hexRgb(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgbHex(c: readonly number[]) {
  return `#${c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`
}
function mix(a: string, b: string, t: number) {
  const x = hexRgb(a), y = hexRgb(b)
  return rgbHex(x.map((v, i) => v + (y[i] - v) * t))
}

const INK = '#15121c'
const EYE = '#151b24'
const SHINE = '#fffbea'

/** 1つの いろから 5だんの パレットを つくる（くらい → あかるい）。 */
function ramp(base: string) {
  const deep = mix(base, '#120e1c', .62)
  return [deep, mix(base, '#120e1c', .36), mix(base, '#1a1424', .15), base, mix(base, '#fffbe8', .38)]
}

// ---------------- ちいさな どうぐ ----------------

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16)
function bayer(x: number, y: number) { return BAYER[(y & 3) * 4 + (x & 3)] }

function hash(x: number, y: number, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** なめらかな ゆらぎ（0〜1）。 */
function noise(x: number, y: number, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

const frac = (v: number) => v - Math.floor(v)
const val = (n: Num, t: number) => typeof n === 'number' ? n : n(t)

/** とおる 点を なめらかに つなぐ（カトマル・ロム）。 */
function spline(points: readonly Pt[], t: number): Pt {
  const n = points.length - 1
  if (n <= 0) return points[0]
  const f = Math.max(0, Math.min(.99999, t)) * n
  const i = Math.floor(f), u = f - i
  const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[Math.min(n, i + 1)], p3 = points[Math.min(n, i + 2)]
  const k = (a: number, b: number, c: number, d: number) =>
    .5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u)
  return [k(p0[0], p1[0], p2[0], p3[0]), k(p0[1], p1[1], p2[1], p3[1])]
}

// ---------------- もけいを くみたてる ----------------

class Model {
  prims: Prim[] = []

  ell(x: number, y: number, rx: number, ry: number, o: Opt = {}) {
    this.prims.push({ x, y, z: o.z ?? 0, rx, ry, rz: o.rz ?? Math.min(rx, ry), a: o.a ?? 0, mat: o.mat ?? 'A', gloss: o.gloss ?? .35, pat: o.pat, t: 0, dx: Math.cos(o.a ?? 0), dy: Math.sin(o.a ?? 0) })
    return this
  }

  /** ほそながい くだ（からだ・あし・とげ）。r と z は ながさ方向で かえられる。 */
  tube(points: readonly Pt[], r: Num, o: Omit<Opt, 'z' | 'a'> & { z?: Num; flat?: number } = {}) {
    let total = 0
    for (let i = 1; i < points.length; i++) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
    const n = Math.max(2, Math.ceil(total / .55))
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const [x, y] = spline(points, t)
      const [ax, ay] = spline(points, Math.max(0, t - .02)), [bx, by] = spline(points, Math.min(1, t + .02))
      const l = Math.hypot(bx - ax, by - ay) || 1
      const rr = val(r, t)
      this.prims.push({ x, y, z: val(o.z ?? 0, t), rx: rr, ry: rr, rz: rr * (o.flat ?? 1), a: 0, mat: o.mat ?? 'A', gloss: o.gloss ?? .35, pat: o.pat, t, dx: (bx - ax) / l, dy: (by - ay) / l })
    }
    return this
  }

  /** め（ひかりの てん つき）。 */
  eye(x: number, y: number, r: number, z: number) {
    return this.ell(x, y, r, r, { z, mat: 'E', gloss: 0, pat: c => c.u < -.1 && c.v < -.1 && c.u * c.u + c.v * c.v < .62 ? 'W' : null })
  }
}

// ---------------- もよう ----------------

const spots = (cell: number, size: number, mat: Mat, seed: number, keep = .55): Pattern => c => {
  const gx = c.x / cell, gy = c.y / cell
  const ix = Math.floor(gx), iy = Math.floor(gy)
  if (hash(ix, iy, seed) > keep) return null
  const ox = .3 + hash(ix, iy, seed + 1) * .4, oy = .3 + hash(ix, iy, seed + 2) * .4
  const r = size * (.7 + hash(ix, iy, seed + 3) * .5)
  return (gx - ix - ox) ** 2 + (gy - iy - oy) ** 2 < r * r ? mat : null
}

const both = (...patterns: Pattern[]): Pattern => c => {
  for (const p of patterns) {
    const hit = p(c)
    if (hit) return hit
  }
  return null
}

// ---------------- いきもの ----------------

const GROUND = 44

function octopus(m: Model) {
  const rings: Pattern = c => {
    const cell = 6.5, gx = c.x / cell, gy = c.y / cell
    const ix = Math.floor(gx), iy = Math.floor(gy)
    const ox = .5 + (hash(ix, iy, 3) - .5) * .3, oy = .5 + (hash(ix, iy, 4) - .5) * .3
    const d = Math.hypot(gx - ix - ox, gy - iy - oy) * cell
    return d < 1.1 ? 'B' : d < 2.2 ? 'C' : d < 2.9 ? 'B' : null
  }
  // うで 8ぽん（おくの 4ほんは うしろ、てまえの 4ほんは まえ）。
  for (const back of [true, false]) {
    for (let i = 0; i < 4; i++) {
      const k = back ? (i - 1.5) * 1.15 : (i - 1.5) * 1.5
      const side = Math.sign(k) || 1
      const base: Pt = [32 + k * 2, 28]
      const mid: Pt = [32 + k * 6, back ? 34 : 37]
      const end: Pt = [32 + k * 9.5, back ? 40 : 43]
      const curl: Pt = [end[0] + side * 3.5, end[1] - 3]
      m.tube([base, mid, end, curl, [curl[0] - side * 1.5, curl[1] - 2]], t => 3.2 - t * 2.5, { z: back ? -5 : 4, pat: rings, gloss: .5 })
    }
  }
  m.ell(32, 25, 9.5, 6.5, { z: 1, pat: rings, gloss: .5 })
  m.ell(33, 14, 11, 10, { a: -.2, z: -1, pat: rings, gloss: .6 })
  for (const x of [26.5, 37.5]) {
    m.ell(x, 23.5, 3.4, 3, { z: 7, gloss: .4 })
    m.eye(x, 24, 1.9, 9.5)
  }
}

function stonefish(m: Model) {
  const mottled: Pattern = c => {
    const n = noise(c.x / 3.5, c.y / 3.5, 7)
    return n < .3 ? 'B' : n > .74 ? 'C' : hash(c.x, c.y, 2) > .9 ? 'B' : null
  }
  // せびれの とげ。
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 3.6, y = 22 + Math.abs(i - 4) * .6
    m.tube([[x, y], [x + 1, y - 4 - (i % 3)], [x + 2.2, y - 6 - (i % 3)]], t => 1.1 - t * .6, { z: -2, mat: 'B' })
  }
  m.ell(58, 31, 4, 6, { a: .1, z: -1, mat: 'B', pat: mottled })
  m.ell(34, 32, 22, 10.5, { a: .05, pat: mottled, gloss: .1 })
  m.ell(17, 31, 12.5, 11, { z: 2, pat: mottled, gloss: .1 })
  // こぶこぶ。
  for (let i = 0; i < 16; i++) {
    const x = 8 + hash(i, 1, 9) * 46, top = 22 + Math.abs(x - 28) * .12
    m.ell(x, top + hash(i, 2, 9) * 9, 2 + hash(i, 3, 9) * 2.5, 1.8 + hash(i, 4, 9) * 2, { z: 7 + hash(i, 5, 9) * 3, pat: mottled, gloss: .1 })
  }
  // むなびれと くち。
  m.ell(29, 38, 8.5, 4.5, { a: .25, z: 10, mat: 'B', pat: c => frac((c.u + 1) * 3) < .25 ? 'C' : null })
  m.ell(10, 25, 6, 2, { a: -.6, z: 8, mat: 'B' })
  m.ell(15, 22, 2.6, 2.4, { z: 11, mat: 'C' })
  m.eye(15, 22, 1.5, 13)
}

function lionfish(m: Model) {
  const stripes: Pattern = c => {
    const k = frac((c.x + c.y * .35) / 6)
    return k < .38 ? 'B' : k > .6 && k < .78 ? 'C' : null
  }
  const ray: Pattern = c => frac(c.t * 5) < .45 ? 'C' : null
  // せびれの ながい とげ。
  for (let i = 0; i < 11; i++) {
    const x = 18 + i * 2.6, y = 21 - Math.sin((i / 10) * Math.PI) * 1.5
    const len = 16 - Math.abs(i - 3) * 1.2
    m.tube([[x, y], [x + 3, y - len * .55], [x + 6, y - len]], t => .95 - t * .45, { z: -3, mat: 'B', pat: ray })
  }
  // おびれ。
  for (let i = 0; i < 5; i++) {
    m.tube([[46, 26], [53, 22 + i * 2.2], [59, 19 + i * 4]], t => 1 - t * .4, { z: -2, mat: 'B', pat: ray })
  }
  m.ell(52, 26, 6, 6.5, { z: -3, mat: 'C', rz: 1, pat: c => frac(c.x / 3) < .45 ? 'B' : null })
  m.ell(31, 27, 16, 7.5, { a: .04, pat: stripes, gloss: .5 })
  m.ell(16, 27, 8, 7, { z: 2, pat: stripes, gloss: .5 })
  // むなびれ（おおきな うちわ）。
  for (let i = 0; i < 9; i++) {
    const ang = .35 + i * .19
    m.tube([[24, 30], [24 + Math.cos(ang) * 11, 30 + Math.sin(ang) * 9], [24 + Math.cos(ang) * 22, 30 + Math.sin(ang) * 15]], t => 1.15 - t * .5, { z: 9, mat: 'B', pat: ray })
  }
  for (let i = 0; i < 4; i++) m.tube([[13, 29], [12 - i, 36 + i * 1.5]], .6, { z: 6, mat: 'C' })
  m.ell(8.5, 28, 2.6, 1.6, { a: .3, z: 5, mat: 'C' })
  m.eye(14, 25, 2, 8)
}

function frogShape(m: Model, toad: boolean) {
  const warts: Pattern = toad
    ? both(spots(4.5, .22, 'C', 4, .7), c => noise(c.x / 5, c.y / 5, 3) < .32 ? 'B' : null)
    : spots(6, .23, 'C', 5, .6)
  const leg: Mat = toad ? 'A' : 'B'
  const legPat = toad ? warts : spots(5, .2, 'C', 8, .35)
  // おくの あし。
  m.tube([[40, 34], [46, 37], [40, 41], [33, 42]], t => 3.6 - t * 2, { z: -6, mat: leg, pat: legPat })
  m.tube([[22, 34], [21, 39], [19, 42]], t => 2 - t * .6, { z: -5, mat: leg, pat: legPat })
  // からだ・あたま。
  m.ell(35, 31, toad ? 16 : 13, toad ? 10.5 : 9, { a: toad ? -.08 : -.28, pat: warts, gloss: toad ? .1 : .9 })
  m.ell(21, 28, toad ? 10 : 9, toad ? 7.5 : 7, { z: 2, a: .12, pat: warts, gloss: toad ? .1 : .9 })
  if (toad) m.ell(27, 24, 5.5, 2.8, { a: .15, z: 7, mat: 'B', gloss: .1 })
  // てまえの うしろあし（もも・すね・あしさき）。
  m.ell(42, 37, toad ? 8 : 8.5, 5, { a: -.5, z: 7, mat: leg, pat: legPat, gloss: toad ? .1 : .8 })
  m.tube([[48, 39], [43, 42], [36, 42.5]], t => 2.8 - t * 1.2, { z: 9, mat: leg, pat: legPat })
  m.tube([[36, 42.5], [30, 43.5]], 1.2, { z: 10, mat: leg })
  for (const dx of [-1.5, 1.5]) m.ell(29 + dx, 43.6, 1.3, 1, { z: 11, mat: leg })
  // まえあし。
  m.tube([[24, 33], [25, 38], [23, 42.5]], t => 2.4 - t * .8, { z: 7, mat: leg, pat: legPat })
  for (const dx of [-2.2, 0, 2.2]) m.ell(22.5 + dx, 43.4, 1.3, 1, { z: 9, mat: leg })
  // め。
  m.ell(19, 21.5, 4, 3.6, { z: 6, pat: warts, gloss: .6 })
  m.eye(18, 21, 2.6, 9)
  m.ell(12.5, 29, 4, 1, { a: .2, z: 6, mat: 'B' })
}

/** くだの もよう: せなかの もよう（ダイヤ・おび）と、おなか。 */
type SnakeLook = { body: Pattern; head?: Pattern }

function diamonds(count: number): Pattern {
  return c => {
    const k = Math.abs(frac(c.t * count) - .5) * 2
    const edge = k + Math.abs(c.s) * .9
    if (c.s > .62) return 'C'
    return edge < .62 ? 'B' : edge < .8 ? 'C' : null
  }
}

function snakeHead(m: Model, x: number, y: number, z: number, tilt: number, wide: number, look: SnakeLook) {
  m.ell(x + 4, y + 1, 4.8 * wide, 4.2 * wide, { a: tilt, z, pat: look.head, gloss: .7 })
  m.ell(x, y, 6.2, 3.6 * wide, { a: tilt, z: z + 1, pat: look.head, gloss: .7 })
  m.ell(x - 2.5, y + 2.4, 3.2, 1, { a: tilt, z: z + 3, mat: 'B' })
  m.eye(x - 1, y - 1.3, 1.5, z + 4.5)
}

function serpent(m: Model) {
  const bands: Pattern = c => c.s > .55 ? 'C' : (frac(c.t * 14) < .34 && c.t < .9 ? 'B' : null)
  m.tube([[61, 41], [54, 44], [46, 41], [38, 44], [30, 42], [22, 44], [15, 40], [12, 34], [14, 27], [19, 22]],
    t => .7 + Math.sin(Math.min(1, t * 1.3) * Math.PI * .9) * 2.9, { z: t => t > .7 ? 2 : 0, pat: bands, gloss: .8 })
  snakeHead(m, 16, 20, 4, -.1, .95, { body: bands })
  m.tube([[9, 22], [6, 23], [4, 22]], .45, { z: 6, mat: 'B' })
}

function viper(m: Model) {
  const look: SnakeLook = { body: diamonds(9), head: c => c.v > .25 ? 'C' : null }
  m.tube([[61, 40], [55, 43.5], [46, 41], [37, 43.8], [29, 41.5], [22, 38], [18, 33]],
    t => .8 + Math.sin(Math.min(1, t * 1.15) * Math.PI * .92) * 4, { z: t => t * 2, pat: look.body, gloss: .55 })
  snakeHead(m, 14, 30, 4, .1, 1.18, look)
  // めの うしろの すじ。
  m.ell(16, 28.6, 3.2, .8, { a: .15, z: 9, mat: 'B' })
}

function snake(m: Model) {
  // とぐろを まいて、かまくびを もちあげる。
  const pts: Pt[] = []
  const zs: number[] = []
  const N = 36
  for (let k = 0; k <= N; k++) {
    const f = k / N, th = Math.PI * .5 + f * Math.PI * 3.6
    const R = 18 - f * 8
    pts.push([35 + Math.cos(th) * R, 40 - f * 5 + Math.sin(th) * R * .26])
    zs.push(Math.sin(th) * R * .8)
  }
  pts.push([28, 28], [23, 22])
  zs.push(10, 12)
  const body = diamonds(18)
  const z = (t: number) => {
    const f = t * (zs.length - 1), i = Math.min(zs.length - 2, Math.floor(f))
    return zs[i] + (zs[i + 1] - zs[i]) * (f - i)
  }
  m.tube(pts, t => t < .05 ? 1.6 + t * 30 : 3.6 - t * .6, {
    z, gloss: .6,
    pat: c => c.t < .05 ? (frac(c.t * 90) < .35 ? 'B' : 'C') : body(c),
  })
  snakeHead(m, 18, 19, 14, -.15, 1.1, { body, head: c => c.v > .25 ? 'C' : null })
}

function cobra(m: Model) {
  const body: Pattern = c => c.s > .55 ? 'C' : (frac(c.t * 12) < .14 ? 'B' : null)
  m.tube([[30, 38], [44, 37.5], [54, 40], [50, 44], [36, 44.5], [20, 43], [14, 40], [20, 37.5], [27, 38]],
    t => 1 + Math.min(1, t * 2.5) * 2.8, { z: t => Math.sin(t * Math.PI * 2) * 6, pat: body, gloss: .6 })
  m.tube([[27, 40], [25, 33], [24, 26]], 3.6, { z: 8, pat: body, gloss: .6 })
  // フード。
  m.ell(24, 18, 9, 11, {
    z: 6, rz: 2.5, gloss: .5,
    pat: c => {
      const ring = Math.hypot(Math.abs(c.u) - .32, (c.v + .1) * 1.2)
      if (Math.abs(c.u) < .12 && c.v > .2) return 'C'
      return ring > .12 && ring < .24 ? 'C' : Math.abs(c.u) > .78 ? 'B' : null
    },
  })
  m.ell(24, 23, 3.6, 7, { z: 9, mat: 'C', gloss: .4, pat: c => frac(c.v * 3) < .25 ? 'B' : null })
  m.ell(24, 8.5, 5, 3.8, { z: 10, gloss: .8 })
  m.ell(24, 11, 3.2, 1.8, { z: 12, gloss: .8, mat: 'C' })
  m.eye(21.6, 8, 1.4, 13.5)
  m.eye(26.4, 8, 1.4, 13.5)
}

function seaSnake(m: Model) {
  const pts: Pt[] = []
  for (let k = 0; k <= 12; k++) {
    const f = k / 12
    pts.push([56 - f * 44, 24 + Math.sin(f * Math.PI * 2.2) * 7])
  }
  const bands: Pattern = c => frac(c.t * 13) < .36 ? 'B' : null
  m.ell(59.5, 24.5, 3.4, 6, { a: .2, z: 0, rz: 1.2, pat: c => c.v < .1 ? 'B' : null })
  m.tube(pts, t => 2.6 + Math.sin(t * Math.PI) * .9, { z: t => Math.cos(t * Math.PI * 2.2) * 4, pat: bands, gloss: .7 })
  m.ell(10, 24, 5, 3.2, { a: -.15, z: 3, pat: c => c.u < -.1 ? 'C' : 'B', gloss: .7 })
  m.eye(8.8, 22.8, 1.3, 6)
}

function spider(m: Model) {
  const leg = (hip: Pt, knee: Pt, foot: Pt, z: number) =>
    m.tube([hip, knee, foot], t => 1.6 - t * .8, { z, mat: 'B', gloss: .5, pat: c => frac(c.t * 3) < .07 ? 'A' : null })
  const legs: [Pt, Pt][] = [[[12, 18], [4, 42]], [[21, 16], [15, 44]], [[40, 22], [47, 44]], [[52, 24], [60, 43]]]
  // おくの あし。
  legs.forEach(([knee, foot], i) => leg([26 + i * 2.2, 26], [knee[0] + 3, knee[1] - 4], [foot[0] + 3, foot[1] - 5], -7))
  m.ell(42, 24, 12, 9.5, { a: -.15, z: -1, gloss: .9, pat: c => Math.abs(c.v + .05) < .2 && c.u > -.8 ? 'C' : (hash(c.x, c.y, 3) > .94 ? 'C' : null) })
  m.ell(25, 28, 7.5, 6, { z: 2, gloss: .7, pat: c => c.v < -.2 && Math.abs(c.u) < .2 ? 'B' : null })
  m.ell(18.5, 32, 2, 3, { z: 6, mat: 'B', gloss: .6 })
  m.ell(21.5, 33, 2, 3, { z: 7, mat: 'B', gloss: .6 })
  m.tube([[16, 31], [13, 33], [12, 36]], .8, { z: 6, mat: 'B' })
  m.eye(20, 25.5, 1.1, 8)
  m.eye(23, 24.5, 1.1, 8.5)
  // てまえの あし。
  legs.forEach(([knee, foot], i) => leg([24 + i * 2.6, 31], knee, foot, 8))
}

function hornet(m: Model) {
  const wing: Pattern = c => Math.abs(c.v + c.u * .2) < .08 || Math.abs(c.u - .1) < .05 ? 'B' : null
  m.ell(32, 12, 13, 4, { a: -.3, z: -5, rz: .6, mat: 'C', gloss: 1, pat: wing })
  // あし。
  for (let i = 0; i < 3; i++) {
    m.tube([[22 + i * 3, 26], [19 + i * 4, 33], [22 + i * 6, 40]], t => 1.2 - t * .5, { z: -3 + i, mat: 'B' })
  }
  m.ell(41, 27, 13, 7.5, { a: .3, gloss: .7, pat: c => frac((c.u + 1) * 2.4) < .38 ? 'B' : null })
  m.tube([[53, 32], [57, 35]], t => 1 - t * .7, { z: 1, mat: 'B' })
  m.ell(30, 23, 2.5, 2, { z: 2, mat: 'B' })
  m.ell(23, 21, 7.5, 6.5, { z: 3, mat: 'B', gloss: .7, pat: c => c.v < -.55 && Math.abs(c.u) < .5 ? 'A' : null })
  m.ell(12, 21, 6, 6.8, { z: 4, gloss: .7 })
  m.ell(13, 18.5, 3, 4.8, { z: 8, mat: 'E', gloss: .9 })
  m.ell(6.5, 25, 2.4, 1.6, { a: .5, z: 8, mat: 'B' })
  m.tube([[9, 15], [6, 9], [2, 7]], .8, { z: 7, mat: 'B' })
  m.ell(36, 13, 14, 4.2, { a: -.25, z: 9, rz: .6, mat: 'C', gloss: 1, pat: wing })
}

function centipede(m: Model) {
  const path = (x: number): Pt => [x, 34 + Math.sin(x * .17) * 3]
  const segs = 17
  for (let i = segs - 1; i >= 0; i--) {
    const x = 12 + i * 2.9
    const [px, py] = path(x)
    const [qx, qy] = path(x + 1)
    const a = Math.atan2(qy - py, qx - px)
    for (const side of [-1, 1] as const) {
      const z = side > 0 ? 3 : -4
      const back = i === segs - 1
      const foot: Pt = back ? [px + 9, py + 3 + side] : [px + 1.5, py + (side > 0 ? 9 : 6.5)]
      m.tube([[px, py + 1.2], [px - side * .5 + (back ? 4 : 0), py + (back ? 1 : 5)], foot], t => .85 - t * .3, { z, mat: 'B' })
    }
    m.ell(px, py, 2.4, 3.1, { a, z: 0, gloss: .8, pat: c => c.u > .62 ? 'B' : null })
  }
  // あたま・きば・しょっかく。
  m.ell(10, 33.2, 3.6, 3.4, { z: 1, mat: 'C', gloss: .8 })
  m.tube([[8, 35], [5, 38], [7, 39.5]], .8, { z: 3, mat: 'C' })
  for (const [z, dy] of [[-2, -1], [3, 1]] as const) m.tube([[8, 31], [3, 27 + dy], [1, 21 + dy]], t => .7 - t * .3, { z, mat: 'C' })
}

function newt(m: Model) {
  const pat: Pattern = c => c.s > .3 ? (noise(c.x / 2, c.y / 2, 5) > .7 ? 'B' : 'C') : (hash(c.x, c.y, 6) > .93 ? 'B' : null)
  const leg = (pts: Pt[], z: number) => {
    m.tube(pts, t => 1.6 - t * .7, { z, gloss: .5, pat: c => c.t > .7 ? 'C' : null })
    const [fx, fy] = pts[pts.length - 1]
    for (const dx of [-1.6, 0, 1.6]) m.ell(fx + dx, fy + .4, .9, .7, { z: z + 1 })
  }
  leg([[19, 33], [16, 37], [14, 40.5]], -4)
  leg([[38, 33], [41, 37], [44, 40.5]], -4)
  m.tube([[9, 31], [18, 31], [30, 31.5], [40, 31.5], [50, 29], [58, 25], [63, 22]],
    t => t < .6 ? 3.6 + Math.sin(t / .6 * Math.PI) * .7 : 3.6 * (1 - (t - .6) / .4) + .5, { pat, gloss: .7 })
  m.ell(9, 31, 6, 3.8, { z: 1, gloss: .7, pat: c => c.v > .35 ? 'C' : null })
  m.eye(8, 29.2, 1.4, 5)
  leg([[17, 34], [15, 39], [12, 42.5]], 5)
  leg([[36, 34], [39, 39], [42, 42.5]], 5)
}

function lizard(m: Model) {
  const beads: Pattern = c => {
    if (c.s > .62) return null
    const n = noise(c.x / 4.2, c.y / 3.2, 11) + (hash(c.x, c.y, 2) - .5) * .12
    return n < .48 ? 'B' : null
  }
  const leg = (pts: Pt[], z: number) => {
    m.tube(pts, t => 2.4 - t * .9, { z, pat: beads, gloss: .3 })
    const [fx, fy] = pts[pts.length - 1]
    for (const dx of [-2, -.7, .7, 2]) m.ell(fx + dx, fy + .5, .8, .8, { z: z + 1, mat: 'B' })
  }
  leg([[18, 35], [15, 39], [13, 42.5]], -5)
  leg([[40, 35], [43, 39], [45, 42.5]], -5)
  m.tube([[11, 31], [20, 31.5], [31, 32], [42, 32.5], [52, 34], [59, 38], [62, 42]],
    t => t < .55 ? 5 + Math.sin(t / .55 * Math.PI) * .9 : 5 * (1 - (t - .55) / .45) + .9, { pat: beads, gloss: .25 })
  m.ell(10, 31, 7, 4.8, { z: 1, gloss: .25, pat: beads })
  m.ell(5, 32.5, 2.6, 1, { a: .1, z: 4, mat: 'B' })
  m.eye(8.5, 29.3, 1.3, 5.5)
  leg([[16, 36], [14, 40], [11, 43]], 6)
  leg([[38, 36], [41, 40], [44, 43]], 6)
}

function scorpion(m: Model) {
  const seg = (n: number): Pattern => c => frac(c.t * n) < .14 ? 'B' : null
  const legs = (z: number, dy: number) => {
    for (let i = 0; i < 4; i++) {
      const x = 22 + i * 4
      m.tube([[x, 33 + dy], [x + 3 + i, 28 + dy], [x + 5 + i * 2, 43 + dy * .4]], t => 1.2 - t * .5, { z, mat: 'B', pat: seg(3) })
    }
  }
  const claw = (z: number, dx: number, dy: number) => {
    m.tube([[20 + dx, 32 + dy], [15 + dx, 35 + dy], [12 + dx, 32 + dy]], t => 1.9 - t * .3, { z, pat: seg(2) })
    m.ell(8.5 + dx, 31 + dy, 4.6, 3.1, { a: -.15, z: z + 1, gloss: .6 })
    m.tube([[5 + dx, 29.5 + dy], [2 + dx, 28.5 + dy], [.5 + dx, 29.5 + dy]], t => 1.4 - t * .8, { z: z + 2, mat: 'B' })
    m.tube([[5 + dx, 32.5 + dy], [2.5 + dx, 33.5 + dy], [1 + dx, 32.5 + dy]], t => 1.1 - t * .6, { z: z + 2, mat: 'B' })
  }
  legs(-5, -2.5)
  claw(-5, 4, -5)
  m.tube([[18, 32], [26, 32], [35, 33], [40, 32.5]], t => 4.5 - t * .5, { flat: .7, pat: seg(6), gloss: .6 })
  m.tube([[40, 32], [46, 28], [49, 20], [46, 12], [40, 8.5], [35, 10]], t => 2.9 - t * .7, { z: t => 2 + t * 2, pat: seg(5), gloss: .6 })
  m.ell(33, 12.5, 3.2, 2.4, { a: .5, z: 5, mat: 'C', gloss: .8 })
  m.tube([[31, 14], [29.5, 16.5], [31, 18]], t => 1 - t * .7, { z: 6, mat: 'B' })
  m.eye(19.5, 29.5, .9, 5)
  legs(5, 0)
  claw(6, 0, 2)
}

function cone(m: Model) {
  const tent: Pattern = c => {
    if (frac(c.t * 4 + .1) < .1) return 'B'
    const gx = c.x / 3.2, gy = c.y / 3.2
    const ix = Math.floor(gx), iy = Math.floor(gy)
    const lx = gx - ix - .5, ly = gy - iy
    if (hash(ix, iy, 21) > .8) return null
    return ly > Math.abs(lx) * 1.6 ? 'C' : ly > Math.abs(lx) * 1.6 - .25 ? 'B' : null
  }
  m.ell(33, 41.5, 19, 3.4, { z: -3, mat: 'B', gloss: .3 })
  m.tube([[50, 39], [56, 35], [59, 31]], t => 1.6 - t * .5, { z: 4, mat: 'B' })
  m.tube([[6, 30], [10, 29.5], [16, 29]], t => 1.2 + t * 8.6, { z: 1, pat: c => frac(c.t * 4) < .22 ? 'B' : null, gloss: .9 })
  m.tube([[16, 29], [30, 32], [43, 35], [53, 37.5]], t => 10.5 * (1 - t) + 1, { pat: tent, gloss: .9 })
}

function starfish(m: Model) {
  const arms = 12
  for (let k = 0; k < arms; k++) {
    const th = (k / arms) * Math.PI * 2 + .1
    const dx = Math.cos(th), dy = Math.sin(th) * .55
    const pts: Pt[] = [[32 + dx * 4, 28 + dy * 4], [32 + dx * 14, 28 + dy * 14], [32 + dx * 24, 28 + dy * 24 + 1]]
    m.tube(pts, t => 4 - t * 2.6, { z: Math.sin(th) * 6 - 1, flat: .6, gloss: .5 })
    for (let j = 1; j < 4; j++) {
      const [px, py] = spline(pts, j / 4)
      m.tube([[px, py], [px + dx * 1.5, py - 3]], .6, { z: Math.sin(th) * 6 + 2, mat: 'C' })
    }
  }
  m.ell(32, 27, 12, 7, { z: 2, rz: 4, gloss: .5, pat: spots(3, .25, 'B', 12, .5) })
  for (let k = 0; k < 14; k++) {
    const th = hash(k, 1, 5) * Math.PI * 2, rr = 2 + hash(k, 2, 5) * 8
    const x = 32 + Math.cos(th) * rr, y = 27 + Math.sin(th) * rr * .55
    m.tube([[x, y], [x + Math.cos(th) * 1.5, y - 3.2]], .55, { z: 7, mat: 'C' })
  }
}

function urchin(m: Model) {
  const n = 46, golden = Math.PI * (3 - Math.sqrt(5))
  const spine = (front: boolean) => {
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 1.4
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      const th = golden * i
      const d = [Math.cos(th) * r, -y, Math.sin(th) * r] as const
      if ((d[2] > 0) !== front) continue
      const len = 19 + hash(i, 1, 4) * 6
      let ex = 32 + d[0] * len, ey = 31 + d[1] * len * .9
      if (ey > GROUND + 2) { ex = 32 + d[0] * len * .7; ey = GROUND + 2 }
      m.tube([[32 + d[0] * 8, 31 + d[1] * 6], [ex, ey]], t => .9 - t * .55, { z: d[2] * 12, mat: 'B', pat: c => frac(c.t * 6) < .3 ? 'A' : null })
    }
  }
  spine(false)
  m.ell(32, 33, 11, 8.5, { z: 0, gloss: .6, pat: c => {
    if (Math.hypot(c.u + .05, c.v + .55) < .22) return Math.hypot(c.u + .05, c.v + .55) < .12 ? 'B' : 'C'
    return frac(Math.atan2(c.v, c.u) * 2) < .12 ? 'B' : null
  } })
  for (let i = 0; i < 5; i++) m.ell(26 + i * 3, 30 + (i % 2) * 3, .9, .9, { z: 9, mat: 'W', gloss: 0 })
  spine(true)
}

const BUILDERS: Record<SpriteKind, (m: Model) => void> = {
  octopus, stonefish, lionfish,
  frog: m => frogShape(m, false),
  toad: m => frogShape(m, true),
  snake, scorpion, lizard, serpent, viper, cobra,
  'sea-snake': seaSnake,
  spider, hornet, centipede, newt, cone, starfish, urchin,
}

// ---------------- やきつけ ----------------

const LIGHT = (() => { const l = [-.5, -.72, .62]; const k = Math.hypot(...l); return l.map(v => v / k) })()
const HALF = (() => { const h = [LIGHT[0], LIGHT[1], LIGHT[2] + 1]; const k = Math.hypot(...h); return h.map(v => v / k) })()

export type CreatureImage = { w: number; h: number; pixels: readonly (string | null)[] }

/** いきものの ドット絵（いろの ならび。null は とうめい）。 */
export function renderCreature(kind: SpriteKind, colors: readonly [string, string, string]): CreatureImage {
  const model = new Model()
  BUILDERS[kind](model)
  const prims = model.prims
  const w = SPRITE_W, h = SPRITE_H, n = w * h
  const ramps: Record<Mat, string[]> = { A: ramp(colors[0]), B: ramp(colors[1]), C: ramp(colors[2]), E: ramp(EYE), W: [SHINE, SHINE, SHINE, SHINE, SHINE] }
  const depth = new Float32Array(n).fill(-Infinity)
  const owner = new Int32Array(n).fill(-1)
  const lu = new Float32Array(n), lv = new Float32Array(n), lw = new Float32Array(n)

  prims.forEach((p, index) => {
    const ca = Math.cos(p.a), sa = Math.sin(p.a)
    const reach = Math.max(p.rx, p.ry)
    const i0 = Math.max(0, Math.floor(p.x - reach)), i1 = Math.min(w - 1, Math.ceil(p.x + reach))
    const j0 = Math.max(0, Math.floor(p.y - reach)), j1 = Math.min(h - 1, Math.ceil(p.y + reach))
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = i + .5 - p.x, dy = j + .5 - p.y
        const u = (dx * ca + dy * sa) / p.rx, v = (-dx * sa + dy * ca) / p.ry
        const d = 1 - u * u - v * v
        if (d <= 0) continue
        const ww = Math.sqrt(d)
        const z = p.z + p.rz * ww
        const k = j * w + i
        if (z > depth[k]) { depth[k] = z; owner[k] = index; lu[k] = u; lv[k] = v; lw[k] = ww }
      }
    }
  })

  const pixels: (string | null)[] = new Array(n).fill(null)
  for (let k = 0; k < n; k++) {
    const index = owner[k]
    if (index < 0) continue
    const p = prims[index]
    const i = k % w, j = (k - i) / w
    const u = lu[k], v = lv[k], ww = lw[k]
    // 面の むき（ローカル → がめん）。
    const nx0 = u / p.rx, ny0 = v / p.ry, nz0 = ww / p.rz
    const ca = Math.cos(p.a), sa = Math.sin(p.a)
    const nx = nx0 * ca - ny0 * sa, ny = nx0 * sa + ny0 * ca
    const nl = Math.hypot(nx, ny, nz0) || 1
    const N = [nx / nl, ny / nl, nz0 / nl]
    let mat = p.mat
    if (p.pat) {
      const dx = i + .5 - p.x, dy = j + .5 - p.y
      const s = (-dx * p.dy + dy * p.dx) / Math.max(p.rx, p.ry)
      mat = p.pat({ t: p.t, s, u, v, x: i, y: j }) ?? mat
    }
    const pal = ramps[mat]
    const lambert = Math.max(0, N[0] * LIGHT[0] + N[1] * LIGHT[1] + N[2] * LIGHT[2])
    const rim = (1 - N[2]) * .08
    const value = .2 + .82 * lambert + rim
    const level = Math.max(0, Math.min(4, Math.round(Math.min(.9999, value) * 4 + bayer(i, j) - .5)))
    let color = pal[level]
    const spec = Math.pow(Math.max(0, N[0] * HALF[0] + N[1] * HALF[1] + N[2] * HALF[2]), 24) * p.gloss
    if (spec > .5) color = mix(pal[4], SHINE, .65)
    else if (spec > .28 && bayer(i, j) < .5) color = pal[4]
    pixels[k] = color
  }

  // ふちどり: そとがわと、てまえの ものの うしろがわ（おくゆきが とぶ ところ）。
  const out = pixels.slice()
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i
      const near = [i > 0 ? k - 1 : -1, i < w - 1 ? k + 1 : -1, j > 0 ? k - w : -1, j < h - 1 ? k + w : -1]
      if (owner[k] < 0) {
        if (near.some(q => q >= 0 && owner[q] >= 0)) out[k] = INK
        continue
      }
      const d = depth[k]
      if (near.some(q => q >= 0 && owner[q] >= 0 && owner[q] !== owner[k] && depth[q] > d + 2.2)) {
        out[k] = mix(pixels[k]!, INK, .7)
      }
    }
  }
  return { w, h, pixels: out }
}

const cache = new Map<string, CreatureImage>()

/** おなじ いきものは 1かいだけ つくって しまっておく。 */
export function creatureImage(kind: SpriteKind, colors: readonly [string, string, string]) {
  const key = `${kind}|${colors.join(',')}`
  let image = cache.get(key)
  if (!image) {
    image = renderCreature(kind, colors)
    cache.set(key, image)
  }
  return image
}

/** いろごとに、よこに ならんだ ドットを 1本の path に まとめる。 */
export function imagePaths(image: CreatureImage) {
  const byColor = new Map<string, string[]>()
  for (let y = 0; y < image.h; y++) {
    let x = 0
    while (x < image.w) {
      const color = image.pixels[y * image.w + x]
      if (!color) { x++; continue }
      let end = x + 1
      while (end < image.w && image.pixels[y * image.w + end] === color) end++
      let list = byColor.get(color)
      if (!list) byColor.set(color, list = [])
      list.push(`M${x} ${y}h${end - x}v1h${x - end}z`)
      x = end
    }
  }
  return [...byColor].map(([color, parts]) => ({ color, d: parts.join('') }))
}
