// えを かく ところ。ひくい かいぞうどの バッファ（ドットの 大きさ そのまま）に かいてから、
// 画面へ 整数ばいで ひきのばす ので、どこを とっても ドットが そろう。

import {
  FAR_H, FAR_W, MID_H, MID_W, NEAR_H, NEAR_W, Pix, SKY_H, SKY_Y0, aurora, bubbleSprite, celestial, cloud, decoSprites,
  farStrip, medalFrames, midStrip, nearStrip, pack, platformTile, propSprite, rockTile, skyStrip, starField, type Star,
} from './art'
import { bayer, hash2, makeCanvas, mixHex, rng, spriteCanvas, type Img } from './pixel'
import {
  BEE, BEE_PAL, BLOCK, BLOCK_PAL, BLOCK_USED, BLOCK_USED_PAL, BUNNY, BUNNY_POSES, CARROT, CARROT_PAL, CRAB, CRAB_PAL, GULL,
  GULL_PAL, OWL, OWL_PAL, PENGUIN, PENGUIN_PAL, SNAIL, SNAIL_PAL, SPRING, SPRING_PAL, SPRING_SQUASH, type BunnyPose,
} from './sprites'
import { stageRows, GROUND_Y, HERO_H, HERO_W, ROWS, TILE, WORLD_H, cellAt, type World, type WorldEvent } from './world'
import { THEMES, type Theme } from './theme'

/** 画面の ドットの 大きさ（せかいの 1ドットを 画面の なんドットで かくか）。 */
export function viewSize(cssW: number, cssH: number, dpr: number) {
  const dw = Math.max(1, Math.round(cssW * dpr)), dh = Math.max(1, Math.round(cssH * dpr))
  // たて画面は よこはばを せまく して、うさぎを 大きめに みせる。
  const minW = cssW < cssH ? 176 : 256
  const scale = Math.max(1, Math.floor(Math.min(dw / minW, dh / 150)))
  return { w: Math.ceil(dw / scale), h: Math.ceil(dh / scale), scale, dw, dh }
}

export type Cam = { x: number; y: number }

/** せかいの どこを うつすか（うさぎの すこし まえを ひろく みせる）。 */
export function cameraTarget(world: World, w: number, h: number): Cam {
  const lead = Math.max(40, Math.min(120, Math.round(w * .28)))
  const x = Math.max(0, Math.min(world.width - w, world.hero.x - lead))
  const base = baseTop(h)
  const y = Math.min(base, world.hero.y - 26)
  return { x, y }
}

function baseTop(h: number) {
  return WORLD_H + Math.max(0, Math.min(60, (h - 160) * .18)) - h
}

// ---------------- こうか（つぶ） ----------------

type Particle = {
  kind: 'dust' | 'spark' | 'star' | 'ring' | 'confetti' | 'carrot' | 'puff' | 'line'
  x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number
}
type Weather = { x: number; y: number; vx: number; vy: number; phase: number; size: number }

export type Fx = { parts: Particle[]; weather: Weather[]; lastRun: number; flagRaise: number; shake: number }

export function createFx(): Fx {
  return { parts: [], weather: [], lastRun: 0, flagRaise: 0, shake: 0 }
}

const SPARK = ['#ffffff', '#fff6a0', '#ffd23c', '#ffb0c8']
const CONFETTI = ['#ff5a6a', '#ffd23c', '#5ad0ff', '#7ce06a', '#ff9ad8', '#ffffff']

