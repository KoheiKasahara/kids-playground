// すいそうに おく もの の ドット絵もけい。seed で ひとつずつ すこし ちがう かたちに なる。
// かいそう（ゆれる）は render.ts で まいフレーム かく。

import type { DecorKind, FoodKind } from './data'
import { fbm, hash2, rng } from './pixel'
import type { Prim, Ramp, Sample } from './model'
import { R, type Model } from './sprites'

export const P = {
  stone: ['#1a2030', '#3a4658', '#647488', '#98a8b8', '#d0dae2'],
  moss: ['#0e2410', '#1e4a1c', '#3a7a2c', '#6aa840', '#b0d870'],
  wood: ['#24160e', '#4e3422', '#7c5a3c', '#aa8660', '#d8c098'],
  coralPink: ['#4a0c28', '#96204a', '#dc4a70', '#ff8a9c', '#ffd0d4'],
  coralOrange: ['#4a1a08', '#983a10', '#e06a24', '#ffa050', '#ffe0a0'],
  coralPurple: ['#28104a', '#522088', '#8a48c8', '#b88af0', '#e8d0ff'],
  anemone: ['#3a0a30', '#7a1a5a', '#c03a88', '#f070b0', '#ffc0e0'],
  anemoneTip: ['#4a2a08', '#a86a10', '#f0b030', '#ffe070', '#fffac0'],
  clam: ['#2a2430', '#5a5068', '#9a8ea8', '#cac0d4', '#f4f0f8'],
  mantle: ['#08204a', '#10489a', '#2a86d8', '#60c8f0', '#c0f4ff'],
  pearl: ['#6a5a70', '#b0a0b8', '#e4dcec', '#fff8ff', '#ffffff'],
  chestWood: ['#200e06', '#4a2410', '#7a4220', '#a86a38', '#d8a068'],
  castle: ['#3a2a28', '#6a5448', '#a08c76', '#cfbea0', '#f2e6ca'],
  roof: ['#200e38', '#3c1c6a', '#6030a8', '#8a5ad8', '#c0a0ff'],
  clay: ['#3a1608', '#7a3414', '#b85a28', '#e08a48', '#f8c080'],
  teal: ['#0a2a2a', '#1a4a48', '#2e7470', '#5aa89e', '#a8dcd0'],
} satisfies Record<string, Ramp>

// ---------------- いわ ----------------

function rock(seed: number): Model {
  const r = rng(seed)
  const w = 36, h = 24
  const mossy = (s: Sample) => {
    if (s.ny < -.35 && fbm(s.px * .3, s.py * .3, seed + 3, 2) > .48) return { ramp: P.moss, shift: .05 }
    if (hash2(Math.floor(s.px), Math.floor(s.py), seed) < .05) return { shift: .22 }
    if (hash2(Math.floor(s.px / 2), Math.floor(s.py / 2), seed + 1) < .08) return { shift: -.2 }
    return undefined
  }
  const prims: Prim[] = []
  const n = 1 + Math.floor(r() * 2)
  for (let i = 0; i < n; i++) {
    const side = i === 0 ? 0 : (r() < .5 ? -1 : 1)
    const rx = i === 0 ? 11 + r() * 4 : 6 + r() * 3, ry = i === 0 ? 8 + r() * 3 : 5 + r() * 2
    const x = w / 2 + side * (8 + r() * 4)
    prims.push({ t: 'blob', x, y: h - 1 - ry * .55, rx, ry, seed: seed + i * 17, rough: .45, flatBottom: true, ramp: P.stone, gloss: .15, pat: mossy, edge: i > 0 })
  }
  if (prims.length > 1) prims.reverse()
  return { w, h, prims }
}

// ---------------- りゅうぼく・サンゴ（えだ） ----------------

type Branch = { x1: number; y1: number; x2: number; y2: number; r1: number; r2: number; depth: number }

