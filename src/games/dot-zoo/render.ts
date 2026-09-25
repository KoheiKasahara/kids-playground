// どうぶつえんの 絵を かく。
// 地面は 1ドットずつ ワールドの ざひょうへ もどして もようを きめ、かいてん ごとに 1かいだけ つくる。
// どうぶつ・き などは 3D もけいを やきつけた スプライトを おくゆき順に ならべる。
// さいごに 1日の じかんで 色を かえ（ゆうやけ・よる）、あかりや ホタルを ひからせる。

import { GRID, SPECIES, objectDef, speciesDef, type FoodKind, type ObjectKind, type SpeciesId } from './data'
import { TH, TW, YPX, depthOf, groundAt, toScreen, toView, viewDir } from './iso'
import { animalModel, fenceModel, foodModel, objectModel, poopModel, postModel, visitorModel, type Pose } from './models'
import { bayer, fbm, hash2, hex, makeCanvas, mix, packRgb, rampIndex, rgbCss, rng, type Rgb } from './pixel'
import { isWater, objectAt, ringPoint, type Animal, type Bubble, type World } from './sim'
import { renderModel, scaleModel, type Model, type SpriteImage } from './sprite3d'

type Img = HTMLCanvasElement

export type Ghost =
  | { kind: 'animal'; species: SpeciesId }
  | { kind: 'object'; object: ObjectKind }
  | { kind: 'food'; food: FoodKind }
  | { kind: 'remove' }

export type Hover = { x: number; z: number; ok: boolean; ghost: Ghost | null }

export type View = {
  /** 画面の 大きさ（ドット）。 */
  w: number
  h: number
  rot: number
  panX: number
  panY: number
  time: number
  /** かいてん中の つぶれぐあい（1 = ふつう）。 */
  squash: number
  still: boolean
}

export type Hit = { kind: 'animal' | 'poop' | 'object'; id: number; x0: number; y0: number; x1: number; y1: number; depth: number }

type Particle = {
  kind: 'heart' | 'spark' | 'dust' | 'crumb' | 'drop' | 'note' | 'leaf'
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  life: number; max: number
  color?: string
}

// ---------------- いろ ----------------

const GRASS = ['#2c5e36', '#3c7a3a', '#529a3e', '#6eb446', '#98cc5a'].map(hex)
const PATH = ['#6e5e58', '#948070', '#b4a088', '#d0bea0', '#e8dcc0'].map(hex)
const DIRT = ['#3a2224', '#57342c', '#784a36', '#966444', '#b2845a'].map(hex)
const WATER = ['#1a3272', '#24509e', '#3474c4', '#58a0e0', '#b0e4f8'].map(hex)
const LILY = ['#2e6e3a', '#4a9a44', '#7cc458'].map(hex)
const FLOWER = ['#f4f0ff', '#f8d040', '#f07aa8', '#ea4a5a', '#b890f0'].map(hex)

type SkyKey = { top: Rgb; bottom: Rgb; hill: Rgb; hill2: Rgb; tint: Rgb; stars: number }
const SKY: Record<'morning' | 'day' | 'evening' | 'night', SkyKey> = {
  morning: { top: hex('#6aa8e8'), bottom: hex('#f8d8c0'), hill: hex('#7aa0b8'), hill2: hex('#5c8a88'), tint: hex('#fff0e0'), stars: 0 },
  day: { top: hex('#3a88e8'), bottom: hex('#b8e8ff'), hill: hex('#88b8d0'), hill2: hex('#5a9a78'), tint: hex('#ffffff'), stars: 0 },
  evening: { top: hex('#5a4a9a'), bottom: hex('#ffa060'), hill: hex('#9a6a8a'), hill2: hex('#6a4a6a'), tint: hex('#ffb890'), stars: .2 },
  night: { top: hex('#0c1030'), bottom: hex('#2a3070'), hill: hex('#20284e'), hill2: hex('#161c3a'), tint: hex('#5a68b8'), stars: 1 },
}

/** 1日の じかんに あわせて 2つの いろを なめらかに つなぐ。 */
export function skyAt(clock: number): SkyKey {
  // [じこく, いろ] の ならび。
  const keys: [number, SkyKey][] = [
    [0, SKY.morning], [.12, SKY.day], [.52, SKY.day], [.62, SKY.evening], [.72, SKY.night], [.92, SKY.night], [1, SKY.morning],
  ]
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, ka] = keys[i], [b, kb] = keys[i + 1]
    if (clock >= a && clock <= b) {
      const t = b === a ? 0 : (clock - a) / (b - a)
      return {
        top: mix(ka.top, kb.top, t), bottom: mix(ka.bottom, kb.bottom, t), hill: mix(ka.hill, kb.hill, t), hill2: mix(ka.hill2, kb.hill2, t),
        tint: mix(ka.tint, kb.tint, t), stars: ka.stars + (kb.stars - ka.stars) * t,
      }
    }
  }
  return SKY.day
}

// ---------------- ドットの ちいさな え ----------------

const ICONS: Record<string, string[]> = {
  heart: ['.rr.rr.', 'rRRrRRr', 'rRRRRRr', 'rRRRRRr', '.rRRRr.', '..rRr..', '...r...'],
  note: ['..kkkk', '..k..k', '..k..k', '..k..k', 'kkk.kk', 'kkkkkk', '.k..k.'],
  question: ['.kkk.', 'k...k', '....k', '..kk.', '..k..', '.....', '..k..'],
  zzz: ['kkkk....', '..k.....', '.k..kkk.', 'kkkk..k.', '.....k..', '....kkk.'],
  angry: ['r...r', '.r.r.', '.....', '.r.r.', 'r...r'],
  sparkle: ['..y..', '..Y..', 'yYWYy', '..Y..', '..y..'],
}
const ICON_COLORS: Record<string, string> = { r: '#a01c3c', R: '#f04860', k: '#2a2040', y: '#f0b020', Y: '#fff080', W: '#ffffff' }

