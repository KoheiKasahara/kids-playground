// その場で かく ドット絵（ゆか・ブロック・ボン・アイテム・とびら・しかけ）。
// どれも いちど かいたら おぼえておき、まいコマ かきなおさない。

import { F_ICE, T_HARD, T_WALL, T_WATER, TILE, type BombOwner, type ItemKind, type World } from './core'
import { bayer, disc, hash2, makeCanvas, mixHex, outlined, oval, rect, shadedOval, spriteCanvas, type Img } from './pixel'
import { EGG, ITEM_ICONS, ITEM_PAL, OUTLINE, RIDE_PALS } from './sprites'
import type { RideColor } from './stages'
import type { BlockColors, Theme } from './theme'

const cache = new Map<string, Img | null>()
export function cached(key: string, make: () => Img | null): Img | null {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key) ?? null
}

/** ブロックの え の たかさ（うえに 4ドット はみだして たって みえる）。 */
export const BLOCK_H = 20
export const BLOCK_LIFT = 4

// ---------------- ゆか ----------------

function grassTile(ctx: CanvasRenderingContext2D, ox: number, oy: number, th: Theme, tx: number, ty: number, seed: number) {
  const [l, b, d] = th.floor
  const base = (tx + ty) % 2 ? b : mixHex(b, d, .18)
  rect(ctx, ox, oy, TILE, TILE, base)
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const h = hash2(tx * 16 + x, ty * 16 + y, seed)
      if (h < .045) { rect(ctx, ox + x, oy + y, 1, 1, l); if (y < 15) rect(ctx, ox + x, oy + y + 1, 1, 1, mixHex(base, l, .5)) }
      else if (h > .965) rect(ctx, ox + x, oy + y, 1, 1, d)
    }
  }
  const f = hash2(tx, ty, seed + 7)
  if (f < .16) {
    const fx = ox + 3 + Math.floor(hash2(tx, ty, seed + 8) * 9), fy = oy + 3 + Math.floor(hash2(tx, ty, seed + 9) * 9)
    const petal = ['#ffffff', '#ffe14a', '#ff9ac0'][Math.floor(f * 18) % 3]
    rect(ctx, fx - 1, fy, 3, 1, petal)
    rect(ctx, fx, fy - 1, 1, 3, petal)
    rect(ctx, fx, fy, 1, 1, petal === '#ffe14a' ? '#ff8a1e' : '#ffd23c')
  }
}

function sandTile(ctx: CanvasRenderingContext2D, ox: number, oy: number, th: Theme, tx: number, ty: number, seed: number) {
  const [l, b, d, dd] = th.floor
  rect(ctx, ox, oy, TILE, TILE, (tx + ty) % 2 ? b : mixHex(b, d, .15))
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const gx = tx * 16 + x, gy = ty * 16 + y
      const wave = Math.sin(gx * .42 + gy * 1.15 + Math.sin(gx * .13) * 2)
      if (wave > .93) rect(ctx, ox + x, oy + y, 1, 1, l)
      else if (wave < -.95) rect(ctx, ox + x, oy + y, 1, 1, d)
      else if (hash2(gx, gy, seed) > .985) rect(ctx, ox + x, oy + y, 1, 1, dd)
    }
  }
}

function snowTile(ctx: CanvasRenderingContext2D, ox: number, oy: number, th: Theme, tx: number, ty: number, seed: number) {
  const [l, b, d] = th.floor
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const t = (x + y) / 32 + ((tx + ty) % 2) * .15
      ctx.fillStyle = t + bayer(x, y) * .25 < .45 ? l : b
      ctx.fillRect(ox + x, oy + y, 1, 1)
      if (hash2(tx * 16 + x, ty * 16 + y, seed) > .975) rect(ctx, ox + x, oy + y, 1, 1, d)
    }
  }
}

