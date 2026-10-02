import { GROUND_Y, SLING, type BallKind, type Material } from './levels'
import type { View } from './camera'
import type { GameEvent, Point, Projectile, Tracked } from './world'

// canvas への 絵の かきかただけを 持つ。ゲームの すすみかたは world.ts が きめる。

export type Particle = {
  kind: 'chip' | 'dust' | 'star' | 'ring' | 'text' | 'confetti'
  x: number; y: number; vx: number; vy: number
  life: number; max: number
  size: number; color: string
  angle: number; spin: number
  text?: string
}

export type Fx = { particles: Particle[]; shake: number }

export const createFx = (): Fx => ({ particles: [], shake: 0 })

const CHIP_COLORS: Record<Material | 'box', string[]> = {
  wood: ['#c98640', '#e2a55f', '#9a6230'],
  ice: ['#e8f8ff', '#b6e4f7', '#ffffff'],
  stone: ['#9aa3ad', '#7b8590', '#c3c9cf'],
  box: ['#ff5d5d', '#ffd23f', '#5ec2ff', '#7bd66f'],
}
const CONFETTI = ['#ff6b6b', '#ffd23f', '#5ec2ff', '#7bd66f', '#c38bff', '#ff9ad5']

/** 0〜1 の きまった ゆらぎ。同じ id なら いつも 同じ もようになる。 */
function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

let seed = 1
function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }

function burst(fx: Fx, x: number, y: number, count: number, make: (i: number) => Partial<Particle> & Pick<Particle, 'kind' | 'color'>) {
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2
    const speed = 1.5 + rand() * 5
    fx.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 2, life: 0, max: 40 + rand() * 30, size: 4 + rand() * 6, angle: rand() * 6, spin: (rand() - .5) * .4, ...make(i) })
  }
}

/** できごとに あわせて はへんや けむりを まく。 */
export function spawnFx(fx: Fx, event: GameEvent) {
  if (fx.particles.length > 500) fx.particles.splice(0, fx.particles.length - 500)
  if (event.type === 'break') {
    const colors = CHIP_COLORS[event.material]
    burst(fx, event.x, event.y, event.material === 'ice' ? 16 : 12, i => ({ kind: 'chip', color: colors[i % colors.length] }))
    burst(fx, event.x, event.y, 5, () => ({ kind: 'dust', color: event.material === 'ice' ? '#ffffff' : '#e9dcc8', size: 10 + rand() * 12, vx: (rand() - .5) * 2, vy: -rand() * 1.5, max: 50 }))
    fx.particles.push(textParticle(event.x, event.y - 10, `+${event.score}`, '#ffffff', 16))
    fx.shake = Math.max(fx.shake, event.material === 'stone' ? 7 : 4)
  } else if (event.type === 'robot') {
    burst(fx, event.x, event.y, 14, i => ({ kind: 'star', color: i % 2 ? '#ffd23f' : '#fff3a8', size: 7 + rand() * 7, max: 50 + rand() * 25 }))
    burst(fx, event.x, event.y, 8, () => ({ kind: 'dust', color: '#ffffff', size: 14 + rand() * 14, vx: (rand() - .5) * 3, vy: (rand() - .5) * 3, max: 45 }))
    fx.particles.push({ kind: 'ring', x: event.x, y: event.y, vx: 0, vy: 0, life: 0, max: 26, size: 70, color: '#fff6c2', angle: 0, spin: 0 })
    fx.particles.push(textParticle(event.x, event.y - 30, `+${event.score}`, '#ffe45c', 30))
    fx.shake = Math.max(fx.shake, 5)
  } else if (event.type === 'blast') {
    fx.particles.push({ kind: 'ring', x: event.x, y: event.y, vx: 0, vy: 0, life: 0, max: 32, size: 230, color: '#ffe066', angle: 0, spin: 0 })
    burst(fx, event.x, event.y, 40, i => ({ kind: 'confetti', color: CONFETTI[i % CONFETTI.length], vx: Math.cos(i) * (3 + rand() * 7), vy: Math.sin(i) * (3 + rand() * 7) - 4, max: 70 + rand() * 40, size: 6 + rand() * 5 }))
    burst(fx, event.x, event.y, 12, () => ({ kind: 'dust', color: '#fff1d6', size: 24 + rand() * 20, max: 55 }))
    fx.particles.push(textParticle(event.x, event.y - 40, 'ボワーン！', '#ff7a45', 40))
    fx.shake = 14
  } else if (event.type === 'hit') {
    const color = event.material === 'ground' ? '#c9a27a' : event.material === 'ice' ? '#ffffff' : '#efe3d0'
    burst(fx, event.x, event.y, Math.round(2 + event.strength * 5), () => ({ kind: 'dust', color, size: 6 + rand() * 8, vx: (rand() - .5) * 3, vy: -rand() * 2, max: 30 }))
    if (event.strength > .6) fx.shake = Math.max(fx.shake, event.strength * 4)
  } else if (event.type === 'split') {
    burst(fx, event.x, event.y, 12, () => ({ kind: 'star', color: '#9fe3ff', size: 5 + rand() * 5, max: 35 }))
  }
}

