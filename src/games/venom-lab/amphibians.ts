// カエル・ヒキガエル・イモリ。どれも ひだりを むいて すわる よこがお。

import { key, wave } from './keys'
import type { Builder } from './pose'
import { bump, hash, lerp, type Mat, type Model, type Pattern, type Pt } from './raster'

/** だえんの なかの ドットの おおきさで きめる もよう（からだと いっしょに うごく）。 */
function cells(rx: number, ry: number, cell: number, seed: number, hit: (fx: number, fy: number, h: number) => Mat | null): Pattern {
  return c => {
    const gx = (c.u * rx) / cell + 50, gy = (c.v * ry) / cell + 50
    const ix = Math.floor(gx), iy = Math.floor(gy)
    return hit(gx - ix - .5, gy - iy - .5, hash(ix, iy, seed))
  }
}

type FrogLook = { legs: Mat; throat: Mat; toes: Mat; spots?: Mat; speck?: Mat }
const FROG: Record<string, FrogLook> = {
  'golden-frog': { legs: 'A', throat: 'C', toes: 'B' },
  'blue-frog': { legs: 'B', throat: 'B', toes: 'B', spots: 'C' },
  'strawberry-frog': { legs: 'B', throat: 'A', toes: 'B', speck: 'C' },
}

/** ひらいた ひざ を もつ あし を 3てんで かく。 */
function leg(m: Model, pts: readonly Pt[], r0: number, r1: number, z: number, mat: Mat, pat?: Pattern, gloss = .6) {
  m.tube(pts, t => lerp(r0, r1, t), { z, mat, pat, gloss })
}
function toes(m: Model, x: number, y: number, z: number, mat: Mat, spread = 1.5, n = 3) {
  for (let i = 0; i < n; i++) m.ell(x + (i - (n - 1) / 2) * spread, y, 1.15, .9, { z: z + 1, mat, gloss: .5 })
}

