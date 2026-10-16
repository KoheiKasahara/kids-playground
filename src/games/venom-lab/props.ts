// くらしの ようすに でてくる ちいさな えもの・こども・どうぐ。どれも ひだりを むいた 絵で、
// dir に -1 を わたすと みぎを むく。あたりの 絵と おなじ しあげに なる ように、もけいの 部品で かく。

import { wave } from './keys'
import { lerp, TAU, type Mat, type Model, type Pt } from './raster'

type Facing = 1 | -1

/** ネズミ。run は はしる あしの すすみ（-1 で とまる）。 */
export function mouse(m: Model, x: number, y: number, z: number, run = -1, dir: Facing = 1, size = 1) {
  const s = size, d = dir
  const step = run < 0 ? 0 : wave(run, 2)
  const bob = run < 0 ? 0 : Math.abs(step) * .5
  m.tube([[x + d * 3.6 * s, y - 1.2 * s], [x + d * 6.5 * s, y - 2.6 * s], [x + d * 9 * s, y - 1.6 * s]], .45 * s, { z: z - 1, mat: 'M', gloss: .3 })
  for (const [k, ph] of [[-1.8, 0], [2, .5]] as const) {
    const sw = run < 0 ? 0 : wave(run, 2, ph) * 1.1
    m.tube([[x + d * k * s, y - 1 * s], [x + d * (k + sw) * s, y + .4 * s]], .55 * s, { z: z - .5, mat: 'M', gloss: .2 })
  }
  m.ell(x, y - 2.4 * s - bob, 3.8 * s, 2.4 * s, { z, mat: 'N', gloss: .5 })
  m.ell(x - d * 3.6 * s, y - 2.9 * s - bob, 2.1 * s, 1.7 * s, { z: z + 1, a: d * .25, mat: 'N', gloss: .5 })
  m.ell(x - d * 2.6 * s, y - 4.6 * s - bob, 1.2 * s, 1.1 * s, { z: z + .5, mat: 'M', gloss: .3 })
  m.dot(x - d * 5.6 * s, y - 2.6 * s - bob, '#e0879b').dot(x - d * 4 * s, y - 3.4 * s - bob, '#1b1f2e')
}

/** ちいさな カエル（えもの）。hop は 0〜1 の ジャンプの たかさ。 */
export function frogling(m: Model, x: number, y: number, z: number, hop = 0, dir: Facing = 1, mat: Mat = 'L') {
  const up = hop * 5, d = dir
  const legX = lerp(2.2, 4.4, hop)
  m.tube([[x + d * 1.6, y - 1.8 - up], [x + d * (legX + .8), y - 2.4 - up * .6], [x + d * legX, y - up * .4]], .75, { z: z - 1, mat, gloss: .4 })
  m.ell(x, y - 2.4 - up, 3.2, 2.1, { z, a: d * -.2, mat, gloss: .7 })
  m.ell(x - d * 2.4, y - 2.9 - up, 1.9, 1.5, { z: z + 1, mat, gloss: .7 })
  m.tube([[x - d * 1.6, y - 1.2 - up], [x - d * 2.2, y - up * .5]], .55, { z: z + 1.5, mat, gloss: .3 })
  m.dot(x - d * 2.4, y - 4 - up, '#1b1f2e')
}

/** ちいさな トカゲ。run は あしと からだの くねり。 */
export function lizardling(m: Model, x: number, y: number, z: number, run = -1, dir: Facing = 1, mat: Mat = 'P') {
  const d = dir
  const sw = (u: number) => run < 0 ? 0 : wave(run, 1, -u) * .9
  m.tube([[x - d * 5, y - 1.6 + sw(0)], [x - d * 1, y - 1.5 + sw(.3)], [x + d * 3, y - 1.3 + sw(.6)], [x + d * 8, y - .7 + sw(1)]], t => lerp(1.4, .3, t), { z, mat, gloss: .5 })
  for (const [k, ph] of [[-2.4, 0], [1.6, .5]] as const) {
    const st = run < 0 ? 0 : wave(run, 1, ph) * 1
    m.tube([[x + d * k, y - 1.3], [x + d * (k - 1 + st), y + .2]], .45, { z: z + 1, mat, gloss: .3 })
  }
  m.ell(x - d * 5.6, y - 1.7 + sw(0), 1.8, 1.2, { z: z + .5, mat, gloss: .6 })
  m.dot(x - d * 6, y - 2.4 + sw(0), '#1b1f2e')
}

/** コオロギなどの むし。hop で はねる。 */
export function cricket(m: Model, x: number, y: number, z: number, hop = 0, dir: Facing = 1, size = 1) {
  const up = hop * 4, d = dir, s = size
  m.tube([[x + d * .5 * s, y - 1.6 * s - up], [x + d * 2.6 * s, y - 3.6 * s - up], [x + d * 3.8 * s, y - up * .3]], .4 * s, { z: z - 1, mat: 'P', gloss: .3 })
  m.ell(x, y - 1.6 * s - up, 2.6 * s, 1.2 * s, { z, a: d * .12, mat: 'P', gloss: .6 })
  m.ell(x - d * 2.3 * s, y - 1.8 * s - up, 1 * s, .95 * s, { z: z + .5, mat: 'P', gloss: .5 })
  m.line(x - d * 3 * s, y - 2.4 * s - up, x - d * 6 * s, y - 5 * s - up, '#7d5b3e', .9)
}

