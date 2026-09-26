// いきものの ドット絵の もけい（みぎむき）。model.ts で やきつけて つかう。
// 1しゅるい 4コマ（しっぽ・ひれ・かさ の うごき）を つくる。

import type { SpeciesId } from './data'
import { hash2 } from './pixel'
import type { Prim, Ramp, Sample } from './model'

// ---------------- いろ（こい → あかるい） ----------------

export const R = {
  orange: ['#5a1804', '#b23e08', '#ec6c14', '#ff9a3a', '#ffd08a'],
  white: ['#3c4260', '#8a92b0', '#cad2e4', '#eef2fa', '#ffffff'],
  black: ['#08060e', '#16121e', '#262030', '#3a3246', '#56506a'],
  neon: ['#06204e', '#0a5cb8', '#18a8f4', '#62e4ff', '#d0ffff'],
  red: ['#3a0610', '#8a1426', '#d42a36', '#f45a52', '#ffa08c'],
  silver: ['#2a3246', '#667490', '#a6b6cc', '#d8e4f0', '#ffffff'],
  olive: ['#1a2210', '#3a4a22', '#6a7a3a', '#a0ac60', '#d6dca0'],
  fin: ['#4a6078', '#8aa4c0', '#c0d8ec', '#e4f2ff', '#ffffff'],
  gold: ['#4a2806', '#9a5a0a', '#e0a018', '#ffd040', '#fff6b0'],
  royal: ['#0a1450', '#1434a0', '#2462dc', '#4c9cff', '#a8dcff'],
  navy: ['#04061c', '#0a1038', '#161e5a', '#26307a', '#3c4a9a'],
  tan: ['#3a2c10', '#7a6230', '#bea060', '#e6d090', '#fff4cc'],
  brown: ['#1e1206', '#3e2810', '#664420', '#8a6434', '#b08a58'],
  cream: ['#4a4030', '#8a7c60', '#cabca0', '#eee4cc', '#fffcf0'],
  jelly: ['#5a2270', '#a04ab4', '#e08ee0', '#ffc6f2', '#ffffff'],
  jellyIn: ['#7a2a60', '#c04a90', '#f07ab8', '#ffb0d8', '#ffe8f4'],
  crab: ['#3a0806', '#7e1a0c', '#cc3818', '#f26a34', '#ffb07a'],
  eel: ['#4a4a44', '#8e8c80', '#cfcbb8', '#f0ecdc', '#ffffff'],
  shell: ['#141e0a', '#32461a', '#5a7428', '#8ca040', '#c8d470'],
  shellRim: ['#2a200a', '#5a4418', '#94742c', '#c8a44c', '#f0d890'],
  skin: ['#1c2c28', '#3a5a4c', '#62866e', '#90b490', '#cce4c0'],
  shark: ['#141c2c', '#2e3e58', '#566c88', '#8aa0b8', '#c2d4e4'],
  seahorse: ['#4a1a04', '#9a4a0a', '#e08a18', '#ffbe3a', '#fff0a0'],
  octo: ['#380604', '#7a160a', '#bc2e18', '#e2542e', '#ff9464'],
  sucker: ['#5a2226', '#9a4e50', '#d08884', '#ecb2a8', '#ffdcd0'],
  squid: ['#5a3a4a', '#a07888', '#e0c2cc', '#f8e6ec', '#ffffff'],
  squidDot: ['#4a1a10', '#8a3420', '#c85a34', '#e88a58', '#ffc49a'],
  moray: ['#1a1e06', '#3e4610', '#72801c', '#a8b432', '#dce274'],
  morayDark: ['#0c0e04', '#1e2408', '#34400e', '#4e5c1a', '#6e7c2c'],
  ray: ['#16181e', '#343c4c', '#5e6a82', '#909eb4', '#cad6e4'],
} satisfies Record<string, Ramp>

export type Model = { w: number; h: number; prims: Prim[] }

const TAU = Math.PI * 2

/** しましま（たての おび）: px が band の なかなら 色を かえる。 */
function stripe(px: number, center: number, half: number, edge: number, fill: Ramp, rim: Ramp) {
  const d = Math.abs(px - center)
  if (d < half) return fill
  if (d < half + edge) return rim
  return null
}

// ---------------- さかな ----------------