export const frog: Builder = (m, pose, sp) => {
  const look = FROG[sp.id] ?? FROG['golden-frog']
  const { clip, t } = pose
  const dx = 0
  let tilt = 0, dy = 0, squash = 0, legExt = 0, front = 0, throat = 0, blink = 0, breathe = 0
  let tongue = 0, ant = -1, tap = 0, sac = 0
  if (clip === 'idle') {
    throat = .5 + .5 * wave(t, 4)
    breathe = wave(t, 1)
    blink = bump(t, .6, .7)
  } else if (clip === 'move') {
    squash = key(t, [[0, 0], [.12, 1], [.2, -.6], [.5, -.3], [.78, 0], [.86, .9], [1, 0]])
    legExt = key(t, [[0, 0], [.12, 0], [.28, 1], [.55, .7], [.8, 0]])
    tilt = key(t, [[0, 0], [.12, .06], [.3, -.42], [.62, .02], [.82, .16], [1, 0]])
    front = key(t, [[0, 0], [.18, 0], [.32, -1], [.62, .4], [.8, 1], [1, 0]])
    dy = key(t, [[0, 0], [.12, 1.2], [.24, 0]])
  } else if (sp.id === 'golden-frog') {
    // したを のばして アリを つかまえ、めを つぶって のみこむ。
    tongue = key(t, [[0, 0], [.22, 0], [.34, 1], [.42, 1], [.56, 0]])
    ant = t < .4 ? 0 : t < .56 ? 1 : -1
    tilt = key(t, [[0, 0], [.2, .1], [.3, .14], [.56, .04], [.62, 0]])
    blink = bump(t, .62, .86)
    throat = key(t, [[0, .3], [.56, .3], [.66, 1], [.86, 1], [1, .3]])
  } else if (sp.id === 'blue-frog') {
    // まえあしの ゆびを とんとん（つまさきを ふるわせる しぐさ）。
    tap = Math.max(bump(t, .1, .26), bump(t, .3, .46), bump(t, .5, .66), bump(t, .7, .86))
    tilt = -.06 * Math.max(0, wave(t, 4))
    throat = .5 + .5 * wave(t, 6)
  } else {
    // オスが なく ときの ように、のどの ふくろを ふくらませる。
    sac = Math.max(bump(t, .06, .3), bump(t, .36, .6), bump(t, .66, .9))
    tilt = -.08 * sac
  }

  const cosA = Math.cos(tilt), sinA = Math.sin(tilt)
  const sq = 1 - squash * .1, st = 1 + squash * .07
  // からだの まわしかた（ひだりあしの つけねの あたりを じくにする）。
  const T = (x: number, y: number): Pt => {
    const ox = (x - 30) * st, oy = (y - 44) * sq
    return [30 + ox * cosA - oy * sinA + dx, 44 + ox * sinA + oy * cosA + dy]
  }
  const bodySpots: Pattern | undefined = look.spots
    ? cells(12, 8.6, 4.2, 3, (fx, fy, h) => h < .55 && fx * fx + fy * fy < .09 + h * .12 ? look.spots! : null)
    : look.speck ? cells(12, 8.6, 2.4, 5, (fx, fy, h) => h < .4 && fx * fx + fy * fy < .05 ? look.speck! : null) : undefined
  const headSpots: Pattern | undefined = look.spots
    ? cells(9, 7, 4, 7, (fx, fy, h) => h < .45 && fx * fx + fy * fy < .08 + h * .1 ? look.spots! : null)
    : look.speck ? cells(9, 7, 2.4, 6, (fx, fy, h) => h < .3 && fx * fx + fy * fy < .05 ? look.speck! : null) : undefined
  const legSpots: Pattern | undefined = look.spots ? cells(4, 4, 3, 9, (fx, fy, h) => h < .35 && fx * fx + fy * fy < .07 ? look.spots! : null) : undefined

  // おくの あし。
  const hipFar = T(44, 37)
  leg(m, [hipFar, [lerp(48, 50, legExt), lerp(41.5, 33, legExt)], [lerp(41, 55, legExt), lerp(43.6, 37, legExt)], [lerp(37, 58, legExt), lerp(43.8, 34.5, legExt)]], 2.4, 1.1, -6, look.legs, legSpots)
  const shF = T(28.5, 35)
  leg(m, [shF, [lerp(29.5, 31, Math.max(0, -front)) - Math.max(0, front) * 3, lerp(40, 38.5, Math.abs(front))], [lerp(28.5, 33, Math.max(0, -front)) - Math.max(0, front) * 4, lerp(43.8, 40.5, Math.max(0, -front))]], 1.9, 1.2, -5, look.legs, legSpots)

  // からだ・あたま。
  const [bx, by] = T(35, 33)
  m.ell(bx, by - breathe * .25, 12 * st, 8.6 * sq * (1 + breathe * .025), { a: -.32 + tilt, pat: bodySpots, gloss: .95 })
  const [hx, hy] = T(22, 30.5)
  m.ell(hx, hy, 9, 7 * sq, { z: 2, a: .1 + tilt, pat: headSpots, gloss: .95 })
  const [sx, sy] = T(14.6, 31.6)
  m.ell(sx, sy, 4.2, 3.4 * sq, { z: 1.5, a: .2 + tilt, pat: headSpots, gloss: .9 })
  // のど と ないぶくろ。
  const [tx, ty] = T(18.5, 35)
  m.ell(tx, ty + throat * .5, 5 + throat * .6, 2.2 + throat * 1, { z: 4, mat: look.throat, gloss: .7 })
  if (sac > 0) m.ell(tx - 1.5, ty + 1 + sac * 1.5, 3 + sac * 4.5, 2 + sac * 4, { z: 9, mat: look.throat, gloss: 1.1, rz: 3 + sac * 3 })
  // くち。
  m.tube([T(11.6, 33), T(16, 34.2), T(22.5, 33.6)], .62, { z: 7, mat: 'E', gloss: 0 })
  if (tongue > 0) {
    const [mx, my] = T(12.5, 33.5)
    const reach = tongue * 9
    m.tube([[mx, my], [mx - reach * .6, my + reach * .55], [mx - reach, my + reach * .95]], t2 => lerp(1, 1.4, t2), { z: 12, mat: 'T', gloss: .8 })
    if (ant === 1) m.ell(mx - reach, my + reach * .95, 1.3, 1, { z: 13, mat: 'E', gloss: .3 })
  }
  if (ant === 0) {
    // あしもとを あるく ちいさな アリ。
    const ax = 3 + t * 4
    m.ell(ax, 43, 1.2, .9, { z: 4, mat: 'E', gloss: .4 }).ell(ax + 1.8, 43.2, .9, .8, { z: 4, mat: 'E', gloss: .4 })
    m.dot(ax - 1, 44, '#1b1f2e').dot(ax + 2.5, 44, '#1b1f2e')
  }

  // め（まぶたを とじると ほそい 線）。
  const [ex, ey] = T(20.2, 24.3)
  m.ell(ex + .4, ey + .4, 3.9, 3.6 * sq, { z: 5, pat: headSpots, gloss: .9 })
  if (blink > .5) m.ell(ex, ey + .3, 2.8, .9, { z: 9, mat: look.legs === 'A' ? 'B' : 'B', gloss: .2 })
  else m.eye(ex, ey, 2.7, 8.5)

  // てまえの うしろあし。
  const hip = T(43, 37.5)
  // のばしても ひざと かかとで まがる「く」の 字に して、しっぽに みえない ように。
  const knee: Pt = [lerp(50, 52, legExt), lerp(40.5, 34.6, legExt) + squash * .4]
  const ankle: Pt = [lerp(44, 56.5, legExt), lerp(43, 40.6, legExt)]
  const foot: Pt = [lerp(37, 59.5, legExt), lerp(43.6, 37.8, legExt)]
  const thighA = Math.atan2(knee[1] - hip[1], knee[0] - hip[0])
  m.ell((hip[0] + knee[0]) / 2, (hip[1] + knee[1]) / 2, Math.hypot(knee[0] - hip[0], knee[1] - hip[1]) / 2 + lerp(2.4, 1.2, legExt), lerp(4.8, 3, legExt) * sq, { a: thighA, z: 7, mat: look.legs, pat: legSpots, gloss: .85 })
  leg(m, [knee, ankle, foot], lerp(2.6, 1.9, legExt), 1.2, 9, look.legs, legSpots)
  if (legExt < .5) {
    m.tube([foot, [foot[0] - 6, foot[1] + .4]], 1.1, { z: 10, mat: look.legs, gloss: .5 })
    toes(m, foot[0] - 6.4, 44, 10, look.toes, 1.5, 2)
  } else {
    // ひらいた みずかき。
    for (const a of [-.5, 0, .5]) m.tube([foot, [foot[0] + Math.cos(a) * 3.4, foot[1] + Math.sin(a) * 3.4 + .8]], .75, { z: 10, mat: look.toes, gloss: .4 })
  }

  // てまえの まえあし。
  const sh = T(24, 35)
  const reachF = Math.max(0, front), tuck = Math.max(0, -front)
  const elbow: Pt = [lerp(24.5, 20.5, reachF) + tuck * 4, lerp(39.5, 39, reachF) - tuck * 1.6]
  const hand: Pt = [lerp(23, 16.5, reachF) + tuck * 7, lerp(43.6, 43.4, reachF) - tuck * 3 - tap * 3.4]
  leg(m, [sh, elbow, hand], 2.3, 1.4, 8, look.legs, legSpots)
  toes(m, hand[0] - .3, hand[1] + .3, 9, look.toes, 1.7)
  if (tap > .6) m.dot(hand[0] - 4, hand[1] + 1, '#fff7c8').dot(hand[0] - 5, hand[1] - 1, '#fff7c8').dot(hand[0] + 3, hand[1] + 1, '#fff7c8')
  if (sac > .7) {
    // なきごえの しるし。
    const [mx, my] = T(9, 33)
    for (let i = 0; i < 3; i++) m.dot(mx - 2 - i, my - 3 + i * 3, '#fffbe0', .9)
    m.dot(mx - 5, my - 4, '#fffbe0', .6).dot(mx - 5, my + 4, '#fffbe0', .6).dot(mx - 6, my, '#fffbe0', .6)
  }
}

