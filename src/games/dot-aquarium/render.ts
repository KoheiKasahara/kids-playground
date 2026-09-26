// すいそうを ひくい かいぞうど（W×H ドット）で かいて、せいすうばいで 画面に ひろげる。
// みずの グラデーション・とおくの いわ・すな・ひかりの すじ・すなの ゆらめき（コースティクス）・
// みずめん・あわ・よるの ひかり まで ここで えがく。

import { DECOR, SPECIES, decorDef, speciesDef, type DecorKind, type FoodKind, type SpeciesId } from './data'
import { bake, fade, flipX } from './model'
import { ANEMONE_FRAMES, CASTLE_WINDOWS, P, anemone, chest, clam, decorModel, foodModel } from './props'
import { FRAMES, creatureModel, crabModel, pufferPuffed, type Model } from './sprites'
import { bayer, canvasFromPixels, fbm, hash2, hex, makeCanvas, mix, rgbCss, rng, valueNoise, type Rgb } from './pixel'
import { SAND, SURFACE, bodySize, daylight, floorY, sandTop, type Creature, type Decor, type World } from './sim'

export type Ghost =
  | { kind: 'creature'; species: SpeciesId }
  | { kind: 'decor'; decor: DecorKind }
  | { kind: 'food'; food: FoodKind }
  | { kind: 'wipe' }
  | { kind: 'remove' }

export type Hover = { x: number; y: number; ok: boolean; ghost: Ghost }

export type View = { time: number; still: boolean }

type Sprite = { canvas: HTMLCanvasElement; flip: HTMLCanvasElement; w: number; h: number }

type Particle = {
  kind: 'bubble' | 'heart' | 'note' | 'spark' | 'crumb' | 'ring' | 'z' | 'splash' | 'ink'
  x: number; y: number; vx: number; vy: number
  life: number; max: number
  size: number
  color?: string
  wob: number
}

/** とおさ（おくゆき）の だんかい。 */
const FADES = [.34, .17, 0] as const
function fadeLevel(z: number) {
  return z < .33 ? 0 : z < .66 ? 1 : 2
}

const WATER_DAY = ['#6ad2f0', '#44b2e4', '#2a92d0', '#1e74b8', '#16589c', '#104280', '#0c3068'].map(hex)
const FAR_ROCK: Rgb = hex('#0e3e70')
const FAR_ROCK_LIT: Rgb = hex('#1c5a90')
const SAND_RAMP = ['#6a5238', '#9a7c54', '#c4a26e', '#e0c48c', '#f6e0b0'].map(hex)
const WATER_FAR = '#1e6aa8'

function spriteFromModel(m: Model, fadeT: number, water = WATER_FAR): Sprite | null {
  let px = bake(m.prims, m.w, m.h)
  if (fadeT > 0) px = fade(px, water, fadeT)
  const canvas = canvasFromPixels(m.w, m.h, px)
  const flip = canvasFromPixels(m.w, m.h, flipX(px, m.w, m.h))
  if (!canvas || !flip) return null
  return { canvas, flip, w: m.w, h: m.h }
}

/** もじの ドット絵（'.' は とうめい）。 */
function stringSprite(rows: readonly string[], pal: Record<string, string>) {
  const h = rows.length, w = rows[0].length
  const made = makeCanvas(w, h)
  if (!made) return null
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = rows[y][x]
    if (c === '.' || !pal[c]) continue
    made.ctx.fillStyle = pal[c]
    made.ctx.fillRect(x, y, 1, 1)
  }
  return made.canvas
}

const HEART = ['.oo.oo.', 'ohwoRRo', 'oRRRRRo', '.oRRRo.', '..oRo..', '...o...']
const NOTE = ['..ooo', '..oyo', '..o.o', '..o..', 'ooo..', 'oyo..', 'ooo..']
const SPARK = ['..w..', '..c..', 'wcWcw', '..c..', '..w..']
const ZZZ = ['oooo', '..o.', '.o..', 'oooo']

function bubbleSprite(r: number) {
  const s = Math.ceil(r * 2 + 2)
  const made = makeCanvas(s, s)
  if (!made) return null
  const c = s / 2
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const d = Math.hypot(x + .5 - c, y + .5 - c)
    if (Math.abs(d - r) < .62) { made.ctx.fillStyle = y + .5 < c + .3 ? 'rgb(214 248 255 / .9)' : 'rgb(150 220 250 / .75)'; made.ctx.fillRect(x, y, 1, 1) }
    else if (d < r) { made.ctx.fillStyle = 'rgb(160 230 255 / .18)'; made.ctx.fillRect(x, y, 1, 1) }
  }
  made.ctx.fillStyle = '#ffffff'
  made.ctx.fillRect(Math.floor(c - r * .45), Math.floor(c - r * .45), 1, 1)
  return made.canvas
}

