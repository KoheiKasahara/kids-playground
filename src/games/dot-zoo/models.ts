// どうぶつ・き・えさ などの もけい（だえんたいの くみあわせ）。
// +X が まえ、+Y が うえ、あしもとが 原点。1 が 1マスの 大きさ。
// ポーズ（あるく・たべる・ねる など）と じかん（0〜1）で すこしずつ かたちを かえて アニメに する。

import { hash3, makeRamp, valueNoise3 } from './pixel'
import { I3, mulM, rotX, rotY, rotZ, apply, add, sub, norm, type Decal, type M3, type Material, type Model, type Prim, type V3 } from './sprite3d'
import type { SpeciesId, ObjectKind, FoodKind } from './data'

export type Pose = 'idle' | 'walk' | 'eat' | 'sleep' | 'act' | 'swim'

const TAU = Math.PI * 2
const deg = (d: number) => d * Math.PI / 180

// ---------------- もけいを くみたてる どうぐ ----------------

class Builder {
  prims: Prim[] = []
  decals: Decal[] = []

  e(c: V3, r: V3, mat: string, o: { m?: M3; fuzz?: number; bump?: number } = {}) {
    this.prims.push({ c, r, mat, m: o.m, fuzz: o.fuzz, bump: o.bump })
    return this
  }

  /** だえんたいの 表面（dir の むき）に め などを つける。 */
  mark(c: V3, r: V3, dir: V3, kind: Decal['kind'], color?: string, m: M3 = I3) {
    const d = norm(apply(transpose(m), dir))
    const local: V3 = [d[0] * r[0], d[1] * r[1], d[2] * r[2]]
    this.decals.push({ p: add(c, apply(m, local)), kind, color })
    return this
  }

  /** pivot を 中心に まわした グループ。 */
  group(pivot: V3, m: M3, fn: (b: Builder) => void, move: V3 = [0, 0, 0]) {
    const sub2 = new Builder()
    fn(sub2)
    const tf = (p: V3) => add(add(pivot, apply(m, sub(p, pivot))), move)
    for (const p of sub2.prims) this.prims.push({ ...p, c: tf(p.c), m: mulM(m, p.m ?? I3) })
    for (const d of sub2.decals) this.decals.push({ ...d, p: tf(d.p) })
    return this
  }

  /** hip から したへ のびる あし。swing は まえに ふる 角度。 */
  leg(hip: V3, len: number, r: number, swing: number, mat: string, foot?: string, footK = 1.15) {
    const m = rotZ(swing)
    const down = (k: number): V3 => add(hip, apply(m, [0, -k, 0]))
    this.e(down(len * .45), [r, len * .5 + r * .2, r], mat, { m })
    if (foot) this.e(down(len - r * .45), [r * footK, r * .62, r * footK * .95], foot, { m })
    return this
  }

  model(mats: Record<string, Material>): Model {
    return { prims: this.prims, decals: this.decals, mats }
  }
}

function transpose(m: M3): M3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]
}

const ramp = (base: string, contrast = 1): readonly string[] => makeRamp(base, contrast)
const mat = (base: string, extra: Partial<Material> = {}, contrast = 1): Material => ({ ramp: ramp(base, contrast), ...extra })

// ---------------- 四つあしの どうぶつの ほね組み ----------------

type QuadSpec = {
  body: { c: V3; r: V3 }
  chest?: { c: V3; r: V3 }
  hind?: { c: V3; r: V3 }
  hipY: number
  legLen: number
  legR: number
  fx: number
  bx: number
  lz: number
  legMat: string
  footMat?: string
  footK?: number
  /** くびの つけね（あたまを まわす 中心）。 */
  pivot: V3
  head: (b: Builder, o: { closed: boolean; open: boolean }) => void
  tail?: (b: Builder, wag: number) => void
  eatAngle: number
  stride?: number
  bodyMat?: string
  /** ねる とき あたまを どれだけ さげるか。 */
  sleepHead?: number
}

function quad(spec: QuadSpec, pose: Pose, t: number) {
  const b = new Builder()
  const walk = pose === 'walk'
  const sleep = pose === 'sleep'
  const s = Math.sin(t * TAU)
  const swing = walk ? s * deg(spec.stride ?? 28) : 0
  const bob = walk ? Math.abs(Math.cos(t * TAU)) * .025 : pose === 'idle' ? Math.sin(t * TAU) * .006 : 0
  const drop = sleep ? spec.hipY - spec.legR * 1.6 : 0
  const lift: V3 = [0, bob - drop, 0]
  const bm = spec.bodyMat ?? 'body'
  const mv = (c: V3): V3 => add(c, lift)

  // あし（おくの あしから）
  const legs: [number, number, number][] = [
    [spec.fx, -spec.lz, swing], [spec.bx, -spec.lz, -swing], [spec.fx, spec.lz, -swing], [spec.bx, spec.lz, swing],
  ]
  for (const [x, z, sw] of legs) {
    if (sleep) {
      // おりたたんで からだの したへ。
      const front = x > 0
      b.leg([x + (front ? .02 : -.08), spec.legR * 1.1, z], spec.legLen * .62, spec.legR, deg(front ? 84 : 76), spec.legMat, spec.footMat, spec.footK)
    } else b.leg([x, spec.hipY + bob, z], spec.legLen + (walk ? .0 : 0), spec.legR, sw, spec.legMat, spec.footMat, spec.footK)
  }
  const breath = pose === 'idle' || sleep ? 1 + Math.sin(t * TAU) * .025 : 1
  b.e(mv(spec.body.c), [spec.body.r[0], spec.body.r[1] * breath, spec.body.r[2] * breath], bm)
  if (spec.chest) b.e(mv(spec.chest.c), spec.chest.r, bm)
  if (spec.hind) b.e(mv(spec.hind.c), spec.hind.r, bm)
  if (spec.tail) {
    const wag = pose === 'act' ? Math.sin(t * TAU * 2) : Math.sin(t * TAU) * (walk ? .6 : 1)
    b.group([0, 0, 0], I3, bb => spec.tail!(bb, sleep ? -.6 : wag), lift)
  }
  // あたま
  let angle: number
  if (pose === 'eat') angle = spec.eatAngle + Math.sin(t * TAU * 2) * deg(3)
  else if (sleep) angle = -(spec.sleepHead ?? deg(18))
  else if (pose === 'act') angle = deg(18) + Math.sin(t * TAU) * deg(4)
  else if (walk) angle = Math.cos(t * TAU * 2) * deg(2.5)
  else angle = Math.sin(t * TAU) * deg(2)
  b.group(spec.pivot, rotZ(angle), bb => spec.head(bb, { closed: sleep, open: pose === 'act' }), lift)
  return b
}

