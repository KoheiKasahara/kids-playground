// ヘビの なかま。すこし うえから みた ななめの 絵で、からだの くねりが みえる ように する。
// じめんの うえの くねりは、おくゆき（z）と がめんの たて（y）に うつして かく。
// からだの もようは あたま からの きょりで きめるので、くねっても ずれない。

import { key, wave } from './keys'
import type { Builder, Pose } from './pose'
import { bump, clamp, frac, hash, lerp, TAU, type Mat, type Model, type P3, type Pattern } from './raster'

type Posture = 'crawl' | 'coil' | 'ambush' | 'branch' | 'hood' | 'swim'
type HeadKind = 'pit' | 'slim' | 'cobra'
type Act =
  | 'rattle' | 'strike' | 'dangle' | 'buzz' | 'guard' | 'neck' | 'reach' | 'yawn' | 'tongue' | 'shade'
  | 'rear' | 'lure' | 'gape' | 'puff' | 'throat' | 'spit' | 'rise' | 'flare' | 'hide' | 'paddle'

type SnakeLook = {
  posture: Posture
  head: HeadKind
  /** からだの ふとさ（はんけい）。 */
  girth: number
  /** あたまの おおきさ。 */
  headSize?: number
  /** もようを きめる。l は あたまからの きょり、s は よこ（+ が おなか）。 */
  pattern: (l: number, s: number) => Mat | null
  act: Act
  tail?: 'rattle' | 'paddle' | 'lure'
  eye?: number
  lash?: boolean
  /** めの うしろの すじ。 */
  stripe?: Mat
  /** くちびるの いろ。 */
  lip?: Mat
}

// ---------------- もよう ----------------

const belly = (s: number, edge = .55) => s > edge
const diamonds = (period: number, ring: Mat = 'C', fill: Mat = 'B') => (l: number, s: number): Mat | null => {
  if (belly(s, .6)) return 'C'
  const k = Math.abs(frac(l / period) - .5) * 2
  const e = k + Math.abs(s + .15) * 1.1
  return e < .55 ? fill : e < .78 ? ring : null
}
const coonTail = (inner: (l: number, s: number) => Mat | null, from: number, period: number) => (l: number, s: number): Mat | null =>
  l > from ? (frac((l - from) / period) < .5 ? 'C' : 'E') : inner(l, s)
const bands = (period: number, duty: number, mat: Mat = 'B', rings = false) => (l: number, s: number): Mat | null =>
  !rings && belly(s) ? 'C' : frac(l / period) < duty ? mat : null
const blotches = (period: number, size: number, mat: Mat = 'B', ring?: Mat) => (l: number, s: number): Mat | null => {
  if (belly(s, .6)) return 'C'
  const i = Math.floor(l / period)
  const side = i % 2 ? .35 : -.45
  const d = Math.hypot((frac(l / period) - .5) * period / size, (s - side) / .55)
  return d < .62 ? mat : ring && d < 1 ? ring : null
}
const chevrons = (period: number) => (l: number, s: number): Mat | null => {
  if (belly(s, .62)) return 'C'
  const k = frac((l + Math.abs(s + .1) * period * .45) / period)
  return k < .14 ? 'C' : k < .52 ? 'B' : null
}
const speckle = (seed: number, amount: number, mat: Mat = 'B') => (l: number, s: number): Mat | null =>
  belly(s) ? 'C' : hash(Math.floor(l * .8), Math.floor(s * 3 + 7), seed) < amount ? mat : null
const plain = (_l: number, s: number): Mat | null => belly(s) ? 'C' : null

