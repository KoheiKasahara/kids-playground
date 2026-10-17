// おみせの ばめんの ドット絵（うごかない ところ）と、ながれる ベルトの こま。
// かべ・のれん・ちょうちん・おしながき・カウンター・ネタケース・おひつ・まないた・ゆのみ などを かく。

import { NETAS, type NetaId } from './data'
import { CHEF_POS, LANE, NEAR_COUNTER_EDGE, NEAR_COUNTER_TOP, SCENE_H, SCENE_W, FAR_COUNTER, laneCoord, mod } from './layout'
import { PixelBuffer, fromArt, hash2, level, mixPacked, pack, packRamp, type Ramp } from './pixel'
import { drawNetaChip, netaFlat } from './sushiArt'

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

const PLASTER: Ramp = ['#a8946c', '#d4c29a', '#eadcb8', '#f6ecd2', '#fffaec']
const DARK_WOOD: Ramp = ['#1e0e06', '#3a1e0e', '#5a3218', '#7a4a26', '#a06a3c']
const COUNTER: Ramp = ['#4a2410', '#7a4220', '#a86634', '#c88a4c', '#e8b47a']
const HINOKI: Ramp = ['#8a6a3a', '#c4a066', '#e2c48a', '#f2dcaa', '#fff2d2']
const STEEL: Ramp = ['#3a4250', '#6a7484', '#a0aab8', '#d0d8e2', '#f6f9fc']
const INDIGO: Ramp = ['#0a1030', '#16204e', '#22306e', '#34468c', '#5468ac']
const LANTERN: Ramp = ['#5a0810', '#9a1422', '#d42a34', '#f45e52', '#ffa890']
const BELT: Ramp = ['#9a8a6a', '#cbbd9c', '#e6dcc2', '#f3ecd8', '#fffaf0']

/** もくめ。よこに のびた すじ。 */
function woodGrain(r: readonly number[], x: number, y: number, light: number, seed: number): number {
  const streak = Math.sin(y * 1.7 + Math.sin(x * .045 + y * .3) * 2.4 + seed) * .5 + .5
  const n = (hash2(x >> 2, y, seed) - .5) * .12
  return r[level(light + (streak - .5) * .22 + n, x, y, .4)]
}

/** 「す」「し」の もじ（のれんに いれる）。 */
const GLYPH_SU = [
  '....#....',
  '#########',
  '....#....',
  '..####...',
  '.#...#...',
  '.#...#...',
  '..####...',
  '.....#...',
  '....#....',
  '..##.....',
]
const GLYPH_SHI = [
  '.#.......',
  '.#.......',
  '.#.......',
  '.#.......',
  '.#.......',
  '.#.......',
  '.#......#',
  '.#.....#.',
  '..#...#..',
  '...###...',
]

function glyph(buf: PixelBuffer, rows: readonly string[], x0: number, y0: number, color: number, shadow: number) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '#') continue
      buf.rect(x0 + x * 2 + 1, y0 + y * 2 + 1, 2, 2, shadow)
    }
  })
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') buf.rect(x0 + x * 2, y0 + y * 2, 2, 2, color)
  })
}

const LANTERN_X = [13, 243] as const
export const LANTERN_CENTERS = LANTERN_X.map(x => ({ x, y: 21 }))

function drawLantern(buf: PixelBuffer, cx: number) {
  const r = ramp(LANTERN)
  const black = ramp(['#0a080c', '#1a161e', '#2c2632', '#463e4e', '#6a6274'])
  buf.line(cx, 0, cx, 6, black[1])
  buf.ellipse(cx, 21, 8.5, 12, (nx, ny, x, y) => {
    const rib = (y - 9) % 3 === 0
    const light = .9 - Math.abs(nx + .2) * .7 - Math.abs(ny) * .2
    return r[Math.max(0, level(light, x, y) - (rib ? 1 : 0))]
  })
  // まんなかに しろい まる。
  buf.ellipse(cx, 21, 4, 4.4, (nx, ny) => pack(nx < -.2 && ny < -.2 ? '#ffffff' : '#fff2dc'))
  buf.ellipse(cx, 21, 2, 2.4, () => pack('#d42a34'))
  buf.rect(cx - 5, 7, 11, 3, black[2]); buf.rect(cx - 5, 7, 11, 1, black[3])
  buf.rect(cx - 5, 32, 11, 3, black[2]); buf.rect(cx - 5, 34, 11, 1, black[0])
}

