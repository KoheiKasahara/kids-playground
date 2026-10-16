// 海の なかま: タコ・オコゼ・ミノカサゴ・イモガイ・ヒトデ・ウニ。

import { key, span, wave } from './keys'
import type { Builder } from './pose'
import { crab, fishling, munch, shrimp } from './props'
import { bump, ease, frac, hash, lerp, noise, spline, TAU, type Mat, type Pattern, type Pt } from './raster'

export const octopus: Builder = (m, pose) => {
  const { clip, t } = pose
  // おどろくと あおい輪が ひかる。
  const flash = clip === 'act' ? key(t, [[0, 0], [.12, 1], [.3, .55], [.42, 1], [.6, .55], [.72, 1], [.9, .2], [1, 0]]) : 0
  const pulse = clip === 'idle' ? wave(t, 1) : clip === 'habit' && t > .72 ? wave(t, 6) * .6 : 0
  const walk = clip === 'move' ? t : 0
  // くらし: よこあるきの カニへ うでを のばして つかまえ、からだの したの くちへ はこぶ。
  const hunt = clip === 'habit' ? key(t, [[0, 0], [.26, 0], [.42, 1], [.7, 1], [.8, 0]]) : 0
  const crabX = t < .42 ? lerp(-2, 8, ease(t / .42)) : lerp(8, 24, span(t, .46, .7))
  const crabY = t < .46 ? 44 : lerp(44, 37, span(t, .46, .7))
  const holding = clip === 'habit' && t < .74
  const rings: (rx: number, ry: number) => Pattern = (rx, ry) => c => {
    const cell = 5.6, gx = (c.u * rx) / cell + 20, gy = (c.v * ry) / cell + 20
    const ix = Math.floor(gx), iy = Math.floor(gy)
    const ox = .5 + (hash(ix, iy, 3) - .5) * .3, oy = .5 + (hash(ix, iy, 4) - .5) * .3
    const d = Math.hypot(gx - ix - ox, gy - iy - oy) * cell
    const glow: Mat = flash > .5 ? 'G' : 'C'
    return d < .9 ? 'B' : d < 1.9 + flash * .4 ? glow : d < 2.6 ? 'B' : null
  }
  const armRings: Pattern = c => {
    const k = frac(c.l / 5.2)
    const glow: Mat = flash > .5 ? 'G' : 'C'
    return Math.abs(c.s) < .55 && k > .3 && k < .62 ? glow : k > .22 && k < .72 && Math.abs(c.s) < .8 ? 'B' : null
  }
  // うで 8ぽん: おくの 4ほん、てまえの 4ほん。あるくと なみが つたわる。
  for (const back of [true, false]) {
    for (let i = 0; i < 4; i++) {
      const k = back ? (i - 1.5) * 1.1 : (i - 1.5) * 1.45
      const side = Math.sign(k) || 1
      const ph = walk * TAU + i * 1.7 + (back ? 1 : 0)
      const lift = clip === 'move' ? Math.max(0, Math.sin(ph)) * 2.6 : clip === 'idle' || clip === 'habit' ? wave(t, clip === 'habit' ? 2 : 1, i * .25) * .8 : flash * 1.2
      const spread = 1 + flash * .14
      const base: Pt = [32 + k * 1.8, 27]
      const mid: Pt = [32 + k * 5.4 * spread, (back ? 33 : 36) - lift * .5]
      let end: Pt = [32 + k * 8.8 * spread, (back ? 39.5 : 42.5) - lift]
      const curl = clip === 'idle' ? 3.2 + wave(t, 1, i * .3) * .8 : 3.2 + Math.cos(ph) * 1.2
      let tip: Pt = [end[0] + side * curl, end[1] - 2.6 - lift * .3]
      if (hunt && !back && i === 0) {
        // カニに まきつける うで。
        end = [lerp(end[0], crabX + 2.5, hunt), lerp(end[1], crabY - 1, hunt)]
        tip = [lerp(tip[0], crabX - 2, hunt), lerp(tip[1], crabY - 4.5, hunt)]
      }
      m.tube([base, mid, end, tip, [tip[0] - side * 1.6, tip[1] - 1.9]], t2 => 3.1 - t2 * 2.45, { z: back ? -5 : 4, pat: armRings, gloss: .55 })
    }
  }
  if (holding) crab(m, crabX, crabY, t < .6 ? 7 : 2, t < .42 ? t * 3 : -1, hunt, 1.35)
  if (clip === 'habit' && t > .74) munch(m, 32, 31, t)
  const breathe = 1 + pulse * .04 + flash * .05
  m.ell(32, 24.5, 9.4, 6.4, { z: 1, pat: rings(9.4, 6.4), gloss: .55 })
  m.ell(33, 13.5 - pulse * .4 - flash, 10.5 * breathe, 9.5 * breathe, { a: -.2, z: -1, pat: rings(10.5, 9.5), gloss: .65 })
  // ろうと（いきを はく くだ）。
  m.ell(40.5, 23.5 + pulse * .3, 2.2, 1.6 + Math.max(0, pulse) * .5, { a: .5, z: 3, gloss: .5 })
  for (const x of [27, 37.5]) {
    m.ell(x, 23, 3.4, 3.1, { z: 7, gloss: .45, pat: rings(3.4, 3.1) })
    m.ell(x, 23.6, 2, 1.4 - bump(t, .7, .78) * (clip === 'idle' ? 1 : 0), { z: 9.5, mat: 'E', gloss: 0, pat: c => c.v < -.2 && c.u < 0 ? 'W' : null })
  }
}