function clown(f: number): Model {
  const w = 25, h = 16, cy = 8
  const wag = Math.sin(f / 4 * TAU)
  const bandPat = (s: Sample) => {
    const v = s.v
    const a = stripe(s.px, 16.2 - v * v * 1.4, 1.05, .7, R.white, R.black)
    if (a) return { ramp: a }
    const b = stripe(s.px, 10.8 + v * v * .6, 1.15, .7, R.white, R.black)
    if (b) return { ramp: b }
    return undefined
  }
  const finRim = (limit: (s: Sample) => boolean) => (s: Sample) => (limit(s) ? { ramp: R.black, flat: .45 } : undefined)
  return {
    w, h, prims: [
      { t: 'ell', x: 3.8, y: cy + wag * .9, rx: 3.1, ry: 4.6, ramp: R.orange, flat: .62, pat: s => (s.u < -.62 ? { ramp: R.black, flat: .5 } : { shift: s.v * -.1 }) },
      { t: 'poly', pts: [[7.5, cy - 3], [9.5, cy - 6.6], [12, cy - 7.2], [14, cy - 5.6], [15.5, cy - 7], [18, cy - 6], [19, cy - 3]], ramp: R.orange, flat: .6, pat: finRim(s => s.py < cy - 5.7) },
      { t: 'poly', pts: [[9.5, cy + 3], [11, cy + 6.8], [13.8, cy + 6.4], [15, cy + 3]], ramp: R.orange, flat: .6, pat: finRim(s => s.py > cy + 5.6) },
      {
        t: 'ell', x: 7.2, y: cy + wag * .25, rx: 2.8, ry: 2.8, ramp: R.orange,
        pat: s => { const r = stripe(s.px, 6.3, .8, .7, R.white, R.black); return r ? { ramp: r } : undefined },
      },
      { t: 'ell', x: 14, y: cy, rx: 9, ry: 5.1, ramp: R.orange, gloss: .35, pat: bandPat },
      { t: 'ell', x: 13.4, y: cy + 2.4, rx: 1.8, ry: 1.1, rot: .45 + wag * .25, ramp: R.orange, flat: .9, alpha: .85, pat: s => (s.u > .55 ? { ramp: R.black, flat: .5 } : undefined) },
      { t: 'eye', x: 20, y: cy - 1.3, r: 1.2, iris: '#f0a040' },
      { t: 'px', x: 22.6, y: cy + 1.2, color: '#7a2a08' },
    ],
  }
}

function neon(f: number): Model {
  const w = 16, h = 9, cy = 4.5
  const wag = Math.sin(f / 4 * TAU)
  return {
    w, h, prims: [
      { t: 'poly', pts: [[4.5, cy - .7], [1, cy - 3 + wag], [2.6, cy + wag * .4], [1, cy + 3 + wag], [4.5, cy + .7]], ramp: R.fin, flat: .7, alpha: .6 },
      { t: 'poly', pts: [[6.5, cy - 1.6], [8, cy - 4], [9.4, cy - 1.8]], ramp: R.fin, flat: .7, alpha: .55 },
      {
        t: 'ell', x: 8.8, y: cy, rx: 6.2, ry: 2.5, ramp: R.silver, gloss: .5,
        pat: s => {
          if (s.v < -.62) return { ramp: R.olive }
          if (s.v < .04 && s.u > -.85) return { ramp: R.neon, shift: .22 }
          if (s.v >= .04 && s.u < .42) return { ramp: R.red, shift: .08 }
          return undefined
        },
      },
      { t: 'eye', x: 13, y: cy - .6, r: .9, iris: '#bfe6ff' },
    ],
  }
}

function angel(f: number): Model {
  const w = 22, h = 29, cy = 14.5
  const wag = Math.sin(f / 4 * TAU)
  const bands = (px: number) => stripe(px, 8.6, .9, 0, R.black, R.black) ?? stripe(px, 13.3, .8, 0, R.black, R.black) ?? stripe(px, 17, .5, 0, R.black, R.black)
  const finPat = (s: Sample) => { const b = bands(s.px); return b ? { ramp: b, flat: .45, alpha: .85 } : undefined }
  return {
    w, h, prims: [
      { t: 'poly', pts: [[7, cy - 1.8], [2.2, cy - 5.5 + wag], [.8, cy - 5 + wag], [2.8, cy + wag * .3], [.8, cy + 5 + wag], [2.2, cy + 5.5 + wag], [7, cy + 1.8]], ramp: R.silver, flat: .7, alpha: .6 },
      { t: 'poly', pts: [[14.5, cy - 5.6], [5.6 + wag * .3, cy - 14], [3.6 + wag * .3, cy - 13], [6, cy - 3]], ramp: R.silver, flat: .68, alpha: .8, pat: finPat },
      { t: 'poly', pts: [[14.5, cy + 5.6], [5.6 + wag * .3, cy + 14], [3.6 + wag * .3, cy + 13], [6, cy + 3]], ramp: R.silver, flat: .62, alpha: .8, pat: finPat },
      { t: 'cap', x1: 13.5, y1: cy + 4, x2: 11.5 + wag * .4, y2: cy + 13.5, r1: .8, r2: .4, ramp: R.silver, flat: .8, alpha: .85 },
      {
        t: 'ell', x: 12.5, y: cy, rx: 7, ry: 6.6, ramp: R.silver, gloss: .6,
        pat: s => { const b = bands(s.px); if (b) return { ramp: b, flat: .45 }; if (s.v < -.55) return { ramp: R.gold, shift: -.05 }; return undefined },
      },
      { t: 'ell', x: 15.5, y: cy + 2.2, rx: 1.8, ry: 1, rot: .6 + wag * .3, ramp: R.fin, flat: .8, alpha: .7 },
      { t: 'eye', x: 17.6, y: cy - 1.6, r: 1.1, iris: '#d42a2a' },
      { t: 'px', x: 19.2, y: cy + 1, color: '#48506a' },
    ],
  }
}