function iceTile(ctx: CanvasRenderingContext2D, ox: number, oy: number, tx: number, ty: number) {
  const colors = ['#c8f2ff', '#9ee0fa', '#78c8f0', '#5aa8e0']
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const t = (y / TILE) * .7 + (x / TILE) * .2
      const i = Math.max(0, Math.min(3, Math.round(t * 3 + bayer(x, y) - .5)))
      ctx.fillStyle = colors[i]
      ctx.fillRect(ox + x, oy + y, 1, 1)
    }
  }
  // ななめの ひかり
  for (let i = 0; i < 6; i++) {
    const x = 3 + i, y = 9 - i
    rect(ctx, ox + x, oy + y, 1, 1, '#ffffff')
    if (i % 2 === 0) rect(ctx, ox + x + 3, oy + y + 2, 1, 1, '#e8fbff')
  }
  rect(ctx, ox, oy + 15, 16, 1, '#4a90d0')
  rect(ctx, ox + 15, oy, 1, 16, '#5aa0d8')
  if (hash2(tx, ty, 3) < .3) { rect(ctx, ox + 11, oy + 4, 1, 1, '#ffffff'); rect(ctx, ox + 10, oy + 5, 3, 1, '#e8fbff'); rect(ctx, ox + 11, oy + 3, 1, 3, '#e8fbff') }
}

function rockTile(ctx: CanvasRenderingContext2D, ox: number, oy: number, th: Theme, tx: number, ty: number, seed: number) {
  const [l, b, d, dd] = th.floor
  rect(ctx, ox, oy, TILE, TILE, (tx + ty) % 2 ? b : mixHex(b, d, .25))
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const h = hash2(tx * 16 + x, ty * 16 + y, seed)
      if (h < .05) rect(ctx, ox + x, oy + y, 1, 1, l)
      else if (h > .95) rect(ctx, ox + x, oy + y, 1, 1, dd)
    }
  }
  // ひびわれ（ときどき あかく ひかる）
  if (hash2(tx, ty, seed + 1) < .45) {
    let x = 2 + Math.floor(hash2(tx, ty, seed + 2) * 12), y = 2
    const glow = hash2(tx, ty, seed + 3) < .5
    for (let i = 0; i < 11; i++) {
      rect(ctx, ox + x, oy + y, 1, 1, glow ? '#ff7a2a' : dd)
      if (glow && i % 3 === 0) rect(ctx, ox + x, oy + y, 1, 1, '#ffc040')
      y++
      x += hash2(tx * 7 + i, ty, seed) < .5 ? -1 : 1
      x = Math.max(1, Math.min(14, x))
    }
  }
}

function checkerTile(ctx: CanvasRenderingContext2D, ox: number, oy: number, th: Theme, tx: number, ty: number) {
  const [l, b, d, dd] = th.floor
  const base = (tx + ty) % 2 ? b : d
  rect(ctx, ox, oy, TILE, TILE, base)
  rect(ctx, ox, oy, TILE, 1, mixHex(base, l, .55))
  rect(ctx, ox, oy, 1, TILE, mixHex(base, l, .35))
  rect(ctx, ox, oy + 15, TILE, 1, dd)
  rect(ctx, ox + 15, oy, 1, TILE, mixHex(base, dd, .6))
  if ((tx + ty) % 2) { rect(ctx, ox + 6, oy + 6, 4, 4, mixHex(base, l, .3)); rect(ctx, ox + 7, oy + 7, 2, 2, mixHex(base, l, .6)) }
}

const SHADOW_PX = 3