function drawMenuTag(buf: PixelBuffer, x0: number, neta: NetaId, index: number) {
  const wood = ramp(HINOKI)
  const dark = ramp(DARK_WOOD)
  const y0 = 8, w = 18, h = 30
  buf.line(x0 + 4, 4, x0 + 4, y0, dark[1]); buf.line(x0 + w - 5, 4, x0 + w - 5, y0, dark[1])
  buf.fill(x0, y0, x0 + w - 1, y0 + h - 1, (x, y) => {
    if (x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1) return dark[1]
    return woodGrain(wood, x, y + index * 7, .66 - (y - y0) * .006, index)
  })
  buf.draw(drawNetaChip(neta), x0 + 1, y0 + 3)
  // ねだん の かわりの あかい しるし と もじの ような すじ。
  const red = pack('#c8202c'), ink = pack('#2a1a14')
  buf.rect(x0 + 5, y0 + 17, 8, 2, red)
  buf.rect(x0 + 6, y0 + 19, 2, 2, red); buf.rect(x0 + 10, y0 + 19, 2, 2, red)
  buf.line(x0 + 8, y0 + 22, x0 + 8, y0 + 26, ink)
  buf.line(x0 + 6, y0 + 24, x0 + 11, y0 + 24, ink)
  buf.set(x0 + 11, y0 + 26, ink)
}

/** ネタケース（ガラスの なかに ネタの かたまり）。 */
function drawNetaCase(buf: PixelBuffer, x0: number, y0: number) {
  const steel = ramp(STEEL)
  const w = 56, h = 30
  // かげ。
  buf.tintRect(x0 + 2, y0 + h - 2, x0 + w + 1, y0 + h + 2, pack('#3a2410'), .3)
  // おくの いた。
  buf.fill(x0, y0, x0 + w - 1, y0 + 4, (x, y) => steel[level(.35 + (y - y0) * .05, x, y)])
  // こおりの うえに ネタ。
  buf.fill(x0, y0 + 5, x0 + w - 1, y0 + h - 6, (x, y) => mixPacked(pack('#eaf6ff'), pack('#b4d4ec'), hash2(x, y, 81) * .45))
  const blocks: [NetaId, number, number][] = [['maguro', 3, 11], ['salmon', 16, 11], ['tamago', 29, 9], ['hamachi', 40, 13]]
  for (const [neta, bx, bw] of blocks) {
    for (let y = y0 + 8; y <= y0 + 18; y++) {
      for (let x = x0 + bx; x < x0 + bx + bw; x++) {
        const top = y < y0 + 12
        buf.set(x, y, netaFlat(neta, x, y, top ? .85 - (x - x0 - bx) * .02 : .45 - (y - y0 - 12) * .03))
      }
    }
  }
  // えび を ならべて。
  for (let i = 0; i < 4; i++) {
    const ex = x0 + 4 + i * 6
    buf.fill(ex, y0 + 20, ex + 4, y0 + 22, (x, y) => netaFlat('ebi', x, y, .8))
    buf.set(ex + 5, y0 + 20, pack('#e0401c')); buf.set(ex + 5, y0 + 21, pack('#a8200e'))
  }
  buf.ellipse(x0 + 42, y0 + 21, 6, 2.6, (nx, ny, x, y) => netaFlat('ikura', x, y, .9 - ny * .2 - nx * .1))
  // ガラスの ひかり と まえの わく。
  for (let y = y0 + 5; y < y0 + h - 5; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const d = x - x0 - (y - y0) * 1.4
      if ((d > 8 && d < 11) || (d > 30 && d < 31.5)) buf.tint(x, y, pack('#ffffff'), .55)
      else buf.tint(x, y, pack('#dff2ff'), .14)
    }
  }
  buf.fill(x0, y0 + h - 6, x0 + w - 1, y0 + h - 1, (x, y) => steel[y === y0 + h - 6 ? 4 : level(.6 - (y - y0 - h + 6) * .1, x, y)])
  buf.rect(x0 - 1, y0, 2, h, steel[1])
  buf.rect(x0 + w - 1, y0, 2, h, steel[1])
}