const LOOKS: Record<string, SnakeLook> = {
  rattlesnake: { posture: 'coil', head: 'pit', girth: 3.3, pattern: coonTail(diamonds(6.5), 104, 3), act: 'rattle', tail: 'rattle', stripe: 'C' },
  'mojave-rattlesnake': { posture: 'coil', head: 'pit', girth: 3.1, pattern: coonTail(diamonds(6, 'C', 'B'), 100, 4.5), act: 'strike', tail: 'rattle', stripe: 'C' },
  'eyelash-viper': { posture: 'branch', head: 'pit', girth: 2.6, headSize: 1.08, pattern: speckle(4, .14), act: 'dangle', lash: true, eye: 1.5 },
  bushmaster: { posture: 'ambush', head: 'pit', girth: 3.7, pattern: diamonds(8, 'C', 'B'), act: 'buzz' },
  mamushi: { posture: 'crawl', head: 'pit', girth: 3.6, pattern: blotches(6, 2.2, 'B', 'C'), act: 'guard', stripe: 'B' },
  'tiger-keelback': {
    posture: 'crawl', head: 'slim', girth: 3.2, act: 'neck', lip: 'C',
    pattern: (l, s) => belly(s) ? 'C' : l > 7 && l < 11 && s < .1 ? 'E' : l < 40 ? (frac(l / 5) < .45 ? (s < -.1 ? 'C' : 'B') : null) : frac(l / 6) < .32 ? 'C' : null,
  },
  habu: { posture: 'crawl', head: 'pit', girth: 3.2, headSize: 1.05, pattern: blotches(5.5, 2.6, 'B'), act: 'reach', stripe: 'B' },
  'hime-habu': { posture: 'ambush', head: 'pit', girth: 3.4, headSize: 1.08, pattern: blotches(5, 2.4, 'B'), act: 'yawn' },
  'sakishima-habu': { posture: 'crawl', head: 'pit', girth: 3.1, pattern: (l, s) => belly(s) ? 'C' : frac(l / 5) < .4 && Math.abs(s + .2) < .55 ? 'B' : null, act: 'tongue', stripe: 'B' },
  'inland-taipan': { posture: 'crawl', head: 'slim', girth: 3.1, pattern: (l, s) => belly(s) ? 'C' : l < 9 ? 'B' : speckle(8, .1)(l, s), act: 'shade' },
  'eastern-brown': { posture: 'crawl', head: 'slim', girth: 3, pattern: plain, act: 'rear' },
  'death-adder': { posture: 'ambush', head: 'pit', girth: 3.6, pattern: bands(6, .4), act: 'lure', tail: 'lure' },
  'black-mamba': { posture: 'crawl', head: 'slim', girth: 2.9, headSize: 1.1, pattern: plain, act: 'gape', eye: 1.35 },
  'puff-adder': { posture: 'ambush', head: 'pit', girth: 4.2, headSize: 1.1, pattern: chevrons(6.5), act: 'puff' },
  boomslang: { posture: 'branch', head: 'slim', girth: 2.1, pattern: (l, s) => belly(s) ? 'C' : hash(Math.floor(l), Math.floor(s * 3 + 7), 3) < .2 ? 'B' : null, act: 'throat', eye: 2 },
  'spitting-cobra': { posture: 'hood', head: 'cobra', girth: 2.8, headSize: .95, pattern: plain, act: 'spit' },
  'king-cobra': { posture: 'hood', head: 'cobra', girth: 3.1, headSize: 1.05, pattern: (l, s) => belly(s) ? 'C' : frac(l / 7) < .14 ? 'C' : null, act: 'rise' },
  'monocled-cobra': { posture: 'hood', head: 'cobra', girth: 2.9, headSize: .95, pattern: plain, act: 'flare' },
  'banded-krait': { posture: 'crawl', head: 'slim', girth: 3.3, pattern: bands(7, .5, 'B', true), act: 'hide' },
  'mangrove-viper': { posture: 'branch', head: 'pit', girth: 3.2, headSize: 1.08, pattern: blotches(5, 2, 'C'), act: 'strike' },
  'sea-krait': { posture: 'swim', head: 'slim', girth: 2.6, pattern: bands(6.5, .38, 'B', true), act: 'paddle', tail: 'paddle', lip: 'C' },
}

// ---------------- あたま ----------------

type HeadPose = {
  x: number; y: number; z: number
  /** はなさきの むき（ラジアン。π が ひだり）。 */
  dir: number
  gape?: number
  tongue?: number
  /** した を ふる ゆれ。 */
  flick?: number
  /** のどを ふくらませる。 */
  throat?: number
  /** うしろむき（フードの うらがわを みせる コブラ）。 */
  back?: boolean
}

