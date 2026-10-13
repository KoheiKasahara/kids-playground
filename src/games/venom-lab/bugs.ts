// クモ・ハチ・ムカデ・サソリ・トカゲ。あしの ある なかまは、あるくと あしが じゅんばんに うごく。

import { key, wave } from './keys'
import type { Builder } from './pose'
import { bump, frac, hash, lerp, noise, TAU, type Mat, type Model, type Pattern, type Pt } from './raster'

/** あるく あしの いち。0〜1 の まえ半分で うかせて まえへ、うしろ半分で じめんを けって うしろへ。 */
function stride(phase: number, len: number, lift: number) {
  const p = ((phase % 1) + 1) % 1
  return p < .4 ? { x: lerp(len, -len, p / .4), up: Math.sin((p / .4) * Math.PI) * lift } : { x: lerp(-len, len, (p - .4) / .6), up: 0 }
}

function jointLeg(m: Model, hip: Pt, knee: Pt, foot: Pt, r: number, z: number, mat: Mat, pat?: Pattern) {
  m.tube([hip, knee, foot], t => lerp(r, r * .55, t), { z, mat, gloss: .5, pat })
}

// ---------------- クモ ----------------

export const spider: Builder = (m, pose, sp) => {
  const { clip, t } = pose
  const widow = sp.id === 'redback'
  let threat = 0, climb = 0, breathe = 0, palp = 0
  const walk = clip === 'move' ? t : -1
  if (clip === 'idle') { breathe = wave(t, 1); palp = wave(t, 3) }
  else if (clip === 'act' && widow) climb = key(t, [[0, 0], [.4, 1], [.62, 1], [1, 0]])
  else if (clip === 'act') threat = key(t, [[0, 0], [.2, 1], [.85, 1], [1, 0]])
  const lift = climb * 13
  const tilt = threat * .35
  const rot = (x: number, y: number): Pt => {
    // おしりを じくに からだを おこす。
    const cx = 44, cy = 34, ca = Math.cos(tilt), sa = Math.sin(tilt)
    return [cx + (x - cx) * ca - (y - cy) * sa, cy + (x - cx) * sa + (y - cy) * ca - lift]
  }
  const legPat: Pattern = widow ? c => (frac(c.l / 7) < .12 ? 'B' : null) : c => (frac(c.l / 6) < .22 ? 'A' : null)
  const legMat: Mat = widow ? 'A' : 'B'
  const legR = widow ? 1.05 : 1.55
  const legs: [Pt, Pt][] = [[[12, 18], [4, 42]], [[21, 15], [15, 44]], [[40, 21], [47, 44]], [[52, 24], [60, 43]]]
  const drawLegs = (near: boolean) => legs.forEach(([knee, foot], i) => {
    const hip = rot(near ? 24 + i * 2.6 : 26 + i * 2.2, near ? 31 : 26)
    const st = walk < 0 ? { x: 0, up: 0 } : stride(walk + (i % 2) * .5 + (near ? .5 : 0), 2.4, 2.5)
    let k: Pt = near ? knee : [knee[0] + 3, knee[1] - 4]
    let f: Pt = near ? foot : [foot[0] + 3, foot[1] - 5]
    k = [k[0] + st.x * .4, k[1] - st.up * .6]
    f = [f[0] + st.x, f[1] - st.up]
    if (threat && i < 2) {
      // まえあしを たかく あげて おどかす。
      const up = threat * (i === 0 ? 1 : .8)
      k = [lerp(k[0], 14 + i * 4, up), lerp(k[1], 8 + i * 3, up)]
      f = [lerp(f[0], 6 + i * 6, up), lerp(f[1], 2 + i * 4, up)]
    }
    if (climb) {
      // いとに つかまって あしを ちぢめる。
      const hipY = hip[1]
      k = [lerp(k[0], (k[0] + hip[0]) / 2, climb * .6), lerp(k[1], hipY - 6, climb * .6)]
      f = [lerp(f[0], (f[0] + hip[0]) / 2, climb * .6), lerp(f[1] - lift, hipY + 4, climb * .7)]
    }
    jointLeg(m, hip, k, f, legR, near ? 8 : -7, legMat, legPat)
  })
  drawLegs(false)
  if (climb > .02) {
    // いと。
    const [sx, sy] = rot(46, 18)
    m.line(sx, 0, sx, sy, '#e3dccb', .85)
  }
  const [ax, ay] = rot(42, 24)
  const abd: Pattern = widow
    ? c => Math.abs(c.u + .05) < .16 && c.v < .3 && c.v > -.9 ? 'C' : null
    : c => Math.abs(c.v + .05) < .2 && c.u > -.8 ? 'C' : (noise((c.u + 1) * 5, (c.v + 1) * 5, 3) > .74 ? 'C' : null)
  m.ell(ax, ay - breathe * .3, widow ? 11 : 12, (widow ? 10.5 : 9.5) + breathe * .2, { a: -.15 + tilt, z: -1, gloss: widow ? 1.1 : .5, pat: abd })
  const [px, py] = rot(25, 28)
  m.ell(px, py, 7.5, 6, { z: 2, a: tilt, gloss: widow ? .9 : .6, pat: c => c.v < -.2 && Math.abs(c.u) < .2 ? 'B' : null })
  // きば（ドクシボグモは あかい け）。
  const fang: Mat = widow ? 'B' : 'C'
  const [c1x, c1y] = rot(18.5, 32), [c2x, c2y] = rot(21.5, 33)
  m.ell(c1x, c1y + threat, 2, 3, { z: 6, mat: fang, gloss: .6 })
  m.ell(c2x, c2y + threat, 2, 3, { z: 7, mat: fang, gloss: .6 })
  if (threat > .5) m.tube([[c1x - .5, c1y + 3.5], [c1x - 1, c1y + 5.5]], .55, { z: 8, mat: 'F' })
  // しょくし（みじかい まえの あし）。
  const [qx, qy] = rot(17, 30)
  m.tube([rot(19, 30), [qx - 3 + palp * .6, qy + 2], [qx - 4 + palp, qy + 5 - threat * 6]], .8, { z: 6, mat: legMat, gloss: .4 })
  const [e1x, e1y] = rot(20, 25.5), [e2x, e2y] = rot(23, 24.5)
  m.eye(e1x, e1y, 1.1, 8)
  m.eye(e2x, e2y, 1.1, 8.5)
  drawLegs(true)
}