export const stonefish: Builder = (m, pose) => {
  const { clip, t } = pose
  // いきを する えら・ひれ、ときどき めだまを ぎょろり。
  const breathe = clip === 'act' ? 0 : wave(t, 2)
  const look = clip === 'idle' ? key(t, [[0, 0], [.35, 0], [.45, 1], [.7, 1], [.8, 0]]) : clip === 'habit' ? key(t, [[0, 0], [.62, 0], [.7, 1], [.8, -1], [.88, 0]]) : 0
  // くらし: むなびれで すなを あおいで かけ、からだを うめて かくれる。
  const bury = clip === 'habit' ? key(t, [[0, 0], [.1, 0], [.6, 1], [.86, 1], [1, 0]]) : 0
  const fanning = clip === 'habit' && t > .06 && t < .62 ? wave(t, 9) : 0
  // とつぜん くちを あけて えものを すいこむ（まちぶせ）。せびれの とげも たてる。
  const gulp = clip === 'act' ? key(t, [[0, 0], [.3, 0], [.38, 1], [.5, 1], [.58, 0]]) : 0
  const spines = clip === 'act' ? key(t, [[0, 0], [.08, 1], [.88, 1], [1, 0]]) : 0
  const prey = clip === 'act' && t < .4 ? t : -1
  const mottled: Pattern = c => {
    const n = noise((c.u + 2) * 3.3, (c.v + 2) * 2.8, 7)
    return n < .32 ? 'B' : n > .72 ? 'C' : null
  }
  // せびれの とげ。
  for (let i = 0; i < 9; i++) {
    const x = 21 + i * 3.4, y = 22.5 + Math.abs(i - 4) * .5
    const up = 3 + (i % 3) + spines * 3
    m.tube([[x, y], [x + 1 - spines * .6, y - up * .7], [x + 2 - spines * 1.2, y - up]], t2 => 1.1 - t2 * .6, { z: -2, mat: 'B', gloss: .3 })
  }
  m.ell(57, 31, 4.2, 6 + breathe * .2, { a: .1 + breathe * .05, z: -1, mat: 'B', pat: mottled, gloss: .1 })
  m.ell(35, 32, 22, 10.5 + breathe * .25, { a: .05, pat: mottled, gloss: .12 })
  m.ell(17.5, 31, 12.5 + gulp * 1, 11 + gulp * 1.5, { z: 2, pat: mottled, gloss: .12 })
  // こぶこぶ。
  for (let i = 0; i < 16; i++) {
    const x = 9 + hash(i, 1, 9) * 45, top = 22 + Math.abs(x - 28) * .12
    m.ell(x, top + hash(i, 2, 9) * 9, 2 + hash(i, 3, 9) * 2.5, 1.8 + hash(i, 4, 9) * 2, { z: 7 + hash(i, 5, 9) * 3, pat: mottled, gloss: .1 })
  }
  // むなびれ（ゆっくり あおぐ）。
  m.ell(29, 38 + breathe * .4 - fanning * 1.2, 8.5, 4.5, { a: .25 + breathe * .08 + fanning * .35, z: 10, mat: 'B', gloss: .1, pat: c => frac((c.u + 1) * 3) < .25 ? 'C' : null })
  if (bury > 0) {
    // からだに かかった すな。
    m.ell(34, 47.5, 27, .5 + bury * 9, { z: 12, rz: 3, mat: 'S', gloss: .1, pat: c => noise((c.u + 2) * 9, (c.v + 2) * 4, 3) > .62 ? 'S-' : null })
  }
  if (fanning) {
    for (let i = 0; i < 7; i++) {
      const k = frac(t * 3.2 + i / 7)
      const side = i % 2 ? -1 : 1
      const x = 30 + side * (5 + k * 12), y = 41 - Math.sin(k * Math.PI) * (8 + (i % 3) * 3)
      m.dot(x, y, i % 3 ? '#e3dccb' : '#c9bb98', .95 - k * .4).dot(x + side, y + 1, '#e3dccb', .8 - k * .4)
    }
  }
  if (clip === 'habit' && t > .86) for (let i = 0; i < 6; i++) m.dot(12 + i * 8, 39 - (t - .86) * 30 + (i % 2) * 2, '#e3dccb', .8)
  // うえむきの おおきな くち。
  if (gulp > .05) m.ell(10, 25 - gulp, 6, 1.5 + gulp * 4, { a: -.5, z: 7.5, mat: 'M', gloss: .2 })
  m.ell(10, 24.5 - gulp * 2.5, 6, 2, { a: -.6 - gulp * .4, z: 8, mat: 'B', gloss: .1, pat: mottled })
  m.ell(10.5, 27 + gulp * 1.5, 6, 1.8, { a: -.4 + gulp * .3, z: 8, mat: 'B', gloss: .1, pat: mottled })
  if (prey >= 0) {
    // ちかづく ちいさな さかな。
    const px = 2 + prey * 10, py = 16 + prey * 6
    m.ell(px, py, 2, 1.1, { z: 12, mat: 'S', gloss: .8 }).dot(px + 2, py, '#9fb8c0').dot(px - 1, py - .5, '#1b1f2e')
  }
  if (gulp > .5) for (const [dx, dy] of [[-4, -6], [-6, -3], [-2, -8]] as const) m.dot(10 + dx, 22 + dy, '#d8f4f4', .7)
  m.ell(15, 21.5, 2.6, 2.4, { z: 11, mat: 'C', gloss: .2 })
  m.eye(15 - look * .7, 21.5 - look * .3, 1.5, 13)
}