function head(m: Model, look: SnakeLook, h: HeadPose) {
  const S = (look.headSize ?? 1) * (look.head === 'pit' ? 1.12 : look.head === 'cobra' ? 1.04 : .95)
  const d = [Math.cos(h.dir), Math.sin(h.dir)], n = [d[1], -d[0]]
  const P = (f: number, v: number): [number, number] => [h.x + (d[0] * f + n[0] * v) * S, h.y + (d[1] * f + n[1] * v) * S]
  const a = h.dir
  const gape = h.gape ?? 0
  const pit = look.head === 'pit'
  const z = h.z
  const lip = look.lip ?? 'C'
  if (h.back) {
    // うしろから みた あたま。
    const [x, y] = P(0, 0)
    m.ell(x, y, 3.6 * S, 2.8 * S, { z: z + 1, a, gloss: .8 })
    return
  }
  // した あご（ひらくと した へ まわる）。
  const jawA = a - gape * 1.1
  const jd = [Math.cos(jawA), Math.sin(jawA)], jn = [jd[1], -jd[0]]
  const J = (f: number, v: number): [number, number] => {
    const [px, py] = P(-2.2, 1.1)
    return [px + (jd[0] * f + jn[0] * v) * S, py + (jd[1] * f + jn[1] * v) * S]
  }
  if (gape > .05) {
    const [mx, my] = P(1.6, 1.6 + gape * 1.6)
    m.ell(mx, my, 4 * S, (1 + gape * 2.6) * S, { a: a - gape * .5, z: z - .5, mat: look.act === 'gape' ? 'K' : 'M', gloss: .2 })
  }
  const [jx, jy] = J(3.2, .8)
  m.ell(jx, jy, 4.4 * S, 1.35 * S, { a: jawA, z: z + .5, mat: lip, gloss: .5 })
  if (pit) {
    const [cx, cy] = P(-1.4, .6)
    m.ell(cx, cy, 3.6 * S, 2.7 * S, { a, z: z + .6, gloss: .7 })
  }
  const [hx, hy] = P(0, 0)
  m.ell(hx, hy, (pit ? 4.5 : 4) * S, (pit ? 2.85 : 2.4) * S, { a, z: z + 1, gloss: .85 })
  const [sx, sy] = P(pit ? 3.6 : 3.4, pit ? .3 : .35)
  m.ell(sx, sy, 2.5 * S, (pit ? 2.05 : 1.75) * S, { a, z: z + 1.4, gloss: .85 })
  if (h.throat) {
    const [tx, ty] = P(-4.5, 2 + h.throat * 2)
    m.ell(tx, ty, (3 + h.throat * 3.4) * S, (2 + h.throat * 4.2) * S, {
      a, z: z + 2.2, gloss: .7,
      pat: c => h.throat! > .35 && frac((c.u + 1) * 3.2) < .22 ? 'E' : frac((c.v + 1) * 3) < .14 && h.throat! > .35 ? 'C' : null,
    })
  }
  // くちの せん・きば。
  if (gape < .05) m.tube([P(5.6, 1.15), P(1.5, 1.45), P(-3.4, 1.35)], .58, { z: z + 2.4, mat: 'E', gloss: 0 })
  else if (look.head !== 'slim' || look.act === 'gape') {
    const [fx, fy] = P(4.2, 1.6)
    m.tube([[fx, fy], [fx + jn[0] * 2.2 * gape - d[0] * .3, fy + jn[1] * 2.2 * gape]], .55, { z: z + 3, mat: 'F', gloss: .4 })
  }
  if (h.tongue && h.tongue > .05) {
    const L = h.tongue * 6.5
    const flick = (h.flick ?? 0) * 1.6
    const [ox, oy] = P(5.8, 1.2)
    const tip: [number, number] = [ox + d[0] * L + n[0] * flick, oy + d[1] * L + n[1] * flick]
    m.tube([[ox, oy], tip], .55, { z: z + 3, mat: 'T', gloss: .4 })
    for (const side of [-1, 1]) m.tube([tip, [tip[0] + d[0] * 1.8 + n[0] * side * 1.1, tip[1] + d[1] * 1.8 + n[1] * side * 1.1]], .5, { z: z + 3, mat: 'T', gloss: .2 })
  }
  // め。
  const er = (look.eye ?? 1.25) * S
  const [ex, ey] = P(pit ? 1.4 : 1.6, pit ? -.9 : -.75)
  if (pit) {
    const [bx, by] = P(1.2, -2.1)
    m.ell(bx, by, 2.4 * S, 1 * S, { a, z: z + 3.2, gloss: .6 })
    const [px, py] = P(3.9, .2)
    m.dot(px, py, '#1b1f2e')
  }
  if (look.stripe) m.tube([P(.6, -.1), P(-1.6, .55), P(-4.4, 1.3)], .62, { z: z + 3.3, mat: look.stripe, gloss: .2 })
  m.eye(ex, ey, er, z + 3.6)
  if (look.lash) for (let i = 0; i < 3; i++) m.tube([P(.6 + i * 1.1, -2.6), P(.2 + i * 1.6, -4.4 - (i % 2) * .6)], t => lerp(.75, .45, t), { z: z + 4, mat: 'C', gloss: .6 })
}

// ---------------- からだ ----------------

/** じめんの うえの てん（X: よこ、D: おくゆき、H: たかさ）を がめんへ。 */
const GY = 42.5
const ground = (X: number, D: number, H: number, k = .48): P3 => [X, GY + D * k - H, D + H * .7]

function body(m: Model, look: SnakeLook, f: (t: number) => P3, r: (t: number) => number, length: number, glossy = .75, swap?: (l: number, s: number) => Mat | null) {
  const pattern = swap ?? look.pattern
  m.path(f, r, { pat: c => pattern(c.t * length, c.s), gloss: glossy, step: .45 })
}

function taper(look: SnakeLook, t: number, neck = .07, tail = .32) {
  const g = look.girth
  if (t < neck) return g * (.72 + .28 * (t / neck))
  if (t > 1 - tail) return g * Math.max(.18, (1 - t) / tail) ** .85 + .25
  return g
}

function dirOf(f: (t: number) => P3) {
  const a = f(0), b = f(.025)
  return Math.atan2(a[1] - b[1], a[0] - b[0])
}

