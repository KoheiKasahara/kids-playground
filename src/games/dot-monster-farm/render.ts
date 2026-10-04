// ちいさな ドットの キャンバス（よこ 160 くらい）に ばめんを えがいて、整数ばいで おおきく うつす。
// ぼくじょう・とっくん・たいかい・いしの まつり（よびだし）の 4つの ばめんと、つぶ（こうか）を もつ。

import type { Battle, Fighter, Shot } from './battle'
import { ARENA_W } from './battle'
import type { DrillId, Grade, Season } from './farm'
import type { FxKind, Monster, SnackId, SpeciesId } from './monsters'
import { speciesById } from './monsters'
import { bayer, ditherIndex, hash2, makeCanvas, type Img } from './pixel'
import { iconImage, monsterImage, monsterTinted, snackImage, stoneImage, type Expr, type IconId } from './sprites'

export const SPRITE = 24

/** canvas の 大きさから ドットの かずと ばいりつを きめる。 */
export function viewSize(cssW: number, cssH: number, dpr: number, minW = 150, minH = 112) {
  const dw = Math.max(1, Math.round(cssW * dpr)), dh = Math.max(1, Math.round(cssH * dpr))
  const scale = Math.max(1, Math.floor(Math.min(dw / minW, dh / minH)))
  return { w: Math.ceil(dw / scale), h: Math.ceil(dh / scale), scale, dw, dh }
}

export type View = ReturnType<typeof viewSize>

/** ドットを かく ための ちいさな キャンバス。 */
export class Buffer {
  canvas: Img | null = null
  g: CanvasRenderingContext2D | null = null
  w = 0
  h = 0
  ensure(w: number, h: number) {
    if (this.canvas && this.w === w && this.h === h) return this.g
    const made = makeCanvas(w, h)
    this.canvas = made?.canvas ?? null
    this.g = made?.ctx ?? null
    this.w = w
    this.h = h
    return this.g
  }
}

// ---------------- どうぐ ----------------

type G = CanvasRenderingContext2D

function rect(g: G, x: number, y: number, w: number, h: number, color: string) {
  g.fillStyle = color
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

/** たての グラデーション（ベイヤーで まぜる）。 */
function gradient(g: G, x: number, y: number, w: number, h: number, colors: readonly string[]) {
  for (let yy = 0; yy < h; yy++) {
    const t = h <= 1 ? 0 : yy / (h - 1)
    for (let xx = 0; xx < w; xx += 4) {
      for (let k = 0; k < 4 && xx + k < w; k++) {
        g.fillStyle = colors[ditherIndex(t, colors.length, x + xx + k, y + yy)]
        g.fillRect(x + xx + k, y + yy, 1, 1)
      }
    }
  }
}

function draw(g: G, img: Img | null, x: number, y: number, flip = false, alpha = 1) {
  if (!img) return
  if (alpha < 1) g.globalAlpha = Math.max(0, alpha)
  if (flip) {
    g.save()
    g.scale(-1, 1)
    g.drawImage(img, -Math.round(x) - img.width, Math.round(y))
    g.restore()
  } else g.drawImage(img, Math.round(x), Math.round(y))
  g.globalAlpha = 1
}

function ellipse(g: G, cx: number, cy: number, rx: number, ry: number, color: string) {
  g.fillStyle = color
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + .01))))
    g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1)
  }
}

function shadow(g: G, cx: number, y: number, rx = 8) {
  g.fillStyle = 'rgba(20, 30, 20, .28)'
  g.fillRect(Math.round(cx - rx), Math.round(y), rx * 2, 2)
  g.fillRect(Math.round(cx - rx + 2), Math.round(y - 1), rx * 2 - 4, 1)
  g.fillRect(Math.round(cx - rx + 2), Math.round(y + 2), rx * 2 - 4, 1)
}

// 3×5 の ちいさな もじ（すうじ と すこしの アルファベット）。
const FONT: Record<string, string> = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  '+': '000010111010000', '!': '010010010000010', '?': '111001011000010', A: '010101111101101', B: '110101110101110',
  C: '011100100100011', D: '110101101101110', E: '111100110100111', S: '011100010001110', '-': '000000111000000',
}

export function textWidth(text: string, size = 1) {
  return text.length * 4 * size - size
}

/** ふちどり つきの ちいさな もじ。 */
export function pixelText(g: G, text: string, x: number, y: number, color: string, size = 1, edge = '#1c1428') {
  const put = (ox: number, oy: number, c: string) => {
    g.fillStyle = c
    let cx = Math.round(x)
    for (const ch of text) {
      const bits = FONT[ch]
      if (bits) for (let i = 0; i < 15; i++) if (bits[i] === '1') g.fillRect(cx + (i % 3) * size + ox, Math.round(y) + Math.floor(i / 3) * size + oy, size, size)
      cx += 4 * size
    }
  }
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) put(ox, oy, edge)
  put(0, 0, color)
}

// ---------------- つぶ（こうか） ----------------

export type ParticleKind = 'heart' | 'note' | 'spark' | 'dust' | 'zzz' | 'sweat' | 'star' | 'petal' | 'leaf' | 'snow' | 'drop' | 'num' | 'ring' | 'confetti' | 'chunk' | 'q' | 'bang' | 'crumb'

export type Particle = {
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  text?: string
  size?: number
  gravity?: number
}

export type Fx = { list: Particle[] }

export function createFx(): Fx {
  return { list: [] }
}

export function addFx(fx: Fx, p: Omit<Particle, 'max'> & { max?: number }) {
  if (fx.list.length > 220) fx.list.shift()
  fx.list.push({ ...p, max: p.max ?? p.life })
}

export function burst(fx: Fx, kind: ParticleKind, x: number, y: number, n: number, colors: readonly string[], speed = 40, life = .6, random = Math.random) {
  for (let i = 0; i < n; i++) {
    const a = random() * Math.PI * 2
    const s = speed * (.4 + random() * .8)
    addFx(fx, { kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * .3, life: life * (.7 + random() * .6), color: colors[i % colors.length], gravity: kind === 'chunk' || kind === 'confetti' || kind === 'crumb' ? 120 : kind === 'drop' ? 160 : 0 })
  }
}

export function updateFx(fx: Fx, dt: number) {
  for (const p of fx.list) {
    p.life -= dt
    p.vy += (p.gravity ?? 0) * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    if (p.kind === 'petal' || p.kind === 'leaf' || p.kind === 'snow') p.x += Math.sin(p.life * 3 + p.max * 7) * 6 * dt
  }
  fx.list = fx.list.filter(p => p.life > 0)
}

const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...']
const NOTE = ['..##', '..#.', '..#.', '###.', '##..']
const ZZZ = ['####', '..#.', '.#..', '####']
const QMARK = ['.##.', '#..#', '..#.', '.#..', '....', '.#..']
const BANG = ['#', '#', '#', '.', '#']