// ---------------- もよう ----------------

function stripes(freq: number, width: number, seed: number) {
  return (p: V3) => {
    const wob = (valueNoise3(p[0] * 3, p[1] * 3, p[2] * 3, seed) - .5) * 1.4
    const v = Math.sin((p[0] + p[1] * .25) * freq + wob)
    return v > 1 - width
  }
}

/** キリンの あみめ（3D の ボロノイ）。さかいめの 線なら true。 */
function giraffeLine(p: V3) {
  const k = 5.2
  const x = p[0] * k, y = p[1] * k, z = p[2] * k
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  let d1 = 9, d2 = 9
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
    const cx = xi + a + hash3(xi + a, yi + b, zi + c, 1) * .8 + .1
    const cy = yi + b + hash3(xi + a, yi + b, zi + c, 2) * .8 + .1
    const cz = zi + c + hash3(xi + a, yi + b, zi + c, 3) * .8 + .1
    const d = Math.hypot(x - cx, y - cy, z - cz)
    if (d < d1) { d2 = d1; d1 = d } else if (d < d2) d2 = d
  }
  return d2 - d1 < .2
}

// ---------------- どうぶつ ----------------

function lion(pose: Pose, t: number, tiger = false) {
  const body = tiger ? 'body' : 'body'
  const spec: QuadSpec = {
    body: { c: [-.02, .56, 0], r: [.46, .24, .22] },
    chest: { c: [.28, .58, 0], r: [.24, .25, .22] },
    hind: { c: [-.3, .57, 0], r: [.22, .24, .215] },
    hipY: .5, legLen: .48, legR: .075, fx: .3, bx: -.32, lz: .12,
    legMat: 'body', footMat: 'paw', footK: 1.25,
    pivot: [.42, .7, 0], eatAngle: -deg(38), stride: 26, bodyMat: body,
    head: (b, o) => {
      if (!tiger) b.e([.5, .78, 0], [.23, .29, .3], 'mane', { fuzz: .55, bump: .5 })
      const face: V3 = [tiger ? .56 : .62, .79, 0], fr: V3 = tiger ? [.2, .19, .2] : [.17, .17, .17]
      b.e(face, fr, tiger ? 'face' : 'body')
      if (tiger) {
        b.e([.5, .72, 0], [.12, .14, .22], 'face')
      }
      const mz: V3 = [face[0] + fr[0] * .78, .71, 0], mr: V3 = [.1, .08, .1]
      b.e(mz, mr, 'muzzle')
      if (o.open) b.e([mz[0] + .02, .63, 0], [.07, .045, .07], 'mouth')
      b.mark(mz, mr, [.8, .7, 0], 'dot', '#3a1a1a')
      const ear = (z: number) => b.e([face[0] - .05, face[1] + fr[1] * .95, z], [.055, .06, .04], tiger ? 'face' : 'ear')
      ear(-.13); ear(.13)
      for (const z of [-.5, .5]) b.mark(face, fr, [.72, .28, z], o.closed ? 'closedEye' : 'eye')
    },
    tail: (b, wag) => {
      b.group([-.46, .64, 0], mulM(rotY(wag * .35), rotZ(deg(35 + wag * 10))), bb => {
        bb.e([-.66, .64, 0], [.2, .035, .035], 'body')
        bb.e([-.86, .64, 0], [.06, .06, .06], tiger ? 'tailTip' : 'mane', { fuzz: tiger ? 0 : .3 })
      })
    },
  }
  const b = quad(spec, pose, t)
  const mats: Record<string, Material> = tiger ? {
    body: mat('#e88a2c', { pattern: (p, n) => {
      if (n[1] < -.35 || p[1] < .42) return 'belly'
      return stripes(24, .55, 4)(p) ? 'stripe' : null
    } }),
    face: mat('#ec9234', { pattern: (p, n) => (n[1] < -.2 || (p[0] > .62 && p[1] < .78)) ? 'belly' : stripes(40, .4, 9)([p[1] * 1.2, p[0], p[2]]) && p[1] > .8 ? 'stripe' : null }),
    belly: mat('#f4ead8'),
    stripe: mat('#2a1c24', {}, .6),
    muzzle: mat('#f4ead8'),
    paw: mat('#f0e2cc'),
    tailTip: mat('#2a1c24', {}, .6),
    mouth: mat('#b83a4a'),
  } : {
    body: mat('#dca659', { pattern: (_p, n) => n[1] < -.45 ? 'belly' : null }),
    belly: mat('#f0d7a0'),
    mane: mat('#a4521e', {}, 1.1),
    muzzle: mat('#f6e6c0'),
    paw: mat('#e8c68a'),
    ear: mat('#c68e48'),
    mouth: mat('#b83a4a'),
  }
  return b.model(mats)
}