function tang(f: number): Model {
  const w = 27, h = 18, cy = 9
  const wag = Math.sin(f / 4 * TAU)
  const cx = 15, rx = 9.8, ry = 6
  // くろい「パレット」もよう。
  const palette = (s: Sample) => {
    const u = (s.px - cx) / rx, v = (s.py - cy) / ry
    const o = ((u + .05) / .78) ** 2 + ((v + .22) / .56) ** 2
    const i = ((u + .02) / .42) ** 2 + ((v + .28) / .24) ** 2
    if (o < 1 && i > 1) return true
    if (u < -.55 && Math.abs(v - (.12 + (u + .55) * .25)) < .22) return true
    return false
  }
  return {
    w, h, prims: [
      {
        t: 'poly', pts: [[6, cy - 2], [1, cy - 6.2 + wag], [2.8, cy + wag * .4], [1, cy + 6.2 + wag], [6, cy + 2]], ramp: R.gold, flat: .7,
        pat: s => (Math.abs(s.py - cy - wag * .5) > 4.4 ? { ramp: R.navy, flat: .5 } : undefined),
      },
      { t: 'poly', pts: [[7, cy - 4], [9, cy - 7.6], [18.5, cy - 7.6], [22, cy - 4.6]], ramp: R.navy, flat: .55, pat: s => (s.py < cy - 6.7 ? { ramp: R.royal, flat: .8 } : undefined) },
      { t: 'poly', pts: [[8, cy + 4], [9.5, cy + 7.4], [17.5, cy + 7.4], [20, cy + 4.6]], ramp: R.navy, flat: .55, pat: s => (s.py > cy + 6.6 ? { ramp: R.royal, flat: .8 } : undefined) },
      { t: 'ell', x: 7, y: cy + wag * .2, rx: 3, ry: 2.4, ramp: R.royal },
      { t: 'ell', x: cx, y: cy, rx, ry, ramp: R.royal, gloss: .4, pat: s => (palette(s) ? { ramp: R.navy, shift: .05 } : undefined) },
      { t: 'ell', x: 17.2, y: cy + 1.8, rx: 2.5, ry: 1.3, rot: .45 + wag * .25, ramp: R.gold, flat: .75, edge: true, alpha: .9 },
      { t: 'px', x: 6.5, y: cy - .5, color: '#ffe060' },
      { t: 'eye', x: 21.6, y: cy - 1.8, r: 1.25 },
      { t: 'px', x: 24.4, y: cy + .6, color: '#0a1038' },
    ],
  }
}

function spots(s: Sample, scale: number, density: number) {
  return hash2(Math.floor(s.px / scale), Math.floor(s.py / scale), 71) < density
}

function puffer(f: number): Model {
  const w = 23, h = 18, cy = 9
  const wag = Math.sin(f / 4 * TAU)
  return {
    w, h, prims: [
      { t: 'poly', pts: [[5, cy - 1.6], [1, cy - 3.8 + wag], [1.8, cy + wag * .3], [1, cy + 3.8 + wag], [5, cy + 1.6]], ramp: R.tan, flat: .65, alpha: .85 },
      { t: 'poly', pts: [[6.5, cy - 4.5], [5, cy - 7.4 + wag * .4], [8.5, cy - 5.4]], ramp: R.tan, flat: .6, alpha: .8 },
      {
        t: 'ell', x: 12.5, y: cy, rx: 8.6, ry: 6.4, ramp: R.tan, gloss: .3,
        pat: s => {
          if (s.v > .4) return { ramp: R.cream }
          if (spots(s, 2.6, .28) && s.v < .25) return { ramp: R.brown, shift: .15 }
          if ((Math.floor(s.px) + Math.floor(s.py) * 2) % 5 === 0 && s.v < .3) return { shift: -.18 }
          return undefined
        },
      },
      { t: 'ell', x: 15.2, y: cy + 1.4, rx: 1.6, ry: 1.8 + wag * .5, ramp: R.tan, flat: .75, alpha: .8, edge: true },
      { t: 'eye', x: 18, y: cy - 2.4, r: 1.9, iris: '#c8d858' },
      { t: 'px', x: 21.4, y: cy + 1, color: '#5a4418' },
    ],
  }
}

/** ふくらんだ ハリセンボン。 */
export function pufferPuffed(f: number): Model {
  const w = 29, h = 28, cx = 14, cy = 14, r = 9.6
  const wag = Math.sin(f / 4 * TAU)
  const prims: Prim[] = [
    { t: 'poly', pts: [[5.5, cy - 1.4], [1.5, cy - 3.2 + wag], [1.5, cy + 3.2 + wag], [5.5, cy + 1.4]], ramp: R.tan, flat: .65, alpha: .85 },
  ]
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * TAU + .1
    prims.push({ t: 'cap', x1: cx + Math.cos(a) * (r - 1), y1: cy + Math.sin(a) * (r - 1), x2: cx + Math.cos(a) * (r + 3.4), y2: cy + Math.sin(a) * (r + 3.4), r1: 1.1, r2: .35, ramp: R.tan, flat: .75 })
  }
  prims.push(
    {
      t: 'ell', x: cx, y: cy, rx: r, ry: r, ramp: R.tan, gloss: .45,
      pat: s => {
        if (s.v > .45) return { ramp: R.cream }
        if (spots(s, 3, .26) && s.v < .3) return { ramp: R.brown, shift: .15 }
        return undefined
      },
    },
    { t: 'ell', x: cx + 3, y: cy + 3, rx: 1.6, ry: 1.8 + wag * .5, ramp: R.tan, flat: .75, alpha: .8, edge: true },
    { t: 'eye', x: cx + 5.2, y: cy - 3, r: 2.1, iris: '#c8d858' },
    { t: 'ell', x: cx + 8.6, y: cy + 1.4, rx: 1.3, ry: 1.1, ramp: R.brown, flat: .3 },
  )
  return { w, h, prims }
}