/** ミミズ。 */
export function worm(m: Model, x: number, y: number, z: number, wiggle: number, len = 9, dir: Facing = 1) {
  m.path(u => [x + dir * u * len, y - .9 - Math.max(0, Math.sin((u * 1.4 + wiggle) * TAU)) * 1.4, z], u => lerp(.95, .7, u), { mat: 'M', gloss: .6, pat: c => (c.l % 2.2 < .5 ? 'M-' : null) })
}

/** たまご。 */
export function egg(m: Model, x: number, y: number, z: number, size = 1, mat: Mat = 'F') {
  m.ell(x, y - 2.1 * size, 1.7 * size, 2.2 * size, { z, mat, gloss: .9 })
}

/** オタマジャクシ（たまご から かえった こども）。 */
export function tadpole(m: Model, x: number, y: number, z: number, wiggle: number, dir: Facing = 1, size = 1) {
  m.tube([[x, y], [x + dir * 2 * size, y + wave(wiggle, 1) * .6 * size], [x + dir * 4 * size, y + wave(wiggle, 1, .3) * 1 * size]], t => lerp(.8, .25, t) * size, { z, mat: 'E', gloss: .3 })
  m.ell(x - dir * .6 * size, y, 1.5 * size, 1.2 * size, { z: z + .5, mat: 'E', gloss: .8 })
}

/** カニ。walk で よこあるき、open で はさみを ひらく。 */
export function crab(m: Model, x: number, y: number, z: number, walk = -1, open = 0, size = 1) {
  const s = size
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const st = walk < 0 ? 0 : wave(walk, 2, i * .3 + (side > 0 ? .5 : 0)) * .7
      m.tube([[x + side * 1.6 * s, y - 2 * s], [x + side * (3.2 + i * .6) * s, y - (3 - st) * s], [x + side * (3.8 + i * .9) * s, y]], .42 * s, { z: z - 1 + i * .2, mat: 'O', gloss: .3 })
    }
  }
  m.ell(x, y - 2.4 * s, 3.4 * s, 1.9 * s, { z, mat: 'O', gloss: .7 })
  for (const side of [-1, 1]) {
    m.tube([[x + side * 2.2 * s, y - 3.2 * s], [x + side * 3.6 * s, y - 4.8 * s]], .55 * s, { z: z + 1, mat: 'O', gloss: .4 })
    m.ell(x + side * 4.2 * s, y - (5.4 + open * .5) * s, 1.3 * s, (.8 + open * .3) * s, { z: z + 1.5, a: side * (.5 + open), mat: 'O', gloss: .6 })
  }
  m.dot(x - s, y - 4.4 * s, '#1b1f2e').dot(x + s, y - 4.4 * s, '#1b1f2e')
}

/** エビ。flick で しっぽを まるめる。 */
export function shrimp(m: Model, x: number, y: number, z: number, flick = 0, dir: Facing = 1, size = 1) {
  const d = dir, s = size
  m.path(u => {
    const a = u * (1.6 + flick * 1.4)
    return [x + d * (Math.sin(a) * 3.2 - 1.5) * s, y + (1 - Math.cos(a) * 2) * s, z]
  }, u => lerp(1.25, .5, u) * s, { mat: 'M', gloss: .7, pat: c => c.l % (1.6 * s) < .4 * s ? 'M-' : null })
  m.line(x - d * 1.6 * s, y - 1.2 * s, x - d * 6 * s, y - 3 * s, '#e0879b', .85)
  m.dot(x - d * 1.4 * s, y - 1.4 * s, '#1b1f2e')
}

/** ちいさな さかな。 */
export function fishling(m: Model, x: number, y: number, z: number, dir: Facing = 1, flap = 0, size = 1) {
  const s = size
  m.ell(x, y, 2.4 * s, 1.2 * s, { z, mat: 'S', gloss: .8, pat: c => c.v > .3 ? 'F' : null })
  m.tube([[x + dir * 2 * s, y], [x + dir * 3.6 * s, y + (flap - 1) * s], [x + dir * 3.6 * s, y + (flap + 1) * s]], .5 * s, { z: z - .2, mat: 'S', gloss: .4 })
  m.dot(x - dir * 1.2 * s, y - .4 * s, '#1b1f2e')
}

