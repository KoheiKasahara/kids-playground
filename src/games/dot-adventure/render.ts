// えを かく ところ。ひくい かいぞうど（ドットの 大きさ そのまま）の バッファに かいてから、
// 画面へ 整数ばいで ひきのばす ので、どこを とっても ドットが そろう。

import { bayer, canvasFromPixels, hash2, makeCanvas, pack, periodicNoise, rng } from './pixel'
import {
  CHEST_CLOSED, CHEST_OPEN, CROWN, CRAB_FRAMES, HEART, HERO_PALETTE, LILY, LILY_FLOWER, NOTE, RAINBOW_SHELL,
  SHELL, STARFISH, BUTTERFLY, heroRows, spriteCanvas, type Facing,
} from './sprites'
import {
  boulderCanvas, brazierCanvas, bushCanvas, doorCanvas, flameCanvas, gemCanvas, palmCanvas, pillarCanvas, rockCanvas,
  shadowCanvas, shardCanvas, slimeCanvas, switchCanvas, treeCanvas,
} from './shapes'
import { buildTerrain, castShadow, DYN_WATER, DYN_WET, type Terrain } from './terrain'
import { BERRY_BUSH, GROUND, LIGHTING, PALM, ROCK, SHARD_OUTLINE, SHARD_RAMP, SLIME, STONE, TREE } from './theme'
import type { FriendDef, StageDef } from './stages'
import { TILE, tileCenter, type Dir, type Friend, type Point, type World, type WorldEvent } from './world'

type Img = HTMLCanvasElement
type Drawable = { img: Img; x: number; y: number; sortY: number }
type StaticObject = Drawable & {
  kind: string; light?: { x: number; y: number; r: number; color: string }; flameX?: number; flameY?: number; seed: number
  /** しかけの たいまつの ばんごう（ひが ついた ときだけ もえる）。 */
  torch?: number
}
/** しかけの え。 */
type GimmickArt =
  | { kind: 'boulder'; img: Img }
  | { kind: 'bridge'; planks: { img: Img; x: number; y: number; order: number }[]; switchUp: Img; switchDown: Img }
  | { kind: 'torch'; img: Img }
/** しかけが ひらく えんしゅつの ながさ（フレーム）。 */
const GATE_ANIM = 48

type Particle = {
  kind: 'spark' | 'dust' | 'heart' | 'note' | 'ring' | 'mote'
  x: number; y: number; vx: number; vy: number; life: number; max: number; color: string
}
type Critter = { kind: 'butterfly' | 'leaf' | 'firefly' | 'gull'; x: number; y: number; vx: number; vy: number; t: number; seed: number }

export type Fx = { parts: Particle[]; critters: Critter[]; chestAt: number; openAt: number; marker: { x: number; y: number; t: number } | null }

export function createFx(): Fx {
  return { parts: [], critters: [], chestAt: -1, openAt: -1, marker: null }
}

const SPARK_COLORS = ['#ffffff', '#fff6a0', '#ffd23c', '#9ce8ff']

/** できごとに あわせて きらきらを だす。 */
export function spawnFx(fx: Fx, event: WorldEvent, time: number) {
  const r = rng(Math.floor(time * 1000) + event.x)
  if (event.type === 'shard') {
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, s = .6 + r() * 1.8
      fx.parts.push({ kind: 'spark', x: event.x, y: event.y - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s - .6, life: 0, max: 30 + r() * 30, color: SPARK_COLORS[i % 4] })
    }
    fx.parts.push({ kind: 'ring', x: event.x, y: event.y - 10, vx: 0, vy: 0, life: 0, max: 24, color: '#fff6a0' })
  } else if (event.type === 'join') {
    for (let i = 0; i < 5; i++) fx.parts.push({ kind: 'heart', x: event.x + (r() - .5) * 14, y: event.y - 14, vx: (r() - .5) * .4, vy: -.35 - r() * .3, life: -i * 7, max: 70, color: '' })
    fx.parts.push({ kind: 'note', x: event.x + 8, y: event.y - 20, vx: .25, vy: -.4, life: 0, max: 60, color: '' })
  } else if (event.type === 'chest-appear') {
    fx.chestAt = time
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2, s = .5 + r() * 2.4
      fx.parts.push({ kind: 'spark', x: event.x, y: event.y - 8, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .6 - 1, life: -r() * 10, max: 40 + r() * 30, color: SPARK_COLORS[i % 4] })
    }
  } else if (event.type === 'chest-open') {
    fx.openAt = time
    for (let i = 0; i < 60; i++) {
      const a = -Math.PI / 2 + (r() - .5) * 2.2, s = 1 + r() * 2.6
      fx.parts.push({ kind: 'spark', x: event.x, y: event.y - 12, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: -r() * 20, max: 50 + r() * 40, color: SPARK_COLORS[i % 4] })
    }
  } else if (event.type === 'gate-open') {
    for (let i = 0; i < 18; i++) {
      const a = r() * Math.PI * 2, s = .3 + r() * 1.2
      fx.parts.push({ kind: 'dust', x: event.x + (r() - .5) * 12, y: event.y - 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .5 - .3, life: -r() * 12, max: 26 + r() * 16, color: '#e8e0d0' })
    }
    for (let i = 0; i < 24; i++) {
      const a = r() * Math.PI * 2, s = .5 + r() * 1.8
      fx.parts.push({ kind: 'spark', x: event.x, y: event.y - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s - .8, life: -r() * 16, max: 34 + r() * 26, color: SPARK_COLORS[i % 4] })
    }
  } else if (event.type === 'torch') {
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (r() - .5) * 1.8, s = .6 + r() * 1.4
      fx.parts.push({ kind: 'spark', x: event.x, y: event.y - 22, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 26 + r() * 20, color: ['#fff6a0', '#ffd23c', '#ff9a40', '#ffffff'][i % 4] })
    }
  } else if (event.type === 'switch') {
    fx.parts.push({ kind: 'ring', x: event.x, y: event.y - 2, vx: 0, vy: 0, life: 0, max: 24, color: '#ffa8c8' })
  } else if (event.type === 'bump') {
    fx.parts.push({ kind: 'dust', x: event.x, y: event.y - 2, vx: 0, vy: -.2, life: 0, max: 18, color: '#e8e0d0' })
  }
}

