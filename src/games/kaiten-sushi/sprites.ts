// おみせの なかの いきものや どうぐの ドット絵。
// おきゃくさん（どうぶつ）・ねこの たいしょう・しんかんせん・ガチャ・たからもの を かく。
// かおの ひょうじょうは め・くちを あとから かきわけるので、1しゅるいの からだで いろいろな きもちを だせる。

import type { AnimalId, PrizeId } from './data'
import { TRAIN_H, TRAIN_W } from './layout'
import { PixelBuffer, flipX, fromArt, hash2, level, mixPacked, pack, packRamp, unpack, rgb, type Ramp } from './pixel'
import { drawSushi } from './sushiArt'

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

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

function ellLight(nx: number, ny: number): number {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
  return clamp01(.16 + .84 * Math.max(0, -.45 * nx - .62 * ny + .64 * nz))
}

function tri(buf: PixelBuffer, pts: readonly [number, number][], fn: (x: number, y: number) => number) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
      let inside = false
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j]
        if ((yi > y + .5) !== (yj > y + .5) && x + .5 < ((xj - xi) * (y + .5 - yi)) / (yj - yi) + xi) inside = !inside
      }
      if (inside) {
        const c = fn(x, y)
        if (c) buf.set(x, y, c)
      }
    }
  }
}

// ---------------- おきゃくさん ----------------

export const CUSTOMER_W = 32
export const CUSTOMER_H = 40

export type Expression = 'idle' | 'blink' | 'want' | 'munch' | 'chew' | 'happy' | 'spicy'

const EYE = pack('#1a1020')
const WHITE = pack('#ffffff')
const MOUTH_IN = pack('#a8283a')
const TONGUE = pack('#ff8a9a')
const BLUSH = pack('#ff7a8a')
const TEAR = pack('#7ad0ff')

type Look = {
  fur: Ramp
  light: Ramp
  headY: number
  /** あたまの いろ（もよう）。null なら fur。 */
  head?: (nx: number, ny: number, x: number, y: number) => readonly number[] | null
  back: (buf: PixelBuffer, hx: number, hy: number) => void
  front?: (buf: PixelBuffer, hx: number, hy: number) => void
  nose: number
  beak?: boolean
  belly?: boolean
}

const MIKE_ORANGE: Ramp = ['#6a2a08', '#b85a18', '#e88a34', '#f8b060', '#ffd8a0']
const MIKE_BLACK: Ramp = ['#0c0a10', '#1c1822', '#2e2834', '#46404e', '#6a6274']
const PINK_EAR: Ramp = ['#a04a5a', '#d87a8a', '#f4a8b4', '#ffc8d0', '#ffe8ec']

function catEars(fur: readonly number[], inner: readonly number[], left: readonly number[] = fur, right: readonly number[] = fur) {
  return (buf: PixelBuffer, hx: number, hy: number) => {
    const t = hy - 9.6
    tri(buf, [[hx - 11, t + 7], [hx - 9, t - 3.5], [hx - 2.5, t + 2]], (x, y) => left[level(.7 - (y - t) * .04, x, y)])
    tri(buf, [[hx + 2.5, t + 2], [hx + 9, t - 3.5], [hx + 11, t + 7]], (x, y) => right[level(.55 - (y - t) * .04, x, y)])
    tri(buf, [[hx - 9.5, t + 5], [hx - 8.5, t - .5], [hx - 4.5, t + 2.6]], () => inner[2])
    tri(buf, [[hx + 4.5, t + 2.6], [hx + 8.5, t - .5], [hx + 9.5, t + 5]], () => inner[2])
  }
}