/** おひつ（すしおけ）と しゃもじ。 */
function drawHangiri(buf: PixelBuffer, cx: number, cy: number) {
  const tub = ramp(COUNTER)
  const copper = ramp(['#4a1e0a', '#8a3e18', '#c26a30', '#e89a58', '#ffd0a0'])
  const paddle = ramp(HINOKI)
  const rx = 17, ry = 7, h = 9
  buf.tintEllipse(cx + 2, cy + h + 2, rx, ry * .8, pack('#3a2410'), .3)
  for (let x = cx - rx; x <= cx + rx; x++) {
    const u = (x + .5 - cx) / rx
    if (Math.abs(u) > 1) continue
    const e = ry * Math.sqrt(1 - u * u)
    for (let y = Math.round(cy); y <= Math.round(cy + h + e); y++) {
      const band = Math.abs(y - (cy + 3 + e)) < 1 || Math.abs(y - (cy + h - 1 + e)) < 1
      const light = .62 - u * .32
      const stave = Math.round(u * 9 + 20) % 2 === 0
      buf.set(x, y, band ? copper[level(light + .1, x, y)] : tub[Math.max(0, level(light, x, y) - (stave ? 1 : 0))])
    }
  }
  buf.ellipse(cx, cy, rx, ry, (nx, ny, x, y) => {
    const d = Math.sqrt(nx * nx + ny * ny)
    if (d > .8) return tub[level(.85 - ny * .4, x, y)]
    if (d > .72) return tub[0]
    // こんもり もった シャリ。
    const grain = (x + (y % 2) * 2) % 3 === 0 ? -.14 : .06
    return ramp(['#8a8070', '#c4bcaa', '#e6e0d2', '#f7f4ea', '#ffffff'])[level(.86 - ny * .25 - nx * .1 + grain, x, y)]
  })
  // しゃもじ。
  buf.line(cx + 9, cy - 11, cx + 3, cy - 1, paddle[1])
  buf.line(cx + 10, cy - 11, cx + 4, cy - 1, paddle[3])
  buf.ellipse(cx + 2, cy, 3.2, 2.2, (nx, ny, x, y) => paddle[level(.85 - nx * .2 - ny * .3, x, y)])
}

/** ゆのみ。 */
function drawYunomi(buf: PixelBuffer, cx: number, top: number) {
  const glaze = ramp(['#4a5a4a', '#7e927a', '#a8bca0', '#cfdcc4', '#eef4e6'])
  const rx = 9, ry = 3.4, h = 22
  buf.tintEllipse(cx + 3, top + h + 2, rx + 1, ry, pack('#2a1408'), .35)
  for (let x = cx - rx; x <= cx + rx; x++) {
    const u = (x + .5 - cx) / rx
    if (Math.abs(u) > 1) continue
    const e = ry * Math.sqrt(1 - u * u)
    for (let y = Math.round(top); y <= Math.round(top + h + e); y++) {
      let light = .66 - u * .38
      if (Math.abs(u + .5) < .1) light += .25
      const kanji = Math.abs(u) < .45 && y > top + 6 && y < top + 17 && hash2(x >> 1, y >> 1, 91) < .45
      buf.set(x, y, kanji ? pack('#2a3a2c') : glaze[level(light, x, y)])
    }
  }
  buf.ellipse(cx, top, rx, ry, (nx, ny, x, y) => {
    const d = Math.sqrt(nx * nx + ny * ny)
    if (d > .78) return glaze[level(.85 - ny * .2, x, y)]
    return ramp(['#3a4a10', '#5a7414', '#7e9a24', '#a4c03a', '#d0e47a'])[level(.55 + nx * .2, x, y)]
  })
}