export function updateFx(fx: Fx) {
  for (const p of fx.parts) {
    p.life++
    if (p.life < 0) continue
    p.x += p.vx
    p.y += p.vy
    if (p.kind === 'spark') { p.vx *= .95; p.vy = p.vy * .95 + .025 }
    else if (p.kind === 'dust') { p.vx *= .9; p.vy *= .9 }
  }
  fx.parts = fx.parts.filter(p => p.life < p.max)
}

/** SFC の 画面に ちかい 見た目に なるよう、バッファの 大きさを きめる（整数ばい）。 */
export function viewSize(cssW: number, cssH: number, dpr: number) {
  const dw = Math.max(1, Math.round(cssW * dpr)), dh = Math.max(1, Math.round(cssH * dpr))
  const scale = Math.max(1, Math.floor(Math.min(dw / 300, dh / 176)))
  return { w: Math.ceil(dw / scale), h: Math.ceil(dh / scale), scale, dw, dh }
}

type FriendArt = { frames: Img[]; blink: Img; kind: FriendDef['kind'] }

export class Scene {
  readonly stage: StageDef
  readonly terrain: Terrain
  readonly ground: Img
  readonly objects: StaticObject[] = []
  readonly lilies: { img: Img; x: number; y: number; seed: number }[] = []
  private hero: Record<Dir, Img[]>
  private friends = new Map<string, FriendArt>()
  private shards: Img[]
  private chest: [Img, Img]
  private treasure: Img
  private flames: Img[]
  private heart: Img
  private note: Img
  private butterflies: Img[]
  private shadowBig: Img
  private shadowSmall: Img
  private clouds: Img | null = null
  private gimmick: GimmickArt | null = null
  private buffer: { canvas: Img; ctx: CanvasRenderingContext2D } | null = null
  private light: { canvas: Img; ctx: CanvasRenderingContext2D } | null = null
  private mosaic: { canvas: Img; ctx: CanvasRenderingContext2D } | null = null
  private water: ImageData | null = null
  private waterPx: Uint32Array | null = null
  private waterPal: Uint32Array
  private foam: number
  private w = 0
  private h = 0

  constructor(stage: StageDef, world: World) {
    this.stage = stage
    const level = world.level
    const pal = GROUND[stage.id]
    this.terrain = buildTerrain(level, { palette: pal, waves: !!stage.waves, seed: stage.id.length * 97 })
    this.waterPal = Uint32Array.from(pal.water.map(c => pack(c)))
    this.foam = pack(pal.foam)
    const need = <T,>(v: T | null): T => { if (!v) throw new Error('canvas unavailable'); return v }

    // ---- もの ----
    const treeStyle = TREE[stage.id]
    const trees = [0, 1, 2, 3].map(i => need(treeCanvas(stage.id === 'forest' && i === 3 ? { ...treeStyle, fruit: '#e8384a' } : treeStyle, i * 13 + 5)))
    const bushes = [0, 1, 2].map(i => need(bushCanvas(i === 0 ? BERRY_BUSH(stage.id) : TREE[stage.id], i * 7 + 3)))
    const rocks = [0, 1, 2].map(i => need(rockCanvas(ROCK[stage.id], i * 11 + 2)))
    const palms = [0, 1].map(i => need(palmCanvas(PALM, i + 1)))
    const pillars = [0, 1, 2].map(i => need(pillarCanvas(STONE, i * 5 + 1, false)))
    const broken = [0, 1].map(i => need(pillarCanvas(STONE, i * 9 + 4, true)))
    const brazier = need(brazierCanvas(STONE))
    const shell = need(spriteCanvas(SHELL)), star = need(spriteCanvas(STARFISH))
    const lily = need(spriteCanvas(LILY)), lilyFlower = need(spriteCanvas(LILY_FLOWER))
    const torchIndex = (tx: number, ty: number) => level.torches.findIndex(t => t.tx === tx && t.ty === ty)
    for (const o of level.objects) {
      const fx = o.tx * TILE + 8, fy = o.ty * TILE + 14
      const v = Math.floor(hash2(o.tx, o.ty, 5) * 1000)
      const add = (img: Img, ax: number, ay: number, extra: Partial<StaticObject> = {}) =>
        this.objects.push({ img, x: fx - ax, y: fy - ay, sortY: fy, kind: o.kind, seed: o.seed, ...extra })
      switch (o.kind) {
        case 'T':
          castShadow(this.terrain, fx + 3, fy - 1, 19, 7, .6)
          add(trees[v % trees.length], 24, 56)
          break
        case 'P': castShadow(this.terrain, fx + 2, fy - 1, 12, 4, .62); add(palms[v % 2], 32, 68); break
        case 'b': castShadow(this.terrain, fx + 1, fy, 10, 4, .62); add(bushes[v % bushes.length], 11, 16); break
        case 'r': castShadow(this.terrain, fx + 1, fy, 10, 4, .6); add(rocks[v % rocks.length], 11, 15); break
        case 'I': castShadow(this.terrain, fx + 2, fy, 10, 4, .58); add(pillars[v % pillars.length], 10, 46); break
        case 'i': castShadow(this.terrain, fx + 2, fy, 10, 4, .58); add(broken[v % broken.length], 10, 46); break
        case 'f':
          castShadow(this.terrain, fx + 1, fy, 7, 3, .6)
          add(brazier, 8, 21, { light: { x: fx, y: fy - 16, r: 64, color: '#ffb060' }, flameX: fx - 6, flameY: fy - 27 })
          break
        case 'u':
          castShadow(this.terrain, fx + 1, fy, 7, 3, .6)
          add(brazier, 8, 21, { light: { x: fx, y: fy - 16, r: 64, color: '#ffb060' }, flameX: fx - 6, flameY: fy - 27, torch: torchIndex(o.tx, o.ty) })
          break
        case 'h': stamp(this.terrain, v % 3 === 0 ? star : shell, fx - 2, fy - 8); break
        case 'L': this.lilies.push({ img: v % 3 === 0 ? lilyFlower : lily, x: fx - 4, y: fy - 11, seed: v }); break
      }
    }
    this.objects.sort((a, b) => a.sortY - b.sortY)
    this.ground = need(canvasOf(this.terrain.pw, this.terrain.ph, this.terrain.pixels))

    // ---- しかけ ----
    const gk = stage.gimmick.kind
    if (level.gates.length && gk === 'boulder') this.gimmick = { kind: 'boulder', img: need(boulderCanvas(ROCK[stage.id])) }
    else if (level.gates.length && gk === 'torch') this.gimmick = { kind: 'torch', img: need(doorCanvas(STONE)) }
    else if (level.gates.length && gk === 'bridge') {
      // はしが かかった ときの じめんを べつに つくって、その マスだけ きりだす。
      const ground = level.ground.slice()
      for (const g of level.gates) ground[g.ty * level.w + g.tx] = '#'
      const built = buildTerrain({ ...level, ground }, { palette: pal, waves: !!stage.waves, seed: stage.id.length * 97 })
      const gateAt = new Map(level.gates.map((g, i) => [`${g.tx},${g.ty}`, i + 1]))
      const tiles: { tx: number; ty: number; order: number }[] = []
      for (let ty = 0; ty < level.h; ty++) for (let tx = 0; tx < level.w; tx++) {
        const order = gateAt.get(`${tx},${ty}`)
        if (order) { tiles.push({ tx, ty, order }); continue }
        // もとから ある はしの はしっこも つなぎめが あうように かきなおす。
        const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => gateAt.has(`${tx + dx},${ty + dy}`))
        if (touches && ground[ty * level.w + tx] === '#') tiles.push({ tx, ty, order: 0 })
      }
      const planks = tiles.map(({ tx, ty, order }) => {
        const px = new Uint32Array(TILE * TILE)
        for (let y = 0; y < TILE; y++) px.set(built.pixels.subarray((ty * TILE + y) * built.pw + tx * TILE, (ty * TILE + y) * built.pw + tx * TILE + TILE), y * TILE)
        return { img: need(canvasFromPixels(TILE, TILE, px)), x: tx * TILE, y: ty * TILE, order }
      })
      this.gimmick = { kind: 'bridge', planks, switchUp: need(switchCanvas(false)), switchDown: need(switchCanvas(true)) }
    }

