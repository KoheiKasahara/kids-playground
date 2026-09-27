import { FONT, INK, drawFish, drawItemArt, drawJelly, drawMagnetBody, drawMagnetFace } from './art'
import { KINDS, shapePoints, shapeRadius, type KindId } from './items'
import {
  ARM_W, MAGNET_H, MAGNET_HALF_W, TIP_H, floorAt, fromMagnet, shadowFloorAt, surfaceY,
  type Item, type PropBody, type World, type WorldEvent,
} from './world'

/**
 * ぴたっと じしゃく の がめん。
 * うごかない けしき（かべ・つくえ・すなば・うみ）は ステージごとに 1かいだけ かいて とっておき、
 * まいコマ そのうえに もの・じしゃく・こうか を かさねる。
 */

type G = CanvasRenderingContext2D
type Canvas = HTMLCanvasElement | OffscreenCanvas
type AnyCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export type View = { cssW: number; cssH: number; dpr: number; scale: number; ox: number; oy: number }

export function makeView(cssW: number, cssH: number, dpr: number, world: { w: number; h: number }): View {
  const scale = Math.min(cssW / world.w, cssH / world.h)
  return { cssW, cssH, dpr, scale, ox: (cssW - world.w * scale) / 2, oy: (cssH - world.h * scale) / 2 }
}

/** がめんの てん（CSS px）→ せかいの てん。 */
export function screenToWorld(view: View, x: number, y: number) {
  return { x: (x - view.ox) / view.scale, y: (y - view.oy) / view.scale }
}

function makeCanvas(w: number, h: number): Canvas {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(Math.max(1, w), Math.max(1, h))
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  return c
}

function ctx2d(c: Canvas): G {
  const g = (c as HTMLCanvasElement).getContext('2d') as AnyCtx | null
  if (!g) throw new Error('canvas 2d unavailable')
  return g as G
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function lin(g: G, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const grad = g.createLinearGradient(x0, y0, x1, y1)
  for (const [o, c] of stops) grad.addColorStop(o, c)
  return grad
}

function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + k, y)
  g.arcTo(x + w, y, x + w, y + h, k)
  g.arcTo(x + w, y + h, x, y + h, k)
  g.arcTo(x, y + h, x, y, k)
  g.arcTo(x, y, x + w, y, k)
  g.closePath()
}

