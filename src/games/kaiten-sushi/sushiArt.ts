// おすしと おさらの ドット絵を、レシピから その場で かく。
// かたち（にぎり・ぐんかん・まきもの・てまき）ごとに 形を きめ、
// シャリの つぶ・ネタの もよう・のりの つや を 1ピクセルずつ ぬってから、まわりに こい ふちを つける。
// DOM を つかわないので、すべての くみあわせを テストで かいて たしかめられる。

import { netaDef, plateDef, riceDef, type NetaId, type PlateId, type RiceId, type ToppingId } from './data'
import type { Recipe } from './recipe'
import { PixelBuffer, fromArt, hash2, level, mixPacked, pack, packRamp, type Ramp } from './pixel'

export const SUSHI_W = 40
export const SUSHI_H = 32
/** おすしが おさらに つく たかさ。 */
export const BASE_Y = 28
export const PLATE_W = 48
export const PLATE_H = 18
/** おさらに のせた え の おおきさ。 */
export const DISH_W = 48
export const DISH_H = 42
/** DISH の なかで おさらの まんなか（レーンに おく いち）。 */
export const DISH_ANCHOR = { x: 24, y: 31 }

const rampCache = new Map<string, readonly number[]>()
function ramp(colors: Ramp): readonly number[] {
  const key = colors.join()
  let packed = rampCache.get(key)
  if (!packed) {
    packed = packRamp(colors)
    rampCache.set(key, packed)
  }
  return packed
}

const NORI: Ramp = ['#050c07', '#0c1a10', '#152a19', '#213d25', '#3a5c3c']
const LEAF: Ramp = ['#123a0e', '#22621a', '#3c8c2a', '#68b848', '#b0e284']
const WASABI: Ramp = ['#2c4a10', '#5a8a1c', '#86b832', '#b4dc5a', '#e4f6a6']
const GOLD: Ramp = ['#6a3a04', '#b07010', '#e4a820', '#ffe070', '#fffbe0']
const EBI_TAIL: Ramp = ['#5a0e08', '#a8200e', '#e0401c', '#ff7a4a', '#ffc0a0']
const SAUCE: Ramp = ['#2a0a04', '#4a1808', '#74300e', '#a8501c', '#e09058']
const CHIAI: Ramp = ['#4a0c10', '#8a2028', '#b8404a', '#d86a70', '#f0a0a0']
const LEMON: Ramp = ['#7a5a00', '#c49a0c', '#ecc81c', '#fbe46a', '#fffbc8']

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const frac = (v: number) => v - Math.floor(v)

/** だえん体の むきから あかるさ（ひだりうえ から ひかり）。 */
function ellLight(nx: number, ny: number): number {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
  const l = -.45 * nx - .62 * ny + .64 * nz
  return clamp01(.16 + .84 * Math.max(0, l))
}

type Sprite = {
  buf: PixelBuffer
  /** ネタの うえの めん（あぶり・たれの ぬりばしょ）。 */
  top: Uint8Array
  /** トッピングを のせる ところ。 */
  anchors: { x: number; y: number }[]
}

function newSprite(): Sprite {
  return { buf: new PixelBuffer(SUSHI_W, SUSHI_H), top: new Uint8Array(SUSHI_W * SUSHI_H), anchors: [] }
}

function markTop(s: Sprite, x: number, y: number) {
  if (s.buf.inside(x, y)) s.top[y * SUSHI_W + x] = 1
}

function unmarkTop(s: Sprite, x: number, y: number) {
  if (s.buf.inside(x, y)) s.top[y * SUSHI_W + x] = 0
}

// ---------------- シャリ ----------------

function riceColor(rice: RiceId, x: number, y: number, light: number): number {
  const r = ramp(riceDef(rice).ramp)
  // こめつぶ: 3x2 の ます目を 1だんごとに ずらし、ひだりうえを ひからせ みぎしたに すきまの かげ。
  const row = Math.floor(y / 2)
  const ox = row % 2 ? 1.5 : 0
  const lx = Math.floor(frac((x + ox) / 3) * 3)
  const ly = y % 2
  let g = (hash2(Math.floor((x + ox) / 3), row, 11) - .5) * .16
  if (lx === 0 && ly === 0) g += .2
  if (lx === 2 && ly === 1) g -= .22
  const c = r[level(light + g, x, y, .35)]
  if (rice === 'goma') {
    const h = hash2(x, y, 7)
    if (h < .05) return pack('#2a2420')
    if (h < .075) return pack('#c8a060')
  }
  if (rice === 'sakura' && hash2(x, y, 9) < .05) return pack('#d0607c')
  if (rice === 'kuro' && hash2(x, y, 13) < .04) return pack('#c9a6cf')
  return c
}

function noriColor(x: number, y: number, light: number): number {
  const r = ramp(NORI)
  const n = (hash2(x, y, 31) - .5) * .18 + (hash2(x >> 1, y, 37) - .5) * .1
  return r[level(light + n, x, y, .4)]
}

// ---------------- ネタの いろと もよう ----------------