function elephant(pose: Pose, t: number) {
  const b = quad({
    body: { c: [-.05, .82, 0], r: [.55, .4, .36] },
    hind: { c: [-.38, .8, 0], r: [.28, .36, .33] },
    chest: { c: [.25, .84, 0], r: [.3, .38, .34] },
    hipY: .62, legLen: .62, legR: .13, fx: .28, bx: -.36, lz: .19,
    legMat: 'body', footMat: 'toe', footK: 1.08,
    pivot: [.48, 1.02, 0], eatAngle: -deg(18), stride: 18, sleepHead: deg(10),
    head: (b, o) => {
      const head: V3 = [.66, 1.08, 0], hr: V3 = [.3, .31, .29]
      b.e(head, hr, 'body')
      // みみ（うすい だえん）
      const earM = (z: number) => rotX(z > 0 ? deg(-12) : deg(12))
      for (const z of [-1, 1]) b.e([.52, 1.12, z * .3], [.22, .28, .05], 'ear', { m: earM(z) })
      // はな（3つの つぶで カーブ）
      const up = o.open ? 1 : 0
      const trunk: [V3, number][] = up
        ? [[[.9, 1.0, 0], .1], [[1.02, 1.1, 0], .08], [[1.1, 1.24, 0], .065]]
        : [[[.9, .92, 0], .1], [[.96, .74, 0], .085], [[.98, .56, 0], .07]]
      for (const [c, r] of trunk) b.e(c, [r, r * 1.25, r], 'body')
      for (const z of [-1, 1]) b.e([.86, .86, z * .12], [.1, .03, .03], 'tusk', { m: rotZ(deg(-30)) })
      for (const z of [-.55, .55]) b.mark(head, hr, [.7, .35, z], o.closed ? 'closedEye' : 'eye')
    },
    tail: (b, wag) => {
      b.group([-.62, .92, 0], mulM(rotY(wag * .3), rotZ(deg(70))), bb => {
        bb.e([-.76, .92, 0], [.16, .025, .025], 'body')
        bb.e([-.93, .92, 0], [.035, .04, .035], 'toe')
      })
    },
  }, pose, t)
  return b.model({
    body: mat('#9aa0b4', { pattern: (_p, n) => n[1] < -.5 ? 'under' : null }),
    under: mat('#7c8098'),
    ear: mat('#a8a2bc'),
    tusk: mat('#fff6e4'),
    toe: mat('#5e6070'),
  })
}

function giraffe(pose: Pose, t: number) {
  const b = quad({
    body: { c: [0, 1.28, 0], r: [.44, .26, .2] },
    chest: { c: [.24, 1.3, 0], r: [.24, .28, .2] },
    hipY: 1.2, legLen: 1.2, legR: .065, fx: .26, bx: -.3, lz: .11,
    legMat: 'gleg', footMat: 'hoof', footK: 1.1,
    pivot: [.34, 1.42, 0], eatAngle: -deg(88), stride: 22, sleepHead: deg(40),
    head: (b, o) => {
      // ながい くび
      b.e([.52, 1.9, 0], [.12, .52, .1], 'body', { m: rotZ(deg(-24)) })
      b.e([.58, 1.7, 0], [.05, .42, .03], 'maneG', { m: rotZ(deg(-24)) })
      b.group([.72, 2.36, 0], rotZ(deg(-10)), bb => {
        const head: V3 = [.76, 2.38, 0], hr: V3 = [.15, .13, .12]
        bb.e(head, hr, 'bodyHead')
        bb.e([.92, 2.32, 0], [.1, .08, .085], 'muzzle')
        bb.mark([.92, 2.32, 0], [.1, .08, .085], [.9, .3, .3], 'dot', '#3a2418')
        for (const z of [-1, 1]) {
          bb.e([.72, 2.52, z * .05], [.02, .07, .02], 'hoof')
          bb.e([.72, 2.6, z * .05], [.03, .03, .03], 'hoof')
          bb.e([.66, 2.46, z * .13], [.07, .03, .025], 'bodyHead', { m: rotY(z * deg(-20)) })
        }
        for (const z of [-.55, .55]) bb.mark(head, hr, [.55, .4, z], o.closed ? 'closedEye' : 'eye')
      })
    },
    tail: (b, wag) => {
      b.group([-.42, 1.38, 0], mulM(rotY(wag * .3), rotZ(deg(70))), bb => {
        bb.e([-.58, 1.38, 0], [.18, .025, .025], 'body')
        bb.e([-.78, 1.38, 0], [.04, .06, .04], 'maneG')
      })
    },
  }, pose, t)
  const pattern = (p: V3, n: V3) => (n[1] < -.6 ? null : giraffeLine(p) ? null : 'spot')
  return b.model({
    body: mat('#f6dca0', { pattern }),
    gleg: mat('#f6dca0', { flat: .55, pattern: (p, n) => p[1] > .95 ? pattern(p, n) : null }),
    bodyHead: mat('#f6dca0'),
    spot: mat('#c8703a'),
    maneG: mat('#8c4a26'),
    muzzle: mat('#e8c890'),
    hoof: mat('#5a3a2a'),
  })
}

