// えを かく ところ。ひくい かいぞうどの バッファ（ドットの 大きさ そのまま）に かいてから 画面へ ひきのばす。
// ボードは うえの れつから じゅんに「ブロック → ボン・アイテム → いきもの」と かさねて、
// まえの ブロックが うしろの いきものの あしもとを かくす 3/4 の ながめに する。

import {
  BLOCK_LIFT, beltBase, bombSprite, cached, doorSprite, drawWater, eggSprite, groundLayer, hardSprite, itemSprite,
  shadowSprite, softBurnSprite, softSprite, sparkleSprite, ventSprite, wallSprite, warpSprite,
} from './art'
import { BOSS_FOOT_Y, BOSS_W, dragonArt, kingMechArt, kingPodArt, penguinArt, puniKingArt, wormArt } from './bossArt'
import {
  BURN_FRAMES, DX, DY, F_BELT, F_DOOR, F_ICE, F_WARP, FIRE_FRAMES, T_HARD, T_SOFT, T_WALL, TILE, bombPos, bombTile, isBelt,
  type Blast, type Boss, type Enemy, type Hero, type World,
} from './core'
import { ventCharge } from './world'
import { shakeOffset, type Fx, type Particle } from './fx'
import { disc, hash2, makeCanvas, mixHex, oval, rect, shadedOval, silhouette, spriteCanvas, type Img } from './pixel'
import {
  ENEMY_ART, HERO_CHEER, HERO_OUCH, HERO_PAL, ITEM_ICONS, ITEM_PAL, RIDE_BACK, RIDE_FRONT, RIDE_SIDE, RIDE_SIDE_HOP, heroRows, ridePalette,
  type HeroFacing, type HeroStep,
} from './sprites'
import { THEMES, type Theme } from './theme'
import type { EnemyKind, RideColor } from './stages'

/** 画面の ドットの 大きさ。ボード ぜんたいが はいる いちばん 大きい ばいりつに する。 */
export function viewSize(cssW: number, cssH: number, dpr: number, boardW = 15 * TILE, boardH = 13 * TILE + BLOCK_LIFT + 4) {
  const dw = Math.max(1, Math.round(cssW * dpr)), dh = Math.max(1, Math.round(cssH * dpr))
  let scale = Math.min(dw / boardW, dh / boardH)
  // こまかい 画面では ばいりつを せいすうに して ドットの はばを そろえる。
  if (dpr < 2 && scale >= 2) scale = Math.floor(scale)
  scale = Math.max(.5, scale)
  return { w: Math.ceil(dw / scale), h: Math.ceil(dh / scale), scale, dw, dh }
}

// ---------------- えの じゅんび ----------------

function heroSprite(facing: HeroFacing, step: HeroStep, flip: boolean) {
  return cached(`hero:${facing}:${step}:${flip}`, () => spriteCanvas(heroRows(facing, step), HERO_PAL, flip))
}
const heroSpecial = (name: 'cheer' | 'ouch') => cached(`hero:${name}`, () => spriteCanvas(name === 'cheer' ? HERO_CHEER : HERO_OUCH, HERO_PAL))

function rideSprite(color: RideColor, facing: HeroFacing, hop: boolean, flip: boolean) {
  const rows = facing === 'front' ? RIDE_FRONT : facing === 'back' ? RIDE_BACK : hop ? RIDE_SIDE_HOP : RIDE_SIDE
  return cached(`ride:${color}:${facing}:${hop}:${flip}`, () => spriteCanvas(rows, ridePalette(color), flip))
}

function enemySprite(kind: EnemyKind, flip: boolean) {
  return cached(`enemy:${kind}:${flip}`, () => spriteCanvas(ENEMY_ART[kind].rows, ENEMY_ART[kind].pal, flip))
}

function whiteOf(key: string, img: Img | null) {
  return cached(`white:${key}`, () => silhouette(img, '#ffffff'))
}

export function heroImage() {
  return heroSprite('front', 'stand', false)
}
export function heroCheerImage() {
  return heroSpecial('cheer')
}
export function heroOuchImage() {
  return heroSpecial('ouch')
}
export function itemIconImage(kind: keyof typeof ITEM_ICONS) {
  return cached(`icon:${kind}`, () => spriteCanvas(ITEM_ICONS[kind], ITEM_PAL))
}
export function rideImage(color: RideColor) {
  return rideSprite(color, 'side', false, false)
}
export function enemyImage(kind: EnemyKind) {
  return enemySprite(kind, false)
}
export { eggSprite }

function backPattern(th: Theme) {
  return cached(`back:${th.id}`, () => {
    const made = makeCanvas(32, 32)
    if (!made) return null
    const { ctx } = made
    const [a, b, c] = th.back
    rect(ctx, 0, 0, 32, 32, a)
    switch (th.weather) {
      case 'leaf':
        for (let i = 0; i < 7; i++) shadedOval(ctx, (i * 11) % 32, (i * 7) % 32, 5, 4, [c, a, b])
        break
      case 'sand':
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (Math.sin((x + y * 2.2) * .4) > .8) rect(ctx, x, y, 1, 1, c)
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (Math.sin((x * .7 - y * 1.7) * .3) > .92) rect(ctx, x, y, 1, 1, b)
        break
      case 'snow':
        for (let i = 0; i < 6; i++) { const x = (i * 13) % 32, y = (i * 9) % 32; rect(ctx, x, y, 1, 3, c); rect(ctx, x - 1, y + 1, 3, 1, c) }
        break
      case 'ember':
        for (let i = 0; i < 6; i++) shadedOval(ctx, (i * 13) % 32, (i * 11) % 32, 6, 4, [b, a, b])
        for (let i = 0; i < 9; i++) rect(ctx, (i * 7) % 32, (i * 5 + 3) % 32, 2, 1, c)
        break
      default:
        for (let row = 0; row < 4; row++) {
          rect(ctx, 0, row * 8 + 7, 32, 1, b)
          for (let x = row % 2 ? 0 : 8; x < 32; x += 16) rect(ctx, x, row * 8, 1, 7, b)
          rect(ctx, 0, row * 8, 32, 1, c)
        }
    }
    return made.canvas
  })
}