function seahorse(f: number): Model {
  const w = 15, h = 23
  const flutter = Math.sin(f / 4 * TAU)
  const ridge = (s: Sample) => (Math.floor(s.py) % 2 === 0 ? { shift: -.12 } : undefined)
  // しっぽの うずまき。
  const tail: [number, number, number][] = [[6.6, 14, 2.2], [6.8, 16.5, 1.7], [7.6, 18.6, 1.4], [8.8, 20, 1.1], [9.6, 19, .9], [9, 17.8, .8], [8, 18.3, .7]]
  const prims: Prim[] = [
    { t: 'ell', x: 3.4, y: 11, rx: 1.6 + flutter * .5, ry: 2.4, ramp: R.gold, flat: .75, alpha: .6 },
  ]
  for (let i = 0; i < tail.length - 1; i++) {
    const [x1, y1, r1] = tail[i], [x2, y2, r2] = tail[i + 1]
    prims.push({ t: 'cap', x1, y1, x2, y2, r1, r2, ramp: R.seahorse, pat: ridge })
  }
  prims.push(
    { t: 'ell', x: 6.8, y: 10.6, rx: 3.3, ry: 4.8, ramp: R.seahorse, pat: ridge, gloss: .2 },
    { t: 'ell', x: 8, y: 11.6, rx: 2.6, ry: 3.6, ramp: R.seahorse, pat: s => (Math.floor(s.py) % 2 === 0 ? { shift: -.08 } : { shift: .08 }) },
    { t: 'cap', x1: 6.4, y1: 7, x2: 6.8, y2: 4.2, r1: 2.2, r2: 2.3, ramp: R.seahorse, pat: ridge },
    { t: 'ell', x: 7.4, y: 3.8, rx: 2.8, ry: 2.3, ramp: R.seahorse, gloss: .3 },
    { t: 'cap', x1: 9, y1: 4.2, x2: 13, y2: 5, r1: 1.2, r2: .9, ramp: R.seahorse },
    { t: 'cap', x1: 6.2, y1: 2.2, x2: 5.4, y2: .9, r1: .9, r2: .6, ramp: R.seahorse, shift: .1 },
    { t: 'ell', x: 7.8, y: 7.4, rx: 1.3, ry: .9, ramp: R.gold, flat: .7, alpha: .7, edge: true },
    { t: 'eye', x: 8, y: 3.4, r: .95, iris: '#fff0a0' },
  )
  return { w, h, prims }
}

function jelly(f: number): Model {
  const w = 19, h = 26, cx = 9.5
  const p = (Math.sin(f / 4 * TAU) + 1) / 2
  const rx = 7.4 - p * 1.3, ry = 5.4 + p * .9, top = 2.2
  const bell = top + ry
  const prims: Prim[] = []
  // ほそい しょくしゅ。
  for (let i = 0; i < 5; i++) {
    const x = cx - rx * .8 + i * rx * .4
    const sway = Math.sin(f / 4 * TAU + i) * 1.2
    prims.push({ t: 'cap', x1: x, y1: bell - 1, x2: x + sway, y2: bell + 7 + p * 2, r1: .5, r2: .5, ramp: R.jelly, flat: .7, alpha: .45 })
    prims.push({ t: 'cap', x1: x + sway, y1: bell + 7 + p * 2, x2: x - sway * .6, y2: bell + 13 - p, r1: .5, r2: .4, ramp: R.jelly, flat: .75, alpha: .38 })
  }
  // くちの うで。
  for (let i = 0; i < 3; i++) {
    const x = cx - 2 + i * 2
    const s = Math.sin(f / 4 * TAU + i * 2) * 1.4
    prims.push({ t: 'cap', x1: x, y1: bell - 1.5, x2: x + s, y2: bell + 5, r1: 1.2, r2: 1, ramp: R.jellyIn, flat: .7, alpha: .7 })
    prims.push({ t: 'cap', x1: x + s, y1: bell + 5, x2: x - s * .5, y2: bell + 9.5, r1: 1, r2: .5, ramp: R.jellyIn, flat: .75, alpha: .6 })
  }
  prims.push(
    { t: 'ell', x: cx, y: bell, rx, ry, ramp: R.jelly, alpha: .62, gloss: .8, pat: s => (s.v > .15 ? { skip: true } : undefined) },
  )
  // なかの よつば もよう。
  for (let i = 0; i < 4; i++) {
    const a = (i + .5) / 4 * Math.PI
    prims.push({ t: 'ell', x: cx - Math.cos(a) * rx * .45, y: bell - ry * .35 + Math.sin(a) * .6, rx: 1.2, ry: 1, ramp: R.jellyIn, flat: .78, alpha: .75 })
  }
  // かさの ふち。
  for (let i = 0; i <= 6; i++) {
    const x = cx - rx + i * rx / 3
    prims.push({ t: 'ell', x, y: bell + .6, rx: 1.3, ry: .9, ramp: R.jelly, flat: .82, alpha: .7 })
  }
  return { w, h, prims }
}