/** うごかない ゆかを ぜんぶ まとめて 1まいに かく（かべの かげも いっしょに）。 */
export function groundLayer(w: World, th: Theme): Img | null {
  const made = makeCanvas(w.cols * TILE, w.rows * TILE)
  if (!made) return null
  const { ctx } = made
  const seed = w.stage.id.length * 31 + w.stage.id.charCodeAt(0)
  for (let ty = 0; ty < w.rows; ty++) {
    for (let tx = 0; tx < w.cols; tx++) {
      const ox = tx * TILE, oy = ty * TILE
      const i = ty * w.cols + tx
      if (w.floor[i] === F_ICE) { iceTile(ctx, ox, oy, tx, ty); continue }
      switch (th.weather) {
        case 'leaf': grassTile(ctx, ox, oy, th, tx, ty, seed); break
        case 'sand': sandTile(ctx, ox, oy, th, tx, ty, seed); break
        case 'snow': snowTile(ctx, ox, oy, th, tx, ty, seed); break
        case 'ember': rockTile(ctx, ox, oy, th, tx, ty, seed); break
        default: checkerTile(ctx, ox, oy, th, tx, ty)
      }
    }
  }
  // こわれない かべの かげ（みぎと したへ）。
  ctx.fillStyle = th.shadow
  for (let ty = 0; ty < w.rows; ty++) {
    for (let tx = 0; tx < w.cols; tx++) {
      const t = w.tiles[ty * w.cols + tx]
      if (t !== T_WALL && t !== T_HARD) continue
      ctx.fillRect(tx * TILE + TILE, ty * TILE + 2, SHADOW_PX, TILE)
      ctx.fillRect(tx * TILE + 2, ty * TILE + TILE, TILE, SHADOW_PX)
    }
  }
  return made.canvas
}

/** みずの マス（なみが うごく）。 */
export function drawWater(ctx: CanvasRenderingContext2D, w: World, th: Theme, ox: number, oy: number, time: number) {
  const [a, b, c] = th.water
  for (let ty = 0; ty < w.rows; ty++) {
    for (let tx = 0; tx < w.cols; tx++) {
      if (w.tiles[ty * w.cols + tx] !== T_WATER) continue
      const x0 = ox + tx * TILE, y0 = oy + ty * TILE
      rect(ctx, x0, y0, TILE, TILE, b)
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const gx = tx * TILE + x, gy = ty * TILE + y
          const v = Math.sin(gx * .5 + time * 2.2 + Math.sin(gy * .35 + time) * 1.5) + Math.sin(gy * .9 - time * 1.4)
          if (v > 1.45) rect(ctx, x0 + x, y0 + y, 1, 1, c)
          else if (v > .7 && bayer(gx, gy) < .5) rect(ctx, x0 + x, y0 + y, 1, 1, a)
        }
      }
      // きしの かげ
      const above = w.tiles[(ty - 1) * w.cols + tx]
      if (ty > 0 && above !== T_WATER) rect(ctx, x0, y0, TILE, 2, 'rgba(0,20,60,.35)')
    }
  }
}

// ---------------- ブロック ----------------

/** はこの きほん（うえの めん 16、まえの めん 4）。 */
function boxBase(ctx: CanvasRenderingContext2D, c: BlockColors) {
  rect(ctx, 0, 0, 16, 16, c.top)
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) / 30 + bayer(x, y) * .3 > .78) rect(ctx, x, y, 1, 1, c.top2)
  rect(ctx, 0, 0, 16, 1, c.light)
  rect(ctx, 0, 0, 1, 16, c.light)
  rect(ctx, 15, 1, 1, 15, c.top2)
  rect(ctx, 0, 16, 16, 4, c.side)
  rect(ctx, 0, 19, 16, 1, c.dark)
  rect(ctx, 0, 16, 1, 4, mixHex(c.side, c.light, .25))
  rect(ctx, 15, 16, 1, 4, c.dark)
}