const LOOKS: Record<AnimalId, Look> = {
  neko: {
    fur: ['#6a6070', '#b8b0bc', '#e6e0e8', '#f8f6f8', '#ffffff'],
    light: ['#6a6070', '#b8b0bc', '#e6e0e8', '#f8f6f8', '#ffffff'],
    headY: 17,
    head: (nx, ny) => (nx < -.25 && ny < -.1 && nx + ny < -.55 ? ramp(MIKE_ORANGE) : nx > .38 && ny < -.25 ? ramp(MIKE_BLACK) : null),
    back: (buf, hx, hy) => catEars(ramp(['#6a6070', '#b8b0bc', '#e6e0e8', '#f8f6f8', '#ffffff']), ramp(PINK_EAR), ramp(MIKE_ORANGE), ramp(MIKE_BLACK))(buf, hx, hy),
    front: (buf, hx, hy) => {
      const w = pack('#8a8090')
      for (const s of [-1, 1]) {
        buf.line(hx + s * 7, hy + 3, hx + s * 12, hy + 2, w)
        buf.line(hx + s * 7, hy + 4.5, hx + s * 12, hy + 5, w)
      }
    },
    nose: pack('#f07a8a'),
  },
  inu: {
    fur: ['#5a2a0a', '#a8581c', '#d88a3a', '#f0b468', '#ffe0b0'],
    light: ['#8a7a68', '#d4c8b8', '#f4ece0', '#fffaf2', '#ffffff'],
    headY: 17,
    head: (nx, ny) => (ny > .05 && Math.abs(nx) < .82 - ny * .2 ? ramp(['#8a7a68', '#d4c8b8', '#f4ece0', '#fffaf2', '#ffffff']) : null),
    back: catEars(ramp(['#5a2a0a', '#a8581c', '#d88a3a', '#f0b468', '#ffe0b0']), ramp(['#6a3a1a', '#b07040', '#e8c098', '#f6dcc0', '#fff4e4'])),
    front: (buf, hx, hy) => {
      // しばいぬの まゆげ。
      const c = pack('#fff4e0')
      buf.rect(hx - 6, hy - 4, 2, 1, c)
      buf.rect(hx + 4, hy - 4, 2, 1, c)
    },
    nose: pack('#1a1014'),
    belly: true,
  },
  usagi: {
    fur: ['#7a7084', '#c2bac8', '#ece8f0', '#faf8fc', '#ffffff'],
    light: ['#7a7084', '#c2bac8', '#ece8f0', '#faf8fc', '#ffffff'],
    headY: 19,
    back: (buf, hx, hy) => {
      const fur = ramp(['#7a7084', '#c2bac8', '#ece8f0', '#faf8fc', '#ffffff'])
      const pink = ramp(PINK_EAR)
      for (const [ex, tilt] of [[-5, -.18], [5, .18]] as const) {
        const cx = hx + ex, cy = hy - 15
        buf.ellipse(cx, cy, 3.3, 8.2, (nx, ny, x, y) => {
          const lx = nx + ny * tilt
          if (Math.abs(lx) < .42 && ny > -.75 && ny < .7) return pink[2]
          return fur[level(ellLight(nx, ny), x, y)]
        })
      }
    },
    nose: pack('#f07a8a'),
  },
  kuma: {
    fur: ['#2a1408', '#5a3216', '#8a5a2e', '#b4844e', '#dcb282'],
    light: ['#6a4a2a', '#a07a50', '#d0aa7a', '#ead0a8', '#fff0d4'],
    headY: 17,
    back: (buf, hx, hy) => {
      const fur = ramp(['#2a1408', '#5a3216', '#8a5a2e', '#b4844e', '#dcb282'])
      const inner = ramp(['#6a4a2a', '#a07a50', '#d0aa7a', '#ead0a8', '#fff0d4'])
      for (const s of [-1, 1]) {
        buf.ellipse(hx + s * 8.5, hy - 8, 4, 4, (nx, ny, x, y) => (nx * nx + ny * ny < .3 ? inner[1] : fur[level(ellLight(nx, ny), x, y)]))
      }
    },
    front: (buf, hx, hy) => {
      const m = ramp(['#6a4a2a', '#a07a50', '#d0aa7a', '#ead0a8', '#fff0d4'])
      buf.ellipse(hx, hy + 4, 5.2, 3.6, (nx, ny, x, y) => m[level(ellLight(nx, ny) + .25, x, y)])
    },
    nose: pack('#1a0e0a'),
    belly: true,
  },
  pengin: {
    fur: ['#060812', '#121a2e', '#22304e', '#3a4c74', '#6478a8'],
    light: ['#8a94a8', '#ccd4e2', '#eef2f8', '#fbfcfe', '#ffffff'],
    headY: 17,
    head: (nx, ny) => {
      const face = (nx + .36) ** 2 / .16 + (ny - .25) ** 2 / .42 < 1 || (nx - .36) ** 2 / .16 + (ny - .25) ** 2 / .42 < 1
      return face && ny > -.45 ? ramp(['#8a94a8', '#ccd4e2', '#eef2f8', '#fbfcfe', '#ffffff']) : null
    },
    back: () => {},
    nose: pack('#f0a020'),
    beak: true,
    belly: true,
  },
}