function glyph(g: G, rows: readonly string[], x: number, y: number, color: string, edge?: string) {
  if (edge) {
    g.fillStyle = edge
    rows.forEach((r, yy) => [...r].forEach((c, xx) => { if (c === '#') g.fillRect(Math.round(x) + xx - 1, Math.round(y) + yy - 1, 3, 3) }))
  }
  g.fillStyle = color
  rows.forEach((r, yy) => [...r].forEach((c, xx) => { if (c === '#') g.fillRect(Math.round(x) + xx, Math.round(y) + yy, 1, 1) }))
}

export function drawFx(g: G, fx: Fx) {
  for (const p of fx.list) {
    const t = p.life / p.max
    const x = Math.round(p.x), y = Math.round(p.y)
    switch (p.kind) {
      case 'heart': glyph(g, HEART, x - 3, y - 3, p.color, '#5a0c24'); break
      case 'note': glyph(g, NOTE, x - 2, y - 2, p.color, '#1c1428'); break
      case 'zzz': glyph(g, ZZZ, x, y, p.color, '#1c2450'); break
      case 'q': glyph(g, QMARK, x, y, p.color, '#1c1428'); break
      case 'bang': glyph(g, BANG, x, y, p.color, '#1c1428'); break
      case 'num': pixelText(g, p.text ?? '', x - textWidth(p.text ?? '', p.size ?? 1) / 2, y, p.color, p.size ?? 1); break
      case 'ring': {
        const r = Math.round((1 - t) * (p.size ?? 14)) + 2
        g.fillStyle = p.color
        for (let a = 0; a < 16; a++) g.fillRect(Math.round(x + Math.cos(a / 16 * Math.PI * 2) * r), Math.round(y + Math.sin(a / 16 * Math.PI * 2) * r * .7), 1, 1)
        break
      }
      case 'spark': case 'star': {
        rect(g, x, y, 1, 1, p.color)
        if (t > .4) { rect(g, x - 1, y, 3, 1, p.color); rect(g, x, y - 1, 1, 3, p.color) }
        if (p.kind === 'star' && t > .6) { rect(g, x - 2, y, 5, 1, p.color); rect(g, x, y - 2, 1, 5, p.color) }
        break
      }
      case 'sweat': rect(g, x, y, 1, 2, p.color); rect(g, x - 1, y + 1, 1, 1, p.color); break
      case 'dust': rect(g, x - 1, y - 1, t > .5 ? 3 : 2, t > .5 ? 3 : 2, p.color); break
      case 'chunk': rect(g, x - 1, y - 1, 3, 3, p.color); rect(g, x - 1, y + 1, 3, 1, '#2a2a34'); break
      case 'leaf': case 'petal': rect(g, x, y, 2, 1, p.color); rect(g, x + (Math.sin(p.life * 8) > 0 ? 1 : 0), y + 1, 1, 1, p.color); break
      default: rect(g, x, y, p.kind === 'confetti' ? 2 : 1, 1, p.color)
    }
  }
}

// ---------------- モンスター ----------------

export type Pose = {
  expr?: Expr
  /** うえへの ずれ（ジャンプ）。 */
  lift?: number
  dx?: number
  flash?: boolean
  alpha?: number
  /** よこに たおれる（-1 / 1）。 */
  fallen?: -1 | 1
  /** かげを かかない。 */
  noShadow?: boolean
}

/** モンスターを えがく。x は まんなか、ground は あしもと。 */
export function drawMonster(g: G, monster: Pick<Monster, 'species' | 'variant'>, x: number, ground: number, time: number, pose: Pose = {}) {
  const species = speciesById(monster.species)
  const float = species?.floats ? 3 + Math.round(Math.sin(time * 3) * 1.5) : 0
  const lift = Math.max(0, pose.lift ?? 0) + float
  if (!pose.noShadow) shadow(g, x + (pose.dx ?? 0), ground - 1, Math.max(4, 8 - Math.round(lift / 4)))
  const img = pose.flash ? monsterTinted(monster.species, monster.variant, '#ffffff', pose.expr) : monsterImage(monster.species, monster.variant, pose.expr)
  if (!img) return
  const left = Math.round(x - SPRITE / 2 + (pose.dx ?? 0))
  const top = Math.round(ground - SPRITE + 1 - lift)
  if (pose.fallen) {
    g.save()
    g.translate(left + SPRITE / 2, ground - SPRITE / 2 + 5)
    g.rotate(pose.fallen * Math.PI / 2)
    g.drawImage(img, -SPRITE / 2, -SPRITE / 2)
    g.restore()
    return
  }
  draw(g, img, left, top, false, pose.alpha ?? 1)
}

// ---------------- ぼくじょう ----------------

type SeasonLook = {
  sky: readonly string[]
  hills: readonly [string, string]
  far: string
  grass: readonly [string, string, string]
  leaf: readonly [string, string, string]
  bloom: readonly string[]
  fall: ParticleKind | null
  fallColors: readonly string[]
}

const SEASONS: Record<Season, SeasonLook> = {
  spring: {
    sky: ['#6cb8f4', '#8ccaf8', '#b4def8', '#d8f0fc'], hills: ['#8ad07a', '#6ab85a'], far: '#a8d8c0',
    grass: ['#5ab040', '#78c850', '#a0e070'], leaf: ['#e888a8', '#ffb0c8', '#ffe0ec'], bloom: ['#ffffff', '#ffd040', '#ff90b0'],
    fall: 'petal', fallColors: ['#ffc0d4', '#ffe0ec'],
  },
  summer: {
    sky: ['#2e8ef0', '#4aa8f4', '#7cc4f8', '#b8e4fc'], hills: ['#4aa848', '#2e8a3a'], far: '#7ab8a0',
    grass: ['#348a2c', '#4cb03c', '#7cd060'], leaf: ['#2a7a2a', '#3a9a3a', '#6ac850'], bloom: ['#ffd820', '#ff7040', '#ffffff'],
    fall: null, fallColors: [],
  },
  autumn: {
    sky: ['#6aa8e0', '#9cc0e0', '#e8c8a0', '#f8dcb0'], hills: ['#c89048', '#a87038'], far: '#c8a888',
    grass: ['#88903a', '#a8b048', '#c8c868'], leaf: ['#c8481c', '#f08030', '#ffc050'], bloom: ['#f0a030', '#c84820', '#fff0a0'],
    fall: 'leaf', fallColors: ['#f08030', '#ffc050', '#c8481c'],
  },
  winter: {
    sky: ['#90b4dc', '#a8c8e8', '#c8dcf0', '#e8f0f8'], hills: ['#e8f0f8', '#c8d8e8'], far: '#d8e4f0',
    grass: ['#c8d4e4', '#e4ecf6', '#ffffff'], leaf: ['#c8d4e4', '#e8f0f8', '#ffffff'], bloom: ['#ffffff', '#e8f0ff', '#d0e0f8'],
    fall: 'snow', fallColors: ['#ffffff', '#e8f0ff'],
  },
}