function hardArt(th: Theme): Img | null {
  const made = makeCanvas(16, BLOCK_H)
  if (!made) return null
  const { ctx } = made
  const c = th.hard
  boxBase(ctx, c)
  switch (th.id) {
    case 'forest':
      // いしの はしら と こけ
      rect(ctx, 3, 3, 10, 10, c.top2)
      rect(ctx, 4, 4, 8, 8, c.top)
      rect(ctx, 4, 4, 8, 1, c.light)
      rect(ctx, 4, 4, 1, 8, c.light)
      for (const [x, y] of [[1, 1], [2, 1], [1, 2], [13, 1], [14, 2], [6, 1], [7, 0], [8, 0]]) rect(ctx, x, y, 1, 1, c.accent)
      rect(ctx, 1, 0, 3, 1, c.accent2)
      rect(ctx, 12, 0, 3, 1, c.accent2)
      rect(ctx, 0, 16, 16, 1, c.accent2)
      rect(ctx, 5, 17, 1, 2, c.dark)
      rect(ctx, 11, 17, 1, 2, c.dark)
      break
    case 'desert':
      rect(ctx, 3, 3, 10, 10, c.top2)
      rect(ctx, 4, 4, 8, 8, c.top)
      rect(ctx, 6, 6, 4, 4, c.accent)
      rect(ctx, 7, 7, 2, 2, c.light)
      for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) rect(ctx, x, y, 1, 1, c.accent2)
      rect(ctx, 0, 17, 16, 1, c.dark)
      break
    case 'ice':
      for (let i = 0; i < 12; i++) { rect(ctx, 2 + i, 12 - i, 1, 1, c.light); if (i % 3 === 0) rect(ctx, 5 + i, 13 - i, 1, 1, '#ffffff') }
      rect(ctx, 3, 3, 3, 1, '#ffffff')
      rect(ctx, 3, 3, 1, 3, '#ffffff')
      rect(ctx, 0, 16, 16, 4, c.side)
      rect(ctx, 2, 17, 2, 1, c.light)
      rect(ctx, 0, 19, 16, 1, c.dark)
      break
    case 'volcano':
      for (let i = 0; i < 9; i++) rect(ctx, 3 + i, 4 + Math.round(Math.sin(i) * 1.5), 1, 1, c.light)
      rect(ctx, 6, 9, 5, 1, c.top2)
      rect(ctx, 0, 17, 16, 1, c.accent)
      rect(ctx, 3, 18, 3, 1, c.accent2)
      rect(ctx, 10, 18, 2, 1, c.accent2)
      break
    default:
      // きんぞくの はしら と びょう
      rect(ctx, 2, 2, 12, 12, c.top2)
      rect(ctx, 3, 3, 10, 10, c.top)
      rect(ctx, 3, 3, 10, 1, c.light)
      for (const [x, y] of [[1, 1], [13, 1], [1, 13], [13, 13]]) { rect(ctx, x, y, 2, 2, c.accent2); rect(ctx, x, y, 1, 1, c.accent) }
      rect(ctx, 0, 17, 16, 1, c.accent2)
      rect(ctx, 0, 16, 16, 1, c.accent)
  }
  return outlined(made.canvas, OUTLINE)
}

function wallArt(th: Theme, variant: number): Img | null {
  const made = makeCanvas(16, BLOCK_H)
  if (!made) return null
  const { ctx } = made
  const c = th.wall
  boxBase(ctx, c)
  switch (th.id) {
    case 'forest': {
      // しげみの かべ（はっぱ の かたまり）
      for (let i = 0; i < 6; i++) {
        const x = 2 + ((i * 5 + variant * 3) % 12), y = 2 + ((i * 7 + variant) % 11)
        shadedOval(ctx, x, y, 3, 2.5, [c.light, c.top, c.top2, c.side])
      }
      rect(ctx, 0, 16, 16, 4, c.accent)
      rect(ctx, 0, 19, 16, 1, c.accent2)
      rect(ctx, 4 + variant % 5, 17, 2, 2, c.accent2)
      break
    }
    case 'desert':
    case 'castle':
      // れんが
      for (let row = 0; row < 4; row++) {
        const y = row * 4
        rect(ctx, 0, y + 3, 16, 1, c.side)
        const shift = (row + variant) % 2 ? 0 : 4
        for (let x = shift; x < 16; x += 8) rect(ctx, x, y, 1, 3, c.side)
        rect(ctx, 0, y, 16, 1, mixHex(c.top, c.light, .5))
      }
      if (th.id === 'castle') { rect(ctx, 0, 16, 16, 1, c.accent); rect(ctx, 0, 17, 16, 1, c.accent2) }
      break
    case 'ice':
      for (let row = 0; row < 2; row++) {
        rect(ctx, 0, row * 8 + 7, 16, 1, c.side)
        rect(ctx, (row + variant) % 2 ? 7 : 3, row * 8, 1, 7, c.side)
        rect(ctx, 1, row * 8 + 1, 3, 1, c.light)
      }
      rect(ctx, 2 + variant % 9, 16, 2, 3, c.light)
      break
    default:
      for (let i = 0; i < 5; i++) shadedOval(ctx, 3 + ((i * 6 + variant * 5) % 11), 3 + ((i * 5 + variant) % 10), 3, 2.5, [c.light, c.top, c.top2, c.side])
      rect(ctx, 0, 17, 16, 1, c.accent)
      rect(ctx, 4 + variant % 7, 18, 3, 1, c.accent2)
  }
  return outlined(made.canvas, OUTLINE)
}