export function spawnFx(fx: Fx, event: WorldEvent, frame: number) {
  const r = rng(frame * 31 + ('x' in event ? Math.floor(event.x) : 0))
  const add = (p: Omit<Particle, 'life'>) => fx.parts.push({ ...p, life: 0 })
  switch (event.type) {
    case 'jump':
      for (let i = 0; i < 4; i++) add({ kind: 'dust', x: event.x - 3 + i * 2, y: event.y - 1, vx: -.6 - r() * .6, vy: -.2 - r() * .3, max: 18 + r() * 8, color: '#ffffff', size: 2 })
      break
    case 'double':
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2
        add({ kind: 'puff', x: event.x, y: event.y - 2, vx: Math.cos(a) * 1.1, vy: Math.sin(a) * .6 + .3, max: 16, color: '#ffffff', size: 2 })
      }
      break
    case 'land':
      if (!event.hard) break
      for (let i = 0; i < 6; i++) add({ kind: 'dust', x: event.x + (i < 3 ? -4 : 4), y: event.y - 1, vx: (i < 3 ? -1 : 1) * (.4 + r() * .8), vy: -.3 - r() * .3, max: 18, color: '#ffffff', size: 2 })
      break
    case 'carrot':
      for (let i = 0; i < 7; i++) {
        const a = r() * Math.PI * 2, s = .5 + r() * 1.3
        add({ kind: 'spark', x: event.x, y: event.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - .4, max: 16 + r() * 14, color: SPARK[i % 4], size: 1 })
      }
      break
    case 'block':
      add({ kind: 'carrot', x: event.x, y: event.y - 4, vx: 0, vy: -2.6, max: 32, color: '', size: 1 })
      break
    case 'medal':
      add({ kind: 'ring', x: event.x, y: event.y, vx: 0, vy: 0, max: 26, color: '#fff6a0', size: 1 })
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2, s = 1 + r() * 1.5
        add({ kind: i % 3 ? 'spark' : 'star', x: event.x, y: event.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, max: 30 + r() * 20, color: SPARK[i % 3], size: 1 })
      }
      fx.shake = 6
      break
    case 'stomp':
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI * (.1 + i / 5 * .8)
        add({ kind: 'star', x: event.x, y: event.y, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.4, max: 22, color: '#fff6a0', size: 1 })
      }
      for (let i = 0; i < 4; i++) add({ kind: 'puff', x: event.x + (i - 1.5) * 4, y: event.y + 6, vx: (i - 1.5) * .3, vy: -.2, max: 18, color: '#ffffff', size: 3 })
      break
    case 'hurt':
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2
        add({ kind: 'star', x: event.x, y: event.y - 6, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * .8 - .6, max: 26, color: '#ffe060', size: 1 })
      }
      fx.shake = 8
      break
    case 'spring':
      for (let i = 0; i < 6; i++) add({ kind: 'line', x: event.x - 6 + i * 2.4, y: event.y - 4, vx: 0, vy: -2.4 - r(), max: 12, color: '#ffffff', size: 1 })
      break
    case 'rescue':
      add({ kind: 'ring', x: event.x, y: event.y, vx: 0, vy: 0, max: 18, color: '#dff8ff', size: 1 })
      for (let i = 0; i < 10; i++) {
        const a = r() * Math.PI * 2
        add({ kind: 'spark', x: event.x, y: event.y, vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 1.4, max: 20, color: '#bfefff', size: 1 })
      }
      break
    case 'goal':
      fx.flagRaise = 1
      for (let i = 0; i < 70; i++) {
        add({ kind: 'confetti', x: event.x + (r() - .5) * 30, y: event.y - 60 - r() * 30, vx: (r() - .5) * 2.4, vy: -1.5 - r() * 2.5, max: 110 + r() * 60, color: CONFETTI[i % CONFETTI.length], size: 1 })
      }
      break
    default:
      break
  }
}

export function updateFx(fx: Fx, world: World) {
  const { hero } = world
  // はしって いる ときの ちいさな つちけむり。
  if (hero.onGround && hero.run - fx.lastRun > 14) {
    fx.lastRun = hero.run
    fx.parts.push({ kind: 'dust', x: hero.x + 1, y: hero.y + HERO_H - 1, vx: -.4, vy: -.25, life: 0, max: 14, color: '#ffffff', size: 1 })
  }
  if (!hero.onGround) fx.lastRun = hero.run
  if (fx.flagRaise > 0 && fx.flagRaise < 60) fx.flagRaise++
  if (fx.shake > 0) fx.shake--
  for (const p of fx.parts) {
    p.life++
    p.x += p.vx
    p.y += p.vy
    if (p.kind === 'confetti') { p.vy = Math.min(1.1, p.vy + .06); p.vx *= .97 }
    else if (p.kind === 'spark' || p.kind === 'star') { p.vx *= .93; p.vy = p.vy * .93 + .03 }
    else if (p.kind === 'dust' || p.kind === 'puff') { p.vx *= .9; p.vy *= .9 }
    else if (p.kind === 'carrot') p.vy += .12
  }
  fx.parts = fx.parts.filter(p => p.life < p.max)
}

// ---------------- ステージの 絵 ----------------

const LEVEL_H = 272

export class Scene {
  readonly theme: Theme
  private level: Img | null
  private sky: Img | null
  private far: Img | null
  private mid: Img | null
  private near: Img | null
  private sun: Img | null
  private stars: { img: Img | null; stars: Star[] }
  private aurora: Img | null
  private clouds: { img: Img; x: number; y: number; speed: number }[]
  private bunny: Record<BunnyPose, Img | null>
  private carrot: Img | null
  private block: Img | null
  private blockUsed: Img | null
  private spring: [Img | null, Img | null]
  private walker: { left: (Img | null)[]; right: (Img | null)[] }
  private flyer: { left: (Img | null)[]; right: (Img | null)[] }
  private medal: Img[]
  private bubble: Img | null
  private buffer: { canvas: Img; ctx: CanvasRenderingContext2D } | null = null