function cloud(g: G, x: number, y: number, s: number, alpha = 1) {
  g.save()
  g.globalAlpha = alpha
  g.fillStyle = '#ffffff'
  for (const [dx, dy, r] of [[0, 0, 16], [16, -8, 20], [36, -2, 17], [52, 4, 12], [20, 8, 16]]) {
    g.beginPath()
    g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = 'rgba(180,210,240,.35)'
  g.beginPath()
  g.ellipse(x + 26 * s, y + 16 * s, 34 * s, 6 * s, 0, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

// ---------------- こうか（つぶ・もじ・わ） ----------------

type Particle = {
  x: number; y: number; vx: number; vy: number; life: number; max: number; size: number
  color: string; kind: 'spark' | 'dot' | 'drop' | 'bubble' | 'confetti' | 'star' | 'dust'
  rot: number; vr: number; g: number
}
type Popup = { x: number; y: number; text: string; life: number; max: number; color: string; size: number; follow: boolean; rise: number }
type Ring = { x: number; y: number; r: number; vr: number; life: number; max: number; color: string; width: number }

export type Fx = { parts: Particle[]; pops: Popup[]; rings: Ring[]; lastPopAt: number; bubbleAt: number; flash: number }

export function createFx(): Fx {
  return { parts: [], pops: [], rings: [], lastPopAt: -9, bubbleAt: 0, flash: 0 }
}

const SPARK_COLORS = ['#ffffff', '#fff3a0', '#ffe066', '#bff0ff']
const CONFETTI = ['#ff5d73', '#ffc233', '#3fb6ff', '#56d26a', '#b57bff', '#ff8a3d']

function burst(fx: Fx, x: number, y: number, n: number, opt: Partial<Particle> & { speed: number; spread?: number; dir?: number }) {
  for (let i = 0; i < n; i++) {
    const a = (opt.dir ?? 0) + (opt.spread ?? Math.PI * 2) * (Math.random() - 0.5)
    const sp = opt.speed * (0.5 + Math.random() * 0.7)
    const max = (opt.max ?? 0.5) * (0.7 + Math.random() * 0.6)
    fx.parts.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: max, max,
      size: (opt.size ?? 2) * (0.7 + Math.random() * 0.6), color: opt.color ?? SPARK_COLORS[i % SPARK_COLORS.length],
      kind: opt.kind ?? 'spark', rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 12, g: opt.g ?? 0,
    })
  }
}

function popup(fx: Fx, x: number, y: number, text: string, color: string, size = 15, max = 0.9, follow = false) {
  fx.pops.push({ x, y, text, color, size, life: max, max, follow, rise: 0 })
}

/** もじの いち（じしゃくに ついていく ものは じしゃくからの ずれ）。がめんの そとへ はみださない。 */
function popPos(p: Popup, world: World) {
  const half = p.text.length * p.size * 0.5 + 6
  const x = p.follow ? world.magnet.x + p.x : p.x
  const y = (p.follow ? world.magnet.y + p.y : p.y) - p.rise
  return { x: clamp(x, half, world.w - half), y: Math.max(y, world.topLimit + 14) }
}

export function spawnFx(fx: Fx, e: WorldEvent, world: World) {
  switch (e.type) {
    case 'stick': {
      burst(fx, e.x, e.y, e.star ? 16 : 7, { speed: e.star ? 170 : 120, size: e.star ? 3 : 2.2, max: e.star ? 0.7 : 0.35 })
      fx.rings.push({ x: e.x, y: e.y, r: 2, vr: 90, life: 0.2, max: 0.2, color: 'rgba(255,255,255,.95)', width: 2.6 })
      const mx = world.magnet.x, my = world.magnet.y
      if (e.star) {
        burst(fx, e.x, e.y, 10, { speed: 90, size: 5, max: 0.9, kind: 'star', color: '#ffd43b', g: -40 })
        popup(fx, 0, -MAGNET_H - 22, 'ほし ゲット！', '#ffb000', 17, 1.2, true)
        fx.lastPopAt = world.time
      } else if (e.kind === 'fish') {
        popup(fx, 0, -MAGNET_H - 22, 'つれた！', '#ff6f91', 17, 1.1, true)
        fx.lastPopAt = world.time
      } else if (world.time - fx.lastPopAt > 0.45) {
        popup(fx, e.x - mx + (e.x < mx ? -30 : 30), e.y - my - 6, e.combo >= 2 ? 'ぴたぴたっ！' : 'ぴたっ', '#ff4d6d', e.combo >= 2 ? 16 : 14, 0.7, true)
        fx.lastPopAt = world.time
      }
      break
    }
    case 'shiin':
      popup(fx, e.x, e.y, 'しーん…', '#7a8494', 13, 1.3)
      break
    case 'pop':
      burst(fx, e.x, e.y, 18, { speed: 150, dir: -Math.PI / 2, spread: 1.6, size: 2.4, max: 0.7, kind: 'dust', color: '#e5c07f', g: 500 })
      burst(fx, e.x, e.y, 6, { speed: 60, dir: -Math.PI / 2, spread: 2.6, size: 7, max: 0.6, kind: 'dust', color: 'rgba(240,215,160,.6)', g: -20 })
      popup(fx, e.x, e.y - 30, 'みつけた！', '#ff8a1e', 15, 1)
      break
    case 'splash':
      burst(fx, e.x, e.y, Math.round(8 + e.power * 16), { speed: 120 + e.power * 160, dir: -Math.PI / 2, spread: 1.4, size: 2.4, max: 0.7, kind: 'drop', color: 'rgba(230,248,255,.95)', g: 700 })
      fx.rings.push({ x: e.x, y: e.y, r: 4, vr: 60, life: 0.6, max: 0.6, color: 'rgba(255,255,255,.8)', width: 1.6 })
      break
    case 'hooked':
      popup(fx, e.x, e.y - 22, 'あっ！', '#3f8cff', 14, 0.8)
      break
    case 'clink':
      if (e.power > 0.45 && e.material !== 'glass') burst(fx, e.x, e.y, 3, { speed: 40, dir: -Math.PI / 2, spread: 2, size: 4, max: 0.35, kind: 'dust', color: 'rgba(255,255,255,.5)' })
      break
    case 'clear': {
      for (let i = 0; i < 90; i++) {
        const max = 2.4 + Math.random() * 1.6
        fx.parts.push({
          x: Math.random() * world.w, y: -10 - Math.random() * 120, vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 90,
          life: max, max, size: 4 + Math.random() * 3, color: CONFETTI[i % CONFETTI.length], kind: 'confetti',
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, g: 30,
        })
      }
      fx.rings.push({ x: world.magnet.x, y: world.magnet.y - 40, r: 20, vr: 260, life: 0.8, max: 0.8, color: 'rgba(255,230,120,.9)', width: 4 })
      fx.flash = 1
      break
    }
    default:
      break
  }
}

export function updateFx(fx: Fx, world: World, dt: number) {
  for (const p of fx.parts) {
    p.life -= dt
    p.vy += p.g * dt
    if (p.kind === 'bubble') {
      p.vx = Math.sin((p.max - p.life) * 5 + p.rot) * 12
      if (world.waterY !== null && p.y < surfaceY(world, p.x) + 2) p.life = Math.min(p.life, 0.05)
    }
    if (p.kind === 'confetti') p.vx += Math.sin(p.life * 4 + p.rot) * 30 * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rot += p.vr * dt
    if (p.kind !== 'confetti' && p.kind !== 'bubble') { p.vx *= 0.96; if (p.g === 0) p.vy *= 0.96 }
  }
  fx.parts = fx.parts.filter((p) => p.life > 0)
  for (const p of fx.pops) { p.life -= dt; p.rise += dt * 26 }
  fx.pops = fx.pops.filter((p) => p.life > 0)
  for (const r of fx.rings) { r.life -= dt; r.r += r.vr * dt; r.vr *= 0.94 }
  fx.rings = fx.rings.filter((r) => r.life > 0)
  fx.flash = Math.max(0, fx.flash - dt * 2.5)
  // うみの あわ
  if (world.waterY !== null) {
    fx.bubbleAt -= dt
    const m = world.magnet
    const speed = Math.hypot(m.vx, m.vy)
    if (m.wet && speed > 80 && Math.random() < speed / 1400) {
      fx.parts.push({ x: m.x + (Math.random() - 0.5) * 50, y: m.y - Math.random() * 60, vx: 0, vy: -50 - Math.random() * 40, life: 3, max: 3, size: 1.5 + Math.random() * 2.5, color: '', kind: 'bubble', rot: Math.random() * 6, vr: 0, g: -30 })
    }
    if (fx.bubbleAt <= 0) {
      fx.bubbleAt = 0.35 + Math.random() * 0.5
      const x = Math.random() * world.w
      fx.parts.push({ x, y: floorAt(world, x, x) - 4, vx: 0, vy: -30, life: 6, max: 6, size: 1.5 + Math.random() * 3, color: '', kind: 'bubble', rot: Math.random() * 6, vr: 0, g: -12 })
    }
  }
  if (fx.parts.length > 500) fx.parts.splice(0, fx.parts.length - 500)
}

function drawFx(g: G, fx: Fx, world: World) {
  for (const p of fx.parts) {
    const a = clamp(p.life / p.max, 0, 1)
    g.save()
    g.translate(p.x, p.y)
    if (p.kind === 'spark') {
      g.rotate(Math.atan2(p.vy, p.vx))
      g.globalAlpha = a
      g.strokeStyle = p.color
      g.lineWidth = p.size * 0.7
      g.lineCap = 'round'
      g.beginPath()
      g.moveTo(-p.size * 2.2 * a, 0)
      g.lineTo(p.size * 1.4, 0)
      g.stroke()
    } else if (p.kind === 'star') {
      g.rotate(p.rot)
      g.globalAlpha = a
      g.fillStyle = p.color
      starShape(g, p.size, p.size * 0.45)
      g.fill()
    } else if (p.kind === 'confetti') {
      g.rotate(p.rot)
      g.globalAlpha = Math.min(1, a * 2)
      g.fillStyle = p.color
      g.scale(1, Math.cos(p.rot * 1.7))
      g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
    } else if (p.kind === 'bubble') {
      g.globalAlpha = Math.min(1, a * 3) * 0.8
      g.beginPath()
      g.arc(0, 0, p.size, 0, Math.PI * 2)
      g.strokeStyle = 'rgba(255,255,255,.8)'
      g.lineWidth = 0.8
      g.stroke()
      g.fillStyle = 'rgba(255,255,255,.18)'
      g.fill()
      g.beginPath()
      g.arc(-p.size * 0.35, -p.size * 0.35, p.size * 0.3, 0, Math.PI * 2)
      g.fillStyle = 'rgba(255,255,255,.9)'
      g.fill()
    } else {
      g.globalAlpha = a
      g.fillStyle = p.color
      g.beginPath()
      g.arc(0, 0, p.kind === 'dust' ? p.size * (1.4 - a * 0.4) : p.size, 0, Math.PI * 2)
      g.fill()
    }
    g.restore()
  }
  for (const r of fx.rings) {
    const a = clamp(r.life / r.max, 0, 1)
    g.globalAlpha = a
    g.beginPath()
    g.arc(r.x, r.y, r.r, 0, Math.PI * 2)
    g.strokeStyle = r.color
    g.lineWidth = r.width * a + 0.4
    g.stroke()
  }
  g.globalAlpha = 1
  for (const p of fx.pops) {
    const t = 1 - p.life / p.max
    const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.55 : t < 0.25 ? 1.15 - ((t - 0.15) / 0.1) * 0.15 : 1
    const at = popPos(p, world)
    g.save()
    g.translate(at.x, at.y)
    g.scale(pop, pop)
    g.globalAlpha = clamp(p.life / (p.max * 0.35), 0, 1)
    g.font = `900 ${p.size}px ${FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.lineWidth = 4.5
    g.strokeStyle = '#ffffff'
    g.strokeText(p.text, 0, 0)
    g.fillStyle = p.color
    g.fillText(p.text, 0, 0)
    g.restore()
  }
}

function starShape(g: G, r: number, inner: number) {
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2
    const rr0 = i % 2 === 0 ? r : inner
    if (i === 0) g.moveTo(Math.cos(a) * rr0, Math.sin(a) * rr0)
    else g.lineTo(Math.cos(a) * rr0, Math.sin(a) * rr0)
  }
  g.closePath()
}

function twinkle(g: G, x: number, y: number, s: number, a: number) {
  g.save()
  g.translate(x, y)
  g.globalAlpha = a
  g.fillStyle = '#fffbe0'
  g.beginPath()
  g.moveTo(0, -s)
  g.quadraticCurveTo(0, 0, s, 0)
  g.quadraticCurveTo(0, 0, 0, s)
  g.quadraticCurveTo(0, 0, -s, 0)
  g.quadraticCurveTo(0, 0, 0, -s)
  g.fill()
  g.restore()
}

// ---------------- けしき ----------------

/** がめんに みえている はんい（せかいの 単位）。けしきは せかいの そとまで のばして かく。 */
type Ext = { x0: number; x1: number; y0: number; y1: number }

const snap = (v: number, step: number) => Math.floor(v / step) * step

function viewExt(view: View): Ext {
  return { x0: -view.ox / view.scale, x1: (view.cssW - view.ox) / view.scale, y0: -view.oy / view.scale, y1: (view.cssH - view.oy) / view.scale }
}

/** かべの たな と とけい（さわれない かざり なので すこし うすめの いろ）。 */
function paintWallShelf(g: G, w: number, wainY: number) {
  const shelfY = wainY - 64
  const x0 = w * 0.6, x1 = Math.min(w - 12, w * 0.6 + 170)
  if (shelfY < 150 || x1 - x0 < 110) return
  // たな
  g.fillStyle = 'rgba(120,70,30,.18)'
  g.fillRect(x0 + 4, shelfY + 8, x1 - x0 - 8, 5)
  rr(g, x0, shelfY, x1 - x0, 8, 3)
  g.fillStyle = '#e0a468'
  g.fill()
  g.fillStyle = 'rgba(255,255,255,.4)'
  g.fillRect(x0 + 3, shelfY + 1, x1 - x0 - 6, 1.5)
  for (const bx of [x0 + 14, x1 - 20]) {
    g.fillStyle = '#c98a4f'
    g.beginPath()
    g.moveTo(bx, shelfY + 8)
    g.lineTo(bx + 6, shelfY + 8)
    g.lineTo(bx + 6, shelfY + 20)
    g.closePath()
    g.fill()
  }
  // うえきばち
  const px = x0 + 26
  g.fillStyle = '#6cc07a'
  for (const [dx, dy, r, a] of [[-7, -30, 7, -0.5], [6, -33, 7, 0.4], [0, -40, 7, 0], [-10, -22, 6, -0.9], [10, -24, 6, 0.9]] as [number, number, number, number][]) {
    g.save()
    g.translate(px + dx, shelfY + dy)
    g.rotate(a)
    g.beginPath()
    g.ellipse(0, 0, r * 0.6, r * 1.3, 0, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
  g.fillStyle = '#e58a6a'
  g.beginPath()
  g.moveTo(px - 11, shelfY - 18)
  g.lineTo(px + 11, shelfY - 18)
  g.lineTo(px + 8, shelfY)
  g.lineTo(px - 8, shelfY)
  g.closePath()
  g.fill()
  g.fillStyle = '#f2a386'
  g.fillRect(px - 12, shelfY - 20, 24, 4)
  // くまの ぬいぐるみ
  const bx = x0 + 70, by = shelfY
  g.fillStyle = '#d9a26b'
  for (const [dx, dy, r] of [[-8, -30, 4.5], [8, -30, 4.5], [0, -22, 10], [0, -8, 11]] as [number, number, number][]) {
    g.beginPath()
    g.arc(bx + dx, by + dy, r, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#f3d3ad'
  g.beginPath()
  g.ellipse(bx, by - 18, 4.5, 3.4, 0, 0, Math.PI * 2)
  g.ellipse(bx, by - 6, 6, 6, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#5b3a2a'
  for (const dx of [-3.6, 3.6]) {
    g.beginPath()
    g.arc(bx + dx, by - 24, 1.2, 0, Math.PI * 2)
    g.fill()
  }
  g.beginPath()
  g.arc(bx, by - 19.5, 1.3, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#ff8fa8'
  g.beginPath()
  g.moveTo(bx - 5, by - 14)
  g.lineTo(bx, by - 12)
  g.lineTo(bx + 5, by - 14)
  g.lineTo(bx + 5, by - 10)
  g.lineTo(bx, by - 12)
  g.lineTo(bx - 5, by - 10)
  g.closePath()
  g.fill()
  // ロケットの おもちゃ
  const rx = x0 + 112
  if (rx + 14 < x1) {
    g.fillStyle = '#9fc9ff'
    rr(g, rx - 6, by - 34, 12, 26, 6)
    g.fill()
    g.fillStyle = '#ff9aa9'
    g.beginPath()
    g.moveTo(rx - 6, by - 14)
    g.lineTo(rx - 11, by)
    g.lineTo(rx - 4, by - 6)
    g.moveTo(rx + 6, by - 14)
    g.lineTo(rx + 11, by)
    g.lineTo(rx + 4, by - 6)
    g.fill()
    g.beginPath()
    g.arc(rx, by - 25, 3.2, 0, Math.PI * 2)
    g.fillStyle = '#ffffff'
    g.fill()
  }
  // とけい
  const cx = (x0 + x1) / 2 + 20, cy = shelfY - 100
  if (cy > 150) {
    g.fillStyle = 'rgba(120,70,30,.14)'
    g.beginPath()
    g.arc(cx + 2, cy + 3, 24, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#7ec8f2'
    g.beginPath()
    g.arc(cx, cy, 24, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.arc(cx, cy, 19, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(59,42,74,.55)'
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      g.beginPath()
      g.arc(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15, i % 3 === 0 ? 1.6 : 0.9, 0, Math.PI * 2)
      g.fill()
    }
    g.strokeStyle = 'rgba(59,42,74,.75)'
    g.lineCap = 'round'
    g.lineWidth = 2.2
    g.beginPath()
    g.moveTo(cx, cy)
    g.lineTo(cx + 7, cy - 5)
    g.stroke()
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(cx, cy)
    g.lineTo(cx - 2, cy - 13)
    g.stroke()
    g.fillStyle = '#ff6b7d'
    g.beginPath()
    g.arc(cx, cy, 2, 0, Math.PI * 2)
    g.fill()
  }
}

function paintDeskBack(g: G, world: World, e: Ext) {
  const { w, h, groundY } = world
  const ew = e.x1 - e.x0
  // かべ
  g.fillStyle = lin(g, 0, 0, 0, groundY, [[0, '#fff1d9'], [1, '#ffe2bd']])
  g.fillRect(e.x0, e.y0, ew, groundY - e.y0)
  // かべがみ の みずたま
  g.fillStyle = 'rgba(255,190,140,.22)'
  for (let row = Math.floor((e.y0 - 18) / 34), y = 18 + row * 34; y < groundY; y += 34, row++) {
    for (let x = snap(e.x0, 40) + (Math.abs(row) % 2) * 20 + 10; x < e.x1; x += 40) {
      g.beginPath()
      g.arc(x, y, 3.2, 0, Math.PI * 2)
      g.fill()
    }
  }
  // こしいた
  const wainY = groundY - Math.min(90, (groundY - 60) * 0.3)
  g.fillStyle = lin(g, 0, wainY, 0, groundY, [[0, '#f7c98f'], [1, '#e9ad6c']])
  g.fillRect(e.x0, wainY, ew, groundY - wainY)
  g.fillStyle = 'rgba(150,80,30,.12)'
  for (let x = snap(e.x0, 26); x < e.x1; x += 26) g.fillRect(x, wainY, 1.5, groundY - wainY)
  g.fillStyle = '#fff5e6'
  g.fillRect(e.x0, wainY - 5, ew, 6)
  g.fillStyle = 'rgba(150,80,30,.2)'
  g.fillRect(e.x0, wainY + 1, ew, 1.2)
  // まど
  const winW = clamp(w * 0.46, 150, 300)
  const winTop = clamp(h * 0.1, 50, 120)
  const winH = clamp(wainY - winTop - 60, 120, 300)
  const winX = clamp(w * 0.06, 16, 60)
  g.fillStyle = lin(g, 0, winTop, 0, winTop + winH, [[0, '#7cc8ff'], [1, '#d4f0ff']])
  rr(g, winX, winTop, winW, winH, 8)
  g.fill()
  g.save()
  rr(g, winX, winTop, winW, winH, 8)
  g.clip()
  // おひさま と くも と やま
  g.fillStyle = 'rgba(255,240,170,.9)'
  g.beginPath()
  g.arc(winX + winW * 0.78, winTop + winH * 0.24, 18, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = 'rgba(255,240,170,.3)'
  g.beginPath()
  g.arc(winX + winW * 0.78, winTop + winH * 0.24, 30, 0, Math.PI * 2)
  g.fill()
  cloud(g, winX + winW * 0.12, winTop + winH * 0.3, 0.9, 0.95)
  cloud(g, winX + winW * 0.55, winTop + winH * 0.5, 0.6, 0.85)
  g.fillStyle = '#9ad97f'
  g.beginPath()
  g.moveTo(winX, winTop + winH)
  g.quadraticCurveTo(winX + winW * 0.3, winTop + winH * 0.7, winX + winW * 0.6, winTop + winH * 0.88)
  g.quadraticCurveTo(winX + winW * 0.85, winTop + winH * 0.75, winX + winW, winTop + winH * 0.84)
  g.lineTo(winX + winW, winTop + winH)
  g.closePath()
  g.fill()
  g.restore()
  // わく
  g.lineWidth = 7
  g.strokeStyle = '#ffffff'
  rr(g, winX, winTop, winW, winH, 8)
  g.stroke()
  g.lineWidth = 5
  g.beginPath()
  g.moveTo(winX + winW / 2, winTop)
  g.lineTo(winX + winW / 2, winTop + winH)
  g.moveTo(winX, winTop + winH * 0.5)
  g.lineTo(winX + winW, winTop + winH * 0.5)
  g.stroke()
  g.lineWidth = 1.2
  g.strokeStyle = 'rgba(150,100,60,.35)'
  rr(g, winX - 3.5, winTop - 3.5, winW + 7, winH + 7, 10)
  g.stroke()
  // まどべ
  rr(g, winX - 10, winTop + winH + 2, winW + 20, 9, 3)
  g.fillStyle = '#ffffff'
  g.fill()
  g.fillStyle = 'rgba(150,100,60,.2)'
  g.fillRect(winX - 8, winTop + winH + 9, winW + 16, 2)
  // カーテン
  for (const side of [0, 1]) {
    const cx = side ? winX + winW + 4 : winX - 4
    const dir = side ? 1 : -1
    g.fillStyle = lin(g, cx - 20, 0, cx + 20, 0, [[0, '#ff9fb2'], [0.5, '#ffc6d1'], [1, '#ff9fb2']])
    g.beginPath()
    g.moveTo(cx - dir * 6, winTop - 14)
    g.lineTo(cx + dir * 30, winTop - 14)
    g.quadraticCurveTo(cx + dir * 20, winTop + winH * 0.5, cx + dir * 26, winTop + winH + 20)
    g.lineTo(cx + dir * 2, winTop + winH + 20)
    g.quadraticCurveTo(cx - dir * 4, winTop + winH * 0.5, cx - dir * 6, winTop - 14)
    g.fill()
    g.strokeStyle = 'rgba(220,90,120,.35)'
    g.lineWidth = 1
    for (const k of [0.35, 0.65]) {
      g.beginPath()
      g.moveTo(cx + dir * 30 * k, winTop - 10)
      g.quadraticCurveTo(cx + dir * 22 * k, winTop + winH * 0.5, cx + dir * 26 * k, winTop + winH + 18)
      g.stroke()
    }
  }
  g.fillStyle = '#c98a4f'
  rr(g, winX - 26, winTop - 20, winW + 52, 7, 3.5)
  g.fill()
  // こどもの え（かべに はってある）
  const artX = winX + winW + 44
  if (artX + 70 < w - 10) {
    const ay = winTop + 20
    g.save()
    g.translate(artX + 34, ay + 30)
    g.rotate(0.05)
    g.fillStyle = 'rgba(0,0,0,.08)'
    g.fillRect(-32, -26, 68, 58)
    g.fillStyle = '#ffffff'
    g.fillRect(-34, -30, 68, 58)
    g.fillStyle = '#ffd43b'
    g.beginPath()
    g.arc(-14, -12, 9, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#ffd43b'
    g.lineWidth = 2
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      g.beginPath()
      g.moveTo(-14 + Math.cos(a) * 12, -12 + Math.sin(a) * 12)
      g.lineTo(-14 + Math.cos(a) * 16, -12 + Math.sin(a) * 16)
      g.stroke()
    }
    // じしゃくの え
    g.lineWidth = 5
    g.lineCap = 'round'
    g.strokeStyle = '#ff5d6c'
    g.beginPath()
    g.arc(14, 6, 10, Math.PI, Math.PI * 1.5)
    g.lineTo(14, -4)
    g.moveTo(4, 6)
    g.lineTo(4, 16)
    g.stroke()
    g.strokeStyle = '#4c8dff'
    g.beginPath()
    g.arc(14, 6, 10, Math.PI * 1.5, 0)
    g.lineTo(24, 16)
    g.stroke()
    g.fillStyle = '#6ad08a'
    g.fillRect(-30, 18, 60, 6)
    // がびょう
    g.fillStyle = '#ff5d73'
    g.beginPath()
    g.arc(0, -27, 3, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
  paintWallShelf(g, w, wainY)
  // つくえ
  const top = groundY
  g.fillStyle = lin(g, 0, top, 0, top + 12, [[0, '#e7a867'], [1, '#d18f4e']])
  g.fillRect(e.x0, top, ew, 12)
  g.fillStyle = 'rgba(120,60,20,.14)'
  for (let i = 0; i < 9; i++) {
    const y = top + 2 + (i % 4) * 2.6
    const x0 = hash(i) * w
    g.fillRect(x0, y, 60 + hash(i + 9) * 120, 0.9)
  }
  g.fillStyle = lin(g, 0, top + 12, 0, top + 30, [[0, '#b8733a'], [0.4, '#c88449'], [1, '#9b5a28']])
  g.fillRect(e.x0, top + 12, ew, 18)
  g.fillStyle = 'rgba(255,255,255,.35)'
  g.fillRect(e.x0, top + 12, ew, 1.5)
  g.fillStyle = lin(g, 0, top + 30, 0, e.y1, [[0, '#8c5226'], [0.08, '#b57440'], [1, '#a4652f']])
  g.fillRect(e.x0, top + 30, ew, e.y1 - top - 30)
  // ひきだし
  const dw = Math.min(260, w * 0.6), dx = w / 2 - dw / 2, dy = top + 42
  const dh = Math.min(h - dy - 16, 90)
  if (dh > 30) {
    rr(g, dx, dy, dw, dh, 8)
    g.fillStyle = lin(g, 0, dy, 0, dy + dh, [[0, '#c7864c'], [1, '#b0703a']])
    g.fill()
    g.lineWidth = 2
    g.strokeStyle = 'rgba(90,40,10,.35)'
    g.stroke()
    rr(g, w / 2 - 22, dy + dh * 0.42, 44, 10, 5)
    g.fillStyle = '#f2d2a2'
    g.fill()
    g.strokeStyle = 'rgba(90,40,10,.4)'
    g.lineWidth = 1.4
    g.stroke()
  }
  // つくえの かげ（まどから の ひかり）
  g.fillStyle = 'rgba(255,255,255,.14)'
  g.beginPath()
  g.moveTo(winX + winW * 0.2, top)
  g.lineTo(winX + winW * 1.2, top)
  g.lineTo(winX + winW * 1.35, top + 12)
  g.lineTo(winX + winW * 0.35, top + 12)
  g.closePath()
  g.fill()
}

function paintSandBack(g: G, world: World, e: Ext) {
  const { w, h, groundY } = world
  const ew = e.x1 - e.x0
  g.fillStyle = lin(g, 0, 0, 0, groundY, [[0, '#6cc6ff'], [0.7, '#bfe9ff'], [1, '#e9f8ff']])
  g.fillRect(e.x0, e.y0, ew, groundY - e.y0)
  // おひさま
  const sx = w * 0.84, sy = Math.max(70, h * 0.13)
  const glow = g.createRadialGradient(sx, sy, 10, sx, sy, 90)
  glow.addColorStop(0, 'rgba(255,250,210,.95)')
  glow.addColorStop(0.3, 'rgba(255,240,170,.5)')
  glow.addColorStop(1, 'rgba(255,240,170,0)')
  g.fillStyle = glow
  g.fillRect(sx - 90, sy - 90, 180, 180)
  g.fillStyle = '#fff3b0'
  g.beginPath()
  g.arc(sx, sy, 22, 0, Math.PI * 2)
  g.fill()
  cloud(g, w * 0.08, h * 0.16, 1.1)
  cloud(g, w * 0.5, h * 0.24, 0.8, 0.9)
  // とおくの おか と き
  const hillY = groundY - Math.min(120, (groundY - 80) * 0.35)
  g.fillStyle = '#a9e08c'
  g.beginPath()
  g.moveTo(snap(e.x0, 20), groundY)
  for (let x = snap(e.x0, 20); x <= e.x1 + 20; x += 20) g.lineTo(x, hillY + 20 - Math.sin(x * 0.012 + 1) * 22 - Math.sin(x * 0.031) * 8)
  g.lineTo(e.x1 + 20, groundY)
  g.closePath()
  g.fill()
  for (let i = Math.floor((e.x0 - 100) / 110); i < Math.ceil(e.x1 / 110); i++) {
    const x = 40 + i * 110 + hash(i) * 40
    const ty = hillY + 16 - Math.sin(x * 0.012 + 1) * 22
    g.fillStyle = '#9b6b3f'
    g.fillRect(x - 3, ty - 16, 6, 26)
    for (const [dx, dy, r, c] of [[0, -32, 20, '#4fb35f'], [-12, -22, 14, '#5cc56c'], [12, -24, 15, '#46a656'], [0, -44, 12, '#6ad079']] as [number, number, number, string][]) {
      g.fillStyle = c
      g.beginPath()
      g.arc(x + dx, ty + dy, r, 0, Math.PI * 2)
      g.fill()
    }
  }
  // さく
  const fy = groundY - 34
  g.fillStyle = '#ffffff'
  for (let x = snap(e.x0, 22) + 6; x < e.x1; x += 22) {
    rr(g, x, fy - 6, 10, 40, 4)
    g.fill()
  }
  g.fillRect(e.x0, fy + 4, ew, 5)
  g.fillRect(e.x0, fy + 20, ew, 5)
  g.fillStyle = 'rgba(80,120,160,.15)'
  g.fillRect(e.x0, fy + 9, ew, 2)
  // すな
  g.fillStyle = lin(g, 0, groundY, 0, h, [[0, '#f8dea6'], [0.25, '#efcd8c'], [1, '#e2b774']])
  g.fillRect(e.x0, groundY, ew, e.y1 - groundY)
  g.fillStyle = 'rgba(255,255,255,.35)'
  g.fillRect(e.x0, groundY, ew, 2)
  for (let i = 0; i < ew * (h - groundY) * 0.012; i++) {
    const x = e.x0 + hash(i * 3.1) * ew, y = groundY + 3 + hash(i * 7.7) * (h - groundY)
    g.fillStyle = hash(i * 1.3) > 0.5 ? 'rgba(160,110,50,.25)' : 'rgba(255,255,255,.35)'
    g.fillRect(x, y, 1.4, 1.4)
  }
  // すなばの わく（まえ）
  const by = groundY + Math.min(60, (h - groundY) * 0.35)
  g.fillStyle = lin(g, 0, by, 0, by + 26, [[0, '#d99456'], [1, '#b8733a']])
  g.fillRect(e.x0, by, ew, 26)
  g.fillStyle = 'rgba(255,255,255,.3)'
  g.fillRect(e.x0, by, ew, 2)
  g.fillStyle = 'rgba(90,40,10,.25)'
  for (let x = snap(e.x0, 120) + 60; x < e.x1; x += 120) g.fillRect(x, by + 2, 2, 24)
  g.fillStyle = lin(g, 0, by + 26, 0, h, [[0, '#9fd27a'], [1, '#7fbf5c']])
  g.fillRect(e.x0, by + 26, ew, e.y1 - by - 26)
}

function paintSeaBack(g: G, world: World, e: Ext) {
  const { w, groundY } = world
  const ew = e.x1 - e.x0
  const wy = world.waterY ?? 0
  g.fillStyle = lin(g, 0, 0, 0, wy, [[0, '#7fd0ff'], [1, '#d9f4ff']])
  g.fillRect(e.x0, e.y0, ew, wy - e.y0)
  cloud(g, w * 0.12, wy * 0.45, 0.8, 0.95)
  cloud(g, w * 0.66, wy * 0.3, 0.6, 0.8)
  // とおくの しま
  g.fillStyle = '#8fd49a'
  g.beginPath()
  g.ellipse(w * 0.8, wy, 60, 16, 0, Math.PI, 0)
  g.fill()
  g.fillStyle = lin(g, 0, wy - 6, 0, groundY, [[0, '#6fdcf5'], [0.3, '#2fb0e0'], [0.75, '#1d82c4'], [1, '#176aa8']])
  g.fillRect(e.x0, wy - 6, ew, groundY - wy + 6)
  // うみの そこの さんご
  for (let i = Math.floor((e.x0 - 70) / 90); i < Math.ceil(e.x1 / 90); i++) {
    const x = 30 + i * 90 + hash(i + 3) * 40
    const base = groundY + 2
    const color = ['#ff8fb1', '#ffb36b', '#c89bff'][((i % 3) + 3) % 3]
    g.strokeStyle = color
    g.lineCap = 'round'
    g.lineWidth = 5
    const branch = (x0: number, y0: number, a: number, len: number, depth: number) => {
      const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len
      g.beginPath()
      g.moveTo(x0, y0)
      g.lineTo(x1, y1)
      g.lineWidth = 2 + depth * 1.4
      g.stroke()
      if (depth > 0) {
        branch(x1, y1, a - 0.45, len * 0.72, depth - 1)
        branch(x1, y1, a + 0.4, len * 0.7, depth - 1)
      }
    }
    g.globalAlpha = 0.75
    branch(x, base, -Math.PI / 2 + (hash(i) - 0.5) * 0.4, 12 + hash(i + 1) * 8, 2)
    g.globalAlpha = 1
  }
  // すな
  g.fillStyle = lin(g, 0, groundY - 4, 0, world.h, [[0, '#f5dca6'], [0.4, '#e6c283'], [1, '#d3a866']])
  g.beginPath()
  g.moveTo(snap(e.x0, 12), e.y1)
  for (let x = snap(e.x0, 12); x <= e.x1 + 12; x += 12) g.lineTo(x, groundY + Math.sin(x * 0.05) * 1.2)
  g.lineTo(e.x1 + 12, e.y1)
  g.closePath()
  g.fill()
  g.strokeStyle = 'rgba(160,110,50,.25)'
  g.lineWidth = 1
  for (let k = 0; k < 3; k++) {
    g.beginPath()
    for (let x = snap(e.x0, 8); x <= e.x1; x += 8) g.lineTo(x, groundY + 10 + k * 12 + Math.sin(x * 0.08 + k) * 2)
    g.stroke()
  }
}

function paintPropBack(g: G, p: PropBody) {
  const { def, cx, x0, top, bottom } = p
  if (def.kind === 'books') {
    const colors = [['#ff7b7b', '#d94a4a'], ['#5fb3ff', '#2f7fd6'], ['#ffd15c', '#e0a52a']]
    const bh = def.h / 3
    for (let i = 0; i < 3; i++) {
      const y = bottom - (i + 1) * bh
      const inset = [0, 5, 2][i]
      const bw = def.w - inset * 2 - (i === 1 ? 6 : 0)
      const bx = x0 + inset + (i === 2 ? 4 : 0)
      rr(g, bx, y, bw, bh, 3)
      g.fillStyle = lin(g, 0, y, 0, y + bh, [[0, colors[i][0]], [1, colors[i][1]]])
      g.fill()
      g.lineWidth = 1.3
      g.strokeStyle = 'rgba(59,42,74,.5)'
      g.stroke()
      // かみの ページ
      g.fillStyle = '#fffaf0'
      g.fillRect(bx + bw - 10, y + 2.5, 7, bh - 5)
      g.fillStyle = 'rgba(150,120,80,.3)'
      for (let k = 0; k < 3; k++) g.fillRect(bx + bw - 10, y + 4 + k * 3, 7, 0.7)
      g.fillStyle = 'rgba(255,255,255,.5)'
      g.fillRect(bx + 8, y + bh * 0.35, bw * 0.35, 2.4)
    }
    return
  }
  if (def.kind === 'cup' || def.kind === 'bucket') {
    // うちがわ（すこし くらい）
    rr(g, x0 + 3, top + 2, def.w - 6, def.h - 3, 6)
    g.fillStyle = def.kind === 'cup' ? 'rgba(150,200,230,.35)' : 'rgba(120,190,255,.3)'
    g.fill()
    g.beginPath()
    g.ellipse(cx, top + 2, def.w / 2 - 1, 4, 0, 0, Math.PI * 2)
    g.fillStyle = 'rgba(60,90,120,.25)'
    g.fill()
    return
  }
  if (def.kind === 'chest') {
    // ふた（うしろへ ぱかっと ひらいている。うちがわが みえる）
    const lidH = def.h * 0.75
    g.save()
    g.translate(cx, top + 2)
    g.beginPath()
    g.moveTo(-def.w / 2 + 2, 0)
    g.lineTo(-def.w / 2 - 3, -lidH)
    g.quadraticCurveTo(0, -lidH - 12, def.w / 2 + 3, -lidH)
    g.lineTo(def.w / 2 - 2, 0)
    g.closePath()
    g.fillStyle = lin(g, 0, -lidH, 0, 0, [[0, '#7a4520'], [1, '#4a2a12']])
    g.fill()
    g.lineWidth = 1.5
    g.strokeStyle = INK
    g.lineJoin = 'round'
    g.stroke()
    g.fillStyle = 'rgba(0,0,0,.25)'
    g.beginPath()
    g.moveTo(-def.w / 2 + 6, -3)
    g.lineTo(-def.w / 2 + 3, -lidH + 5)
    g.quadraticCurveTo(0, -lidH - 5, def.w / 2 - 3, -lidH + 5)
    g.lineTo(def.w / 2 - 6, -3)
    g.closePath()
    g.fill()
    g.fillStyle = '#ffd43b'
    for (const bx of [-def.w * 0.3, def.w * 0.3]) {
      g.beginPath()
      g.moveTo(bx - 2.5, 0)
      g.lineTo(bx * 1.1 - 2.5, -lidH - 3)
      g.lineTo(bx * 1.1 + 2.5, -lidH - 3)
      g.lineTo(bx + 2.5, 0)
      g.closePath()
      g.fill()
    }
    g.restore()
    rr(g, x0, top, def.w, def.h, 4)
    g.fillStyle = '#4a2a12'
    g.fill()
    // きんか
    for (let i = 0; i < 7; i++) {
      g.beginPath()
      g.ellipse(x0 + 10 + i * 7, bottom - 8 - (i % 2) * 2, 5, 2.2, 0, 0, Math.PI * 2)
      g.fillStyle = '#ffd43b'
      g.fill()
    }
    return
  }
  if (def.kind === 'rock' && p.poly) {
    g.beginPath()
    p.poly.forEach((q, i) => (i === 0 ? g.moveTo(cx + q.x, bottom + q.y + 1) : g.lineTo(cx + q.x, bottom + q.y + 1)))
    g.closePath()
    g.fillStyle = lin(g, 0, top, 0, bottom, [[0, '#8fa3b8'], [1, '#56687d']])
    g.fill()
    g.lineWidth = 1.6
    g.strokeStyle = 'rgba(30,40,60,.55)'
    g.lineJoin = 'round'
    g.stroke()
    g.save()
    g.clip()
    g.fillStyle = 'rgba(255,255,255,.18)'
    g.beginPath()
    g.ellipse(cx - def.w * 0.12, top + def.h * 0.3, def.w * 0.22, def.h * 0.16, -0.2, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#5fbf7a'
    for (let i = 0; i < 6; i++) {
      g.beginPath()
      g.arc(cx - def.w * 0.3 + i * def.w * 0.1, top + def.h * 0.08 + Math.abs(i - 2.5) * 3, 3.5, 0, Math.PI * 2)
      g.fill()
    }
    g.restore()
    return
  }
  if (def.kind === 'frame') {
    rr(g, x0, top, def.w, def.h + 30, 3)
    g.fillStyle = lin(g, x0, 0, x0 + def.w, 0, [[0, '#c98246'], [0.5, '#e0a064'], [1, '#b0703a']])
    g.fill()
    g.lineWidth = 1.4
    g.strokeStyle = 'rgba(90,40,10,.45)'
    g.stroke()
  }
}

/** いれものの まえがわ（なかの ものが すけて みえる）。 */
function paintPropFront(g: G, p: PropBody) {
  const { def, cx, x0, top, bottom } = p
  if (def.kind === 'cup') {
    rr(g, x0, top, def.w, def.h, 7)
    g.fillStyle = 'rgba(200,235,255,.28)'
    g.fill()
    g.lineWidth = 2
    g.strokeStyle = 'rgba(80,130,170,.7)'
    g.stroke()
    g.fillStyle = 'rgba(255,255,255,.55)'
    rr(g, x0 + 5, top + 6, 4, def.h - 14, 2)
    g.fill()
    rr(g, x0 + 11, top + 8, 2, def.h * 0.35, 1)
    g.fill()
    // ぐるっと もよう
    g.fillStyle = 'rgba(255,120,150,.55)'
    for (let i = 0; i < 4; i++) {
      g.beginPath()
      g.arc(x0 + 10 + i * 9, bottom - 12, 2.2, 0, Math.PI * 2)
      g.fill()
    }
    g.beginPath()
    g.ellipse(cx, top, def.w / 2, 3.5, 0, 0, Math.PI * 2)
    g.lineWidth = 1.6
    g.strokeStyle = 'rgba(80,130,170,.7)'
    g.stroke()
    return
  }
  if (def.kind === 'bucket') {
    g.beginPath()
    g.moveTo(x0 - 3, top)
    g.lineTo(x0 + def.w + 3, top)
    g.lineTo(x0 + def.w - 3, bottom)
    g.lineTo(x0 + 3, bottom)
    g.closePath()
    g.fillStyle = 'rgba(90,170,255,.32)'
    g.fill()
    g.lineWidth = 2
    g.strokeStyle = 'rgba(30,100,200,.75)'
    g.stroke()
    g.fillStyle = 'rgba(60,140,255,.7)'
    g.fillRect(x0 - 3, top, def.w + 6, 5)
    g.fillStyle = 'rgba(255,255,255,.5)'
    g.fillRect(x0 + 5, top + 8, 4, def.h - 16)
    // もちて
    g.beginPath()
    g.arc(cx, top + 2, def.w / 2 + 2, Math.PI, 0)
    g.lineWidth = 1.8
    g.strokeStyle = 'rgba(30,100,200,.6)'
    g.stroke()
    return
  }
  if (def.kind === 'chest') {
    const fh = def.h * 0.62
    rr(g, x0, bottom - fh, def.w, fh, 4)
    g.fillStyle = lin(g, 0, bottom - fh, 0, bottom, [[0, '#c7864c'], [1, '#9b5a28']])
    g.fill()
    g.lineWidth = 1.5
    g.strokeStyle = INK
    g.stroke()
    g.fillStyle = '#ffd43b'
    g.fillRect(x0 + 8, bottom - fh, 5, fh)
    g.fillRect(x0 + def.w - 13, bottom - fh, 5, fh)
    rr(g, cx - 5, bottom - fh + 3, 10, 9, 2)
    g.fill()
    g.fillStyle = INK
    g.fillRect(cx - 1, bottom - fh + 6, 2, 4)
  }
}

function paintBack(g: G, world: World, e: Ext) {
  if (world.stage.water) paintSeaBack(g, world, e)
  else if (world.stage.sand) paintSandBack(g, world, e)
  else paintDeskBack(g, world, e)
  for (const p of world.props) paintPropBack(g, p)
}

// ---------------- えの ストック ----------------

type Sprite = { canvas: Canvas; half: number; scale: number }

export class Painter {
  private bg: Canvas | null = null
  private bgKey = ''
  private sprites = new Map<string, Sprite>()
  private spriteScale = 0

  /** うごきを へらす せってい（ぷるぷる・のこりかげ・ぷにっ を かかない）。 */
  calm = false

  constructor(private world: World) {}

  private sprite(kind: KindId, variant: number, px: number): Sprite | null {
    if (px !== this.spriteScale) {
      this.sprites.clear()
      this.spriteScale = px
    }
    const key = `${kind}:${variant}`
    const hit = this.sprites.get(key)
    if (hit) return hit
    const it = this.world.items.find((i) => i.kind.id === kind)
    const shape = it?.kind.shape
    const half = Math.ceil((shape ? shapeRadius(shape) : 20) + 6)
    const size = Math.ceil(half * 2 * px)
    try {
      const canvas = makeCanvas(size, size)
      const g = ctx2d(canvas)
      g.setTransform(px, 0, 0, px, size / 2, size / 2)
      drawItemArt(g, kind, variant, shape ? shapePoints(shape) : [])
      const sp = { canvas, half, scale: px }
      this.sprites.set(key, sp)
      return sp
    } catch {
      return null
    }
  }

  private background(view: View): Canvas | null {
    const W = Math.round(view.cssW * view.dpr), H = Math.round(view.cssH * view.dpr)
    const key = `${W}x${H}:${view.scale.toFixed(4)}:${view.ox.toFixed(1)}:${view.oy.toFixed(1)}`
    if (this.bg && this.bgKey === key) return this.bg
    try {
      const canvas = makeCanvas(W, H)
      const g = ctx2d(canvas)
      const px = view.scale * view.dpr
      g.setTransform(px, 0, 0, px, view.ox * view.dpr, view.oy * view.dpr)
      paintBack(g, this.world, viewExt(view))
      this.bg = canvas
      this.bgKey = key
      return canvas
    } catch {
      return null
    }
  }

  /** direct = けしきを とっておかず その場で かく（しゃしん用。大きく ずーむ しても メモリを つかわない）。 */
  draw(g: G, world: World, view: View, time: number, fx: Fx, direct = false) {
    this.world = world
    const px = view.scale * view.dpr
    g.setTransform(1, 0, 0, 1, 0, 0)
    if (direct) {
      g.setTransform(px, 0, 0, px, view.ox * view.dpr, view.oy * view.dpr)
      paintBack(g, world, viewExt(view))
    } else {
      const bg = this.background(view)
      if (bg) g.drawImage(bg as CanvasImageSource, 0, 0)
    }
    g.setTransform(px, 0, 0, px, view.ox * view.dpr, view.oy * view.dpr)

    if (world.waterY !== null) drawSeaBehind(g, world, time)
    drawAmbient(g, world, time)
    drawShadows(g, world)
    if (world.sand) this.drawBuried(g, world, time, px)
    for (const it of world.items) if (it.state === 'body') this.drawItem(g, it, time, px)
    if (world.sand) drawLyingSand(g, world)
    for (const p of world.props) paintPropFront(g, p)
    drawFieldLines(g, world, time)
    if (world.waterY !== null) drawLine(g, world)
    this.drawMagnet(g, world, time, px)
    if (world.sand) drawStuckSand(g, world, time)
    for (const it of world.stuckOrder) this.drawItem(g, it, time, px)
    for (const it of world.items) if (it.star && it.state === 'body') {
      const t = (time * 0.9 + it.id * 0.37) % 1
      if (t < 0.3) twinkle(g, it.x + 9, it.y - 9, 4 * Math.sin((t / 0.3) * Math.PI), 0.9)
    }
    if (world.waterY !== null) drawSeaFront(g, world, time)
    drawFx(g, fx, world)
    if (fx.flash > 0) {
      g.fillStyle = `rgba(255,255,240,${fx.flash * 0.35})`
      g.fillRect(0, 0, world.w, world.h)
    }
  }

  /** すなから すこし のぞいている もの（こんもり＋きらっ）。 */
  private drawBuried(g: G, world: World, time: number, px: number) {
    const y0 = world.groundY
    for (const it of world.items) {
      if (it.state !== 'buried') continue
      const k = clamp(it.pull / 0.9, 0, 1)
      const shake = k > 0.15 ? Math.sin(time * 50 + it.id) * k * 1.6 : 0
      const rise = k * k * 5
      g.save()
      g.beginPath()
      g.rect(it.x - 40, y0 - 60, 80, 60.5)
      g.clip()
      g.translate(it.x + shake, it.y - rise)
      g.rotate(it.angle + shake * 0.03)
      const sp = this.sprite(it.kind.id, it.variant, px)
      if (sp) g.drawImage(sp.canvas as CanvasImageSource, -sp.half, -sp.half, sp.half * 2, sp.half * 2)
      g.restore()
      // まわりの すなが すこし もりあがる
      const mx = it.x + shake * 0.5
      g.fillStyle = 'rgba(190,140,70,.35)'
      g.beginPath()
      g.ellipse(mx, y0 + 1.2, 15 + k * 3, 2.2, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#f8dfa8'
      g.beginPath()
      g.ellipse(mx - 9, y0 + 0.6, 6, 1.8 + k * 1.2, 0, Math.PI, 0)
      g.ellipse(mx + 9, y0 + 0.6, 6, 1.8 + k * 1.2, 0, Math.PI, 0)
      g.fill()
      const t = (time * 0.45 + it.id * 0.29) % 1
      if (t < 0.16 || k > 0.3) twinkle(g, it.x + 7 + shake, y0 - 7 - rise, k > 0.3 ? 4.5 + Math.sin(time * 20) : 4 * Math.sin((t / 0.16) * Math.PI), 0.95)
    }
  }

  /** じしゃく（からだは とっておいた え、かおは まいコマ）。 */
  private drawMagnet(g: G, world: World, time: number, px: number) {
    const m = world.magnet
    const blinkT = time % 3.6
    const blink = blinkT < 0.14 ? Math.sin((blinkT / 0.14) * Math.PI) : 0
    g.save()
    g.translate(m.x, m.y)
    g.rotate(m.tilt)
    const j = this.calm ? 0 : m.jolt
    g.scale(1 + j * 0.05, 1 - j * 0.06)
    const body = this.magnetSprite(px)
    const pad = 4
    if (body) g.drawImage(body as CanvasImageSource, -MAGNET_HALF_W - pad, -MAGNET_H - pad, MAGNET_HALF_W * 2 + pad * 2, MAGNET_H + pad * 2)
    else drawMagnetBody(g)
    drawMagnetFace(g, {
      mood: m.mood, blink, time,
      lookX: clamp((m.lookX - m.x) / 90, -1, 1),
      lookY: clamp((m.lookY - (m.y - MAGNET_H * 0.6)) / 90, -1, 1),
    })
    g.restore()
  }

  private magnetBody: Canvas | null = null
  private magnetScale = 0

  private magnetSprite(px: number): Canvas | null {
    if (this.magnetBody && this.magnetScale === px) return this.magnetBody
    try {
      const pad = 4
      const k = px * 1.1
      const canvas = makeCanvas(Math.ceil((MAGNET_HALF_W * 2 + pad * 2) * k), Math.ceil((MAGNET_H + pad * 2) * k))
      const g = ctx2d(canvas)
      g.setTransform(k, 0, 0, k, (MAGNET_HALF_W + pad) * k, (MAGNET_H + pad) * k)
      drawMagnetBody(g)
      this.magnetBody = canvas
      this.magnetScale = px
      return canvas
    } catch {
      return null
    }
  }

  private drawItem(g: G, it: Item, time: number, px: number) {
    let x = it.x + it.snapX, y = it.y + it.snapY, angle = it.angle
    // もうすこしで とびつく ときの ぷるぷる・ぴょこぴょこ。
    if (!this.calm && it.state === 'body' && it.kind.magnetic && !it.swim && it.pull > 0.25 && it.pull < 1.2 && it.body && Math.abs(it.body.velocity.y) < 1.5) {
      const k = clamp((it.pull - 0.25) / 0.75, 0, 1)
      x += Math.sin(time * 58 + it.id * 3) * 1.4 * k
      y -= Math.abs(Math.sin(time * 16 + it.id)) * 2.6 * k * k
      angle += Math.sin(time * 43 + it.id) * 0.08 * k
    }
    // じしゃくへ とんでいく ときの すばやい のこりかげ。
    const v = it.state === 'body' && it.kind.magnetic && it.body ? it.body.velocity : null
    if (!this.calm && v && v.x * v.x + v.y * v.y > 16 && it.kind.id !== 'fish') {
      const sp = this.sprite(it.kind.id, it.variant, px)
      if (sp) {
        for (let k = 3; k >= 1; k--) {
          g.save()
          g.globalAlpha = 0.22 / k
          g.translate(x - v.x * k * 0.8, y - v.y * k * 0.8)
          g.rotate(angle)
          g.drawImage(sp.canvas as CanvasImageSource, -sp.half, -sp.half, sp.half * 2, sp.half * 2)
          g.restore()
        }
      }
    }
    g.save()
    g.translate(x, y)
    g.rotate(angle)
    if (it.kind.id === 'fish') {
      if (it.flip) g.scale(1, -1)
      const fast = it.state === 'stuck' ? 2.4 : it.pull > 0.4 ? 1.8 : 1
      drawFish(g, it.variant, Math.sin(time * 9 * fast + it.id * 1.7), it.state === 'stuck' ? 0.6 : 0)
    } else if (it.kind.id === 'jelly') {
      drawJelly(g, time + it.id)
    } else {
      const sp = this.sprite(it.kind.id, it.variant, px)
      if (sp) g.drawImage(sp.canvas as CanvasImageSource, -sp.half, -sp.half, sp.half * 2, sp.half * 2)
      else drawItemArt(g, it.kind.id, it.variant, shapePoints(it.kind.shape))
    }
    g.restore()
  }
}

/** けしきの なかの ちいさな いきもの・ひかり（さわれない）。 */
function drawAmbient(g: G, world: World, time: number) {
  const { w, h, groundY } = world
  if (world.waterY !== null) {
    // とおくを およぐ さかなの むれ
    const wy = world.waterY
    g.fillStyle = 'rgba(20,80,140,.22)'
    for (let school = 0; school < 2; school++) {
      const span = w + 200
      const baseX = ((time * (14 + school * 6) + school * 300) % span) - 100
      const x0 = school ? w - baseX : baseX
      const y0 = wy + (groundY - wy) * (0.3 + school * 0.25)
      for (let k = 0; k < 6; k++) {
        const fx = x0 + (k % 3) * 16 * (school ? 1 : -1) + Math.sin(time * 2 + k) * 2
        const fy = y0 + Math.floor(k / 3) * 12 + (k % 3) * 4 + Math.sin(time * 1.5 + k * 1.3) * 3
        g.save()
        g.translate(fx, fy)
        if (school) g.scale(-1, 1)
        g.beginPath()
        g.ellipse(0, 0, 6, 2.6, 0, 0, Math.PI * 2)
        g.moveTo(-5, 0)
        g.lineTo(-10, -3)
        g.lineTo(-10, 3)
        g.closePath()
        g.fill()
        g.restore()
      }
    }
    return
  }
  if (world.stage.sand) {
    // ちょうちょ
    for (let i = 0; i < 2; i++) {
      const t = time * (0.35 + i * 0.1) + i * 2.4
      const x = w * (0.5 + 0.42 * Math.sin(t * 0.9 + i)) 
      const y = groundY - 120 - i * 70 + Math.sin(t * 2.3) * 26 + Math.sin(t * 5.1) * 6
      const flap = Math.abs(Math.sin(time * 14 + i * 3))
      g.save()
      g.translate(x, y)
      g.rotate(Math.cos(t * 0.9 + i) * 0.35)
      g.fillStyle = i ? '#ffb3d1' : '#ffe066'
      for (const side of [-1, 1]) {
        g.beginPath()
        g.ellipse(side * 4 * flap, -2, 4.5 * flap + 0.8, 5.5, side * 0.4, 0, Math.PI * 2)
        g.fill()
        g.beginPath()
        g.ellipse(side * 3 * flap, 3.5, 3.2 * flap + 0.6, 3.6, side * 0.6, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = INK
      g.fillRect(-0.8, -5, 1.6, 10)
      g.restore()
    }
    return
  }
  // まどから はいる ひかりの ちり
  g.fillStyle = 'rgba(255,250,220,.75)'
  for (let i = 0; i < 12; i++) {
    const t = time * 0.12 + i * 0.618
    const x = (hash(i) * w * 0.6 + Math.sin(t * 2 + i) * 20 + t * 12) % (w * 0.7)
    const y = h * 0.2 + ((hash(i + 7) * (groundY - h * 0.2) - t * 18) % (groundY - h * 0.2) + (groundY - h * 0.2)) % (groundY - h * 0.2)
    const a = 0.3 + 0.7 * Math.abs(Math.sin(time * 1.3 + i))
    g.globalAlpha = a * 0.6
    g.beginPath()
    g.arc(x, y, 1.2 + hash(i + 3), 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
}

function drawShadows(g: G, world: World) {
  const m = world.magnet
  const soft = world.waterY !== null ? 0.5 : 1
  const floorM = shadowFloorAt(world, m.x)
  const hM = Math.max(0, floorM - m.y)
  const aM = clamp(0.3 * (1 - hM / 380), 0, 0.3) * soft
  if (aM > 0.01) {
    const wM = 44 + hM * 0.12
    const grad = g.createRadialGradient(m.x, floorM, 1, m.x, floorM, wM)
    grad.addColorStop(0, `rgba(60,30,40,${aM})`)
    grad.addColorStop(1, 'rgba(60,30,40,0)')
    g.fillStyle = grad
    g.save()
    g.translate(m.x, floorM)
    g.scale(1, 0.16)
    g.translate(-m.x, -floorM)
    g.beginPath()
    g.arc(m.x, floorM, wM, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
  for (const it of world.items) {
    if (it.state === 'buried') continue
    const r = shapeRadius(it.kind.shape)
    const f = shadowFloorAt(world, it.x)
    const hgt = Math.max(0, f - (it.y + r * 0.6))
    const a = clamp(0.22 * (1 - hgt / 160), 0, 0.22) * soft
    if (a < 0.01) continue
    g.fillStyle = `rgba(60,30,40,${a})`
    g.beginPath()
    g.ellipse(it.x, f - 0.5, r * (0.9 + hgt * 0.004), 2.4, 0, 0, Math.PI * 2)
    g.fill()
  }
}

function drawLyingSand(g: G, world: World) {
  const s = world.sand!
  for (let i = 0; i < s.n; i++) {
    const st = s.st[i]
    if (st >= 2) continue
    g.fillStyle = s.seed[i] > 0.5 ? '#2d2a33' : '#4a4652'
    const sz = 1.4 + s.seed[i] * 0.9
    g.fillRect(s.x[i] - sz / 2, s.y[i] - sz / 2, sz, sz)
  }
}

function drawStuckSand(g: G, world: World, time: number) {
  const s = world.sand!
  const m = world.magnet
  const c = Math.cos(m.tilt), sn = Math.sin(m.tilt)
  const bend = clamp(-m.vx * 0.0006, -0.35, 0.35)
  for (let i = 0; i < s.n; i++) {
    if (s.st[i] !== 2) continue
    const sp = s.spikes[s.spike[i]]
    const k = s.slot[i]
    const dir = sp.dir + bend * (k / 10) + Math.sin(time * 6 + i) * 0.02
    const r = 1.2 + k * 2.1
    const lx = sp.bx + Math.cos(dir) * r + (s.seed[i] - 0.5) * 1.6
    const ly = sp.by + Math.sin(dir) * r + (s.seed[i] - 0.5) * 1.2
    const x = m.x + lx * c - ly * sn, y = m.y + lx * sn + ly * c
    g.fillStyle = s.seed[i] > 0.5 ? '#26232c' : '#46424f'
    const sz = 2.2 - k * 0.09
    g.fillRect(x - sz / 2, y - sz / 2, sz, sz)
  }
}

function drawFieldLines(g: G, world: World, time: number) {
  const m = world.magnet
  const a = 0.1 + m.activity * 0.5
  g.save()
  g.translate(m.x, m.y)
  g.rotate(m.tilt)
  const nX = -MAGNET_HALF_W + ARM_W / 2, sX = MAGNET_HALF_W - ARM_W / 2
  // ポールの ひかり
  for (const x of [nX, sX]) {
    const grad = g.createRadialGradient(x, 2, 1, x, 2, 26 + m.activity * 14)
    grad.addColorStop(0, `rgba(255,255,220,${0.25 + m.activity * 0.4})`)
    grad.addColorStop(1, 'rgba(255,255,220,0)')
    g.fillStyle = grad
    g.beginPath()
    g.arc(x, 2, 26 + m.activity * 14, 0, Math.PI * 2)
    g.fill()
  }
  g.setLineDash([2.5, 6])
  g.lineDashOffset = -time * 22
  g.lineCap = 'round'
  for (let k = 0; k < 4; k++) {
    const depth = 10 + k * 15 + m.activity * 8
    const spread = k * 7
    g.beginPath()
    g.moveTo(nX - 2 - k * 1.5, 1)
    g.bezierCurveTo(nX - spread, depth * 1.35, sX + spread, depth * 1.35, sX + 2 + k * 1.5, 1)
    g.lineWidth = 1.6
    g.strokeStyle = `rgba(255,255,255,${a * (1 - k * 0.17)})`
    g.stroke()
  }
  // そとまわりの せん
  for (let k = 0; k < 2; k++) {
    const r = 20 + k * 18
    g.beginPath()
    g.moveTo(-MAGNET_HALF_W - 1, -TIP_H * 0.5)
    g.bezierCurveTo(-MAGNET_HALF_W - r * 1.4, -TIP_H - r * 0.4, -MAGNET_HALF_W - r * 1.3, r * 1.6, 0, r * 1.9 + 16)
    g.bezierCurveTo(MAGNET_HALF_W + r * 1.3, r * 1.6, MAGNET_HALF_W + r * 1.4, -TIP_H - r * 0.4, MAGNET_HALF_W + 1, -TIP_H * 0.5)
    g.lineWidth = 1.3
    g.strokeStyle = `rgba(255,255,255,${a * 0.45})`
    g.stroke()
  }
  g.restore()
}

function drawLine(g: G, world: World) {
  // つりいと（うえから じしゃくの てっぺんへ）。
  const m = world.magnet
  const top = fromMagnet(m, 0, -MAGNET_H)
  g.beginPath()
  g.moveTo(top.x - m.vx * 0.05, -20)
  g.quadraticCurveTo(top.x - m.vx * 0.08, top.y * 0.5, top.x, top.y)
  g.lineWidth = 1.4
  g.strokeStyle = 'rgba(255,255,255,.85)'
  g.stroke()
  g.beginPath()
  g.arc(top.x, top.y - 2, 3.4, 0, Math.PI * 2)
  g.lineWidth = 2
  g.strokeStyle = '#8b96a8'
  g.stroke()
}

function drawSeaBehind(g: G, world: World, time: number) {
  const wy = world.waterY!
  const { w, groundY } = world
  // ひかりの すじ
  g.save()
  for (let i = 0; i < 5; i++) {
    const x = ((i + 0.5) / 5) * w + Math.sin(time * 0.3 + i * 1.7) * 30
    const sway = Math.sin(time * 0.4 + i) * 40
    g.fillStyle = lin(g, 0, wy, 0, groundY, [[0, 'rgba(255,255,255,.16)'], [1, 'rgba(255,255,255,0)']])
    g.beginPath()
    g.moveTo(x - 14, wy)
    g.lineTo(x + 14, wy)
    g.lineTo(x + 40 + sway, groundY)
    g.lineTo(x - 10 + sway, groundY)
    g.closePath()
    g.fill()
  }
  g.restore()
  // うみくさ
  for (let i = 0; i < Math.ceil(w / 60); i++) {
    const x = 18 + i * 60 + hash(i + 11) * 30
    const hgt = 40 + hash(i + 5) * 50
    drawWeed(g, x, groundY + 2, hgt, time, i, i % 2 ? '#3fae6a' : '#2f9a5a')
  }
  // ゆらゆら ひかり（そこ）
  g.save()
  g.globalAlpha = 0.18
  g.strokeStyle = '#ffffff'
  g.lineWidth = 1.2
  for (let k = 0; k < Math.ceil(w / 24); k++) {
    const x = k * 24 + Math.sin(time * 1.2 + k) * 6
    g.beginPath()
    g.ellipse(x, groundY + 6 + (k % 3) * 5, 8 + Math.sin(time * 2 + k) * 3, 2, 0, 0, Math.PI * 2)
    g.stroke()
  }
  g.restore()
}

function drawWeed(g: G, x: number, base: number, hgt: number, time: number, i: number, color: string) {
  const n = 6
  const pts: [number, number, number][] = []
  for (let k = 0; k <= n; k++) {
    const t = k / n
    pts.push([x + Math.sin(time * 1.3 + i + t * 3) * 7 * t, base - hgt * t, 4.5 * (1 - t) + 0.8])
  }
  g.beginPath()
  pts.forEach(([px, py, r], k) => (k === 0 ? g.moveTo(px - r, py) : g.lineTo(px - r, py)))
  for (let k = pts.length - 1; k >= 0; k--) g.lineTo(pts[k][0] + pts[k][2], pts[k][1])
  g.closePath()
  g.fillStyle = color
  g.fill()
}

function drawSeaFront(g: G, world: World, time: number) {
  const { w } = world
  // みずの おもて
  g.beginPath()
  for (let x = 0; x <= w + 8; x += 8) {
    const y = surfaceY(world, x, time)
    if (x === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.lineWidth = 2.4
  g.strokeStyle = 'rgba(255,255,255,.9)'
  g.stroke()
  g.lineWidth = 6
  g.strokeStyle = 'rgba(255,255,255,.18)'
  g.stroke()
}

/** がめんに くっついた もの だけを かいた ちいさな え（HUD・けっか用）。 */
export function itemIcon(kind: KindId, variant: number, sizePx: number): string | null {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = sizePx
    const g = canvas.getContext('2d')
    if (!g) return null
    const r = kindRadius(kind)
    const s = (sizePx / 2 - 2) / (r + 2)
    g.setTransform(s, 0, 0, s, sizePx / 2, sizePx / 2)
    if (kind === 'fish') drawFish(g, variant, 0.3)
    else if (kind === 'jelly') drawJelly(g, 0.4)
    else drawItemArt(g, kind, variant, kindPoints(kind))
    return canvas.toDataURL()
  } catch {
    return null
  }
}

function kindRadius(kind: KindId) {
  const k = KINDS[kind]
  return k.id === 'fish' ? 22 : shapeRadius(k.shape)
}

function kindPoints(kind: KindId) {
  return shapePoints(KINDS[kind].shape)
}

/** じしゃくと くっついた もの を おおきく うつした しゃしん（けっか がめん用）。 */
export function snapshotMagnet(world: World, time: number, w = 240, h = 190, dpr = 2): string | null {
  try {
    const m = world.magnet
    let x0 = m.x - MAGNET_HALF_W - 8, x1 = m.x + MAGNET_HALF_W + 8
    let y0 = m.y - MAGNET_H - 10, y1 = m.y + 12
    for (const it of world.stuckOrder) {
      const r = shapeRadius(it.kind.shape) + 6
      x0 = Math.min(x0, it.x - r)
      x1 = Math.max(x1, it.x + r)
      y0 = Math.min(y0, it.y - r)
      y1 = Math.max(y1, it.y + r)
    }
    if (world.sand && world.sand.stuck > 0) y1 = Math.max(y1, m.y + 26)
    const scale = Math.min(w / (x1 - x0), h / (y1 - y0), 2.8)
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    const canvas = document.createElement('canvas')
    canvas.width = w * dpr
    canvas.height = h * dpr
    const g = canvas.getContext('2d')
    if (!g) return null
    const view: View = { cssW: w, cssH: h, dpr, scale, ox: w / 2 - cx * scale, oy: h / 2 - cy * scale }
    new Painter(world).draw(g, world, view, time, createFx(), true)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}