function cloud(g: G, x: number, y: number, size: number, color: string, shade: string) {
  ellipse(g, x, y + 1, size * 2, size * .55, shade)
  ellipse(g, x, y, size * 2, size * .5, color)
  ellipse(g, x - size * .8, y - size * .3, size * .9, size * .55, color)
  ellipse(g, x + size * .5, y - size * .5, size, size * .7, color)
}

function hillLine(g: G, w: number, base: number, amp: number, seed: number, color: string, phase = 0) {
  g.fillStyle = color
  for (let x = 0; x < w; x++) {
    const n = Math.sin((x + phase) / 23 + seed) * .6 + Math.sin((x + phase) / 9.7 + seed * 2) * .25 + Math.sin((x + phase) / 51 + seed * 3) * .8
    const top = Math.round(base - amp * (.5 + n * .35))
    g.fillRect(x, top, 1, base - top + 40)
  }
}

function tree(g: G, x: number, ground: number, look: SeasonLook, season: Season, sway: number) {
  rect(g, x - 2, ground - 16, 4, 16, '#6a4024')
  rect(g, x - 2, ground - 16, 1, 16, '#8a5a34')
  rect(g, x + 1, ground - 16, 1, 16, '#4a2a14')
  if (season === 'winter') {
    // はだかの えだに ゆき。
    rect(g, x - 6, ground - 20, 5, 1, '#6a4024'); rect(g, x + 2, ground - 22, 5, 1, '#6a4024')
    rect(g, x - 1, ground - 26, 2, 10, '#6a4024')
    rect(g, x - 6, ground - 21, 5, 1, '#ffffff'); rect(g, x + 2, ground - 23, 5, 1, '#ffffff'); rect(g, x - 1, ground - 27, 2, 1, '#ffffff')
    return
  }
  const cx = x + Math.round(sway)
  ellipse(g, cx, ground - 24, 11, 8, look.leaf[0])
  ellipse(g, cx - 1, ground - 25, 10, 7, look.leaf[1])
  ellipse(g, cx - 3, ground - 28, 6, 4, look.leaf[2])
  for (let i = 0; i < 9; i++) {
    const px = cx - 9 + Math.floor(hash2(i, 3, x) * 18), py = ground - 31 + Math.floor(hash2(i, 5, x) * 13)
    rect(g, px, py, 1, 1, i % 3 ? look.leaf[2] : look.leaf[0])
  }
  if (season === 'summer') for (let i = 0; i < 3; i++) rect(g, cx - 6 + i * 5, ground - 22 + (i % 2) * 3, 2, 2, '#e83c40')
}

function barn(g: G, x: number, ground: number, season: Season, rank: string, lit: boolean) {
  const w = 34, h = 22
  // かべ
  rect(g, x, ground - h, w, h, '#b83428')
  for (let i = 2; i < w; i += 4) rect(g, x + i, ground - h, 1, h, '#9a2a20')
  rect(g, x, ground - h, w, 1, '#f0e0c8')
  // やね
  for (let i = 0; i < 12; i++) rect(g, x - 3 + i, ground - h - i, w + 6 - i * 2, 1, season === 'winter' ? (i < 3 ? '#c8d8e8' : '#ffffff') : i < 2 ? '#4a1c14' : '#6a2c1c')
  rect(g, x + w / 2 - 1, ground - h - 12, 2, 1, season === 'winter' ? '#ffffff' : '#4a1c14')
  // と
  rect(g, x + 11, ground - 14, 12, 14, '#f0e0c8')
  rect(g, x + 12, ground - 13, 10, 13, '#7a2c1c')
  rect(g, x + 12, ground - 13, 10, 1, '#f0e0c8')
  for (let i = 0; i < 10; i++) { rect(g, x + 12 + i, ground - 13 + i, 1, 1, '#f0e0c8'); rect(g, x + 21 - i, ground - 13 + i, 1, 1, '#f0e0c8') }
  // まど
  rect(g, x + 3, ground - 17, 6, 5, '#3a1810')
  rect(g, x + 4, ground - 16, 4, 3, lit ? '#ffe070' : '#7ac0f0')
  rect(g, x + 25, ground - 17, 6, 5, '#3a1810')
  rect(g, x + 26, ground - 16, 4, 3, lit ? '#ffe070' : '#7ac0f0')
  // ランクの かんばん
  rect(g, x + w + 4, ground - 12, 1, 12, '#6a4024')
  rect(g, x + w + 1, ground - 19, 9, 8, '#6a4024')
  rect(g, x + w + 2, ground - 18, 7, 6, '#f8e8c0')
  pixelText(g, rank, x + w + 4, ground - 18, '#c03020', 1, '#f8e8c0')
}

function fence(g: G, w: number, y: number, season: Season) {
  const wood = season === 'winter' ? ['#8a6a4a', '#a8865e'] : ['#9a6a3a', '#c8945a']
  rect(g, 0, y + 2, w, 2, wood[0])
  rect(g, 0, y + 2, w, 1, wood[1])
  rect(g, 0, y + 7, w, 2, wood[0])
  rect(g, 0, y + 7, w, 1, wood[1])
  for (let x = 4; x < w; x += 14) {
    rect(g, x, y, 3, 12, wood[0])
    rect(g, x, y, 1, 12, wood[1])
    if (season === 'winter') rect(g, x, y - 1, 3, 1, '#ffffff')
  }
}

export type RanchActor = {
  monster: Pick<Monster, 'species' | 'variant'>
  x: number
  /** おくゆき（0=おく 〜 1=てまえ）。 */
  z: number
  dir: 1 | -1
  mode: 'walk' | 'idle' | 'hop' | 'sleep' | 'eat'
  t: number
  tx: number
  tz: number
  blink: number
  hops: number
  /** よろこびの ジャンプの のこり かず。 */
}

export function createActor(monster: Pick<Monster, 'species' | 'variant'>, x: number, z = .5): RanchActor {
  return { monster, x, z, dir: 1, mode: 'idle', t: 0, tx: x, tz: z, blink: 2, hops: 0 }
}

/** ぼくじょうの じめんの たかさ。 */
export function ranchGround(h: number) {
  return { top: Math.round(h * .62), bottom: h - 6 }
}

export function actorGround(a: RanchActor, h: number) {
  const { top, bottom } = ranchGround(h)
  return Math.round(top + 16 + (bottom - top - 16) * a.z)
}

/** ぼくじょうの モンスターを うごかす。 */
export function updateActor(a: RanchActor, dt: number, w: number, random: () => number, tired: boolean) {
  a.t += dt
  a.blink -= dt
  if (a.blink < -.14) a.blink = 1.5 + random() * 3
  const margin = 16
  a.x = Math.max(margin, Math.min(w - margin, a.x))
  if (a.mode === 'sleep' || a.mode === 'eat') return
  if (a.mode === 'hop') {
    if (a.t > .42) { a.hops--; a.t = 0; if (a.hops <= 0) a.mode = 'idle' }
    return
  }
  if (a.mode === 'walk') {
    const speed = tired ? 10 : 20
    const dx = a.tx - a.x, dz = a.tz - a.z
    const dist = Math.hypot(dx, dz * 30)
    if (dist < 1) { a.mode = 'idle'; a.t = 0; return }
    a.dir = dx >= 0 ? 1 : -1
    a.x += dx / dist * speed * dt
    a.z += dz / dist * speed * dt / 30
    return
  }
  // idle → ときどき あるく。
  if (a.t > (tired ? 3.5 : 1.6) + random() * 2) {
    a.mode = 'walk'
    a.t = 0
    a.tx = margin + random() * (w - margin * 2)
    a.tz = .15 + random() * .8
  }
}