  constructor(world: World) {
    const theme = THEMES[world.stage.id]
    this.theme = theme
    this.sky = skyStrip(theme)
    this.far = farStrip(theme)
    this.mid = midStrip(theme)
    this.near = nearStrip(theme)
    this.sun = celestial(theme)
    this.stars = theme.celestial === 'moon' ? starField(theme, 320, 260) : { img: null, stars: [] }
    this.aurora = theme.celestial === 'moon' ? aurora(360, 90) : null
    const r = rng(5)
    this.clouds = Array.from({ length: 6 }, (_, i) => ({ img: cloud(theme, 40 + i), x: i * 170 + r() * 60, y: theme.horizon - 150 + r() * 100, speed: 2 + r() * 3 }))
      .filter((c): c is { img: Img; x: number; y: number; speed: number } => !!c.img)
    this.bunny = Object.fromEntries(Object.entries(BUNNY_POSES).map(([k, rows]) => [k, spriteCanvas(rows, BUNNY)])) as Record<BunnyPose, Img | null>
    this.carrot = spriteCanvas(CARROT, CARROT_PAL)
    this.block = spriteCanvas(BLOCK, BLOCK_PAL)
    this.blockUsed = spriteCanvas(BLOCK_USED, BLOCK_USED_PAL)
    this.spring = [spriteCanvas(SPRING, SPRING_PAL), spriteCanvas(SPRING_SQUASH, SPRING_PAL)]
    const walker = { snail: [SNAIL, SNAIL_PAL], crab: [CRAB, CRAB_PAL], penguin: [PENGUIN, PENGUIN_PAL] } as const
    const flyer = { bee: [BEE, BEE_PAL], gull: [GULL, GULL_PAL], owl: [OWL, OWL_PAL] } as const
    const [wf, wp] = walker[world.stage.walker]
    const [ff, fp] = flyer[world.stage.flyer]
    this.walker = { left: wf.map(f => spriteCanvas(f, wp)), right: wf.map(f => spriteCanvas(f, wp, true)) }
    this.flyer = { left: ff.map(f => spriteCanvas(f, fp)), right: ff.map(f => spriteCanvas(f, fp, true)) }
    this.medal = medalFrames()
    this.bubble = bubbleSprite()
    this.level = buildLevel(world, theme)
  }

  private target(w: number, h: number) {
    if (!this.buffer || this.buffer.canvas.width !== w || this.buffer.canvas.height !== h) this.buffer = makeCanvas(w, h)
    return this.buffer
  }

  draw(world: World, cam: Cam, time: number, fx: Fx, w: number, h: number, opts: { fade?: number } = {}): Img | null {
    const buf = this.target(w, h)
    if (!buf) return null
    const { ctx } = buf
    const theme = this.theme
    const shake = fx.shake > 0 ? Math.round(Math.sin(fx.shake * 2.3) * Math.min(2, fx.shake / 3)) : 0
    const cx = Math.round(cam.x) + shake, cy = Math.round(cam.y)
    const base = baseTop(h)
    // うえに ついていく ときは、とおくの けしきほど すこししか うごかない。
    const layerY = (k: number) => Math.round(base + (cam.y - base) * k)

    // そら
    ctx.fillStyle = theme.sky[0]
    ctx.fillRect(0, 0, w, h)
    if (this.sky) {
      const sy = SKY_Y0 - layerY(.1)
      for (let x = 0; x < w; x += 64) ctx.drawImage(this.sky, x, sy)
      if (sy + SKY_H < h) { ctx.fillStyle = theme.sky.at(-1)!; ctx.fillRect(0, sy + SKY_H, w, h) }
    }
    if (this.stars.img) {
      const sx = -((cx * .04) % 320), sy = theme.horizon - 330 - layerY(.05)
      for (let x = sx - 320; x < w; x += 320) ctx.drawImage(this.stars.img, Math.round(x), sy)
      for (const s of this.stars.stars) {
        const tw = Math.sin(time * 2.2 + s.phase)
        if (!s.bright || tw < .35) continue
        for (let x = sx - 320; x < w; x += 320) {
          const px = Math.round(x + s.x), py = sy + s.y
          ctx.fillStyle = tw > .8 ? '#ffffff' : '#bcd4ff'
          ctx.fillRect(px - 1, py, 3, 1)
          ctx.fillRect(px, py - 1, 1, 3)
          if (tw > .85) { ctx.fillStyle = '#8aa4e8'; ctx.fillRect(px - 2, py, 1, 1); ctx.fillRect(px + 2, py, 1, 1); ctx.fillRect(px, py - 2, 1, 1); ctx.fillRect(px, py + 2, 1, 1) }
        }
      }
    }
    if (this.aurora) {
      const ay = theme.horizon - 176 - layerY(.04)
      ctx.globalAlpha = .55 + Math.sin(time * .5) * .12
      const ax = -((cx * .03 + time * 3) % 360)
      for (let x = ax - 360; x < w; x += 360) ctx.drawImage(this.aurora, Math.round(x), ay + Math.round(Math.sin(time * .7 + x * .01) * 2))
      ctx.globalAlpha = 1
    }
    if (this.sun) {
      const size = this.sun.width
      const sx = Math.round(w * .74 - size / 2 - cx * .015)
      const sy = theme.celestial === 'sunset' ? theme.horizon - size / 2 - layerY(.12) + 4 : theme.horizon - (theme.celestial === 'moon' ? 150 : 128) - layerY(.08)
      ctx.drawImage(this.sun, sx, sy)
    }
    for (const c of this.clouds) {
      const period = Math.max(w + 180, 900)
      const x = ((c.x - cx * .2 - time * c.speed) % period + period) % period - 90
      ctx.drawImage(c.img, Math.round(x), c.y - layerY(.15))
    }

    // とおくの けしき
    if (this.far) {
      const top = (theme.far.kind === 'sea' ? theme.horizon - 30 : theme.horizon - FAR_H + 18) - layerY(.18)
      const fx0 = -((cx * .12) % FAR_W)
      for (let x = fx0 - FAR_W; x < w; x += FAR_W) ctx.drawImage(this.far, Math.round(x), top)
      if (theme.far.kind === 'sea') {
        ctx.fillStyle = theme.far.colors[4]
        ctx.fillRect(0, top + FAR_H, w, h)
        this.drawSunGlitter(ctx, w, time, top + 30, cx)
      }
    }
    if (this.mid) {
      const top = 152 - MID_H - layerY(.35)
      const mx = -((cx * .35) % MID_W)
      for (let x = mx - MID_W; x < w; x += MID_W) ctx.drawImage(this.mid, Math.round(x), top)
      ctx.fillStyle = theme.mid.colors.at(-1)!
      ctx.fillRect(0, top + MID_H, w, h)
    }
    if (this.near) {
      const top = 142 - NEAR_H - layerY(.6)
      const nx = -((cx * .6) % NEAR_W)
      for (let x = nx - NEAR_W; x < w; x += NEAR_W) ctx.drawImage(this.near, Math.round(x), top)
      ctx.fillStyle = theme.near.colors.at(-1)!
      ctx.fillRect(0, top + NEAR_H, w, h)
    }

    // じめん
    if (this.level) ctx.drawImage(this.level, -cx, -cy)

    ctx.save()
    ctx.translate(-cx, -cy)
    this.drawGoal(ctx, world, time, fx)
    this.drawBlocks(ctx, world, cx, w)
    for (const s of world.springs) {
      if (s.x < cx - 16 || s.x > cx + w) continue
      const img = this.spring[s.t > 6 ? 1 : 0]
      if (img) ctx.drawImage(img, s.x, s.y + (s.t > 0 && s.t <= 6 ? -1 : 0))
    }
    this.drawPickups(ctx, world, time, cx, w)
    this.drawEnemies(ctx, world, cx, w)
    this.drawHero(ctx, world, time)
    this.drawParticles(ctx, fx)
    ctx.restore()

    this.drawWeather(ctx, fx, w, h, time, cx)
    if (opts.fade && opts.fade > 0) {
      ctx.fillStyle = '#000000'
      ctx.globalAlpha = Math.min(1, opts.fade)
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 1
    }
    return buf.canvas
  }

