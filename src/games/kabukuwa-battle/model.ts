// カブトムシ・クワガタの 立体の もけい。だえんたい（たまご形）を くみあわせて つくる。
// おなじ もけいを よこ・ななめ・うえ から ドット絵に やきつける（sprite.ts）。
//
// ざひょうは x が まえ（あたま）、y が ひだり、z が うえ。原点は からだの まんなかの 地面。
// ポーズ（あしの うごき・ツノを あげる・あごを ひらく・ひっくりかえる）も ここで つける。

import type { Limb, Look, Species, V3 } from './species'

/** 3x3 の 回転行列（行優先）。ローカル → もけい。 */
export type M3 = readonly number[]
export type MatKey = 'elytra' | 'pron' | 'horn' | 'leg' | 'belly' | 'eye' | 'hair'

export type Prim = {
  c: V3
  r: V3
  m: M3
  mat: MatKey
  /** もようを つける ところ（はね）。 */
  pattern?: boolean
}

export type Pose = {
  /** あしの うごき（0〜1 で 1しゅう）。 */
  leg: number
  /** ツノを あげる（0〜1）。 */
  lift: number
  /** 大あごを ひらく（0〜1）。 */
  jaw: number
  /** ひっくりかえって いる。 */
  flipped: boolean
}

export const REST: Pose = { leg: 0, lift: 0, jaw: 0, flipped: false }

export type BeetleModel = {
  prims: Prim[]
  /** ポーズなしでの まえはし・うしろはし・せの たかさ（もけいの たんい）。 */
  front: number
  rear: number
  top: number
}

// ---------------- ベクトル・行列 ----------------

const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]
export function add(a: V3, b: V3): V3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
export function sub(a: V3, b: V3): V3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
export function mul(a: V3, k: number): V3 { return [a[0] * k, a[1] * k, a[2] * k] }
export function dot(a: V3, b: V3) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
export function cross(a: V3, b: V3): V3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
export function len(a: V3) { return Math.hypot(a[0], a[1], a[2]) }
export function norm(a: V3): V3 { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
export function apply(m: M3, v: V3): V3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]
}
export function applyT(m: M3, v: V3): V3 {
  return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]
}
export function mulM(a: M3, b: M3): M3 {
  const o: number[] = []
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j])
  return o
}
/** y じくまわり。+ で まえ（+x）が したへ、- で うえへ。 */
export function rotY(a: number): M3 { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c] }
/** z じくまわり（うえから みて ひだりまわり）。 */
export function rotZ(a: number): M3 { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1] }
export function rotX(a: number): M3 { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c] }

/** x じくを d に むける 回転（ほそながい だえんたいを せんに そわせる）。 */
function alignX(d: V3): M3 {
  const x = norm(d)
  const helper: V3 = Math.abs(x[2]) > .9 ? [1, 0, 0] : [0, 0, 1]
  const y = norm(cross(helper, x))
  const z = cross(x, y)
  // 列が x, y, z の 行列（ローカル → もけい）。
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]
}

// ---------------- 線（ツノ・あし）を だえんたいの くさりに する ----------------

/** とおる 点を なめらかに つなぐ（カトマル・ロム）。 */
function spline(points: readonly V3[], t: number): V3 {
  const n = points.length - 1
  if (n <= 0) return points[0]
  const f = Math.max(0, Math.min(.99999, t)) * n
  const i = Math.floor(f), u = f - i
  const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[Math.min(n, i + 1)], p3 = points[Math.min(n, i + 2)]
  const k = (a: number, b: number, c: number, d: number) =>
    .5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u)
  return [k(p0[0], p1[0], p2[0], p3[0]), k(p0[1], p1[1], p2[1], p3[1]), k(p0[2], p1[2], p2[2], p3[2])]
}

function polyLength(points: readonly V3[]) {
  let total = 0
  for (let i = 1; i < points.length; i++) total += len(sub(points[i], points[i - 1]))
  return total
}

/** a → b の ほそながい だえんたい。 */
function segment(a: V3, b: V3, r: number, mat: MatKey): Prim {
  const d = sub(b, a)
  const l = len(d)
  return { c: mul(add(a, b), .5), r: [l * .5 + r * .9, r, r], m: l > 1e-6 ? alignX(d) : I3, mat }
}