/** カニ（しょうめん）。wave は はさみを あげる。 */
export function crabModel(f: number, wave: boolean): Model {
  const w = 24, h = 15
  const step = Math.sin(f / 4 * TAU)
  const prims: Prim[] = []
  // あし。
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      const lift = (i % 2 === 0 ? step : -step) * side
      const bx = 12 + side * (3.5 + i * 1.3), by = 9.8 + i * .5
      const kx = 12 + side * (7.2 + i * 1.6), ky = 8.6 + i * .9 - Math.max(0, lift) * 1.2
      const fx = 12 + side * (8.6 + i * 1.8), fy = 13.6
      prims.push({ t: 'cap', x1: bx, y1: by, x2: kx, y2: ky, r1: .95, r2: .8, ramp: R.crab, shift: -.1 })
      prims.push({ t: 'cap', x1: kx, y1: ky, x2: fx, y2: fy - Math.max(0, lift) * 1.2, r1: .8, r2: .45, ramp: R.crab, shift: -.1 })
    }
  }
  prims.push({ t: 'ell', x: 12, y: 8.4, rx: 6.8, ry: 3.9, ramp: R.crab, gloss: .45, pat: s => (spots(s, 2, .12) && s.v < .2 ? { shift: .18 } : undefined) })
  // め。
  prims.push(
    { t: 'cap', x1: 9.8, y1: 5.6, x2: 9.4, y2: 2.6, r1: .7, r2: .6, ramp: R.crab },
    { t: 'cap', x1: 14.2, y1: 5.6, x2: 14.6, y2: 2.6, r1: .7, r2: .6, ramp: R.crab },
  )
  // はさみ。
  for (let side = -1; side <= 1; side += 2) {
    const up = wave ? (f % 2 === 0 ? 1 : .6) : .2
    const ax = 12 + side * 5.2, ay = 8.6
    const cx = 12 + side * (8.6 + up * .6), cy = 6 - up * 3.2
    prims.push({ t: 'cap', x1: ax, y1: ay, x2: cx, y2: cy + 1.4, r1: 1.2, r2: 1.1, ramp: R.crab })
    prims.push({ t: 'ell', x: cx, y: cy, rx: 2.3, ry: 2, ramp: R.crab, gloss: .5, edge: true })
    const open = wave ? (f % 2 === 0 ? 1.2 : .4) : .5
    prims.push({ t: 'ell', x: cx + side * .9, y: cy - 2 - open * .4, rx: .9, ry: 1.4, rot: side * (.4 + open * .3), ramp: R.crab, shift: .08, edge: true })
  }
  prims.push({ t: 'eye', x: 9.4, y: 2.3, r: .85 }, { t: 'eye', x: 14.6, y: 2.3, r: .85 })
  prims.push({ t: 'px', x: 11, y: 10.2, color: '#5a0a06' }, { t: 'px', x: 12, y: 10.6, color: '#5a0a06' }, { t: 'px', x: 13, y: 10.2, color: '#5a0a06' })
  return { w, h, prims }
}

/** チンアナゴ（たて。した が すな の なか）。 */
function eel(f: number): Model {
  const w = 12, h = 30
  const ph = f / 4 * TAU
  const pts: [number, number][] = []
  const N = 14
  for (let i = 0; i <= N; i++) {
    const s = i / N
    let x = 5 + Math.sin(s * 3.2 + ph) * 1.5 * s
    if (s > .82) x += (s - .82) * 10
    pts.push([x, h - 1 - s * 25])
  }
  const prims: Prim[] = []
  const dots = (s: Sample) => (hash2(Math.floor(s.px), Math.floor(s.py), 5) < .07 ? { ramp: R.black, flat: .55 } : undefined)
  for (let i = 0; i < N; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]
    prims.push({ t: 'cap', x1, y1, x2, y2, r1: 1.8, r2: 1.8, ramp: R.eel, pat: dots })
  }
  const [hx, hy] = pts[N]
  prims.push(
    { t: 'ell', x: hx + .6, y: hy + .4, rx: 2.3, ry: 2, ramp: R.eel, gloss: .3 },
    { t: 'eye', x: hx + 1.3, y: hy - .2, r: 1.05 },
    { t: 'px', x: hx + 2.6, y: hy + 1.4, color: '#4a4a44' },
  )
  return { w, h, prims }
}