  private drawSunGlitter(ctx: CanvasRenderingContext2D, w: number, time: number, sea: number, cx: number) {
    const size = this.sun?.width ?? 0
    const center = Math.round(w * .74 - cx * .015)
    for (let i = 0; i < 14; i++) {
      const y = sea + 2 + i * 3 + (i > 6 ? i - 6 : 0)
      const spread = 6 + i * 1.8
      const wob = Math.sin(time * 3 + i * 1.7) * 3
      const len = Math.max(2, Math.round(size * .3 - i * 1.2 + Math.sin(time * 4 + i) * 3))
      ctx.fillStyle = i < 4 ? '#fff0a0' : i < 9 ? '#ffc070' : '#ff9a70'
      ctx.fillRect(Math.round(center - len / 2 + wob), y, len, 1)
      if (i % 2 === 0) ctx.fillRect(Math.round(center + spread * Math.sin(time * 2 + i) - 1), y + 1, 2, 1)
    }
  }

  private drawGoal(ctx: CanvasRenderingContext2D, world: World, time: number, fx: Fx) {
    const x = Math.round(world.goalX) - 1
    const top = GROUND_Y - 92
    // ポール
    ctx.fillStyle = '#3a2a44'
    ctx.fillRect(x - 1, top + 4, 4, GROUND_Y - top - 4)
    ctx.fillStyle = '#f4f4ff'
    ctx.fillRect(x, top + 5, 1, GROUND_Y - top - 6)
    ctx.fillStyle = '#b4b4d0'
    ctx.fillRect(x + 1, top + 5, 1, GROUND_Y - top - 6)
    // てっぺんの たま
    ctx.fillStyle = '#6a3a00'
    ctx.fillRect(x - 2, top - 2, 6, 7)
    ctx.fillRect(x - 3, top - 1, 8, 5)
    ctx.fillStyle = '#ffc830'
    ctx.fillRect(x - 2, top - 1, 6, 5)
    ctx.fillStyle = '#fff4a0'
    ctx.fillRect(x - 1, top, 2, 2)
    // だい
    ctx.fillStyle = '#3a2a44'
    ctx.fillRect(x - 6, GROUND_Y - 6, 14, 6)
    ctx.fillStyle = '#8a8ab0'
    ctx.fillRect(x - 5, GROUND_Y - 5, 12, 4)
    ctx.fillStyle = '#c8c8e0'
    ctx.fillRect(x - 5, GROUND_Y - 5, 12, 1)
    // はた（ゴールすると うえまで あがる）
    const raise = fx.flagRaise / 60
    const eased = 1 - Math.pow(1 - raise, 3)
    const flagY = Math.round(GROUND_Y - 44 - eased * 40)
    for (let i = 0; i < 20; i++) {
      const wave = Math.round(Math.sin(time * 7 - i * .45) * 1.4 * (i / 20))
      const hgt = 14 - Math.floor(i / 3)
      const y0 = flagY + wave + Math.floor((14 - hgt) / 2)
      ctx.fillStyle = '#5a0c1c'
      ctx.fillRect(x + 3 + i, y0 - 1, 1, hgt + 2)
      for (let k = 0; k < hgt; k++) {
        ctx.fillStyle = k === 0 ? '#ff8a8a' : k >= hgt - 2 ? '#b01a34' : '#ec3a50'
        ctx.fillRect(x + 3 + i, y0 + k, 1, 1)
      }
    }
    // はたの にんじん もよう
    if (this.carrot) {
      const wave = Math.round(Math.sin(time * 7 - 6 * .45) * 1.4 * .3)
      ctx.drawImage(this.carrot, x + 7, flagY + 1 + wave, 9, 11)
    }
  }