function softArt(th: Theme): Img | null {
  const made = makeCanvas(16, BLOCK_H)
  if (!made) return null
  const { ctx } = made
  const c = th.soft
  const ramp = [c.light, c.top, c.top2, c.side]
  switch (th.id) {
    case 'forest':
      // まるい しげみ と きのみ
      rect(ctx, 1, 9, 14, 10, c.side)
      rect(ctx, 1, 18, 14, 2, c.dark)
      shadedOval(ctx, 5, 8, 5, 5, ramp)
      shadedOval(ctx, 11, 8, 5, 5, ramp)
      shadedOval(ctx, 8, 5, 6, 5, ramp)
      shadedOval(ctx, 8, 12, 7, 5, ramp)
      for (const [x, y] of [[4, 7], [10, 4], [12, 11]]) { rect(ctx, x, y, 2, 2, c.accent); rect(ctx, x, y, 1, 1, c.accent2) }
      break
    case 'desert':
      // まるい すないわ（われめ と こいし）
      rect(ctx, 1, 10, 14, 9, c.side)
      rect(ctx, 1, 18, 14, 2, c.dark)
      shadedOval(ctx, 8, 9, 7.5, 7, ramp)
      shadedOval(ctx, 5, 13, 3.5, 3, [c.top, c.top2, c.side])
      for (let i = 0; i < 6; i++) rect(ctx, 6 + i, 4 + (i % 3 === 1 ? 1 : 0) + Math.floor(i / 2), 1, 1, c.dark)
      rect(ctx, 11, 8, 1, 3, c.dark)
      rect(ctx, 4, 6, 2, 1, c.light)
      rect(ctx, 3, 7, 1, 1, c.light)
      rect(ctx, 12, 13, 2, 1, c.accent)
      break
    case 'ice':
      // ゆきの かたまり
      rect(ctx, 1, 10, 14, 9, c.side)
      rect(ctx, 1, 18, 14, 2, c.dark)
      shadedOval(ctx, 8, 9, 7.5, 7, ['#ffffff', c.top, c.top2, c.side])
      shadedOval(ctx, 5, 6, 3, 2.5, ['#ffffff', '#ffffff', c.top])
      rect(ctx, 10, 12, 2, 1, c.accent)
      rect(ctx, 4, 13, 1, 1, c.accent)
      break
    case 'volcano':
      // ひびから マグマが のぞく いわ
      rect(ctx, 1, 10, 14, 9, c.side)
      rect(ctx, 1, 18, 14, 2, c.dark)
      shadedOval(ctx, 8, 9, 7.5, 7.5, ramp)
      for (let i = 0; i < 7; i++) rect(ctx, 4 + i, 6 + Math.round(Math.sin(i * 1.3) * 2), 1, 1, i % 2 ? c.accent : c.accent2)
      rect(ctx, 9, 11, 1, 3, c.accent)
      rect(ctx, 9, 12, 1, 1, c.accent2)
      break
    default:
      // ガラクタの きばこ
      boxBase(ctx, c)
      rect(ctx, 0, 3, 16, 2, c.accent)
      rect(ctx, 0, 11, 16, 2, c.accent)
      rect(ctx, 0, 4, 16, 1, c.accent2)
      rect(ctx, 0, 12, 16, 1, c.accent2)
      for (const x of [2, 13]) { rect(ctx, x, 3, 1, 1, '#ffffff'); rect(ctx, x, 11, 1, 1, '#ffffff') }
      for (let x = 1; x < 15; x += 3) rect(ctx, x, 6, 1, 4, c.top2)
      rect(ctx, 0, 17, 16, 1, c.accent2)
  }
  return outlined(made.canvas, OUTLINE)
}