/** ハチドリ。flap で はばたく。 */
export function hummingbird(m: Model, x: number, y: number, z: number, flap: number, dir: Facing = 1) {
  const d = dir
  const up = Math.round(flap * 9) % 2 ? 1 : -1
  m.ell(x + d * .8, y - 1 - up * 1.6, 3.4, 1.3, { z: z - 1, a: d * (.6 + up * .5), mat: 'S', gloss: 1, glass: .45 })
  m.ell(x, y, 2.6, 1.6, { z, a: d * -.3, mat: 'L', gloss: .9 })
  m.tube([[x + d * 2, y + .6], [x + d * 4.4, y + 2]], t => lerp(.8, .3, t), { z: z - .5, mat: 'L', gloss: .5 })
  m.ell(x - d * 2.2, y - 1, 1.3, 1.2, { z: z + .5, mat: 'L', gloss: .8 })
  m.line(x - d * 3.4, y - .8, x - d * 6, y - .2, '#1b1f2e')
  m.dot(x - d * 2.4, y - 1.4, '#1b1f2e').dot(x - d * .6, y + .6, '#d9475f')
}

/** あかい はな。 */
export function flower(m: Model, x: number, y: number, z: number) {
  m.tube([[x, y], [x + .6, y + 6]], .45, { z: z - 1, mat: 'L', gloss: .2 })
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2
    m.ell(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.5, 1.4, 1.1, { z, a, mat: 'T', gloss: .6 })
  }
  m.ell(x, y, .9, .9, { z: z + 1, mat: 'F', gloss: .4 })
}

/** はっぱ（mat: L は みどり、P は かれは）。 */
export function leaf(m: Model, x: number, y: number, z: number, a: number, size = 1, mat: Mat = 'P') {
  m.ell(x, y, 3 * size, 1.25 * size, { z, a, rz: .6, mat, gloss: .3, pat: c => Math.abs(c.v) < .14 ? `${mat}-` : null })
}

/** みずたまり（うすく ひらたい みず）。 */
export function puddle(m: Model, x: number, y: number, rx: number, z = -8) {
  m.ell(x, y, rx, Math.max(1.2, rx * .2), { z, rz: .4, mat: 'Q', gloss: 1.2 })
}

/** はばいっぱいの みずの おもてなどを、えの はしで うすく する（はこの かどが みえない ように）。 */
export const edgeFade = (x: number) => Math.max(0, Math.min(1, (x + 1) / 12, (64 - x) / 12))

/** みずの おもての せん。 */
export function waterline(m: Model, y: number, t: number, alpha = .8, step = 2, behind = true) {
  for (let x = 0; x < 64; x += step) m.dot(x, y + Math.round(Math.sin(x * .4 + t * 12) * .5), '#d8f4f4', alpha * edgeFade(x), behind)
}

/** みずの わ（さざなみ）。k は 0〜1 の ひろがり。 */
export function ripple(m: Model, x: number, y: number, k: number) {
  if (k <= 0 || k >= 1) return
  const r = 2 + k * 6, a = .9 - k * .7
  for (const s of [-1, 1]) m.line(x + s * r * .4, y, x + s * r, y, '#e9fbff', a)
}

/** あわ。 */
export function bubbles(m: Model, x: number, y: number, t: number, n = 3, rise = 10) {
  for (let i = 0; i < n; i++) {
    const k = (t * 1.6 + i / n) % 1
    m.dot(x + Math.sin((k + i) * 5) * 1.2, y - k * rise, '#d8f4f4', .9 - k * .6)
  }
}

/** もぐもぐ たべている しるし（くちの まわりの ちいさな ひかり）。 */
export function munch(m: Model, x: number, y: number, t: number) {
  const k = Math.floor(t * 8) % 2
  m.dot(x - 2 - k, y - 2, '#fffbe0', .85).dot(x - 3, y + 1 + k, '#fffbe0', .7)
}

/** たいよう（ひなたぼっこ）。shine で ひかりの せんが のびる。 */
export function sun(m: Model, x: number, y: number, shine: number) {
  m.ell(x, y, 3, 3, { z: 30, mat: 'O', gloss: 0, glow: true, pat: c => c.u * c.u + c.v * c.v < .35 ? 'F' : null })
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU
    const r0 = 4.4, r1 = 4.4 + shine * 2.4
    if (shine > .1) m.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, '#ffe7a3', .9)
  }
}

/** おつきさま（よる）。 */
export function moon(m: Model, x: number, y: number) {
  m.ell(x, y, 2.6, 2.6, { z: 30, mat: 'F', gloss: 0, glow: true, pat: c => (c.u - .55) ** 2 + (c.v + .2) ** 2 < .55 ? 'E' : null })
  m.dot(x - 6, y + 3, '#fffbe0', .8).dot(x + 5, y + 5, '#fffbe0', .6)
}

/** ほそい ヘビ（えもの・こども）。pts は あたま → しっぽ。 */
export function snakelet(m: Model, pts: readonly Pt[], r: number, z: number, mat: Mat = 'S') {
  m.tube(pts, t => r * (t < .1 ? .8 + t * 2 : 1 - Math.max(0, t - .6) * 1.6), { z, mat, gloss: .7 })
  const [hx, hy] = pts[0]
  m.dot(hx, hy - r * .5, '#1b1f2e')
}