  private drawBlocks(ctx: CanvasRenderingContext2D, world: World, cx: number, w: number) {
    const c0 = Math.max(0, Math.floor(cx / TILE) - 1), c1 = Math.min(world.cols - 1, Math.ceil((cx + w) / TILE) + 1)
    for (let r = 0; r < ROWS; r++) {
      for (let c = c0; c <= c1; c++) {
        const cell = world.cells[r][c]
        if (cell !== '?' && cell !== 'u') continue
        const bump = world.bumps.find(b => b.col === c && b.row === r)
        const off = bump ? -Math.round(Math.sin(bump.t / 12 * Math.PI) * 4) : 0
        const img = cell === '?' ? this.block : this.blockUsed
        if (img) ctx.drawImage(img, c * TILE, r * TILE + off)
      }
    }
  }

  private drawPickups(ctx: CanvasRenderingContext2D, world: World, time: number, cx: number, w: number) {
    const carrot = this.carrot
    if (carrot) {
      for (const c of world.carrots) {
        if (c.got || c.x < cx - 12 || c.x > cx + w + 12) continue
        const bob = Math.round(Math.sin(time * 4 + c.x * .09) * 1.2)
        ctx.drawImage(carrot, Math.round(c.x - 4), Math.round(c.y - 6 + bob))
        // ときどき きらっと ひかる。
        const glint = (time * 1.3 + c.x * .013) % 3
        if (glint < .18) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(Math.round(c.x - 2), Math.round(c.y - 1 + bob), 1, 1)
          ctx.fillRect(Math.round(c.x - 3), Math.round(c.y + bob), 3, 1)
          ctx.fillRect(Math.round(c.x - 2), Math.round(c.y + 1 + bob), 1, 1)
        }
      }
      for (const l of world.loose) {
        if (l.age > 270 && Math.floor(l.age / 4) % 2) continue
        ctx.drawImage(carrot, Math.round(l.x - 4), Math.round(l.y - 6))
      }
    }
    for (const m of world.medals) {
      if (m.got || !this.medal.length) continue
      // くるっと まわって すこし とまる。
      const t = (time * 7 + m.id) % 14
      const f = t < 6 ? Math.floor(t) : 0
      const bob = Math.round(Math.sin(time * 3 + m.id) * 1.5)
      ctx.drawImage(this.medal[f], Math.round(m.x - 8), Math.round(m.y - 8 + bob))
      if (t > 9 && t < 10.5) {
        ctx.fillStyle = '#ffffff'
        const sx = Math.round(m.x - 4), sy = Math.round(m.y - 5 + bob)
        ctx.fillRect(sx - 1, sy, 3, 1)
        ctx.fillRect(sx, sy - 1, 1, 3)
      }
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, world: World, cx: number, w: number) {
    for (const e of world.enemies) {
      if (e.x < cx - 24 || e.x > cx + w + 8) continue
      const set = e.kind === 'walker' ? this.walker : this.flyer
      const frames = e.vx > 0 && e.state !== 'bye' ? set.right : set.left
      const f = Math.floor(e.t / (e.kind === 'walker' ? 14 : 6)) % frames.length
      const img = frames[f]
      if (!img) continue
      const ex = Math.round(e.x + e.w / 2 - img.width / 2)
      const ey = Math.round(e.y + e.h - img.height)
      if (e.state === 'bye') drawRotated(ctx, img, ex + img.width / 2, ey + img.height / 2, Math.PI)
      else ctx.drawImage(img, ex, ey)
    }
  }