/** きりみの うわめんの もよう。ly は きりみの うえの ふちからの たかさ。 */
function sliceColor(neta: NetaId, x: number, ly: number, light: number, u: number, v: number, y: number): number {
  const r = ramp(netaDef(neta).ramp)
  switch (neta) {
    case 'maguro': {
      const s = frac((x * .55 + ly * 1.0 + 2.5 * Math.sin(x * .35)) / 4.5)
      return r[level(light + (s < .16 ? .12 : 0), x, y)]
    }
    case 'toro': {
      const s = frac((x * .8 + ly * 1.5 + 1.8 * Math.sin(ly * .9 + x * .2)) / 4.6)
      if (s < .26) return r[Math.min(4, 3 + (light > .55 ? 1 : 0))]
      return r[level(light * .9, x, y)]
    }
    case 'salmon': {
      const s = frac((x * .85 - ly * 1.3 + 1.2 * Math.sin(x * .25)) / 5.2)
      if (s < .24) return pack(light > .45 ? '#fff0e2' : '#f2c6a6')
      return r[level(light, x, y)]
    }
    case 'hamachi': {
      if (u > .32 && v > .28) return ramp(CHIAI)[level(light * .9, x, y)]
      const s = frac((x * .5 + ly) / 5)
      return r[level(light + (s < .12 ? -.08 : .05), x, y)]
    }
    case 'ebi': {
      const s = frac((x + v * 2.5) / 4.4)
      if (s < .48) return r[Math.max(1, Math.min(3, level(light * .8, x, y)))]
      return pack(light > .5 ? '#fff6ee' : '#f4d2c0')
    }
    case 'ika': {
      const scored = ((x + ly) % 4 === 0 || (x - ly + 40) % 4 === 0) && v < .85
      return r[level(light + (scored ? -.14 : .04), x, y)]
    }
    case 'tako': {
      const edge = v < .3 || Math.abs(u) > .86
      if (edge) {
        // ふちの あかい ところに きゅうばん。
        const sucker = v < .3 && frac(x / 6) < .34 && ly >= 1 && ly <= 2
        if (sucker) return pack(frac(x / 6) < .17 ? '#f0b8c0' : '#5a1428')
        return r[Math.min(2, level(light * .7, x, y))]
      }
      return r[Math.max(3, level(light + .3, x, y))]
    }
    case 'unagi': {
      const grill = frac((x - ly * .8) / 5) < .2
      const gloss = ly <= 1 && x % 3 !== 0 && light > .5
      if (gloss) return r[4]
      return r[Math.max(0, level(light, x, y) - (grill ? 1 : 0))]
    }
    default:
      return r[level(light, x, y)]
  }
}

/** ちいさく かく とき（まきものの なか・さいの め・ふきだし）の ネタの いろ。 */
export function netaFlat(neta: NetaId, x: number, y: number, light: number): number {
  const r = ramp(netaDef(neta).ramp)
  const h = hash2(x, y, 5)
  switch (neta) {
    case 'salmon': return frac((x - y) / 3) < .3 ? pack('#ffe8d6') : r[level(light, x, y)]
    case 'toro': return frac((x + y * 1.4) / 3.4) < .3 ? r[4] : r[level(light * .9, x, y)]
    case 'ebi': return x % 3 === 0 ? r[1] : r[Math.max(3, level(light, x, y))]
    case 'tako': return light < .45 ? r[1] : r[Math.max(3, level(light, x, y))]
    case 'ika': return r[Math.max(2, level(light, x, y))]
    case 'kyuri': return light < .4 ? r[1] : r[Math.max(2, level(light, x, y))]
    case 'ikura': return (x + y) % 3 === 0 && light > .4 ? pack('#ffe6c4') : r[Math.max(1, level(light, x, y))]
    case 'corn': return (x % 2 === 0 && y % 2 === 0) ? r[4] : r[Math.max(1, level(light, x, y))]
    case 'natto': return h < .18 ? pack('#f0e2b8') : r[level(light, x, y)]
    case 'negitoro': return h < .14 ? pack('#5aa02a') : r[level(light + (h - .5) * .3, x, y)]
    case 'hamburg': return r[level(light + (h - .5) * .3, x, y)]
    case 'uni': return r[level(light + (frac(x / 3) < .3 ? -.15 : .05), x, y)]
    default: return r[level(light, x, y)]
  }
}

// ---------------- もりつけ（つぶつぶ・さいの め） ----------------

type Dot = { x: number; y: number }

/** やまもりの なかに ならべる ばしょ（おくから てまえの じゅん）。 */
function heapSpots(cx: number, baseY: number, rx: number, ry: number, stepX: number, stepY: number, seed: number): Dot[] {
  const spots: Dot[] = []
  let row = 0
  for (let y = baseY - ry + stepY * .6; y <= baseY + .5; y += stepY, row++) {
    const k = 1 - ((y - baseY) / ry) ** 2
    const half = rx * Math.sqrt(Math.max(0, k)) - stepX * .4
    const off = row % 2 ? stepX / 2 : 0
    for (let x = cx - half + (off % stepX); x <= cx + half + .01; x += stepX) {
      const jx = (hash2(Math.round(x * 3), row, seed) - .5) * .8
      spots.push({ x: x + jx, y })
    }
  }
  return spots
}

function sphere(s: Sprite, neta: NetaId, cx: number, cy: number, rad: number) {
  const r = ramp(netaDef(neta).ramp)
  s.buf.ellipse(cx, cy, rad, rad, (nx, ny, x, y) => {
    markTop(s, x, y)
    const rim = nx * nx + ny * ny > .62 && nx + ny > .5
    if (rim) return r[0]
    return r[Math.max(1, level(ellLight(nx, ny) + .05, x, y))]
  })
  s.buf.set(Math.round(cx - rad * .45), Math.round(cy - rad * .45), pack('#fff8ea'))
  if (rad >= 2) s.buf.set(Math.round(cx + .3), Math.round(cy + .4), r[1])
}