export const lionfish: Builder = (m, pose) => {
  const { clip, t } = pose
  // ゆったり おびれと むなびれを うごかして およぐ。とくいわざは ひれを ぜんぶ ひろげる。
  const swim = clip === 'act' ? 0 : wave(t, clip === 'habit' ? 2 : 1) * (clip === 'habit' ? .6 : 1)
  // くらし: むなびれを まえへ ひろげて エビを おいこみ、いっきに すいこむ。
  const herd = clip === 'habit' ? key(t, [[0, 0], [.15, 1], [.46, 1], [.6, .2], [1, 0]]) : 0
  const dx = clip === 'habit' ? key(t, [[0, 0], [.15, -.5], [.42, -1.5], [.5, -4.5], [.6, -4.5], [.88, 0]]) : 0
  const gape = clip === 'habit' ? key(t, [[0, 0], [.44, 0], [.5, 1], [.56, 1], [.62, 0]]) : 0
  const fan = clip === 'act' ? key(t, [[0, 0], [.2, 1], [.85, 1], [1, 0]]) : clip === 'habit' ? .15 + herd * .7 : .15 + .15 * wave(t, 1, .25)
  const tilt = clip === 'act' ? key(t, [[0, 0], [.2, .18], [.85, .18], [1, 0]]) : clip === 'habit' ? key(t, [[0, 0], [.15, -.08], [.42, -.12], [.5, -.24], [.6, -.24], [.88, 0]]) : 0
  const stripes: Pattern = c => {
    const k = frac((c.u * 16 + c.v * 5) / 6)
    return k < .38 ? 'B' : k > .6 && k < .76 ? 'C' : null
  }
  const ray: Pattern = c => frac(c.l / 2.6) < .45 ? 'C' : null
  const rot = (x: number, y: number): Pt => {
    const ca = Math.cos(tilt), sa = Math.sin(tilt)
    return [32 + (x - 32) * ca - (y - 27) * sa + dx, 27 + (x - 32) * sa + (y - 27) * ca]
  }
  if (clip === 'habit' && t < .5) shrimp(m, 5 + wave(t, 3) * .6, 36.5, 12, Math.max(0, wave(t, 5)), 1, 1.35)
  // せびれの ながい とげ（どくの とげ。ひろげると まえへ むける）。
  for (let i = 0; i < 11; i++) {
    const x = 18 + i * 2.6, y = 21 - Math.sin((i / 10) * Math.PI) * 1.5
    const len = 15 - Math.abs(i - 3) * 1.1 + fan * 2
    const sway = swim * .8 * (i / 10)
    m.tube([rot(x, y), rot(x + 3 - fan * 2 + sway, y - len * .55), rot(x + 6 - fan * 5 + sway * 2, y - len)], t2 => .95 - t2 * .45, { z: -3, mat: 'B', pat: ray })
  }
  // おびれ。
  const tail = swim * 2.2
  for (let i = 0; i < 5; i++) m.tube([rot(46, 26), rot(53, 22 + i * 2.2 + tail * .5), rot(59, 19 + i * 4 + tail)], t2 => 1 - t2 * .4, { z: -2, mat: 'B', pat: ray })
  const [cx, cy] = rot(52, 26 + tail * .4)
  m.ell(cx, cy, 6, 6.5, { z: -3, mat: 'C', rz: 1, a: tilt, pat: c => frac((c.u + 1) * 3) < .45 ? 'B' : null })
  const [bx, by] = rot(31, 27)
  m.ell(bx, by, 16, 7.5, { a: .04 + tilt, pat: stripes, gloss: .5 })
  const [hx, hy] = rot(16, 27)
  m.ell(hx, hy, 8, 7, { z: 2, a: tilt, pat: stripes, gloss: .5 })
  // むなびれ（おおきな うちわ）。
  const open = .35 + fan * .55
  for (let i = 0; i < 9; i++) {
    const ang = .35 + i * .19 * (1 + fan * .5) - fan * .3 + swim * .06
    const len = 22 + fan * 3
    m.tube([rot(24, 30), rot(24 + Math.cos(ang) * len * .5, 30 + Math.sin(ang) * len * .42 * open * 2), rot(24 + Math.cos(ang) * len, 30 + Math.sin(ang) * len * .7 * open * 1.6)], t2 => 1.15 - t2 * .5, { z: 9, mat: 'B', pat: ray })
  }
  for (let i = 0; i < 4; i++) m.tube([rot(13, 29), rot(12 - i, 36 + i * 1.5)], .6, { z: 6, mat: 'C' })
  const [mx, my] = rot(8.5, 28)
  if (gape > .05) m.ell(mx - .5, my + .4, 2.2 + gape, .8 + gape * 1.8, { z: 5.5, mat: 'M', gloss: .2 })
  m.ell(mx, my - gape * .8, 2.6, 1.6, { a: .3 + tilt - gape * .4, z: 5, mat: 'C' })
  if (clip === 'habit' && t > .6 && t < .86) munch(m, mx + 2, my, t)
  const [ex, ey] = rot(14, 25)
  m.eye(ex, ey, 2, 8)
}