function chain(points: readonly V3[], r0: number, r1: number, mat: MatKey, out: Prim[], steps?: number) {
  const n = steps ?? Math.max(2, Math.min(12, Math.ceil(polyLength(points) / .045)))
  let prev = spline(points, 0)
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const p = spline(points, t)
    out.push(segment(prev, p, r0 + (r1 - r0) * (t - .5 / n), mat))
    prev = p
  }
}

// ---------------- からだ ----------------

const LEG_H = .07

type Frame = {
  pronC: V3; pronR: V3
  headC: V3; headR: V3
  /** ツノを あげる ときの ささえ。 */
  liftPivot: V3
  headPivot: V3
  /** はね・おなか（うごかない ところ）。 */
  base: Prim[]
  pron: Prim
  /** あたま（みみ つき）。 */
  head: Prim[]
}

function bodyParts(look: Look, kuwagata: boolean): Frame {
  const W = look.width, H = look.height
  if (!kuwagata) {
    const elyC: V3 = [-.16, 0, LEG_H + H * .5], elyR: V3 = [.34, W * .5, H * .5]
    const pronR: V3 = [.17 * look.pron, W * .46 * look.pron, H * .42 * look.pron]
    const pronC: V3 = [.18, 0, LEG_H + H * .44]
    const headR: V3 = [.08 * look.head, W * .22 * look.head, H * .18 * look.head]
    const headC: V3 = [.34, 0, LEG_H + H * .3]
    return {
      pronC, pronR, headC, headR, liftPivot: [.02, 0, LEG_H + H * .45], headPivot: [headC[0] - headR[0], 0, headC[2]],
      base: [
        { c: [-.05, 0, LEG_H + H * .24], r: [.4, W * .4, H * .24], m: I3, mat: 'belly' },
        { c: elyC, r: elyR, m: I3, mat: 'elytra', pattern: true },
      ],
      pron: { c: pronC, r: pronR, m: I3, mat: 'pron' },
      head: [{ c: headC, r: headR, m: I3, mat: 'pron' }],
    }
  }
  const elyC: V3 = [-.2, 0, LEG_H + H * .5], elyR: V3 = [.3, W * .5, H * .5]
  const pronR: V3 = [.11 * look.pron, W * .47 * look.pron, H * .44]
  const pronC: V3 = [.14, 0, LEG_H + H * .5]
  const headR: V3 = [.085 * look.head, W * .34 * look.head, H * .36]
  const headC: V3 = [.3, 0, LEG_H + H * .46]
  const head: Prim[] = [{ c: headC, r: headR, m: I3, mat: 'pron' }]
  if (look.ears) {
    for (const s of [1, -1]) head.push({ c: [headC[0] - headR[0] * .1, s * headR[1] * .92, headC[2] + headR[2] * .2], r: [headR[0] * .5, headR[1] * .3, headR[2] * .7], m: I3, mat: 'pron' })
  }
  return {
    pronC, pronR, headC, headR, liftPivot: [.06, 0, LEG_H + H * .5], headPivot: [headC[0] - headR[0], 0, headC[2]],
    base: [
      { c: [-.1, 0, LEG_H + H * .25], r: [.38, W * .4, H * .25], m: I3, mat: 'belly' },
      { c: elyC, r: elyR, m: I3, mat: 'elytra', pattern: true },
    ],
    pron: { c: pronC, r: pronR, m: I3, mat: 'pron' },
    head,
  }
}

function anchorOf(frame: Frame, root: Limb['root']): V3 {
  if (root === 'pron') return [frame.pronC[0] + frame.pronR[0] * .55, 0, frame.pronC[2] + frame.pronR[2] * .78]
  return [frame.headC[0] + frame.headR[0] * .75, 0, frame.headC[2] + frame.headR[2] * .1]
}