function iconCanvas(name: string, cache: Map<string, Img | null>) {
  if (cache.has(name)) return cache.get(name)!
  const rows = ICONS[name]
  const made = makeCanvas(rows[0].length, rows.length)
  if (made) {
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return
      made.ctx.fillStyle = ICON_COLORS[ch]
      made.ctx.fillRect(x, y, 1, 1)
    }))
  }
  cache.set(name, made?.canvas ?? null)
  return made?.canvas ?? null
}

/** 地面に おとす あみかけの かげ。 */
function shadowCanvas(rx: number, ry: number) {
  const w = rx * 2 + 1, h = ry * 2 + 1
  const made = makeCanvas(w, h)
  if (!made) return null
  const img = made.ctx.createImageData(w, h)
  const px = new Uint32Array(img.data.buffer)
  const c = packRgb(hex('#16202a'), 110)
  const c2 = packRgb(hex('#16202a'), 60)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = ((x - rx) / (rx + .5)) ** 2 + ((y - ry) / (ry + .5)) ** 2
    if (d < .55) px[y * w + x] = c
    else if (d < 1) px[y * w + x] = (x + y) % 2 ? c2 : 0
  }
  made.ctx.putImageData(img, 0, 0)
  return made.canvas
}

/** あかりの まわりの ひかり（たしざんで かさねる）。 */
function glowCanvas(r: number, color: string) {
  const s = r * 2 + 1
  const made = makeCanvas(s, s)
  if (!made) return null
  const img = made.ctx.createImageData(s, s)
  const px = new Uint32Array(img.data.buffer)
  const [cr, cg, cb] = hex(color)
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const d = Math.hypot(x - r, (y - r) * 1.6) / r
    if (d >= 1) continue
    const level = Math.floor(((1 - d) ** 1.5) * 4 + bayer(x, y) * .9) / 4
    if (level <= 0) continue
    px[y * s + x] = packRgb([cr * level, cg * level, cb * level])
  }
  made.ctx.putImageData(img, 0, 0)
  return made.canvas
}

function cloudCanvas(seed: number) {
  const w = 72, h = 26
  const made = makeCanvas(w, h)
  if (!made) return null
  const img = made.ctx.createImageData(w, h)
  const px = new Uint32Array(img.data.buffer)
  const rand = rng(seed)
  const blobs = Array.from({ length: 6 }, (_, i) => ({ x: 12 + i * 9 + rand() * 6, y: 15 - Math.sin(i / 5 * Math.PI) * 5 + rand() * 2, r: 6 + Math.sin(i / 5 * Math.PI) * 5 + rand() * 2 }))
  const cols = ['#c8d4ec', '#e4ecfa', '#ffffff'].map(c => packRgb(hex(c), 235))
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let inside = false, shade = 0
    for (const b of blobs) {
      const d = Math.hypot(x - b.x, (y - b.y) * 1.3)
      if (d < b.r) { inside = true; shade = Math.max(shade, (b.y - y) / b.r + .4) }
    }
    if (!inside || y > 20) continue
    px[y * w + x] = cols[rampIndex(shade, 3, x, y, .6)]
  }
  made.ctx.putImageData(img, 0, 0)
  return made.canvas
}

// ---------------- 地面 ----------------

const HALF = GRID / 2 + 1
const CLIFF = 1.25

type Terrain = { canvas: Img; cx: number; cy: number }

function pondShape(world: World, x: number, z: number) {
  const o = objectAt(world, Math.floor(x), Math.floor(z))
  if (o?.kind !== 'pond') return null
  // かどの まるい しかく。中なら マイナス。
  const s = objectDef('pond').size
  const cx = o.x + s / 2, cz = o.z + s / 2
  const hw = s / 2 - .06, rad = s * .36
  const qx = Math.abs(x - cx) - (hw - rad), qz = Math.abs(z - cz) - (hw - rad)
  const d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rad
  return { d, seed: o.seed, cx, cz }
}

function topColor(world: World, x: number, z: number, i: number, j: number): Rgb {
  if (x < 0 || z < 0 || x >= GRID || z >= GRID) {
    // そとの みち：いしだたみ。
    const k = 2.6
    const X = x * k, Z = z * k
    const xi = Math.floor(X), zi = Math.floor(Z)
    let d1 = 9, d2 = 9, id = 0
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const cx = xi + a + .15 + hash2(xi + a, zi + b, 3) * .7, cz = zi + b + .15 + hash2(xi + a, zi + b, 4) * .7
      const d = Math.hypot(X - cx, Z - cz)
      if (d < d1) { d2 = d1; d1 = d; id = hash2(xi + a, zi + b, 5) } else if (d < d2) d2 = d
    }
    const outer = Math.min(x + 1, z + 1, GRID + 1 - x, GRID + 1 - z)
    if (outer < .07) return PATH[3]
    if (d2 - d1 < .09) return PATH[0]
    const v = .35 + id * .3 + (d1 < .25 ? .12 : 0) - (d2 - d1 < .16 ? .12 : 0)
    return PATH[rampIndex(v, 5, i, j, .5)]
  }
  const pond = pondShape(world, x, z)
  if (pond && pond.d < 0) {
    if (pond.d > -.1) return pond.d > -.05 ? PATH[2] : PATH[1]
    // はすの は
    for (let k = 0; k < 2; k++) {
      const lx = pond.cx + (hash2(pond.seed, k, 1) - .5) * 1.6, lz = pond.cz + (hash2(pond.seed, k, 2) - .5) * 1.6
      const d = Math.hypot(x - lx, z - lz)
      const ang = Math.atan2(z - lz, x - lx)
      if (d < .17 && !(Math.abs(ang - k * 2) < .35 && d > .05)) return LILY[d < .06 ? 2 : (z - lz) < -.04 ? 2 : 1]
      if (d < .19 && d >= .17) return LILY[0]
    }
    const depth = -pond.d
    const v = depth > .45 ? .12 : depth > .22 ? .32 : .55
    const wave = Math.sin(x * 9 + z * 5) * Math.sin(z * 7 - x * 3) > .82 ? .25 : 0
    return WATER[rampIndex(v + wave, 5, i, j, .5)]
  }
  let v = .3 + fbm(x * .7, z * .7, 3) * .5
  const edge = Math.min(x, z, GRID - x, GRID - z)
  if (edge < .4) v -= (.4 - edge) * .9
  if (pond && pond.d < .12) v -= .15
  const dirt = fbm(x * .45 + 40, z * .45 + 40, 8)
  if (dirt > .66 && edge > .6) return DIRT[rampIndex(.62 + (dirt - .66) * 2, 5, i, j, .6)]
  return GRASS[rampIndex(v, 5, i, j, .6)]
}