export const cone: Builder = (m, pose) => {
  const { clip, t } = pose
  // ゆっくり はう。とくいわざは くちの さきから どくの はり（歯）を のばす。
  const crawl = clip === 'move' ? wave(t, 1) : 0
  // くらし: はなの ような くだを ふって、みずの においで さかなを さがす。
  const sniff = clip === 'habit' ? key(t, [[0, 0], [.1, 1], [.9, 1], [1, 0]]) : 0
  const aim = clip === 'habit' ? key(t, [[0, 0], [.55, 0], [.62, 1], [.85, 1], [.95, 0]]) : 0
  const siphon = clip === 'idle' ? wave(t, 1) : clip === 'move' ? wave(t, 2) * .5 : clip === 'habit' ? wave(t, 3) * 2.6 * (1 - aim) + aim * 2.5 : 0
  const harpoon = clip === 'act' ? key(t, [[0, 0], [.2, 0], [.4, 1], [.55, 1], [.62, 1.5], [.7, 0]]) : 0
  const prey = clip === 'act' ? (t < .62 ? 0 : t < .85 ? 1 : 2) : -1
  const tent: Pattern = c => {
    if (frac(c.l / 8.5 + .1) < .1) return 'B'
    const gx = (c.l / 3.2), gy = (c.s + 1) * 3
    const ix = Math.floor(gx), iy = Math.floor(gy)
    const lx = gx - ix - .5, ly = gy - iy
    if (hash(ix, iy, 21) > .8) return null
    return ly > Math.abs(lx) * 1.6 ? 'C' : ly > Math.abs(lx) * 1.6 - .25 ? 'B' : null
  }
  // あし（やわらかい からだ）。
  m.ell(33 + crawl * .8, 41.5, 19 + crawl * .8, 3.4, { z: -3, mat: 'B', gloss: .3, pat: c => noise(c.u * 9 + 9, c.v * 3, 4) > .66 ? 'C' : null })
  // はなの ような くだ（水を すう）。
  const tipX = 57.5 + siphon * 1.5 + sniff * 1.5, tipY = 30.5 - sniff * 2.5 - aim * 1.5
  m.tube([[50, 39], [55 + siphon, 35 - sniff], [tipX, tipY]], t2 => 1.6 - t2 * .4, { z: 4, mat: 'B', gloss: .3, pat: c => frac(c.l / 2) < .3 ? 'C' : null })
  m.ell(tipX, tipY - .5, 1.6, 1.2, { z: 5, mat: 'C', gloss: .2 })
  if (sniff > .5) {
    // みずに とけた においの つぶが くだへ すいこまれる。
    for (let i = 0; i < 4; i++) {
      const k = frac(t * 2.4 + i / 4)
      m.dot(lerp(64, tipX + 1, k), lerp(26 + i * 3, tipY, k) + Math.sin(k * 9 + i) * 1.2, '#d8f4f4', .9 - k * .5)
    }
  }
  if (clip === 'habit' && t > .55) fishling(m, t < .85 ? lerp(68, 56, span(t, .55, .68)) : lerp(56, 70, span(t, .85, 1)), 18, 6, t < .85 ? 1 : -1, wave(t, 6) * .6, 1.4)
  // かいがら（ちずの ような もよう）。
  m.tube([[6, 30], [10, 29.5], [16, 29]], t2 => 1.2 + t2 * 8.6, { pat: c => frac(c.t * 4) < .22 ? 'B' : null, gloss: .9 })
  m.tube([[16, 29], [30, 32], [43, 35], [53, 37.5]], t2 => 10.5 * (1 - t2) + 1, { pat: tent, gloss: .9 })
  if (harpoon > 0) {
    // くち（ふくらむ ふくろ）と どくの はり。
    m.ell(52, 40, 2 + harpoon, 1.5 + harpoon * .5, { z: 6, mat: 'M', gloss: .4 })
    const reach = Math.min(1, harpoon) * 9
    m.tube([[53, 40], [53 + reach, 40 - reach * .2]], t2 => lerp(.9, .6, t2), { z: 7, mat: 'M', gloss: .4 })
    m.tube([[53 + reach, 40 - reach * .2], [55 + reach, 40 - reach * .3]], .5, { z: 8, mat: 'F', gloss: .8 })
  }
  if (prey >= 0 && prey < 2) {
    // ちいさな さかなが ちかづいて、さされて うごかなくなる。
    const px = prey === 0 ? 63 - t * 8 : 59
    m.ell(px, 37, 2, 1.1, { z: 9, mat: 'S', gloss: .8 }).dot(px + 2, 37, '#9fb8c0').dot(px - 1, 36.5, '#1b1f2e')
    if (prey === 1) m.dot(px, 34, '#fffbe0').dot(px + 2, 33, '#fffbe0')
  }
}