// ---------------- スズメバチ ----------------

export const hornet: Builder = (m, pose) => {
  const { clip, t } = pose
  // はねは まいコマ うえ・したを いったり きたり（ぶーん）。
  const frameNo = Math.round(t * (clip === 'act' ? 23 : 16))
  const flap = frameNo % 2 ? 1 : -1
  const bob = clip === 'act' ? 0 : wave(t, 2) * .8
  const lean = clip === 'move' ? .12 : 0
  const click = clip === 'act' ? (Math.floor(t * 12) % 2) * key(t, [[0, 0], [.1, 1], [.55, 1], [.6, 0]]) : 0
  const sting = clip === 'act' ? key(t, [[0, 0], [.55, 0], [.65, 1], [.72, .6], [.8, 1], [.92, 0]]) : 0
  const R = (x: number, y: number): Pt => {
    const ca = Math.cos(lean), sa = Math.sin(lean)
    return [30 + (x - 30) * ca - (y - 24) * sa, 24 + (x - 30) * sa + (y - 24) * ca + bob]
  }
  const wingPat: Pattern = c => Math.abs(c.v + c.u * .2) < .07 || Math.abs(c.u - .1) < .05 ? 'B' : null
  const [w1x, w1y] = R(32, 12)
  m.ell(w1x, w1y + flap * 1.5, 13, 3.8, { a: -.3 - flap * .18, z: -5, mat: 'C', rz: .5, gloss: 1, pat: wingPat, glass: .5 })
  // あし。
  for (let i = 0; i < 3; i++) {
    const dang = clip === 'idle' ? wave(t, 1, i * .2) * .8 : 0
    m.tube([R(22 + i * 3, 26), R(19 + i * 4 + dang, 33), R(22 + i * 6 + dang, 40)], t2 => 1.2 - t2 * .5, { z: -3 + i, mat: 'B' })
  }
  // おなか（しましま）。さすときは まるめて はりを だす。
  const [ax, ay] = R(41, 27 + sting * 1.5)
  m.ell(ax, ay, 13, 7.5, { a: .3 + sting * .45 + lean, gloss: .7, pat: c => frac((c.u + 1) * 2.4) < .38 ? 'B' : null })
  const tipA = .3 + sting * .45 + lean
  const [sx, sy] = [ax + Math.cos(tipA) * 12.5, ay + Math.sin(tipA) * 12.5]
  m.tube([[sx, sy], [sx + Math.cos(tipA) * (2 + sting * 3), sy + Math.sin(tipA) * (2 + sting * 3)]], t2 => 1 - t2 * .7, { z: 1, mat: 'B' })
  const [nx, ny] = R(30, 23)
  m.ell(nx, ny, 2.5, 2, { z: 2, mat: 'B' })
  const [tx, ty] = R(23, 21)
  m.ell(tx, ty, 7.5, 6.5, { z: 3, mat: 'B', gloss: .7, pat: c => c.v < -.55 && Math.abs(c.u) < .5 ? 'A' : null })
  // おおきな オレンジいろの あたま。
  const [hx, hy] = R(12, 21)
  m.ell(hx, hy, 6, 6.8, { z: 4, gloss: .7 })
  m.ell(hx + 1, hy - 2.5, 3, 4.8, { z: 8, mat: 'E', gloss: .9 })
  // おおあご（カチカチ）。
  const open = click * .6
  m.ell(hx - 5.5, hy + 3.5, 2.4, 1.4, { a: .5 + open, z: 8, mat: 'B' })
  m.ell(hx - 5, hy + 5, 2.2, 1.2, { a: -.1 - open, z: 7.5, mat: 'B' })
  const ant = clip === 'idle' ? wave(t, 2) * .8 : 0
  m.tube([R(9, 15), R(6, 9 + ant), R(2, 7 + ant * 1.5)], .8, { z: 7, mat: 'B' })
  const [w2x, w2y] = R(36, 13)
  m.ell(w2x, w2y - flap * 1.5, 14, 4.2, { a: -.25 + flap * .18, z: 9, rz: .5, mat: 'C', gloss: 1, pat: wingPat, glass: .45 })
  if (click > .5) for (const [dx, dy] of [[-10, 0], [-11, 3], [-10, 6]] as const) m.dot(hx + dx, hy + dy, '#fffbe0', .9)
}