/** ウミガメの こうら（ほねもよう）。 */
function scutes(s: Sample) {
  const cells: [number, number][] = [[15, 7], [20.5, 6.2], [26, 7.4], [12, 10.6], [18, 10.4], [24, 10.8], [29.5, 10.4]]
  let a = Infinity, b = Infinity
  for (const [x, y] of cells) {
    const d = Math.hypot((s.px - x) * .9, (s.py - y) * 1.3)
    if (d < a) { b = a; a = d } else if (d < b) b = d
  }
  return b - a < .9
}

function turtle(f: number): Model {
  const w = 44, h = 24
  const swing = Math.sin(f / 4 * TAU)
  return {
    w, h, prims: [
      { t: 'cap', x1: 12, y1: 13, x2: 6.5, y2: 15.5 + swing * 1.5, r1: 2.2, r2: 1.1, ramp: R.skin, shift: -.1 },
      { t: 'cap', x1: 28, y1: 11.5, x2: 35, y2: 5.5 - swing * 2.4, r1: 2.3, r2: 1, ramp: R.skin, shift: -.25 },
      { t: 'cap', x1: 9.5, y1: 12.5, x2: 6.5, y2: 13, r1: 1.2, r2: .6, ramp: R.skin },
      { t: 'ell', x: 21, y: 13.8, rx: 10.5, ry: 2.8, ramp: R.cream, shift: -.05 },
      { t: 'cap', x1: 30, y1: 12, x2: 34, y2: 10.8, r1: 2.4, r2: 2.2, ramp: R.skin },
      {
        t: 'ell', x: 21, y: 11, rx: 11.6, ry: 7, ramp: R.shell, gloss: .5,
        pat: s => {
          if (s.v > .62) return { skip: true }
          if (s.v > .36) return { ramp: R.shellRim, shift: Math.floor(s.px) % 3 === 0 ? -.25 : 0 }
          if (scutes(s)) return { ramp: R.shell, shift: -.35 }
          return { ramp: hash2(Math.floor(s.px / 2), Math.floor(s.py / 2), 9) < .3 ? R.shellRim : R.shell }
        },
      },
      {
        t: 'ell', x: 36.4, y: 10, rx: 4.2, ry: 3.1, ramp: R.skin, gloss: .3,
        pat: s => (hash2(Math.floor(s.px / 1.5), Math.floor(s.py / 1.5), 3) < .22 ? { shift: -.2 } : undefined),
      },
      { t: 'cap', x1: 27, y1: 14, x2: 34, y2: 18.5 + swing * 2.6, r1: 2.8, r2: 1.1, ramp: R.skin, edge: true, pat: s => (s.u > .4 && hash2(Math.floor(s.px), Math.floor(s.py), 4) < .25 ? { shift: -.2 } : undefined) },
      { t: 'eye', x: 37.6, y: 9.2, r: 1.05 },
      { t: 'px', x: 40, y: 11.2, color: '#1c2c28' },
      { t: 'px', x: 39, y: 11.6, color: '#1c2c28' },
    ],
  }
}

function shark(f: number): Model {
  const w = 60, h = 26, cy = 13
  const wg = Math.sin(f / 4 * TAU) * 1.6
  const belly = (s: Sample) => {
    const edge = cy + 1.2 + Math.sin(s.px * .4) * .3
    if (s.py > edge + .8) return { ramp: R.white, shift: -.05 }
    if (s.py > edge - .4 && hash2(Math.floor(s.px), Math.floor(s.py), 2) < .5) return { ramp: R.white, shift: -.1 }
    return undefined
  }
  return {
    w, h, prims: [
      {
        t: 'poly', pts: [[12, cy - 2.2], [3 + wg, cy - 11 + wg * .5], [1 + wg, cy - 10.4 + wg * .5], [6.5 + wg * .5, cy - .4], [3 + wg, cy + 6.8 + wg * .5], [5 + wg, cy + 7 + wg * .5], [12, cy + 2.2]],
        ramp: R.shark, shift: -.05,
      },
      { t: 'poly', pts: [[20, cy + 3], [18.5 + wg * .2, cy + 6.4], [23, cy + 3.8]], ramp: R.shark, flat: .45 },
      { t: 'poly', pts: [[16, cy - 3], [17.4, cy - 6.4], [20.4, cy - 3]], ramp: R.shark, flat: .5 },
      { t: 'cap', x1: 10.5, y1: cy + wg * .3, x2: 22, y2: cy, r1: 2, r2: 4.6, ramp: R.shark, pat: belly },
      {
        t: 'poly', pts: [[27, cy - 5], [31.5, cy - 12.6], [33.8, cy - 12.2], [38.5, cy - 5]], ramp: R.shark,
        pat: s => ({ flat: .5 + (s.px - 27) * .025 }),
      },
      {
        t: 'ell', x: 32, y: cy, rx: 21, ry: 6, ramp: R.shark, gloss: .35,
        pat: s => {
          const b = belly(s)
          if (b) return b
          if (Math.abs(s.v) < .45 && (Math.abs(s.px - 42.3) < .5 || Math.abs(s.px - 43.9) < .5 || Math.abs(s.px - 45.5) < .5)) return { shift: -.3 }
          return undefined
        },
      },
      { t: 'ell', x: 49, y: cy + .3, rx: 9, ry: 4.6, ramp: R.shark, gloss: .35, pat: belly },
      { t: 'poly', pts: [[37, cy + 3], [32.5, cy + 10.6], [35, cy + 10.8], [42.5, cy + 3.6]], ramp: R.shark, edge: true, pat: s => ({ flat: .62 - (s.py - cy - 3) * .05 }) },
      { t: 'eye', x: 51.5, y: cy - 1.6, r: 1.15 },
      { t: 'px', x: 53, y: cy + 2.4, color: '#2e3e58' },
      { t: 'px', x: 54, y: cy + 2.6, color: '#2e3e58' },
      { t: 'px', x: 55, y: cy + 2.6, color: '#2e3e58' },
      { t: 'px', x: 56, y: cy + 2.3, color: '#2e3e58' },
    ],
  }
}