export function hopActor(a: RanchActor, hops = 3) {
  a.mode = 'hop'
  a.hops = hops
  a.t = 0
}

/** ぼくじょうの モンスターに さわったか（ドットの ざひょう）。 */
export function hitActor(a: RanchActor, h: number, x: number, y: number) {
  const ground = actorGround(a, h)
  return Math.abs(x - a.x) <= 14 && y <= ground + 3 && y >= ground - SPRITE - 4
}

function actorPose(a: RanchActor, tired: boolean): { pose: Pose; extraLift: number } {
  if (a.mode === 'sleep') return { pose: { expr: 'blink' }, extraLift: 0 }
  if (a.mode === 'eat') return { pose: { expr: Math.floor(a.t * 6) % 2 ? 'happy' : 'blink' }, extraLift: Math.floor(a.t * 6) % 2 }
  if (a.mode === 'hop') {
    const p = Math.min(1, a.t / .42)
    return { pose: { expr: 'happy' }, extraLift: Math.round(Math.sin(p * Math.PI) * 9) }
  }
  const expr: Expr = a.blink < 0 ? 'blink' : tired ? 'tired' : 'normal'
  const bob = a.mode === 'walk' ? (Math.floor(a.t * 8) % 2) : (Math.floor(a.t * 2) % 2)
  return { pose: { expr }, extraLift: bob }
}

export type RanchOptions = {
  season: Season
  time: number
  rank: string
  /** よる（0〜1）。やすむ ときに くらく なる。 */
  night?: number
  actors: readonly RanchActor[]
  tired?: boolean
  fx: Fx
  /** おやつ（たべている あいだ まえに おく）。 */
  snack?: SnackId | null
}

/** ぼくじょうの ばめん。 */
export function drawRanch(g: G, w: number, h: number, o: RanchOptions) {
  const look = SEASONS[o.season]
  const { top: groundTop } = ranchGround(h)
  gradient(g, 0, 0, w, groundTop, look.sky)
  // おひさま
  if (o.season !== 'winter' && (o.night ?? 0) < .4) {
    ellipse(g, w - 26, 16, 7, 7, '#fff4b0')
    ellipse(g, w - 26, 16, 5, 5, '#ffffff')
  }
  // くも
  for (let i = 0; i < 3; i++) {
    const cx = ((i * 71 + o.time * (3 + i)) % (w + 60)) - 30
    cloud(g, cx, 12 + i * 9, 5 + (i % 2) * 2, '#ffffff', o.season === 'autumn' ? '#f0d8c8' : '#d8ecf8')
  }
  hillLine(g, w, groundTop - 4, 20, 1.3, look.far)
  hillLine(g, w, groundTop + 1, 12, 4.1, look.hills[0], 40)
  hillLine(g, w, groundTop + 3, 6, 7.7, look.hills[1], 90)
  // じめん
  rect(g, 0, groundTop, w, h - groundTop, look.grass[1])
  for (let y = groundTop; y < h; y++) {
    for (let x = (y * 3) % 5; x < w; x += 5) {
      const v = hash2(x, y, 7)
      if (v < .18) rect(g, x, y, 1, 1, look.grass[0])
      else if (v > .9) rect(g, x, y, 1, 1, look.grass[2])
    }
  }
  // みち
  for (let y = groundTop + 4; y < h; y++) {
    const cx = w * .3 + (y - groundTop) * .9
    const half = 4 + (y - groundTop) * .25
    for (let x = Math.floor(cx - half); x < cx + half; x++) {
      rect(g, x, y, 1, 1, o.season === 'winter' ? (bayer(x, y) > .5 ? '#d8e0ec' : '#e8eef6') : bayer(x, y) > .55 ? '#c8a070' : '#e0bc88')
    }
  }
  fence(g, w, groundTop - 6, o.season)
  barn(g, 8, groundTop + 6, o.season, o.rank, (o.night ?? 0) > .4)
  tree(g, w - 22, groundTop + 8, look, o.season, Math.sin(o.time * 1.3) * .6)
  // はな・くさ
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash2(i, 1, 3) * w), y = groundTop + 6 + Math.floor(hash2(i, 2, 3) * (h - groundTop - 8))
    if (Math.abs(x - (w * .3 + (y - groundTop) * .9)) < 8) continue
    const c = look.bloom[i % look.bloom.length]
    if (o.season === 'winter') { rect(g, x, y, 3, 1, '#ffffff'); continue }
    rect(g, x, y + 1, 1, 2, look.grass[0])
    rect(g, x - 1, y, 3, 1, c)
    rect(g, x, y - 1, 1, 3, c)
    rect(g, x, y, 1, 1, o.season === 'autumn' ? '#6a3010' : '#ffe060')
  }
  // まう はなびら・はっぱ・ゆき
  if (look.fall) {
    const n = look.fall === 'snow' ? 26 : 10
    for (let i = 0; i < n; i++) {
      const sp = 8 + hash2(i, 9, 1) * 10
      const x = (hash2(i, 4, 1) * (w + 20) + Math.sin(o.time * .9 + i) * 8 + o.time * (look.fall === 'snow' ? 3 : 10)) % (w + 20) - 10
      const y = (hash2(i, 5, 1) * h + o.time * sp) % (h + 10) - 5
      const c = look.fallColors[i % look.fallColors.length]
      if (look.fall === 'snow') rect(g, x, y, i % 3 ? 1 : 2, i % 3 ? 1 : 2, c)
      else { rect(g, x, y, 2, 1, c); rect(g, x + (Math.sin(o.time * 4 + i) > 0 ? 1 : 0), y + 1, 1, 1, c) }
    }
  }
  // モンスター（おくから じゅんに）
  const sorted = [...o.actors].sort((a, b) => a.z - b.z)
  for (const a of sorted) {
    const ground = actorGround(a, h)
    const { pose, extraLift } = actorPose(a, !!o.tired)
    if (a === o.actors[0] && o.snack && a.mode === 'eat') draw(g, snackImage(o.snack), a.x + 8, ground - 11)
    drawMonster(g, a.monster, a.x, ground, o.time + a.x, { ...pose, lift: extraLift })
    if (a.mode === 'sleep' && Math.floor(o.time * 2) % 3 === 0 && o.fx.list.filter(p => p.kind === 'zzz').length < 3 && hash2(Math.floor(o.time * 2), 0, 3) > .5) {
      addFx(o.fx, { kind: 'zzz', x: a.x + 6, y: ground - 26, vx: 6, vy: -10, life: 1.4, color: '#ffffff' })
    }
  }
  drawFx(g, o.fx)
  const night = o.night ?? 0
  if (night > 0) {
    g.fillStyle = `rgba(20, 24, 70, ${night * .62})`
    g.fillRect(0, 0, w, h)
    if (night > .5) {
      for (let i = 0; i < 24; i++) {
        const x = Math.floor(hash2(i, 1, 9) * w), y = Math.floor(hash2(i, 2, 9) * groundTop * .9)
        if (Math.sin(o.time * 3 + i) > -.4) rect(g, x, y, 1, 1, '#fff8d0')
      }
      draw(g, iconImage('moon'), 20, 8)
    }
  }
}