function zebra(pose: Pose, t: number) {
  const b = quad({
    body: { c: [0, .72, 0], r: [.44, .22, .2] },
    chest: { c: [.26, .74, 0], r: [.22, .24, .19] },
    hind: { c: [-.28, .74, 0], r: [.2, .23, .19] },
    hipY: .66, legLen: .64, legR: .06, fx: .28, bx: -.3, lz: .1,
    legMat: 'leg', footMat: 'hoof', footK: 1.1,
    pivot: [.38, .86, 0], eatAngle: -deg(48), stride: 26,
    head: (b, o) => {
      b.e([.5, 1.0, 0], [.1, .24, .09], 'body', { m: rotZ(deg(-35)) })
      b.e([.46, 1.06, 0], [.045, .22, .03], 'mane', { m: rotZ(deg(-35)) })
      const head: V3 = [.66, 1.16, 0], hr: V3 = [.2, .1, .09]
      b.group(head, rotZ(deg(-38)), bb => {
        bb.e(head, hr, 'face')
        bb.e([.82, 1.16, 0], [.08, .085, .085], 'nose')
        for (const z of [-1, 1]) bb.e([.56, 1.26, z * .06], [.03, .07, .025], 'face', { m: rotX(z * deg(15)) })
        for (const z of [-.5, .5]) bb.mark(head, hr, [.2, .5, z], o.closed ? 'closedEye' : 'eye')
      })
    },
    tail: (b, wag) => {
      b.group([-.44, .82, 0], mulM(rotY(wag * .3), rotZ(deg(65))), bb => {
        bb.e([-.58, .82, 0], [.16, .025, .025], 'body')
        bb.e([-.76, .82, 0], [.05, .06, .04], 'mane')
      })
    },
  }, pose, t)
  const st = stripes(30, .75, 3)
  return b.model({
    body: mat('#f4f2f0', { pattern: (p, n) => n[1] < -.7 ? null : st([p[0], p[1] * .6, p[2]]) ? 'stripe' : null }),
    face: mat('#f4f2f0', { pattern: p => st([p[1] * 1.4, p[0] * .3, p[2]]) ? 'stripe' : null }),
    leg: mat('#f4f2f0', { pattern: p => Math.sin(p[1] * 42) > .25 ? 'stripe' : null }),
    stripe: mat('#2c2638', {}, .5),
    mane: mat('#2c2638', {}, .5),
    nose: mat('#3c3440', {}, .6),
    hoof: mat('#3c3440', {}, .6),
  })
}

function hippo(pose: Pose, t: number) {
  const b = quad({
    body: { c: [-.05, .5, 0], r: [.56, .32, .34] },
    chest: { c: [.22, .5, 0], r: [.3, .31, .32] },
    hipY: .36, legLen: .36, legR: .11, fx: .26, bx: -.34, lz: .19,
    legMat: 'body', footMat: 'toe', footK: 1.02,
    pivot: [.44, .58, 0], eatAngle: -deg(16), stride: 16, sleepHead: deg(6),
    head: (b, o) => {
      const head: V3 = [.6, .62, 0], hr: V3 = [.26, .24, .25]
      b.e(head, hr, 'body')
      const snout: V3 = [.84, .52, 0], sr: V3 = [.2, .17, .24]
      b.group(o.open ? [.72, .56, 0] : [0, 0, 0], o.open ? rotZ(deg(22)) : I3, bb => {
        bb.e(snout, sr, 'snout')
        for (const z of [-1, 1]) bb.mark(snout, sr, [.6, .7, z * .4], 'dot', '#4a2a3a')
      })
      if (o.open) {
        b.e([.84, .42, 0], [.18, .08, .2], 'snout')
        b.e([.84, .48, 0], [.16, .06, .17], 'mouth')
        for (const z of [-1, 1]) b.e([.94, .5, z * .12], [.02, .04, .02], 'tooth')
      }
      for (const z of [-1, 1]) b.e([.54, .84, z * .15], [.045, .05, .04], 'ear')
      for (const z of [-.55, .55]) b.mark(head, hr, [.45, .65, z], o.closed ? 'closedEye' : 'eye')
    },
    tail: (b, wag) => b.e([-.62, .55 + wag * .02, wag * .04], [.06, .04, .04], 'body'),
  }, pose, t)
  return b.model({
    body: mat('#8c7ea8', { pattern: (_p, n) => n[1] < -.4 ? 'belly' : null }),
    belly: mat('#c69ab0'),
    snout: mat('#a898bc', { pattern: (_p, n) => n[1] < -.3 ? 'belly' : null }),
    ear: mat('#c69ab0'),
    toe: mat('#6a5e84'),
    mouth: mat('#d0607a'),
    tooth: mat('#fff8ec'),
  })
}