/** おきゃくさん 1にん。frame は ゆらゆら（0/1）。 */
export function drawCustomer(animal: AnimalId, expr: Expression, frame = 0): PixelBuffer {
  const look = LOOKS[animal]
  const buf = new PixelBuffer(CUSTOMER_W, CUSTOMER_H)
  const fur = ramp(look.fur), light = ramp(look.light)
  const hx = 16, hy = look.headY + (frame ? 1 : 0)
  // からだ。
  buf.ellipse(16, 35, 12.5, 8.5, (nx, ny, x, y) => {
    if (y >= CUSTOMER_H) return 0
    const belly = look.belly && Math.abs(nx) < .5 && ny > -.7
    return (belly ? light : fur)[level(ellLight(nx, ny) * .8 + .12, x, y)]
  })
  look.back(buf, hx, hy)
  buf.ellipse(hx, hy, 11.5, 9.6, (nx, ny, x, y) => {
    const r = look.head?.(nx, ny, x, y) ?? fur
    return r[level(ellLight(nx, ny) + .06, x, y)]
  })
  look.front?.(buf, hx, hy)

  const spicy = expr === 'spicy'
  if (spicy) {
    // からくて まっか。
    const red = pack('#ff4a3a')
    buf.tintEllipse(hx, hy + 1, 10.5, 8.6, red, .32)
  }

  const ey = Math.round(hy)
  const eyes = [Math.round(hx - 5), Math.round(hx + 4)]
  for (const [i, ex] of eyes.entries()) {
    if (expr === 'blink' || expr === 'chew') {
      buf.rect(ex - 1, ey + 1, 3, 1, EYE)
    } else if (expr === 'happy' || expr === 'munch') {
      buf.set(ex - 1, ey + 1, EYE); buf.set(ex, ey, EYE); buf.set(ex + 1, ey + 1, EYE)
    } else if (spicy) {
      const s = i === 0 ? 1 : -1
      buf.set(ex - s, ey - 1, EYE); buf.set(ex, ey, EYE); buf.set(ex - s, ey + 1, EYE)
      buf.set(ex + (i === 0 ? -1 : 1), ey + 2, TEAR); buf.set(ex + (i === 0 ? -1 : 1), ey + 3, TEAR)
    } else {
      buf.rect(ex - 1, ey - 1, 2, 3, EYE)
      buf.set(ex - 1, ey - 1, WHITE)
      if (expr === 'want') {
        buf.rect(ex - 1, ey - 2, 2, 1, EYE)
        buf.set(ex, ey + 1, WHITE)
      }
    }
  }
  // ほっぺ。
  const blush = expr === 'happy' || expr === 'munch' || expr === 'chew' ? .7 : .38
  for (const bx of [hx - 7.5, hx + 6.5]) {
    buf.tintEllipse(bx, hy + 3.4, 2, 1.1, BLUSH, blush)
  }

  const my = Math.round(hy + 4)
  if (look.beak) {
    const open = expr === 'munch' || expr === 'happy' || expr === 'want'
    tri(buf, [[hx - 3, my - 1.5], [hx + 3, my - 1.5], [hx, my + (open ? 1 : 2)]], (_x, y) => (y === my - 2 ? pack('#ffd060') : look.nose))
    if (open) tri(buf, [[hx - 2, my + 1], [hx + 2, my + 1], [hx, my + 3.5]], () => pack('#d07010'))
  } else {
    buf.set(hx - 1, my - 1, look.nose); buf.set(hx, my - 1, look.nose)
    buf.set(hx - 1, my - 2, look.nose === pack('#1a1014') || look.nose === pack('#1a0e0a') ? pack('#5a4a50') : pack('#ffb0bc'))
    if (expr === 'munch' || expr === 'want') {
      buf.rect(hx - 2, my + 1, 3, 2, MOUTH_IN)
      buf.rect(hx - 1, my + 2, 1, 1, TONGUE)
    } else if (expr === 'happy') {
      buf.rect(hx - 3, my + 1, 5, 1, EYE)
      buf.rect(hx - 2, my + 2, 3, 1, MOUTH_IN)
      buf.set(hx - 1, my + 2, TONGUE)
    } else if (spicy) {
      for (let i = -3; i <= 2; i++) buf.set(hx + i, my + 1 + (i % 2 === 0 ? 0 : 1), EYE)
    } else {
      buf.set(hx - 2, my + 1, EYE); buf.set(hx - 1, my, EYE); buf.set(hx, my + 1, EYE)
      buf.set(hx - 1, my + 1, EYE)
      buf.set(hx + 1, my + 1, EYE); buf.set(hx - 3, my, EYE)
      if (expr === 'chew') {
        // もぐもぐ ふくらんだ ほっぺ。
        buf.ellipse(hx - 7, hy + 4, 2.4, 2, (_nx, ny) => (ny < 0 ? 0 : fur[3]))
      }
    }
  }
  // カウンターに おいた て。
  for (const px of [7.5, 24.5]) {
    if (look.beak) buf.ellipse(px, 37, 3, 2.2, (nx, ny, x, y) => fur[level(ellLight(nx, ny), x, y)])
    else buf.ellipse(px, 37.2, 3.4, 2.4, (nx, ny, x, y) => (ny > .4 && (x % 2 === 0) ? fur[1] : (look.belly ? light : fur)[level(ellLight(nx, ny) + .1, x, y)]))
  }
  buf.outline()
  return buf
}

// ---------------- ねこの たいしょう ----------------

export const CHEF_W = 40
export const CHEF_H = 48
export type ChefPose = 'idle' | 'nigi' | 'press' | 'wave'

