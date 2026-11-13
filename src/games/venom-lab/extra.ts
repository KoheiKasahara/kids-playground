// A third, independently authored observation clip for every resident.
// These playful motion studies are separate from the venom / feeding demonstrations.
import type { Model } from './raster'
import { bump, TAU } from './raster'

type Motion = { label: string; animate: (model: Model, t: number) => void }
const shift = (m: Model, x: number, y: number) => {
  for (const p of m.prims) { p.x += x; p.y += y }
}
const bend = (m: Model, amount: number, phase = 0) => {
  for (const p of m.prims) p.y += Math.sin(p.x / 10 + phase) * amount
}
const stretch = (m: Model, x: number, y: number) => {
  for (const p of m.prims) { p.x = 32 + (p.x - 32) * x; p.y = 42 + (p.y - 42) * y; p.rx *= x; p.ry *= y }
}
const ripple = (m: Model, t: number, x: number, y: number, color = '#86cbe0') => {
  const a = bump(t, 0, 1)
  for (let i = 0; i < 32; i++) {
    const angle = i / 32 * TAU
    m.dot(x + Math.cos(angle) * (3 + t * 12), y + Math.sin(angle) * (1 + t * 4), color, a)
  }
}
const leaves = (m: Model, t: number, count: number) => {
  if (t <= 0 || t >= 1) return
  for (let i = 0; i < count; i++) {
    const x = 8 + i * 47 / count + Math.sin(t * TAU + i) * 3
    const y = 36 - bump(t, 0, 1) * (4 + i % 3 * 3)
    m.ell(x, y, 2.5, 1, { mat: 'L', z: 20, a: t * 4 + i })
  }
}
const motion = (label: string, animate: Motion['animate']): Motion => ({ label, animate })
const pulse = (t: number) => bump(t, 0, 1)