function textParticle(x: number, y: number, text: string, color: string, size = 22): Particle {
  return { kind: 'text', x, y, vx: 0, vy: -1.1, life: 0, max: 60, size, color, angle: 0, spin: 0, text }
}

export function updateFx(fx: Fx) {
  for (const p of fx.particles) {
    p.life++
    p.x += p.vx
    p.y += p.vy
    p.angle += p.spin
    if (p.kind === 'chip' || p.kind === 'confetti' || p.kind === 'star') {
      p.vy += p.kind === 'confetti' ? .12 : .22
      p.vx *= p.kind === 'confetti' ? .97 : .99
      if (p.y > GROUND_Y - 3 && p.kind === 'chip') { p.y = GROUND_Y - 3; p.vy *= -.35; p.vx *= .7; p.spin *= .6 }
    } else if (p.kind === 'dust') { p.vx *= .94; p.vy *= .94 }
  }
  fx.particles = fx.particles.filter(p => p.life < p.max)
  fx.shake *= .86
  if (fx.shake < .2) fx.shake = 0
}

export type Scene = {
  view: View
  dpr: number
  time: number
  levelWidth: number
  pieces: readonly Tracked[]
  projectiles: readonly Projectile[]
  queue: readonly BallKind[]
  /** ひっぱっている ときの ずれ（ボールの いち − SLING）。 */
  pull: Point | null
  path: readonly Point[]
  trail: readonly Point[]
  currentTrail: readonly Point[]
  fx: Fx
  reducedMotion: boolean
  /** はじめての ステージで「ひっぱる」 うごきを 見せる。 */
  showDragHint: boolean
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { view, dpr, fx } = scene
  const w = view.width * view.scale * dpr
  const h = view.height * view.scale * dpr
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  drawSky(ctx, w, h, scene)
  const shake = scene.reducedMotion ? 0 : fx.shake
  const sx = shake ? (Math.sin(scene.time * 91) * shake) * dpr : 0
  const sy = shake ? (Math.cos(scene.time * 73) * shake) * dpr : 0
  const k = view.scale * dpr
  ctx.setTransform(k, 0, 0, k, -view.left * k + sx, -view.top * k + sy)
  drawGround(ctx, scene)
  drawTrail(ctx, scene.trail, .45)
  drawTrail(ctx, scene.currentTrail, .8)
  drawSlingBack(ctx)
  for (const piece of scene.pieces) {
    if (piece.kind === 'hill') drawHill(ctx, piece)
  }
  const look = scene.projectiles[0]?.body.position ?? { x: SLING.x + (scene.pull?.x ?? 0), y: SLING.y + (scene.pull?.y ?? 0) }
  for (const piece of scene.pieces) {
    if (piece.kind === 'block') drawBlock(ctx, piece)
    else if (piece.kind === 'box') drawBox(ctx, piece, scene.time)
    else if (piece.kind === 'robot') drawRobot(ctx, piece, scene.time, look)
  }
  drawQueue(ctx, scene)
  drawSlingFront(ctx, scene)
  for (const p of scene.projectiles) drawBall(ctx, p.kind, p.body.position.x, p.body.position.y, p.radius, p.body.angle)
  drawAim(ctx, scene)
  if (scene.showDragHint) drawDragHint(ctx, scene.time)
  drawParticles(ctx, fx)
  drawOffscreen(ctx, scene)
}