    // ---- キャラクター ----
    const heroFrames = (facing: Facing, flip: boolean) => [0, 1, 2, 3].map(s => need(spriteCanvas({ rows: heroRows(facing, s), palette: HERO_PALETTE }, flip)))
    this.hero = { down: heroFrames('down', false), up: heroFrames('up', false), right: heroFrames('side', false), left: heroFrames('side', true) }
    for (const def of stage.friends) {
      if (this.friends.has(def.name)) continue
      if (def.kind === 'crab') {
        this.friends.set(def.name, { kind: 'crab', frames: CRAB_FRAMES.map(f => need(spriteCanvas(f))), blink: need(spriteCanvas(CRAB_FRAMES[0])) })
      } else {
        const st = SLIME[def.color]
        const sizes: [number, number][] = [[14, 11], [15, 10], [16, 9], [13, 12], [12, 13]]
        this.friends.set(def.name, { kind: 'slime', frames: sizes.map(([w, h]) => need(slimeCanvas(st, w, h))), blink: need(slimeCanvas(st, 14, 11, true)) })
      }
    }
    this.shards = Array.from({ length: 12 }, (_, i) => need(shardCanvas(i / 12 * Math.PI * 2, SHARD_RAMP, SHARD_OUTLINE)))
    this.chest = [need(spriteCanvas(CHEST_CLOSED)), need(spriteCanvas(CHEST_OPEN))]
    this.treasure = stage.id === 'ruins' ? need(spriteCanvas(CROWN)) : stage.id === 'beach' ? need(spriteCanvas(RAINBOW_SHELL))
      : need(gemCanvas(['#063a1c', '#0c6a30', '#18a048', '#4cd070', '#a0f0b0', '#ffffff'], '#02200e'))
    this.flames = [0, 1, 2, 3, 4, 5].map(i => need(flameCanvas(i)))
    this.heart = need(spriteCanvas(HEART))
    this.note = need(spriteCanvas(NOTE))
    this.butterflies = BUTTERFLY.map(b => need(spriteCanvas(b)))
    this.shadowBig = need(shadowCanvas(14, 5))
    this.shadowSmall = need(shadowCanvas(9, 4))
    if (stage.theme === 'day') this.clouds = cloudCanvas()
  }

  /** ひかりの でる もの（ひの きえた たいまつは のぞく）。 */
  private lights(world: World) {
    return this.objects.filter(o => o.light && (o.torch === undefined || world.gimmick.lit[o.torch]))
  }

  treasureImage() {
    return this.treasure
  }

  private ensure(w: number, h: number) {
    if (this.buffer && this.w === w && this.h === h) return
    this.w = w
    this.h = h
    this.buffer = makeCanvas(w, h)
    this.light = makeCanvas(w, h)
    this.mosaic = makeCanvas(w, h)
    if (this.buffer) {
      this.water = this.buffer.ctx.createImageData(w, h)
      this.waterPx = new Uint32Array(this.water.data.buffer)
    }
  }

  /** カメラの いち（主人公を まんなかに、地図の はしで とめる）。 */
  camera(target: Point, w: number, h: number): Point {
    const cx = this.terrain.pw <= w ? (this.terrain.pw - w) / 2 : Math.max(0, Math.min(this.terrain.pw - w, target.x - w / 2))
    const cy = this.terrain.ph <= h ? (this.terrain.ph - h) / 2 : Math.max(0, Math.min(this.terrain.ph - h, target.y - 12 - h / 2))
    return { x: cx, y: cy }
  }

  /** 1まい かく。できた バッファを かえす。 */
  draw(world: World, camera: Point, time: number, fx: Fx, w: number, h: number, opts: { mosaic?: number; fade?: number; guide?: Point | null } = {}) {
    this.ensure(w, h)
    const buf = this.buffer
    if (!buf) return null
    const ctx = buf.ctx
    const cam = { x: Math.round(camera.x), y: Math.round(camera.y) }
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    this.drawWater(cam, time)
    ctx.drawImage(this.ground, -cam.x, -cam.y)
    for (const l of this.lilies) {
      const bob = Math.round(Math.sin(time * 1.3 + l.seed) * .6)
      ctx.drawImage(l.img, l.x - cam.x, l.y - cam.y + bob)
    }
    this.drawGimmickGround(ctx, world, cam)
    this.drawSprites(ctx, world, cam, time, fx)
    this.drawParticles(ctx, fx, cam, time)
    this.drawAtmosphere(ctx, world, cam, time, fx)
    this.drawOverlay(ctx, cam, time, fx, opts.guide ?? null)
    // モザイク（SFC の ばめんてんかん）。
    const m = Math.max(1, Math.round(opts.mosaic ?? 1))
    if (m > 1 && this.mosaic) {
      const sw = Math.ceil(w / m), sh = Math.ceil(h / m)
      this.mosaic.ctx.imageSmoothingEnabled = false
      this.mosaic.ctx.clearRect(0, 0, w, h)
      this.mosaic.ctx.drawImage(buf.canvas, 0, 0, w, h, 0, 0, sw, sh)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(this.mosaic.canvas, 0, 0, sw, sh, 0, 0, sw * m, sh * m)
    }
    if (opts.fade && opts.fade > 0) {
      ctx.globalAlpha = Math.min(1, opts.fade)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 1
    }
    return buf.canvas
  }

  // ---------------- みず ----------------
  private drawWater(cam: Point, time: number) {
    const out = this.waterPx, img = this.water, buf = this.buffer
    if (!out || !img || !buf) return
    const t = this.terrain
    const { pw, ph, dyn, waterDist, landDist, waterShade, warp, base } = t
    const pal = this.waterPal, foam = this.foam
    const w = this.w, h = this.h
    const theme = this.stage.theme
    const deep = this.stage.waves ? 44 : 26
    const sparkRate = theme === 'sunset' ? .0035 : theme === 'night' ? .0015 : .002
    const spark = theme === 'sunset' ? pack('#fff0b0') : pack('#ffffff')
    const tick = Math.floor(time * 6)
    const black = pack('#000000')
    for (let y = 0; y < h; y++) {
      const wy = y + cam.y
      const oi = y * w
      if (wy < 0 || wy >= ph) { out.fill(black, oi, oi + w); continue }
      const row = wy * pw
      for (let x = 0; x < w; x++) {
        const wx = x + cam.x
        if (wx < 0 || wx >= pw) { out[oi + x] = black; continue }
        const k = row + wx
        const d = dyn[k]
        if (d === 0) { out[oi + x] = 0; continue }
        if (d === DYN_WATER) {
          const dist = waterDist[k]
          const depth = Math.min(1, dist / deep)
          let idx = 5.2 - depth * 4.4
          const wv = warp[k] / 255
          const phase = wy * .5 + Math.sin(wx * .11 + wy * .03 + time * 1.1 + wv * 4) * 2.4 - time * 2.2
          const f = phase / 6 - Math.floor(phase / 6)
          if (wv > .42 && f < .14) idx += 1.35
          else if (wv < .3 && f > .5 && f < .6) idx -= .7
          idx -= waterShade[k] * .6
          let c = pal[Math.max(0, Math.min(6, Math.floor(idx + (bayer(wx, wy) - .5) * .7)))]
          const foamW = 1.3 + (Math.sin(time * 2.1 + (wx + wy) * .21) + 1) * .8
          if (dist <= foamW && waterShade[k] < 3) c = foam
          else if (dist <= foamW + 1.5 && bayer(wx, wy) > .45 && waterShade[k] < 2) c = pal[6]
          else if (depth > .12 && hash2(wx, wy, tick) < sparkRate) c = spark
          else if (theme === 'night' && hash2(wx, wy, 99) < .004 && Math.sin(time * 3 + wx) > .2) c = pack('#e8f0ff')
          out[oi + x] = c
        } else if (d === DYN_WET) {
          const ld = landDist[k]
          const wave = 4.6 + 3.6 * Math.sin(time * .9 + wx * .035) + Math.sin(time * 2.3 + wx * .11) * .7
          const b = base[k]
          if (ld < wave - 1) out[oi + x] = ld > wave - 2.6 ? pal[6] : (bayer(wx, wy) > .5 ? pal[5] : pal[6])
          else if (ld < wave + .9) out[oi + x] = hash2(wx, tick >> 1, 7) < .1 ? pal[6] : foam
          else if (ld < wave + 4 + Math.sin(time * .9 + wx * .035 - .8) * 2) out[oi + x] = darken(b)
          else out[oi + x] = b
        }
      }
    }
    buf.ctx.putImageData(img, 0, 0)
  }

  // ---------------- キャラクターと もの ----------------
  private drawSprites(ctx: CanvasRenderingContext2D, world: World, cam: Point, time: number, fx: Fx) {
    const w = this.w, h = this.h
    const list: { sortY: number; draw: () => void }[] = []
    for (const o of this.objects) {
      if (o.x - cam.x > w || o.y - cam.y > h || o.x + o.img.width - cam.x < 0 || o.y + o.img.height - cam.y < 0) continue
      list.push({
        sortY: o.sortY, draw: () => {
          ctx.drawImage(o.img, o.x - cam.x, o.y - cam.y)
          if (o.flameX !== undefined && o.flameY !== undefined && (o.torch === undefined || world.gimmick.lit[o.torch])) {
            const f = this.flames[Math.floor(time * 10 + o.seed) % this.flames.length]
            ctx.drawImage(f, o.flameX - cam.x, o.flameY - cam.y)
          }
        },
      })
    }
    // ほしの かけら。
    world.shards.forEach((s, i) => {
      if (s.taken) return
      const bob = Math.round(Math.sin(time * 2.6 + i) * 2)
      const frame = this.shards[Math.floor(time * 9 + i * 3) % this.shards.length]
      list.push({
        sortY: s.y, draw: () => {
          ctx.globalAlpha = .35
          ctx.drawImage(this.shadowSmall, s.x - 4 - cam.x, s.y - 3 - cam.y)
          ctx.globalAlpha = 1
          ctx.drawImage(frame, s.x - 7 - cam.x, s.y - 22 - cam.y + bob)
        },
      })
    })
    // たからばこ。
    if (world.chest.visible) {
      const c = world.chest
      const since = fx.chestAt >= 0 ? time - fx.chestAt : 99
      const drop = since < .5 ? Math.round((1 - since / .5) ** 2 * -60) : since < .7 ? -Math.round(Math.sin((since - .5) / .2 * Math.PI) * 3) : 0
      list.push({
        sortY: c.y, draw: () => {
          ctx.globalAlpha = .4
          ctx.drawImage(this.shadowBig, c.x - 7 - cam.x, c.y - 3 - cam.y)
          ctx.globalAlpha = 1
          ctx.drawImage(c.open ? this.chest[1] : this.chest[0], c.x - 8 - cam.x, c.y - 14 - cam.y + drop)
          if (c.open && fx.openAt >= 0) {
            const k = Math.min(1, (time - fx.openAt) / 1.2)
            const lift = Math.round(k * 22 + Math.sin(time * 3) * 1.5)
            const t = this.treasure
            ctx.drawImage(t, Math.round(c.x - t.width / 2 - cam.x), c.y - 16 - lift - t.height / 2 - cam.y)
          }
        },
      })
    }
    this.addGimmickSprites(list, ctx, world, cam, time)
    // なかま。
    for (const f of world.friends) list.push({ sortY: f.y, draw: () => this.drawFriend(ctx, f, cam, time) })
    // しゅじんこう。
    const hero = world.hero
    const heroImg = () => {
      const step = hero.moving ? Math.floor(hero.walk / 7) % 4 : 0
      return this.hero[hero.dir][step]
    }
    list.push({
      sortY: hero.y, draw: () => {
        ctx.globalAlpha = .38
        ctx.drawImage(this.shadowBig, Math.round(hero.x) - 7 - cam.x, Math.round(hero.y) - 3 - cam.y)
        ctx.globalAlpha = 1
        ctx.drawImage(heroImg(), Math.round(hero.x) - 8 - cam.x, Math.round(hero.y) - 24 - cam.y)
      },
    })
    list.sort((a, b) => a.sortY - b.sortY)
    for (const d of list) d.draw()
    // 木の うしろに かくれても すこし みえるように、うすく もういちど かく。
    ctx.globalAlpha = .4
    ctx.drawImage(heroImg(), Math.round(hero.x) - 8 - cam.x, Math.round(hero.y) - 24 - cam.y)
    for (const f of world.friends) if (f.joined) this.drawFriend(ctx, f, cam, time, true)
    ctx.globalAlpha = 1
  }

  /** じめんに はりつく しかけ（はしの いた・スイッチ）。 */
  private drawGimmickGround(ctx: CanvasRenderingContext2D, world: World, cam: Point) {
    const art = this.gimmick
    if (art?.kind !== 'bridge') return
    const g = world.gimmick
    const since = g.open ? world.frame - g.openFrame : -1
    for (const s of world.level.switches) ctx.drawImage(g.pressed ? art.switchDown : art.switchUp, s.x - 8 - cam.x, s.y - 9 - cam.y)
    if (since < 0) return
    // いたが 1まいずつ おちてきて はしが のびる。
    for (const p of art.planks) {
      const k = Math.min(1, Math.max(0, (since - p.order * 6) / 10))
      if (k <= 0) continue
      ctx.globalAlpha = k
      ctx.drawImage(p.img, p.x - cam.x, p.y - cam.y - Math.round((1 - k) * 8))
    }
    ctx.globalAlpha = 1
  }

  /** たって いる しかけ（いわ・とびら）を ならびじゅんの リストに いれる。 */
  private addGimmickSprites(list: { sortY: number; draw: () => void }[], ctx: CanvasRenderingContext2D, world: World, cam: Point, time: number) {
    const art = this.gimmick
    const g = world.gimmick
    if (!art || art.kind === 'bridge') return
    const since = g.open ? world.frame - g.openFrame : -1
    if (since >= GATE_ANIM) return
    const k = since < 0 ? 0 : since / GATE_ANIM
    for (const t of world.level.gates) {
      const c = tileCenter(t.tx, t.ty)
      const foot = t.ty * TILE + 14
      if (art.kind === 'boulder') {
        // なかまが たりない ときは ちかづくと すこし ぐらぐら。みんなで おすと ころがって きえる。
        const wobble = since < 0 && g.near ? Math.round(Math.sin(time * 30)) : 0
        const slide = k * k * 14
        const x = Math.round(c.x + g.push.x * slide) + wobble, y = Math.round(foot + g.push.y * slide)
        list.push({
          sortY: foot, draw: () => {
            ctx.globalAlpha = (1 - k) * .4
            ctx.drawImage(this.shadowBig, x - 7 - cam.x, y - 3 - cam.y)
            ctx.globalAlpha = 1 - k * k
            ctx.drawImage(art.img, x - 14 - cam.x, y - 22 - cam.y)
            ctx.globalAlpha = 1
          },
        })
      } else {
        // とびらは ゴゴゴと じめんに しずむ。
        const img = art.img
        const sink = Math.round(k * img.height)
        const shake = since >= 0 ? Math.round(Math.sin(since * 1.7)) : 0
        list.push({
          sortY: foot, draw: () => {
            const visible = img.height - sink
            if (visible > 0) ctx.drawImage(img, 0, 0, img.width, visible, c.x - 10 + shake - cam.x, foot - 30 + sink - cam.y, img.width, visible)
          },
        })
      }
    }
  }

  private drawFriend(ctx: CanvasRenderingContext2D, f: Friend, cam: Point, time: number, ghost = false) {
    const art = this.friends.get(f.def.name)
    if (!art) return
    const x = Math.round(f.x) - cam.x, y = Math.round(f.y) - cam.y
    if (art.kind === 'crab') {
      const img = art.frames[f.moving ? Math.floor(f.hop / 6) % 2 : 0]
      if (!ghost) { ctx.globalAlpha = .35; ctx.drawImage(this.shadowBig, x - 7, y - 3); ctx.globalAlpha = 1 }
      ctx.drawImage(img, x - 8, y - 12)
      return
    }
    // スライムは ぴょんぴょん。とまっている ときは ぷるぷる いきをする。
    let frame: number, lift = 0
    if (f.moving) {
      const p = (f.hop % 24) / 24
      lift = Math.round(Math.sin(p * Math.PI) * 5)
      frame = p < .12 || p > .9 ? 2 : p < .3 ? 4 : p < .7 ? 3 : 1
    } else {
      const b = Math.sin(f.hop * .08)
      frame = b > .55 ? 1 : b < -.55 ? 3 : 0
    }
    const blink = !f.moving && (Math.floor(time * 10 + f.home.x) % 37) === 0
    const img = blink ? art.blink : art.frames[frame]
    if (!ghost) {
      ctx.globalAlpha = .35 - lift * .03
      ctx.drawImage(this.shadowBig, x - 7, y - 3)
      ctx.globalAlpha = 1
    }
    ctx.drawImage(img, x - 10, y - 17 - lift)
  }

  /** タップした ところの しるし と、画面の そとの めあてを さす やじるし。 */
  private drawOverlay(ctx: CanvasRenderingContext2D, cam: Point, time: number, fx: Fx, guide: Point | null) {
    const m = fx.marker
    if (m) {
      const k = (time - m.t) / .5
      if (k >= 1) fx.marker = null
      else {
        ctx.strokeStyle = '#ffffff'
        pixelCircle(ctx, Math.round(m.x - cam.x), Math.round(m.y - cam.y), 7 * (1 - k) + 2)
        ctx.fillStyle = '#fff6a0'
        const d = Math.round(4 + k * 6)
        const x = Math.round(m.x - cam.x), y = Math.round(m.y - cam.y)
        ctx.fillRect(x - d, y, 2, 1); ctx.fillRect(x + d - 1, y, 2, 1); ctx.fillRect(x, y - d, 1, 2); ctx.fillRect(x, y + d - 1, 1, 2)
      }
    }
    if (!guide) return
    const gx = guide.x - cam.x, gy = guide.y - 10 - cam.y
    const margin = 14
    if (gx > margin && gx < this.w - margin && gy > margin + 8 && gy < this.h - margin) return
    const cx = this.w / 2, cy = this.h / 2
    const a = Math.atan2(gy - cy, gx - cx)
    // 画面の ふちに そって やじるしを おく。
    const sx = Math.cos(a), sy = Math.sin(a)
    const tx = sx ? ((sx > 0 ? this.w - margin : margin) - cx) / sx : Infinity
    const ty = sy ? ((sy > 0 ? this.h - margin : margin + 10) - cy) / sy : Infinity
    const t = Math.min(tx, ty)
    const bob = Math.sin(time * 6) * 2
    const ax = Math.round(cx + sx * (t - bob)), ay = Math.round(cy + sy * (t - bob))
    pixelArrow(ctx, ax, ay, a)
  }

  // ---------------- こまかい えんしゅつ ----------------
  private drawParticles(ctx: CanvasRenderingContext2D, fx: Fx, cam: Point, time: number) {
    for (const p of fx.parts) {
      if (p.life < 0) continue
      const k = p.life / p.max
      const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y)
      if (p.kind === 'spark') {
        ctx.fillStyle = p.color
        const big = k < .5 && (p.life >> 2) % 2 === 0
        ctx.fillRect(x, y, 1, 1)
        if (big) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3) }
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color
        ctx.globalAlpha = 1 - k
        ctx.lineWidth = 1
        const r = 4 + k * 18
        pixelCircle(ctx, x, y, r)
        ctx.globalAlpha = 1
      } else if (p.kind === 'dust') {
        ctx.fillStyle = p.color
        ctx.globalAlpha = 1 - k
        const r = 2 + Math.floor(k * 4)
        ctx.fillRect(x - r, y, 2, 1)
        ctx.fillRect(x + r - 1, y, 2, 1)
        ctx.fillRect(x - 1, y - 1 - Math.floor(k * 3), 2, 1)
        ctx.globalAlpha = 1
      } else if (p.kind === 'heart') {
        ctx.globalAlpha = k > .7 ? (1 - k) / .3 : 1
        ctx.drawImage(this.heart, x - 3 + Math.round(Math.sin(time * 4 + p.x) * 1.5), y - 3)
        ctx.globalAlpha = 1
      } else if (p.kind === 'note') {
        ctx.globalAlpha = k > .7 ? (1 - k) / .3 : 1
        ctx.drawImage(this.note, x - 3 + Math.round(Math.sin(time * 5) * 2), y - 3)
        ctx.globalAlpha = 1
      }
    }
  }

  private drawAtmosphere(ctx: CanvasRenderingContext2D, world: World, cam: Point, time: number, fx: Fx) {
    const w = this.w, h = this.h
    const theme = this.stage.theme
    updateCritters(fx, this.stage, cam, w, h, time)
    // ちょうちょ・はっぱ（ひるま）。
    for (const c of fx.critters) {
      const x = Math.round(c.x - cam.x), y = Math.round(c.y - cam.y)
      if (c.kind === 'butterfly') {
        const img = this.butterflies[Math.floor(time * 8 + c.seed) % 2]
        ctx.drawImage(img, x - 2, y - 1)
      } else if (c.kind === 'leaf') {
        ctx.fillStyle = c.seed % 3 === 0 ? '#d8a040' : c.seed % 3 === 1 ? '#78b848' : '#a8cc50'
        const flip = Math.floor(time * 4 + c.seed) % 2
        ctx.fillRect(x, y, flip ? 2 : 1, flip ? 1 : 2)
      } else if (c.kind === 'gull') {
        // かもめの かげ。
        ctx.globalAlpha = .18
        ctx.fillStyle = '#301830'
        const flap = Math.floor(time * 5 + c.seed) % 2
        ctx.fillRect(x - 4, y + flap, 3, 1); ctx.fillRect(x - 1, y + 1, 2, 1); ctx.fillRect(x + 1, y + flap, 3, 1)
        ctx.globalAlpha = 1
      }
    }
    // くもの かげ。
    if (this.clouds && theme !== 'night') {
      const cw = this.clouds.width
      const ox = Math.floor((cam.x + time * 6) % cw), oy = Math.floor((cam.y + time * 2.5) % cw)
      ctx.globalAlpha = theme === 'sunset' ? .14 : .2
      for (let yy = -oy; yy < h; yy += cw) for (let xx = -ox; xx < w; xx += cw) ctx.drawImage(this.clouds, xx, yy)
      ctx.globalAlpha = 1
    }
    // こもれび（もりの ひかりの すじ）。
    if (this.stage.id === 'forest') {
      ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 4; i++) {
        const bx = 120 + i * 170 - cam.x + Math.sin(time * .2 + i) * 6
        const a = .06 + Math.sin(time * .7 + i * 2) * .025
        ctx.fillStyle = `rgb(255 244 200 / ${a})`
        ctx.beginPath()
        ctx.moveTo(bx, -cam.y - 10)
        ctx.lineTo(bx + 26, -cam.y - 10)
        ctx.lineTo(bx + 26 + 260, -cam.y + 420)
        ctx.lineTo(bx + 260 - 10, -cam.y + 420)
        ctx.closePath()
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
    }
    const lighting = LIGHTING[theme]
    const lc = this.light
    if (lighting.ambient && lc) {
      const l = lc.ctx
      l.globalCompositeOperation = 'source-over'
      if (lighting.top) {
        const g = l.createLinearGradient(0, 0, 0, h)
        g.addColorStop(0, lighting.top)
        g.addColorStop(1, lighting.ambient)
        l.fillStyle = g
      } else l.fillStyle = lighting.ambient
      l.fillRect(0, 0, w, h)
      l.globalCompositeOperation = 'lighter'
      const addLight = (x: number, y: number, r: number, color: string, power = 1) => {
        const sx = Math.round(x - cam.x), sy = Math.round(y - cam.y)
        if (sx + r < 0 || sy + r < 0 || sx - r > w || sy - r > h) return
        // SFC の ような 段の ある ひかり。
        for (const [rr, a] of [[1, .1], [.82, .12], [.64, .15], [.46, .18], [.28, .2]] as const) {
          l.globalAlpha = a * power
          l.fillStyle = color
          l.beginPath()
          l.arc(sx, sy, r * rr, 0, Math.PI * 2)
          l.fill()
        }
        l.globalAlpha = 1
      }
      if (theme === 'night') {
        for (const o of this.lights(world)) {
          const flick = 1 + Math.sin(time * 9 + o.seed) * .04 + Math.sin(time * 23 + o.seed * 3) * .03
          addLight(o.light!.x, o.light!.y, o.light!.r * flick, o.light!.color, 1)
        }
        addLight(world.hero.x, world.hero.y - 10, 50, '#fff0c8', .9)
        world.shards.forEach(s => { if (!s.taken) addLight(s.x, s.y - 12, 26, '#ffe070', .9) })
        for (const f of world.friends) if (f.def.color === 'mint' || f.def.color === 'purple') addLight(f.x, f.y - 6, 22, f.def.color === 'mint' ? '#80ffd0' : '#c0a0ff', .7)
        for (const c of fx.critters) if (c.kind === 'firefly') addLight(c.x, c.y, 7, '#d0ff80', .8)
        if (world.chest.visible) addLight(world.chest.x, world.chest.y - 8, 40, '#ffe8a0', .9)
      } else {
        // ゆうやけの 空の まぶしさ。
        l.globalAlpha = .12
        l.fillStyle = '#ffe0b0'
        l.fillRect(0, 0, w, h)
        l.globalAlpha = 1
      }
      for (const p of fx.parts) if (p.kind === 'spark' && p.life >= 0) addLight(p.x, p.y, 6, '#fff0a0', .5)
      ctx.globalCompositeOperation = 'multiply'
      ctx.drawImage(lc.canvas, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
    }
    // ひかる ものの まわりに ぼんやり（ブルーム）。
    if (theme === 'night') {
      ctx.globalCompositeOperation = 'lighter'
      for (const o of this.lights(world)) glow(ctx, o.light!.x - cam.x, o.light!.y - cam.y, 14, '#ff9a40', .22 + Math.sin(time * 11 + o.seed) * .04)
      world.shards.forEach(s => { if (!s.taken) glow(ctx, s.x - cam.x, s.y - 12 - cam.y, 9, '#ffd040', .2) })
      for (const c of fx.critters) {
        if (c.kind !== 'firefly') continue
        const on = Math.sin(time * 2.5 + c.seed) > -.3
        if (!on) continue
        ctx.fillStyle = '#f0ffa0'
        ctx.fillRect(Math.round(c.x - cam.x), Math.round(c.y - cam.y), 1, 1)
        glow(ctx, c.x - cam.x, c.y - cam.y, 3, '#c0ff60', .35)
      }
      ctx.globalCompositeOperation = 'source-over'
    } else if (theme === 'sunset') {
      ctx.globalCompositeOperation = 'lighter'
      const g = ctx.createRadialGradient(w * .85, -h * .1, 0, w * .85, -h * .1, h * 1.1)
      g.addColorStop(0, 'rgb(255 170 90 / .32)')
      g.addColorStop(1, 'rgb(255 120 60 / 0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
    }
    // すみを すこし くらく。
    vignette(ctx, w, h, theme === 'night' ? .5 : .22)
  }
}

function darken(c: number) {
  return ((c & 0xff000000) | ((c & 0xffffff) - ((c >>> 2) & 0x3f3f3f))) >>> 0
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number) {
  ctx.globalAlpha = a
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = a * .8
  ctx.beginPath()
  ctx.arc(Math.round(x), Math.round(y), r * .5, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

/** ドットで かいた やじるし（まわしても ドットが くずれない）。 */
function pixelArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number) {
  const ca = Math.cos(-angle), sa = Math.sin(-angle)
  const inside = (x: number, y: number, grow: number) => {
    const u = x * ca - y * sa, v = x * sa + y * ca
    // さきは +u の むき。
    return u <= 5 + grow && u >= -4 - grow && Math.abs(v) <= (5 + grow - u) * .62 + (u < -1 ? -100 : 0) + grow * .5
      || (u >= -6 - grow && u < -1 + grow && Math.abs(v) <= 1.6 + grow)
  }
  for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) {
    if (inside(x, y, 0)) {
      const u = x * ca - y * sa
      ctx.fillStyle = u > 2 ? '#fff6a0' : '#ffd23c'
      ctx.fillRect(cx + x, cy + y, 1, 1)
    } else if (inside(x, y, 1.2)) {
      ctx.fillStyle = '#5a1a00'
      ctx.fillRect(cx + x, cy + y, 1, 1)
    }
  }
}

function pixelCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const n = Math.max(8, Math.round(r * 6))
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2
    ctx.fillStyle = ctx.strokeStyle
    ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * .8), 1, 1)
  }
}