// ---------------- とっくん ----------------

export const TRAIN_DOING = 2.8

/** とっくんの じめんの たかさ（たてながの 画面では まんなかより すこし した）。 */
export function trainGround(h: number) {
  return Math.min(h - Math.max(22, Math.round(h * .3)), Math.round(h * .5 + 40))
}
export const TRAIN_RESULT = 1.4

const DRILL_BG: Record<DrillId, { sky: readonly string[]; ground: readonly [string, string, string] }> = {
  rock: { sky: ['#e8a868', '#f0c890', '#f8e0b8'], ground: ['#8a6440', '#a87c50', '#c89a68'] },
  study: { sky: ['#c89868', '#d8aa78', '#e8c090'], ground: ['#7a4c2c', '#9a6438', '#b87c48'] },
  run: { sky: ['#4aa8f4', '#7cc4f8', '#b8e4fc'], ground: ['#c05a30', '#d8704a', '#e88a60'] },
  fall: { sky: ['#5a9ad0', '#88c0e8', '#c0e0f8'], ground: ['#4a5a5a', '#6a7a78', '#8a9a98'] },
  pull: { sky: ['#78c0f0', '#a8d8f8', '#d8f0fc'], ground: ['#5aa040', '#78c050', '#98d870'] },
}

function boulder(g: G, cx: number, ground: number, cracks: number, shake: number) {
  const x = cx + shake
  ellipse(g, x, ground - 13, 15, 12, '#4a4a58')
  ellipse(g, x, ground - 13, 14, 11, '#8a8a98')
  ellipse(g, x - 3, ground - 16, 9, 7, '#a8a8b8')
  ellipse(g, x - 6, ground - 19, 3, 2, '#d0d0dc')
  rect(g, x - 15, ground - 1, 30, 1, '#4a4a58')
  const lines = [[[0, -22], [-2, -17], [1, -13], [-1, -8]], [[6, -20], [4, -15], [8, -11]], [[-8, -18], [-5, -12], [-9, -6]], [[3, -6], [0, -2], [5, -1]]]
  for (let i = 0; i < Math.min(cracks, lines.length); i++) {
    const pts = lines[i]
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1]
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay))
      for (let s = 0; s <= n; s++) rect(g, x + Math.round(ax + (bx - ax) * s / n), ground + Math.round(ay + (by - ay) * s / n), 1, 1, '#2a2a34')
    }
  }
}

function blackboard(g: G, w: number, ground: number, t: number) {
  const bw = Math.min(70, w - 40), bx = Math.round((w - bw) / 2), by = Math.max(10, ground - 74)
  rect(g, bx - 2, by - 2, bw + 4, 34, '#8a5a30')
  rect(g, bx, by, bw, 30, '#2a5a40')
  rect(g, bx, by, bw, 1, '#3a7a58')
  pixelText(g, '1+2', bx + 6, by + 6, '#ffffff', 1, '#2a5a40')
  pixelText(g, 'ABC', bx + 6, by + 16, '#ffe080', 1, '#2a5a40')
  // チョークで かく
  const n = Math.floor(t * 4) % 6
  for (let i = 0; i < n; i++) rect(g, bx + 34 + i * 4, by + 10 + (i % 2) * 2, 3, 1, '#ffffff')
  rect(g, bx + bw - 14, by + 31, 10, 2, '#c8c0b0')
  // たな
  rect(g, 4, ground - 30, 22, 3, '#6a4024')
  for (let i = 0; i < 4; i++) rect(g, 6 + i * 5, ground - 39, 4, 9, ['#d84a5a', '#4a8ae0', '#f0c030', '#5ab848'][i])
}

function track(g: G, w: number, ground: number, h: number, scroll: number) {
  // とおくの かんきゃくせき
  rect(g, 0, ground - 26, w, 12, '#8a8aa8')
  for (let x = 0; x < w; x += 3) for (let y = 0; y < 3; y++) {
    const v = hash2(x + Math.floor(scroll * .2), y, 4)
    rect(g, x, ground - 25 + y * 4, 2, 2, v > .66 ? '#f06a5a' : v > .33 ? '#ffe070' : '#7ac0f0')
  }
  rect(g, 0, ground - 14, w, 3, '#5a5a78')
  rect(g, 0, ground - 11, w, h - ground + 11, '#d8704a')
  for (let i = 0; i < 3; i++) rect(g, 0, ground - 4 + i * 8, w, 1, '#ffffff')
  for (let x = -((scroll * 2) % 24); x < w; x += 24) rect(g, Math.round(x), ground + 1, 8, 2, '#f8f0e8')
  for (let x = -((scroll) % 40); x < w; x += 40) { rect(g, Math.round(x), ground - 18, 2, 8, '#ffffff'); rect(g, Math.round(x) + 2, ground - 18, 5, 3, '#f04040') }
}

function waterfall(g: G, w: number, ground: number, t: number, cx: number) {
  rect(g, 0, 0, w, ground, '#5a6a6a')
  for (let y = 0; y < ground; y += 3) for (let x = 0; x < w; x += 4) {
    const v = hash2(x, y, 2)
    if (v > .7) rect(g, x, y, 3, 2, '#4a5858')
    else if (v < .15) rect(g, x, y, 2, 1, '#7a8a88')
  }
  const left = cx - 16, width = 32
  rect(g, left, 0, width, ground + 4, '#4aa0e0')
  for (let x = 0; x < width; x++) {
    const speed = 90 + hash2(x, 0, 5) * 40
    for (let k = 0; k < 3; k++) {
      const y = ((t * speed + hash2(x, k, 6) * 200) % (ground + 20)) - 10
      rect(g, left + x, y, 1, 6, k ? '#9ad8ff' : '#ffffff')
    }
  }
  rect(g, left - 1, 0, 1, ground, '#2a6aa0')
  rect(g, left + width, 0, 1, ground, '#2a6aa0')
  // たきつぼ
  ellipse(g, cx, ground + 4, 26, 4, '#5ab8f0')
  for (let i = 0; i < 10; i++) {
    const a = t * 6 + i * 1.7
    rect(g, cx + Math.cos(a) * (14 + i), ground + 1 - Math.abs(Math.sin(a)) * 5, 2, 1, '#ffffff')
  }
}