const CHEF_FUR: Ramp = ['#3a4250', '#6a7486', '#98a2b4', '#c4ccd8', '#e8eef4']
const COAT: Ramp = ['#8a90a4', '#c8ccd8', '#e8eaf2', '#f8f9fc', '#ffffff']
const BAND: Ramp = ['#0c1a44', '#1a3482', '#2a52c0', '#5a86e8', '#a8c8ff']

export function drawChef(pose: ChefPose, blink = false): PixelBuffer {
  const buf = new PixelBuffer(CHEF_W, CHEF_H)
  const fur = ramp(CHEF_FUR), coat = ramp(COAT), band = ramp(BAND)
  const hx = 20, hy = 15
  // しろい いたまえの ふく。
  buf.ellipse(20, 41, 15.5, 15, (nx, ny, x, y) => {
    if (y >= CHEF_H) return 0
    const collar = Math.abs(nx) < .28 - (ny + 1) * .12 && ny < -.2
    if (collar) return fur[2]
    const fold = Math.abs(Math.abs(nx) - (.3 - (ny + 1) * .12)) < .06 && ny < .2
    return fold ? coat[1] : coat[level(ellLight(nx, ny) * .8 + .2, x, y)]
  })
  // まえかけ（あい色）。
  buf.fill(10, 44, 29, 47, (x, y) => band[level(.45 - (y - 44) * .05, x, y)])
  catEars(fur, ramp(PINK_EAR))(buf, hx, hy)
  buf.ellipse(hx, hy, 12, 10, (nx, ny, x, y) => {
    // サバトラの しま。
    const stripe = ny < -.2 && Math.abs(Math.sin((nx * 3.4 + .2) * Math.PI)) < .28
    return fur[Math.max(0, level(ellLight(nx, ny) + .1, x, y) - (stripe ? 2 : 0))]
  })
  // ねじりはちまき。
  for (let x = hx - 12; x <= hx + 12; x++) {
    const u = (x - hx) / 12
    const y0 = Math.round(hy - 6 + u * u * 2.2)
    for (let y = y0; y <= y0 + 2; y++) {
      const twist = (x + y) % 4 < 2
      if (buf.get(x, y)) buf.set(x, y, twist ? band[3] : coat[3])
    }
  }
  buf.rect(hx + 10, hy - 6, 3, 2, coat[3]); buf.rect(hx + 12, hy - 7, 2, 2, band[2])
  // かお。
  const ey = hy + 1
  for (const ex of [hx - 5, hx + 4]) {
    if (blink) buf.rect(ex - 1, ey + 1, 3, 1, EYE)
    else {
      buf.rect(ex - 1, ey - 1, 2, 3, EYE)
      buf.set(ex - 1, ey - 1, WHITE)
    }
  }
  for (const bx of [hx - 8, hx + 7]) {
    buf.tintEllipse(bx, hy + 4.5, 2, 1, BLUSH, .4)
  }
  const my = hy + 5
  buf.set(hx - 1, my - 1, pack('#f07a8a')); buf.set(hx, my - 1, pack('#f07a8a'))
  if (pose === 'nigi' || pose === 'press' || pose === 'wave') {
    buf.rect(hx - 2, my + 1, 4, 1, EYE); buf.rect(hx - 1, my + 2, 2, 1, MOUTH_IN)
  } else {
    buf.set(hx - 2, my + 1, EYE); buf.set(hx - 1, my, EYE); buf.set(hx, my + 1, EYE); buf.set(hx + 1, my, EYE); buf.set(hx - 1, my + 1, EYE)
  }
  for (const s of [-1, 1]) {
    const w = pack('#5a6070')
    buf.line(hx + s * 7, hy + 4, hx + s * 13, hy + 3, w)
    buf.line(hx + s * 7, hy + 5.5, hx + s * 13, hy + 6, w)
  }
  // うで と て。
  const paw = (px: number, py: number) => {
    buf.ellipse(px, py, 4.2, 3, (nx, ny, x, y) => coat[level(ellLight(nx, ny) + .1, x, y)])
    buf.ellipse(px, py + 2.6, 3, 2.2, (nx, ny, x, y) => fur[level(ellLight(nx, ny) + .2, x, y)])
  }
  if (pose === 'idle') { paw(9, 41); paw(31, 41) }
  else if (pose === 'nigi') { paw(16, 34); paw(24, 33) }
  else if (pose === 'press') { paw(16, 37); paw(24, 36) }
  else { paw(9, 41); paw(33, 26) }
  buf.outline()
  return buf
}

// ---------------- しんかんせん ----------------