function panda(pose: Pose, t: number) {
  const b = quad({
    body: { c: [-.02, .5, 0], r: [.36, .28, .27] },
    hind: { c: [-.2, .48, 0], r: [.22, .26, .26] },
    hipY: .36, legLen: .36, legR: .1, fx: .2, bx: -.22, lz: .15,
    legMat: 'black', footMat: 'black', footK: 1.05,
    pivot: [.28, .62, 0], eatAngle: -deg(22), stride: 20, sleepHead: deg(10),
    head: (b, o) => {
      const head: V3 = [.46, .74, 0], hr: V3 = [.24, .22, .24]
      b.e(head, hr, 'white')
      b.e([.66, .68, 0], [.08, .07, .09], 'white')
      b.mark([.66, .68, 0], [.08, .07, .09], [.9, .4, 0], 'dot')
      for (const z of [-1, 1]) {
        b.e([.4, .94, z * .16], [.07, .07, .05], 'black')
        b.e([.6, .78, z * .1], [.06, .07, .05], 'black', { m: rotZ(deg(30)) })
        b.mark([.6, .78, z * .1], [.06, .07, .05], [.7, .1, z * .7], o.closed ? 'closedEye' : 'shine', o.closed ? '#f8f8f8' : '#f8f8f8')
      }
    },
    tail: (b) => b.e([-.4, .58, 0], [.06, .06, .06], 'white'),
  }, pose, t)
  return b.model({
    white: mat('#f2f0ec'),
    body: mat('#f2f0ec', { pattern: p => p[0] > -.02 && p[0] < .2 && p[1] > .32 ? 'black' : null }),
    black: mat('#34303e', {}, .6),
  })
}

function monkey(pose: Pose, t: number) {
  const b = quad({
    body: { c: [0, .42, 0], r: [.24, .17, .15] },
    hind: { c: [-.14, .42, 0], r: [.15, .17, .15] },
    hipY: .36, legLen: .38, legR: .05, fx: .16, bx: -.16, lz: .09,
    legMat: 'body', footMat: 'skin', footK: 1.1,
    pivot: [.2, .52, 0], eatAngle: -deg(30), stride: 30,
    head: (b, o) => {
      const head: V3 = [.32, .64, 0], hr: V3 = [.16, .15, .15]
      b.e(head, hr, 'body')
      const face: V3 = [.42, .62, 0], fr: V3 = [.09, .11, .1]
      b.e(face, fr, 'skin')
      b.e([.48, .56, 0], [.06, .045, .065], 'skin')
      for (const z of [-1, 1]) {
        b.e([.3, .66, z * .16], [.045, .06, .03], 'skin')
      }
      for (const z of [-.45, .45]) b.mark(face, fr, [.8, .45, z], o.closed ? 'closedEye' : 'eye')
      if (o.open) b.e([.51, .53, 0], [.03, .025, .035], 'mouth')
    },
    tail: (b, wag) => {
      b.group([-.22, .5, 0], rotY(wag * .3), bb => {
        bb.e([-.32, .62, 0], [.03, .14, .03], 'body', { m: rotZ(deg(30)) })
        bb.e([-.38, .8, 0], [.07, .03, .03], 'body', { m: rotZ(deg(-10)) })
        bb.e([-.3, .82, 0], [.03, .04, .03], 'body')
      })
    },
  }, pose, t)
  return b.model({
    body: mat('#8a5a36'),
    skin: mat('#f0c29a'),
    mouth: mat('#a03040'),
  })
}

function rabbit(pose: Pose, t: number) {
  const b = new Builder()
  const hop = pose === 'walk' ? Math.max(0, Math.sin(t * TAU)) * .16 : pose === 'act' ? Math.max(0, Math.sin(t * TAU)) * .3 : 0
  const sleep = pose === 'sleep'
  const stretch = pose === 'walk' ? Math.sin(t * TAU) * deg(10) : 0
  b.group([0, .2, 0], rotZ(stretch), bb => {
    const y = hop + (sleep ? -.04 : 0)
    bb.e([-.02, .2 + y, 0], [.22, .17, .17], 'body')
    bb.e([-.14, .18 + y, 0], [.16, .15, .16], 'body')
    for (const z of [-1, 1]) {
      bb.e([-.1, .06 + y, z * .1], [.12, .05, .05], 'body')
      bb.e([.12, .06 + y + (pose === 'walk' ? -.02 : 0), z * .07], [.05, .06, .04], 'body')
    }
    bb.e([-.25, .26 + y, 0], [.06, .06, .06], 'white')
    const eat = pose === 'eat' ? -deg(24) + Math.sin(t * TAU * 3) * deg(3) : sleep ? -deg(10) : 0
    bb.group([.1, .3 + y, 0], rotZ(eat), hb => {
      const head: V3 = [.2, .38 + y, 0], hr: V3 = [.13, .12, .12]
      hb.e(head, hr, 'body')
      hb.e([.3, .33 + y, 0], [.05, .045, .06], 'white')
      hb.mark([.3, .33 + y, 0], [.05, .045, .06], [.9, .5, 0], 'dot', '#d06080')
      const earTilt = sleep ? deg(-70) : deg(-8)
      for (const z of [-1, 1]) {
        hb.e([.16, .56 + y, z * .05], [.035, .15, .03], 'body', { m: mulM(rotZ(earTilt), rotX(z * deg(10))) })
        hb.e([.165, .56 + y, z * .058], [.018, .11, .018], 'earIn', { m: mulM(rotZ(earTilt), rotX(z * deg(10))) })
      }
      for (const z of [-.5, .5]) hb.mark(head, hr, [.6, .35, z], sleep ? 'closedEye' : 'eye')
    })
  })
  return b.model({
    body: mat('#e8dcd0', { pattern: (_p, n) => n[1] < -.5 ? 'white' : null }),
    white: mat('#fbf8f2'),
    earIn: mat('#f0a8b8'),
  })
}