function drawHeap(s: Sprite, neta: NetaId, cx: number, baseY: number, rx: number, ry: number) {
  const def = netaDef(neta)
  const r = ramp(def.ramp)
  if (neta === 'ikura') {
    for (const p of heapSpots(cx, baseY, rx, ry, 3.6, 2.5, 1)) sphere(s, neta, p.x, p.y, 2.1)
    return
  }
  if (neta === 'uni') {
    for (const p of heapSpots(cx, baseY, rx, ry, 5, 2.6, 2)) {
      s.buf.ellipse(p.x, p.y, 3.2, 1.9, (nx, ny, x, y) => {
        markTop(s, x, y)
        if (ny > .55 && nx > -.2) return r[1]
        const grain = (hash2(x, y, 3) - .5) * .32
        return r[Math.max(1, level(ellLight(nx * .8, ny) + grain, x, y))]
      })
    }
    return
  }
  if (neta === 'corn') {
    for (const p of heapSpots(cx, baseY, rx, ry, 2.8, 2.2, 3)) {
      s.buf.ellipse(p.x, p.y, 1.5, 1.3, (nx, ny, x, y) => {
        markTop(s, x, y)
        return r[Math.max(1, level(ellLight(nx, ny) + .1, x, y))]
      })
    }
    // マヨを ぽってり。
    const mayo = pack('#fffbec'), mayoShade = pack('#e4dcc0')
    for (const [dx, dy] of [[-3, -2.5], [2.5, -3.5], [0, -1]] as const) {
      s.buf.ellipse(cx + dx, baseY - ry * .55 + dy, 2.2, 1.3, (_nx, ny, x, y) => {
        markTop(s, x, y)
        return ny > .3 ? mayoShade : mayo
      })
    }
    return
  }
  if (neta === 'natto') {
    for (const p of heapSpots(cx, baseY, rx, ry, 3.2, 2.3, 4)) {
      s.buf.ellipse(p.x, p.y, 1.8, 1.35, (nx, ny, x, y) => {
        markTop(s, x, y)
        const l = ellLight(nx, ny)
        if (l > .82) return pack('#f2dca4')
        return r[Math.max(0, level(l, x, y))]
      })
    }
    // ねばねばの いと。
    const thread = pack('#f6eed6')
    for (let i = 0; i < 4; i++) {
      const y0 = baseY - ry * (.3 + i * .15), x0 = cx - rx * .7 + i * 3
      s.buf.line(x0, y0, x0 + 5 + i, y0 - 2 + (i % 2) * 3, (x, y) => (hash2(x, y, 41 + i) < .7 ? thread : 0))
    }
    // からし。
    s.buf.ellipse(cx + 1, baseY - ry * .85, 1.6, 1, () => pack('#f0c020'))
    return
  }
  if (neta === 'negitoro') {
    s.buf.ellipse(cx, baseY, rx, ry, (nx, ny, x, y) => {
      if (ny > .15) return 0
      markTop(s, x, y)
      const n = (hash2(x, y, 6) - .5) * .4 + (hash2(x >> 1, y >> 1, 8) - .5) * .2
      return r[Math.max(1, level(ellLight(nx, ny) + n, x, y))]
    })
    for (const p of heapSpots(cx, baseY - 1, rx * .8, ry * .9, 4.2, 2.8, 5)) negiRing(s, p.x, p.y - 1)
    return
  }
  // きりみ・かたまり・やさいは さいの めに きって もる。
  for (const p of heapSpots(cx, baseY, rx, ry, 3.4, 2.4, 6)) cube(s, neta, Math.round(p.x - 1.5), Math.round(p.y - 2))
}

/** 3x3 の さいの め（うえ2だん・まえ1だん）。 */
function cube(s: Sprite, neta: NetaId, x: number, y: number) {
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      const px = x + dx, py = y + dy
      const top = dy < 2
      const light = top ? (dy === 0 ? .82 : .66) - dx * .06 : .3
      let c = netaFlat(neta, px, py, light)
      if (neta === 'kyuri' && !top) c = ramp(netaDef('kyuri').ramp)[0]
      if (neta === 'tako' && !top) c = ramp(netaDef('tako').ramp)[1]
      s.buf.set(px, py, c)
      if (top) markTop(s, px, py)
    }
  }
}

function negiRing(s: Sprite, x: number, y: number) {
  const dark = pack('#2c7420'), light = pack('#c4ec7c')
  x = Math.round(x); y = Math.round(y)
  s.buf.set(x, y - 1, dark); s.buf.set(x - 1, y, dark); s.buf.set(x + 1, y, dark); s.buf.set(x, y + 1, dark)
  s.buf.set(x, y, light)
}

// ---------------- にぎり ----------------

function drawNigiriRice(s: Sprite, rice: RiceId, cx = 20, cy = 21.5, rx = 12.5, ry = 6) {
  s.buf.ellipse(cx, cy, rx, ry, (nx, ny, x, y) => (y >= BASE_Y ? 0 : riceColor(rice, x, y, ellLight(nx, ny * .9) + .08)))
}

type SlabShape = { x0: number; x1: number; top: (u: number) => number; thick: (u: number) => number; side: number }

const SLICE: SlabShape = {
  x0: 3, x1: 37,
  top: u => 11.2 + 3.6 * u * u - 1.0 * u,
  thick: u => 7 * Math.sqrt(Math.max(0, 1 - u ** 6)),
  side: 2,
}

const BLOCK: SlabShape = {
  x0: 5, x1: 35,
  top: u => 8.6 + 1.4 * u * u,
  thick: u => 11 * Math.sqrt(Math.max(0, 1 - u ** 12)),
  side: 5,
}

const PATTY: SlabShape = {
  x0: 5, x1: 35,
  top: u => 9.6 + 2.4 * u * u,
  thick: u => 10 * Math.sqrt(Math.max(0, 1 - u ** 4)),
  side: 4,
}