export class AquaRenderer {
  private sprites = new Map<string, Sprite | null>()
  private buf: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null
  private bg: HTMLCanvasElement | null = null
  private caustics: HTMLCanvasElement[] = []
  private rays: HTMLCanvasElement[] = []
  private glow: HTMLCanvasElement | null = null
  private mossSprites = new Map<number, HTMLCanvasElement | null>()
  private bubbles: (HTMLCanvasElement | null)[] = []
  private icons: Record<string, HTMLCanvasElement | null> = {}
  private particles: Particle[] = []
  private motes: { x: number; y: number; z: number; ph: number }[] = []
  private size = { W: 0, H: 0 }
  private emit = new Map<number, number>()
  private rand = rng(99)

  // ---------------- よういする ----------------

  private sprite(key: string, make: () => Model, fadeT: number) {
    let s = this.sprites.get(key)
    if (s === undefined) {
      s = spriteFromModel(make(), fadeT)
      this.sprites.set(key, s)
    }
    return s
  }

  creatureSprite(id: SpeciesId, frame: number, level: number, variant = '') {
    const key = `c:${id}:${frame}:${level}:${variant}`
    return this.sprite(key, () => (variant === 'puff' ? pufferPuffed(frame) : variant === 'wave' ? crabModel(frame, true) : creatureModel(id, frame)), FADES[level])
  }

  decorSprite(d: { kind: DecorKind; seed: number; open?: number; pearl?: boolean }, level: number, frame = 0) {
    const open = d.kind === 'clam' ? Math.round((d.open ?? 0) * 2) : d.kind === 'chest' ? ((d.open ?? 0) > .3 ? 1 : 0) : 0
    const pearl = d.kind === 'clam' && open > 0 && !!d.pearl
    const key = `d:${d.kind}:${d.kind === 'clam' || d.kind === 'chest' || d.kind === 'bubbler' ? 0 : d.seed}:${level}:${open}:${pearl ? 1 : 0}:${frame}`
    return this.sprite(key, () => {
      if (d.kind === 'clam') return clam(open, pearl)
      if (d.kind === 'chest') return chest(open === 1)
      if (d.kind === 'anemone') return anemone(d.seed, frame)
      return decorModel(d.kind, d.seed)
    }, FADES[level])
  }

  private foodSprite(kind: FoodKind, level: number) {
    return this.sprite(`f:${kind}:${level}`, () => foodModel(kind), FADES[level])
  }

  /** トレイに だす アイコン（dataURL）。 */
  iconUrl(kind: 'creature' | 'decor' | 'food', id: string): string | null {
    const key = `${kind}:${id}`
    if (!(key in this.icons)) {
      let s: Sprite | null
      if (kind === 'creature') s = this.creatureSprite(id as SpeciesId, 0, 2)
      else if (kind === 'decor') s = this.decorSprite({ kind: id as DecorKind, seed: 11, open: id === 'clam' ? 1 : 0, pearl: true }, 2)
      else s = this.foodSprite(id as FoodKind, 2)
      let canvas: HTMLCanvasElement | null = null
      if (s) {
        const k = kind === 'food' ? 4 : 2
        const made = makeCanvas(s.w * k, s.h * k)
        if (made) { made.ctx.drawImage(s.canvas, 0, 0, s.w * k, s.h * k); canvas = made.canvas }
      }
      this.icons[key] = canvas
    }
    const c = this.icons[key]
    try { return c ? c.toDataURL() : null } catch { return null }
  }

  private setSize(W: number, H: number) {
    if (this.size.W === W && this.size.H === H && this.buf) return
    this.size = { W, H }
    this.buf = makeCanvas(W, H)
    this.bg = this.bakeBackground(W, H)
    this.caustics = this.bakeCaustics(W, H)
    this.rays = [0, 1, 2].map(i => this.bakeRay(H, i)).filter((c): c is HTMLCanvasElement => !!c)
    if (!this.glow) this.glow = this.bakeGlow()
    if (!this.bubbles.length) this.bubbles = [bubbleSprite(.6), bubbleSprite(1.1), bubbleSprite(1.7), bubbleSprite(2.4)]
    const r = this.rand
    this.motes = Array.from({ length: Math.round(W * H / 1800) }, () => ({ x: r() * W, y: SURFACE + r() * (H - SURFACE - 20), z: r(), ph: r() * 10 }))
  }