/** たまを うしろへ ひっぱる ゆびの おてほん。 */
function drawDragHint(ctx: CanvasRenderingContext2D, time: number) {
  const t = (time % 2.2) / 2.2
  const move = t < .2 ? 0 : t < .7 ? (t - .2) / .5 : 1
  const alpha = t < .15 ? t / .15 : t > .85 ? (1 - t) / .15 : 1
  const x = SLING.x - 80 * move, y = SLING.y + 45 * move
  ctx.save()
  ctx.globalAlpha = alpha * .9
  ctx.strokeStyle = 'rgba(255,255,255,.9)'
  ctx.lineWidth = 5
  ctx.setLineDash([2, 10])
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(SLING.x, SLING.y); ctx.lineTo(x, y); ctx.stroke()
  ctx.setLineDash([])
  ctx.font = '44px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('👆', x + 6, y + 6)
  ctx.restore()
}

/** 画面の 上へ とびだした たまの いちを 上はしの しるしで しめす。 */
function drawOffscreen(ctx: CanvasRenderingContext2D, scene: Scene) {
  const top = scene.view.top
  for (const p of scene.projectiles) {
    if (p.body.position.y + p.radius > top) continue
    const x = p.body.position.x, y = top + 26
    const far = Math.min(1, (top - p.body.position.y) / 600)
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,.85)'
    ctx.beginPath(); ctx.moveTo(x, top + 4); ctx.lineTo(x - 12, y - 4); ctx.lineTo(x + 12, y - 4); ctx.fill()
    ctx.beginPath(); ctx.arc(x, y + 10, 16 - far * 5, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    drawBall(ctx, p.kind, x, y + 10, 11 - far * 4, 0)
  }
}

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, scene: Scene) {
  const { view, dpr } = scene
  const k = view.scale * dpr
  const horizon = (GROUND_Y - view.top) * k
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon))
  sky.addColorStop(0, '#5fb4ec')
  sky.addColorStop(.55, '#a9dcf7')
  sky.addColorStop(1, '#fff1d2')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  // おひさま（ほとんど うごかない）。
  const sunX = w * .82 - view.left * k * .03
  const sunY = Math.max(60 * k, horizon - 430 * k)
  const glow = ctx.createRadialGradient(sunX, sunY, 10 * k, sunX, sunY, 140 * k)
  glow.addColorStop(0, 'rgba(255,248,200,.95)')
  glow.addColorStop(.35, 'rgba(255,236,150,.45)')
  glow.addColorStop(1, 'rgba(255,236,150,0)')
  ctx.fillStyle = glow
  ctx.fillRect(sunX - 140 * k, sunY - 140 * k, 280 * k, 280 * k)
  ctx.fillStyle = '#fff4b0'
  ctx.beginPath(); ctx.arc(sunX, sunY, 38 * k, 0, Math.PI * 2); ctx.fill()
  // くも（ゆっくり ながれる）。
  const drift = scene.reducedMotion ? 0 : scene.time * 6
  for (let i = 0; i < 7; i++) {
    const span = 2600
    const wx = ((i * 431 + drift * (1 + hash(i) * .6)) % span + span) % span - 300
    const x = (wx - view.left * .25) * k
    const y = horizon - (300 + hash(i + 9) * 260) * k
    drawCloud(ctx, x, y, (0.7 + hash(i + 3) * .6) * k)
  }
  // とおくの 山と 手前の おか（おそく うごいて 奥行きを だす）。
  drawRidge(ctx, scene, .3, 150, 60, '#b9c8ef', '#a6b8ea', 3)
  drawRidge(ctx, scene, .55, 80, 36, '#9fd98b', '#8acb77', 11)
  drawTrees(ctx, scene)
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(255,255,255,.92)'
  ctx.beginPath()
  ctx.arc(x, y, 28 * s, 0, Math.PI * 2)
  ctx.arc(x + 32 * s, y - 14 * s, 34 * s, 0, Math.PI * 2)
  ctx.arc(x + 70 * s, y, 26 * s, 0, Math.PI * 2)
  ctx.arc(x + 36 * s, y + 8 * s, 28 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(200,225,245,.55)'
  ctx.beginPath()
  ctx.ellipse(x + 36 * s, y + 22 * s, 58 * s, 10 * s, 0, 0, Math.PI * 2)
  ctx.fill()
}

function ridgeHeight(x: number, base: number, amp: number, salt: number) {
  return base + Math.sin(x * .004 + salt) * amp + Math.sin(x * .011 + salt * 2) * amp * .45 + Math.sin(x * .0017 + salt * 3) * amp * .8
}