function drawSoySauce(buf: PixelBuffer, cx: number, top: number) {
  const glass = pack('#e8eef2')
  buf.tintEllipse(cx + 2, top + 30, 7, 2.4, pack('#2a1408'), .35)
  buf.ellipse(cx, top + 18, 6.5, 11, (nx, ny, x, y) => {
    if (y < top + 9) return 0
    if (nx < -.4 && nx > -.7) return glass
    return ramp(['#0e0604', '#1e0e08', '#30180c', '#4a2814', '#6a3c1e'])[level(.4 - nx * .3 - ny * .1, x, y)]
  })
  buf.fill(cx - 4, top + 3, cx + 4, top + 9, (x, y) => ramp(LANTERN)[level(.7 - (x - cx) * .08 - (y - top) * .02, x, y)])
  buf.fill(cx + 4, top + 4, cx + 7, top + 5, () => ramp(LANTERN)[1])
  buf.fill(cx - 3, top + 1, cx + 3, top + 2, () => ramp(LANTERN)[3])
}

function drawGariBox(buf: PixelBuffer, x0: number, y0: number) {
  const wood = ramp(DARK_WOOD)
  const w = 30, h = 18
  buf.tintRect(x0 + 2, y0 + h, x0 + w + 2, y0 + h + 3, pack('#2a1408'), .35)
  buf.fill(x0, y0, x0 + w - 1, y0 + 8, (x, y) => {
    if (x === x0 || x === x0 + w - 1 || y === y0) return wood[3]
    // がり（うすピンクの しょうが）。
    const n = hash2(x >> 1, y, 97)
    return pack(n > .55 ? '#ffd4d8' : n > .25 ? '#f6b2bc' : '#e88ea0')
  })
  buf.fill(x0, y0 + 9, x0 + w - 1, y0 + h - 1, (x, y) => woodGrain(wood, x, y, .55 - (y - y0) * .015, 5))
  buf.fill(x0, y0 + 8, x0 + w - 1, y0 + 8, () => wood[4])
}

function drawChopsticks(buf: PixelBuffer, x0: number, y0: number) {
  const red = ramp(LANTERN)
  buf.fill(x0, y0 + 2, x0 + 13, y0 + 24, (x, y) => (x === x0 || x === x0 + 13 || y === y0 + 2 ? red[1] : red[level(.62 - (x - x0) * .03, x, y)]))
  for (let i = 0; i < 5; i++) buf.line(x0 + 2 + i * 2, y0 - 6 + (i % 2), x0 + 2 + i * 2, y0 + 2, pack(i % 2 ? '#e8c890' : '#c89a5a'))
}

/** たいしょうの まえの まないた（たいしょうより まえに かく）。 */
export function drawIslandFront(): PixelBuffer {
  const buf = new PixelBuffer(SCENE_W, SCENE_H)
  const wood = ramp(HINOKI)
  const steel = ramp(STEEL)
  const x0 = CHEF_POS.x - 32, x1 = CHEF_POS.x + 32, y0 = CHEF_POS.y - 10
  buf.fill(x0, y0, x1, y0 + 9, (x, y) => (y === y0 ? wood[4] : woodGrain(wood, x, y, .8 - (y - y0) * .02, 7)))
  buf.fill(x0, y0 + 10, x1, y0 + 14, (x, y) => wood[level(.38 - (y - y0 - 10) * .04, x, y)])
  // やなぎば（ほうちょう）。
  buf.fill(x1 - 26, y0 + 3, x1 - 10, y0 + 4, (x, y) => steel[x % 5 === 0 ? 4 : y === y0 + 3 ? 3 : 2])
  buf.line(x1 - 27, y0 + 4, x1 - 26, y0 + 3, steel[3])
  buf.rect(x1 - 9, y0 + 3, 7, 1, pack('#c89a5a'))
  buf.rect(x1 - 9, y0 + 4, 7, 1, pack('#8a5a2a'))
  // にぎる まえの シャリだま と きりみ。
  const rice = ramp(['#8a8070', '#c4bcaa', '#e6e0d2', '#f7f4ea', '#ffffff'])
  for (const bx of [x0 + 8, x0 + 16]) {
    buf.ellipse(bx, y0 + 5, 3.4, 2, (nx, ny, x, y) => rice[level(.86 - nx * .2 - ny * .3, x, y)])
  }
  buf.fill(x0 + 24, y0 + 3, x0 + 32, y0 + 6, (x, y) => netaFlat('maguro', x, y, .8 - (y - y0 - 3) * .12))
  buf.outline(.45)
  return buf
}