function penguin(pose: Pose, t: number) {
  const b = new Builder()
  const swim = pose === 'swim'
  const walk = pose === 'walk'
  const roll = walk ? Math.sin(t * TAU) * deg(10) : 0
  const flap = pose === 'act' ? Math.sin(t * TAU * 3) * deg(40) : walk ? deg(10) : swim ? Math.sin(t * TAU) * deg(20) : deg(4)
  const sleep = pose === 'sleep'
  const tilt = swim ? rotZ(deg(-62)) : sleep ? rotZ(deg(-8)) : I3
  const base: V3 = swim ? [0, -.02, 0] : [0, 0, 0]
  b.group([0, .3, 0], mulM(tilt, rotX(roll)), bb => {
    bb.e([0, .32, 0], [.18, .3, .17], 'body')
    const head: V3 = [.02, .66, 0], hr: V3 = [.14, .13, .13]
    bb.e(head, hr, 'body')
    bb.e([.17, .63, 0], [.07, .03, .035], 'beak')
    for (const z of [-1, 1]) {
      bb.group([0, .52, z * .16], rotX(z * flap), fb => fb.e([-.02, .36, z * .17], [.05, .18, .025], 'body', { m: rotZ(deg(10)) }))
      if (!swim) bb.e([.08, .02, z * .07], [.08, .025, .05], 'beak')
      bb.mark(head, hr, [.62, .3, z * .55], sleep ? 'closedEye' : 'eye')
      bb.mark(head, hr, [.5, .15, z * .75], 'dot', '#f08aa0')
    }
  }, base)
  return b.model({
    body: mat('#384058', { pattern: (p, n) => (n[0] > .25 && p[1] < .68 && p[1] > .08) || (n[0] > .45 && p[1] < .74) ? 'belly' : null }, .7),
    belly: mat('#f8f6f0'),
    beak: mat('#f4a030'),
  })
}

export function animalModel(id: SpeciesId, pose: Pose, t: number): Model {
  switch (id) {
    case 'lion': return lion(pose, t)
    case 'tiger': return lion(pose, t, true)
    case 'elephant': return elephant(pose, t)
    case 'giraffe': return giraffe(pose, t)
    case 'zebra': return zebra(pose, t)
    case 'hippo': return hippo(pose, t)
    case 'panda': return panda(pose, t)
    case 'monkey': return monkey(pose, t)
    case 'rabbit': return rabbit(pose, t)
    case 'penguin': return penguin(pose, t)
  }
}

// ---------------- き・いわ など ----------------

function tree(seed: number) {
  const b = new Builder()
  b.e([0, .45, 0], [.09, .5, .09], 'trunk', { bump: .3 })
  b.e([0, .08, 0], [.16, .1, .16], 'trunk')
  b.e([.1, .8, .05], [.04, .2, .04], 'trunk', { m: rotZ(deg(-40)) })
  const blobs: [V3, number][] = [
    [[0, 1.25, 0], .42], [[.22, 1.1, .18], .3], [[-.2, 1.08, -.2], .3], [[-.18, 1.12, .22], .28],
    [[.2, 1.14, -.2], .28], [[0, 1.52, 0], .28], [[.05, .98, .02], .3],
  ]
  blobs.forEach(([c, r], i) => {
    const j = hash3(seed, i, 3, 4) * .06
    b.e([c[0] + j, c[1], c[2] - j], [r, r * .88, r], 'leaf', { fuzz: .75, bump: .9 })
  })
  for (let i = 0; i < 5; i++) {
    const a = hash3(seed, i, 9) * TAU
    if (hash3(seed, i, 2) > .5) b.e([Math.cos(a) * .36, 1.0 + hash3(seed, i, 5) * .4, Math.sin(a) * .36], [.045, .045, .045], 'fruit')
  }
  return b.model({
    trunk: mat('#8a5a3a', { pattern: p => Math.sin(p[1] * 40 + Math.sin(p[0] * 30) * 2) > .7 ? 'bark' : null }),
    bark: mat('#6a4028'),
    leaf: mat('#4f9e3c', { pattern: p => valueNoise3(p[0] * 8, p[1] * 8, p[2] * 8, 5) > .72 ? 'leaf2' : null }, 1.15),
    leaf2: mat('#78bc48', {}, 1.1),
    fruit: mat('#e8483a'),
  })
}

function palm(seed: number) {
  const b = new Builder()
  for (let i = 0; i < 6; i++) {
    const y = .14 + i * .26
    b.e([Math.sin(i * .5) * .05 + i * .02, y, 0], [.085 - i * .004, .15, .085 - i * .004], 'trunk')
  }
  const top: V3 = [.14, 1.62, 0]
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + hash3(seed, i, 1) * .4
    const m = mulM(rotY(a), rotZ(deg(-28)))
    const dir = apply(m, [1, 0, 0])
    b.e(add(top, [dir[0] * .42, dir[1] * .42 - .02, dir[2] * .42]), [.44, .035, .12], 'frond', { m, fuzz: .5 })
  }
  b.e(top, [.1, .08, .1], 'frond')
  for (let i = 0; i < 3; i++) b.e(add(top, [Math.cos(i * 2) * .07, -.1, Math.sin(i * 2) * .07]), [.05, .05, .05], 'coco')
  return b.model({
    trunk: mat('#a67a4c', { pattern: p => (p[1] * 7) % 1 < .2 ? 'ring' : null }),
    ring: mat('#7c5634'),
    frond: mat('#58ac44', {}, 1.1),
    coco: mat('#6a4a2a'),
  })
}