function drawRidge(ctx: CanvasRenderingContext2D, scene: Scene, parallax: number, base: number, amp: number, top: string, bottom: string, salt: number) {
  const { view, dpr } = scene
  const k = view.scale * dpr
  const width = view.width * view.scale * dpr
  const horizon = (GROUND_Y - view.top) * k
  const offset = view.left * parallax
  const gradient = ctx.createLinearGradient(0, horizon - (base + amp * 2) * k, 0, horizon)
  gradient.addColorStop(0, top)
  gradient.addColorStop(1, bottom)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.moveTo(0, horizon + 2)
  for (let sx = 0; sx <= width + 16; sx += 16) {
    const wx = sx / k + offset
    ctx.lineTo(sx, horizon - ridgeHeight(wx, base, amp, salt) * k)
  }
  ctx.lineTo(width + 16, horizon + 2)
  ctx.closePath()
  ctx.fill()
}

function drawTrees(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { view, dpr } = scene
  const k = view.scale * dpr
  const horizon = (GROUND_Y - view.top) * k
  const parallax = .55
  const offset = view.left * parallax
  const first = Math.floor(offset / 170) - 1
  const last = first + Math.ceil(view.width / 170) + 3
  for (let i = first; i <= last; i++) {
    if (hash(i + 40) < .45) continue
    const wx = i * 170 + hash(i) * 90
    const sx = (wx - offset) * k
    const ground = horizon - ridgeHeight(wx, 80, 36, 11) * k
    const s = (.7 + hash(i + 2) * .5) * k
    ctx.fillStyle = '#8a6a4a'
    ctx.fillRect(sx - 3 * s, ground - 26 * s, 6 * s, 30 * s)
    ctx.fillStyle = hash(i + 5) > .5 ? '#6bbf5a' : '#5aae55'
    ctx.beginPath(); ctx.arc(sx, ground - 36 * s, 20 * s, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.18)'
    ctx.beginPath(); ctx.arc(sx - 6 * s, ground - 42 * s, 8 * s, 0, Math.PI * 2); ctx.fill()
  }
}