export function hardSprite(th: Theme) { return cached(`hard:${th.id}`, () => hardArt(th)) }
export function wallSprite(th: Theme, variant: number) { return cached(`wall:${th.id}:${variant % 4}`, () => wallArt(th, variant % 4)) }
export function softSprite(th: Theme) { return cached(`soft:${th.id}`, () => softArt(th)) }

/** もえて くずれていく ブロック（0〜3）。 */
export function softBurnSprite(th: Theme, stage: number) {
  return cached(`soft-burn:${th.id}:${stage}`, () => {
    const base = softSprite(th)
    if (!base) return null
    const made = makeCanvas(base.width, base.height)
    const sctx = base.getContext('2d')
    if (!made || !sctx) return null
    const src = sctx.getImageData(0, 0, base.width, base.height)
    const out = made.ctx.createImageData(base.width, base.height)
    const cut = (stage + 1) / 5
    const tint: [number, number, number] = stage < 2 ? [255, 140, 40] : [60, 30, 30]
    for (let y = 0; y < base.height; y++) {
      for (let x = 0; x < base.width; x++) {
        const i = (y * base.width + x) * 4
        if (src.data[i + 3] === 0) continue
        if (bayer(x, y) < cut * (1.15 - y / base.height * .4)) continue
        const t = .35 + stage * .15
        out.data[i] = src.data[i] + (tint[0] - src.data[i]) * t
        out.data[i + 1] = src.data[i + 1] + (tint[1] - src.data[i + 1]) * t
        out.data[i + 2] = src.data[i + 2] + (tint[2] - src.data[i + 2]) * t
        out.data[i + 3] = 255
      }
    }
    made.ctx.putImageData(out, 0, 0)
    return made.canvas
  })
}

// ---------------- ボン ----------------

/** ボン（size 0〜2 で ふくらむ、hot で あかく ひかる）。 */
/** ボンの え。なかまの ボンは ロボンいろの シャボンだまのような みためで、ポンが すりぬけられると わかるように。 */
export function bombSprite(size: number, hot: boolean, owner: BombOwner = 'hero') {
  const boss = owner === 'boss', ally = owner === 'ally'
  return cached(`bomb:${size}:${hot}:${owner}`, () => {
    const made = makeCanvas(18, 19)
    if (!made) return null
    const { ctx } = made
    const r = 6.2 + size * .55
    const ramp = ally
      ? (hot ? ['#ffffff', '#c8ffe8', '#7ae0bc', '#3a9a80'] : ['#e8fff6', '#a8f4d4', '#5cc8a8', '#2e8a78'])
      : boss
      ? (hot ? ['#ffb0d8', '#e060a8', '#a03080', '#601850'] : ['#b48ae8', '#7a4ec0', '#4e2a8a', '#2a1250'])
      : (hot ? ['#ffb0a0', '#e85a5a', '#a02a3a', '#5a1020'] : ['#6c78a8', '#3e4670', '#262a48', '#14162a'])
    shadedOval(ctx, 9, 11, r, r * .96, ramp)
    // ひかり
    rect(ctx, 6, 7, 2, 2, '#ffffff')
    rect(ctx, 5, 9, 1, 2, hot ? '#ffd8d0' : '#a8b4e0')
    // ふた と みちび
    rect(ctx, 10, 3, 4, 3, '#a8b0c8')
    rect(ctx, 10, 3, 4, 1, '#e0e6f4')
    rect(ctx, 13, 3, 1, 3, '#6e7694')
    rect(ctx, 13, 1, 1, 2, '#d8a050')
    rect(ctx, 14, 0, 1, 2, '#d8a050')
    if (boss) { rect(ctx, 7, 11, 1, 1, '#ffffff'); rect(ctx, 10, 11, 1, 1, '#ffffff'); rect(ctx, 8, 13, 2, 1, '#ffffff') }
    if (ally) {
      // ロボンと おなじ かお（くろい まどに みどりの め）
      rect(ctx, 5, 10, 8, 4, '#26324f')
      rect(ctx, 6, 11, 2, 2, '#7dffb0')
      rect(ctx, 10, 11, 2, 2, '#7dffb0')
      // シャボンだまの ひかり
      rect(ctx, 12, 14, 1, 1, '#ffffff')
      rect(ctx, 11, 15, 1, 1, '#ffffff')
    }
    return outlined(made.canvas, OUTLINE)
  })
}