export const starfish: Builder = (m, pose) => {
  const { clip, t } = pose
  // うでを なみの ように うごかして ゆっくり すすむ。とくいわざは うでの さきを もちあげる。
  const arms = 13
  const curl = clip === 'act' ? key(t, [[0, 0], [.25, 1], [.8, 1], [1, 0]]) : 0
  const walk = clip === 'move' || clip === 'idle' ? t : clip === 'habit' ? t * 2 : 0
  // くらし: サンゴの うえに のって たべる。どいた あとの サンゴは しろく なる。
  const over = clip === 'habit' ? key(t, [[0, 0], [.12, 0], [.34, 1], [.7, 1], [.9, 0]]) : 0
  const dx = -9 * over
  if (clip === 'habit') {
    const eaten = t > .55
    const mat: Mat = eaten ? 'F' : 'M'
    const branches: [Pt, Pt, Pt][] = [[[8, 47], [8, 41], [7, 35]], [[8, 43], [4, 40], [2.5, 35.5]], [[8, 42], [12, 39], [13, 34]], [[8, 44], [13, 44], [15.5, 40]], [[8, 44], [3, 45], [1, 41.5]]]
    for (const pts of branches) m.tube(pts, t2 => lerp(1.6, 1, t2), { z: -1, mat, gloss: .4, pat: c => !eaten && frac(c.l / 2.2) < .25 ? 'C' : null })
    if (eaten && t > .82) m.dot(6, 33, '#fffbe0').dot(14, 37, '#fffbe0').dot(2, 39, '#fffbe0')
  }
  for (let k = 0; k < arms; k++) {
    const th = (k / arms) * TAU + .1
    const ux = Math.cos(th), dy = Math.sin(th) * .55
    const wv = Math.sin(walk * TAU + k * 1.3) * (clip === 'move' ? 1.6 : .6)
    const lift = curl * (2.5 + (k % 3)) + Math.max(0, wv)
    const reach = 23 + (clip === 'move' ? Math.cos(walk * TAU + k * 1.3) : 0)
    const pts: Pt[] = [[32 + dx + ux * 4, 28 + dy * 4], [32 + dx + ux * 14, 28 + dy * 14 - lift * .3], [32 + dx + ux * reach, 28 + dy * reach + 1 - lift]]
    m.tube(pts, t2 => 4 - t2 * 2.6, { z: Math.sin(th) * 6 - 1, flat: .6, gloss: .5, pat: c => noise(c.l * .6, (c.s + 1) * 2, 8) > .7 ? 'C' : null })
    for (let j = 1; j < 4; j++) {
      const [px, py] = spline(pts, j / 4)
      m.tube([[px, py], [px + ux * 1.5, py - 3 - curl]], .6, { z: Math.sin(th) * 6 + 2, mat: 'C' })
    }
  }
  m.ell(32 + dx, 27, 12 * (1 + over * wave(t, 4) * .03), 7, { z: 2, rz: 4, gloss: .5, pat: c => noise((c.u + 1) * 4, (c.v + 1) * 3, 12) < .35 ? 'B' : null })
  for (let k = 0; k < 14; k++) {
    const th = hash(k, 1, 5) * TAU, rr = 2 + hash(k, 2, 5) * 8
    const x = 32 + dx + Math.cos(th) * rr, y = 27 + Math.sin(th) * rr * .55
    const sway = clip === 'idle' ? wave(t, 1, k * .1) * .6 : 0
    m.tube([[x, y], [x + Math.cos(th) * 1.5 + sway, y - 3.2 - curl * .5]], .55, { z: 7, mat: 'C' })
  }
}