// ---------------- ほのお ----------------

type FireCell = { h: boolean; v: boolean; center: boolean; end: number; k: number }

function fireStrength(b: Blast) {
  if (b.t < 4) return (b.t + 1) / 5
  if (b.t > FIRE_FRAMES - 12) return Math.max(0, (FIRE_FRAMES - b.t) / 12)
  return 1
}

function collectFire(w: World) {
  const cells = new Map<number, FireCell>()
  const put = (tx: number, ty: number, k: number, f: (c: FireCell) => void) => {
    const key = ty * w.cols + tx
    let c = cells.get(key)
    if (!c) { c = { h: false, v: false, center: false, end: -1, k: 0 }; cells.set(key, c) }
    c.k = Math.max(c.k, k)
    f(c)
  }
  for (const b of w.blasts) {
    const k = fireStrength(b)
    if (k <= 0) continue
    const isLine = b.arms.filter(a => a > 0).length === 1 && b.power === 2 && w.boss?.kind === 'dragon'
    put(b.tx, b.ty, k, c => { if (isLine) { c.h = true } else c.center = true })
    b.arms.forEach((len, d) => {
      for (let i = 1; i <= len; i++) {
        put(b.tx + DX[d] * i, b.ty + DY[d] * i, k, c => {
          if (d % 2) c.h = true; else c.v = true
          if (i === len && !c.center) c.end = d
        })
      }
    })
  }
  return cells
}

const FIRE_COLORS = ['#ff3a1e', '#ff8a1e', '#ffd23c', '#fff8d8']

function drawFireCell(ctx: CanvasRenderingContext2D, x0: number, y0: number, c: FireCell, frame: number, tx: number, ty: number) {
  const k = c.k
  const cross = c.center || (c.h && c.v)
  const layers = [1, .78, .52, .26]
  for (let li = 0; li < 4; li++) {
    ctx.fillStyle = FIRE_COLORS[li]
    const full = (cross ? 15 : 13) * k * layers[li]
    if (c.h || cross) {
      for (let x = 0; x < TILE; x++) {
        let half = full / 2 + (hash2(tx * 16 + x, (frame >> 1) + li * 7) - .5) * 2 * k
        if (c.end === 1 && !cross) half *= Math.max(0, Math.min(1, (16 - x) / 8))
        if (c.end === 3 && !cross) half *= Math.max(0, Math.min(1, (x + 1) / 8))
        if (half <= .4) continue
        ctx.fillRect(x0 + x, Math.round(y0 + 8 - half), 1, Math.max(1, Math.round(half * 2)))
      }
    }
    if (c.v || cross) {
      for (let y = 0; y < TILE; y++) {
        let half = full / 2 + (hash2(ty * 16 + y, (frame >> 1) + li * 5 + 99) - .5) * 2 * k
        if (c.end === 2 && !cross) half *= Math.max(0, Math.min(1, (16 - y) / 8))
        if (c.end === 0 && !cross) half *= Math.max(0, Math.min(1, (y + 1) / 8))
        if (half <= .4) continue
        ctx.fillRect(Math.round(x0 + 8 - half), y0 + y, Math.max(1, Math.round(half * 2)), 1)
      }
    }
    if (cross) disc(ctx, x0 + 8, y0 + 8, (cross ? 8 : 6) * k * layers[li] + (li === 0 ? (frame >> 2) % 2 : 0), FIRE_COLORS[li])
  }
}

function glowSprite(r: number, color: string) {
  return cached(`glow:${r}:${color}`, () => {
    const made = makeCanvas(r * 2, r * 2)
    if (!made) return null
    const g = made.ctx.createRadialGradient(r, r, 0, r, r, r)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    made.ctx.fillStyle = g
    made.ctx.fillRect(0, 0, r * 2, r * 2)
    return made.canvas
  })
}

// ---------------- シーン ----------------

type Drawable = { y: number; draw: () => void }

export type DrawOptions = { hideHud?: boolean }

export class Scene {
  readonly theme: Theme
  private ground: Img | null
  private buffer: { canvas: Img; ctx: CanvasRenderingContext2D } | null = null
  private dark: { canvas: Img; ctx: CanvasRenderingContext2D } | null = null

  constructor(world: World) {
    this.theme = THEMES[world.stage.world]
    this.ground = groundLayer(world, this.theme)
    // はじめて つかう ときに え を つくると いっしゅん とまるので、さきに つくっておく。
    for (let i = 0; i < 4; i++) softBurnSprite(this.theme, i)
    for (const hot of [false, true]) for (let size = 0; size < 3; size++) { bombSprite(size, hot, false); if (world.boss) bombSprite(size, hot, true) }
    for (const kind of ['bomb', 'fire', 'speed', 'heart', 'star'] as const) { itemSprite(kind); itemIconImage(kind) }
    if (world.stage.egg) eggSprite(world.stage.egg)
    for (const e of world.enemies) { const img = enemySprite(e.kind, false); whiteOf(`enemy:${e.kind}:false`, img); whiteOf(`enemy:${e.kind}:true`, enemySprite(e.kind, true)) }
  }

  private target(w: number, h: number) {
    if (!this.buffer || this.buffer.canvas.width !== w || this.buffer.canvas.height !== h) this.buffer = makeCanvas(w, h)
    return this.buffer
  }