  private drawHero(ctx: CanvasRenderingContext2D, world: World, time: number) {
    const { hero } = world
    if (hero.invincible > 0 && !hero.bubble && Math.floor(hero.invincible / 3) % 2) return
    let pose: BunnyPose
    if (hero.bubble) pose = 'fall'
    else if (hero.stun > 0) pose = 'hurt'
    else if (world.state === 'ready') pose = Math.floor(time * 1.2) % 4 === 3 ? 'blink' : 'stand'
    else if ((world.state === 'goal' && world.stateT > 50) || world.state === 'done') pose = 'cheer'
    else if (!hero.onGround && hero.air > 2) pose = hero.vy < 0 ? 'jump' : 'fall'
    else if (hero.blocked > 0) pose = (['run0', 'run1'] as const)[Math.floor(world.frame / 10) % 2]
    else pose = (['run0', 'run1', 'run2', 'run3'] as const)[Math.floor(hero.run / 7) % 4]
    const img = this.bunny[pose]
    if (!img) return
    const cxp = Math.round(hero.x + HERO_W / 2)
    const bottom = Math.round(hero.y + HERO_H)
    const bob = pose === 'run1' || pose === 'run3' ? -1 : 0
    const x = cxp - 8, y = bottom - img.height + bob
    if (hero.flip > 0) {
      const k = Math.floor((24 - hero.flip) / 6) % 4
      drawRotated(ctx, img, cxp, bottom - 9, k * Math.PI / 2)
    } else ctx.drawImage(img, x, y)
    if (hero.bubble && this.bubble) {
      const wob = Math.round(Math.sin(time * 6) * 1)
      ctx.drawImage(this.bubble, cxp - 15 + wob, bottom - 22 - wob)
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, fx: Fx) {
    for (const p of fx.parts) {
      const k = p.life / p.max
      const x = Math.round(p.x), y = Math.round(p.y)
      switch (p.kind) {
        case 'dust':
        case 'puff': {
          const s = Math.max(1, Math.round(p.size * (1 - k * .6)))
          ctx.globalAlpha = 1 - k * .7
          ctx.fillStyle = k < .5 ? '#ffffff' : '#d8d4e8'
          ctx.fillRect(x, y, s, s)
          ctx.globalAlpha = 1
          break
        }
        case 'spark':
          ctx.fillStyle = p.color
          ctx.fillRect(x, y, 1, 1)
          if (k < .5) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3) }
          break
        case 'star':
          ctx.fillStyle = k < .6 ? p.color : '#ffa030'
          ctx.fillRect(x - 1, y, 3, 1)
          ctx.fillRect(x, y - 1, 1, 3)
          if (k < .4) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1) }
          break
        case 'ring': {
          const rad = 3 + k * 16
          ctx.fillStyle = p.color
          for (let a = 0; a < 20; a++) {
            const ang = a / 20 * Math.PI * 2
            if ((a + p.life) % 2) continue
            ctx.fillRect(Math.round(p.x + Math.cos(ang) * rad), Math.round(p.y + Math.sin(ang) * rad), 1, 1)
          }
          break
        }
        case 'confetti':
          ctx.fillStyle = p.color
          ctx.fillRect(x, y, (p.life >> 3) % 2 ? 2 : 1, (p.life >> 3) % 2 ? 1 : 2)
          break
        case 'carrot':
          if (this.carrot) {
            ctx.globalAlpha = k > .7 ? 1 - (k - .7) / .3 : 1
            ctx.drawImage(this.carrot, x - 4, y - 6)
            ctx.globalAlpha = 1
          }
          break
        case 'line':
          ctx.fillStyle = p.color
          ctx.fillRect(x, y, 1, 3)
          break
      }
    }
  }

  private drawWeather(ctx: CanvasRenderingContext2D, fx: Fx, w: number, h: number, time: number, cx: number) {
    const kind = this.theme.weather
    const want = kind === 'snow' ? Math.round(w * h / 900) : kind === 'petals' ? Math.round(w * h / 5200) : Math.round(w * h / 4200)
    const r = rng(fx.weather.length * 13 + Math.floor(time * 10))
    while (fx.weather.length < want) {
      fx.weather.push({ x: r() * (w + 40), y: r() * h, vx: kind === 'snow' ? -.2 - r() * .3 : -.3 - r() * .4, vy: kind === 'snow' ? .25 + r() * .45 : kind === 'petals' ? .15 + r() * .25 : -.05 - r() * .1, phase: r() * 6, size: r() < .3 ? 2 : 1 })
    }
    if (fx.weather.length > want) fx.weather.length = want
    for (const p of fx.weather) {
      p.x += p.vx + Math.sin(time * 1.5 + p.phase) * .25
      p.y += p.vy
      const sx = ((p.x - cx * (kind === 'snow' ? .5 : .3)) % (w + 40) + w + 40) % (w + 40) - 20
      if (p.y > h + 4) p.y = -4
      if (p.y < -6) p.y = h + 2
      const x = Math.round(sx), y = Math.round(p.y)
      if (kind === 'snow') {
        ctx.fillStyle = p.size > 1 ? '#ffffff' : '#c8d8f4'
        ctx.fillRect(x, y, p.size, p.size)
      } else if (kind === 'petals') {
        const flip = Math.sin(time * 3 + p.phase) > 0
        ctx.fillStyle = flip ? '#ffc0d4' : '#ff90b0'
        ctx.fillRect(x, y, flip ? 2 : 1, 1)
      } else {
        const tw = Math.sin(time * 3 + p.phase)
        if (tw < .2) continue
        ctx.fillStyle = tw > .8 ? '#fff4c0' : '#ffc890'
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }
}

function drawRotated(ctx: CanvasRenderingContext2D, img: Img, cx: number, cy: number, angle: number) {
  ctx.save()
  ctx.translate(Math.round(cx), Math.round(cy))
  ctx.rotate(angle)
  ctx.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2))
  ctx.restore()
}