function bamboo(seed: number) {
  const b = new Builder()
  const stalks: [number, number, number][] = [[0, 0, 1.6], [.18, .12, 1.3], [-.14, .16, 1.45], [.1, -.18, 1.2]]
  stalks.forEach(([x, z, h], i) => {
    const seg = 5
    for (let k = 0; k < seg; k++) b.e([x, (k + .5) * h / seg, z], [.045, h / seg * .5, .045], 'stalk')
    for (let k = 0; k < 3; k++) {
      const a = hash3(seed, i, k) * TAU
      const m = mulM(rotY(a), rotZ(deg(-30)))
      const d = apply(m, [1, 0, 0])
      b.e([x + d[0] * .16, h * (.55 + k * .18) + d[1] * .16, z + d[2] * .16], [.16, .02, .05], 'bleaf', { m })
    }
  })
  return b.model({
    stalk: mat('#7cc05a', { pattern: p => ((p[1] * 3.2) % 1) < .12 ? 'node' : null }),
    node: mat('#4e8a3c'),
    bleaf: mat('#5aa848', {}, 1.1),
  })
}

function bush(seed: number) {
  const b = new Builder()
  const blobs: [V3, number][] = [[[0, .22, 0], .3], [[.18, .18, .12], .22], [[-.16, .18, -.1], .22], [[-.1, .2, .16], .2], [[.12, .2, -.16], .2], [[0, .38, 0], .2]]
  blobs.forEach(([c, r]) => b.e(c, [r, r * .85, r], 'leaf', { fuzz: .7, bump: .9 }))
  for (let i = 0; i < 6; i++) {
    const a = hash3(seed, i, 8) * TAU
    b.e([Math.cos(a) * .26, .2 + hash3(seed, i, 4) * .2, Math.sin(a) * .26], [.035, .035, .035], 'flower')
  }
  return b.model({
    leaf: mat('#3f8a3a', { pattern: p => valueNoise3(p[0] * 9, p[1] * 9, p[2] * 9, 3) > .7 ? 'leaf2' : null }, 1.15),
    leaf2: mat('#66ac48'),
    flower: mat('#f4f0ff'),
  })
}

function rock(seed: number) {
  const b = new Builder()
  b.e([0, .2, 0], [.36, .28, .3], 'rock', { bump: .5, m: rotY(seed) })
  b.e([.18, .14, .14], [.2, .16, .18], 'rock', { bump: .5 })
  b.e([-.2, .12, -.08], [.18, .13, .18], 'rock', { bump: .5 })
  b.e([-.05, .42, .02], [.18, .1, .16], 'moss', { bump: .6, fuzz: .3 })
  return b.model({
    rock: mat('#9a94a4', { pattern: p => valueNoise3(p[0] * 6, p[1] * 6, p[2] * 6, 2) > .68 ? 'rock2' : null }, 1.1),
    rock2: mat('#7c7688'),
    moss: mat('#7aa050'),
  })
}

function flowers(seed: number) {
  const b = new Builder()
  const colors = ['red', 'yellow', 'pink', 'white']
  for (let i = 0; i < 9; i++) {
    const x = (hash3(seed, i, 1) - .5) * .7, z = (hash3(seed, i, 2) - .5) * .7
    const h = .1 + hash3(seed, i, 3) * .08
    b.e([x, h / 2, z], [.015, h / 2, .015], 'stem')
    b.e([x + .03, .03, z], [.05, .02, .03], 'stem')
    b.e([x, h + .02, z], [.045, .035, .045], colors[i % 4])
  }
  return b.model({
    stem: mat('#4a9a3c'),
    red: mat('#ea4a5a'),
    yellow: mat('#f8d040'),
    pink: mat('#f890c0'),
    white: mat('#f4f4ff'),
  })
}

function lamp() {
  const b = new Builder()
  b.e([0, .05, 0], [.12, .05, .12], 'iron')
  b.e([0, .5, 0], [.035, .48, .035], 'iron')
  b.e([0, 1.02, 0], [.11, .1, .11], 'glass')
  b.e([0, 1.14, 0], [.13, .04, .13], 'iron')
  b.e([0, .9, 0], [.09, .02, .09], 'iron')
  return b.model({ iron: mat('#3c3a4c', {}, .8), glass: mat('#ffe890', { flat: .3 }) })
}

export function objectModel(kind: ObjectKind, seed = 1): Model {
  switch (kind) {
    case 'tree': return tree(seed)
    case 'palm': return palm(seed)
    case 'bamboo': return bamboo(seed)
    case 'bush': return bush(seed)
    case 'rock': return rock(seed)
    case 'flowers': return flowers(seed)
    case 'lamp': return lamp()
    case 'pond': return rock(seed)
  }
}

// ---------------- えさ ----------------