export const EXTRA_MOVES: Record<string, Motion> = {
  'blue-ring': motion('みずを はいて すーっと すすむ', (m, t) => { shift(m, -8 * pulse(t), -3 * pulse(t)); ripple(m, t, 48, 28) }),
  stonefish: motion('めを きょろり、しっぽを ひとふり', (m, t) => { for (const p of m.prims) { if (p.x > 48) p.y += Math.sin(t * TAU * 2) * pulse(t) * 5; if (p.mat === 'E') p.x += pulse(t) * 2 } }),
  lionfish: motion('ゆったり ななめに およぐ', (m, t) => { shift(m, 5 * pulse(t), -7 * pulse(t)); bend(m, pulse(t), t * TAU) }),
  'golden-frog': motion('おおきく ぴょーんと ジャンプ', (m, t) => { stretch(m, 1 - .12 * pulse(t), 1 + .08 * pulse(t)); shift(m, -5 * pulse(t), -10 * pulse(t)) }),
  'blue-frog': motion('ちいさく 2かい ぴょんぴょん', (m, t) => { shift(m, -3 * pulse(t), -7 * Math.abs(Math.sin(t * TAU))); ripple(m, t, 30, 43) }),
  'strawberry-frog': motion('はっぱの うえで ぴょこん', (m, t) => { leaves(m, t, 2); shift(m, 4 * pulse(t), -6 * pulse(t)); stretch(m, 1 + .1 * pulse(t), 1 - .1 * pulse(t)) }),
  rattlesnake: motion('すなの うえに なみあとを のこす', (m, t) => { bend(m, 2 * pulse(t), t * TAU); ripple(m, t, 28, 43, '#e3dccb') }),
  'bark-scorpion': motion('はさみを あげて うしろあるき', (m, t) => { shift(m, 7 * pulse(t), 0); for (const p of m.prims) if (p.x < 26) p.y -= 4 * pulse(t) }),
  gila: motion('のっしのっし よこぎる', (m, t) => { shift(m, -7 * pulse(t), -Math.abs(Math.sin(t * TAU * 3)) * pulse(t) * 2) }),
  'sea-krait': motion('みずの なかで くるりと ターン', (m, t) => { stretch(m, 1 - .45 * pulse(t), 1); bend(m, 4 * pulse(t), t * TAU); ripple(m, t, 35, 40) }),
  'geography-cone': motion('からだを のばして じわりと すすむ', (m, t) => { stretch(m, 1 + .12 * pulse(t), 1); shift(m, -4 * pulse(t), 0) }),
  'crown-of-thorns': motion('うでを なみの ように うごかす', (m, t) => { for (const p of m.prims) p.y += Math.sin(Math.atan2(p.y - 28, p.x - 32) * 3 + t * TAU) * 3 * pulse(t) }),
  'long-spined-urchin': motion('とげを ゆらして ゆっくり すすむ', (m, t) => { bend(m, 1.8 * pulse(t), t * TAU * 2); shift(m, -3 * pulse(t), 0) }),
  'eyelash-viper': motion('えだの したで ゆらゆら', (m, t) => { for (const p of m.prims) if (p.mat !== 'P') p.x += Math.sin(t * TAU * 2) * pulse(t) * Math.max(0, p.y - 15) / 5 }),
  bushmaster: motion('おちばを わけて すすむ', (m, t) => { bend(m, 2 * pulse(t), t * TAU); shift(m, -4 * pulse(t), 0); leaves(m, t, 5) }),
  'wandering-spider': motion('よこへ ささっと よける', (m, t) => { shift(m, Math.sin(t * TAU) * 8 * pulse(t), -2 * pulse(t)); stretch(m, 1 + .08 * pulse(t), 1) }),
  'mojave-rattlesnake': motion('しっぽを のこして むきを かえる', (m, t) => { for (const p of m.prims) p.x += Math.sin(t * TAU) * pulse(t) * (55 - p.x) * .18 }),
  deathstalker: motion('しっぽを ゆっくり さゆうに ふる', (m, t) => { for (const p of m.prims) if (p.y < 25) p.x += Math.sin(t * TAU * 2) * pulse(t) * 5 }),
  'hairy-scorpion': motion('すなを けって くるり', (m, t) => { stretch(m, 1 - .25 * pulse(t), 1); shift(m, 3 * pulse(t), 0); ripple(m, t, 43, 42, '#e3dccb') }),
  mamushi: motion('とぐろを ほどいて のびる', (m, t) => { stretch(m, 1 + .18 * pulse(t), 1 - .2 * pulse(t)); shift(m, -2 * pulse(t), 0) }),
  'tiger-keelback': motion('みずべを くねくね すすむ', (m, t) => { bend(m, 3 * pulse(t), t * TAU * 2); ripple(m, t, 24, 43) }),
  'japanese-toad': motion('ちいさな あしで いっぽずつ', (m, t) => { shift(m, -5 * pulse(t), -Math.abs(Math.sin(t * TAU * 2)) * pulse(t)); stretch(m, 1, 1 - .06 * pulse(t)) }),
  'fire-bellied-newt': motion('しっぽを まげて ふりかえる', (m, t) => { for (const p of m.prims) if (p.x > 32) p.y -= Math.sin((p.x - 32) / 12) * pulse(t) * 7 }),
  'giant-hornet': motion('8のじを えがいて とぶ', (m, t) => { shift(m, Math.sin(t * TAU) * 7, Math.sin(t * TAU * 2) * 4) }),
  'red-headed-centipede': motion('からだに なみを つたえる', (m, t) => { bend(m, 4 * pulse(t), -t * TAU * 2); stretch(m, 1 - .12 * pulse(t), 1) }),
  habu: motion('くさを わけて にょろり', (m, t) => { shift(m, -6 * pulse(t), -2 * pulse(t)); leaves(m, t, 3) }),
  'hime-habu': motion('ぺたんと ふせて ひとやすみ', (m, t) => { stretch(m, 1 + .1 * pulse(t), 1 - .3 * pulse(t)) }),
  'sakishima-habu': motion('しっぽから なみを つたえる', (m, t) => { bend(m, 3.5 * pulse(t), t * TAU * 3); shift(m, 2 * pulse(t), 0) }),
  'inland-taipan': motion('すらりと のびて すすむ', (m, t) => { stretch(m, 1 + .2 * pulse(t), 1 - .12 * pulse(t)); shift(m, -3 * pulse(t), -pulse(t)) }),
  'eastern-brown': motion('すばやく みぎへ ひだりへ', (m, t) => { shift(m, Math.sin(t * TAU * 2) * pulse(t) * 6, 0); bend(m, pulse(t), t * TAU) }),
  'death-adder': motion('すなに からだの あとを つける', (m, t) => { stretch(m, 1 + .13 * pulse(t), 1 - .15 * pulse(t)); ripple(m, t, 32, 42, '#c9ac79') }),
  redback: motion('いとに ぶらさがって ゆれる', (m, t) => { const x = Math.sin(t * TAU * 2) * 6 * pulse(t); shift(m, x, -5 * pulse(t)); m.line(32, 1, 32 + x, 22 - 5 * pulse(t), '#e3dccb', pulse(t)) }),
  'black-mamba': motion('あたまを さゆうに みまわす', (m, t) => { for (const p of m.prims) p.y += Math.max(0, 32 - p.x) * .22 * Math.sin(t * TAU) * pulse(t) }),
  'puff-adder': motion('ゆっくり おおきく うねる', (m, t) => { bend(m, 3 * pulse(t), t * Math.PI); stretch(m, 1, 1 - .1 * pulse(t)) }),
  boomslang: motion('えだの うえで せのび', (m, t) => { for (const p of m.prims) if (p.mat !== 'P') { p.y -= pulse(t) * Math.max(0, 42 - p.y) * .18; p.x += pulse(t) * 2 } }),
  'spitting-cobra': motion('フードを たたんで おじぎ', (m, t) => { stretch(m, 1 - .12 * pulse(t), 1 - .25 * pulse(t)); shift(m, -2 * pulse(t), 0) }),
  'king-cobra': motion('たかい あたまで みまわす', (m, t) => { stretch(m, 1 - .08 * pulse(t), 1 + .06 * pulse(t)); for (const p of m.prims) if (p.y < 24) p.x += Math.sin(t * TAU) * pulse(t) * 4 }),
  'monocled-cobra': motion('まるい フードを ななめに かたむける', (m, t) => { for (const p of m.prims) if (p.y < 30) p.y += (p.x - 32) * Math.sin(t * TAU) * pulse(t) * .3 }),
  'banded-krait': motion('しまもようを なみの ように ゆらす', (m, t) => { bend(m, 2.8 * pulse(t), -t * TAU); stretch(m, 1 - .12 * pulse(t), 1 + .08 * pulse(t)) }),
  'mangrove-viper': motion('えだに つかまって のびちぢみ', (m, t) => { for (const p of m.prims) if (p.mat !== 'P') { p.x = 32 + (p.x - 32) * (1 + .18 * pulse(t)); p.y += pulse(t) * 3 } }),
}