let vignetteCache: { w: number; h: number; s: number; img: Img } | null = null
function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number) {
  if (!vignetteCache || vignetteCache.w !== w || vignetteCache.h !== h || vignetteCache.s !== strength) {
    const made = makeCanvas(w, h)
    if (!made) return
    const g = made.ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .45, w / 2, h / 2, Math.max(w, h) * .75)
    g.addColorStop(0, 'rgb(0 0 20 / 0)')
    g.addColorStop(1, `rgb(0 0 20 / ${strength})`)
    made.ctx.fillStyle = g
    made.ctx.fillRect(0, 0, w, h)
    vignetteCache = { w, h, s: strength, img: made.canvas }
  }
  ctx.drawImage(vignetteCache.img, 0, 0)
}

function canvasOf(w: number, h: number, pixels: Uint32Array) {
  const made = makeCanvas(w, h)
  if (!made) return null
  const img = made.ctx.createImageData(w, h)
  new Uint32Array(img.data.buffer).set(pixels)
  made.ctx.putImageData(img, 0, 0)
  return made.canvas
}

/** 小さな 絵を じめんに はりつける。 */
function stamp(t: Terrain, img: Img, x: number, y: number) {
  const ctx = img.getContext('2d')
  if (!ctx) return
  const data = new Uint32Array(ctx.getImageData(0, 0, img.width, img.height).data.buffer)
  for (let yy = 0; yy < img.height; yy++) for (let xx = 0; xx < img.width; xx++) {
    const c = data[yy * img.width + xx]
    if (!(c >>> 24)) continue
    const px = x + xx, py = y + yy
    if (px < 0 || py < 0 || px >= t.pw || py >= t.ph) continue
    const k = py * t.pw + px
    if (t.dyn[k] === DYN_WET) t.base[k] = c
    else if (t.dyn[k] !== DYN_WATER) t.pixels[k] = c
  }
}