function hill(g: G, w: number, ground: number, scroll: number, look: readonly [string, string, string]) {
  for (let x = 0; x < w; x++) {
    const v = hash2(x + Math.floor(scroll), 0, 8)
    if (v > .8) rect(g, x, ground + 2 + Math.floor(v * 10), 1, 1, look[0])
  }
  for (let x = -((scroll * 1.5) % 30); x < w; x += 30) {
    rect(g, Math.round(x), ground - 6, 1, 6, '#3a7a30')
    rect(g, Math.round(x) - 1, ground - 4, 3, 1, '#3a7a30')
  }
}

function logProp(g: G, x: number, ground: number) {
  rect(g, x - 16, ground - 9, 30, 9, '#7a4420')
  rect(g, x - 16, ground - 9, 30, 2, '#a8683a')
  for (let i = 0; i < 4; i++) rect(g, x - 12 + i * 7, ground - 6, 4, 1, '#5a3014')
  ellipse(g, x + 14, ground - 5, 3, 4, '#f0d090')
  rect(g, x + 14, ground - 6, 1, 2, '#a8683a')
}

export type TrainView = {
  drill: DrillId
  monster: Pick<Monster, 'species' | 'variant'>
  /** はじまってからの じかん（びょう）。 */
  t: number
  grade: Grade | null
  /** おうえんの つよさ（0〜1）。 */
  cheer: number
  fx: Fx
}

/** とっくんの ばめん。 */
export function drawTraining(g: G, w: number, h: number, v: TrainView) {
  const bg = DRILL_BG[v.drill]
  const ground = trainGround(h)
  gradient(g, 0, 0, w, ground, bg.sky)
  rect(g, 0, ground, w, h - ground, bg.ground[1])
  for (let y = ground; y < h; y++) for (let x = (y * 2) % 4; x < w; x += 4) {
    const r = hash2(x, y, 3)
    if (r > .85) rect(g, x, y, 1, 1, bg.ground[2])
    else if (r < .12) rect(g, x, y, 1, 1, bg.ground[0])
  }
  const doing = v.t < TRAIN_DOING
  const rt = v.t - TRAIN_DOING
  const cx = Math.round(w / 2)
  let mx = cx - 14, lift = 0, dx = 0
  let expr: Expr = 'normal'
  const beat = (v.t * (1.6 + v.cheer * 1.4)) % 1

  switch (v.drill) {
    case 'rock': {
      // やまの せなか
      hillLine(g, w, ground - 10, 26, 2.2, '#b08058')
      hillLine(g, w, ground, 10, 5.1, '#9a6c48', 30)
      mx = cx - 22
      const hits = doing ? Math.floor(v.t * 1.8) : 4
      const strike = doing && beat > .7
      const shake = strike ? (Math.floor(v.t * 30) % 2 ? 1 : -1) : 0
      if (v.grade === 'great' && !doing) {
        if (rt < .05) burst(v.fx, 'chunk', cx + 14, ground - 12, 18, ['#8a8a98', '#a8a8b8', '#d0d0dc'], 70, 1)
      } else boulder(g, cx + 14, ground, v.grade === 'fail' ? 1 : hits, shake)
      dx = strike ? 8 : beat > .5 ? -2 : 0
      expr = strike ? 'hurt' : 'normal'
      if (!doing) {
        expr = v.grade === 'fail' ? 'hurt' : 'happy'
        dx = v.grade === 'fail' ? -Math.min(8, rt * 30) : 0
        lift = v.grade === 'fail' ? 0 : Math.round(Math.abs(Math.sin(rt * 7)) * 6)
      }
      break
    }
    case 'study': {
      rect(g, 0, 0, w, ground, '#c89868')
      for (let x = 0; x < w; x += 12) rect(g, x, 0, 1, ground, '#b08458')
      blackboard(g, w, ground, v.t)
      mx = cx
      expr = doing ? (beat > .8 ? 'blink' : 'normal') : v.grade === 'fail' ? 'blink' : 'happy'
      lift = doing ? 0 : v.grade === 'fail' ? 0 : Math.round(Math.abs(Math.sin(rt * 7)) * 6)
      break
    }
    case 'run': {
      track(g, w, ground, h, v.t * (60 + v.cheer * 50))
      mx = cx
      lift = doing ? (Math.floor(v.t * 12) % 2) * 2 : 0
      expr = doing ? 'normal' : v.grade === 'fail' ? 'hurt' : 'happy'
      if (!doing && v.grade !== 'fail') lift = Math.round(Math.abs(Math.sin(rt * 7)) * 6)
      break
    }
    case 'fall': {
      waterfall(g, w, ground, v.t, cx)
      mx = cx
      expr = doing ? (beat > .5 ? 'hurt' : 'tired') : v.grade === 'fail' ? 'hurt' : 'happy'
      if (!doing && v.grade === 'fail') dx = Math.min(30, rt * 40)
      if (!doing && v.grade === 'great') {
        // にじ
        const colors = ['#ff6a6a', '#ffb040', '#ffe060', '#6ad070', '#5aa8f0', '#a070e0']
        colors.forEach((c, i) => { for (let a = 0; a <= 32; a++) { const ang = Math.PI * (a / 32); rect(g, cx + Math.cos(ang) * (34 - i), ground - 6 - Math.sin(ang) * (26 - i), 1, 1, c) } })
      }
      break
    }
    case 'pull': {
      gradient(g, 0, ground - 18, w, 18, ['#a8d8f8', '#78c050'])
      hill(g, w, ground, v.t * (20 + v.cheer * 20), bg.ground)
      mx = cx + 10
      const sway = doing ? Math.sin(v.t * 8) : 0
      logProp(g, mx - 30 + (v.grade === 'fail' && !doing ? Math.min(6, rt * 10) : 0), ground)
      // つな
      for (let x = mx - 16; x < mx - 6; x++) rect(g, x, ground - 7 - Math.round((x - mx + 16) * .4), 1, 1, '#e8d8a8')
      dx = Math.round(sway)
      expr = doing ? (beat > .6 ? 'hurt' : 'tired') : v.grade === 'fail' ? 'tired' : 'happy'
      if (!doing && v.grade !== 'fail') lift = Math.round(Math.abs(Math.sin(rt * 7)) * 6)
      break
    }
  }
  drawMonster(g, v.monster, mx, ground + 2, v.t, { expr, lift, dx })
  if (v.drill === 'study') draw(g, iconImage('book'), mx - 6, ground - 8)
  if (v.drill === 'fall' && doing) for (let i = 0; i < 3; i++) addFxOnce(v.fx, v.t, i, () => ({ kind: 'drop', x: mx - 10 + i * 10, y: ground - 20, vx: (i - 1) * 30, vy: -40, life: .5, color: '#c8ecff', gravity: 160 }))
  drawFx(g, v.fx)
}