function rattle(m: Model, x: number, y: number, z: number, dir: number, shake: number) {
  const d = [Math.cos(dir), Math.sin(dir)]
  for (let i = 0; i < 4; i++) {
    const k = i * 1.5
    m.ell(x + d[0] * k + shake, y + d[1] * k, 1.7 - i * .15, 1.35 - i * .1, { z: z + .1 * i, a: dir, mat: i % 2 ? 'B' : 'C', gloss: .5 })
  }
}

/** した を ちょろちょろ（idle で ときどき）。 */
function idleTongue(t: number, at: number) {
  const out = Math.max(bump(t, at, at + .14), bump(t, at + .18, at + .3))
  return { tongue: out, flick: wave(t, 18) }
}

function crawl(m: Model, look: SnakeLook, pose: Pose, sp: string) {
  const { clip, t } = pose
  const len = 112
  const phase = clip === 'move' ? t : 0
  const breath = clip === 'idle' ? wave(t, 1) * .06 : 0
  let rise = 0, neckBack = 0, gape = 0, tongue = 0, flick = 0, throat = 0, hide = 0, lookUp = 0, sway = 0, amp = 1
  let tint: { color: string; amount: number } | undefined
  if (clip === 'idle') ({ tongue, flick } = idleTongue(t, .55))
  if (clip === 'act') {
    const a = look.act
    if (a === 'guard') {
      // からだを ちぢめて くびを S字に もちあげ、かまえる。
      rise = key(t, [[0, 0], [.25, .65], [.85, .65], [1, 0]])
      neckBack = rise * .9
      amp = 1 + rise * .5
      ;({ tongue, flick } = idleTongue(t, .32))
    } else if (a === 'neck') {
      // ヤマカガシ: くびを ひらたく して もちあげ、あたまを さげて くびすじを みせる。
      rise = key(t, [[0, 0], [.2, .45], [.85, .45], [1, 0]])
      throat = key(t, [[0, 0], [.25, .9], [.8, .9], [1, 0]])
      lookUp = -key(t, [[0, 0], [.3, .7], [.8, .7], [1, 0]])
    } else if (a === 'reach') {
      // くびを たかく のばして まわりを みる（木に のぼる ときの ように）。
      rise = key(t, [[0, 0], [.3, 1], [.8, 1], [1, 0]])
      sway = rise * wave(t, 2) * .8
      lookUp = .2 * rise
      ;({ tongue, flick } = idleTongue(t, .45))
    } else if (a === 'tongue') {
      // あたまを もたげて、したで においを さぐる。
      rise = key(t, [[0, 0], [.2, .3], [.85, .3], [1, 0]])
      tongue = Math.max(bump(t, .2, .36), bump(t, .4, .56), bump(t, .62, .78))
      flick = wave(t, 30)
      sway = wave(t, 1.5) * .4 * rise
    } else if (a === 'shade') {
      // きせつで からだの いろが こく なる ようすを はやおくりで。
      const k = key(t, [[0, 0], [.35, 1], [.7, 1], [1, 0]])
      tint = { color: '#2e2722', amount: k * .8 }
      ;({ tongue, flick } = idleTongue(t, .45))
    } else if (a === 'rear') {
      // S字に たちあがって、くちを あけて おどかす。
      rise = key(t, [[0, 0], [.25, 1.15], [.85, 1.15], [1, 0]])
      neckBack = rise * .7
      gape = key(t, [[0, 0], [.3, 0], [.4, .8], [.75, .8], [.85, 0]])
    } else if (a === 'gape') {
      // ブラックマンバ: たかく もちあげて、くろい くちの なかを みせる。
      rise = key(t, [[0, 0], [.25, 1.1], [.85, 1.1], [1, 0]])
      gape = key(t, [[0, 0], [.3, 0], [.42, 1], [.75, 1], [.86, 0]])
      lookUp = .15
    } else if (a === 'hide') {
      // ガンガサヘビ: からだを まるめて、あたまを からだの したに かくす。
      hide = key(t, [[0, 0], [.3, 1], [.75, 1], [1, 0]])
    }
  }

  const amplitude = (u: number) => (u < .25 ? .4 + 2.4 * u : u > .85 ? 1 - (u - .85) * 2.6 : 1) * 7.5 * amp
  const X0 = 9 + rise * 4
  const raisedTo = .32
  const f = (u: number): P3 => {
    // ちぢめると くねりが ふかく なる。
    let X = X0 + u * 48 + hide * Math.sin(u * Math.PI) * -4
    let D = amplitude(u) * Math.sin(TAU * ((u * 48) / 26 - phase)) + hide * Math.sin(u * TAU * 1.5) * 4
    let H = 0
    if (rise > 0 && u < raisedTo) {
      const k = 1 - u / raisedTo
      const s = k * k * (3 - 2 * k)
      H = rise * 20 * s
      X += rise * (Math.sin(k * Math.PI) * 5 * (1 + neckBack) - k * 2)
      D *= 1 - s
    }
    if (u < .1 && sway) X += sway * (1 - u * 10) * 3
    return ground(X, D, H + taper(look, u) + .2, .62)
  }
  const r = (u: number) => taper(look, u) * (1 + breath * Math.sin(u * Math.PI)) + (throat && u < .12 ? throat * 2 * (1 - u / .12) : 0)
  if (hide > .5) {
    // あたまを うしろの まきに かくす。
    body(m, look, f, r, len)
    return { tint }
  }
  body(m, look, f, r, len)
  const [hx, hy, hz] = f(0)
  const dir = dirOf(f) - lookUp - (rise > .6 ? -.25 * rise : 0)
  head(m, look, { x: hx - Math.cos(dir) * 1.5, y: hy - Math.sin(dir) * 1.5 - hide * 3, z: hz + 2, dir, gape, tongue, flick, throat: throat * .6 })
  void sp
  return { tint }
}