function drawSlab(s: Sprite, neta: NetaId, shape: SlabShape) {
  const cx = (shape.x0 + shape.x1) / 2, half = (shape.x1 - shape.x0) / 2
  const r = ramp(netaDef(neta).ramp)
  for (let x = shape.x0; x <= shape.x1; x++) {
    const u = (x + .5 - cx) / half
    if (Math.abs(u) > 1) continue
    const top = shape.top(u), thick = shape.thick(u)
    if (thick < .6) continue
    for (let y = Math.floor(top); y <= Math.ceil(top + thick); y++) {
      const fy = y + .5
      if (fy < top || fy > top + thick) continue
      const v = (fy - top) / thick
      const ly = Math.floor(fy - top)
      const sideFace = fy > top + thick - shape.side
      let c: number
      if (neta === 'tamago') {
        const burn = hash2(x >> 2, y >> 1, 21)
        if (sideFace) {
          // よこから みえる たまごやきの そう。
          const layer = Math.floor(fy - (top + thick - shape.side)) % 2 === 1
          c = r[layer ? 2 : 3]
          if (fy > top + thick - 1) c = r[1]
        } else {
          const light = .86 - .22 * u * u - .2 * v
          c = burn > .72 ? pack(burn > .88 ? '#9a5a14' : '#c88a2a') : r[level(light, x, y)]
          markTop(s, x, y)
        }
      } else if (neta === 'hamburg') {
        const n = (hash2(x, y, 23) - .5) * .35
        if (sideFace) c = r[level(.28 + n, x, y)]
        else {
          // デミグラスソースが うえに とろり。
          const drip = v < .78 + .12 * Math.sin(x * 1.3)
          const light = .8 - .25 * u * u - .3 * v
          c = drip ? ramp(SAUCE)[level(light + (ly === 1 && x % 4 !== 0 ? .3 : 0), x, y)] : r[level(light + n, x, y)]
          markTop(s, x, y)
        }
      } else if (neta === 'kyuri') {
        if (sideFace) c = r[0]
        else {
          const light = .78 - .2 * u * u - .2 * v
          const skin = ly === 0 || Math.abs(u) > .93
          const seed = Math.abs(v - .55) < .14 && frac(x / 3) < .4
          c = skin ? r[1] : seed ? pack('#eef8d0') : r[Math.max(2, level(light, x, y))]
          markTop(s, x, y)
        }
      } else if (sideFace) {
        const light = .2 - .08 * u * u
        c = neta === 'tako' ? r[1] : neta === 'unagi' ? pack('#3a2a24') : r[level(light, x, y)]
      } else {
        let light = .76 - .3 * u * u - .26 * v
        if (v < .32 && u > -.65 && u < .05) light += .16
        c = sliceColor(neta, x, ly, light, u, v, y)
        markTop(s, x, y)
      }
      s.buf.set(x, y, c)
    }
  }
  if (neta === 'tamago' || neta === 'unagi') noriBand(s, cx - 2, shape)
}

/** たまご・うなぎを とめる のりの おび。 */
function noriBand(s: Sprite, x0: number, shape: SlabShape) {
  const cx = (shape.x0 + shape.x1) / 2, half = (shape.x1 - shape.x0) / 2
  for (let x = Math.round(x0); x < x0 + 4; x++) {
    const u = (x + .5 - cx) / half
    const top = shape.top(u), thick = shape.thick(u)
    for (let y = Math.floor(top); y <= Math.ceil(top + thick) + 1; y++) {
      if (y + .5 < top) continue
      const edge = x === Math.round(x0) ? .1 : x === Math.round(x0) + 3 ? -.05 : 0
      const v = (y + .5 - top) / thick
      s.buf.set(x, y, noriColor(x, y, .55 - v * .35 + edge))
      unmarkTop(s, x, y)
    }
  }
}

function drawEbi(s: Sprite) {
  const shape: SlabShape = { x0: 4, x1: 33, top: u => 11.8 + 3.2 * u * u - .8 * u, thick: u => 6.6 * Math.sqrt(Math.max(0, 1 - u ** 6)), side: 2 }
  // しっぽ（みぎはし）は さきに かいて、からだで ねもとを かくす。
  const t = ramp(EBI_TAIL)
  const tail: [number, number][] = [[31, 11], [38, 5], [39, 9], [37, 13], [39, 16], [32, 15]]
  for (let y = 4; y <= 17; y++) {
    for (let x = 30; x <= 39; x++) {
      if (!inPoly(x + .5, y + .5, tail)) continue
      const stripe = frac((y - x * .5) / 2.5) < .3
      s.buf.set(x, y, stripe ? t[1] : t[level(.75 - (x - 30) * .04, x, y)])
    }
  }
  drawSlab(s, 'ebi', shape)
}