/** みぎむきの しんかんせん（とっきゅうレーン）。 */
export function drawTrain(facingRight = true, frame = 0): PixelBuffer {
  const buf = new PixelBuffer(TRAIN_W, TRAIN_H)
  const body = ramp(['#8a96a8', '#c4ccd8', '#e8edf4', '#f8fafc', '#ffffff'])
  const blue = ramp(BAND)
  for (let x = 1; x < TRAIN_W - 1; x++) {
    // はなさきは ながく まるく。
    const nose = x > 34 ? (x - 34) / 19 : 0
    const top = 4 + nose * nose * 7
    const bottom = 13
    for (let y = Math.floor(top); y <= bottom; y++) {
      if (y + .5 < top) continue
      const v = (y - top) / Math.max(1, bottom - top)
      let c = body[level(.92 - v * .55, x, y)]
      if (y >= 9 && y <= 10) c = blue[y === 9 ? 3 : 2]
      if (y === 11) c = blue[1]
      if (y === 6 && x > 4 && x < 32 && x % 4 !== 0) c = pack('#1c2a4a')
      if (y === 7 && x > 4 && x < 32 && x % 4 !== 0) c = pack('#3a5a8a')
      if (x > 36 && x < 44 && y >= Math.ceil(top) && y <= Math.ceil(top) + 1) c = pack('#28406a')
      buf.set(x, y, c)
    }
  }
  // おさらを のせる だい と しゃりん。
  buf.rect(4, 3, 26, 1, body[1])
  const wheel = pack('#2a2e38'), hub = pack('#8a8e98')
  for (const wx of [8, 16, 30, 40]) {
    buf.rect(wx - 2, 14, 4, 2, wheel)
    buf.set(wx - 1 + (frame % 2), 14, hub)
  }
  buf.set(52, 11, pack('#ffe680'))
  buf.outline(.5)
  return facingRight ? buf : flipX(buf)
}

// ---------------- ガチャ ----------------

export const GACHA_W = 44
export const GACHA_H = 56
const CAPSULE_COLORS = ['#ff5a6a', '#ffd040', '#5ab8ff', '#6ad070', '#c88aff', '#ff9a40']

export function drawGacha(knob = 0): PixelBuffer {
  const buf = new PixelBuffer(GACHA_W, GACHA_H)
  const red = ramp(['#4a0610', '#8a1420', '#d02a36', '#f45a60', '#ffaaa8'])
  const gold = ramp(['#6a3a04', '#b07010', '#e4a820', '#ffe070', '#fffbe0'])
  const glass = pack('#d8f0ff')
  // ガラスの まるい いれもの と なかの カプセル。
  buf.ellipse(22, 17, 17, 16, (nx, ny) => mixPacked(glass, pack('#a8d0f0'), clamp01(.2 + ny * .3 + nx * .2)))
  const caps: [number, number][] = [[12, 22], [19, 25], [27, 23], [33, 20], [16, 15], [24, 17], [30, 12], [10, 13], [21, 9], [14, 28], [26, 29], [33, 27]]
  caps.forEach(([cx, cy], i) => {
    const top = pack(CAPSULE_COLORS[i % CAPSULE_COLORS.length])
    const rim = mixPacked(top, pack('#2a1626'), .45)
    buf.ellipse(cx, cy, 3.8, 3.8, (nx, ny) => {
      const d = nx * nx + ny * ny
      if (d > .62) return rim
      const c = ny < (i % 3 === 0 ? .1 : -.1) ? top : pack('#fbfbff')
      return nx < -.25 && ny < -.25 ? mixPacked(c, pack('#ffffff'), .55) : c
    })
  })
  buf.ellipse(22, 17, 17, 16, (nx, ny, x, y) => {
    if (nx < -.45 && nx > -.7 && ny < .1 && ny > -.6) buf.set(x, y, pack('#ffffff'))
    if (nx * nx + ny * ny > .9) buf.set(x, y, pack('#88b0d0'))
    return 0
  })
  // だい。
  buf.fill(6, 31, 37, 54, (x, y) => {
    const u = (x - 6) / 31
    if (y === 31 || y === 32) return gold[y === 31 ? 4 : 2]
    return red[level(.72 - u * .42 - (y - 32) * .006, x, y, .25)]
  })
  buf.fill(6, 53, 37, 55, () => red[0])
  // とりだしぐち。
  buf.fill(25, 44, 34, 51, (_x, y) => pack(y === 44 ? '#3a0a10' : '#1a0408'))
  // ハンドル。
  buf.ellipse(15, 43, 6, 6, (nx, ny, x, y) => gold[level(ellLight(nx, ny), x, y)])
  const a = knob * Math.PI / 2
  buf.line(15 - Math.cos(a) * 5, 43 - Math.sin(a) * 5, 15 + Math.cos(a) * 5, 43 + Math.sin(a) * 5, gold[0])
  buf.line(15 - Math.cos(a) * 5, 44 - Math.sin(a) * 5, 15 + Math.cos(a) * 5, 44 + Math.sin(a) * 5, gold[1])
  buf.outline()
  return buf
}