function coil(m: Model, look: SnakeLook, pose: Pose) {
  const { clip, t } = pose
  let neck = 0, strike = 0, shake = 0, tongue = 0, flick = 0, gape = 0, tailUp = 0
  if (clip === 'idle' || clip === 'move') {
    ;({ tongue, flick } = idleTongue(t, .3))
    neck = wave(t, 1) * .5
  } else if (look.act === 'rattle') {
    tailUp = key(t, [[0, 0], [.15, 1], [.85, 1], [1, 0]])
    shake = tailUp > .5 ? (Math.round(t * 40) % 2 ? .8 : -.8) : 0
    neck = -key(t, [[0, 0], [.2, 1], [.85, 1], [1, 0]])
    ;({ tongue, flick } = idleTongue(t, .45))
  } else {
    // ひきしぼって、とびかかって、もどる。
    strike = key(t, [[0, 0], [.25, -1], [.38, -1], [.48, 1], [.6, 1], [.85, 0]])
    gape = key(t, [[0, 0], [.38, 0], [.46, 1], [.62, 1], [.72, 0]])
  }
  const g = look.girth
  const cx = 38, len = 130, neckEnd = .24
  // あたま → くび（たちあがる S字）→ とぐろ（うちがわ から そとへ）→ しっぽ。
  const f = (u: number): P3 => {
    if (u < neckEnd) {
      const k = u / neckEnd // 0 が あたま
      const reach = Math.max(0, strike) * 15, back = Math.max(0, -strike) * 4
      const X = lerp(17 - reach + back + neck * 1.2, cx - 1, k) + Math.sin(k * Math.PI) * (5 + back)
      const H = lerp(19 - reach * .5 + back * .3 - neck * .6, g * 2.6, k ** .85) + Math.sin(k * Math.PI) * 1.5
      return ground(X, lerp(4, 0, k), H + g)
    }
    const k = (u - neckEnd) / (1 - neckEnd)
    const th = Math.PI * .5 + k * TAU * 1.6
    const R = 3.5 + k * 11
    let H = g * (1 + (1 - k) * 1.5)
    if (k > .9) H += ((k - .9) / .1) ** 1.5 * (5 + tailUp * 6)
    return ground(cx + Math.cos(th) * R * 1.15 + (k > .9 ? shake : 0), Math.sin(th) * R, H)
  }
  const r = (u: number) => u < neckEnd ? g * lerp(.75, 1, Math.min(1, u / .06)) : taper(look, u, 0, .14)
  body(m, look, f, r, len)
  const [tx, ty, tz] = f(1)
  const [ax, ay] = f(.985)
  if (look.tail === 'rattle') rattle(m, tx, ty, tz + .5, Math.atan2(ty - ay, tx - ax), shake)
  if (shake) {
    for (const [dx, dy] of [[4, -3], [5, -1], [4, 1], [-4, -3], [-5, -1], [-4, 1]] as const) m.dot(tx + dx, ty + dy, '#fffbe0', .85)
  }
  const [hx, hy, hz] = f(0)
  head(m, look, { x: hx - 1, y: hy, z: hz + 2, dir: Math.PI + .12 - Math.max(0, strike) * .35 - Math.max(0, -strike) * .2, gape, tongue, flick })
}