/** タコ（よこむき。ふくろの ような あたまと、きゅうばんの ついた 8ほんの あし）。 */
function octopus(f: number): Model {
  const w = 34, h = 25
  const ph = f / 4 * TAU
  const prims: Prim[] = []
  const suckers = (s: Sample) => (s.v > .45 && Math.floor(s.u * 4) % 2 === 0 ? { ramp: R.sucker, flat: .62 } : undefined)
  // あし 1ぽん: ねもとから ゆるく まがって、さきが くるん。
  const arm = (x: number, y: number, a: number, bend: number, len: number, seed: number, back: boolean) => {
    const n = 7, step = len / n
    for (let j = 0; j < n; j++) {
      const na = a + bend * (j > 4 ? 3 : 1) + Math.sin(ph + seed - j * .7) * .2
      const nx = x + Math.cos(na) * step, ny = y + Math.sin(na) * step
      const r = 2 - j * .22
      prims.push({ t: 'cap', x1: x, y1: y, x2: nx, y2: ny, r1: r, r2: r - .22, ramp: R.octo, shift: back ? -.22 : 0, pat: suckers })
      x = nx; y = ny; a = na
    }
  }
  // おくの 4ほん → てまえの 4ほん。
  arm(14, 13.5, 2.7, -.1, 15, 0, true)
  arm(16, 14, 1.95, .12, 12, 1.6, true)
  arm(18, 14, 1.05, -.14, 11, 3.1, true)
  arm(20, 13.5, .3, .18, 12, 4.7, true)
  arm(13.5, 14, 3, -.14, 16, 2.2, false)
  arm(15.5, 14.5, 2.25, .1, 13, 3.8, false)
  arm(17.5, 14.5, 1.4, -.18, 11, 5.3, false)
  arm(19.5, 14, .55, .22, 12, .8, false)
  const bumps = (s: Sample) => (spots(s, 1.6, .2) ? { shift: -.14 } : undefined)
  prims.push(
    // あたま（ここに めも つく）。
    { t: 'ell', x: 16.4, y: 8.4, rx: 8.2, ry: 6.8, rot: -.22, ramp: R.octo, gloss: .45, pat: bumps },
    { t: 'eye', x: 21.4, y: 10.6, r: 1.35, iris: '#f0c040' },
  )
  return { w, h, prims }
}

/** イカ（うでが まえ・さんかくの ひれが うしろ）。 */
function squid(f: number): Model {
  const w = 28, h = 13, cy = 6.5
  const ph = f / 4 * TAU
  const fin = Math.sin(ph)
  const prims: Prim[] = [
    { t: 'poly', pts: [[9.5, cy], [4.5, cy - 5.6 - fin * .6], [1, cy], [4.5, cy + 5.6 + fin * .6]], ramp: R.squid, flat: .7, alpha: .8 },
  ]
  // うで 2ほん（ながい）。
  for (let i = 0; i < 2; i++) {
    const sway = Math.sin(ph + i * 2) * .9
    const ey = cy - .8 + i * 1.6 + sway
    prims.push(
      { t: 'cap', x1: 19, y1: cy - .4 + i * .8, x2: 25.6, y2: ey, r1: .5, r2: .45, ramp: R.squid, shift: -.08 },
      { t: 'ell', x: 26, y: ey, rx: 1.1, ry: .8, ramp: R.squid, flat: .7 },
    )
  }
  prims.push(
    {
      t: 'cap', x1: 4, y1: cy, x2: 16.5, y2: cy, r1: 1.4, r2: 3.4, ramp: R.squid, gloss: .65, alpha: .95,
      pat: s => (hash2(Math.floor(s.px), Math.floor(s.py), 23) < .16 ? { ramp: R.squidDot, shift: .1 } : undefined),
    },
    { t: 'ell', x: 18.2, y: cy, rx: 2.6, ry: 2.4, ramp: R.squid, edge: true },
  )
  // みじかい うで。
  for (let i = 0; i < 4; i++) {
    const sway = Math.sin(ph + i * 1.3) * .7
    prims.push({ t: 'cap', x1: 19.6, y1: cy - 1.5 + i, x2: 23.8, y2: cy - 2.1 + i * 1.4 + sway, r1: .8, r2: .4, ramp: R.squid, shift: -.04, pat: s => (s.u > .5 && hash2(Math.floor(s.px), Math.floor(s.py), 3) < .3 ? { ramp: R.squidDot } : undefined) })
  }
  prims.push({ t: 'eye', x: 18.4, y: cy - .6, r: 1.3, iris: '#60c8ff' })
  return { w, h, prims }
}