function buildTerrain(world: World, r: number): Terrain | null {
  const W = Math.ceil(HALF * 4 * TW) + 4
  const H = Math.ceil(HALF * 4 * TH + CLIFF * YPX) + 6
  const cx = W / 2, cy = HALF * 2 * TH + 2
  const made = makeCanvas(W, H)
  if (!made) return null
  const img = made.ctx.createImageData(W, H)
  const px = new Uint32Array(img.data.buffer)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const sx = i - cx + .5, sy = j - cy + .5
    const a = sx / TW, b = sy / TH
    const vx = (a + b) / 2, vz = (b - a) / 2
    if (Math.abs(vx) <= HALF && Math.abs(vz) <= HALF) {
      const [x, z] = groundAt(sx, sy, r)
      px[j * W + i] = packRgb(topColor(world, x, z, i, j))
      continue
    }
    // がけ（手前の 2つの めん）
    let along: number, y: number, left = false
    if (sx >= 0) {
      const fz = HALF - sx / TW
      y = ((HALF + fz) * TH - sy) / YPX
      along = fz
    } else {
      const fx = HALF + sx / TW
      y = ((fx + HALF) * TH - sy) / YPX
      along = fx
      left = true
    }
    if (y > 0 || y < -CLIFF || Math.abs(along) > HALF) continue
    const d = -y
    let c: Rgb
    if (d < .16) {
      // へりの いし
      const joint = Math.abs(((along * 2.2) % 1 + 1) % 1) < .07
      c = joint ? PATH[0] : PATH[d < .05 ? 3 : 2]
    } else {
      const band = d * 5 + (fbm(along * 1.5, d * 2, 21) - .5) * 1.4
      let v = .62 - d * .38 + (Math.floor(band) % 2 ? -.1 : .04)
      if (hash2(Math.floor(along * 9), Math.floor(d * 14), 9) > .9) v += .22
      c = DIRT[rampIndex(v + (left ? .08 : -.12), 5, i, j, .6)]
      if (d > CLIFF - .08) c = DIRT[0]
    }
    px[j * W + i] = packRgb(c)
  }
  // くさの は と ちいさな はな
  for (let tx = 0; tx < GRID; tx++) for (let tz = 0; tz < GRID; tz++) {
    for (let k = 0; k < 7; k++) {
      const x = tx + hash2(tx * 7 + k, tz, 31), z = tz + hash2(tx, tz * 7 + k, 32)
      if (pondShape(world, x, z)?.d !== undefined && pondShape(world, x, z)!.d < .1) continue
      const [sx, sy] = toScreen(x, 0, z, r)
      const i = Math.round(sx + cx), j = Math.round(sy + cy)
      const put = (x2: number, y2: number, c: Rgb) => { if (x2 >= 0 && y2 >= 0 && x2 < W && y2 < H) px[y2 * W + x2] = packRgb(c) }
      const f = hash2(tx + k * 13, tz, 33)
      if (f > .94) {
        put(i, j, FLOWER[Math.floor(hash2(tx, tz + k, 34) * FLOWER.length)])
        put(i, j + 1, GRASS[1])
      } else {
        put(i, j, GRASS[4]); put(i, j + 1, GRASS[3]); put(i + 1, j + 1, GRASS[1])
        if (f > .5) { put(i - 1, j - 1, GRASS[3]); put(i - 1, j, GRASS[2]) }
      }
    }
  }
  made.ctx.putImageData(img, 0, 0)
  return { canvas: made.canvas, cx, cy }
}

// ---------------- えがく ----------------

/** どうぶつは すこし 大きめに かく（こどもが 見やすいように）。 */
const ANIMAL_SCALE = 1.2
const FOOD_SCALE = 1.6

const FRAMES: Record<Pose, [number, number]> = { idle: [2, 1.4], walk: [4, 7], eat: [2, 5], sleep: [2, .7], act: [4, 6], swim: [2, 2.5] }

export class ZooRenderer {
  private sprites = new Map<string, SpriteImage>()
  private terrain: Terrain | null = null
  private terrainKey = ''
  private skyCanvas: Img | null = null
  private skyKey = ''
  private layer: { canvas: Img; ctx: CanvasRenderingContext2D } | null = null
  private icons = new Map<string, Img | null>()
  private shadows = new Map<string, Img | null>()
  private glow: Img | null = null
  private clouds: (Img | null)[] = []
  particles: Particle[] = []
  hits: Hit[] = []

  constructor() {
    this.glow = glowCanvas(22, '#ffc070')
    this.clouds = [cloudCanvas(3), cloudCanvas(8), cloudCanvas(15)]
  }