function grow(seed: number, x: number, y: number, angle: number, len: number, r: number, depth: number, spread: number, out: Branch[]) {
  const rand = rng(seed)
  const x2 = x + Math.cos(angle) * len, y2 = y + Math.sin(angle) * len
  const r2 = Math.max(.7, r * .66)
  out.push({ x1: x, y1: y, x2, y2, r1: r, r2, depth })
  if (depth <= 0 || r2 < .8) return
  const kids = 1 + Math.floor(rand() * 2)
  for (let i = 0; i < kids; i++) {
    const turn = (rand() * 2 - 1) * spread + (kids === 2 ? (i === 0 ? -spread * .6 : spread * .6) : 0)
    grow(seed * 31 + i * 7 + 3, x2, y2, angle + turn, len * (.62 + rand() * .2), r2, depth - 1, spread, out)
  }
}

function wood(seed: number): Model {
  const w = 64, h = 42
  const r = rng(seed)
  const out: Branch[] = []
  const dir = r() < .5 ? 1 : -1
  const baseX = dir > 0 ? 6 : w - 6
  // よこに ねた みき から えだが のびる。
  const tip = { x: baseX + dir * (30 + r() * 8), y: h - 12 - r() * 6 }
  out.push({ x1: baseX, y1: h - 4, x2: tip.x, y2: tip.y, r1: 4.2, r2: 2.8, depth: 3 })
  grow(seed + 1, tip.x, tip.y, -Math.PI / 2 + dir * (.5 + r() * .3), 13 + r() * 5, 2.6, 2, .55, out)
  grow(seed + 2, baseX + dir * 16, h - 8.5, -Math.PI / 2 - dir * (.35 + r() * .3), 12 + r() * 6, 2.2, 2, .5, out)
  out.push({ x1: baseX + dir * 4, y1: h - 3.5, x2: baseX - dir * 3, y2: h - 1.5, r1: 3, r2: 1.4, depth: 0 })
  out.push({ x1: tip.x, y1: tip.y, x2: tip.x + dir * 12, y2: h - 2, r1: 2.4, r2: 1.4, depth: 0 })
  const bark = (s: Sample) => {
    const g = fbm(s.u * 14, s.v * 1.6 + s.px * .05, seed + 9, 2)
    if (g > .62) return { shift: .14 }
    if (g < .34) return { shift: -.2 }
    return undefined
  }
  const prims: Prim[] = out.map(b => ({ t: 'cap' as const, ...b, ramp: P.wood, pat: bark, edge: b.depth < 3 }))
  return { w, h, prims: fitInside(prims, w, h) }
}

function coral(seed: number): Model {
  const w = 30, h = 30
  const r = rng(seed)
  const ramp = [P.coralPink, P.coralOrange, P.coralPurple][Math.floor(r() * 3)]
  const out: Branch[] = []
  const n = 2 + Math.floor(r() * 2)
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * .5 + (r() - .5) * .3
    grow(seed + i * 13, w / 2 + (i - (n - 1) / 2) * 2, h - 1.5, a, 8 + r() * 3, 2.6, 3, .6, out)
  }
  const polyp = (s: Sample) => (hash2(Math.floor(s.px), Math.floor(s.py), seed) < .12 ? { shift: .25 } : s.u > .75 ? { shift: .15 } : undefined)
  const prims: Prim[] = out.map(b => ({ t: 'cap' as const, ...b, ramp, pat: polyp, gloss: .2 }))
  return { w, h, prims: fitInside(prims, w, h) }
}

/** はみだした えだを みじかく する。 */
function fitInside(prims: Prim[], w: number, h: number): Prim[] {
  return prims.map(p => {
    if (p.t !== 'cap') return p
    const c = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    return { ...p, x2: c(p.x2, p.r2 + 1, w - p.r2 - 1), y2: c(p.y2, p.r2 + 1, h - p.r2 - 1), x1: c(p.x1, 1, w - 1), y1: c(p.y1, 1, h - 1) }
  })
}

// ---------------- イソギンチャク（ゆれる 6コマ） ----------------

export const ANEMONE_FRAMES = 6