export const toad: Builder = (m, pose) => {
  const { clip, t } = pose
  let throat = 0, blink = 0, breathe = 0, puff = 0, walk = -1, dy = 0, headDip = 0
  if (clip === 'idle') {
    throat = .5 + .5 * wave(t, 3)
    breathe = wave(t, 1)
    blink = bump(t, .4, .52)
  } else if (clip === 'move') {
    walk = t
    dy = -.6 * Math.abs(wave(t, 2))
  } else {
    // てきが きたら からだを ふくらませて、あしを のばして おおきく みせる。
    puff = key(t, [[0, 0], [.2, 1], [.75, 1], [1, 0]])
    headDip = puff
    blink = bump(t, .3, .42)
    breathe = puff * wave(t, 6) * .3
  }
  const rise = puff * 3.2
  const warts = (rx: number, ry: number, seed: number) => cells(rx, ry, 3.1, seed, (fx, fy, h) => {
    const d = fx * fx + fy * fy
    if (h < .5 && d < .07) return d < .025 ? 'C' : null
    return h > .86 && d < .16 ? 'B' : null
  })
  const blotch = (rx: number, ry: number): Pattern => {
    const w = warts(rx, ry, 4)
    return c => {
      const hit = w(c)
      if (hit) return hit
      const gx = (c.u * rx) / 7 + 50, gy = (c.v * ry) / 6 + 50
      return hash(Math.floor(gx), Math.floor(gy), 12) > .62 && (gx % 1 - .5) ** 2 + (gy % 1 - .5) ** 2 < .14 ? 'B' : null
    }
  }
  const legPat = warts(3, 3, 8)
  const step = (phase: number) => {
    // 0〜1 の あいだ: まえへ ふみだして（うかせて）から、うしろへ けって すすむ。
    const p = ((phase % 1) + 1) % 1
    return p < .45 ? { x: lerp(2.5, -2.5, p / .45), up: Math.sin((p / .45) * Math.PI) * 2.2 } : { x: lerp(-2.5, 2.5, (p - .45) / .55), up: 0 }
  }
  const g = (offset: number) => walk < 0 ? { x: 0, up: 0 } : step(walk + offset)

  // おくの あし。
  const fb = g(.5), ff = g(0)
  leg(m, [[46, 34 - rise], [51 + fb.x * .3, 39 - fb.up - rise * .2], [46 + fb.x, 43.8 - fb.up]], 3, 1.6, -6, 'A', legPat, .2)
  leg(m, [[25, 34 - rise], [26.5 + ff.x * .4, 39.5 - ff.up - rise * .3], [24.5 + ff.x, 43.8 - ff.up]], 2.4, 1.5, -5, 'A', legPat, .2)
  toes(m, 23.5 + ff.x, 44 - ff.up, -5, 'A', 1.4)

  // からだ。
  const swell = 1 + puff * .16 + breathe * .02
  m.ell(36, 31.5 - rise + dy, 15.5 * swell, 10.2 * swell, { a: -.08, pat: blotch(15.5, 10.2), gloss: .15 })
  m.ell(21, 30 - rise + dy + headDip * 1.8, 9.8, 7.6, { z: 3, a: .12 + headDip * .18, pat: warts(9.8, 7.6, 5), gloss: .15 })
  m.ell(13.6, 32 - rise + dy + headDip * 2.6, 4.3, 3.3, { z: 2, a: .25 + headDip * .2, pat: warts(4, 3, 6), gloss: .2 })
  m.ell(18, 35.5 - rise + dy + headDip * 2 + throat * .5, 5.2 + throat * .5, 2.2 + throat * .9, { z: 4, mat: 'C', gloss: .2 })
  m.tube([[10.8, 33.6 - rise + dy + headDip * 2.8], [15.5, 34.8 - rise + dy + headDip * 2.4], [22.5, 34 - rise + dy + headDip * 1.6]], .62, { z: 7, mat: 'E', gloss: 0 })
  // めの うしろの どくの ふくろ（耳腺）。
  m.ell(27.5, 24.6 - rise + dy + headDip * .9, 6.2, 2.9, { a: .14, z: 8, mat: 'B', pat: warts(6, 3, 9), gloss: .3 })
  const ey = 24.4 - rise + dy + headDip * 1.4
  m.ell(19.8, ey + .6, 3.6, 3.2, { z: 6, pat: warts(3.6, 3.2, 10), gloss: .2 })
  if (blink > .5) m.ell(19.5, ey + .4, 2.6, .9, { z: 10, mat: 'B', gloss: .1 })
  else m.ell(19.5, ey, 2.4, 2.3, { z: 9, mat: 'C', gloss: 1, pat: c => Math.abs(c.v) < .32 && Math.abs(c.u) < .75 ? 'E' : c.u < -.2 && c.v < -.35 ? 'W' : null })

  // てまえの あし。
  const nb = g(0), nf = g(.5)
  const hipY = 36 - rise
  m.ell(45, hipY + 1, 7.8, 5.6, { a: -.5, z: 7, pat: legPat, gloss: .15 })
  leg(m, [[50, hipY + 3.5], [47 + nb.x * .4, 42 - nb.up * .6 - rise * .2], [40 + nb.x, 43.8 - nb.up]], 2.8, 1.6, 9, 'A', legPat, .2)
  m.tube([[40 + nb.x, 43.8 - nb.up], [34.5 + nb.x, 44 - nb.up]], 1.2, { z: 10, gloss: .2 })
  toes(m, 34 + nb.x, 44 - nb.up, 10, 'A', 1.4)
  leg(m, [[23.5, 35 - rise], [23.8 + nf.x * .4, 39.5 - nf.up - rise * .3], [21.5 + nf.x, 43.8 - nf.up]], 2.6, 1.6, 8, 'A', legPat, .2)
  toes(m, 20.5 + nf.x, 44 - nf.up, 8, 'A', 1.5)
  if (puff > .8 && t > .3 && t < .7) {
    // ぷうっと ふくらむ しるし。
    m.dot(37, 18 - rise, '#fffbe0', .8).dot(41, 17 - rise, '#fffbe0', .8).dot(45, 18 - rise, '#fffbe0', .8)
  }
}