/** ツノ・あご 1ぽん。side は 1（ひだり）か -1（みぎ）。 */
function limb(spec: Limb, anchor: V3, side: 1 | -1, mat: MatKey, out: Prim[], scaleR = 1) {
  const pts = spec.path.map(p => add(anchor, [p[0], p[1] * side, p[2]]))
  const r0 = spec.r[0] * scaleR, r1 = spec.r[1] * scaleR
  chain(pts, r0, r1, mat, out)
  const tip = pts[pts.length - 1]
  const dir = norm(sub(tip, spline(pts, .9)))
  if (spec.fork) {
    if (Math.abs(spec.path[spec.path.length - 1][1]) < .02) {
      // まんなかの ツノ: さきが ひだり・みぎに わかれる。
      for (const s of [1, -1]) {
        const prong = add(tip, mul(norm(add(dir, [0, s * .9, .25])), spec.fork))
        out.push(segment(tip, prong, r1 * .85, mat))
      }
    } else {
      // あご: さきの すこし てまえから うえへ もう1ぽん。
      const base = spline(pts, .82)
      out.push(segment(base, add(base, mul(norm(add(dir, [0, 0, 1.4])), spec.fork)), r1 * .9, mat))
    }
  }
  for (const tooth of spec.teeth ?? []) {
    const p = spline(pts, tooth.at)
    const r = (r0 + (r1 - r0) * tooth.at) * .8
    const d: V3 = tooth.dir === 'up' ? [0, 0, 1] : tooth.dir === 'down' ? [0, 0, -1] : [0, -side, 0]
    out.push(segment(p, add(p, mul(norm(add(d, mul(dir, .25))), tooth.len)), r, mat))
  }
  if (spec.hair) {
    for (let i = 0; i < 6; i++) {
      const t = .25 + i * .1
      const p = spline(pts, t)
      const r = r0 + (r1 - r0) * t
      out.push({ c: add(p, [0, 0, -r * .75]), r: [.035, r * .75, r * .5], m: I3, mat: 'hair' })
    }
  }
}

function legs(look: Look, kuwagata: boolean, phase: number, flipped: boolean, out: Prim[]) {
  const W = look.width
  const xs = kuwagata ? [.14, -.03, -.19] : [.17, .0, -.15]
  const reach = kuwagata ? [.22, .02, -.16] : [.16, .01, -.15]
  for (let k = 0; k < 3; k++) {
    for (const s of [1, -1] as const) {
      const group = (k + (s > 0 ? 0 : 1)) % 2
      const ph = (phase + group * .5) * Math.PI * 2
      const swing = Math.sin(ph) * (flipped ? .09 : .06)
      const up = flipped ? Math.cos(ph) * .06 : Math.max(0, Math.cos(ph)) * .035
      const hip: V3 = [xs[k], s * W * .2, LEG_H + .03]
      const footX = xs[k] + reach[k] + swing
      const knee: V3 = [xs[k] + reach[k] * .45 + swing * .4, s * W * (kuwagata && k === 0 ? .46 : .44), LEG_H + .09 + up * .5]
      const foot: V3 = [footX, s * W * (k === 1 ? .7 : .62), up]
      out.push(segment(hip, knee, .024, 'leg'))
      out.push(segment(knee, foot, .018, 'leg'))
      // あしさきの つめ。
      out.push(segment(foot, add(foot, [reach[k] >= 0 ? .03 : -.03, s * .02, 0]), .012, 'leg'))
    }
  }
}

function eyes(frame: Frame, out: Prim[]) {
  const { headC, headR } = frame
  for (const s of [1, -1]) {
    out.push({ c: [headC[0] + headR[0] * .3, s * headR[1] * .86, headC[2] + headR[2] * .25], r: [.026, .022, .026], m: I3, mat: 'eye' })
  }
}

function antennae(frame: Frame, out: Prim[]) {
  const { headC, headR } = frame
  for (const s of [1, -1]) {
    const a: V3 = [headC[0] + headR[0] * .7, s * headR[1] * .7, headC[2] + headR[2] * .1]
    const b = add(a, [.06, s * .03, .03])
    out.push(segment(a, b, .01, 'leg'))
    out.push(segment(b, add(b, [.02, s * .05, -.01]), .014, 'leg'))
  }
}

function transform(p: Prim, m: M3, pivot: V3): Prim {
  return { ...p, c: add(apply(m, sub(p.c, pivot)), pivot), m: mulM(m, p.m) }
}