  private bakeBackground(W: number, H: number) {
    const px = new Uint32Array(W * H)
    const top = sandTop({ H } as World)
    const put = (x: number, y: number, c: Rgb) => { px[y * W + x] = (255 << 24 | (c[2] | 0) << 16 | (c[1] | 0) << 8 | (c[0] | 0)) >>> 0 }
    for (let x = 0; x < W; x++) {
      // とおくの いわやま と すなの ふち。
      const far = top - 14 - fbm(x * .018, 3.3, 5, 3) * 46
      const far2 = top - 4 - fbm(x * .03, 8.1, 9, 3) * 22
      const sandY = top + 1 + Math.sin(x * .045) * 1.5 + (fbm(x * .05, 1, 3, 2) - .5) * 4
      for (let y = 0; y < H; y++) {
        const t = Math.max(0, (y - SURFACE) / (H - SURFACE))
        const n = WATER_DAY.length
        const v = t * (n - 1) + (bayer(x, y) - .5) * .9
        const i = Math.max(0, Math.min(n - 1, Math.round(v)))
        let c = WATER_DAY[i]
        if (y >= sandY) {
          // すな: さざなみ・こいし・おくは みずに とける。
          const d = (y - sandY) / (H - sandY)
          const rip = Math.sin((x + fbm(x * .04, y * .12, 7, 2) * 30) * .32 + y * .9)
          let b = .5 + d * .25 + rip * .16 + (fbm(x * .12, y * .2, 4, 2) - .5) * .35
          if (y - sandY < 1.5) b += .25
          const h = hash2(x, y, 44)
          if (h < .025) b -= .35
          else if (h > .985) b += .3
          const si = Math.max(0, Math.min(4, Math.floor(b * 5 + (bayer(x, y) - .5) * .7)))
          c = mix(SAND_RAMP[si], WATER_DAY[5], Math.max(0, .5 - d * 1.1))
        } else if (y >= far2) {
          const edge = y - far2 < 1.2
          c = mix(edge ? FAR_ROCK_LIT : mix(FAR_ROCK, WATER_DAY[4], .35), c, .25 + (bayer(x, y) < .5 ? .05 : 0))
        } else if (y >= far) {
          const edge = y - far < 1.2
          c = mix(edge ? FAR_ROCK_LIT : FAR_ROCK, c, .55 + (bayer(x, y) < .5 ? .05 : 0))
        }
        put(x, y, c)
      }
    }
    // とおくの かいそうの かげ。
    const r = rng(W * 7 + H)
    for (let k = 0; k < Math.round(W / 50); k++) {
      const bx = r() * W, len = 30 + r() * 50, base = top - 2
      for (let i = 0; i < len; i++) {
        const y = Math.floor(base - i)
        const x = Math.floor(bx + Math.sin(i * .1 + k) * i * .08)
        for (let dx = -1; dx <= 0; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= W || y < SURFACE) continue
          const o = px[y * W + xx]
          const cur: Rgb = [o & 255, (o >>> 8) & 255, (o >>> 16) & 255]
          put(xx, y, mix(cur, FAR_ROCK, .35))
        }
      }
    }
    return canvasFromPixels(W, H, px)
  }

  private bakeCaustics(W: number, H: number) {
    const frames: HTMLCanvasElement[] = []
    const top = sandTop({ H } as World) - 2
    const h = H - top
    const F = 12
    for (let f = 0; f < F; f++) {
      const a = f / F * Math.PI * 2
      const px = new Uint32Array(W * h)
      for (let y = 0; y < h; y++) {
        const depth = y / h
        for (let x = 0; x < W; x++) {
          const u = x * .07, v = (y + top) * .16
          const n1 = valueNoise(u + Math.cos(a) * 1.3, v + Math.sin(a) * 1.3, 3)
          const n2 = valueNoise(u * 1.2 - Math.sin(a) * 1.1 + 5, v * 1.1 + Math.cos(a) * 1.1, 8)
          const line = 1 - Math.abs(n1 - n2) * 7
          if (line > .45 && bayer(x, y) < (line - .45) * 2.2 * (.55 + depth * .45)) px[y * W + x] = (Math.round(150 + line * 90) << 24 | 0xf0fcff & 0xffffff) >>> 0
        }
      }
      const c = canvasFromPixels(W, h, px)
      if (c) frames.push(c)
    }
    return frames
  }

  private bakeRay(H: number, i: number) {
    const w = 26 + i * 8, h = H
    const px = new Uint32Array(w * h)
    for (let y = 0; y < h; y++) {
      const t = y / h
      const half = (w / 2) * (.35 + t * .65)
      const cx = w / 2 + (t - .5) * w * .3
      for (let x = 0; x < w; x++) {
        const k = 1 - Math.abs(x + .5 - cx) / half
        if (k <= 0) continue
        const inten = k * (1 - t * .85)
        if (bayer(x, y) < inten * .7) px[y * w + x] = 0xffffffff
      }
    }
    return canvasFromPixels(w, h, px)
  }

  private bakeGlow() {
    const s = 32
    const px = new Uint32Array(s * s)
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const d = Math.hypot(x + .5 - s / 2, y + .5 - s / 2) / (s / 2)
      if (d < 1 && bayer(x, y) < (1 - d) * .8) px[y * s + x] = 0xffffffff
    }
    return canvasFromPixels(s, s, px)
  }

  private mossSprite(seed: number, r: number) {
    const key = seed * 100 + Math.round(r)
    let m = this.mossSprites.get(key)
    if (m === undefined) {
      const s = Math.ceil(r * 2 + 2)
      const px = new Uint32Array(s * s)
      const ramp = P.moss.map(hex)
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const dx = x + .5 - s / 2, dy = y + .5 - s / 2
        const n = fbm(x * .3, y * .3, seed, 2)
        const d = Math.hypot(dx, dy) / r - (n - .5) * .7
        if (d > 1) continue
        if (d > .75 && bayer(x, y) > (1 - d) * 3) continue
        const li = Math.max(0, Math.min(4, Math.floor(n * 4.5 + (bayer(x, y) - .5) * .8)))
        const c = ramp[li]
        px[y * s + x] = ((200 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0
      }
      m = canvasFromPixels(s, s, px)
      this.mossSprites.set(key, m)
    }
    return m
  }

  // ---------------- こうか ----------------

  burst(kind: Particle['kind'], x: number, y: number, n = 1, color?: string) {
    const r = this.rand
    for (let i = 0; i < n; i++) {
      const p: Particle = { kind, x, y, vx: 0, vy: 0, life: 0, max: 1, size: 0, color, wob: r() * 6 }
      if (kind === 'bubble') { p.size = Math.floor(r() * 3); p.vy = -(12 + r() * 10); p.x += (r() - .5) * 4; p.max = 20 }
      else if (kind === 'heart' || kind === 'note') { p.vy = -10 - r() * 4; p.vx = (r() - .5) * 8; p.max = 1.3; p.x += (r() - .5) * 8 }
      else if (kind === 'spark') { p.vx = (r() - .5) * 30; p.vy = (r() - .5) * 30; p.max = .6 + r() * .3 }
      else if (kind === 'crumb') { p.vx = (r() - .5) * 20; p.vy = (r() - .5) * 14; p.max = .5 + r() * .3 }
      else if (kind === 'ring' || kind === 'splash') { p.max = .6; p.size = n }
      else if (kind === 'z') { p.vy = -5; p.vx = 3; p.max = 2 }
      else if (kind === 'ink') { p.vx = (r() - .5) * 16; p.vy = (r() - .5) * 10; p.max = 1.4 + r() * .6; p.size = 2 + r() * 2 }
      this.particles.push(p)
      if (kind === 'ring' || kind === 'splash') break
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400)
  }

  // ---------------- かく ----------------

  draw(ctx: CanvasRenderingContext2D, world: World, view: View, hover: Hover | null, dt: number, scale: number) {
    this.setSize(world.W, world.H)
    const b = this.buf
    if (!b || !this.bg) return
    const g = b.ctx
    const { W, H } = world
    const t = view.time
    const light = daylight(world.clock)
    this.spawn(world, dt, view)

    g.globalCompositeOperation = 'source-over'
    g.globalAlpha = 1
    g.drawImage(this.bg, 0, 0)

    // ひかりの すじ（ひるだけ）。
    {
      g.globalCompositeOperation = 'lighter'
      const n = Math.max(3, Math.round(W / 110))
      for (let i = 0; i < n; i++) {
        const ray = this.rays[i % this.rays.length]
        if (!ray) continue
        const x = (i + .5) / n * W + Math.sin(t * .23 + i * 1.7) * 10 - ray.width / 2
        g.globalAlpha = (.05 + .035 * Math.sin(t * .6 + i * 2.1)) * light
        g.drawImage(ray, Math.round(x), SURFACE)
      }
      // すなの ゆらめき。
      const cf = this.caustics.length ? this.caustics[Math.floor((view.still ? 0 : t * 8) % this.caustics.length)] : null
      if (cf) { g.globalAlpha = .38 * light + .05; g.drawImage(cf, 0, sandTop(world) - 2) }
      g.globalAlpha = 1
      g.globalCompositeOperation = 'source-over'
    }

    // ただよう ちいさな つぶ（おく）。
    this.drawMotes(g, world, t, false)

    // かげ。
    for (const c of world.creatures) {
      if (c.species === 'eel' || c.species === 'crab') continue
      const fy = floorY(world, c.z)
      const k = Math.max(0, 1 - (fy - c.y) / 110)
      if (k <= .05) continue
      const { w } = bodySize(c)
      g.fillStyle = `rgb(6 20 40 / ${(.28 * k).toFixed(3)})`
      const sw = Math.max(4, Math.round(w * .55 * (.6 + k * .4)))
      g.fillRect(Math.round(c.x - sw / 2), Math.round(fy), sw, 1)
      g.fillRect(Math.round(c.x - sw / 2 + 2), Math.round(fy + 1), Math.max(1, sw - 4), 1)
    }

    // おくゆき じゅんに ならべて かく。
    type Item = { z: number; y: number; draw: () => void }
    const items: Item[] = []
    for (const d of world.decor) items.push({ z: d.z, y: floorY(world, d.z), draw: () => this.drawDecor(g, world, d, t, view) })
    for (const c of world.creatures) items.push({ z: c.z + (c.species === 'crab' || c.species === 'eel' ? .001 : 0), y: c.y, draw: () => this.drawCreature(g, world, c, t) })
    for (const f of world.foods) {
      if (f.age < 0) continue
      items.push({
        z: f.z, y: f.y, draw: () => {
          const s = this.foodSprite(f.kind, fadeLevel(f.z))
          if (!s) return
          const wob = f.settled ? 0 : Math.round(Math.sin(f.age * 3 + f.wob) * .6)
          g.globalAlpha = f.settled && f.age > 24 ? Math.max(0, 1 - (f.age - 24) / 6) : 1
          g.drawImage(s.canvas, Math.round(f.x - s.w / 2) + wob, Math.round(f.y - s.h / 2))
          g.globalAlpha = 1
        },
      })
    }
    items.sort((a, b2) => a.z - b2.z || a.y - b2.y)
    for (const it of items) it.draw()

    this.drawParticles(g, dt)
    this.drawMotes(g, world, t, true)
    this.drawSurface(g, world, t)

    // ガラスの コケ。
    for (const m of world.moss) {
      const s = this.mossSprite(m.seed, m.r)
      if (!s) continue
      g.globalAlpha = Math.min(1, m.a * 1.1)
      g.drawImage(s, Math.round(m.x - s.width / 2), Math.round(m.y - s.height / 2))
    }
    g.globalAlpha = 1

    // よる・ゆうがた。
    const dark = 1 - light
    const phase = world.clock
    const warm = phase > .6 && phase < .72 ? 1 - Math.abs(phase - .66) / .06 : phase < .07 ? 1 - phase / .07 : 0
    if (dark > .01 || warm > .01) {
      g.globalCompositeOperation = 'multiply'
      const night: Rgb = mix([255, 255, 255], hex('#34489a'), Math.min(1, dark / .8))
      const tint = warm > 0 ? mix(night, mix(night, hex('#ffb088'), .5), Math.max(0, warm)) : night
      g.fillStyle = rgbCss(tint)
      g.fillRect(0, 0, W, H)
      g.globalCompositeOperation = 'source-over'
    }
    if (dark > .3) this.drawNightLights(g, world, t, (dark - .3) / .5)

    // まえの ガラスの はんしゃ。
    g.fillStyle = 'rgb(255 255 255 / .06)'
    for (let i = 0; i < 3; i++) {
      const x0 = W * .08 + i * 7
      for (let y = SURFACE + 4; y < H * .7; y += 1) {
        const x = Math.round(x0 + (y - SURFACE) * .45)
        if (bayer(x, y) < .5) g.fillRect(x, y, i === 1 ? 2 : 1, 1)
      }
    }

    if (hover) this.drawHover(g, world, hover, t)

    ctx.imageSmoothingEnabled = false
    ctx.drawImage(b.canvas, 0, 0, W * scale, H * scale)
  }

  private drawMotes(g: CanvasRenderingContext2D, world: World, t: number, front: boolean) {
    const light = daylight(world.clock)
    for (const m of this.motes) {
      if ((m.z > .7) !== front) continue
      const x = ((m.x + t * (2 + m.z * 3)) % world.W + world.W) % world.W
      const y = m.y + Math.sin(t * .5 + m.ph) * 4
      const tw = (Math.sin(t * 2 + m.ph * 3) + 1) / 2
      g.fillStyle = light > .5 ? `rgb(210 245 255 / ${(.15 + tw * .25 * m.z).toFixed(3)})` : `rgb(120 255 230 / ${(.2 + tw * .5).toFixed(3)})`
      g.fillRect(Math.round(x), Math.round(y), 1, 1)
    }
  }

  private drawSurface(g: CanvasRenderingContext2D, world: World, t: number) {
    const { W } = world
    // ふた。
    g.fillStyle = '#141824'
    g.fillRect(0, 0, W, 3)
    g.fillStyle = '#3a4258'
    g.fillRect(0, 2, W, 1)
    // みずの うえの くうき（ランプの ひかり）。
    for (let x = 0; x < W; x++) {
      const ys = SURFACE - 3 + Math.sin(x * .09 + t * 1.6) * 1.1 + Math.sin(x * .031 - t * 1.1) * .9
      const top = Math.round(ys)
      g.fillStyle = '#b8e8f6'
      g.fillRect(x, 3, 1, Math.max(0, top - 3))
      g.fillStyle = bayer(x, 3) < .5 ? '#d8f6ff' : '#b8e8f6'
      g.fillRect(x, 3, 1, 1)
      g.fillStyle = '#ffffff'
      g.fillRect(x, top, 1, 1)
      g.fillStyle = '#8ad8f4'
      g.fillRect(x, top + 1, 1, 1)
      // みずめんの うらがわの きらきら。
      const sp = Math.sin(x * .27 + t * 2.3) + Math.sin(x * .11 - t * 1.3)
      if (sp > 1.2) { g.fillStyle = 'rgb(220 250 255 / .8)'; g.fillRect(x, top + 3, 1, 1) }
      else if (sp > .6) { g.fillStyle = 'rgb(200 240 255 / .35)'; g.fillRect(x, top + 2, 1, 1) }
    }
  }

  private drawDecor(g: CanvasRenderingContext2D, world: World, d: Decor, t: number, view: View) {
    const level = fadeLevel(d.z)
    const base = floorY(world, d.z)
    if (d.kind === 'kelp') { this.drawKelp(g, d, base, t, level, view.still); return }
    const frame = d.kind === 'anemone' ? (view.still ? 0 : Math.floor(t * 4 + d.seed) % ANEMONE_FRAMES) : 0
    const s = this.decorSprite(d, level, frame)
    if (!s) return
    const flip = d.seed % 2 === 1 && (d.kind === 'wood' || d.kind === 'rock' || d.kind === 'coral')
    const x = Math.round(d.x - s.w / 2), y = Math.round(base - s.h + 2)
    g.drawImage(flip ? s.flip : s.canvas, x, y)
    // すなに すこし うまる。
    g.fillStyle = rgbCss(mix(SAND_RAMP[2], WATER_DAY[5], .25 * (1 - d.z)))
    for (let i = 0; i < s.w - 4; i += 1) if (bayer(x + i, y + s.h - 1) < .5) g.fillRect(x + 2 + i, y + s.h - 1, 1, 1)
    if (d.kind === 'clam' && d.pearl && d.open > .5 && Math.floor(t * 3) % 3 === 0) {
      g.fillStyle = '#ffffff'
      g.fillRect(Math.round(d.x - 1), Math.round(base - 9 - d.open * 2), 1, 1)
    }
  }

  private drawKelp(g: CanvasRenderingContext2D, d: Decor, base: number, t: number, level: number, still: boolean) {
    const r = rng(d.seed)
    const ramp = P.moss.map(c => rgbCss(mix(hex(c), hex(WATER_FAR), FADES[level])))
    const blades = 3
    for (let b = 0; b < blades; b++) {
      const bx = d.x - 4 + b * 4 + (r() - .5) * 2
      const len = 44 + r() * 26
      const ph = r() * 6
      const segs = Math.floor(len / 2)
      for (let i = 0; i < segs; i++) {
        const k = i / segs
        const sway = still ? Math.sin(i * .15 + ph) * k * 3 : Math.sin(t * 1.1 + i * .12 + ph) * k * 5 + Math.sin(t * .5 + ph) * k * 3
        const x = Math.round(bx + sway)
        const y = Math.round(base - i * 2)
        const leaf = (i + b * 3) % 6 < 3 ? 1 : 0
        const wdt = 2 + leaf
        g.fillStyle = ramp[1]
        g.fillRect(x - 1, y - 1, wdt + 1, 3)
        g.fillStyle = ramp[b === 1 ? 3 : 2]
        g.fillRect(x, y - 1, wdt - 1, 2)
        if (leaf && i % 2 === 0) { g.fillStyle = ramp[4]; g.fillRect(x, y - 1, 1, 1) }
      }
    }
  }

  private drawCreature(g: CanvasRenderingContext2D, world: World, c: Creature, t: number) {
    const level = fadeLevel(c.z)
    const speed = c.species === 'neon' ? 10 : c.species === 'shark' ? 3.2 : c.species === 'turtle' ? 2.4 : c.species === 'seahorse' ? 3 : c.species === 'eel' ? 1.5 : c.species === 'octopus' || c.species === 'moray' || c.species === 'ray' ? 3 : 6.5
    let frame = Math.floor(c.phase * speed) % FRAMES
    let variant = ''
    if (c.species === 'jelly') frame = Math.floor(((c.phase % 2.6) / 2.6) * FRAMES) % FRAMES
    if (c.species === 'crab') {
      if (c.state === 'wave') { variant = 'wave'; frame = Math.floor(c.phase * 6) % 2 }
      else if (Math.abs(c.vx) < 1) frame = 0
      else frame = Math.floor(c.phase * 9) % FRAMES
    }
    if (c.species === 'puffer' && c.puff > .45) variant = 'puff'
    if (c.sleep && c.species !== 'eel') frame = Math.floor(c.phase * 1.5) % FRAMES
    const s = this.creatureSprite(c.species, frame, level, variant)
    if (!s) return

    if (c.species === 'eel') {
      const base = floorY(world, c.z)
      const vis = Math.max(0, Math.round(c.emerge * (s.h - 5)))
      // あな。
      g.fillStyle = '#3a2c1c'
      g.fillRect(Math.round(c.homeX - 2), Math.round(base) - 1, 5, 2)
      g.fillStyle = '#e8cc98'
      g.fillRect(Math.round(c.homeX - 3), Math.round(base) + 1, 7, 1)
      if (vis > 0) g.drawImage(s.canvas, 0, 0, s.w, vis, Math.round(c.homeX - 5), Math.round(base) - vis, s.w, vis)
      return
    }

    const facing = c.species === 'crab' ? 1 : c.turn < .5 ? -c.face : c.face
    const img = facing > 0 ? s.canvas : s.flip
    const squash = c.species === 'crab' ? 1 : Math.max(.2, Math.abs(1 - c.turn * 2))
    const w = Math.max(2, Math.round(s.w * squash))
    const bob = c.species === 'seahorse' ? Math.round(Math.sin(c.phase * 1.4) * 1.2) : 0
    const x = Math.round(c.x - w / 2), y = Math.round(c.y - s.h / 2) + bob
    g.drawImage(img, x, y, w, s.h)
    if (c.sleep && Math.floor(t * 2 + c.id) % 12 === 0 && this.rand() < .05) this.burst('z', c.x + c.face * 4, c.y - s.h / 2)
  }

  private drawNightLights(g: CanvasRenderingContext2D, world: World, t: number, k: number) {
    const glow = this.glow
    g.globalCompositeOperation = 'lighter'
    for (const c of world.creatures) {
      if (c.species !== 'jelly' || !glow) continue
      const p = .6 + Math.sin(c.phase * 2.4) * .25
      g.globalAlpha = .32 * k * p
      g.drawImage(glow, Math.round(c.x - 16), Math.round(c.y - 18))
      g.globalAlpha = .35 * k * p
      const s = this.creatureSprite('jelly', Math.floor(((c.phase % 2.6) / 2.6) * FRAMES) % FRAMES, fadeLevel(c.z))
      if (s) g.drawImage(c.face > 0 ? s.canvas : s.flip, Math.round(c.x - s.w / 2), Math.round(c.y - s.h / 2))
    }
    for (const d of world.decor) {
      const base = floorY(world, d.z)
      if (d.kind === 'castle') {
        const def = decorDef('castle')
        const flick = .8 + Math.sin(t * 7 + d.seed) * .1
        g.globalAlpha = k * flick
        g.fillStyle = '#ffc850'
        for (const [x, y, w, h] of CASTLE_WINDOWS) g.fillRect(Math.round(d.x - 22 + x), Math.round(base - def.h + y), w, h)
        if (glow) { g.globalAlpha = .12 * k; g.drawImage(glow, Math.round(d.x - 16), Math.round(base - 34)) }
      } else if (d.kind === 'chest' && d.open > .3 && glow) {
        g.globalAlpha = .35 * k
        g.drawImage(glow, Math.round(d.x - 16), Math.round(base - 24))
      } else if (d.kind === 'clam' && d.open > .4 && glow) {
        g.globalAlpha = .25 * k
        g.drawImage(glow, Math.round(d.x - 16), Math.round(base - 20))
      } else if (d.kind === 'anemone' && glow) {
        g.globalAlpha = .08 * k
        g.drawImage(glow, Math.round(d.x - 16), Math.round(base - 26))
      }
    }
    // つきの ひかり。
    const ray = this.rays[2]
    if (ray) {
      g.globalAlpha = .05 * k
      g.drawImage(ray, Math.round(world.W * .7), SURFACE)
    }
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-over'
  }

  private drawParticles(g: CanvasRenderingContext2D, dt: number) {
    const keep: Particle[] = []
    for (const p of this.particles) {
      p.life += dt
      if (p.life >= p.max) continue
      p.x += p.vx * dt
      p.y += p.vy * dt
      const k = p.life / p.max
      if (p.kind === 'bubble') {
        p.x += Math.sin(p.life * 5 + p.wob) * dt * 6
        if (p.y <= SURFACE + 1) {
          if (p.size >= 1) this.burst('splash', p.x, SURFACE - 1, 1)
          continue
        }
        const s = this.bubbles[p.size]
        if (s) g.drawImage(s, Math.round(p.x - s.width / 2), Math.round(p.y - s.height / 2))
      } else if (p.kind === 'heart' || p.kind === 'note' || p.kind === 'z') {
        const spr = p.kind === 'heart' ? this.heartSprite() : p.kind === 'note' ? this.noteSprite() : this.zSprite()
        if (spr && (k < .75 || Math.floor(p.life * 20) % 2 === 0)) g.drawImage(spr, Math.round(p.x + Math.sin(p.life * 4 + p.wob) * 2 - spr.width / 2), Math.round(p.y - spr.height / 2))
      } else if (p.kind === 'spark') {
        const spr = this.sparkSprite()
        p.vx *= 1 - dt * 3; p.vy *= 1 - dt * 3
        if (spr && Math.floor(p.life * 16) % 3 !== 0) g.drawImage(spr, Math.round(p.x - 2), Math.round(p.y - 2))
      } else if (p.kind === 'crumb') {
        g.fillStyle = p.color ?? '#f0a040'
        g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1)
      } else if (p.kind === 'ink') {
        // もやもや ひろがって うすく なる すみ。
        p.vx *= 1 - dt * 2; p.vy *= 1 - dt * 2
        const r = p.size + k * 4
        g.fillStyle = `rgb(20 14 30 / ${((1 - k) * .75).toFixed(3)})`
        for (let y = -Math.ceil(r); y <= r; y++) for (let x = -Math.ceil(r); x <= r; x++) {
          if (x * x + y * y > r * r || (k > .5 && ((x + y + Math.floor(p.wob)) & 1))) continue
          g.fillRect(Math.round(p.x + x), Math.round(p.y + y), 1, 1)
        }
      } else if (p.kind === 'ring' || p.kind === 'splash') {
        const r = (p.kind === 'splash' ? 2 : 3) + k * (p.kind === 'splash' ? 4 : 14)
        g.fillStyle = `rgb(230 250 255 / ${((1 - k) * .8).toFixed(3)})`
        const n = Math.max(8, Math.round(r * 4))
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2
          if (p.kind === 'splash' && Math.sin(a) > 0) continue
          g.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y + Math.sin(a) * r * (p.kind === 'splash' ? .6 : .5)), 1, 1)
        }
      }
      keep.push(p)
    }
    this.particles = keep
  }

  private cache: Record<string, HTMLCanvasElement | null> = {}
  private heartSprite() { return this.cache.heart !== undefined ? this.cache.heart : (this.cache.heart = stringSprite(HEART, { o: '#6a0a2a', R: '#ff5a8a', h: '#ffd0e0', w: '#ffffff' })) }
  private noteSprite() { return this.cache.note !== undefined ? this.cache.note : (this.cache.note = stringSprite(NOTE, { o: '#1a1440', y: '#ffe060' })) }
  private sparkSprite() { return this.cache.spark !== undefined ? this.cache.spark : (this.cache.spark = stringSprite(SPARK, { w: '#ffffff', c: '#bff4ff', W: '#ffffff' })) }
  private zSprite() { return this.cache.z !== undefined ? this.cache.z : (this.cache.z = stringSprite(ZZZ, { o: '#e0e8ff' })) }

  /** あわを だす。 */
  private spawn(world: World, dt: number, view: View) {
    if (view.still) return
    const r = this.rand
    for (const d of world.decor) {
      const base = floorY(world, d.z)
      if (d.kind === 'bubbler') {
        const acc = (this.emit.get(d.id) ?? 0) + dt * 7
        let n = Math.floor(acc)
        this.emit.set(d.id, acc - n)
        while (n-- > 0) this.burst('bubble', d.x + (r() - .5) * 3, base - 5)
      } else if (d.kind === 'chest' && d.open > .6 && r() < dt * 10) this.burst('bubble', d.x + (r() - .5) * 10, base - 12)
      else if (d.kind === 'castle' && r() < dt * .4) this.burst('bubble', d.x, base - 45)
    }
    for (const c of world.creatures) {
      if (c.species === 'eel' || c.species === 'crab') continue
      if (r() < dt / 9) this.burst('bubble', c.x + c.face * bodySize(c).w * .45, c.y - 2)
    }
    if (r() < dt * .6) this.burst('bubble', r() * world.W, sandTop(world) + 4)
  }

  private drawHover(g: CanvasRenderingContext2D, world: World, h: Hover, t: number) {
    const color = h.ok ? '255 255 255' : '255 80 100'
    const blink = .45 + Math.sin(t * 8) * .15
    if (h.ghost.kind === 'decor') {
      const def = decorDef(h.ghost.decor)
      const z = Math.max(0, Math.min(1, (h.y - sandTop(world) - 4) / (SAND - 10)))
      const base = floorY(world, h.y < sandTop(world) + 2 ? .5 : z)
      const s = this.decorSprite({ kind: h.ghost.decor, seed: 11 }, 2)
      const x = Math.round(Math.max(def.w / 2, Math.min(world.W - def.w / 2, h.x)) - (s?.w ?? def.w) / 2)
      if (s) { g.globalAlpha = blink; g.drawImage(s.canvas, x, Math.round(base - s.h + 2)); g.globalAlpha = 1 }
      g.fillStyle = `rgb(${color} / .8)`
      g.fillRect(x, Math.round(base) + 2, s?.w ?? def.w, 1)
    } else if (h.ghost.kind === 'creature') {
      const def = speciesDef(h.ghost.species)
      const s = this.creatureSprite(h.ghost.species, 0, 2)
      if (s) { g.globalAlpha = blink; g.drawImage(s.canvas, Math.round(h.x - s.w / 2), Math.round(h.y - s.h / 2)); g.globalAlpha = 1 }
      g.strokeStyle = `rgb(${color} / .7)`
      g.lineWidth = 1
      g.strokeRect(Math.round(h.x - def.w / 2 - 3) + .5, Math.round(h.y - def.h / 2 - 3) + .5, def.w + 6, def.h + 6)
    } else if (h.ghost.kind === 'food') {
      g.fillStyle = `rgb(${color} / .9)`
      const x = Math.round(h.x)
      for (let i = 0; i < 4; i++) g.fillRect(x - i, SURFACE + 2 + 4 - i, 1 + i * 2, 1)
      g.fillRect(x, SURFACE + 7, 1, 3)
    } else {
      const r = h.ghost.kind === 'wipe' ? 14 : 6
      g.fillStyle = `rgb(${color} / .7)`
      const n = 24
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + t
        if (i % 2) continue
        g.fillRect(Math.round(h.x + Math.cos(a) * r), Math.round(h.y + Math.sin(a) * r), 1, 1)
      }
    }
  }
}

/** アイコン用: すべての しゅるい。 */
export const ICON_LIST: ['creature' | 'decor' | 'food', string][] = [
  ...SPECIES.map(s => ['creature', s.id] as ['creature', string]),
  ...DECOR.map(d => ['decor', d.kind] as ['decor', string]),
  ...(['flake', 'pellet', 'shrimp'] as const).map(f => ['food', f] as ['food', string]),
]