/** うごかない はいけい。 */
export function drawBackground(): PixelBuffer {
  const buf = new PixelBuffer(SCENE_W, SCENE_H)
  const plaster = ramp(PLASTER), dark = ramp(DARK_WOOD), counter = ramp(COUNTER), hinoki = ramp(HINOKI), steel = ramp(STEEL)
  const { half } = LANE

  for (let y = 0; y < SCENE_H; y++) {
    for (let x = 0; x < SCENE_W; x++) {
      let c: number
      if (y < 4) c = dark[level(.5 + (y === 3 ? -.3 : 0), x, y)]
      else if (y < 44) c = plaster[level(.62 + (hash2(x >> 1, y >> 1, 3) - .5) * .12 - (y < 8 ? .14 : 0), x, y)]
      else if (y < 49) c = y === 44 ? dark[4] : dark[level(.5 - (y - 44) * .08, x, y)]
      else if (y < FAR_COUNTER.top) {
        // たての いたばり。
        const seam = x % 9 === 0
        c = seam ? dark[0] : woodGrain(dark, y, x, .5 - (x % 9 === 1 ? -.12 : 0), 9)
      } else {
        const { w } = laneCoord(x + .5, y + .5)
        const inside = w < 0
        if (Math.abs(w) <= half + 2.2) c = 0
        else if (inside) c = woodGrain(hinoki, x, y, .74 - Math.max(0, -w - half - 2) * .002, 2)
        else if (Math.abs(w) <= half + 5) c = counter[1]
        else c = woodGrain(counter, x, y, .6, 1)
        if (y >= NEAR_COUNTER_EDGE && !inside) c = y === NEAR_COUNTER_EDGE ? counter[3] : counter[level(.3 - (y - NEAR_COUNTER_EDGE) * .015, x, y)]
      }
      if (c) buf.set(x, y, c)
    }
  }

  // ベルトの わきの ステンレスの てすり（うごかない）。
  for (let y = FAR_COUNTER.top; y < SCENE_H; y++) {
    for (let x = 0; x < SCENE_W; x++) {
      const { w } = laneCoord(x + .5, y + .5)
      const a = Math.abs(w)
      if (a <= half || a > half + 2.2) continue
      const outer = w > 0
      const up = y < LANE.cy
      const lit = outer ? (up ? a < half + 1.1 : a > half + 1.1) : (up ? a > half + 1.1 : a < half + 1.1)
      buf.set(x, y, steel[lit ? 4 : 2])
    }
  }

  // のれん。
  const indigo = ramp(INDIGO)
  buf.fill(104, 4, 152, 40, (x, y) => {
    const panel = (x - 104) % 16
    if (panel === 15 && y > 9) return 0
    const wave = Math.sin((x - 104) * .4) * .6
    if (y > 38 + wave) return 0
    return indigo[level(.5 + (panel < 2 ? .14 : panel > 12 ? -.14 : 0) - (y - 4) * .004, x, y)]
  })
  buf.rect(102, 3, 53, 1, dark[4])
  buf.rect(102, 4, 53, 2, dark[2])
  const ivory = pack('#f8f2e2'), shadow = indigo[0]
  glyph(buf, GLYPH_SU, 109, 12, ivory, shadow)
  glyph(buf, GLYPH_SHI, 129, 12, ivory, shadow)

  LANTERN_X.forEach(cx => drawLantern(buf, cx))
  const tags = NETAS.filter((_n, i) => i % 2 === 0).map(n => n.id)
  ;[24, 44, 64, 84, 156, 176, 196, 216].forEach((x, i) => drawMenuTag(buf, x, tags[i % tags.length], i))

  // カウンターの ふちの かげ（ベルトとの さかいめ）。
  for (let y = FAR_COUNTER.top; y < SCENE_H; y++) {
    for (let x = 0; x < SCENE_W; x++) {
      const { w } = laneCoord(x + .5, y + .5)
      if (w > half + 2.2 && w < half + 3.4) buf.tint(x, y, pack('#1a0a04'), .45)
      if (w < -half - 2.2 && w > -half - 3.6) buf.tint(x, y, pack('#5a3a14'), .35)
    }
  }
  // おくの カウンターの てまえの ふち と とっきゅうレールの みぞ。
  for (let x = 0; x < SCENE_W; x++) {
    if (!buf.get(x, FAR_COUNTER.front)) continue
    const { w } = laneCoord(x + .5, FAR_COUNTER.front + .5)
    if (w <= half + 3.4) continue
    buf.set(x, FAR_COUNTER.front - 1, steel[1])
    buf.set(x, FAR_COUNTER.front, steel[4])
    buf.set(x, FAR_COUNTER.front + 1, steel[2])
  }

  drawNetaCase(buf, 60, 116)
  drawHangiri(buf, 170, 134)
  drawYunomi(buf, 26, 220)
  drawSoySauce(buf, 52, 214)
  drawGariBox(buf, 194, 228)
  drawChopsticks(buf, 234, 226)
  // こざら（しょうゆ）。
  buf.ellipse(84, 244, 10, 3.6, (nx, ny, x, y) => {
    const d = Math.sqrt(nx * nx + ny * ny)
    if (d > .7) return ramp(['#6a6a74', '#a8a8b4', '#d8d8e2', '#f0f0f6', '#ffffff'])[level(.7 - ny * .3, x, y)]
    return pack(nx < -.2 && ny < -.1 ? '#6a3a20' : '#2a1208')
  })
  // てまえの カウンターの ふちの ひかり。
  for (let x = 0; x < SCENE_W; x++) if (buf.get(x, NEAR_COUNTER_TOP + 2)) buf.tint(x, NEAR_COUNTER_TOP + 2, pack('#ffffff'), .08)
  return buf
}