export const newt: Builder = (m, pose) => {
  const { clip, t } = pose
  let walk = -1, arch = 0, breathe = 0, look = 0
  if (clip === 'idle') { breathe = wave(t, 1); look = bump(t, .5, .9) }
  else if (clip === 'move') walk = t
  else arch = key(t, [[0, 0], [.22, 1], [.78, 1], [1, 0]]) // あかい おなかを みせる けいかいの ポーズ。
  const s = walk < 0 ? 0 : walk
  // からだの うねり（あるくと S字に ゆれる）。
  const sway = (u: number) => walk < 0 ? 0 : wave(s, 1, -u * 1.1) * 1.4
  // せなかを そらして、あたまと しっぽを もちあげる。
  const bend = (u: number) => arch * (Math.sin(u * Math.PI) * 2 - (u < .2 ? (.2 - u) * 25 : 0) - (u > .6 ? (u - .6) * 30 : 0))
  const spine = (u: number): Pt => {
    const x = lerp(10, 62, u)
    const tailLift = u > .55 ? -(u - .55) * 9 * (1 - arch * .2) : 0
    return [x, 33 + tailLift + sway(u) + bend(u) + breathe * .15 * Math.sin(u * Math.PI)]
  }
  const edge = .28 - arch * .5
  const belly: Pattern = c => c.s > edge ? (hash(Math.floor(c.l * .6), Math.floor(c.s * 4 + 9), 5) > .78 ? 'B' : 'C') : (hash(Math.floor(c.l), Math.floor(c.s * 5 + 9), 6) > .93 ? 'B' : null)
  const stepFn = (phase: number) => {
    const p = ((phase % 1) + 1) % 1
    return p < .5 ? { x: lerp(2.6, -2.6, p / .5), up: Math.sin((p / .5) * Math.PI) * 1.8 } : { x: lerp(-2.6, 2.6, (p - .5) / .5), up: 0 }
  }
  const legAt = (u: number, phase: number, z: number, near: boolean) => {
    // よこへ はりだした あし（ひじが そとへ でる）。
    const [x, y] = spine(u)
    const st = walk < 0 ? { x: 0, up: 0 } : stepFn(s + phase)
    const lift = arch * 3.5
    const front = u < .3
    const foot: Pt = [x + st.x + (front ? -3 : 3), 43.2 - st.up - lift * .2]
    const elbow: Pt = [x + (front ? -1 : 1) + st.x * .5, y + 5 - st.up * .5]
    m.tube([[x, y + 1], elbow, foot], t2 => lerp(2, 1.2, t2), { z, gloss: .5, pat: c => c.t > .7 ? 'C' : null })
    for (const d of [-2.2, -.7, .8, 2.2]) m.tube([foot, [foot[0] + d * (near ? 1 : .8), foot[1] + .8]], .6, { z: z + 1, mat: 'C' })
  }
  legAt(.12, .5, -4, false)
  legAt(.42, 0, -4, false)
  m.path(u => {
    const [x, y] = spine(u)
    return [x, y, -arch * u * 2]
  }, u => u < .55 ? 4 + Math.sin((u / .55) * Math.PI) * 1 : 4 * (1 - (u - .55) / .45) + .5, { pat: belly, gloss: .75, flat: .9 })
  // あたま。
  const [hx, hy] = spine(0)
  m.ell(hx - 1, hy - .4 - arch * 1.5, 6.8, 4.2, { z: 1.5, a: -arch * .5, gloss: .75, pat: c => c.v > .4 ? 'C' : null })
  m.ell(hx - 6, hy + .2 - arch * 3, 2.6, 2.4, { z: 1, a: -arch * .5, gloss: .7 })
  m.tube([[hx - 7.6, hy + 1 - arch * 3.4], [hx - 3, hy + 1.8 - arch * 2], [hx + 2.5, hy + 1.4 - arch]], .58, { z: 5, mat: 'E', gloss: 0 })
  m.ell(hx - 2.5 + look * .4, hy - 2.6 - arch * 2.4, 2.2, 1.9, { z: 3.5, gloss: .6 })
  m.eye(hx - 2.8 + look * .4, hy - 2.6 - arch * 2.4, 1.5, 5.5)
  legAt(.14, 0, 5, true)
  legAt(.44, .5, 5, true)
}