  sprite(key: string, build: () => Model, yaw: number) {
    let s = this.sprites.get(key)
    if (!s) {
      s = renderModel(build(), yaw)
      this.sprites.set(key, s)
    }
    return s
  }

  animalSprite(species: SpeciesId, pose: Pose, frame: number, dir: number) {
    const [n] = FRAMES[pose]
    return this.sprite(`a|${species}|${pose}|${frame}|${dir}`, () => scaleModel(animalModel(species, pose, frame / n), ANIMAL_SCALE), dir * Math.PI / 4)
  }

  /** トレイの ボタンに つかう 小さな え（dataURL）。 */
  iconUrl(kind: 'animal' | 'object' | 'food', id: string): string | null {
    const s = kind === 'animal' ? this.animalSprite(id as SpeciesId, 'idle', 0, 7)
      : kind === 'object' ? (id === 'pond' ? null : this.sprite(`o|${id}|1|icon`, () => objectModel(id as ObjectKind, 1), 0))
        : this.sprite(`f|${id}|icon`, () => foodModel(id as FoodKind), Math.PI / 4)
    if (kind === 'object' && id === 'pond') return pondIcon()
    if (!s?.canvas) return null
    // ボタンで ちょうど よい 大きさに せいすうばいで ひろげる。
    const k = Math.max(1, Math.floor(Math.min(52 / s.w, 38 / s.h)))
    const made = makeCanvas(s.w * k, s.h * k)
    if (!made) return null
    made.ctx.drawImage(s.canvas, 0, 0, s.w * k, s.h * k)
    try { return made.canvas.toDataURL() } catch { return null }
  }

  private ensureLayer(w: number, h: number) {
    if (!this.layer || this.layer.canvas.width !== w || this.layer.canvas.height !== h) {
      const made = makeCanvas(w, h)
      this.layer = made
    }
    return this.layer
  }

  private mask: { canvas: Img; ctx: CanvasRenderingContext2D } | null = null
  private ensureMask(w: number, h: number) {
    if (!this.mask || this.mask.canvas.width !== w || this.mask.canvas.height !== h) this.mask = makeCanvas(w, h)
    return this.mask
  }

  private ensureTerrain(world: World, r: number) {
    const key = `${r}|${world.objects.filter(o => o.kind === 'pond').map(o => `${o.x},${o.z}`).join(';')}`
    if (key !== this.terrainKey) {
      this.terrain = buildTerrain(world, r)
      this.terrainKey = key
    }
    return this.terrain
  }

  private ensureSky(w: number, h: number, clock: number) {
    const q = Math.round(clock * 96)
    const key = `${w}x${h}|${q}`
    if (key === this.skyKey) return this.skyCanvas
    this.skyKey = key
    const made = makeCanvas(w, h)
    if (!made) return (this.skyCanvas = null)
    const sky = skyAt(q / 96)
    const img = made.ctx.createImageData(w, h)
    const px = new Uint32Array(img.data.buffer)
    const hillA = (x: number) => h * .62 - fbm(x * .012, 0, 2, 3) * h * .22
    const hillB = (x: number) => h * .74 - fbm(x * .02 + 9, 4, 3, 3) * h * .16
    for (let y = 0; y < h; y++) {
      const t = y / h
      for (let x = 0; x < w; x++) {
        let c: Rgb
        if (y > hillB(x)) c = mix(sky.hill2, [0, 0, 0], .1 + bayer(x, y) * .12)
        else if (y > hillA(x)) c = mix(sky.hill, sky.hill2, (y - hillA(x)) / 40 > bayer(x, y) ? .3 : 0)
        else {
          const k = Math.floor(t * 10 + bayer(x, y) * .9) / 10
          c = mix(sky.top, sky.bottom, Math.min(1, k * 1.1))
          if (sky.stars > 0 && hash2(x, y, 77) > .996 && t < .55) c = mix(c, [255, 255, 230], sky.stars * (hash2(x, y, 78) > .5 ? 1 : .6))
        }
        px[y * w + x] = packRgb(c)
      }
    }
    made.ctx.putImageData(img, 0, 0)
    this.skyCanvas = made.canvas
    return made.canvas
  }

  private shadow(rx: number, ry: number) {
    const key = `${rx}x${ry}`
    if (!this.shadows.has(key)) this.shadows.set(key, shadowCanvas(rx, ry))
    return this.shadows.get(key)!
  }

  /** ワールドの 点 → 画面の ドット。 */
  screen(view: View, x: number, y: number, z: number): [number, number] {
    const [sx, sy] = toScreen(x, y, z, view.rot)
    return [view.w / 2 + view.panX + sx * view.squash, view.h / 2 + view.panY + sy + 8]
  }

  /** 画面の ドット → 地面の ワールド ざひょう。 */
  pick(view: View, px: number, py: number): [number, number] {
    return groundAt((px - view.w / 2 - view.panX) / view.squash, py - view.h / 2 - view.panY - 8, view.rot)
  }

  hitAt(px: number, py: number, kind?: Hit['kind']): Hit | null {
    let best: Hit | null = null
    for (const h of this.hits) {
      if (kind && h.kind !== kind) continue
      if (px >= h.x0 && px < h.x1 && py >= h.y0 && py < h.y1 && (!best || h.depth > best.depth)) best = h
    }
    return best
  }