/** ながれる ベルトの こま（P ピクセルで ひとまわり）。 */
export const BELT_PERIOD = 12

export type BeltMap = { index: Int32Array; s: Float32Array; w: Float32Array }

/** ベルトの うえの ピクセル と その s・w を いちど だけ しらべておく。 */
export function beltMap(): BeltMap {
  const index: number[] = [], ss: number[] = [], ws: number[] = []
  for (let y = FAR_COUNTER.top; y < SCENE_H; y++) {
    for (let x = 0; x < SCENE_W; x++) {
      const { s, w } = laneCoord(x + .5, y + .5)
      if (Math.abs(w) > LANE.half) continue
      index.push(y * SCENE_W + x); ss.push(s); ws.push(w)
    }
  }
  return { index: Int32Array.from(index), s: Float32Array.from(ss), w: Float32Array.from(ws) }
}

/** ベルトを offset だけ すすめた こま。もようは 三日月の かたちの いた。 */
export function drawBeltFrame(map: BeltMap, offset: number, out?: PixelBuffer): PixelBuffer {
  const buf = out ?? new PixelBuffer(SCENE_W, SCENE_H)
  const r = ramp(BELT)
  const seam = pack('#8a7a5c')
  for (let i = 0; i < map.index.length; i++) {
    const w = map.w[i] / LANE.half
    const p = mod(map.s[i] - offset + 2.2 * w * w, BELT_PERIOD)
    const idx = map.index[i]
    const x = idx % SCENE_W, y = (idx / SCENE_W) | 0
    let c: number
    if (p < 1) c = seam
    else if (p < 2) c = r[4]
    else {
      const slat = Math.floor(mod(map.s[i] - offset + 2.2 * w * w, BELT_PERIOD * 2) / BELT_PERIOD)
      c = r[level(.7 - Math.abs(w) * .22 - (p > BELT_PERIOD - 2 ? .2 : 0) + (slat ? .04 : -.04), x, y, .3)]
    }
    buf.data[idx] = c
  }
  return buf
}