export const urchin: Builder = (m, pose) => {
  const { clip, t } = pose
  // ながい とげを ゆらゆら。とくいわざは とげを まとめて ふりむける（あいてへ むける）。
  const aim = clip === 'act' ? key(t, [[0, 0], [.25, 1], [.75, 1], [1, 0]]) : 0
  const n = 46, golden = Math.PI * (3 - Math.sqrt(5))
  // くらし: からだの したの くちで 海そうを かじって みじかく する。
  const weed = clip === 'habit' ? key(t, [[0, 0], [.08, 1], [.22, 1], [.85, .25], [.92, .25], [1, 0]]) : 0
  const seaweed = (front: boolean) => {
    for (let j = 0; j < 7; j++) {
      if ((j % 2 === 0) !== front) continue
      const x = 17 + j * 5, h = (6 + (j % 3) * 2.5) * weed, sw = wave(t, 2, j * .2)
      if (h < .5) continue
      m.tube([[x, 47.5], [x + sw * .6, 47.5 - h * .5], [x + sw * 1.4, 47.5 - h]], t2 => lerp(1, .45, t2), { z: front ? 13 : -13, mat: 'L', gloss: .4 })
    }
  }
  const spine = (front: boolean) => {
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 1.4
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      const th = golden * i
      let d = [Math.cos(th) * r, -y, Math.sin(th) * r]
      if ((d[2] > 0) !== front) continue
      const sway = clip === 'act' ? 0 : Math.sin((t * (clip === 'move' ? 2 : 1) + i * .13) * TAU) * .12
      d = [d[0] + sway - aim * .55, d[1] - aim * .15, d[2]]
      const len = 19 + hash(i, 1, 4) * 6
      let ex = 32 + d[0] * len, ey = 31 + d[1] * len * .9
      if (ey > 46) { ex = 32 + d[0] * len * .7; ey = 46 }
      m.tube([[32 + d[0] * 8, 31 + d[1] * 6], [ex, ey]], t2 => .9 - t2 * .55, { z: d[2] * 12, mat: 'B', pat: c => frac(c.l / 4) < .3 ? 'A' : null })
    }
  }
  spine(false)
  if (weed) seaweed(false)
  m.ell(32, 33, 11, 8.5, { z: 0, gloss: .6, pat: c => {
    const top = Math.hypot(c.u + .05, c.v + .55)
    if (top < .22) return top < .12 ? 'B' : 'C'
    return frac(Math.atan2(c.v, c.u) * 2) < .12 ? 'B' : null
  } })
  // あおく ひかる てんてん（ガンガゼの め の ような もよう）。
  for (let i = 0; i < 5; i++) {
    const glint = clip === 'idle' ? (Math.floor(t * 10) + i) % 5 === 0 : aim > .5
    m.ell(26 + i * 3, 30 + (i % 2) * 3, .9, .9, { z: 9, mat: glint ? 'G' : 'W', gloss: 0, glow: true })
  }
  spine(true)
  if (weed) {
    seaweed(true)
    if (t > .22 && t < .86) {
      munch(m, 34, 44, t)
      for (let i = 0; i < 3; i++) { const k = frac(t * 2 + i / 3); m.dot(28 + i * 5 + k * 3, 43 - k * 9, '#8fbf6a', .9 - k * .6) }
    }
  }
}