// ---------------- じめんの 絵（ステージ ぜんぶを 1まいに） ----------------

function buildLevel(world: World, theme: Theme): Img | null {
  const made = makeCanvas(world.width, LEVEL_H)
  const ground = paintGround(world, theme)
  if (!made || !ground) return null
  const { ctx } = made
  const rows = stageRows(world.stage)
  const r = rng(world.stage.id.length * 97)

  // はいけいの き など（あそびの じゃまに ならない ところだけ）。
  const used = new Set<number>()
  const free = (c0: number, c1: number) => {
    for (let c = c0; c <= c1; c++) {
      if (c < 0 || c >= world.cols || used.has(c)) return false
      if (cellAt(world, c, 8) !== '#') return false
      for (let row = 3; row <= 7; row++) if (rows[row][c] !== '.') return false
    }
    return true
  }
  for (let c = 2; c < world.cols - 3; c++) {
    if (r() > .16) continue
    const img = propSprite(theme, Math.floor(r() * 1000))
    if (!img) continue
    const span = Math.ceil(img.width / TILE)
    if (!free(c, c + span - 1)) continue
    for (let k = c - 1; k <= c + span; k++) used.add(k)
    ctx.drawImage(img, c * TILE + Math.floor((span * TILE - img.width) / 2), GROUND_Y - img.height + 2)
    c += span + 2
  }

  ctx.drawImage(ground, 0, 0)

  // じめんの うえの かざり
  const decos = decoSprites(theme)
  for (let c = 0; c < world.cols; c++) {
    if (cellAt(world, c, 8) !== '#' || rows[7][c] !== '.') continue
    for (let k = 0; k < 2; k++) {
      if (r() > .35 || !decos.length) continue
      const img = decos[Math.floor(r() * decos.length)]
      ctx.drawImage(img, c * TILE + 1 + Math.floor(r() * 12), GROUND_Y - img.height + 1)
    }
  }

  // のれる あしば と いわ
  for (let row = 0; row < ROWS; row++) {
    for (let c = 0; c < world.cols; c++) {
      const cell = world.cells[row][c]
      if (cell === '=') {
        const left = world.cells[row][c - 1] === '=', right = world.cells[row][c + 1] === '='
        const part = left && right ? 'm' : left ? 'r' : right ? 'l' : 's'
        const img = platformTile(theme, part, c * 7 + row)
        if (img) ctx.drawImage(img, c * TILE, row * TILE)
      } else if (cell === 'r') {
        const img = rockTile(theme, c)
        if (img) ctx.drawImage(img, c * TILE, row * TILE)
      }
    }
  }

  // スタートの かんばん
  const sign = spriteCanvas([
    '.oooooooooooo..',
    '.oyyyyyyyyyyoo.',
    '.oyYYYYwYYYYYoo',
    '.oyYwwwwwwYYYYo',
    '.oyYYYYwYYYYYoo',
    '.oYYYYYYYYYYoo.',
    '.oooooooooooo..',
    '.....oyo.......',
    '.....oyo.......',
    '.....oyo.......',
  ], { o: '#3a1a0c', y: '#f0b060', Y: '#c07a3a', w: '#ffffff' })
  if (sign) ctx.drawImage(sign, TILE * 1 + 2, GROUND_Y - sign.height + 1)
  return made.canvas
}