/** ちょうちんの あかり（かさねて ゆらす）。 */
export function drawLanternGlow(): PixelBuffer {
  const buf = new PixelBuffer(48, 48)
  const c = pack('#ffcf7a')
  buf.ellipse(24, 24, 23, 23, (nx, ny, x, y) => {
    const d = Math.sqrt(nx * nx + ny * ny)
    return d < .55 || bayerish(x, y, 1 - d) ? c : 0
  })
  return buf
}

function bayerish(x: number, y: number, t: number) {
  return hash2(x, y, 17) < t * .9
}

/** おきゃくさんの ねがいごとの ふきだし（なかに ネタ）。 */
export function drawBubble(neta: NetaId): PixelBuffer {
  const frame = fromArt([
    '.oooooooooooooooooooo.',
    'owwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwo',
    'osssssssssssssssssssso',
    '.ooooooooosssoooooooo.',
    '..........oso.........',
    '...........o..........',
  ], { o: '#3a2a3a', w: '#ffffff', s: '#d8d0e0' })
  frame.draw(drawNetaChip(neta), 3, 1)
  return frame
}

/** カウンターに つみあげる ちいさな おさら。 */
export function drawMiniPlate(colors: Ramp): PixelBuffer {
  const r = ramp(colors)
  const buf = new PixelBuffer(14, 5)
  buf.ellipse(7, 2, 6.6, 2, (nx, ny, x, y) => (Math.abs(nx) < .55 && Math.abs(ny) < .5 ? mixPacked(r[3], pack('#ffffff'), .5) : r[level(.65 - ny * .3 - nx * .1, x, y)]))
  buf.rect(1, 3, 12, 1, r[1])
  buf.outline(.5)
  return buf
}

export const PREVIEW_W = 64
export const PREVIEW_H = 50

/** つくる がめんの みほんの はいけい（のれんの まえの カウンター）。 */
export function drawPreviewBackdrop(): PixelBuffer {
  const buf = new PixelBuffer(PREVIEW_W, PREVIEW_H)
  const dark = ramp(DARK_WOOD), counter = ramp(COUNTER), indigo = ramp(INDIGO)
  for (let y = 0; y < PREVIEW_H; y++) {
    for (let x = 0; x < PREVIEW_W; x++) {
      let c: number
      if (y < 15) c = x % 9 === 0 ? dark[0] : woodGrain(dark, y, x, .5, 9)
      else if (y === 15) c = dark[4]
      else if (y < 18) c = counter[1]
      else c = woodGrain(counter, x, y, .62 - (y - 18) * .004, 1)
      buf.set(x, y, c)
    }
  }
  // のれんの すそ。
  buf.fill(14, 0, 49, 11, (x, y) => {
    const panel = (x - 14) % 12
    if (panel === 11 && y > 2) return 0
    if (y > 9 + Math.sin((x - 14) * .5) * .8) return 0
    return indigo[level(.5 + (panel < 2 ? .14 : panel > 8 ? -.14 : 0), x, y)]
  })
  buf.tintRect(0, 18, PREVIEW_W - 1, 19, pack('#1a0a04'), .3)
  return buf
}