/** ころがり でる カプセル（open で ぱかっ）。 */
export function drawCapsule(colorIndex: number, open = false): PixelBuffer {
  const buf = new PixelBuffer(20, 20)
  const top = pack(CAPSULE_COLORS[colorIndex % CAPSULE_COLORS.length])
  const shade = mixPacked(top, pack('#2a1626'), .35)
  if (open) {
    buf.ellipse(10, 6, 7, 4, (_nx, ny) => (ny < 0 ? top : shade))
    buf.ellipse(10, 15, 7, 4, (_nx, ny) => (ny > 0 ? pack('#d8d8e0') : pack('#f8f8fc')))
  } else {
    buf.ellipse(10, 10, 7.5, 7.5, (nx, ny) => {
      const c = ny < 0 ? top : pack('#f6f6fa')
      if (nx < -.3 && ny < -.35 && nx > -.65) return pack('#ffffff')
      return ny > .6 || nx > .7 ? mixPacked(c, pack('#2a1626'), .25) : c
    })
  }
  buf.outline()
  return buf
}

// ---------------- たからもの ----------------

type Art = { rows: string[]; palette: Record<string, string> }

const PRIZE_ART: Record<Exclude<PrizeId, 'kinsushi'>, Art> = {
  maneki: {
    palette: { o: '#2a1626', w: '#ffffff', g: '#d8d4dc', r: '#e0303a', y: '#ffd040', Y: '#c08a10', k: '#1a1020', p: '#ff9aaa', b: '#2a2430', O: '#f09030' },
    rows: [
      '...........oo.....',
      '..oo......owwo....',
      '.owpo.oo..owwo....',
      '.owwoowpo.owwo....',
      '.owwwwwwwoowwo....',
      'owwbwwwwwwowwo....',
      'owkwwwwkwwwwgo....',
      'owwwwpwwwwwwgo....',
      'owpwkkwpwwwgo.....',
      '.owwwwwwwggo......',
      '..orrrrrrroo......',
      '.owwwyywwwwo......',
      'owwwwYYwwwwwoo....',
      'owwoyyyyowwwOwo...',
      'owwoyYYyowwwOwo...',
      'owwwoooowwwwwgo...',
      '.ogwwwwwwwwggo....',
      '..oooooooooooo....',
    ],
  },
  daruma: {
    palette: { o: '#2a0a10', r: '#d0283a', R: '#901420', h: '#ff7a80', w: '#fff6ec', k: '#1a1020', y: '#ffc830' },
    rows: [
      '......oooooo......',
      '....oohrrrrroo....',
      '...ohhrrrrrrrro...',
      '..ohrrowwwworrro..',
      '..ohrowwwwwworro..',
      '.ohrowkwwwwkwwro..',
      '.orrowwwkkwwwwrRo.',
      '.orrowkwwwwkwwrRo.',
      '.orrrowwwwwwworRo.',
      '.orrrroooooooRRRo.',
      '.orryrrryyrrryRRo.',
      '.orrryrryyrryRRRo.',
      '.orrrryyrryyRRRRo.',
      '..orrrrrrrrRRRRo..',
      '..oRrrrrrrRRRRRo..',
      '...ooRRRRRRRRoo...',
      '.....oooooooo.....',
      '..................',
    ],
  },
  koma: {
    palette: { o: '#2a1626', r: '#e0303a', y: '#ffd040', b: '#3a7ad8', g: '#4aa84a', w: '#f4e0c0', d: '#a07040' },
    rows: [
      '........oo........',
      '........od........',
      '........od........',
      '.....oooooooo.....',
      '...oowwwwwwwwoo...',
      '..orrrrrrrrrrrro..',
      '.oyyyyyyyyyyyyyyo.',
      'obbbbbbbbbbbbbbbbo',
      'oggggggggggggggggo',
      '.orrrrrrrrrrrrrro.',
      '..oyyyyyyyyyyyyo..',
      '...obbbbbbbbbbo...',
      '....owwwwwwwwo....',
      '.....owwwwwwo.....',
      '......owwwwo......',
      '.......oddo.......',
      '........oo........',
      '..................',
    ],
  },
  kendama: {
    palette: { o: '#2a1626', r: '#e0303a', h: '#ff8a8a', R: '#901420', w: '#e8c088', d: '#a87840', s: '#c8c0b0' },
    rows: [
      '.....oooo.........',
      '...oohrrroo.......',
      '..ohhrrrrrro......',
      '..ohrrrrrrRo......',
      '..orrrrrrrRo......',
      '..orrrrrrRRo......',
      '...oRRRRRRo.......',
      '....oooooo.s......',
      '..oooooooos.......',
      '.owwwwwwwwwo......',
      '.oddddwwwddo......',
      '..oooowwooo.s.....',
      '.....owwo...s.....',
      '.....owwo..s......',
      '.....owwo.s.......',
      '.....owwoos.......',
      '.....odddo........',
      '......ooo.........',
    ],
  },
  furin: {
    palette: { o: '#2a3a5a', g: '#bfe6ff', G: '#8ac4f0', w: '#ffffff', r: '#e0303a', y: '#fff0a0', p: '#f4f0e0', s: '#a8a090' },
    rows: [
      '........oo........',
      '........oo........',
      '......oooooo......',
      '....oowgggggoo....',
      '...owwggggggGGo...',
      '...owggrrgggGGo...',
      '..owgggrrgggGGGo..',
      '..oggrgggggrgGGo..',
      '..ogrrrggggrrGGo..',
      '..oGGGGGGGGGGGGo..',
      '...oooooosooooo...',
      '........s.........',
      '.......opo........',
      '.......opo........',
      '.......oyo........',
      '.......opo........',
      '.......opo........',
      '.......ooo........',
    ],
  },
  chochin: {
    palette: { o: '#2a0a10', k: '#1a1418', K: '#4a4048', r: '#e0303a', R: '#a01828', h: '#ff8a7a', y: '#ffe070' },
    rows: [
      '........oo........',
      '.....oooooooo.....',
      '.....oKKKKKKo.....',
      '....oooooooooo....',
      '...ohhrrrrrrrRo...',
      '..ohrrrrrrrrrRRo..',
      '..oooooooooooooo..',
      '.ohrrryyyyrrrrRRo.',
      '.ohrryrrrryrrrRRo.',
      '.oooooooooooooooo.',
      '.ohrrryyyyrrrrRRo.',
      '..ohrrrrrrrrrRRo..',
      '..oooooooooooooo..',
      '...ohrrrrrrrRRo...',
      '....oooooooooo....',
      '.....oKKKKKKo.....',
      '.....oooooooo.....',
      '........oo........',
    ],
  },
  koinobori: {
    palette: { o: '#2a1626', r: '#e0303a', R: '#a01828', h: '#ff8a7a', w: '#ffffff', k: '#1a1020', y: '#ffd040', d: '#a87840', b: '#3a7ad8', B: '#1a4a9a', c: '#8ab8ff' },
    rows: [
      'oy................',
      'od................',
      'odoooooooooooo....',
      'odowwrrrrrrrrroo..',
      'odowkwrhrhrhrrRro.',
      'odowwrrhrhrhrRRo..',
      'odoooooooooooooo..',
      'od......oooooooo..',
      'od.....owwbbbbbboo',
      'od.....owkbcbcbbBo',
      'od.....owwbbcbcBo.',
      'od.....oooooooooo.',
      'od................',
      'od................',
      'od................',
      'od................',
      'od................',
      'oo................',
    ],
  },
  denden: {
    palette: { o: '#2a1626', r: '#e0303a', R: '#a01828', w: '#f8ead0', y: '#ffd040', d: '#a87840', k: '#1a1020', s: '#c8c0b0' },
    rows: [
      '..................',
      '....oooooooo......',
      '..oowwwwwwwwoo....',
      '.ok.orrrrrrro.ko..',
      '.okkorryyrrrokko..',
      '.ok.oryrryrro.ko..',
      '..s.orrrrrrRo.s...',
      '..s.oRRRRRRRo.s...',
      '..s..oooooooo.s...',
      '.......odo........',
      '.......odo........',
      '.......odo........',
      '.......odo........',
      '.......odo........',
      '.......odo........',
      '.......orro.......',
      '.......orro.......',
      '.......oooo.......',
    ],
  },
  taiyaki: {
    palette: { o: '#3a1804', d: '#8a4a14', m: '#c47a2a', l: '#e8a850', h: '#ffd890', k: '#1a0a04' },
    rows: [
      '..................',
      '..................',
      '..................',
      '.........ooo......',
      '......ooohhlo.....',
      '...ooohhllllmo..oo',
      '..ohhllllllmmmoolo',
      '.ohhkhlmlmlmmmolmo',
      'ohhhhllmlmlmmmmlmo',
      'ohllllmlmlmlmmmmlo',
      'olllllmlmlmlmmolmo',
      '.ommllmmmmmmmmoolo',
      '..oommmmmmmmddo.oo',
      '....ooddddddoo....',
      '......oooooo......',
      '..................',
      '..................',
      '..................',
    ],
  },
  ramune: {
    palette: { o: '#1a3a5a', g: '#a8e0ff', G: '#6ab8e8', w: '#ffffff', b: '#2a6ad0', m: '#e8f8ff', k: '#3a4a5a' },
    rows: [
      '......oooo........',
      '......obbo........',
      '......oooo........',
      '......owGo........',
      '.....owgGGo.......',
      '.....owmGGo.......',
      '....owgggGGo......',
      '....owwggGGo......',
      '.....owgGGo.......',
      '....owggggGo......',
      '...owgggggGGo.....',
      '...owggggggGo.....',
      '...owggggggGo.....',
      '...owggggggGo.....',
      '...owggggggGo.....',
      '...owggggggGo.....',
      '....oGGGGGGo......',
      '.....oooooo.......',
    ],
  },
  temari: {
    palette: { o: '#2a1626', r: '#e0303a', y: '#ffd040', b: '#3a7ad8', g: '#4aa84a', w: '#fff6ec', p: '#ff8ab0' },
    rows: [
      '......oooooo......',
      '....oorrwwrroo....',
      '...obrrwyywrrbo...',
      '..obbrwyrrywrbbo..',
      '.ogbbwyrppryybbgo.',
      '.oggwyrpwwpryygo..',
      'ogggwyrpwwpryyggo.',
      'owwwwwyrppryywwwo.',
      'oyyyyyyyrryyyyyyo.',
      'owwwwwyrppryywwwo.',
      'ogggwyrpwwpryyggo.',
      '.oggwyrpwwpryygo..',
      '.ogbbwyrppryybbgo.',
      '..obbrwyrrywrbbo..',
      '...obrrwyywrrbo...',
      '....oorrwwrroo....',
      '......oooooo......',
      '..................',
    ],
  },
}