const onceKeys = new WeakMap<Fx, Set<string>>()
/** おなじ じかんに なんども つぶを ださない。 */
function addFxOnce(fx: Fx, t: number, i: number, make: () => Omit<Particle, 'max'>) {
  let set = onceKeys.get(fx)
  if (!set) { set = new Set(); onceKeys.set(fx, set) }
  const key = `${Math.floor(t * 6)}:${i}`
  if (set.has(key)) return
  set.add(key)
  if (set.size > 200) set.clear()
  addFx(fx, make())
}

// ---------------- たいかい ----------------

export function arenaLeft(w: number) {
  return Math.round((w - ARENA_W) / 2)
}

export function arenaGround(h: number) {
  return h - Math.max(18, Math.round(h * .2))
}

function crowd(g: G, w: number, top: number, rows: number, time: number, cheer: number) {
  const colors = ['#e86a6a', '#f0c060', '#70a8e0', '#88c870', '#e8a0c8', '#d8d8e8']
  rect(g, 0, top - 2, w, rows * 7 + 2, '#4a3c68')
  for (let r = 0; r < rows; r++) {
    const y = top + r * 7
    rect(g, 0, y + 5, w, 2, r % 2 ? '#5a4a78' : '#66568a')
    for (let x = (r % 2) * 3 + 1; x < w - 2; x += 6) {
      const v = hash2(x, r, 11)
      if (v < .12) continue
      const jump = cheer > 0 && hash2(x, r, Math.floor(time * 6)) > .55 ? 1 : 0
      rect(g, x, y + 2 - jump, 3, 3, colors[Math.floor(v * colors.length) % colors.length])
      rect(g, x + 1, y - jump, 1, 2, '#f0c8a0')
      if (jump && v > .7) rect(g, x + 3, y - 1, 1, 2, '#f0c8a0')
    }
  }
}

function shotGlyph(g: G, kind: FxKind, x: number, y: number, t: number, dir: number, big: boolean) {
  const s = big ? 2 : 1
  switch (kind) {
    case 'bubble': ellipse(g, x, y, 3 * s, 3 * s, '#9ad8ff'); ellipse(g, x, y, 2 * s, 2 * s, '#d8f4ff'); rect(g, x - s, y - 2 * s, s, s, '#ffffff'); break
    case 'fire': ellipse(g, x, y, 3 * s, 3 * s, '#e83c20'); ellipse(g, x + dir, y, 2 * s, 2 * s, '#ffb030'); rect(g, x + dir * s, y, s, s, '#fff4b0'); break
    case 'leaf': {
      const a = Math.floor(t * 12) % 2
      rect(g, x - 2 * s, y - (a ? 1 : 0) * s, 4 * s, 2 * s, '#5cb848'); rect(g, x - s, y, 2 * s, s, '#a0e078')
      break
    }
    case 'rock': ellipse(g, x, y, 3 * s, 3 * s, '#5a5a68'); ellipse(g, x - 1, y - 1, 2 * s, 2 * s, '#a8a8b8'); break
    case 'feather': rect(g, x - 3 * s, y, 6 * s, s, '#ffffff'); rect(g, x - 2 * s, y - s, 4 * s, s, '#fff0a0'); rect(g, x - 3 * s * dir, y, s, s, '#f08820'); break
    case 'wisp': {
      const f = Math.floor(t * 10) % 2
      ellipse(g, x, y, 3 * s, 3 * s, '#7a60e0'); ellipse(g, x, y - f, 2 * s, 2 * s, '#a8d8ff'); rect(g, x - dir * 4 * s, y + f, 2 * s, s, '#7a60e0')
      break
    }
    default: ellipse(g, x, y, 3 * s, 3 * s, '#ffe060'); ellipse(g, x, y, 2 * s, 2 * s, '#ffffff')
  }
}

function beamColor(species: SpeciesId) {
  return species === 'draco' ? ['#e83c20', '#ffb030', '#fff4b0'] : ['#7a60e0', '#c8a8ff', '#ffffff']
}

function fighterPose(f: Fighter, b: Battle, time: number): Pose {
  const foe = b.f[1 - f.side]
  const dir = Math.sign(foe.x - f.x) || 1
  if (b.state === 'over' && b.winner !== null) {
    if (b.winner === f.side) return { expr: 'happy', lift: Math.round(Math.abs(Math.sin(b.stateT * 7)) * 7) }
    if (f.hp <= 0) return { expr: 'hurt', fallen: dir > 0 ? -1 : 1 }
    return { expr: 'tired' }
  }
  if (f.hurt > 0) return { expr: 'hurt', flash: Math.floor(f.hurt * 20) % 2 === 0, dx: Math.floor(time * 30) % 2 ? 1 : -1 }
  if (f.dodge > 0) return { expr: 'normal', lift: Math.round(Math.sin((1 - f.dodge / .35) * Math.PI) * 9), dx: -dir * 2 }
  if (f.phase === 'windup') return { expr: 'hurt', dx: -dir * 2 }
  if (f.phase === 'lunge') return { expr: 'normal', dx: dir * 3 }
  if (f.phase === 'recover') return { expr: 'normal' }
  const bob = f.walking ? Math.floor(time * 10) % 2 : Math.floor(time * 2) % 2
  return { expr: f.guts < 10 ? 'tired' : 'normal', lift: bob }
}

/** たいかいの ばめん。 */
export function drawBattle(g: G, w: number, h: number, b: Battle, time: number, fx: Fx, cheer: number) {
  const ground = arenaGround(h)
  const left = arenaLeft(w)
  gradient(g, 0, 0, w, ground - 40, ['#3a6ac8', '#5a8ae0', '#8ab8f0'])
  // はた
  for (let x = 6; x < w; x += 22) {
    rect(g, x, 4, 1, 14, '#e8e0d0')
    const wave = Math.floor(time * 4 + x) % 2
    rect(g, x + 1, 4 + wave, 7, 4, ['#f04848', '#ffd040', '#48a0f0', '#60c060'][(x / 22) % 4 | 0])
  }
  const rows = Math.max(4, Math.min(10, Math.floor((ground - 14 - Math.max(26, Math.round(ground * .42))) / 7)))
  const standTop = ground - 14 - rows * 7
  // とおくの やまと くも
  for (let i = 0; i < 3; i++) cloud(g, ((i * 67 + time * (2 + i)) % (w + 60)) - 30, 26 + i * 11, 5 + (i % 2) * 2, '#ffffff', '#c8dcf8')
  hillLine(g, w, standTop - 8, 18, 2.7, '#7a9ad8')
  hillLine(g, w, standTop - 6, 10, 6.1, '#6a88c8', 50)
  // やね と ライト
  rect(g, 0, standTop - 9, w, 5, '#3a3058')
  rect(g, 0, standTop - 9, w, 1, '#6a5a90')
  for (let x = 8; x < w; x += 26) {
    rect(g, x, standTop - 14, 6, 4, '#4a4070')
    rect(g, x + 1, standTop - 13, 4, 2, Math.floor(time * 2 + x) % 5 ? '#fff4b0' : '#ffffff')
  }
  crowd(g, w, standTop, rows, time, cheer)
  rect(g, 0, ground - 14, w, 4, '#8a5a3a')
  rect(g, 0, ground - 14, w, 1, '#c89060')
  rect(g, 0, ground - 10, w, h - ground + 10, '#e0c088')
  for (let y = ground - 10; y < h; y++) for (let x = (y * 3) % 6; x < w; x += 6) if (hash2(x, y, 9) > .7) rect(g, x, y, 1, 1, '#c8a470')
  // まんなかの せん
  for (let y = ground - 9; y < h; y += 3) rect(g, left + ARENA_W / 2, y, 1, 2, '#f8ecd0')
  // わざ
  for (const s of b.shots) drawShot(g, b, s, left, ground, time)
  for (const f of [b.f[0], b.f[1]]) {
    const pose = fighterPose(f, b, time)
    drawMonster(g, f.monster, left + f.x, ground, time + f.side, pose)
    if (f.guts < 10 && b.state === 'fight' && Math.floor(time * 3 + f.side) % 4 === 0 && fx.list.filter(p => p.kind === 'sweat').length < 4) {
      addFx(fx, { kind: 'sweat', x: left + f.x + 9, y: ground - 22, vx: 8, vy: -6, life: .5, color: '#a8e0ff', gravity: 60 })
    }
  }
  drawFx(g, fx)
}