export function anemone(seed: number, f: number): Model {
  const w = 28, h = 22
  const r = rng(seed)
  const ph = f / ANEMONE_FRAMES * Math.PI * 2
  const prims: Prim[] = [
    { t: 'ell', x: w / 2, y: h - 3.5, rx: 8.5, ry: 4, ramp: P.anemone, shift: -.05, pat: s => (Math.floor(s.px) % 3 === 0 ? { shift: -.15 } : undefined) },
  ]
  const back: Prim[] = [], front: Prim[] = []
  const N = 15
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    const bx = w / 2 - 8 + t * 16
    const lean = (t - .5) * 1.6
    const sway = Math.sin(ph + i * .7 + r()) * 1.6
    const len = 8 + Math.sin(t * Math.PI) * 4 + r() * 2
    const mx = bx + lean * len * .4 + sway * .5, my = h - 6 - len * .55
    const tx = bx + lean * len * .8 + sway, ty = h - 6 - len
    const list = i % 2 === 0 ? back : front
    const sh = i % 2 === 0 ? -.2 : 0
    list.push({ t: 'cap', x1: bx, y1: h - 6, x2: mx, y2: my, r1: 1.3, r2: 1.1, ramp: P.anemone, shift: sh })
    list.push({ t: 'cap', x1: mx, y1: my, x2: tx, y2: ty, r1: 1.1, r2: .9, ramp: P.anemone, shift: sh, pat: s => (s.u > .72 ? { ramp: P.anemoneTip } : undefined) })
  }
  return { w, h, prims: [...back, ...prims, ...front] }
}

// ---------------- シャコガイ（ひらき 0〜2） ----------------

export function clam(open: number, pearl: boolean): Model {
  const w = 26, h = 18
  const o = open / 2
  const ribs = (s: Sample) => {
    const k = Math.sin(s.px * 1.25)
    return k > .55 ? { shift: .12 } : k < -.55 ? { shift: -.15 } : undefined
  }
  const prims: Prim[] = [
    { t: 'ell', x: 13, y: h - 5, rx: 11, ry: 4.5, ramp: P.clam, pat: s => (s.v < -.1 ? { skip: true } : ribs(s)) },
  ]
  if (o > 0) {
    prims.push({ t: 'ell', x: 13, y: h - 5.5, rx: 9.6, ry: 1 + o * 3.2, ramp: P.mantle, gloss: .6, pat: s => (hash2(Math.floor(s.px), Math.floor(s.py), 12) < .2 ? { shift: .3 } : undefined) })
    if (pearl) prims.push({ t: 'ell', x: 13, y: h - 6.5 - o * 1.2, rx: 2.3, ry: 2.2, ramp: P.pearl, gloss: 1.2, edge: true })
  }
  prims.push({
    t: 'ell', x: 13, y: h - 5 - o * 5.5, rx: 11, ry: 4.2 + o * .6, ramp: P.clam, gloss: .2, edge: true,
    pat: s => (s.v > .1 + o * .1 ? { skip: true } : ribs(s)),
  })
  return { w, h, prims }
}

// ---------------- たからばこ ----------------

export function chest(open: boolean): Model {
  const w = 26, h = 22
  const plank = (s: Sample) => {
    if (Math.abs(s.px - 7) < 1 || Math.abs(s.px - 19) < 1) return { ramp: R.gold, gloss: .6 }
    return Math.floor(s.py) % 4 === 0 ? { shift: -.2 } : undefined
  }
  const prims: Prim[] = []
  if (open) {
    // うしろに たおれた ふた（うちがわが みえる）。
    prims.push({ t: 'ell', x: 13, y: 7.5, rx: 10.2, ry: 4.2, ramp: P.chestWood, gloss: .2, pat: s => (s.v > 0 ? { skip: true } : plank(s)), edge: true })
    prims.push({ t: 'rect', x: 3, y: 7, w: 20, h: 4.5, ramp: P.chestWood, flat: .18, bevel: 0 })
    prims.push({ t: 'ell', x: 13, y: 12, rx: 8.8, ry: 3.2, ramp: R.gold, gloss: 1, pat: s => (s.v > .35 ? { skip: true } : hash2(Math.floor(s.px), Math.floor(s.py), 4) < .25 ? { shift: .4 } : undefined) })
    prims.push({ t: 'ell', x: 9, y: 9.6, rx: 1.6, ry: 1.6, ramp: R.gold, gloss: 1.2, edge: true }, { t: 'ell', x: 16.5, y: 10, rx: 1.4, ry: 1.4, ramp: P.pearl, gloss: 1.2, edge: true })
  }
  prims.push({ t: 'rect', x: 3, y: 12, w: 20, h: 9, ramp: P.chestWood, bevel: 1.5, pat: plank, edge: true })
  if (!open) prims.push({ t: 'ell', x: 13, y: 12.2, rx: 10.2, ry: 5, ramp: P.chestWood, gloss: .2, pat: s => (s.v > 0 ? { skip: true } : plank(s)), edge: true })
  prims.push({ t: 'rect', x: 11.5, y: 12.5, w: 3, h: 4, ramp: R.gold, gloss: .8, bevel: .8, edge: true })
  prims.push({ t: 'px', x: 13, y: 14.5, color: '#2a1606' })
  return { w, h, prims }
}