/** あかるさを きんいろに おきかえる（きんの おすし）。 */
function toGold(src: PixelBuffer): PixelBuffer {
  const gold = ramp(['#4a2804', '#9a5a0a', '#e0a018', '#ffd848', '#fff8c0'])
  const out = new PixelBuffer(src.w, src.h)
  for (let i = 0; i < src.data.length; i++) {
    const p = src.data[i]
    if (!p) continue
    const [r, g, b] = unpack(p)
    const lum = (r * .3 + g * .59 + b * .11) / 255
    out.data[i] = gold[Math.max(0, Math.min(4, Math.floor(lum * 5.2)))]
  }
  return out
}

export function drawPrize(id: PrizeId): PixelBuffer {
  if (id === 'kinsushi') {
    const sushi = toGold(drawSushi({ style: 'nigiri', rice: 'shiro', neta: 'maguro', toppings: ['kinpaku'], plate: 'kin' }))
    const sparkle = pack('#ffffff')
    for (const [x, y] of [[6, 6], [33, 4], [36, 18]] as const) {
      sushi.set(x, y, sparkle); sushi.set(x - 1, y, sparkle); sushi.set(x + 1, y, sparkle); sushi.set(x, y - 1, sparkle); sushi.set(x, y + 1, sparkle)
    }
    return sushi
  }
  const art = PRIZE_ART[id]
  return fromArt(art.rows, art.palette)
}