function paintGround(world: World, theme: Theme): Img | null {
  const pix = Pix.create(world.width, LEVEL_H)
  if (!pix) return null
  const top = theme.top.map(c => pack(c))
  const dirt = theme.dirt.map(c => pack(c))
  const outline = pack(theme.outline)
  const pebL = pack(theme.pebble[0]), pebD = pack(theme.pebble[1])
  const pit = [theme.dirt[3], theme.dirt[4], mixHex(theme.dirt[4], '#000000', .45), mixHex(theme.dirt[4], '#000000', .7)].map(c => pack(c))
  const isGround = (c: number, row: number) => cellAt(world, c, row) === '#'
  const kind = theme.topKind
  // それぞれの れつの じめんの いちばん うえ。
  const surface = new Int32Array(world.cols).fill(-1)
  for (let c = 0; c < world.cols; c++) {
    if (!isGround(c, ROWS - 1)) continue
    let row = ROWS - 1
    while (row > 0 && isGround(c, row - 1)) row--
    surface[c] = row * TILE
  }
  const topDepth = (x: number) => (kind === 'snow' ? 5 : kind === 'sand' ? 3 : 4) + (hash2(x, 0, 1) < .4 ? 1 : 0) + (hash2(x >> 1, 0, 2) < .2 ? 1 : 0)
  for (let x = 0; x < world.width; x++) {
    const c = Math.floor(x / TILE)
    const sy = surface[c]
    const gd = topDepth(x)
    const drip = kind === 'snow' ? Math.max(0, Math.round(Math.sin(x * .55 + hash2(c, 1, 3) * 6) * 2 + hash2(x, 5, 3) * 2)) : 0
    for (let y = 0; y < LEVEL_H; y++) {
      const row = Math.floor(y / TILE)
      if (sy < 0 && y >= GROUND_Y + 3) {
        // あな：したへ いくほど くらく なる たてあな。
        const k = (y - GROUND_Y) / 70
        const wall = Math.min(x - c * TILE + (isGround(c - 1, ROWS - 1) ? 0 : 99), (c + 1) * TILE - 1 - x + (isGround(c + 1, ROWS - 1) ? 0 : 99))
        pix.set(x, y, wall < 2 ? pit[3] : pit[Math.min(3, Math.floor(k * 3 + bayer(x, y) * .9))])
        continue
      }
      if (!isGround(c, row)) {
        // じめんの すぐ うえ：くさ・すな・ゆきの でこぼこ。
        if (sy >= 0 && y < sy && sy - y <= 3) {
          const above = sy - y
          if (kind === 'grass') {
            const tuft = hash2(x, 3, 1) < .3 ? 1 + Math.floor(hash2(x, 4, 1) * 3) : 0
            if (above <= tuft) pix.set(x, y, above === tuft ? top[0] : top[1])
          } else if (kind === 'snow') {
            const bump = Math.round(1 + Math.sin(x * .3 + hash2(c, 2, 1) * 5) * 1.2)
            if (above <= bump) pix.set(x, y, above === bump ? top[1] : top[0])
          } else if (hash2(x, 3, 2) < .12 && above === 1) pix.set(x, y, top[1])
        }
        continue
      }
      const dTop = sy >= 0 ? y - sy : 99
      const dl = isGround(c - 1, row) ? 99 : x - c * TILE
      const dr = isGround(c + 1, row) ? 99 : (c + 1) * TILE - 1 - x
      const edge = Math.min(dl, dr)
      if (edge === 0) { pix.set(x, y, outline); continue }
      const topLimit = gd + (edge < 2 ? (kind === 'snow' ? 6 : 3) : 0) + drip
      if (dTop < topLimit) {
        let idx = dTop === 0 ? 0 : dTop === 1 ? 1 : dTop >= topLimit - 1 ? 3 : 2
        if (kind === 'snow') idx = dTop === 0 ? 0 : dTop >= topLimit - 1 ? 3 : dTop >= topLimit - 2 ? 2 : bayer(x, y) < .8 ? 1 : 0
        if (kind === 'sand' && idx === 2 && hash2(x, y, 9) < .12) idx = 1
        if (edge === 1 && idx < 2) idx = 2
        pix.set(x, y, top[idx])
        continue
      }
      const depth = dTop - topLimit
      let idx = Math.min(dirt.length - 1, Math.floor(Math.max(0, depth - 2) / 26 + bayer(x, y) * .9))
      if (depth === 0) idx = Math.min(dirt.length - 1, 3)
      else if (depth === 1) idx = Math.min(dirt.length - 1, 2)
      if (edge < 3) idx = Math.min(dirt.length - 1, idx + 1)
      if (depth > 110) idx = dirt.length - 1
      let color = dirt[idx]
      // こいし
      const bx = x >> 3, by = y >> 3
      if (depth > 3 && hash2(bx, by, 5) < .17) {
        const px = bx * 8 + 1 + Math.floor(hash2(bx, by, 6) * 4), py = by * 8 + 1 + Math.floor(hash2(bx, by, 7) * 4)
        const dx = x - px, dy = y - py
        if (dx >= 0 && dx < 3 && dy >= 0 && dy < 2) color = dy === 0 && dx < 2 ? pebL : pebD
        else if (dx >= 0 && dx < 3 && dy === 2) color = dirt[Math.min(dirt.length - 1, idx + 1)]
      }
      // ちそうの すじ
      if ((y + Math.round(Math.sin(x * .19 + c) * 1.5)) % 17 === 0 && hash2(x >> 2, y, 7) < .55 && depth > 4) color = dirt[Math.min(dirt.length - 1, idx + 1)]
      pix.set(x, y, color)
    }
  }
  return pix.done()
}

/** けっかの まどに だす うさぎ（よろこびの ポーズ）。 */
export function bunnyImage(pose: BunnyPose = 'cheer'): Img | null {
  return spriteCanvas(BUNNY_POSES[pose], BUNNY)
}

export function carrotImage(): Img | null {
  return spriteCanvas(CARROT, CARROT_PAL)
}

export function medalImage(): Img | null {
  return medalFrames()[0] ?? null
}