/** もけい（からだの ながさ=1）を つくる。ポーズも つける。 */
function buildUnit(sp: Species, pose: Pose): Prim[] {
  const look = sp.look
  const kuwagata = sp.group === 'kuwagata'
  const frame = bodyParts(look, kuwagata)
  const front: Prim[] = []
  const headParts: Prim[] = [...frame.head]
  eyes(frame, headParts)
  if (kuwagata) antennae(frame, headParts)
  for (const horn of look.horns ?? []) {
    const target = horn.root === 'head' ? headParts : front
    const anchor = anchorOf(frame, horn.root)
    limb(horn, anchor, 1, 'horn', target)
    if (Math.abs(horn.path[0][1]) > .01) limb(horn, anchor, -1, 'horn', target)
  }
  const jaws: Prim[][] = [[], []]
  if (look.jaw) {
    const jaw = look.jaw
    const anchor = anchorOf(frame, 'head')
    limb(jaw, anchor, 1, 'horn', jaws[0])
    limb(jaw, anchor, -1, 'horn', jaws[1])
    // あごを ひらく（つけねを ささえに よこへ まわす）。
    if (pose.jaw > 0) {
      for (const [i, s] of [[0, 1], [1, -1]] as const) {
        const pivot: V3 = [anchor[0] + jaw.path[0][0], s * jaw.path[0][1], anchor[2] + jaw.path[0][2]]
        const rot = mulM(rotZ(s * pose.jaw * .42), rotY(-pose.jaw * .12))
        jaws[i] = jaws[i].map(p => transform(p, rot, pivot))
      }
    }
  }
  // あたま（あたまの ツノ・あご つき）は あたまの ねもとを ささえに、むねは はねの つけねを ささえに あがる。
  let headGroup: Prim[] = [...headParts, ...jaws[0], ...jaws[1]]
  let frontGroup: Prim[] = [frame.pron, ...front]
  if (pose.lift > 0) {
    const headRot = rotY(-pose.lift * (kuwagata ? .22 : .32))
    const bodyRot = rotY(-pose.lift * (kuwagata ? .16 : .3))
    headGroup = headGroup.map(p => transform(transform(p, headRot, frame.headPivot), bodyRot, frame.liftPivot))
    frontGroup = frontGroup.map(p => transform(p, bodyRot, frame.liftPivot))
  }
  const all: Prim[] = [...frame.base, ...frontGroup, ...headGroup]
  legs(look, kuwagata, pose.leg, pose.flipped, all)
  return all
}

function extents(prims: readonly Prim[]) {
  let front = -Infinity, rear = Infinity, top = 0
  for (const p of prims) {
    // 回転した だえんたいの x・z の はば。
    const ex = Math.hypot(p.m[0] * p.r[0], p.m[1] * p.r[1], p.m[2] * p.r[2])
    const ez = Math.hypot(p.m[6] * p.r[0], p.m[7] * p.r[1], p.m[8] * p.r[2])
    front = Math.max(front, p.c[0] + ex)
    rear = Math.min(rear, p.c[0] - ex)
    top = Math.max(top, p.c[2] + ez)
  }
  return { front, rear, top }
}

const restCache = new Map<string, ReturnType<typeof extents>>()
function restExtents(sp: Species) {
  let e = restCache.get(sp.id)
  if (!e) {
    e = extents(buildUnit(sp, REST))
    restCache.set(sp.id, e)
  }
  return e
}

/** ゲームの なかでの ぜんぶの ながさ（ドット）。じっさいの 大きさの ちがいを すこし ちぢめて あらわす。 */
export const BASE_LENGTH_PX = 44
export function lengthPx(sp: Species) {
  return BASE_LENGTH_PX * Math.pow(sp.lengthMm[1] / 100, .7)
}

/** ドットの 大きさの もけいを つくる。 */
export function buildBeetle(sp: Species, pose: Pose, totalPx = lengthPx(sp)): BeetleModel {
  const rest = restExtents(sp)
  const k = totalPx / (rest.front - rest.rear)
  let prims = buildUnit(sp, pose).map(p => ({ ...p, c: mul(p.c, k), r: mul(p.r, k) }))
  if (pose.flipped) {
    // せなかを したに して ねころがる。
    const lift = rest.top * k * .78
    const m = rotX(Math.PI)
    prims = prims.map(p => {
      const moved = transform(p, m, [0, 0, 0])
      return { ...moved, c: add(moved.c, [0, 0, lift]) }
    })
  }
  return { prims, front: rest.front * k, rear: rest.rear * k, top: rest.top * k }
}

/** たたかいで つかう 大きさ（ドット）。 */
export function beetleSize(sp: Species) {
  const rest = restExtents(sp)
  const k = lengthPx(sp) / (rest.front - rest.rear)
  return { front: rest.front * k, rear: -rest.rear * k, top: rest.top * k, length: lengthPx(sp) }
}