function ambush(m: Model, look: SnakeLook, pose: Pose) {
  const { clip, t } = pose
  let tongue = 0, flick = 0, lure = 0, lureUp = 0, buzz = 0, puff = 0, gape = 0, headUp = 0
  if (clip !== 'act') {
    ;({ tongue, flick } = idleTongue(t, .6))
    if (look.tail === 'lure') lure = .25 * wave(t, 2)
  } else if (look.act === 'lure') {
    // しっぽの さきを もちあげて、むしの ように くねくね。
    lureUp = key(t, [[0, 0], [.12, 1], [.88, 1], [1, 0]])
    lure = wave(t, 4.5, .25) * lureUp
  } else if (look.act === 'buzz') {
    buzz = key(t, [[0, 0], [.1, 1], [.9, 1], [1, 0]]) * (Math.round(t * 48) % 2 ? 1 : -1)
    ;({ tongue, flick } = idleTongue(t, .3))
  } else if (look.act === 'puff') {
    puff = key(t, [[0, 0], [.25, 1], [.8, 1], [1, 0]])
    headUp = puff
  } else if (look.act === 'yawn') {
    gape = key(t, [[0, 0], [.15, 0], [.45, 1.25], [.65, 1.25], [.9, 0]])
    headUp = gape * .6
  }
  const g = look.girth
  const cx = 37, len = 118
  const swell = 1 + puff * .3 + (clip === 'idle' ? wave(t, 1) * .03 : 0)
  const neckEnd = .16
  const f = (u: number): P3 => {
    // あたまは とぐろの うえに のせて、ひだりを むく。
    if (u < neckEnd) {
      const k = u / neckEnd
      return ground(lerp(18 + puff * 3, cx - 2, k) + Math.sin(k * Math.PI) * 2, lerp(5, 1, k), lerp(g * 1.9 + headUp * 3, g * 2.3, k) + g)
    }
    const k = (u - neckEnd) / (1 - neckEnd)
    const th = -Math.PI * .4 + k * TAU * 1.35
    const R = lerp(4, 14, k) * (1 + puff * .06)
    const tip = look.tail === 'lure' && k > .88 ? (k - .88) / .12 : 0
    const H = g * (1 + (1 - k) ** 2 * 1.3) + tip * 2
    const X = cx + Math.cos(th) * R * 1.2 + (k > .85 ? buzz * (k - .85) * 8 : 0)
    const D = Math.sin(th) * R
    if (tip) return ground(X - tip * (10 + lureUp * 3) + lure * tip * 2.5, D + tip * (2 + lureUp * 3), H + tip * lureUp * 5 + lure * tip * 3)
    return ground(X, D, H)
  }
  const r = (u: number) => taper(look, u, .05, .2) * (u > .14 && u < .8 ? swell : 1)
  body(m, look, f, r, len, .6)
  if (buzz) {
    const [tx, ty] = f(1)
    m.dot(tx + 3, ty - 3, '#fffbe0', .8).dot(tx + 4, ty - 1, '#fffbe0', .8).dot(tx - 3, ty - 3, '#fffbe0', .8)
    m.dot(tx + 2, ty + 2, '#b39462').dot(tx - 2, ty + 2, '#b39462')
  }
  const [hx, hy, hz] = f(0)
  if (puff > .5) for (const [dx, dy] of [[-9, -3], [-10, 0], [-9, 3]] as const) m.dot(hx + dx, hy + dy, '#fffbe0', .85)
  head(m, look, { x: hx - 1, y: hy - headUp, z: hz + 3, dir: Math.PI - .05 - headUp * .3 - gape * .25, gape, tongue, flick })
}