// ---------------- ムカデ ----------------

export const centipede: Builder = (m, pose) => {
  const { clip, t } = pose
  const walk = clip === 'move' ? t : -1
  const rear = clip === 'act' ? key(t, [[0, 0], [.25, 1], [.8, 1], [1, 0]]) : 0
  const segs = 17
  // からだの みち（すすむと なみが うしろへ）。
  const path = (x: number): Pt => {
    const k = (x - 10) / 50
    const raise = rear * Math.max(0, 1 - k / .35) ** 1.6 * 14
    return [x + rear * Math.max(0, 1 - k / .35) * 3, 34 + Math.sin(x * .17 + (walk < 0 ? 0 : walk * TAU)) * 2.4 - raise]
  }
  for (let i = segs - 1; i >= 0; i--) {
    const x = 12 + i * 2.9
    const [px, py] = path(x)
    const [qx, qy] = path(x + 1)
    const a = Math.atan2(qy - py, qx - px)
    for (const side of [-1, 1] as const) {
      const z = side > 0 ? 3 : -4
      const back = i === segs - 1
      // あしの なみ（となりの あしと すこしずつ ずれる）。
      const st = walk < 0 ? { x: clip === 'idle' ? wave(t, 1, i * .07) * .4 : 0, up: 0 } : stride(walk * 2 - i * .11 + (side > 0 ? .5 : 0), 1.8, 1.6)
      const foot: Pt = back ? [px + 9, py + 3 + side] : [px + 1.5 + st.x, Math.min(44, py + (side > 0 ? 9 : 6.5)) - st.up]
      m.tube([[px, py + 1.2], [px - side * .5 + (back ? 4 : 0) + st.x * .4, py + (back ? 1 : 5)], foot], t2 => .85 - t2 * .3, { z, mat: 'B' })
    }
    m.ell(px, py, 2.5, 3.1, { a, z: 0, gloss: .8, pat: c => c.u > .62 ? 'B' : null })
  }
  // あたま・どくの つめ・しょっかく。
  const [hx, hy] = path(10)
  m.ell(hx, hy - .8, 3.7, 3.4, { z: 1, mat: 'C', gloss: .8 })
  const open = rear * .8
  m.tube([[hx - 2, hy + 1.5], [hx - 5 - open, hy + 4.5], [hx - 3 - open * 2, hy + 6]], .8, { z: 3, mat: 'C' })
  m.tube([[hx - 1, hy + 2], [hx - 3.5 + open, hy + 5.5], [hx - 1 + open, hy + 6.5]], .7, { z: -1, mat: 'C' })
  const sway = clip === 'idle' ? wave(t, 1) : clip === 'act' ? wave(t, 4) * rear : wave(t, 2) * .5
  for (const [z, dy] of [[-2, -1], [3, 1]] as const) m.tube([[hx - 2, hy - 3], [hx - 7, hy - 7 + dy + sway], [hx - 9, hy - 13 + dy + sway * 2]], t2 => .7 - t2 * .3, { z, mat: 'C' })
}