function inPoly(x: number, y: number, pts: readonly [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function drawKyuriSlices(s: Sprite) {
  const r = ramp(netaDef('kyuri').ramp)
  for (const [cx, cy] of [[11.5, 14.5], [28.5, 14.5], [20, 13]] as const) {
    s.buf.ellipse(cx, cy, 7.5, 4.2, (nx, ny, x, y) => {
      markTop(s, x, y)
      const d = Math.sqrt(nx * nx + ny * ny)
      if (d > .84) return ny > .3 ? r[0] : r[1]
      if (d < .5 && d > .3 && hash2(x, y, 17) < .5) return pack('#f2fad8')
      return r[Math.max(2, level(.82 - ny * .2 - d * .15, x, y))]
    })
  }
}

function drawNigiri(s: Sprite, recipe: Recipe) {
  const def = netaDef(recipe.neta)
  drawNigiriRice(s, recipe.rice)
  if (recipe.toppings.includes('shiso')) shisoLeaf(s, 31, 9, .6)
  if (recipe.neta === 'ebi') drawEbi(s)
  else if (recipe.neta === 'kyuri') drawKyuriSlices(s)
  else if (def.form === 'grain' || def.form === 'paste') drawHeap(s, recipe.neta, 20, 17, 11.5, 7)
  else if (recipe.neta === 'tamago') drawSlab(s, recipe.neta, BLOCK)
  else if (recipe.neta === 'hamburg') drawSlab(s, recipe.neta, PATTY)
  else drawSlab(s, recipe.neta, SLICE)
  const ty = def.form === 'grain' || def.form === 'paste' ? 11 : recipe.neta === 'tamago' ? 9 : 12
  s.anchors.push({ x: 13, y: ty + 1 }, { x: 20, y: ty }, { x: 27, y: ty - 1 })
}

// ---------------- ぐんかん ----------------

function drawGunkan(s: Sprite, recipe: Recipe) {
  const cx = 20, topCy = 14, botCy = 24, rx = 11, ry = 4.2
  // のりの うちがわ（おく）。
  s.buf.ellipse(cx, topCy, rx, ry, (_nx, ny, x, y) => noriColor(x, y, ny < -.6 ? .4 : .08))
  s.buf.ellipse(cx, topCy + 1, rx - 1.6, ry - 1.2, (nx, ny, x, y) => riceColor(recipe.rice, x, y, ellLight(nx, ny) * .8))
  if (recipe.toppings.includes('shiso')) shisoLeaf(s, 15, 6, -.5)
  drawHeap(s, recipe.neta, cx, topCy + 1.5, rx - .5, 7.5)
  // てまえの のりの かべ。
  for (let x = cx - rx; x <= cx + rx; x++) {
    const u = (x + .5 - cx) / rx
    if (Math.abs(u) > 1) continue
    const e = ry * Math.sqrt(1 - u * u)
    const y0 = Math.round(topCy + e - .5), y1 = Math.round(botCy + e)
    for (let y = y0; y <= y1; y++) {
      let light = .3 + .35 * Math.max(0, 1 - Math.abs(u + .42) * 2.2) - Math.abs(u) * .1
      if (y === y0) light = .78
      else if (y === y1) light = .05
      if (Math.abs(u - .56) < .05) light = .02
      else if (Math.abs(u - .64) < .05) light += .14
      s.buf.set(x, y, noriColor(x, y, light))
      unmarkTop(s, x, y)
    }
  }
  // のりに くっついた ごはんつぶ。
  const grain = ramp(riceDef(recipe.rice).ramp)
  s.buf.set(cx - 6, botCy - 1, grain[4]); s.buf.set(cx - 5, botCy - 1, grain[3])
  s.anchors.push({ x: 15, y: 9 }, { x: 20, y: 7 }, { x: 25, y: 9 })
}

// ---------------- まきもの ----------------

function makiPiece(s: Sprite, recipe: Recipe, cx: number, cy: number) {
  const rx = 7.5, ry = 3.6, h = 8
  for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const u = (x + .5 - cx) / rx
    if (Math.abs(u) > 1) continue
    const e = ry * Math.sqrt(1 - u * u)
    for (let y = Math.floor(cy); y <= Math.round(cy + h + e); y++) {
      let light = .22 + .5 * Math.max(0, 1 - Math.abs(u + .45) * 2)
      if (y >= Math.round(cy + h + e) - 1) light *= .4
      s.buf.set(x, y, noriColor(x, y, light))
    }
  }
  const neta = recipe.neta
  s.buf.ellipse(cx, cy, rx, ry, (nx, ny, x, y) => {
    const d = Math.sqrt(nx * nx + ny * ny)
    if (d > .84) return noriColor(x, y, ny > .2 ? .7 : .45)
    markTop(s, x, y)
    if (d > .42) return riceColor(recipe.rice, x, y, .74 - ny * .16)
    if (neta === 'kyuri') return d > .3 ? ramp(netaDef('kyuri').ramp)[1] : netaFlat(neta, x, y, .8)
    if (neta === 'tamago' || neta === 'hamburg') return netaFlat(neta, x, y, .7 - ny * .2)
    return netaFlat(neta, x, y, .72 - ny * .25)
  })
  s.anchors.push({ x: cx, y: cy - 1 })
}

function drawMaki(s: Sprite, recipe: Recipe) {
  makiPiece(s, recipe, 13.5, 12.5)
  makiPiece(s, recipe, 26.5, 16.5)
  if (recipe.toppings.includes('shiso')) shisoLeaf(s, 32, 9, .4)
  s.anchors.push({ x: 20, y: 14 })
}

// ---------------- てまき ----------------

function drawTemaki(s: Sprite, recipe: Recipe) {
  const apex = { x: 6, y: 29 }, C = { x: 25, y: 12 }
  const p = { x: .667, y: .745 }, q = { x: .745, y: -.667 }
  const a = 9.6, b = 4.2
  const Dp = (C.x - apex.x) * p.x + (C.y - apex.y) * p.y
  const Dq = (C.x - apex.x) * q.x + (C.y - apex.y) * q.y
  for (let y = 0; y < SUSHI_H; y++) {
    for (let x = 0; x < SUSHI_W; x++) {
      const dx = x + .5 - apex.x, dy = y + .5 - apex.y
      const al = dx * p.x + dy * p.y, be = dx * q.x + dy * q.y
      for (let t = .04; t <= 1.001; t += .02) {
        const nu = (al - t * Dp) / (t * a), nv = (be - t * Dq) / (t * b)
        if (nu * nu + nv * nv > 1) continue
        let light = .44 - .32 * nu - .1 * nv
        if (Math.abs(nu - .55) < .09) light = .04
        s.buf.set(x, y, noriColor(x, y, light))
        break
      }
    }
  }
  if (recipe.toppings.includes('shiso')) shisoLeaf(s, 21, 4, -.3)
  // のぞく くちの ごはん。
  const neta = recipe.neta, form = netaDef(neta).form
  const mouth = (fn: (nu: number, nv: number, x: number, y: number) => number) => {
    for (let y = 0; y < SUSHI_H; y++) {
      for (let x = 0; x < SUSHI_W; x++) {
        const dx = x + .5 - C.x, dy = y + .5 - C.y
        const nu = (dx * p.x + dy * p.y) / a, nv = (dx * q.x + dy * q.y) / b
        if (nu * nu + nv * nv <= 1) {
          const c = fn(nu, nv, x, y)
          if (c) s.buf.set(x, y, c)
        }
      }
    }
  }
  mouth((nu, nv, x, y) => {
    const d = Math.sqrt(nu * nu + nv * nv)
    if (d > .82) return noriColor(x, y, nv < 0 ? .75 : .5)
    return riceColor(recipe.rice, x, y, .7 - nu * .15)
  })
  if (form === 'grain' || form === 'paste') {
    drawHeap(s, neta, C.x, C.y + 1, 8, 7)
    s.anchors.push({ x: 22, y: 7 }, { x: 25, y: 5 }, { x: 28, y: 7 })
    return
  }
  // きりみは ななめに 2ほん つきだす。
  const strip = (x0: number, y0: number, len: number, wide: number) => {
    const ax = .745, ay = -.667, px = .667, py = .745
    for (let y = 0; y < SUSHI_H; y++) {
      for (let x = 0; x < SUSHI_W; x++) {
        const dx = x + .5 - x0, dy = y + .5 - y0
        const along = dx * ax + dy * ay, across = dx * px + dy * py
        if (along < 0 || along > len || Math.abs(across) > wide * (along > len - 2 ? .7 : 1)) continue
        const w = across / wide
        const light = .74 - w * .3 - along / len * .1
        markTop(s, x, y)
        if (neta === 'kyuri') s.buf.set(x, y, w > .55 ? ramp(netaDef('kyuri').ramp)[1] : netaFlat(neta, x, y, light))
        else s.buf.set(x, y, form === 'slice' ? sliceColor(neta, x, Math.round(along), light, w, (w + 1) / 2, y) : netaFlat(neta, x, y, light))
      }
    }
  }
  strip(21, 14, 11, 2.3)
  strip(26, 15, 12, 2.6)
  s.anchors.push({ x: 27, y: 6 }, { x: 31, y: 5 }, { x: 24, y: 9 })
}

// ---------------- トッピング ----------------

function shisoLeaf(s: Sprite, cx: number, cy: number, tilt: number) {
  const r = ramp(LEAF)
  const ca = Math.cos(tilt), sa = Math.sin(tilt)
  for (let y = Math.floor(cy - 9); y <= cy + 9; y++) {
    for (let x = Math.floor(cx - 9); x <= cx + 9; x++) {
      const dx = x + .5 - cx, dy = y + .5 - cy
      const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca
      // たてながの はっぱ。ふちは ぎざぎざ。
      const nx = lx / 3.6, ny = ly / 7
      const d = nx * nx + ny * ny
      if (d > 1) continue
      if (d > .78 && (x + y) % 2 === 0) continue
      const vein = Math.abs(lx) < .5 || (Math.abs(Math.abs(lx) * 1.4 - (ly + 7) % 3.5) < .4 && Math.abs(lx) < 2.6)
      s.buf.set(x, y, vein ? r[3] : r[level(.55 - nx * .25 - ny * .1, x, y)])
    }
  }
}

function drawToppings(s: Sprite, toppings: readonly ToppingId[]) {
  const [a0, a1, a2] = [s.anchors[0], s.anchors[1] ?? s.anchors[0], s.anchors[2] ?? s.anchors[s.anchors.length - 1]]
  if (toppings.includes('aburi')) {
    // バーナーで あぶった こげめ。
    const dark = pack('#3a1a08'), deep = pack('#2a1206'), warm = pack('#c8783c')
    for (let y = 0; y < SUSHI_H; y++) {
      for (let x = 0; x < SUSHI_W; x++) {
        if (!s.top[y * SUSHI_W + x]) continue
        const n = hash2(x >> 1, y, 51) * .6 + hash2(x, y, 53) * .4
        s.buf.tint(x, y, warm, .18)
        if (n > .82) s.buf.tint(x, y, deep, .7)
        else if (n > .62) s.buf.tint(x, y, dark, .42)
      }
    }
  }
  if (toppings.includes('tare')) drizzle(s, a0, a2, [ramp(SAUCE)[3], ramp(SAUCE)[1], ramp(SAUCE)[0]], 1.8, 2)
  if (toppings.includes('mayo')) drizzle(s, a0, a2, [pack('#ffffff'), pack('#fff6dc'), pack('#a8966a')], 1.4, 0)
  if (toppings.includes('negi')) {
    for (const [dx, dy] of [[-2, -1], [2, -2], [5, 0], [-5, 0], [0, 1], [8, -1]] as const) negiRing(s, a1.x + dx, a1.y + dy - 1)
  }
  if (toppings.includes('lemon')) lemon(s, a2.x + 1, a2.y - 1)
  if (toppings.includes('wasabi')) {
    const r = ramp(WASABI)
    s.buf.ellipse(a0.x - 1, a0.y - 2, 2.6, 1.8, (nx, ny, x, y) => r[Math.max(1, level(ellLight(nx, ny) + (hash2(x, y, 61) - .5) * .3, x, y))])
  }
  if (toppings.includes('kinpaku')) {
    const g = ramp(GOLD)
    const flakes: [number, number][] = [[a1.x - 1, a1.y - 3], [a1.x + 3, a1.y - 2], [a0.x + 2, a0.y - 2], [a2.x - 2, a2.y - 3]]
    flakes.forEach(([fx, fy], i) => {
      const x = Math.round(fx), y = Math.round(fy)
      s.buf.set(x, y, g[4]); s.buf.set(x + 1, y, g[3]); s.buf.set(x, y + 1, g[2])
      if (i % 2 === 0) { s.buf.set(x + 1, y + 1, g[1]); s.buf.set(x - 1, y, g[3]) }
    })
  }
}

/** ソースや マヨを くねくねと かける。[ひかり, ほんたい, かげ] の 3だんで ぷっくり みせる。 */
function drizzle(s: Sprite, from: { x: number; y: number }, to: { x: number; y: number }, [shine, body, shade]: readonly number[], amp: number, seed: number) {
  const x0 = Math.round(from.x - 6), x1 = Math.round(to.x + 6)
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / Math.max(1, x1 - x0)
    const y = Math.round(from.y + (to.y - from.y) * t - 1 + amp * Math.sin(x * .62 + seed))
    if (!s.buf.get(x, y + 1) && !s.buf.get(x, y)) continue
    s.buf.set(x, y - 1, x % 3 === 0 ? shine : body)
    s.buf.set(x, y, body)
    s.buf.set(x, y + 1, shade)
  }
}