/** くもの かげの もよう（しきつめられる）。 */
function cloudCanvas() {
  const S = 192
  const made = makeCanvas(S, S)
  if (!made) return null
  const img = made.ctx.createImageData(S, S)
  const px = new Uint32Array(img.data.buffer)
  const c = pack('#0a1a30')
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = periodicNoise(x / 32, y / 32, S / 32, 3) * .65 + periodicNoise(x / 12, y / 12, S / 12, 4) * .35
    if (n > .62 || (n > .56 && bayer(x, y) < (n - .56) / .06)) px[y * S + x] = c
  }
  made.ctx.putImageData(img, 0, 0)
  return made.canvas
}

/** ちょうちょ・はっぱ・ほたる・かもめ を 画面の まわりで うごかす。 */
function updateCritters(fx: Fx, stage: StageDef, cam: Point, w: number, h: number, time: number) {
  const want: Record<Critter['kind'], number> = {
    butterfly: stage.id === 'forest' ? 4 : 0,
    leaf: stage.id === 'forest' ? 10 : 0,
    firefly: stage.theme === 'night' ? 22 : 0,
    gull: stage.id === 'beach' ? 3 : 0,
  }
  const counts: Record<string, number> = {}
  for (const c of fx.critters) counts[c.kind] = (counts[c.kind] ?? 0) + 1
  const seedBase = Math.floor(time * 1000)
  for (const kind of Object.keys(want) as Critter['kind'][]) {
    for (let i = counts[kind] ?? 0; i < want[kind]; i++) {
      const r = rng(seedBase + i * 17 + kind.length * 1000)
      fx.critters.push({ kind, x: cam.x + r() * w, y: cam.y + (kind === 'leaf' ? -r() * h : r() * h), vx: 0, vy: 0, t: r() * 10, seed: Math.floor(r() * 1000) })
    }
  }
  for (const c of fx.critters) {
    c.t += 1 / 60
    if (c.kind === 'butterfly') {
      c.x += Math.sin(c.t * .9 + c.seed) * .45 + .12
      c.y += Math.cos(c.t * 1.3 + c.seed) * .35 + Math.sin(c.t * 7) * .3
    } else if (c.kind === 'leaf') {
      c.x += Math.sin(c.t * 1.5 + c.seed) * .35 + .15
      c.y += .32
    } else if (c.kind === 'firefly') {
      c.x += Math.sin(c.t * .7 + c.seed) * .25
      c.y += Math.cos(c.t * .5 + c.seed * 2) * .2
    } else if (c.kind === 'gull') {
      c.x -= .9
      c.y += Math.sin(c.t * .5 + c.seed) * .2
    }
  }
  // 画面から とおく はなれたら けして、つぎに また だす。
  fx.critters = fx.critters.filter(c => c.x > cam.x - 60 && c.x < cam.x + w + 60 && c.y > cam.y - h - 40 && c.y < cam.y + h + 40)
}