// ---------------- おしろ ----------------

/** おしろの まど（よる ひかる）。 */
export const CASTLE_WINDOWS: readonly [number, number, number, number][] = [[8, 26, 2, 3], [34, 26, 2, 3], [21, 18, 2, 4], [18, 30, 2, 3], [24, 30, 2, 3]]

function castle(seed: number): Model {
  const w = 44, h = 52
  const brick = (s: Sample) => {
    const row = Math.floor(s.py / 3)
    const col = Math.floor((s.px + (row % 2) * 2) / 4)
    if (Math.floor(s.py) % 3 === 0 || Math.floor(s.px + (row % 2) * 2) % 4 === 0) return { shift: -.18 }
    if (s.py > h - 8 && hash2(col, row, seed) < .45) return { ramp: P.moss }
    return hash2(col, row, seed + 1) < .2 ? { shift: .1 } : undefined
  }
  const prims: Prim[] = []
  const tower = (x: number, y: number, tw: number, th: number) => {
    prims.push({ t: 'rect', x, y, w: tw, h: th, ramp: P.castle, bevel: 2.5, pat: brick, edge: true })
    for (let i = 0; i < 3; i++) prims.push({ t: 'rect', x: x + i * (tw - 3) / 2, y: y - 3, w: 3, h: 3.5, ramp: P.castle, bevel: 1 })
  }
  tower(14, 12, 16, h - 12)
  tower(3, 20, 11, h - 20)
  tower(30, 20, 11, h - 20)
  prims.push(
    { t: 'poly', pts: [[1.5, 17.5], [8.5, 4], [15.5, 17.5]], ramp: P.roof, pat: s => ({ flat: .35 + (s.px - 1.5) / 14 * .5 - (Math.floor(s.py) % 3 === 0 ? .15 : 0) }), edge: true },
    { t: 'poly', pts: [[28.5, 17.5], [35.5, 4], [42.5, 17.5]], ramp: P.roof, pat: s => ({ flat: .35 + (s.px - 28.5) / 14 * .5 - (Math.floor(s.py) % 3 === 0 ? .15 : 0) }), edge: true },
    { t: 'cap', x1: 22, y1: 9, x2: 22, y2: 1.5, r1: .5, r2: .5, ramp: P.stone, flat: .7 },
    { t: 'poly', pts: [[22.5, 1.5], [28, 3.2], [22.5, 5]], ramp: R.red, flat: .7 },
    { t: 'ell', x: 22, y: h - 4, rx: 4, ry: 6, ramp: R.black, flat: .2, pat: s => (s.v > .6 ? { skip: true } : undefined) },
  )
  for (const [x, y, ww, hh] of CASTLE_WINDOWS) prims.push({ t: 'rect', x, y, w: ww, h: hh, ramp: R.black, flat: .15, bevel: 0 })
  return { w, h, prims }
}

// ---------------- つぼ ----------------