  draw(world: World, fx: Fx, time: number, viewW: number, viewH: number): Img | null {
    const buf = this.target(viewW, viewH)
    if (!buf) return null
    const { ctx } = buf
    const th = this.theme
    const frame = world.frame
    ctx.imageSmoothingEnabled = false
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    const bw = world.cols * TILE, bh = world.rows * TILE
    const [sx, sy] = shakeOffset(fx, frame)
    const ox = Math.floor((viewW - bw) / 2) + sx
    const oy = Math.floor((viewH - bh) / 2) + Math.floor(BLOCK_LIFT / 2) + sy

    // そとがわ
    const pat = backPattern(th)
    if (pat) {
      const p = ctx.createPattern(pat, 'repeat')
      if (p) {
        ctx.save()
        ctx.translate(Math.floor(time * 3) % 32, 0)
        ctx.fillStyle = p
        ctx.fillRect(-32, 0, viewW + 64, viewH)
        ctx.restore()
      }
    } else rect(ctx, 0, 0, viewW, viewH, th.back[0])
    // ボードの かげ
    rect(ctx, ox + 3, oy + 3, bw, bh, 'rgba(0,0,0,.35)')

    if (this.ground) ctx.drawImage(this.ground, ox, oy)
    drawWater(ctx, world, th, ox, oy, time)
    this.drawFloorThings(ctx, world, fx, ox, oy, time)
    this.drawScorch(ctx, world, fx, ox, oy)
    this.drawMarks(ctx, world, ox, oy, time)
    this.drawSoftShadows(ctx, world, ox, oy)

    const fire = collectFire(world)
    const rows = this.collectEntities(world, fx, ctx, ox, oy, time)
    for (let ty = 0; ty < world.rows; ty++) {
      this.drawBlockRow(ctx, world, ty, ox, oy)
      this.drawItemRow(ctx, world, ty, ox, oy, time)
      for (let tx = 0; tx < world.cols; tx++) {
        const c = fire.get(ty * world.cols + tx)
        if (c) drawFireCell(ctx, ox + tx * TILE, oy + ty * TILE, c, frame, tx, ty)
      }
      this.drawBombRow(ctx, world, ty, ox, oy)
      const list = rows.get(ty)
      if (list) for (const d of list.sort((a, b) => a.y - b.y)) d.draw()
    }
    this.drawShots(ctx, world, ox, oy, frame)
    this.drawParticles(ctx, fx, ox, oy)
    this.drawIcons(ctx, fx, ox, oy)

    // ひかり
    ctx.globalCompositeOperation = 'lighter'
    const g = glowSprite(14, 'rgba(255,140,40,.32)')
    if (g) for (const [key] of fire) ctx.drawImage(g, ox + (key % world.cols) * TILE - 6, oy + Math.floor(key / world.cols) * TILE - 6)
    const doorGlow = glowSprite(18, 'rgba(255,230,140,.4)')
    if (world.door?.open && doorGlow) ctx.drawImage(doorGlow, ox + world.door.tx * TILE - 10, oy + world.door.ty * TILE - 12)
    ctx.globalCompositeOperation = 'source-over'

    if (world.stage.dark) this.drawDarkness(ctx, world, fire, ox, oy, viewW, viewH, time)
    this.drawWeather(ctx, fx, th)
    if (fx.flash > 0) {
      ctx.globalAlpha = Math.min(.55, fx.flash / 14)
      rect(ctx, 0, 0, viewW, viewH, fx.flashColor)
      ctx.globalAlpha = 1
    }
    return buf.canvas
  }