export function foodModel(kind: FoodKind, left = 1): Model {
  const b = new Builder()
  const k = .6 + left * .4
  if (kind === 'meat') {
    b.e([0, .1, 0], [.17 * k, .1 * k, .13 * k], 'meat')
    b.e([.2, .1, 0], [.1, .03, .03], 'bone')
    b.e([.3, .12, .03], [.04, .04, .04], 'bone')
    b.e([.3, .08, -.03], [.04, .04, .04], 'bone')
    return b.model({ meat: mat('#c8483e', { pattern: (_p, n) => n[1] > .75 ? 'fat' : null }), fat: mat('#f09080'), bone: mat('#f8f0e0') })
  }
  if (kind === 'fish') {
    b.e([0, .08, 0], [.18 * k, .07, .06], 'fish')
    b.e([-.2, .08, 0], [.07, .06, .015], 'fin')
    b.mark([0, .08, 0], [.18 * k, .07, .06], [.8, .3, .5], 'eye')
    b.mark([0, .08, 0], [.18 * k, .07, .06], [.8, .3, -.5], 'eye')
    return b.model({ fish: mat('#7ab8e8', { pattern: (_p, n) => n[1] < -.2 ? 'belly' : null }), belly: mat('#e8f4fc'), fin: mat('#5a8ac8') })
  }
  if (kind === 'grass') {
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU
      const m = mulM(rotY(a), rotZ(deg(70)))
      b.e([Math.cos(a) * .06, .12 * k, -Math.sin(a) * .06], [.018, .14 * k, .03], i % 2 ? 'grass' : 'grass2', { m })
    }
    b.e([0, .06, 0], [.16 * k, .07 * k, .16 * k], 'grass', { fuzz: .5, bump: .8 })
    return b.model({ grass: mat('#6cb848'), grass2: mat('#a8d858') })
  }
  // くだもの（りんごと バナナ）
  b.e([0, .1, 0], [.11 * k, .1 * k, .11 * k], 'apple')
  b.e([0, .21, 0], [.012, .03, .012], 'stem')
  b.e([.03, .22, 0], [.03, .01, .02], 'leaf')
  if (left > .5) b.e([.14, .05, .1], [.14, .04, .05], 'banana', { m: rotY(deg(30)) })
  return b.model({ apple: mat('#e84040'), stem: mat('#6a4a2a'), leaf: mat('#58ac44'), banana: mat('#f8d850') })
}

// ---------------- そのほか ----------------

export function poopModel(): Model {
  const b = new Builder()
  b.e([0, .05, 0], [.1, .05, .1], 'poop')
  b.e([0, .11, 0], [.07, .04, .07], 'poop')
  b.e([.01, .16, 0], [.035, .03, .035], 'poop')
  return b.model({ poop: mat('#8a5a34') })
}

/** おきゃくさん（こどもと おとな）。 */
export function visitorModel(seed: number, t: number, walking: boolean): Model {
  const b = new Builder()
  const shirts = ['#e05050', '#4a8ae0', '#f0c030', '#50b070', '#c060d0', '#f08040']
  const hairs = ['#3a2418', '#6a3a1a', '#1c1c28', '#b07030']
  const skin = ['#f4c8a0', '#e0a878', '#c08058'][Math.floor(hash3(seed, 1, 1) * 3)]
  const kid = hash3(seed, 2, 2) > .45
  const k = kid ? .8 : 1.05
  const sw = walking ? Math.sin(t * TAU) * deg(28) : 0
  for (const z of [-1, 1]) b.leg([0, .3 * k, z * .06 * k], .3 * k, .04 * k, z * sw, 'pants', 'shoe', 1.2)
  b.e([0, .44 * k, 0], [.11 * k, .16 * k, .12 * k], 'shirt')
  for (const z of [-1, 1]) b.group([0, .56 * k, z * .13 * k], rotZ(-z * sw * .8), bb => bb.e([0, .44 * k, z * .14 * k], [.035 * k, .12 * k, .035 * k], 'shirt'))
  const head: V3 = [0, .72 * k, 0], hr: V3 = [.13 * k, .13 * k, .13 * k]
  b.e(head, hr, 'skin')
  b.e([-.03 * k, .78 * k, 0], [.13 * k, .1 * k, .135 * k], 'hair')
  if (hash3(seed, 3, 3) > .6) b.e([0, .86 * k, 0], [.15 * k, .03 * k, .15 * k], 'hat')
  for (const z of [-.45, .45]) b.mark(head, hr, [.8, 0, z], 'eye')
  return b.model({
    shirt: mat(shirts[Math.floor(hash3(seed, 4, 4) * shirts.length)]),
    pants: mat(['#3a4a7a', '#5a4a3a', '#6a6a78'][Math.floor(hash3(seed, 5, 5) * 3)]),
    shoe: mat('#3a2a2a'),
    skin: mat(skin),
    hair: mat(hairs[Math.floor(hash3(seed, 6, 6) * hairs.length)]),
    hat: mat('#f8e8a0'),
  })
}

/** さくの 1マスぶん（+X の むきに ながい）。 */
export function fenceModel(): Model {
  const b = new Builder()
  b.e([-.5, .26, 0], [.05, .27, .05], 'post')
  b.e([-.5, .55, 0], [.06, .03, .06], 'post')
  b.e([0, .38, 0], [.5, .03, .025], 'rail')
  b.e([0, .18, 0], [.5, .03, .025], 'rail')
  return b.model({ post: mat('#8a5c38'), rail: mat('#b07c48') })
}

/** さくの かどの はしら。 */
export function postModel(): Model {
  const b = new Builder()
  b.e([0, .28, 0], [.06, .29, .06], 'post')
  b.e([0, .58, 0], [.075, .035, .075], 'post')
  return b.model({ post: mat('#8a5c38') })
}

/** ホタルや ちょうちょ など ちいさな もの は 絵の がわで かく。ここは テスト用に ぜんぶの 種類を かえす。 */
export const ALL_POSES: Pose[] = ['idle', 'walk', 'eat', 'sleep', 'act', 'swim']

export { hash3 }
export const _internal = { giraffeLine, rotX }