// ---------------- サソリ ----------------

type ScorpLook = { claw: number; tail: number; hair: boolean }
const SCORP: Record<string, ScorpLook> = {
  'bark-scorpion': { claw: .8, tail: .85, hair: false },
  deathstalker: { claw: .75, tail: 1, hair: false },
  'hairy-scorpion': { claw: 1.15, tail: 1.1, hair: true },
}

export const scorpion: Builder = (m, pose, sp) => {
  const look = SCORP[sp.id] ?? SCORP.deathstalker
  const { clip, t } = pose
  const walk = clip === 'move' ? t : -1
  let jab = 0, snap = 0, dig = 0, sway = 0
  if (clip === 'idle') sway = wave(t, 1)
  else if (clip === 'act' && sp.id === 'bark-scorpion') jab = key(t, [[0, 0], [.25, -.4], [.4, 1], [.5, 1], [.62, -.2], [.72, 1], [.8, 1], [1, 0]])
  else if (clip === 'act' && sp.id === 'deathstalker') snap = Math.max(bump(t, .1, .3), bump(t, .35, .55), bump(t, .6, .8))
  else if (clip === 'act') dig = key(t, [[0, 0], [.1, 1], [.9, 1], [1, 0]])
  const seg = (n: number): Pattern => c => frac(c.t * n) < .14 ? 'B' : null
  const hairs = (x: number, y: number) => { if (look.hair) m.dot(x, y, '#fff6c8', .75) }
  const legs = (z: number, dy: number, near: boolean) => {
    for (let i = 0; i < 4; i++) {
      const x = 22 + i * 4
      const st = walk < 0 ? { x: dig ? Math.sin(t * TAU * 6 + i) * 1.5 * (i < 2 ? 1 : 0) : 0, up: dig && i < 2 ? Math.max(0, Math.sin(t * TAU * 6 + i)) * 2 : 0 } : stride(walk * 2 + (i % 2) * .5 + (near ? .5 : 0), 2, 1.8)
      const knee: Pt = [x + 3 + i + st.x * .3, 28 + dy - st.up * .4]
      const foot: Pt = [x + 5 + i * 2 + st.x, 43 + dy * .4 - st.up]
      m.tube([[x, 33 + dy], knee, foot], t2 => 1.2 - t2 * .5, { z, mat: 'B', pat: seg(3) })
      hairs(knee[0], knee[1] - 1.5)
    }
  }
  const claw = (z: number, dx: number, dy: number, phase: number) => {
    const s = look.claw
    const open = (snap ? snap : clip === 'idle' ? .2 + .2 * wave(t, 1, phase) : .25) * 1.2
    const dg = dig * Math.sin(t * TAU * 6 + phase * 3) * 2
    const reach = snap * 3
    const base: Pt = [20 + dx, 32 + dy]
    const elbow: Pt = [15 + dx - reach * .3, 35 + dy + dg * .3]
    const wrist: Pt = [12 + dx - reach, 32 + dy + dg]
    m.tube([base, elbow, wrist], t2 => 1.9 * s - t2 * .3, { z, pat: seg(2) })
    m.ell(wrist[0] - 3.5 * s, wrist[1] - 1, 4.6 * s, 3.1 * s, { a: -.15, z: z + 1, gloss: .6 })
    const tip = wrist[0] - 7.5 * s
    m.tube([[tip + 1, wrist[1] - 2.5], [tip - 2 * s, wrist[1] - 3.5 - open], [tip - 3.5 * s, wrist[1] - 2.5 - open]], t2 => 1.4 * s - t2 * .8, { z: z + 2, mat: 'B' })
    m.tube([[tip + 1, wrist[1] + .5], [tip - 1.5 * s, wrist[1] + 1.5 + open * .5], [tip - 3 * s, wrist[1] + .5 + open * .5]], t2 => 1.1 * s - t2 * .6, { z: z + 2, mat: 'B' })
    hairs(wrist[0] - 3, wrist[1] - 4)
  }
  legs(-5, -2.5, false)
  claw(-5, 4, -5, .5)
  m.tube([[18, 32], [26, 32], [35, 33], [40, 32.5]], t2 => 4.5 - t2 * .5, { flat: .7, pat: seg(6), gloss: .6 })
  // しっぽ（どくばり つき）。
  const T = look.tail
  const strike = Math.max(0, jab)
  const pull = Math.max(0, -jab)
  const pts: Pt[] = [
    [40, 32],
    [46 + pull * 2, 28 - sway * .5],
    [49 + pull * 3 - strike * 3, 20 * T + (1 - T) * 26 - sway],
    [46 - strike * 8 + pull * 2, 12 * T + (1 - T) * 24 - sway * .8 + strike * 2],
    [40 - strike * 14 + pull, 8.5 * T + (1 - T) * 22 + strike * 6],
    [35 - strike * 16, 10 * T + (1 - T) * 22 + strike * 10],
  ]
  m.tube(pts, t2 => (2.9 - t2 * .7) * (look.hair ? 1.12 : 1), { z: t2 => 2 + t2 * 2, pat: seg(5), gloss: .6 })
  const [ex, ey] = pts[5]
  m.ell(ex - 2, ey + 2.5, 3.2, 2.4, { a: .5 + strike * .6, z: 5, mat: 'C', gloss: .8 })
  m.tube([[ex - 4, ey + 4], [ex - 5.5, ey + 6.5], [ex - 4, ey + 8]], t2 => 1 - t2 * .7, { z: 6, mat: 'B' })
  if (look.hair) for (const [x, y] of pts.slice(1)) hairs(x + 2.5, y)
  m.eye(19.5, 29.5, .95, 5)
  legs(5, 0, true)
  claw(6, 0, 2, 0)
  if (dig > .5) {
    // すなを かきだす。
    for (let i = 0; i < 5; i++) {
      const k = frac(t * 4 + i * .2)
      m.dot(6 - k * 4 + i, 44 - Math.sin(k * Math.PI) * 6, '#d9c089', .9)
    }
  }
  if (snap > .8) m.dot(1, 27, '#fffbe0').dot(2, 25, '#fffbe0').dot(1, 31, '#fffbe0')
}