// ---------------- アイテム ----------------

const PANEL: Record<Exclude<ItemKind, 'egg' | 'gold'>, [string, string, string]> = {
  bomb: ['#7ec4ff', '#3e86e0', '#204a9a'],
  fire: ['#ffc070', '#ff7a2a', '#b8401a'],
  speed: ['#9af0e0', '#3ec8b0', '#1e7a70'],
  heart: ['#ffc0d8', '#ff7aa8', '#c03a6a'],
  star: ['#d8b0ff', '#9a6ae8', '#5a3aa8'],
}

export function itemSprite(kind: Exclude<ItemKind, 'egg' | 'gold'>) {
  return cached(`item:${kind}`, () => {
    const made = makeCanvas(14, 14)
    if (!made) return null
    const { ctx } = made
    const [l, m, d] = PANEL[kind]
    for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) rect(ctx, x, y, 1, 1, (x + y) / 26 + bayer(x, y) * .25 < .55 ? l : m)
    rect(ctx, 0, 0, 14, 1, '#ffffff')
    rect(ctx, 0, 0, 1, 14, '#ffffff')
    rect(ctx, 0, 13, 14, 1, d)
    rect(ctx, 13, 0, 1, 14, d)
    const icon = spriteCanvas(ITEM_ICONS[kind], ITEM_PAL)
    if (icon) ctx.drawImage(icon, 2, 2)
    return outlined(made.canvas, OUTLINE)
  })
}

export function eggSprite(color: RideColor | 'gold') {
  return cached(`egg:${color}`, () => {
    const pal = color === 'gold'
      ? { k: OUTLINE, w: '#fff6c8', W: '#e8b440', c: '#ffcf3a' }
      : { k: OUTLINE, w: '#ffffff', W: '#c6d0e8', c: RIDE_PALS[color].c }
    return spriteCanvas(EGG, pal)
  })
}

// ---------------- とびら・しかけ ----------------

export function doorSprite(open: boolean) {
  return cached(`door:${open}`, () => {
    const made = makeCanvas(16, 18)
    if (!made) return null
    const { ctx } = made
    // いしの わく
    oval(ctx, 8, 8, 8, 8, '#8a8aa8')
    rect(ctx, 0, 8, 16, 10, '#8a8aa8')
    oval(ctx, 8, 8, 7, 7, '#b4b4cc')
    rect(ctx, 1, 8, 14, 10, '#b4b4cc')
    rect(ctx, 1, 16, 14, 2, '#6a6a88')
    if (open) {
      oval(ctx, 8, 9, 5, 6, '#2a1650')
      rect(ctx, 3, 9, 10, 8, '#2a1650')
      for (let y = 0; y < 8; y++) for (let x = 3; x < 13; x++) if (bayer(x, y) < .5 - y * .06) rect(ctx, x, 9 + y, 1, 1, '#ffe8a0')
      oval(ctx, 8, 7, 3, 3, '#fff2b8')
      rect(ctx, 4, 13, 8, 1, '#5a3a8a')
      rect(ctx, 5, 15, 6, 1, '#5a3a8a')
    } else {
      oval(ctx, 8, 9, 5, 6, '#b06a34')
      rect(ctx, 3, 9, 10, 8, '#b06a34')
      for (const x of [5, 8, 11]) rect(ctx, x, 5, 1, 12, '#84461e')
      rect(ctx, 3, 10, 10, 1, '#84461e')
      rect(ctx, 6, 4, 4, 1, '#d89050')
      // じょうまえ
      rect(ctx, 7, 11, 3, 3, '#ffd23c')
      rect(ctx, 8, 12, 1, 1, '#84461e')
    }
    return outlined(made.canvas, OUTLINE)
  })
}