function lemon(s: Sprite, cx: number, cy: number) {
  const r = ramp(LEMON)
  for (let y = Math.floor(cy - 4); y <= cy; y++) {
    for (let x = Math.floor(cx - 4); x <= cx + 4; x++) {
      const dx = x + .5 - cx, dy = y + .5 - cy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d > 4.2 || dy > 0) continue
      let c: number
      if (d > 3.4) c = r[2]
      else if (d > 2.8) c = r[4]
      else {
        const ang = Math.atan2(dy, dx)
        c = frac(ang / (Math.PI / 3)) < .18 ? r[4] : r[3]
      }
      s.buf.set(x, y, c)
    }
  }
  s.buf.set(Math.round(cx), Math.round(cy) - 1, r[1])
}

// ---------------- まとめ ----------------

/** レシピの おすし（おさら なし）。 */
export function drawSushi(recipe: Recipe): PixelBuffer {
  const s = newSprite()
  if (recipe.style === 'nigiri') drawNigiri(s, recipe)
  else if (recipe.style === 'gunkan') drawGunkan(s, recipe)
  else if (recipe.style === 'maki') drawMaki(s, recipe)
  else drawTemaki(s, recipe)
  drawToppings(s, recipe.toppings)
  s.buf.outline()
  return s.buf
}