// ---------------- アメリカドクトカゲ ----------------

export const lizard: Builder = (m, pose) => {
  const { clip, t } = pose
  const walk = clip === 'move' ? t : -1
  let tongue = 0, raise = 0, breathe = 0
  if (clip === 'idle') { breathe = wave(t, 1); tongue = Math.max(bump(t, .55, .65), bump(t, .7, .8)) }
  else if (clip === 'act') {
    // あたまを もちあげて、くろい したを ちょろちょろ（においを さがす）。
    raise = key(t, [[0, 0], [.2, 1], [.85, 1], [1, 0]])
    tongue = Math.max(bump(t, .2, .34), bump(t, .38, .52), bump(t, .56, .7), bump(t, .74, .88))
  }
  const beads: Pattern = c => {
    if (c.s > .55) return c.fine && frac(c.l / 1.2) < .22 ? 'A-' : null
    const n = noise(c.l / 4.2 + 3, (c.s + 1) * 2.2, 11) + (hash(Math.floor(c.l), Math.floor(c.s * 3 + 5), 2) - .5) * .12
    const mat: Mat = n < .48 ? 'B' : 'A'
    // つぶつぶの うろこ（こまかく かく とき）: ずらして ならべた つぶの、した・みぎ がわに かげ。
    if (c.fine) {
      const gy = (c.s + 1) * 3.2, row = Math.floor(gy)
      const gx = c.l / 1.3 + (row % 2) * .5
      if (frac(gx) > .74 || frac(gy) > .74) return `${mat}-`
    }
    return mat === 'B' ? 'B' : null
  }
  const spine = (u: number): Pt => {
    const x = lerp(11, 62, u)
    const s = walk < 0 ? 0 : wave(walk, 1, -u * .9) * 1.2
    const lift = u < .25 ? raise * (1 - u / .25) * 6 : 0
    return [x, (u < .55 ? 32 : 32 + (u - .55) * 22) + s - lift + breathe * .2 * Math.sin(u * Math.PI)]
  }
  const leg = (u: number, phase: number, z: number, near: boolean) => {
    const [x, y] = spine(u)
    const st = walk < 0 ? { x: 0, up: 0 } : stride(walk + phase, 2.6, 2.2)
    const foot: Pt = [x + st.x + (near ? -2 : 2), 43 - st.up]
    m.tube([[x, y + 2], [x + (near ? -3 : 3) + st.x * .3, y + 6], foot], t2 => 2.4 - t2 * .9, { z, pat: beads, gloss: .3 })
    for (const dx of [-2, -.7, .7, 2]) m.ell(foot[0] + dx, foot[1] + .5, .8, .8, { z: z + 1, mat: 'B' })
  }
  leg(.15, .5, -5, false)
  leg(.58, 0, -5, false)
  m.path(u => { const [x, y] = spine(u); return [x, y, 0] },
    u => u < .55 ? 5 + Math.sin(u / .55 * Math.PI) * .9 : 5 * (1 - (u - .55) / .45) + .9, { pat: beads, gloss: .25 })
  const [hx, hy] = spine(0)
  m.ell(hx - 1, hy - 1, 7, 4.8, { z: 1, gloss: .25, pat: beads, a: -raise * .2 })
  m.ell(hx - 6, hy + .5 - raise * 1.4, 2.6, 1, { a: .1 - raise * .2, z: 4, mat: 'B' })
  if (tongue > .05) {
    const L = tongue * 6
    const ox = hx - 8, oy = hy + .5 - raise * 1.6
    m.tube([[ox, oy], [ox - L, oy + L * .1]], .55, { z: 5, mat: 'K' })
    m.tube([[ox - L, oy + L * .1], [ox - L - 1.5, oy - 1]], .45, { z: 5, mat: 'K' }).tube([[ox - L, oy + L * .1], [ox - L - 1.5, oy + 1.4]], .45, { z: 5, mat: 'K' })
  }
  m.eye(hx - 2.5, hy - 2.7 - raise * .8, 1.3, 5.5)
  leg(.13, 0, 6, true)
  leg(.56, .5, 6, true)
}