export function ventSprite() {
  return cached('vent', () => {
    const made = makeCanvas(16, 16)
    if (!made) return null
    const { ctx } = made
    oval(ctx, 8, 9, 7, 6, '#2a1a1e')
    oval(ctx, 8, 9, 6, 5, '#4a2a2a')
    oval(ctx, 8, 10, 4.5, 3.5, '#1a0a0a')
    rect(ctx, 3, 5, 3, 1, '#7a5a5a')
    rect(ctx, 11, 4, 2, 1, '#7a5a5a')
    return made.canvas
  })
}

export function warpSprite() {
  return cached('warp', () => {
    const made = makeCanvas(16, 18)
    if (!made) return null
    const { ctx } = made
    shadedOval(ctx, 8, 11, 7, 6.5, ['#f0a070', '#d07a48', '#a85a34', '#7a3e22'])
    rect(ctx, 2, 10, 12, 1, '#ffe0a0')
    rect(ctx, 2, 12, 12, 1, '#3aa0c8')
    oval(ctx, 8, 5, 5.5, 2.5, '#a85a34')
    oval(ctx, 8, 5, 4.5, 1.8, '#2a1650')
    return outlined(made.canvas, OUTLINE)
  })
}

export function beltBase(dir: number) {
  return cached(`belt:${dir}`, () => {
    const made = makeCanvas(16, 16)
    if (!made) return null
    const { ctx } = made
    rect(ctx, 0, 0, 16, 16, '#4a4e66')
    const horizontal = dir === 1 || dir === 3
    if (horizontal) { rect(ctx, 0, 0, 16, 2, '#8a90aa'); rect(ctx, 0, 14, 16, 2, '#2a2c3e'); rect(ctx, 0, 2, 16, 1, '#2a2c3e') }
    else { rect(ctx, 0, 0, 2, 16, '#8a90aa'); rect(ctx, 14, 0, 2, 16, '#2a2c3e'); rect(ctx, 2, 0, 1, 16, '#2a2c3e') }
    return made.canvas
  })
}

/** かげの だえん。 */
export function shadowSprite(w: number) {
  return cached(`shadow:${w}`, () => {
    const made = makeCanvas(w, Math.max(3, Math.round(w / 3)))
    if (!made) return null
    oval(made.ctx, w / 2, made.canvas.height / 2, w / 2, made.canvas.height / 2, 'rgba(10,6,24,.34)')
    return made.canvas
  })
}

/** ほしの かたちの ちいさな きらきら。 */
export function sparkleSprite(color: string, size: number) {
  return cached(`sparkle:${color}:${size}`, () => {
    const s = size * 2 + 1
    const made = makeCanvas(s, s)
    if (!made) return null
    const { ctx } = made
    rect(ctx, size, 0, 1, s, color)
    rect(ctx, 0, size, s, 1, color)
    if (size > 1) rect(ctx, size - 1, size - 1, 3, 3, color)
    rect(ctx, size, size, 1, 1, '#ffffff')
    return made.canvas
  })
}

export function discSprite(r: number, color: string) {
  return cached(`disc:${r}:${color}`, () => {
    const made = makeCanvas(r * 2 + 2, r * 2 + 2)
    if (!made) return null
    disc(made.ctx, r + 1, r + 1, r, color)
    return made.canvas
  })
}