  private drawFloorThings(ctx: CanvasRenderingContext2D, w: World, fx: Fx, ox: number, oy: number, time: number) {
    const frame = w.frame
    for (let ty = 0; ty < w.rows; ty++) {
      for (let tx = 0; tx < w.cols; tx++) {
        const f = w.floor[ty * w.cols + tx]
        const x0 = ox + tx * TILE, y0 = oy + ty * TILE
        if (isBelt(f)) {
          const dir = f - F_BELT
          const base = beltBase(dir)
          if (base) ctx.drawImage(base, x0, y0)
          const shift = Math.floor(frame * .6) % 8
          for (let i = -1; i < 3; i++) {
            const o = i * 8 + (dir === 1 || dir === 2 ? shift : -shift)
            for (let j = 0; j < 4; j++) {
              const along = o + j, side = 4 + j
              const cA = '#ffd23c', cB = '#c08a18'
              const pts: [number, number][] = dir === 1 ? [[along, side], [along, 15 - side]] : dir === 3 ? [[15 - along, side], [15 - along, 15 - side]]
                : dir === 2 ? [[side, along], [15 - side, along]] : [[side, 15 - along], [15 - side, 15 - along]]
              for (const [px, py] of pts) if (px >= 0 && px < 16 && py >= 3 && py < 14 || (dir % 2 === 0 && px >= 3 && px < 14 && py >= 0 && py < 16)) rect(ctx, x0 + px, y0 + py, 1, 1, j === 3 ? cB : cA)
            }
          }
        } else if (f === F_ICE) {
          if (hash2(tx, ty, Math.floor(time * 1.5)) < .08) {
            const s = sparkleSprite('#ffffff', 1)
            if (s) ctx.drawImage(s, x0 + 4 + Math.floor(hash2(tx, ty, 9) * 8), y0 + 3 + Math.floor(hash2(tx, ty, 8) * 8))
          }
        } else if (f === F_WARP) {
          const pot = warpSprite()
          if (pot) ctx.drawImage(pot, x0 - 1, y0 - 3)
          for (let i = 0; i < 5; i++) {
            const a = time * 5 + i * 1.256
            rect(ctx, Math.round(x0 + 8 + Math.cos(a) * 3.5), Math.round(y0 + 2 + Math.sin(a) * 1.2), 1, 1, i % 2 ? '#d8b8ff' : '#ffffff')
          }
        } else if (f === F_DOOR) {
          const open = !!w.door?.open
          const door = doorSprite(open)
          if (door) ctx.drawImage(door, x0 - 1, y0 - 4)
          if (open) {
            // ここだよ の やじるし
            const bob = Math.round(Math.sin(time * 6) * 2)
            const ay = y0 - 14 + bob
            for (let i = 0; i < 4; i++) rect(ctx, x0 + 8 - i, ay + i, i * 2 + 1, 1, i === 3 ? '#c08a18' : '#ffd23c')
            rect(ctx, x0 + 7, ay - 4, 3, 4, '#ffd23c')
            if (fx.doorGlow > 0 && frame % 10 < 5) {
              const s = sparkleSprite('#fff6a0', 2)
              if (s) ctx.drawImage(s, x0 + 2 + (frame % 12), y0 - 2)
            }
          }
        }
      }
    }
    for (const v of w.vents) {
      const x0 = ox + v.tx * TILE, y0 = oy + v.ty * TILE
      const img = ventSprite()
      if (img) ctx.drawImage(img, x0, y0)
      const c = ventCharge(w, v)
      if (c > 0) {
        const pulse = (Math.sin(time * (8 + c * 20)) + 1) / 2
        oval(ctx, x0 + 8, y0 + 10, 4.5 * Math.max(.3, c), 3.5 * Math.max(.3, c), mixHex('#ff4a1e', '#ffe060', pulse * c))
        if (c > .5) {
          ctx.globalAlpha = .6
          rect(ctx, x0 + 1, y0 + 1, 14, 14, 'rgba(0,0,0,0)')
          for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2
            rect(ctx, Math.round(x0 + 8 + Math.cos(a) * 12), Math.round(y0 + 9 + Math.sin(a) * 10), 2, 2, pulse > .5 ? '#ffd23c' : '#ff6a1e')
          }
          ctx.globalAlpha = 1
        }
      }
    }
  }

  private drawScorch(ctx: CanvasRenderingContext2D, w: World, fx: Fx, ox: number, oy: number) {
    for (const [key, left] of fx.scorch) {
      const tx = key % w.cols, ty = Math.floor(key / w.cols)
      if (w.tiles[key] !== 0) continue
      const a = Math.min(1, left / 80) * .28
      ctx.globalAlpha = a
      oval(ctx, ox + tx * TILE + 8, oy + ty * TILE + 9, 7, 5, '#1a0c10')
      ctx.globalAlpha = 1
    }
  }

  private drawMarks(ctx: CanvasRenderingContext2D, w: World, ox: number, oy: number, time: number) {
    const b = w.boss
    if (b?.mark) {
      // ここに おちてくるよ の しるし（あかい わ と ばってん）
      const pulse = (Math.sin(time * 14) + 1) / 2
      const r = b.mark.r * (.85 + pulse * .15)
      const cx = ox + b.mark.x, cy = oy + b.mark.y + 4
      ctx.globalAlpha = .22 + pulse * .18
      oval(ctx, cx, cy, r, r * .55, '#ff2a3a')
      ctx.globalAlpha = 1
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2 + time * 2
        rect(ctx, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * .55), 2, 1, i % 2 ? '#ffffff' : '#ff2a3a')
      }
      for (let i = -4; i <= 4; i++) {
        rect(ctx, Math.round(cx + i), Math.round(cy + i * .55), 1, 1, '#ff2a3a')
        rect(ctx, Math.round(cx + i), Math.round(cy - i * .55), 1, 1, '#ff2a3a')
      }
    }
    for (const s of w.shots) {
      if (s.kind !== 'fireball' || s.gx === undefined || s.gy === undefined) continue
      const r = 6 + (s.life % 8 < 4 ? 1 : 0)
      ctx.globalAlpha = .55
      oval(ctx, ox + s.gx, oy + s.gy + 2, r, r * .6, '#ff3a1e')
      ctx.globalAlpha = 1
    }
  }

  private drawSoftShadows(ctx: CanvasRenderingContext2D, w: World, ox: number, oy: number) {
    ctx.fillStyle = this.theme.shadow
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.tiles[i] !== T_SOFT || w.burning.has(i)) continue
      const tx = i % w.cols, ty = Math.floor(i / w.cols)
      ctx.fillRect(ox + tx * TILE + TILE, oy + ty * TILE + 2, 3, TILE)
      ctx.fillRect(ox + tx * TILE + 2, oy + ty * TILE + TILE, TILE, 3)
    }
  }

  private drawBlockRow(ctx: CanvasRenderingContext2D, w: World, ty: number, ox: number, oy: number) {
    const th = this.theme
    for (let tx = 0; tx < w.cols; tx++) {
      const i = ty * w.cols + tx
      const t = w.tiles[i]
      let img: Img | null = null
      if (t === T_WALL) img = wallSprite(th, tx * 7 + ty * 3)
      else if (t === T_HARD) img = hardSprite(th)
      else if (t === T_SOFT) {
        const burn = w.burning.get(i)
        img = burn === undefined ? softSprite(th) : softBurnSprite(th, Math.min(3, Math.floor((BURN_FRAMES - burn) / (BURN_FRAMES / 4))))
      }
      if (img) ctx.drawImage(img, ox + tx * TILE - 1, oy + ty * TILE - BLOCK_LIFT - 1)
    }
  }

  private drawItemRow(ctx: CanvasRenderingContext2D, w: World, ty: number, ox: number, oy: number, time: number) {
    for (const it of w.items) {
      if (it.ty !== ty) continue
      const x0 = ox + it.tx * TILE, y0 = oy + it.ty * TILE
      const pop = it.age < 10 ? Math.round(Math.sin(it.age / 10 * Math.PI) * 5) : 0
      const bob = Math.round(Math.sin(time * 4 + it.id) * 1)
      const sh = shadowSprite(12)
      if (sh) ctx.drawImage(sh, x0 + 2, y0 + 12)
      if (it.kind === 'egg' || it.kind === 'gold') {
        const img = eggSprite(it.kind === 'gold' ? 'gold' : it.color ?? 'green')
        const wobble = (it.age % 90) < 16 ? Math.round(Math.sin(it.age * 1.2)) : 0
        if (img) ctx.drawImage(img, x0 + 1 + wobble, y0 + 1 - pop + bob - (it.kind === 'gold' ? 2 : 0))
        if (it.kind === 'gold' || it.age % 50 < 8) {
          const s = sparkleSprite('#fff6a0', it.kind === 'gold' ? 2 : 1)
          const a = time * 3 + it.id
          if (s) ctx.drawImage(s, Math.round(x0 + 8 + Math.cos(a) * 9) - 2, Math.round(y0 + 6 + Math.sin(a) * 7) - 2)
        }
      } else {
        const img = itemSprite(it.kind)
        if (img) ctx.drawImage(img, x0, y0 - pop + bob)
        // きらっと ひかる
        const glint = (it.age + it.id * 13) % 80
        if (glint < 8) for (let i = 0; i < 4; i++) rect(ctx, x0 + 2 + glint * 2 - i, y0 + 2 + i - pop + bob, 1, 1, '#ffffff')
      }
    }
  }

  private drawBombRow(ctx: CanvasRenderingContext2D, w: World, ty: number, ox: number, oy: number) {
    for (const b of w.bombs) {
      const [, bty] = bombTile(b)
      if (bty !== ty) continue
      const [px, py] = bombPos(b)
      const urgent = b.fuse < 50 || b.chain >= 0
      const beat = urgent ? 6 : b.fuse < 100 ? 10 : 16
      const phase = (b.age % beat) / beat
      const size = phase < .5 ? 2 : phase < .75 ? 1 : 0
      const hot = urgent && (b.age >> 2) % 2 === 0
      const img = bombSprite(b.age < 6 ? 2 - Math.floor(b.age / 3) : size, hot, b.owner === 'boss')
      const sh = shadowSprite(14)
      if (sh) ctx.drawImage(sh, ox + px - 7, oy + py + 4)
      const squash = b.age < 4 ? 2 : 0
      if (img) ctx.drawImage(img, ox + px - 9, oy + py - 12 + squash)
      // みちびの ひばな
      const fx0 = ox + px + 5, fy0 = oy + py - 12 + squash
      const flick = (b.age >> 1) % 3
      rect(ctx, fx0, fy0 - 1, 1, 1, '#fff6a0')
      rect(ctx, fx0 - 1 + flick, fy0 - 2 - (flick % 2), 1, 1, flick === 1 ? '#ffffff' : '#ff8a1e')
      if (flick === 0) { rect(ctx, fx0 + 1, fy0 - 3, 1, 1, '#ffd23c'); rect(ctx, fx0 - 1, fy0, 1, 1, '#ff5a1e') }
    }
  }

  private collectEntities(w: World, fx: Fx, ctx: CanvasRenderingContext2D, ox: number, oy: number, time: number) {
    const rows = new Map<number, Drawable[]>()
    const push = (footY: number, draw: () => void) => {
      const row = Math.max(0, Math.min(w.rows - 1, Math.floor((footY - 7) / TILE)))
      const list = rows.get(row) ?? []
      list.push({ y: footY, draw })
      rows.set(row, list)
    }
    for (const t of fx.trails) push(t.y + 7, () => this.drawTrail(ctx, w.hero, t.x, t.y, t.life, ox, oy))
    for (const e of w.enemies) push(e.y + 7, () => this.drawEnemy(ctx, e, w.frame, ox, oy))
    for (const r of w.runaways) push(r.y + 7, () => {
      const img = rideSprite(r.color, 'side', (r.t >> 3) % 2 === 0, r.vx < 0)
      const z = Math.abs(Math.sin(r.t * .25)) * 6
      if (r.t > 40 && (r.t >> 1) % 2) return
      const sh = shadowSprite(12)
      if (sh) ctx.drawImage(sh, ox + r.x - 6, oy + r.y + 5)
      if (img) ctx.drawImage(img, Math.round(ox + r.x - 8), Math.round(oy + r.y - 9 - z))
    })
    if (w.boss) {
      const b = w.boss
      push(b.y + 14, () => this.drawBoss(ctx, b, w.frame, ox, oy, time))
    }
    const h = w.hero
    push(h.y + 7, () => this.drawHero(ctx, w, ox, oy))
    return rows
  }

  private drawTrail(ctx: CanvasRenderingContext2D, h: Hero, x: number, y: number, life: number, ox: number, oy: number) {
    if (!h.ride) return
    const facing: HeroFacing = h.dir === 0 ? 'back' : h.dir === 2 ? 'front' : 'side'
    const img = rideSprite(h.ride, facing, true, h.dir === 3)
    const white = whiteOf(`ride-trail:${h.ride}:${facing}:${h.dir === 3}`, img)
    if (!white) return
    ctx.globalAlpha = .45 * (1 - life / 12)
    ctx.drawImage(white, Math.round(ox + x - 8), Math.round(oy + y - 9))
    ctx.globalAlpha = 1
  }

  private drawHero(ctx: CanvasRenderingContext2D, w: World, ox: number, oy: number) {
    const h = w.hero
    const frame = w.frame
    const x = Math.round(ox + h.x), y = Math.round(oy + h.y)
    if (w.state === 'play' && h.inv > 0 && h.inv < 100 && (frame >> 2) % 2 === 0) {
      const sh = shadowSprite(12)
      if (sh) ctx.drawImage(sh, x - 6, y + 5)
      return
    }
    const z = Math.round(h.z)
    const sh = shadowSprite(z > 4 ? 10 : 12)
    if (sh) ctx.drawImage(sh, x - (z > 4 ? 5 : 6), y + 5)
    const flip = h.dir === 3
    const facing: HeroFacing = h.dir === 0 ? 'back' : h.dir === 2 ? 'front' : 'side'
    let step: HeroStep = 'stand'
    let bob = 0
    if (h.moving) {
      const phase = Math.floor(h.walk / 5) % 4
      step = phase === 1 ? 'a' : phase === 3 ? 'b' : 'stand'
      if (phase % 2 === 1) bob = -1
    }
    let img: Img | null
    if (w.state === 'clear') img = heroSpecial('cheer')
    else if (w.state === 'miss') img = heroSpecial('ouch')
    else if (h.inv >= 100 && !h.ride) img = heroSpecial('ouch')
    else img = heroSprite(facing, step, flip)
    const cheerHop = w.state === 'clear' ? Math.round(Math.abs(Math.sin(w.stateT * .18)) * 6) : 0
    const placing = h.placePose > 0 ? 1 : 0

    // たまごが われて ピョンタが でてくる ところ
    if (h.act?.kind === 'hatch' && h.act.t < 20) {
      const t = h.act.t
      if (img) ctx.drawImage(img, x - 8, y - 9 - z)
      const egg = eggSprite(h.act.color)
      const shake = t < 14 ? Math.round(Math.sin(t * 2.2) * 1.5) : 0
      if (egg && t < 14) ctx.drawImage(egg, x - 7 + shake, y - 6)
      if (t >= 14) {
        const pyon = rideSprite(h.act.color, 'front', false, false)
        const pz = Math.round(Math.sin((t - 14) / 6 * Math.PI) * 6)
        if (pyon) ctx.drawImage(pyon, x - 8, y - 9 - pz)
      }
      return
    }

    if (h.ride && w.state !== 'miss') {
      const hop = h.moving && (Math.floor(h.walk / 6) % 2 === 1)
      const rb = hop ? -2 : 0
      const ride = rideSprite(h.ride, facing, hop, flip)
      const baseY = y - 9 - z + rb
      if (facing === 'side') {
        const s = flip ? -1 : 1
        if (ride) ctx.drawImage(ride, x - 8 + s * 2, baseY)
        if (img) ctx.drawImage(img, 0, 0, 16, 14, x - 8 - s * 2, baseY - 7 + bob, 16, 14)
        // あたまを まえに かさねる
        if (ride) {
          const sx0 = flip ? 0 : 7
          ctx.drawImage(ride, sx0, 0, 9, 9, x - 8 + s * 2 + sx0, baseY, 9, 9)
        }
      } else if (facing === 'front') {
        if (img) ctx.drawImage(img, 0, 0, 16, 14, x - 8, baseY - 9 + bob, 16, 14)
        if (ride) ctx.drawImage(ride, x - 8, baseY)
      } else {
        if (ride) ctx.drawImage(ride, x - 8, baseY)
        if (img) ctx.drawImage(img, 0, 0, 16, 14, x - 8, baseY - 8 + bob, 16, 14)
      }
      return
    }
    if (img) ctx.drawImage(img, x - 8, y - 9 - z + bob + placing - cheerHop)
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, frame: number, ox: number, oy: number) {
    const x = Math.round(ox + e.x), y = Math.round(oy + e.y)
    if (e.dead > 0) {
      if (e.dead > 12) return
      const img = enemySprite(e.kind, e.dir === 3)
      const white = whiteOf(`enemy:${e.kind}:${e.dir === 3}`, img)
      const s = 1 + e.dead * .06
      if (white) ctx.drawImage(white, Math.round(x - 8 * s), Math.round(y - 9 - 8 * (s - 1)), Math.round(16 * s), Math.round(16 * s))
      return
    }
    const flying = e.flying
    const float = flying ? Math.round(Math.sin((e.age + e.id * 9) * .08) * 2) - 3 : 0
    const sh = shadowSprite(flying ? 10 : 12)
    if (sh) ctx.drawImage(sh, x - (flying ? 5 : 6), y + 5)
    const flip = e.dir === 3 || (e.dir !== 1 && (e.id % 2 === 1))
    const img = enemySprite(e.kind, flip)
    if (!img) return
    const blink = e.inv > 0 && (frame >> 1) % 2 === 0
    const src = blink ? whiteOf(`enemy:${e.kind}:${flip}`, img) : img
    if (!src) return
    const moving = e.wait === 0
    const squash = moving && (e.age >> 3) % 2 === 1
    const alpha = e.kind === 'obake' ? .85 : 1
    ctx.globalAlpha = alpha
    if (squash && !flying) ctx.drawImage(src, x - 9, y - 8, 18, 15)
    else ctx.drawImage(src, x - 8, y - 9 + float)
    ctx.globalAlpha = 1
    if (e.inv > 0 && e.hp > 0) {
      // よろいが われた しるし
      rect(ctx, x + 4, y - 10 + float, 2, 2, '#ffe060')
    }
  }

  private drawBoss(ctx: CanvasRenderingContext2D, b: Boss, frame: number, ox: number, oy: number, time: number) {
    const x = Math.round(ox + b.x), y = Math.round(oy + b.y)
    const hurt = b.inv > 40 || b.dead > 0
    const mood = hurt ? 'hurt' as const : b.hp <= Math.ceil(b.maxHp / 2) ? 'angry' as const : 'normal' as const
    const face = b.face < 0 ? -1 : 1
    let img: Img | null = null
    let lift = Math.round(b.z)
    if (b.kind === 'worm' && b.hidden) {
      // じめんの なかを すすむ すなやま
      const r = b.state === 'rumble' ? 9 + (frame % 4 < 2 ? 1 : 0) : 7
      const jx = b.state === 'rumble' ? (frame % 4 < 2 ? -1 : 1) : 0
      shadedOval(ctx, x + jx, y + 10, r + 4, r * .6, [this.theme.floor[0], this.theme.floor[1], this.theme.floor[2], this.theme.floor[3]])
      for (let i = 0; i < 3; i++) rect(ctx, x + jx - 6 + i * 5 + (frame >> 2) % 3, y + 6 - (i % 2), 2, 2, this.theme.floor[3])
      return
    }
    switch (b.kind) {
      case 'puni': {
        let s = 1
        if (b.state === 'crouch') s = 1 - Math.min(1, b.t / 18) * .3
        else if (b.state === 'hop') s = b.z > 30 ? 1.12 : 1.04
        else if (b.state === 'rest') s = b.t < 12 ? .72 + b.t / 12 * .28 : 1 + Math.sin(b.t * .25) * .04
        img = puniKingArt(s, mood, face)
        break
      }
      case 'worm': {
        let rise = 1
        if (b.state === 'up' && b.t < 10) rise = b.t / 10
        if (b.state === 'dive') rise = Math.max(0, 1 - b.t / 26)
        if (b.state === 'emerge') rise = .3
        img = wormArt(rise, b.state === 'up' && ((b.t > 30 && b.t < 52) || (b.t > 90 && b.t < 112)), hurt ? 'hurt' : 'normal', face)
        break
      }
      case 'penguin': {
        const pose = b.state === 'slide' ? 'slide' : b.state === 'dizzy' ? 'dizzy' : b.state === 'throw' ? 'throw' : 'stand'
        img = penguinArt(pose, hurt ? 'hurt' : 'normal', b.state === 'aim' ? b.t >> 2 : b.t >> 4, face)
        break
      }
      case 'dragon': {
        const flying = b.z > 4
        const wing = flying ? Math.floor(b.t / 5) % 3 : 1
        const mouth = (b.state === 'ground' && b.t > 50 && b.t < 100) || (b.state === 'fly' && b.t % 52 > 18 && b.t % 52 < 32)
        img = dragonArt(wing, mouth, hurt ? 'hurt' : 'normal', face)
        break
      }
      case 'king':
        if (b.phase === 1) img = kingMechArt(b.state === 'walk' ? frame >> 3 : 0, mood, b.state === 'break', face)
        else {
          img = kingPodArt(frame >> 1, mood, face)
          lift = b.state === 'tired' ? 0 : 6 + Math.round(Math.sin(time * 5) * 2)
        }
        break
    }
    const shW = b.z > 10 ? 22 : 30
    const sh = shadowSprite(shW)
    if (sh) ctx.drawImage(sh, x - shW / 2, y + 10)
    if (!img) return
    if (b.dead > 0 && (b.dead >> 1) % 2 === 0) return
    const shake = b.state === 'break' || b.dead > 0 ? ((frame >> 1) % 2 ? 1 : -1) : 0
    const dx = x - BOSS_W / 2 + shake, dy = y + 14 - BOSS_FOOT_Y - lift
    const blink = b.inv > 0 && (frame >> 1) % 2 === 0
    const src = blink ? whiteOf(`boss:${b.kind}:${b.state}:${b.phase}:${face}:${mood}:${b.t >> 3}`, img) : img
    if (src) ctx.drawImage(src, dx, dy)
    // ふらふらの ほし
    if (b.kind === 'penguin' && b.state === 'dizzy') {
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + i * 2.1
        const s = sparkleSprite('#ffe060', 1)
        if (s) ctx.drawImage(s, Math.round(x + Math.cos(a) * 12) - 1, Math.round(y - 30 + Math.sin(a) * 3) - 1)
      }
    }
    if (b.kind === 'king' && b.phase === 2 && b.state === 'tired') {
      for (let i = 0; i < 3; i++) {
        const a = time * 5 + i * 2.1
        rect(ctx, Math.round(x + Math.cos(a) * 12), Math.round(y - 32 + Math.sin(a) * 3), 2, 2, '#ffe060')
      }
    }
    // つよく ねらっている「！」
    if ((b.kind === 'penguin' && b.state === 'aim') || (b.kind === 'puni' && b.state === 'crouch') || (b.kind === 'dragon' && b.state === 'ground' && b.t > 50 && b.t < 82)) {
      if ((frame >> 2) % 2 === 0) {
        rect(ctx, x - 1, dy - 10, 3, 6, '#ff3a4a')
        rect(ctx, x - 1, dy - 3, 3, 2, '#ff3a4a')
      }
    }
  }

  private drawShots(ctx: CanvasRenderingContext2D, w: World, ox: number, oy: number, frame: number) {
    for (const s of w.shots) {
      const x = Math.round(ox + s.x), y = Math.round(oy + s.y)
      const sh = shadowSprite(8)
      if (sh) ctx.drawImage(sh, x - 4, y + 3)
      const z = Math.round(s.z)
      switch (s.kind) {
        case 'sand': shadedOval(ctx, x, y - z, 3.5, 3.5, ['#fff0c0', '#e8c070', '#b88a40']); break
        case 'snow': shadedOval(ctx, x, y - z, 3.5, 3.5, ['#ffffff', '#e0ecff', '#a8c0e8']); break
        case 'bolt':
          rect(ctx, x - 1, y - z - 4, 3, 9, '#ffe14a')
          rect(ctx, x - 4, y - z - 1, 9, 3, '#ffe14a')
          rect(ctx, x, y - z - 1, 1, 3, '#ffffff')
          break
        case 'fireball': {
          const r = 4 + (frame % 4 < 2 ? .5 : 0)
          disc(ctx, x, y - z, r + 1.5, '#ff3a1e')
          disc(ctx, x, y - z, r, '#ffa020')
          disc(ctx, x - 1, y - z - 1, r * .5, '#fff6c0')
          rect(ctx, x - Math.round(s.vx * 3), y - z - Math.round(s.vy * 3) + 2, 2, 2, '#ff8a1e')
          break
        }
      }
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, fx: Fx, ox: number, oy: number) {
    for (const p of fx.parts) this.drawParticle(ctx, p, ox, oy)
  }

  private drawParticle(ctx: CanvasRenderingContext2D, p: Particle, ox: number, oy: number) {
    const t = p.life / p.max
    const x = Math.round(ox + p.x), y = Math.round(oy + p.y - p.z)
    switch (p.kind) {
      case 'spark':
      case 'ember':
        if (t > .7 && p.life % 2) return
        rect(ctx, x, y, p.size, p.size, p.color)
        break
      case 'debris':
      case 'shell':
        if (t > .8 && p.life % 2) return
        rect(ctx, x, y, p.size, p.size, p.color)
        if (p.size > 1) rect(ctx, x, y, 1, 1, '#ffffff')
        break
      case 'smoke':
      case 'dust': {
        const r = Math.max(1, p.size * (p.kind === 'dust' ? (1 - t) : .6 + t * .6))
        ctx.globalAlpha = p.kind === 'smoke' ? .55 * (1 - t) : .8 * (1 - t)
        disc(ctx, x, y, r, p.color)
        ctx.globalAlpha = 1
        break
      }
      case 'star': {
        if (t > .75 && p.life % 2) return
        const s = sparkleSprite(p.color, t < .5 ? 2 : 1)
        if (s) ctx.drawImage(s, x - (t < .5 ? 2 : 1), y - (t < .5 ? 2 : 1))
        break
      }
      case 'ring': {
        const r = 3 + t * 14 * p.size
        ctx.globalAlpha = 1 - t
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * Math.PI * 2
          rect(ctx, Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * .7), p.size, 1, p.color)
        }
        ctx.globalAlpha = 1
        break
      }
      case 'confetti':
        rect(ctx, x, y, (p.life >> 3) % 2 ? 2 : 1, (p.life >> 3) % 2 ? 1 : 2, p.color)
        break
      case 'heart':
        if (t > .7 && p.life % 2) return
        rect(ctx, x - 1, y, 1, 1, p.color); rect(ctx, x + 1, y, 1, 1, p.color); rect(ctx, x - 1, y + 1, 3, 1, p.color); rect(ctx, x, y + 2, 1, 1, p.color)
        break
      case 'pop': {
        const r = 4 + t * 10
        ctx.globalAlpha = 1 - t
        disc(ctx, x, y, r, '#ffffff')
        ctx.globalAlpha = 1
        break
      }
      case 'flame': {
        const r = p.size * (t < .3 ? t / .3 : 1 - (t - .3) / .7 * .6)
        disc(ctx, x, y, r, '#ff4a1e')
        disc(ctx, x, y, r * .72, '#ffa020')
        disc(ctx, x, y, r * .4, '#fff6c0')
        break
      }
    }
  }

  private drawIcons(ctx: CanvasRenderingContext2D, fx: Fx, ox: number, oy: number) {
    for (const icon of fx.icons) {
      const t = icon.life / 40
      if (t > .75 && icon.life % 2) continue
      const x = Math.round(ox + icon.x), y = Math.round(oy + icon.y - icon.life * .6)
      if (icon.kind === 'egg' || icon.kind === 'gold') continue
      const img = itemIconImage(icon.kind)
      if (img) ctx.drawImage(img, x - 5, y - 10)
      // ＋1
      rect(ctx, x + 6, y - 6, 3, 1, '#ffffff')
      rect(ctx, x + 7, y - 7, 1, 3, '#ffffff')
      rect(ctx, x + 10, y - 8, 1, 5, '#ffffff')
      rect(ctx, x + 9, y - 7, 1, 1, '#ffffff')
    }
  }

  private drawDarkness(ctx: CanvasRenderingContext2D, w: World, fire: Map<number, FireCell>, ox: number, oy: number, vw: number, vh: number, time: number) {
    if (!this.dark || this.dark.canvas.width !== vw || this.dark.canvas.height !== vh) this.dark = makeCanvas(vw, vh)
    if (!this.dark) return
    const d = this.dark.ctx
    d.globalCompositeOperation = 'source-over'
    d.clearRect(0, 0, vw, vh)
    d.fillStyle = this.theme.night
    d.globalAlpha = .84
    d.fillRect(0, 0, vw, vh)
    d.globalAlpha = 1
    d.globalCompositeOperation = 'destination-out'
    const light = (x: number, y: number, r: number) => {
      const flick = Math.sin(time * 9 + x) * .6
      for (const [k, a] of [[1, .35], [.78, .55], [.56, 1]] as const) {
        d.globalAlpha = a
        disc(d, Math.round(x), Math.round(y), r * k + flick, '#000000')
      }
      d.globalAlpha = 1
    }
    const h = w.hero
    light(ox + h.x, oy + h.y - 4, h.ride ? 58 : 52)
    for (const [key] of fire) light(ox + (key % w.cols) * TILE + 8, oy + Math.floor(key / w.cols) * TILE + 8, 20)
    for (const b of w.bombs) { const [px, py] = bombPos(b); light(ox + px + 5, oy + py - 10, 9) }
    for (const v of w.vents) { const c = ventCharge(w, v); if (c > 0) light(ox + v.tx * TILE + 8, oy + v.ty * TILE + 9, 10 + c * 16) }
    if (w.door?.open) light(ox + w.door.tx * TILE + 8, oy + w.door.ty * TILE + 6, 28)
    for (const it of w.items) light(ox + it.tx * TILE + 8, oy + it.ty * TILE + 8, 10)
    for (const e of w.enemies) if (e.kind === 'hinotama' && e.dead === 0) light(ox + e.x, oy + e.y, 18)
    for (const s of w.shots) light(ox + s.x, oy + s.y - s.z, 10)
    d.globalCompositeOperation = 'source-over'
    ctx.drawImage(this.dark.canvas, 0, 0)
  }

  private drawWeather(ctx: CanvasRenderingContext2D, fx: Fx, th: Theme) {
    const color = th.weather === 'leaf' ? ['#b6f07a', '#ffe060'] : th.weather === 'sand' ? ['#fff0c0', '#f0c878'] : th.weather === 'snow' ? ['#ffffff', '#e0ecff']
      : th.weather === 'ember' ? ['#ffb040', '#ff6a1e'] : ['#d8d0f0', '#a89cc8']
    for (const p of fx.weather) {
      const c = color[(p.phase * 3 | 0) % 2]
      if (th.weather === 'ember' && Math.sin(p.phase * 4) < -.6) continue
      ctx.globalAlpha = th.weather === 'dust' ? .5 : .9
      rect(ctx, Math.round(p.x), Math.round(p.y), p.size, th.weather === 'leaf' ? p.size + (Math.sin(p.phase) > 0 ? 1 : 0) : p.size, c)
    }
    ctx.globalAlpha = 1
  }
}

/** タイトルや マップの ちいさな え（ステージの ようす）。 */
export function stageThumbnail(world: World, w: number, h: number): string | null {
  try {
    const scene = new Scene(world)
    const img = scene.draw(world, { parts: [], icons: [], trails: [], weather: [], shake: 0, flash: 0, flashColor: '#fff', doorGlow: 0, scorch: new Map(), seed: 1 }, 1, w, h)
    return img?.toDataURL() ?? null
  } catch {
    return null
  }
}