function drawShot(g: G, b: Battle, s: Shot, left: number, ground: number, time: number) {
  const from = b.f[s.side]
  const dir = s.to >= from.x ? 1 : -1
  const y = ground - 12
  if (s.tech.fx === 'beam') {
    const colors = beamColor(from.species.id)
    const x0 = left + from.x + dir * 8, x1 = left + s.x
    const a = Math.min(x0, x1), len = Math.abs(x1 - x0)
    const flick = Math.floor(time * 20) % 2
    rect(g, a, y - 3 - flick, len, 7 + flick * 2, colors[0])
    rect(g, a, y - 2, len, 5, colors[1])
    rect(g, a, y - 1, len, 2, colors[2])
    ellipse(g, x1, y, 5 + flick, 5 + flick, colors[1])
    return
  }
  shotGlyph(g, s.tech.fx, left + s.x, y - Math.round(Math.sin(s.t * 12) * (s.tech.fx === 'leaf' || s.tech.fx === 'feather' ? 2 : 0)), s.t, dir, !!s.tech.big)
}

// ---------------- よびだし（いしの まつり） ----------------

export type ShrineView = {
  /** よびだしを はじめてからの じかん。null なら まだ。 */
  t: number | null
  stoneColor: string
  monster: Pick<Monster, 'species' | 'variant'> | null
  time: number
  fx: Fx
}

export const SUMMON_SECONDS = 2.2

export function shrineGround(h: number) {
  return Math.min(h - Math.max(20, Math.round(h * .2)), Math.round(h * .5 + 50))
}

/** よびだしの ばめん。いしが ひかって われ、モンスターが うまれる。 */
export function drawShrine(g: G, w: number, h: number, v: ShrineView) {
  gradient(g, 0, 0, w, h, ['#1c1440', '#2c1c5a', '#4a2c78', '#6a3c90'])
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(hash2(i, 1, 5) * w), y = Math.floor(hash2(i, 2, 5) * h * .6)
    if (Math.sin(v.time * 2 + i * 1.3) > -.3) rect(g, x, y, 1, 1, i % 4 ? '#fff8d0' : '#a8d8ff')
  }
  const ground = shrineGround(h)
  const cx = Math.round(w / 2)
  // はしら
  for (const px of [cx - 46, cx + 40]) {
    rect(g, px, ground - 56, 6, 56, '#8a7aa8')
    rect(g, px, ground - 56, 2, 56, '#b0a0d0')
    rect(g, px - 2, ground - 60, 10, 4, '#b0a0d0')
  }
  rect(g, 0, ground, w, h - ground, '#3a2c58')
  for (let y = ground; y < h; y += 4) for (let x = (y % 8); x < w; x += 8) rect(g, x, y, 7, 3, '#4a3a6a')
  // まほうじん
  const pulse = v.t === null ? .3 : Math.min(1, v.t / SUMMON_SECONDS)
  const ringColor = v.t !== null && Math.floor(v.time * 10) % 2 ? '#fff4b0' : '#c8a8ff'
  for (let a = 0; a < 48; a++) {
    const ang = a / 48 * Math.PI * 2 + v.time * (.4 + pulse * 2)
    rect(g, cx + Math.cos(ang) * 30, ground + 4 + Math.sin(ang) * 4, 1, 1, ringColor)
    if (a % 2 === 0) rect(g, cx + Math.cos(-ang) * 20, ground + 4 + Math.sin(-ang) * 2.6, 1, 1, ringColor)
  }
  // だい
  rect(g, cx - 14, ground - 8, 28, 8, '#6a5a88')
  rect(g, cx - 14, ground - 8, 28, 2, '#9a8ab8')
  rect(g, cx - 10, ground - 10, 20, 2, '#9a8ab8')
  const top = ground - 10
  if (v.t === null || v.t < SUMMON_SECONDS) {
    const t = v.t ?? 0
    const shake = v.t === null ? 0 : Math.round(Math.sin(v.time * 60) * Math.min(2, t))
    const float = v.t === null ? Math.round(Math.sin(v.time * 2) * 1.5) : -Math.round(t * 6)
    const img = stoneImage(v.stoneColor)
    if (img) draw(g, img, cx - img.width / 2 + shake, top - img.height - 2 + float)
    if (v.t !== null) {
      // ひかりの はしら
      g.fillStyle = `rgba(255, 248, 200, ${Math.min(.8, t / SUMMON_SECONDS)})`
      g.fillRect(cx - 4 - Math.round(t * 3), 0, 8 + Math.round(t * 6), top)
    }
  } else if (v.monster) {
    const rt = v.t - SUMMON_SECONDS
    const flash = rt < .25
    drawMonster(g, v.monster, cx, top, v.time, { expr: rt < 1.2 ? 'happy' : 'normal', lift: rt < 1.2 ? Math.round(Math.abs(Math.sin(rt * 6)) * 8) : Math.floor(v.time * 2) % 2, flash })
    if (rt < .35) {
      g.fillStyle = `rgba(255, 255, 255, ${1 - rt / .35})`
      g.fillRect(0, 0, w, h)
    }
  }
  drawFx(g, v.fx)
}

// ---------------- 小さな アイコン ----------------

/** ボタンなどに つかう ドット絵。 */
export function iconFor(kind: 'snack' | 'icon' | 'stone' | 'monster', id: string, variant = 0): Img | null {
  if (kind === 'snack') return snackImage(id as SnackId)
  if (kind === 'stone') return stoneImage(id)
  if (kind === 'monster') return monsterImage(id as SpeciesId, variant)
  return iconImage(id as IconId)
}