/** おさら だけ。 */
export function drawPlate(plate: PlateId): PixelBuffer {
  const def = plateDef(plate)
  const r = ramp(def.ramp)
  const rim = pack(def.rim)
  const buf = new PixelBuffer(PLATE_W, PLATE_H)
  const cx = 24, cy = 7.5, rx = 22.5, ry = 7.2
  // おさらの あつみ（てまえの よこがわ）。
  for (let x = 1; x < PLATE_W - 1; x++) {
    const u = (x + .5 - cx) / rx
    if (Math.abs(u) > 1) continue
    const e = ry * Math.sqrt(1 - u * u)
    for (let y = Math.round(cy); y <= Math.round(cy + e + 2); y++) buf.set(x, y, r[Math.abs(u) < .55 ? 1 : 0])
  }
  buf.ellipse(cx, cy, rx, ry, (nx, ny, x, y) => {
    const d = Math.sqrt(nx * nx + ny * ny)
    if (d > .8) {
      if (d < .85) return rim
      const light = .62 - .3 * nx - .38 * ny
      if (plate === 'kin' && hash2(x, y, 71) < .08) return r[4]
      return r[level(light, x, y)]
    }
    // うちがわの くぼみ（ひかりは ふちと ぎゃく）。
    const light = .6 + .2 * nx + .22 * ny
    if (plate === 'kuro') return r[Math.min(4, level(light * .8, x, y) + (d < .5 && nx < -.3 && ny < -.1 ? 2 : 0))]
    if (plate === 'kin') return r[Math.max(2, level(light, x, y))]
    const base = r[level(light, x, y)]
    const tinted = mixPacked(base, pack('#ffffff'), .62)
    return Math.abs(d - .52) < .05 ? mixPacked(base, pack('#ffffff'), .35) : tinted
  })
  buf.outline(.55)
  return buf
}

/** おさらに のせた おすし。 */
export function drawDish(recipe: Recipe): PixelBuffer {
  const dish = new PixelBuffer(DISH_W, DISH_H)
  const plate = drawPlate(recipe.plate)
  const py = DISH_ANCHOR.y - 7
  dish.draw(plate, 0, py)
  // おすしの かげ。
  const shadow = ramp(plateDef(recipe.plate).ramp)[0]
  dish.tintEllipse(24, DISH_ANCHOR.y + .5, 15, 3.6, shadow, .32)
  dish.draw(drawSushi(recipe), 4, DISH_ANCHOR.y - BASE_Y)
  return dish
}

// ---------------- えらぶ ボタンの え ----------------

/** シャリの えらぶ ボタン: シャリだま だけ。 */
export function drawRiceIcon(rice: RiceId): PixelBuffer {
  const s = newSprite()
  drawNigiriRice(s, rice, 20, 19.5, 13, 8)
  s.buf.outline()
  return s.buf
}

/** ネタの えらぶ ボタン: その ネタに にあう かたちで。 */
export function iconRecipe(neta: NetaId): Recipe {
  const form = netaDef(neta).form
  const style = form === 'grain' || form === 'paste' ? 'gunkan' : neta === 'kyuri' ? 'maki' : 'nigiri'
  return { style, rice: 'shiro', neta, toppings: [], plate: 'ao' }
}