function branch(m: Model, look: SnakeLook, pose: Pose) {
  const { clip, t } = pose
  const by = 31
  const twig = (x: number) => by + Math.sin(x * .09) * 1.2
  // えだ。
  m.tube([[0, twig(0) + .5], [20, twig(20)], [44, twig(44)], [64, twig(64) - .5]], 2.3, { z: 0, mat: 'P', gloss: .1, pat: c => frac(c.t * 9) < .1 ? 'S' : null })
  m.tube([[46, twig(46)], [52, by - 6], [55, by - 9]], t2 => lerp(1.4, .6, t2), { z: -2, mat: 'P', gloss: .1 })
  m.ell(56, by - 10, 2.6, 1.3, { a: -.5, z: -2, mat: 'S', gloss: .2 })
  // えだを ささえる みき（じめんまで）。
  m.tube([[58, twig(58) - 1], [59.5, 39], [60, 46]], t2 => lerp(2.4, 3.2, t2), { z: -3, mat: 'P', gloss: .1, pat: c => frac(c.l / 5) < .15 ? 'S' : null })
  m.tube([[60, 44], [55, 46.5]], 1.2, { z: -2, mat: 'P', gloss: .1 }).tube([[60.5, 44], [63.5, 46.5]], 1.1, { z: -2, mat: 'P', gloss: .1 })
  let tongue = 0, flick = 0, drop = 0, strike = 0, gape = 0, throat = 0, slide = 0
  if (clip === 'idle') ({ tongue, flick } = idleTongue(t, .5))
  else if (clip === 'move') slide = t
  else if (look.act === 'dangle') drop = key(t, [[0, 0], [.35, 1], [.7, 1], [1, 0]])
  else if (look.act === 'strike') {
    strike = key(t, [[0, 0], [.25, -1], [.36, -1], [.46, 1], [.6, 1], [.86, 0]])
    gape = key(t, [[0, 0], [.36, 0], [.44, 1], [.62, 1], [.72, 0]])
  } else {
    throat = key(t, [[0, 0], [.25, 1], [.8, 1], [1, 0]])
    ;({ tongue, flick } = idleTongue(t, .55))
  }
  const slender = look.girth < 2.5
  const len = slender ? 120 : 96
  const front = slender ? .38 : .26
  const loops = slender ? 1 : 2
  const f = (u: number): P3 => {
    if (u < front) {
      // えだから のりだした まえの からだ。
      const k = u / front // 0 が あたま
      const reach = Math.max(0, strike) * 10, back = Math.max(0, -strike) * 4
      let X = lerp(slender ? 6 : 12, 28, k) - reach + back * (1 - k) + Math.sin(k * Math.PI) * back
      let Y = by - (slender ? 5 : 7) * (1 - k) ** 1.2 - Math.sin(k * Math.PI) * 2 + reach * .25 * (1 - k)
      if (slender && clip !== 'act') Y += wave(slide + k * .8, 1) * 1.2 * (1 - k)
      if (drop) {
        // あたまを したに たらす。
        X = lerp(X, 22 + Math.sin(k * Math.PI) * 3, drop)
        Y = lerp(Y, by + 3 + (1 - k) * 14, drop)
      }
      return [X, Y - look.girth * .6, 3 + (1 - k)]
    }
    const k = (u - front) / (1 - front)
    const X = 28 + k * 34
    // えだに まきつく: まえ（z +）と うしろ（z -）を いったり きたり。
    const ph = k * loops * TAU + (slender ? 0 : slide * TAU * .2)
    const Y = twig(X) - Math.cos(ph) * (look.girth + 1.6) * .9 + (slender ? 0 : Math.max(0, Math.sin(ph)) * 2.5)
    return [X, Y, Math.sin(ph) * 4.5]
  }
  const r = (u: number) => taper(look, u, .06, .25)
  body(m, look, f, r, len)
  const [hx, hy, hz] = f(0)
  const dir = dirOf(f)
  head(m, look, { x: hx, y: hy, z: hz + 2, dir: drop > .5 ? dir : Math.PI + (dir - Math.PI) * .6 + Math.max(0, strike) * .3, gape, tongue, flick, throat })
}

function hood(m: Model, look: SnakeLook, pose: Pose, sp: string) {
  const { clip, t } = pose
  const back = sp === 'monocled-cobra'
  let spread = .95, sway: number, tall = 0, spit = -1, tongue = 0, flick = 0, hiss = 0
  if (clip !== 'act') {
    sway = wave(t, 1)
    ;({ tongue, flick } = idleTongue(t, .6))
  } else if (look.act === 'spit') {
    // まえへ かがんで、どくを とばす。
    spread = 1
    sway = key(t, [[0, 0], [.25, -.6], [.35, .9], [.55, .9], [.8, 0]])
    spit = t > .32 && t < .78 ? (t - .32) / .46 : -1
  } else if (look.act === 'rise') {
    tall = key(t, [[0, 0], [.3, 1], [.85, 1], [1, 0]])
    spread = .95 + tall * .15
    sway = wave(t, 2) * tall * 1.3
    hiss = tall
  } else {
    spread = key(t, [[0, .95], [.2, 1.3], [.85, 1.3], [1, .95]])
    sway = wave(t, 1.5) * .8
    hiss = spread > 1 ? 1 : 0
  }
  const baseX = 33, top = 12 - tall * 5
  // じめんの とぐろ。
  const coilLen = 70
  const cf = (u: number): P3 => {
    const th = Math.PI * .5 + u * TAU * 1.15
    const R = lerp(13, 7, u)
    const H = look.girth * .9 + (u > .9 ? (u - .9) * 20 : 0)
    return ground(baseX + 2 + Math.cos(th) * R * 1.25, Math.sin(th) * R, H, .36)
  }
  m.path(cf, u => look.girth * (u > .75 ? lerp(1, .4, (u - .75) / .25) : 1), { pat: c => look.pattern(30 + c.t * coilLen, c.s), gloss: .7, step: .45 })
  // たちあがった くび。
  const lean = sway * 2.2
  const neck = (u: number): P3 => {
    // u=0 が フードの なか、u=1 が じめん。
    const X = baseX - 2 + lean * (1 - u) ** 1.4 + Math.sin(u * Math.PI) * -1.5
    const Y = lerp(top + 9, GY - look.girth, u ** 1.1)
    return [X, Y, 6 - u * 2]
  }
  m.path(neck, u => look.girth * lerp(1.05, 1, u), { pat: c => back ? null : (c.s > .2 ? 'C' : null), gloss: .7, step: .45 })
  // フード（ひらたく ひろげた くび）。
  const [nx, ny, nz] = neck(0)
  const hw = 9.5 * spread, hh = 10.5
  const front: Pattern = c => {
    if (Math.abs(c.u) > .84) return 'B'
    if (Math.abs(c.u) < .34 + c.v * .08) {
      // のどの もよう。
      if (sp === 'spitting-cobra') return frac((c.v + 1) * 2.6) < .3 && c.v > -.3 ? 'B' : 'C'
      return c.v > 0 && frac((c.v + 1) * 2.2) < .22 ? 'B' : 'C'
    }
    return null
  }
  const backPat: Pattern = c => {
    // うしろの まるい もよう（めがねの かたほう）。
    const d = Math.hypot(c.u * 1.05, (c.v + .15) * 1.25)
    if (d < .13) return 'B'
    if (d < .3) return 'C'
    if (d < .38) return 'E'
    return Math.abs(c.u) > .86 ? 'B' : null
  }
  const hoodY = ny - 1.5
  m.ell(nx + lean * .15, hoodY, hw, hh, { z: nz + (back ? 3.5 : 1), rz: 2.4, gloss: .55, pat: back ? backPat : front, a: sway * .04 })
  const hx = nx + lean * .2 - 1, hy = hoodY - hh + 2.5
  if (back) {
    head(m, look, { x: hx - 1, y: hy, z: nz - 1, dir: Math.PI + .25, tongue, flick })
  } else {
    head(m, look, { x: hx - 2, y: hy, z: nz + 6, dir: Math.PI + .3 + (spit >= 0 ? .15 : 0), tongue, flick, gape: spit >= 0 && spit < .8 ? .35 : 0 })
  }
  if (spit >= 0) {
    // どくの しぶき（きりの ように ひろがる つぶ）。
    for (let i = 0; i < 12; i++) {
      const k = spit - i * .05
      if (k < 0 || k > 1) continue
      const x = hx - 7 - k * 28 - (i % 3)
      const y = hy + 1 + k * k * 9 + ((i % 3) - 1) * (1 + k * 3)
      const a = .95 - k * .55
      m.dot(x, y, '#f6f2b8', a).dot(x - 1, y, '#f6f2b8', a * .7)
      if (i % 2 === 0) m.dot(x, y + 1, '#d8d27c', a * .8)
    }
  }
  if (hiss > .5) for (const [dx, dy] of [[-9, -4], [-10, -1], [-9, 2]] as const) m.dot(hx + dx, hy + dy, '#fffbe0', .85)
}