function drawGround(ctx: CanvasRenderingContext2D, scene: Scene) {
  const left = scene.view.left - 40
  const right = scene.view.left + scene.view.width + 40
  const dirt = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + 320)
  dirt.addColorStop(0, '#b98552')
  dirt.addColorStop(1, '#7d5232')
  ctx.fillStyle = dirt
  ctx.fillRect(left, GROUND_Y, right - left, scene.view.top + scene.view.height - GROUND_Y + 40)
  // こいしの もよう。
  const first = Math.floor(left / 46)
  for (let i = first; i < right / 46; i++) {
    const x = i * 46 + hash(i) * 30
    const y = GROUND_Y + 34 + hash(i + 7) * 60
    ctx.fillStyle = hash(i + 3) > .5 ? 'rgba(90,55,30,.35)' : 'rgba(235,200,160,.35)'
    ctx.beginPath(); ctx.ellipse(x, y, 5 + hash(i + 1) * 6, 3 + hash(i + 2) * 3, 0, 0, Math.PI * 2); ctx.fill()
  }
  // しばふ。
  ctx.fillStyle = '#6cc04f'
  ctx.fillRect(left, GROUND_Y - 4, right - left, 16)
  ctx.fillStyle = '#86d661'
  ctx.fillRect(left, GROUND_Y - 4, right - left, 5)
  ctx.fillStyle = '#58a940'
  for (let i = Math.floor(left / 14); i < right / 14; i++) {
    const x = i * 14 + hash(i) * 6
    const tall = 5 + hash(i + 11) * 7
    ctx.beginPath(); ctx.moveTo(x - 3, GROUND_Y + 2); ctx.lineTo(x + 1, GROUND_Y - tall); ctx.lineTo(x + 4, GROUND_Y + 2); ctx.fill()
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawHill(ctx: CanvasRenderingContext2D, piece: Tracked) {
  const { x, y } = piece.body.position
  const left = x - piece.w / 2, top = y - piece.h / 2
  const dirt = ctx.createLinearGradient(0, top, 0, top + piece.h)
  dirt.addColorStop(0, '#c49261')
  dirt.addColorStop(1, '#8f6038')
  ctx.fillStyle = dirt
  roundRect(ctx, left, top, piece.w, piece.h + 30, 26)
  ctx.fill()
  ctx.fillStyle = 'rgba(90,55,30,.25)'
  for (let i = 0; i < piece.w / 40; i++) {
    ctx.beginPath(); ctx.ellipse(left + 20 + i * 40 + hash(i + piece.id) * 10, top + 40 + hash(i * 3 + piece.id) * (piece.h - 50), 7, 4, 0, 0, Math.PI * 2); ctx.fill()
  }
  ctx.fillStyle = '#6cc04f'
  roundRect(ctx, left - 4, top - 4, piece.w + 8, 22, 12)
  ctx.fill()
  ctx.fillStyle = '#86d661'
  roundRect(ctx, left, top - 4, piece.w, 7, 4)
  ctx.fill()
}

const MATERIAL_LOOK: Record<Material, { light: string; dark: string; edge: string; crack: string }> = {
  wood: { light: '#eab26a', dark: '#c98640', edge: '#7a4a1e', crack: '#5a3412' },
  ice: { light: 'rgba(225,247,255,.92)', dark: 'rgba(150,215,245,.85)', edge: '#5fa9cf', crack: '#ffffff' },
  stone: { light: '#b0b8c0', dark: '#848e99', edge: '#4f5760', crack: '#3a4047' },
}

function drawBlock(ctx: CanvasRenderingContext2D, piece: Tracked) {
  const material = piece.material ?? 'wood'
  const look = MATERIAL_LOOK[material]
  const { x, y } = piece.body.position
  const w = piece.w, h = piece.h
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(piece.body.angle)
  const vertical = h > w
  const gradient = vertical ? ctx.createLinearGradient(-w / 2, 0, w / 2, 0) : ctx.createLinearGradient(0, -h / 2, 0, h / 2)
  gradient.addColorStop(0, look.light)
  gradient.addColorStop(1, look.dark)
  ctx.fillStyle = gradient
  roundRect(ctx, -w / 2, -h / 2, w, h, material === 'stone' ? 5 : 3)
  ctx.fill()
  ctx.save()
  ctx.clip()
  if (material === 'wood') {
    ctx.strokeStyle = 'rgba(122,74,30,.35)'
    ctx.lineWidth = 1.5
    const long = Math.max(w, h), short = Math.min(w, h)
    for (let i = 1; i < 3; i++) {
      const o = -short / 2 + short * i / 3 + (hash(piece.id + i) - .5) * 3
      ctx.beginPath()
      for (let t = -long / 2; t <= long / 2; t += 6) {
        const wobble = Math.sin(t * .09 + piece.id + i) * 1.4
        if (vertical) ctx.lineTo(o + wobble, t); else ctx.lineTo(t, o + wobble)
      }
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(122,74,30,.4)'
    ctx.beginPath()
    const kx = vertical ? 0 : (hash(piece.id) - .5) * w * .6, ky = vertical ? (hash(piece.id) - .5) * h * .6 : 0
    ctx.ellipse(kx, ky, vertical ? 3 : 5, vertical ? 5 : 3, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (material === 'ice') {
    ctx.fillStyle = 'rgba(255,255,255,.55)'
    ctx.beginPath()
    ctx.moveTo(-w / 2 + w * .15, -h / 2); ctx.lineTo(-w / 2 + w * .35, -h / 2); ctx.lineTo(-w / 2, -h / 2 + h * .45); ctx.lineTo(-w / 2, -h / 2 + h * .2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.3)'
    ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, 3)
  } else {
    for (let i = 0; i < (w * h) / 180; i++) {
      ctx.fillStyle = hash(piece.id * 13 + i) > .5 ? 'rgba(60,66,74,.3)' : 'rgba(230,234,238,.35)'
      ctx.beginPath()
      ctx.arc((hash(piece.id + i * 7) - .5) * (w - 6), (hash(piece.id + i * 11) - .5) * (h - 6), 1.5 + hash(i + piece.id) * 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // いたみ ぐあいで ひびを ふやす。
  const hurt = 1 - piece.hp / piece.maxHp
  const cracks = hurt > .66 ? 3 : hurt > .33 ? 2 : hurt > .08 ? 1 : 0
  ctx.strokeStyle = look.crack
  ctx.lineWidth = material === 'ice' ? 1.6 : 2
  for (let c = 0; c < cracks; c++) {
    let cx = (hash(piece.id * 5 + c) - .5) * w * .6, cy = (hash(piece.id * 7 + c) - .5) * h * .6
    ctx.beginPath(); ctx.moveTo(cx, cy)
    for (let s = 0; s < 4; s++) {
      cx += (hash(piece.id + c * 10 + s) - .5) * w * .7
      cy += (hash(piece.id + c * 20 + s) - .5) * h * .7
      ctx.lineTo(cx, cy)
    }
    ctx.stroke()
  }
  ctx.restore()
  ctx.strokeStyle = look.edge
  ctx.lineWidth = 2
  roundRect(ctx, -w / 2, -h / 2, w, h, material === 'stone' ? 5 : 3)
  ctx.stroke()
  ctx.restore()
}

function drawBox(ctx: CanvasRenderingContext2D, piece: Tracked, time: number) {
  const { x, y } = piece.body.position
  const s = piece.w
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(piece.body.angle)
  roundRect(ctx, -s / 2, -s / 2, s, s, 5)
  ctx.fillStyle = '#ff5d5d'
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.fillStyle = '#ffd23f'
  for (let i = -3; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * 14 - 4, -s); ctx.lineTo(i * 14 + 4, -s); ctx.lineTo(i * 14 + 4 + s, s); ctx.lineTo(i * 14 - 4 + s, s); ctx.fill()
  }
  ctx.restore()
  ctx.strokeStyle = '#a3262b'
  ctx.lineWidth = 2.5
  roundRect(ctx, -s / 2, -s / 2, s, s, 5)
  ctx.stroke()
  const pulse = 1 + Math.sin(time * 6) * .08
  ctx.scale(pulse, pulse)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#a3262b'
  ctx.lineWidth = 4
  ctx.font = 'bold 26px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeText('?', 0, 2)
  ctx.fillText('?', 0, 2)
  ctx.restore()
}

const ROBOT_COLORS = [
  { body: '#6fd3c4', shade: '#3fa898', edge: '#2a7a6f' },
  { body: '#ffb35c', shade: '#e08a2e', edge: '#9a5714' },
  { body: '#b69cff', shade: '#8f70e6', edge: '#5e44a8' },
  { body: '#ff8fb3', shade: '#e2628d', edge: '#9c3558' },
]

function drawRobot(ctx: CanvasRenderingContext2D, piece: Tracked, time: number, look: Point) {
  const { x, y } = piece.body.position
  const s = piece.w
  const color = ROBOT_COLORS[piece.id % ROBOT_COLORS.length]
  const hurt = piece.hp < piece.maxHp
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(piece.body.angle)
  // アンテナ。
  ctx.strokeStyle = color.edge
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(0, -s / 2); ctx.lineTo(0, -s / 2 - 12); ctx.stroke()
  const blink = Math.sin(time * 5 + piece.id) > 0
  ctx.fillStyle = blink ? '#ff4d4d' : '#ffb3b3'
  ctx.beginPath(); ctx.arc(0, -s / 2 - 14, 5, 0, Math.PI * 2); ctx.fill()
  // からだ。
  const gradient = ctx.createLinearGradient(0, -s / 2, 0, s / 2)
  gradient.addColorStop(0, color.body)
  gradient.addColorStop(1, color.shade)
  ctx.fillStyle = gradient
  roundRect(ctx, -s / 2, -s / 2, s, s, s * .28)
  ctx.fill()
  ctx.strokeStyle = color.edge
  ctx.lineWidth = 2.5
  ctx.stroke()
  // みみの ボルト。
  ctx.fillStyle = '#d7dde3'
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * s / 2, 0, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#8a949e'; ctx.lineWidth = 1.5; ctx.stroke() }
  // かおの がめん。
  ctx.fillStyle = '#26324a'
  roundRect(ctx, -s * .36, -s * .3, s * .72, s * .42, 7)
  ctx.fill()
  // 目は とんでくる たまの ほうを 見る。
  const local = rotate({ x: look.x - x, y: look.y - y }, -piece.body.angle)
  const d = Math.hypot(local.x, local.y) || 1
  const ex = local.x / d * 2.6, ey = local.y / d * 2
  const closed = !hurt && (time + piece.id * .7) % 3.4 < .12
  ctx.strokeStyle = ctx.fillStyle = hurt ? '#ffd23f' : '#6ff7ff'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    const cx = side * s * .15, cy = -s * .1
    if (hurt) {
      // ぐるぐる目。
      ctx.beginPath()
      for (let t = 0; t < 10; t++) { const a = t * .9 + time * 6, r = t * .45; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) }
      ctx.stroke()
    } else if (closed) {
      ctx.beginPath(); ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy); ctx.stroke()
    } else {
      ctx.beginPath(); ctx.arc(cx + ex, cy + ey, 4.2, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(cx + ex + 1.3, cy + ey - 1.4, 1.3, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#6ff7ff'
    }
  }
  // いたずらっぽい にやり口。
  ctx.strokeStyle = hurt ? '#ffd23f' : '#6ff7ff'
  ctx.lineWidth = 2
  ctx.beginPath()
  if (hurt) { ctx.moveTo(-5, s * .04); ctx.lineTo(-2, s * .01); ctx.lineTo(1, s * .05); ctx.lineTo(4, s * .01) }
  else { ctx.moveTo(-6, s * .02); ctx.quadraticCurveTo(0, s * .07, 7, s * 0) }
  ctx.stroke()
  // おなかの ボタン。
  ctx.fillStyle = '#ffffffaa'
  ctx.beginPath(); ctx.arc(-6, s * .3, 2.5, 0, Math.PI * 2); ctx.arc(2, s * .3, 2.5, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ffd23f'
  ctx.beginPath(); ctx.arc(10, s * .3, 2.5, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function rotate(p: Point, angle: number): Point {
  const c = Math.cos(angle), s = Math.sin(angle)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

export function drawBall(ctx: CanvasRenderingContext2D, kind: BallKind, x: number, y: number, r: number, angle: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  const base = kind === 'heavy' ? ['#8a939c', '#3f464e', '#23282d'] : kind === 'split' ? ['#8fd9ff', '#2f8fdc', '#1b5e9a'] : ['#ff8a80', '#e53935', '#9e1f1b']
  const gradient = ctx.createRadialGradient(-r * .35, -r * .35, r * .1, 0, 0, r)
  gradient.addColorStop(0, base[0])
  gradient.addColorStop(.7, base[1])
  gradient.addColorStop(1, base[2])
  ctx.fillStyle = gradient
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
  if (kind === 'heavy') {
    ctx.fillStyle = '#bfc6cd'
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .68, Math.sin(a) * r * .68, 2.2, 0, Math.PI * 2); ctx.fill() }
    ctx.strokeStyle = 'rgba(255,255,255,.25)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, r * .45, 0, Math.PI * 2); ctx.stroke()
  } else if (kind === 'split') {
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 - Math.PI / 2; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .45, Math.sin(a) * r * .45, r * .17, 0, Math.PI * 2); ctx.fill() }
  } else {
    // きりっとした 目。
    ctx.fillStyle = '#ffffff'
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * r * .32, -r * .08, r * .2, r * .24, 0, 0, Math.PI * 2); ctx.fill() }
    ctx.fillStyle = '#2b1a1a'
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * r * .3 + r * .05, -r * .04, r * .1, 0, Math.PI * 2); ctx.fill() }
    ctx.strokeStyle = '#6b1512'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * r * .52, -r * .42); ctx.lineTo(side * r * .12, -r * .3); ctx.stroke() }
  }
  ctx.fillStyle = 'rgba(255,255,255,.45)'
  ctx.beginPath(); ctx.ellipse(-r * .38, -r * .45, r * .22, r * .13, -.6, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

const FORK_LEFT = { x: SLING.x - 16, y: SLING.y - 8 }
const FORK_RIGHT = { x: SLING.x + 18, y: SLING.y - 12 }

function drawBranch(ctx: CanvasRenderingContext2D, from: Point, to: Point, width: number) {
  ctx.strokeStyle = '#6b3f1c'
  ctx.lineWidth = width + 4
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
  ctx.strokeStyle = '#a8672f'
  ctx.lineWidth = width
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
  ctx.strokeStyle = 'rgba(255,220,170,.5)'
  ctx.lineWidth = width * .3
  ctx.beginPath(); ctx.moveTo(from.x - width * .2, from.y); ctx.lineTo(to.x - width * .2, to.y); ctx.stroke()
}

function drawSlingBack(ctx: CanvasRenderingContext2D) {
  // うしろがわの えだ。
  drawBranch(ctx, { x: SLING.x + 4, y: SLING.y + 52 }, FORK_RIGHT, 11)
}

function drawSlingFront(ctx: CanvasRenderingContext2D, scene: Scene) {
  const loaded = scene.projectiles.length === 0 && scene.queue.length > 0
  const pull = scene.pull ?? { x: 0, y: 0 }
  const ball = { x: SLING.x + pull.x, y: SLING.y + pull.y }
  const kind = scene.queue[0]
  const radius = kind === 'heavy' ? 26 : kind === 'split' ? 17 : 22
  // うしろの ゴム → たま → まえの ゴム の じゅんに かさねる。
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#4a2a14'
  ctx.lineWidth = 7
  if (loaded) {
    ctx.beginPath(); ctx.moveTo(FORK_RIGHT.x, FORK_RIGHT.y); ctx.lineTo(ball.x - radius * .7, ball.y); ctx.stroke()
    drawBall(ctx, kind, ball.x, ball.y, radius, 0)
    ctx.fillStyle = '#5b3418'
    roundRect(ctx, ball.x - radius - 6, ball.y - 9, 14, 18, 4)
    ctx.fill()
  } else {
    ctx.beginPath(); ctx.moveTo(FORK_RIGHT.x, FORK_RIGHT.y); ctx.quadraticCurveTo(SLING.x, SLING.y + 10, FORK_LEFT.x, FORK_LEFT.y); ctx.stroke()
  }
  // ささえの みき と まえの えだ。
  drawBranch(ctx, { x: SLING.x + 2, y: GROUND_Y + 4 }, { x: SLING.x + 2, y: SLING.y + 50 }, 16)
  drawBranch(ctx, { x: SLING.x + 2, y: SLING.y + 54 }, FORK_LEFT, 12)
  if (loaded) {
    ctx.strokeStyle = '#4a2a14'
    ctx.lineWidth = 7
    ctx.beginPath(); ctx.moveTo(FORK_LEFT.x, FORK_LEFT.y); ctx.lineTo(ball.x - radius * .7, ball.y); ctx.stroke()
  }
}

function drawQueue(ctx: CanvasRenderingContext2D, scene: Scene) {
  // パチンコに のっている たまの つぎから、じゅんばんに 地面で まつ。
  const waiting = scene.projectiles.length === 0 ? scene.queue.slice(1) : scene.queue
  waiting.forEach((kind, i) => {
    const r = kind === 'heavy' ? 20 : kind === 'split' ? 14 : 17
    const x = SLING.x - 70 - i * 46
    const hop = scene.reducedMotion ? 0 : Math.max(0, Math.sin(scene.time * 3 - i * .8)) * 5
    ctx.fillStyle = 'rgba(40,60,20,.25)'
    ctx.beginPath(); ctx.ellipse(x, GROUND_Y, r * .9, 4, 0, 0, Math.PI * 2); ctx.fill()
    drawBall(ctx, kind, x, GROUND_Y - r - hop, r, 0)
  })
}

function drawTrail(ctx: CanvasRenderingContext2D, trail: readonly Point[], alpha: number) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`
  trail.forEach((p, i) => {
    if (i % 2) return
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2); ctx.fill()
  })
}

function drawAim(ctx: CanvasRenderingContext2D, scene: Scene) {
  if (!scene.pull || !scene.path.length) return
  scene.path.forEach((p, i) => {
    const t = i / scene.path.length
    // そらや くさの まえでも みえるように、とおくの てんも うすく しすぎない。
    ctx.fillStyle = `rgba(255,255,255,${1 - t * .55})`
    ctx.strokeStyle = `rgba(30,55,95,${.75 - t * .4})`
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(p.x, p.y, 7.5 - t * 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  })
}

function drawStar(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? r * .45 : r
    const a = -Math.PI / 2 + i * Math.PI / 5
    ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius)
  }
  ctx.closePath()
}

function drawParticles(ctx: CanvasRenderingContext2D, fx: Fx) {
  for (const p of fx.particles) {
    const t = p.life / p.max
    ctx.save()
    ctx.globalAlpha = Math.max(0, 1 - t * t)
    ctx.translate(p.x, p.y)
    if (p.kind === 'chip' || p.kind === 'confetti') {
      ctx.rotate(p.angle)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
    } else if (p.kind === 'dust') {
      ctx.globalAlpha *= .7
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(0, 0, p.size * (.6 + t * .8), 0, Math.PI * 2); ctx.fill()
    } else if (p.kind === 'star') {
      ctx.rotate(p.angle)
      ctx.fillStyle = p.color
      drawStar(ctx, p.size)
      ctx.fill()
    } else if (p.kind === 'ring') {
      ctx.strokeStyle = p.color
      ctx.lineWidth = 10 * (1 - t)
      ctx.beginPath(); ctx.arc(0, 0, p.size * (.2 + t * .8), 0, Math.PI * 2); ctx.stroke()
    } else if (p.kind === 'text' && p.text) {
      const pop = t < .15 ? .6 + t / .15 * .5 : 1.1 - Math.min(.1, (t - .15))
      ctx.scale(pop, pop)
      ctx.font = `900 ${p.size}px 'Hiragino Maru Gothic ProN', 'Noto Sans JP', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#3a2a6b'
      ctx.lineWidth = 6
      ctx.strokeText(p.text, 0, 0)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, 0, 0)
    }
    ctx.restore()
  }
}