  burst(kind: Particle['kind'], x: number, y: number, z: number, n: number, color?: string) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = kind === 'dust' ? .9 : kind === 'drop' ? .7 : .45
      this.particles.push({
        kind, x, y, z, color,
        vx: Math.cos(a) * sp * (.5 + Math.random() * .5), vz: Math.sin(a) * sp * (.5 + Math.random() * .5),
        vy: kind === 'heart' || kind === 'note' ? .7 + Math.random() * .3 : kind === 'drop' ? 2.2 + Math.random() : 1.2 + Math.random(),
        life: 0, max: kind === 'heart' || kind === 'note' ? 1.4 : kind === 'spark' ? .7 : .8,
      })
    }
  }

  private stepParticles(dt: number) {
    for (const p of this.particles) {
      p.life += dt
      p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt
      if (p.kind === 'heart' || p.kind === 'note') { p.vx *= .9; p.vz *= .9 } else p.vy -= (p.kind === 'leaf' ? 1 : 6) * dt
      if (p.kind === 'dust') { p.vx *= .88; p.vz *= .88; p.vy = Math.max(p.vy, .2) }
      if (p.y < 0 && p.kind !== 'heart' && p.kind !== 'note') { p.y = 0; p.vy = 0; p.vx = 0; p.vz = 0 }
    }
    this.particles = this.particles.filter(p => p.life < p.max)
  }

  private frame: { canvas: Img; ctx: CanvasRenderingContext2D } | null = null

  /** view の 大きさで かいて、scale ばいに ひろげて target へ うつす。 */
  draw(target: CanvasRenderingContext2D, world: World, view: View, hover: Hover | null, dt: number, scale = 1) {
    const { w, h } = view
    if (!this.frame || this.frame.canvas.width !== w || this.frame.canvas.height !== h) this.frame = makeCanvas(w, h)
    if (!this.frame) return
    this.compose(this.frame.ctx, world, view, hover, dt)
    target.imageSmoothingEnabled = false
    target.drawImage(this.frame.canvas, 0, 0, w * scale, h * scale)
  }

  private compose(out: CanvasRenderingContext2D, world: World, view: View, hover: Hover | null, dt: number) {
    const { w, h } = view
    const layer = this.ensureLayer(w, h)
    const terrain = this.ensureTerrain(world, view.rot)
    const sky = this.ensureSky(w, h, world.clock)
    if (!layer || !terrain) return
    this.stepParticles(dt)
    const ctx = layer.ctx
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, w, h)
    const ox = w / 2 + view.panX, oy = h / 2 + view.panY + 8
    const t = view.time

    // ---- じめん ----
    ctx.save()
    if (view.squash !== 1) {
      ctx.translate(ox, 0)
      ctx.scale(Math.max(.02, view.squash), 1)
      ctx.translate(-ox, 0)
    }
    ctx.drawImage(terrain.canvas, Math.round(ox - terrain.cx), Math.round(oy - terrain.cy))
    ctx.restore()

    const sq = view.squash
    const S = (x: number, y: number, z: number) => this.screen(view, x, y, z)

    // すいめんの きらきら
    for (const o of world.objects) {
      if (o.kind !== 'pond') continue
      for (let k = 0; k < 6; k++) {
        const ph = (t * .5 + hash2(o.id, k, 3)) % 1
        const ps = objectDef('pond').size
        const x = o.x + .5 + hash2(o.id, k, 4) * (ps - 1), z = o.z + .5 + hash2(o.id, k, 5) * (ps - 1)
        const [px, py] = S(x, 0, z)
        ctx.fillStyle = ph < .5 ? '#e8f8ff' : '#9ad4f4'
        const len = ph < .25 ? 1 : ph < .5 ? 3 : ph < .75 ? 2 : 0
        if (len) ctx.fillRect(Math.round(px - len / 2), Math.round(py), len, 1)
      }
    }

    // ---- おく ばしょの めじるし ----
    if (hover) this.drawHover(ctx, view, hover)

    // ---- かげ ----
    const shadowAt = (x: number, z: number, rx: number, ry: number) => {
      const img = this.shadow(rx, ry)
      if (!img) return
      const [px, py] = S(x, 0, z)
      ctx.drawImage(img, Math.round(px - rx), Math.round(py - ry))
    }
    for (const a of world.animals) {
      if (isWater(world, Math.floor(a.x), Math.floor(a.z)) && speciesDef(a.species).swims) continue
      const r = speciesDef(a.species).radius
      shadowAt(a.x, a.z, Math.max(3, Math.round(r * 20 * sq)), Math.max(2, Math.round(r * 9)))
    }
    for (const o of world.objects) {
      if (o.kind === 'pond' || o.kind === 'flowers') continue
      const s = o.kind === 'tree' ? [13, 6] : o.kind === 'palm' ? [8, 4] : o.kind === 'rock' ? [11, 5] : o.kind === 'bush' ? [10, 5] : o.kind === 'bamboo' ? [8, 4] : [4, 2]
      shadowAt(o.x + .5, o.z + .5, Math.max(2, Math.round(s[0] * sq)), s[1])
    }

    // ---- おくゆき順に ならべて かく ----
    type Item = { depth: number; draw: () => void }
    const items: Item[] = []
    const dirOff = view.rot
    this.hits = []

    // さく
    const fence = (x: number, z: number, alongX: boolean) => {
      const yaw = alongX ? 0 : Math.PI / 2
      const [vx, vz] = toView(Math.cos(yaw) + GRID / 2, -Math.sin(yaw) + GRID / 2, view.rot)
      const d = ((Math.round(Math.atan2(-vz, vx) / (Math.PI / 2)) % 4) + 4) % 4
      const img = this.sprite(`fence|${d}`, fenceModel, d * Math.PI / 2)
      items.push({ depth: depthOf(x, z, view.rot) - .02, draw: () => this.blit(ctx, img, S(x, 0, z)) })
    }
    for (let k = 0; k < GRID; k++) {
      fence(k + .5, 0, true); fence(k + .5, GRID, true)
      fence(0, k + .5, false); fence(GRID, k + .5, false)
    }
    const post = this.sprite('post', postModel, 0)
    for (const [x, z] of [[0, 0], [GRID, 0], [0, GRID], [GRID, GRID]]) items.push({ depth: depthOf(x, z, view.rot), draw: () => this.blit(ctx, post, S(x, 0, z)) })

    // もの
    for (const o of world.objects) {
      if (o.kind === 'pond') continue
      const dir = ((o.seed % 4) + 4 - dirOff) % 4
      const img = this.sprite(`o|${o.kind}|${o.seed % 7}|${dir}`, () => objectModel(o.kind, o.seed % 7), dir * Math.PI / 2 + (o.kind === 'fence' as ObjectKind ? 0 : 0))
      const x = o.x + .5, z = o.z + .5
      items.push({ depth: depthOf(x, z, view.rot), draw: () => {
        const p = S(x, 0, z)
        this.blit(ctx, img, p, o.kind === 'tree' || o.kind === 'palm' || o.kind === 'bamboo' ? Math.sin(t * 1.3 + o.seed) * .6 : 0)
        if (img.canvas) {
          const x0 = Math.round(p[0] - img.ox), y0 = Math.round(p[1] - img.oy)
          this.hits.push({ kind: 'object', id: o.id, x0, y0, x1: x0 + img.w, y1: y0 + img.h, depth: depthOf(x, z, view.rot) })
        }
      } })
    }

    // えさ
    for (const f of world.foods) {
      const img = this.sprite(`f|${f.kind}|${Math.ceil(f.left * 2)}`, () => scaleModel(foodModel(f.kind, Math.ceil(f.left * 2) / 2), FOOD_SCALE), Math.PI / 4)
      const inWater = isWater(world, Math.floor(f.x), Math.floor(f.z))
      const y = f.drop * f.drop * 2.2 + (inWater ? Math.sin(t * 3) * .02 : 0)
      items.push({ depth: depthOf(f.x, f.z, view.rot), draw: () => this.blit(ctx, img, S(f.x, y, f.z)) })
    }

    // うんち
    const poopImg = this.sprite('poop', poopModel, 0)
    for (const p of world.poops) {
      items.push({ depth: depthOf(p.x, p.z, view.rot), draw: () => {
        const [px, py] = S(p.x, 0, p.z)
        this.blit(ctx, poopImg, [px, py])
        // くさい もやもや
        ctx.fillStyle = '#9a8a5a'
        for (let k = 0; k < 2; k++) {
          const ph = (t * .8 + k * .5) % 1
          const yy = Math.round(py - 6 - ph * 7), xx = Math.round(px - 2 + k * 4 + Math.sin(ph * 6 + k) * 1.2)
          if (ph < .8) ctx.fillRect(xx, yy, 1, 2)
        }
        this.hits.push({ kind: 'poop', id: p.id, x0: px - 6, y0: py - 10, x1: px + 6, y1: py + 3, depth: depthOf(p.x, p.z, view.rot) })
      } })
    }

    // どうぶつ
    for (const a of world.animals) {
      const dir = viewDir(a.facing, view.rot)
      const [n, fps] = FRAMES[a.pose]
      const speed = a.pose === 'walk' ? speciesDef(a.species).speed / .6 : 1
      const frame = view.still ? 0 : Math.floor(a.anim * fps * speed) % n
      const img = this.animalSprite(a.species, a.pose, frame, dir)
      const water = isWater(world, Math.floor(a.x), Math.floor(a.z))
      const sink = water ? (a.species === 'hippo' ? .5 : a.species === 'penguin' ? (a.pose === 'swim' ? .12 : .25) : 0) : 0
      const hopY = Math.sin(Math.min(1, a.hop) * Math.PI) * .35
      items.push({ depth: depthOf(a.x, a.z, view.rot) + .01, draw: () => {
        const p = S(a.x, hopY - sink, a.z)
        if (sink > 0) {
          const [, wy] = S(a.x, 0, a.z)
          ctx.save()
          ctx.beginPath()
          ctx.rect(0, 0, w, Math.round(wy))
          ctx.clip()
          this.blit(ctx, img, p)
          ctx.restore()
          // なみの わ
          const ph = (t * 1.5 + a.id) % 1
          ctx.fillStyle = '#d8f4ff'
          const rw = Math.round(6 + ph * 4)
          ctx.fillRect(Math.round(p[0] - rw), Math.round(wy), rw * 2, 1)
          ctx.fillStyle = '#88c8ec'
          ctx.fillRect(Math.round(p[0] - rw + 2), Math.round(wy) + 1, rw * 2 - 4, 1)
        } else this.blit(ctx, img, p)
        if (img.canvas) {
          const x0 = Math.round(p[0] - img.ox), y0 = Math.round(p[1] - img.oy)
          this.hits.push({ kind: 'animal', id: a.id, x0: x0 - 2, y0: y0 - 2, x1: x0 + img.w + 2, y1: y0 + img.h + 2, depth: depthOf(a.x, a.z, view.rot) })
        }
      } })
    }

    // おきゃくさん
    for (const v of world.visitors) {
      const [x, z] = ringPoint(v.s)
      const [x2, z2] = ringPoint(v.s + v.dir * .1)
      let facing = Math.atan2(-(z2 - z), x2 - x)
      if (v.state === 'watch') facing = Math.atan2(-(GRID / 2 - z), GRID / 2 - x)
      const dir = viewDir(facing, view.rot)
      const walking = v.state !== 'watch'
      const frame = walking && !view.still ? Math.floor(v.anim * 6) % 4 : 0
      const img = this.sprite(`v|${v.seed % 12}|${frame}|${walking ? 1 : 0}|${dir}`, () => visitorModel(v.seed % 12, frame / 4, walking), dir * Math.PI / 4)
      items.push({ depth: depthOf(x, z, view.rot), draw: () => {
        ctx.globalAlpha = Math.max(0, Math.min(1, v.alpha))
        const p = S(x, 0, z)
        this.blit(ctx, img, p)
        ctx.globalAlpha = 1
        if (v.happy > 0 && Math.floor(t * 4) % 2 === 0) {
          const icon = iconCanvas('heart', this.icons)
          if (icon) ctx.drawImage(icon, Math.round(p[0] - 3), Math.round(p[1] - img.oy - 8))
        }
      } })
    }

    items.sort((a, b) => a.depth - b.depth)
    for (const it of items) it.draw()

    // ---- つぶ（ハート・ほこり など） ----
    for (const p of this.particles) {
      const [px, py] = S(p.x, p.y, p.z)
      const k = p.life / p.max
      if (p.kind === 'heart' || p.kind === 'note') {
        const icon = iconCanvas(p.kind, this.icons)
        if (icon && (k < .7 || Math.floor(p.life * 12) % 2)) ctx.drawImage(icon, Math.round(px - 3), Math.round(py - 3))
      } else if (p.kind === 'spark') {
        const icon = iconCanvas('sparkle', this.icons)
        if (icon && Math.floor(p.life * 16) % 2) ctx.drawImage(icon, Math.round(px - 2), Math.round(py - 2))
      } else {
        ctx.fillStyle = p.color ?? (p.kind === 'dust' ? '#e8e0cc' : p.kind === 'drop' ? '#a8e0ff' : '#b88a50')
        const s = p.kind === 'dust' ? (k < .5 ? 2 : 1) : 1
        ctx.fillRect(Math.round(px), Math.round(py), s, s)
      }
    }

    // ---- ふきだし ----
    for (const a of world.animals) if (a.bubble) this.drawBubble(ctx, view, a)

    // ---- 1日の いろ ----
    const sk = skyAt(world.clock)
    const tint = sk.tint
    if (tint[0] < 250 || tint[1] < 250 || tint[2] < 250) {
      // え が ある ところだけに いろを かける（そらには かけない）。
      const mask = this.ensureMask(w, h)
      if (mask) {
        mask.ctx.globalCompositeOperation = 'copy'
        mask.ctx.drawImage(layer.canvas, 0, 0)
        mask.ctx.globalCompositeOperation = 'source-in'
        mask.ctx.fillStyle = rgbCss(tint)
        mask.ctx.fillRect(0, 0, w, h)
        mask.ctx.globalCompositeOperation = 'source-over'
        ctx.globalCompositeOperation = 'multiply'
        ctx.drawImage(mask.canvas, 0, 0)
        ctx.globalCompositeOperation = 'source-over'
      }
    }
    const dark = Math.max(0, 1 - (tint[2] + tint[1]) / 400)
    if (dark > .15) {
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = Math.min(1, dark * 1.4)
      for (const o of world.objects) {
        if (o.kind !== 'lamp' || !this.glow) continue
        const [px, py] = S(o.x + .5, 1.02, o.z + .5)
        const flick = Math.sin(t * 9 + o.id) > .92 ? 1 : 0
        ctx.drawImage(this.glow, Math.round(px - 22), Math.round(py - 22 + flick))
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      // ホタル
      const flies = world.objects.filter(o => o.kind === 'bush' || o.kind === 'tree' || o.kind === 'flowers' || o.kind === 'pond')
      flies.forEach((o, i) => {
        for (let k = 0; k < 2; k++) {
          const ph = t * .4 + i * 1.7 + k * 3.1
          const x = o.x + .5 + Math.sin(ph) * .7, z = o.z + .5 + Math.cos(ph * 1.3) * .7, y = .4 + Math.sin(ph * 2.1) * .25
          if (Math.sin(t * 3 + i + k * 2) < .1) continue
          const [px, py] = S(x, y, z)
          ctx.fillStyle = '#f8ff90'
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1)
          ctx.fillStyle = 'rgb(200 255 120 / .45)'
          ctx.fillRect(Math.round(px) - 1, Math.round(py), 3, 1)
          ctx.fillRect(Math.round(px), Math.round(py) - 1, 1, 3)
        }
      })
    }

    // ---- そら と くもを うしろに ----
    out.imageSmoothingEnabled = false
    if (sky) out.drawImage(sky, 0, 0)
    else { out.fillStyle = '#6ab0e8'; out.fillRect(0, 0, w, h) }
    this.clouds.forEach((c, i) => {
      if (!c) return
      const x = ((t * (2 + i) + i * 190) % (w + 100)) - 80
      const y = 10 + i * 22
      out.globalAlpha = .9 * (1 - dark * .8)
      out.drawImage(c, Math.round(x), y)
      out.globalAlpha = 1
    })
    out.drawImage(layer.canvas, 0, 0)
  }

  private blit(ctx: CanvasRenderingContext2D, img: SpriteImage, [x, y]: [number, number], sway = 0) {
    if (!img.canvas) return
    if (sway) {
      // うえの ほうだけ ゆらす（かぜ）。
      const cut = Math.floor(img.h * .55)
      const s = Math.round(sway)
      ctx.drawImage(img.canvas, 0, 0, img.w, cut, Math.round(x - img.ox + s), Math.round(y - img.oy), img.w, cut)
      ctx.drawImage(img.canvas, 0, cut, img.w, img.h - cut, Math.round(x - img.ox), Math.round(y - img.oy) + cut, img.w, img.h - cut)
      return
    }
    ctx.drawImage(img.canvas, Math.round(x - img.ox), Math.round(y - img.oy))
  }

  private drawHover(ctx: CanvasRenderingContext2D, view: View, hover: Hover) {
    const size = hover.ghost?.kind === 'object' ? objectDef(hover.ghost.object).size : 1
    const blink = Math.floor(view.time * 4) % 2 === 0
    const color = hover.ok ? (blink ? '#ffffff' : '#fff6a0') : (blink ? '#ff5050' : '#ff9090')
    const corners: [number, number][] = [[hover.x, hover.z], [hover.x + size, hover.z], [hover.x + size, hover.z + size], [hover.x, hover.z + size]]
    const pts = corners.map(([x, z]) => this.screen(view, x, 0, z))
    ctx.fillStyle = color
    for (let k = 0; k < 4; k++) {
      const [x0, y0] = pts[k], [x1, y1] = pts[(k + 1) % 4]
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
      for (let s = 0; s <= n; s++) ctx.fillRect(Math.round(x0 + (x1 - x0) * s / n), Math.round(y0 + (y1 - y0) * s / n), 1, 1)
    }
    if (!hover.ok) {
      const [cx, cy] = this.screen(view, hover.x + size / 2, 0, hover.z + size / 2)
      const icon = iconCanvas('angry', this.icons)
      if (icon) ctx.drawImage(icon, Math.round(cx - 2), Math.round(cy - 2))
      return
    }
    const g = hover.ghost
    if (!g || g.kind === 'remove') return
    ctx.globalAlpha = .6
    const x = hover.x + size / 2, z = hover.z + size / 2
    if (g.kind === 'animal') this.blit(ctx, this.animalSprite(g.species, 'idle', 0, 7), this.screen(view, x, 0, z))
    else if (g.kind === 'object' && g.object !== 'pond') {
      this.blit(ctx, this.sprite(`o|${g.object}|1|${(4 - view.rot) % 4}`, () => objectModel(g.object, 1), ((4 - view.rot) % 4) * Math.PI / 2), this.screen(view, x, 0, z))
    } else if (g.kind === 'food') this.blit(ctx, this.sprite(`f|${g.food}|2`, () => scaleModel(foodModel(g.food, 1), FOOD_SCALE), Math.PI / 4), this.screen(view, x, 0, z))
    else if (g.kind === 'object' && g.object === 'pond') {
      ctx.fillStyle = '#58a0e0'
      const [cx, cy] = this.screen(view, x, 0, z)
      const n = objectDef('pond').size
      for (let yy = -n * 8; yy <= n * 8; yy++) {
        const half = Math.round((1 - Math.abs(yy) / (n * 8 + 1)) * n * 15)
        if ((yy & 1) === 0) ctx.fillRect(Math.round(cx - half), Math.round(cy + yy), half * 2, 1)
      }
    }
    ctx.globalAlpha = 1
  }

  private drawBubble(ctx: CanvasRenderingContext2D, view: View, a: Animal) {
    const img = this.animalSprite(a.species, a.pose, 0, viewDir(a.facing, view.rot))
    const [px, py] = this.screen(view, a.x, 0, a.z)
    const top = Math.round(py - img.oy - 4 - (a.bubble === 'zzz' ? 0 : Math.sin(view.time * 4) * 1))
    const cx = Math.round(px + 4)
    const bubble: Bubble = a.bubble!
    if (bubble === 'zzz') {
      const icon = iconCanvas('zzz', this.icons)
      const ph = (view.time * .7 + a.id * .3) % 1
      if (icon) ctx.drawImage(icon, cx, Math.round(top - 4 - ph * 4))
      return
    }
    if (bubble === 'heart' || bubble === 'note') {
      const icon = iconCanvas(bubble, this.icons)
      if (icon) ctx.drawImage(icon, cx - 3, top - 8)
      return
    }
    // しろい まるい まど
    const bw = 15, bh = 13
    const x0 = cx - 2, y0 = top - bh - 2
    ctx.fillStyle = '#2a2040'
    ctx.fillRect(x0 + 1, y0, bw - 2, bh)
    ctx.fillRect(x0, y0 + 1, bw, bh - 2)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x0 + 1, y0 + 1, bw - 2, bh - 2)
    ctx.fillStyle = '#d8d8f0'
    ctx.fillRect(x0 + 1, y0 + bh - 3, bw - 2, 1)
    ctx.fillStyle = '#2a2040'
    ctx.fillRect(x0 + 1, y0 + bh + 1, 2, 2)
    ctx.fillRect(x0 - 1, y0 + bh + 4, 1, 1)
    if (bubble === 'question' || bubble === 'angry') {
      const icon = iconCanvas(bubble, this.icons)
      if (icon) ctx.drawImage(icon, x0 + 5, y0 + 3)
      return
    }
    // たべたい もの
    const want = speciesDef(a.species).eats[0]
    const food = this.sprite(`f|${want}|icon`, () => foodModel(want), Math.PI / 4)
    if (food.canvas) ctx.drawImage(food.canvas, Math.round(x0 + bw / 2 - food.w / 2), Math.round(y0 + bh / 2 - food.h / 2))
  }
}

function pondIcon() {
  const made = makeCanvas(52, 28)
  if (!made) return null
  const { ctx } = made
  ctx.scale(2, 2)
  for (let y = 0; y < 14; y++) {
    const half = Math.round((1 - Math.abs(y - 6.5) / 7) * 13)
    for (let x = 13 - half; x < 13 + half; x++) {
      const edge = x === 13 - half || x === 13 + half - 1 || y === 0 || y === 13
      ctx.fillStyle = edge ? '#b4a088' : y < 5 ? '#58a0e0' : y < 9 ? '#3474c4' : '#24509e'
      ctx.fillRect(x, y, 1, 1)
    }
  }
  ctx.fillStyle = '#b0e4f8'
  ctx.fillRect(9, 4, 3, 1)
  ctx.fillRect(15, 8, 2, 1)
  try { return made.canvas.toDataURL() } catch { return null }
}

export { SPECIES }