function swim(m: Model, look: SnakeLook, pose: Pose) {
  const { clip, t } = pose
  const fast = clip === 'act' ? key(t, [[0, 0], [.15, 1], [.85, 1], [1, 0]]) : 0
  const phase = clip === 'idle' ? t : clip === 'move' ? t : t * 3
  const len = 100
  const f = (u: number): P3 => {
    const X = 7 + u * 52
    const A = (u < .2 ? .35 + u * 3.2 : 1) * (5 + fast * 2)
    return [X, 25 + A * Math.sin(TAU * (u * 52 / 30 - phase)) * .7, A * Math.cos(TAU * (u * 52 / 30 - phase)) * .6]
  }
  const r = (u: number) => u < .06 ? look.girth * (.8 + u * 3) : u > .7 ? look.girth * lerp(1, .75, (u - .7) / .3) : look.girth + Math.sin(u * Math.PI) * .5
  body(m, look, f, r, len, .85)
  // ひらたい しっぽ（オール）。
  const [tx, ty, tz] = f(1)
  const [ax, ay] = f(.96)
  const ta = Math.atan2(ty - ay, tx - ax)
  m.ell(tx + Math.cos(ta) * 1.5, ty + Math.sin(ta) * 1.5, 3.6, 4.6, { a: ta, z: tz, rz: .9, gloss: .5, pat: c => c.u > .1 ? 'B' : null })
  const [hx, hy, hz] = f(0)
  const dir = dirOf(f)
  const { tongue, flick } = clip === 'idle' ? idleTongue(t, .55) : { tongue: 0, flick: 0 }
  head(m, look, { x: hx - 1, y: hy, z: hz + 2, dir, tongue, flick })
  if (fast > .5) for (let i = 0; i < 3; i++) m.dot(62 - i * 2, ty - 4 + i * 4, '#d8f4f4', .7)
}

export const snake: Builder = (m, pose, sp) => {
  const look = LOOKS[sp.id]
  if (!look) throw new Error(`no snake look: ${sp.id}`)
  switch (look.posture) {
    case 'crawl': return crawl(m, look, pose, sp.id)
    case 'coil': return coil(m, look, pose)
    case 'ambush': return ambush(m, look, pose)
    case 'branch': return branch(m, look, pose)
    case 'hood': return hood(m, look, pose, sp.id)
    case 'swim': return swim(m, look, pose)
  }
}

/** ヘビの すがた（あるきまわるか、その ばで じっと するか）。 */
export function snakePosture(id: string): Posture | undefined {
  return LOOKS[id]?.posture
}

void clamp