const TOPPING_ART: Record<ToppingId, { rows: string[]; palette: Record<string, string> }> = {
  wasabi: {
    palette: { o: '#2a3a10', d: '#5a8a1c', m: '#86b832', l: '#b4dc5a', h: '#e4f6a6' },
    rows: [
      '................',
      '................',
      '.......oo.......',
      '......olho......',
      '.....olhlmo.....',
      '....oolllmmo....',
      '...olhllmmmdo...',
      '..olllmmmmmddo..',
      '..omllmmmdmddo..',
      '.ommmmmdmmdddo..',
      '.odmmmdddddddo..',
      '..oddddddddoo...',
      '...oooooooo.....',
      '................',
      '................',
      '................',
    ],
  },
  negi: {
    palette: { o: '#14380e', d: '#2c7420', m: '#5aa83a', l: '#c4ec7c', w: '#f4ffd8' },
    rows: [
      '................',
      '..oo.....oo.....',
      '.odmo...odmo....',
      '.mwlm...mlwd..oo',
      '.odmo...odmo.odmo',
      '..oo..oo.oo..mwld',
      '.....odmo....odmo',
      '..oo.mlwd.....oo.',
      '.odmoodmo..oo....',
      '.mlwdooo..odmo...',
      '.odmo.....mwld...',
      '..oo...oo.odmo...',
      '......odmo.oo....',
      '......mlwd.......',
      '......odmo.......',
      '.......oo........',
    ],
  },
  mayo: {
    palette: { o: '#7a6a3a', s: '#d8cca4', w: '#fffbea', r: '#e03a2a', R: '#a0201a', y: '#f4d040' },
    rows: [
      '......oo........',
      '.....orRo.......',
      '.....oRRo.......',
      '....owwwwo......',
      '...owwwwwso.....',
      '...owwyyysso....',
      '...owyrryyso....',
      '...owyyyyyso....',
      '...owwwwwsso....',
      '...owwwwwsso....',
      '...owwwwwsso....',
      '...owwwwwsso....',
      '....owwwsso.....',
      '.....oooooo.....',
      '................',
      '................',
    ],
  },
  tare: {
    palette: { o: '#1a0804', d: '#4a1808', m: '#74300e', l: '#a8501c', h: '#f0b080' },
    rows: [
      '.......o........',
      '.......o........',
      '......omo.......',
      '......omo.......',
      '.....omlmo......',
      '.....omlmo......',
      '....omlhlmo.....',
      '....omhlmmo.....',
      '...omlhlmmdo....',
      '...omhllmmdo....',
      '...omllmmddo....',
      '...odmmmmddo....',
      '....oddddoo.....',
      '.....oooo.......',
      '................',
      '................',
    ],
  },
  lemon: {
    palette: { o: '#6a4a00', d: '#c49a0c', m: '#ecc81c', l: '#fbe46a', w: '#fffbc8' },
    rows: [
      '................',
      '................',
      '................',
      '.....oooooo.....',
      '...oommmmmmoo...',
      '..omwwwwwwwwmo..',
      '.omwllwlwwllwmo.',
      '.omwlllwwlllwmo.',
      'omwllllwwllllwmo',
      'omwwwwwwwwwwwwmo',
      'odddddddddddddo.',
      '.oooooooooooooo.',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  shiso: {
    palette: { o: '#0c2a08', d: '#22621a', m: '#3c8c2a', l: '#68b848', h: '#b0e284' },
    rows: [
      '...........oo...',
      '.........oolmo..',
      '.......oolllmo..',
      '......olmhlmmo..',
      '.....olmhmlmdo..',
      '....olmhmllmdo..',
      '...olmhmlhmmo...',
      '...omhmlhmmdo...',
      '..olhmlhmmdo....',
      '..omhlhmmddo....',
      '..ohlhmmddo.....',
      '..ohhmmddo......',
      '..ohmddoo.......',
      '.ohooo..........',
      'oho.............',
      'oo..............',
    ],
  },
  kinpaku: {
    palette: { o: '#5a3004', d: '#b07010', m: '#e4a820', l: '#ffe070', w: '#fffbe0' },
    rows: [
      '..........w.....',
      '.........www....',
      '..ooo.....w.....',
      '.olllo..........',
      '.olwlmo...oo....',
      '..olmmdo.olwo...',
      '...oddo..omlo...',
      '....oo....oo....',
      '.......ooo......',
      '......olwlo.....',
      '..w..olwllmo....',
      '.www.omllmdo....',
      '..w...omddo.....',
      '.......ooo..w...',
      '...........www..',
      '............w...',
    ],
  },
  aburi: {
    palette: { o: '#5a1004', r: '#d8301a', y: '#ffb020', w: '#fff4b0', b: '#3a7ad8', B: '#a8d0ff' },
    rows: [
      '.......o........',
      '......oro.......',
      '......oro.......',
      '.....oryro......',
      '....oryyro..o...',
      '....orywyro.or..',
      '...oryywyyroryo.',
      '..oryywwwyyryro.',
      '..orywwwwwyyryo.',
      '..orywwwwwwyrro.',
      '..oryywBBwyyrro.',
      '...oryBBBBwyro..',
      '...orybBBbyyro..',
      '....orybbbyro...',
      '.....oorrroo....',
      '.......ooo......',
    ],
  },
}

export function drawToppingIcon(id: ToppingId): PixelBuffer {
  const art = TOPPING_ART[id]
  return fromArt(art.rows, art.palette)
}

/** ふきだしに だす ちいさな ネタ（16x12）。 */
export function drawNetaChip(neta: NetaId): PixelBuffer {
  const buf = new PixelBuffer(16, 12)
  const form = netaDef(neta).form
  const rice = ramp(riceDef('shiro').ramp)
  if (form === 'grain' || form === 'paste') {
    for (let x = 3; x <= 12; x++) {
      const u = (x + .5 - 8) / 5
      const e = 1.8 * Math.sqrt(Math.max(0, 1 - u * u))
      for (let y = Math.round(5.5 + e); y <= Math.round(9.5 + e); y++) buf.set(x, y, noriColor(x, y, y === Math.round(5.5 + e) ? .7 : .25))
    }
    buf.ellipse(8, 5.5, 5.2, 3.4, (nx, ny, x, y) => (ny > .45 ? 0 : netaFlat(neta, x, y, ellLight(nx, ny) + .1)))
    if (neta === 'ikura') for (const [x, y] of [[6, 3], [9, 4], [7, 5]] as const) buf.set(x, y, pack('#fff4e0'))
  } else {
    buf.ellipse(8, 8.6, 6.4, 2.8, (nx, ny, x, y) => rice[level(ellLight(nx, ny) + .1, x, y)])
    const thick = form === 'block' ? 5 : 3.6
    for (let x = 1; x <= 14; x++) {
      const u = (x + .5 - 8) / 7
      if (Math.abs(u) > 1) continue
      const top = 4 + 1.6 * u * u - (form === 'block' ? 1 : 0)
      for (let y = Math.floor(top); y <= top + thick; y++) {
        const v = (y + .5 - top) / thick
        const side = v > .72
        let c = netaFlat(neta, x, y, side ? .25 : .8 - v * .3)
        if ((neta === 'tamago' || neta === 'unagi') && (x === 7 || x === 8)) c = noriColor(x, y, .3)
        buf.set(x, y, c)
      }
    }
  }
  buf.outline()
  return buf
}

export function drawStyleIcon(style: Recipe['style']): PixelBuffer {
  return drawSushi({ style, rice: 'shiro', neta: 'maguro', toppings: [], plate: 'ao' })
}