function pot(seed: number): Model {
  const w = 20, h = 24
  const prims: Prim[] = [
    { t: 'cap', x1: 5.3, y1: 5.2, x2: 3.4, y2: 9.5, r1: .9, r2: .9, ramp: P.clay, shift: -.1 },
    { t: 'cap', x1: 14.7, y1: 5.2, x2: 16.6, y2: 9.5, r1: .9, r2: .9, ramp: P.clay, shift: -.1 },
    {
      t: 'lathe', x: 10, y0: 1, y1: h - 1, ramp: P.clay, gloss: .3,
      r: v => (v < .07 ? 4.4 : v < .2 ? 3.2 : 3 + 5.2 * Math.sin(Math.PI * Math.min(1, (v - .15) / .9)) + (v > .9 ? -(v - .9) * 20 : 0)),
      pat: s => {
        if (Math.abs(s.v - .38) < .025 || Math.abs(s.v - .7) < .025) return { shift: -.3 }
        if (s.v > .42 && s.v < .66 && Math.abs(((s.px + Math.abs(Math.sin(s.v * 40)) * 2) % 4) - 2) < .5) return { ramp: R.black, shift: .1 }
        if (hash2(Math.floor(s.px), Math.floor(s.py), seed) < .05) return { shift: -.2 }
        return undefined
      },
    },
    { t: 'ell', x: 10, y: 1.8, rx: 3.6, ry: 1, ramp: R.black, flat: .15 },
  ]
  return { w, h, prims }
}

function bubbler(): Model {
  const w = 14, h = 9
  return {
    w, h, prims: [
      { t: 'blob', x: 7, y: 5.6, rx: 5.6, ry: 3.4, seed: 5, rough: .3, flatBottom: true, ramp: P.teal, gloss: .3, pat: s => (hash2(Math.floor(s.px), Math.floor(s.py), 2) < .18 ? { shift: -.3 } : undefined) },
    ],
  }
}

export function decorModel(kind: DecorKind, seed: number): Model {
  switch (kind) {
    case 'rock': return rock(seed)
    case 'wood': return wood(seed)
    case 'coral': return coral(seed)
    case 'anemone': return anemone(seed, 0)
    case 'clam': return clam(0, false)
    case 'chest': return chest(false)
    case 'castle': return castle(seed)
    case 'pot': return pot(seed)
    case 'bubbler': return bubbler()
    case 'kelp': return kelpIcon(seed)
  }
}

/** かいそうの え（トレイの アイコン用、とまった かたち）。 */
function kelpIcon(seed: number): Model {
  const w = 16, h = 40
  const prims: Prim[] = []
  const r = rng(seed)
  for (let b = 0; b < 3; b++) {
    const bx = 5 + b * 3
    let x = bx, y = h - 1
    const len = 26 + r() * 10
    for (let i = 0; i < 8; i++) {
      const nx = bx + Math.sin(i * .9 + b) * 2, ny = h - 1 - (i + 1) * len / 8
      prims.push({ t: 'cap', x1: x, y1: y, x2: nx, y2: ny, r1: 1.4, r2: 1.2, ramp: P.moss, shift: b === 1 ? .1 : -.05 })
      x = nx; y = ny
    }
  }
  return { w, h, prims }
}

// ---------------- えさ ----------------

export function foodModel(kind: FoodKind): Model {
  if (kind === 'flake') return { w: 4, h: 3, prims: [{ t: 'rect', x: 0, y: 0, w: 3, h: 2, ramp: R.orange, bevel: .5, shift: .1 }] }
  if (kind === 'pellet') return { w: 5, h: 5, prims: [{ t: 'ell', x: 2.5, y: 2.5, rx: 1.8, ry: 1.8, ramp: P.clay, gloss: .5 }] }
  return {
    w: 9, h: 6, prims: [
      { t: 'cap', x1: 1.5, y1: 2, x2: 6.5, y2: 3, r1: 1, r2: 1.6, ramp: R.crab, shift: .15, pat: s => (Math.floor(s.px) % 2 === 0 ? { shift: -.1 } : undefined) },
      { t: 'px', x: 7.4, y: 1.5, color: '#10081a' },
      { t: 'px', x: 8.4, y: 1, color: '#f26a34' },
    ],
  }
}