/** ウツボ（ながい からだを くねくね）。 */
function moray(f: number): Model {
  const w = 46, h = 14
  const ph = f / 4 * TAU
  const N = 16
  const pts: [number, number, number][] = []
  for (let i = 0; i <= N; i++) {
    const s = i / N
    pts.push([2 + s * 36, 7.6 + Math.sin(s * 5 - ph) * 2.2 * (1 - s * .8), .9 + Math.min(1, s * 2.2) * 2.6])
  }
  const mottle = (s: Sample) => (hash2(Math.floor(s.px / 2), Math.floor(s.py / 2), 13) < .38 ? { ramp: R.morayDark, shift: .1 } : undefined)
  const prims: Prim[] = []
  // せびれ。
  for (let i = 2; i < N - 2; i++) {
    const [x1, y1, r1] = pts[i], [x2, y2, r2] = pts[i + 1]
    prims.push({ t: 'cap', x1, y1: y1 - r1 + .2, x2, y2: y2 - r2 + .2, r1: 1, r2: 1, ramp: R.moray, flat: .75, alpha: .9 })
  }
  for (let i = 0; i < N; i++) {
    const [x1, y1, r1] = pts[i], [x2, y2, r2] = pts[i + 1]
    prims.push({ t: 'cap', x1, y1, x2, y2, r1, r2, ramp: R.moray, gloss: .3, pat: mottle })
  }
  const [hx, hy] = pts[N]
  const open = f % 2 === 0 ? 1.4 : .5
  prims.push(
    { t: 'cap', x1: hx, y1: hy + 1.2, x2: hx + 6, y2: hy + 1.4 + open, r1: 1.6, r2: 1, ramp: R.moray, shift: -.1 },
    { t: 'ell', x: hx + 2.4, y: hy - .4, rx: 4.6, ry: 2.8, ramp: R.moray, gloss: .4, pat: mottle },
    { t: 'cap', x1: hx + 4, y1: hy - .2, x2: hx + 7, y2: hy + .3, r1: 1.6, r2: 1, ramp: R.moray },
    { t: 'px', x: hx + 5.4, y: hy + 1.6, color: '#fffce8' },
    { t: 'px', x: hx + 3.8, y: hy + 1.4, color: '#fffce8' },
    { t: 'eye', x: hx + 3.4, y: hy - 1.6, r: 1.05, iris: '#e8e060' },
  )
  return { w, h, prims }
}

/** エイ（ななめうえ から みた ひらたい からだ）。 */
function ray(f: number): Model {
  const w = 36, h = 16, cy = 8
  const flap = Math.sin(f / 4 * TAU)
  const dots = (s: Sample) => (s.v < .2 && hash2(Math.floor(s.px), Math.floor(s.py), 31) < .12 ? { ramp: R.white, flat: .85 } : undefined)
  return {
    w, h, prims: [
      { t: 'cap', x1: 13, y1: cy + .5, x2: 1, y2: cy - 1 + flap * .8, r1: 1, r2: .35, ramp: R.ray, shift: -.12 },
      { t: 'poly', pts: [[14, cy - .5], [20, cy - 5.5 - flap * 1.8], [26, cy - 1.5]], ramp: R.ray, shift: -.22, pat: dots },
      { t: 'ell', x: 20.5, y: cy, rx: 9, ry: 3.4, ramp: R.ray, gloss: .45, pat: s => (s.v > .55 ? { ramp: R.cream } : dots(s)) },
      { t: 'poly', pts: [[13, cy + 1], [21, cy + 5.5 + flap * 1.8], [27.5, cy + 1.5]], ramp: R.ray, edge: true, pat: dots },
      { t: 'ell', x: 29, y: cy + .3, rx: 3.6, ry: 2.4, ramp: R.ray, gloss: .3 },
      { t: 'eye', x: 29.8, y: cy - .9, r: 1 },
      { t: 'px', x: 32.2, y: cy + 1.4, color: '#343c4c' },
    ],
  }
}

export const FRAMES = 4

export function creatureModel(id: SpeciesId, f: number): Model {
  switch (id) {
    case 'clown': return clown(f)
    case 'neon': return neon(f)
    case 'angel': return angel(f)
    case 'tang': return tang(f)
    case 'puffer': return puffer(f)
    case 'seahorse': return seahorse(f)
    case 'jelly': return jelly(f)
    case 'crab': return crabModel(f, false)
    case 'eel': return eel(f)
    case 'turtle': return turtle(f)
    case 'shark': return shark(f)
    case 'octopus': return octopus(f)
    case 'squid': return squid(f)
    case 'moray': return moray(f)
    case 'ray': return ray(f)
  }
}