/** まだ でていない たからものは シルエット。 */
export function silhouette(src: PixelBuffer): PixelBuffer {
  const out = new PixelBuffer(src.w, src.h)
  const c = rgb(120, 104, 120)
  for (let i = 0; i < src.data.length; i++) if (src.data[i]) out.data[i] = c
  return out
}

// ---------------- ちいさな えフェクト ----------------

export function drawHeart(): PixelBuffer {
  return fromArt([
    '.oo.oo.',
    'ohhprro',
    'ohprrro',
    'orrrrRo',
    '.orrRo.',
    '..oRo..',
    '...o...',
  ], { o: '#6a0a20', h: '#ffffff', p: '#ffb0c0', r: '#ff4a6a', R: '#c0203a' })
}

export function drawSparkle(size: 0 | 1): PixelBuffer {
  return size
    ? fromArt(['..w..', '..y..', 'wyWyw', '..y..', '..w..'], { w: '#fff2a0', y: '#ffd040', W: '#ffffff' })
    : fromArt(['.w.', 'wWw', '.w.'], { w: '#ffe070', W: '#ffffff' })
}

/** からくて でる ゆげ（ぷしゅー）。 */
export function drawSteam(frame: number): PixelBuffer {
  const buf = new PixelBuffer(9, 8)
  const c = pack('#ffffff')
  for (let i = 0; i < 3; i++) {
    const x = 1 + i * 3
    for (let y = 0; y < 7; y++) if ((y + frame + i) % 3 !== 0) buf.set(x + ((y + i + frame) % 4 < 2 ? 0 : 1), y, c)
  }
  return buf
}

/** けむり（おさらを さげた とき）。 */
export function drawPuff(frame: number): PixelBuffer {
  const buf = new PixelBuffer(24, 16)
  const r = 3 + frame * 1.6
  const c = pack('#f4f0ea'), s = pack('#c8bcb0')
  for (const [dx, dy] of [[-5, 1], [0, -2], [5, 1], [-2, 3], [3, 3]] as const) {
    buf.ellipse(12 + dx * (1 + frame * .3), 8 + dy, r * .55, r * .5, (_nx, ny, x, y) => (hash2(x, y, frame) < frame * .18 ? 0 : ny > .3 ? s : c))
  }
  return buf
}
