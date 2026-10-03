import { BALLOON_R, GROUND_Y, PORTAL_R, ROBOT_SIZE, SLING, type BallKind, type Bounds, type Material, type Sky } from './levels'
import type { View } from './camera'
import { BALLS, type GameEvent, type Point, type Portal, type Projectile, type Tracked } from './world'

// canvas への 絵の かきかただけを 持つ。ゲームの すすみかたは world.ts が きめる。

export type Particle = {
  kind: 'chip' | 'dust' | 'star' | 'ring' | 'text' | 'confetti' | 'helmet'
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
const BALLOON_COLORS = ['#ff5d6c', '#ffcf3f', '#ff8fd0', '#5ec2ff', '#7bd66f']

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
    const boss = event.kind === 'boss'
    burst(fx, event.x, event.y, boss ? 30 : 14, i => ({ kind: 'star', color: i % 2 ? '#ffd23f' : '#fff3a8', size: 7 + rand() * 7, max: 50 + rand() * 25 }))
    burst(fx, event.x, event.y, 8, () => ({ kind: 'dust', color: '#ffffff', size: 14 + rand() * 14, vx: (rand() - .5) * 3, vy: (rand() - .5) * 3, max: 45 }))
    fx.particles.push({ kind: 'ring', x: event.x, y: event.y, vx: 0, vy: 0, life: 0, max: 26, size: boss ? 140 : 70, color: '#fff6c2', angle: 0, spin: 0 })
    fx.particles.push(textParticle(event.x, event.y - 30, `+${event.score}`, '#ffe45c', boss ? 40 : 30))
    if (boss) burst(fx, event.x, event.y, 30, i => ({ kind: 'confetti', color: CONFETTI[i % CONFETTI.length], max: 80 + rand() * 30 }))
    fx.shake = Math.max(fx.shake, boss ? 12 : 5)
  } else if (event.type === 'blast') {
    const bomb = event.source === 'bomb'
    fx.particles.push({ kind: 'ring', x: event.x, y: event.y, vx: 0, vy: 0, life: 0, max: 32, size: bomb ? 210 : 230, color: bomb ? '#ff9a3c' : '#ffe066', angle: 0, spin: 0 })
    if (bomb) {
      burst(fx, event.x, event.y, 26, i => ({ kind: 'star', color: i % 2 ? '#ffb02e' : '#ff6b2e', size: 8 + rand() * 8, vx: Math.cos(i) * (4 + rand() * 6), vy: Math.sin(i) * (4 + rand() * 6) - 3, max: 40 + rand() * 20 }))
      burst(fx, event.x, event.y, 16, () => ({ kind: 'dust', color: rand() > .5 ? '#5d5a5a' : '#8a8282', size: 26 + rand() * 24, vx: (rand() - .5) * 4, vy: -1 - rand() * 2, max: 70 }))
    } else {
      burst(fx, event.x, event.y, 40, i => ({ kind: 'confetti', color: CONFETTI[i % CONFETTI.length], vx: Math.cos(i) * (3 + rand() * 7), vy: Math.sin(i) * (3 + rand() * 7) - 4, max: 70 + rand() * 40, size: 6 + rand() * 5 }))
      burst(fx, event.x, event.y, 12, () => ({ kind: 'dust', color: '#fff1d6', size: 24 + rand() * 20, max: 55 }))
    }
    fx.particles.push(textParticle(event.x, event.y - 40, bomb ? 'ドッカーン！' : 'ボワーン！', bomb ? '#ffb02e' : '#ff7a45', 40))
    fx.shake = bomb ? 16 : 14
  } else if (event.type === 'pop') {
    burst(fx, event.x, event.y, 12, i => ({ kind: 'chip', color: BALLOON_COLORS[i % BALLOON_COLORS.length], size: 5 + rand() * 5, max: 40 }))
    fx.particles.push({ kind: 'ring', x: event.x, y: event.y, vx: 0, vy: 0, life: 0, max: 16, size: 60, color: '#ffffff', angle: 0, spin: 0 })
    fx.particles.push(textParticle(event.x, event.y - 20, 'パン！', '#ff8fb3', 28))
  } else if (event.type === 'helmet') {
    fx.particles.push({ kind: 'helmet', x: event.x, y: event.y, vx: (rand() - .5) * 4, vy: -6, life: 0, max: 60, size: 22, color: '#ffc61a', angle: 0, spin: (rand() - .5) * .5 })
    burst(fx, event.x, event.y, 8, () => ({ kind: 'star', color: '#ffffff', size: 4 + rand() * 4, max: 25 }))
    fx.particles.push(textParticle(event.x, event.y - 26, 'カーン！', '#ffd23f', 26))
  } else if (event.type === 'spring') {
    burst(fx, event.x, event.y - 10, 6, () => ({ kind: 'star', color: '#fff3a8', size: 4 + rand() * 4, max: 25 }))
    fx.particles.push(textParticle(event.x, event.y - 34, 'ぴょーん！', '#7bd66f', 24))
  } else if (event.type === 'warp') {
    for (const [p, color] of [[event.from, '#ff9a3c'], [event.to, '#5ec2ff']] as const) {
      fx.particles.push({ kind: 'ring', x: p.x, y: p.y, vx: 0, vy: 0, life: 0, max: 22, size: PORTAL_R * 2.6, color, angle: 0, spin: 0 })
      burst(fx, p.x, p.y, 8, () => ({ kind: 'star', color, size: 4 + rand() * 4, max: 30 }))
    }
  } else if (event.type === 'pierce') {
    burst(fx, event.x, event.y, 8, i => ({ kind: 'star', color: i % 2 ? '#fff3a8' : '#ffffff', size: 4 + rand() * 4, max: 25 }))
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
    if (p.kind === 'chip' || p.kind === 'confetti' || p.kind === 'star' || p.kind === 'helmet') {
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
  sky: Sky
  pieces: readonly Tracked[]
  portals: readonly Portal[]
  fans: readonly Bounds[]
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
  const motion = scene.reducedMotion ? 0 : scene.time
  for (const zone of scene.fans) drawWind(ctx, zone, motion)
  for (const portal of scene.portals) drawPortal(ctx, portal, motion)
  drawTrail(ctx, scene.trail, .45)
  drawTrail(ctx, scene.currentTrail, .8)
  drawSlingBack(ctx)
  for (const piece of scene.pieces) {
    if (piece.kind === 'hill') drawHill(ctx, piece)
    else if (piece.kind === 'balloon') drawBalloon(ctx, piece, motion)
  }
  const look = scene.projectiles[0]?.body.position ?? { x: SLING.x + (scene.pull?.x ?? 0), y: SLING.y + (scene.pull?.y ?? 0) }
  for (const piece of scene.pieces) {
    if (piece.kind === 'block') drawBlock(ctx, piece)
    else if (piece.kind === 'box') drawBox(ctx, piece, scene.time)
    else if (piece.kind === 'robot') drawRobot(ctx, piece, scene.time, look)
    else if (piece.kind === 'steel' || piece.kind === 'mover') drawSteel(ctx, piece, motion)
    else if (piece.kind === 'spring') drawSpring(ctx, piece, motion)
    else if (piece.kind === 'fan') drawFan(ctx, piece, motion)
  }
  drawQueue(ctx, scene)
  drawSlingFront(ctx, scene)
  for (const p of scene.projectiles) {
    // ドリルは すすむ むきに さきを むける。
    const angle = p.kind === 'drill' ? Math.atan2(p.body.velocity.y, p.body.velocity.x) : p.body.angle
    drawBall(ctx, p.kind, p.body.position.x, p.body.position.y, p.radius, angle, scene.time)
  }
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

type Palette = {
  sky: [string, string, string]
  sun: string; glow: string; moon: boolean
  cloud: string; cloudShade: string
  far: [string, string]; near: [string, string]
  leaf: [string, string]; trunk: string
  grass: [string, string, string]; dirt: [string, string]
}

/** ステージの じかんたい ごとの いろ。 */
const SKIES: Record<Sky, Palette> = {
  day: {
    sky: ['#5fb4ec', '#a9dcf7', '#fff1d2'], sun: '#fff4b0', glow: '255,236,150', moon: false,
    cloud: 'rgba(255,255,255,.92)', cloudShade: 'rgba(200,225,245,.55)',
    far: ['#b9c8ef', '#a6b8ea'], near: ['#9fd98b', '#8acb77'], leaf: ['#6bbf5a', '#5aae55'], trunk: '#8a6a4a',
    grass: ['#6cc04f', '#86d661', '#58a940'], dirt: ['#b98552', '#7d5232'],
  },
  evening: {
    sky: ['#5a63b8', '#f39a7a', '#ffd9a0'], sun: '#ffb46b', glow: '255,170,110', moon: false,
    cloud: 'rgba(255,214,206,.9)', cloudShade: 'rgba(214,140,150,.45)',
    far: ['#a58cc8', '#937cbc'], near: ['#8fb873', '#7aa865'], leaf: ['#5f9f50', '#548f4a'], trunk: '#7a5a40',
    grass: ['#68b04a', '#80c45c', '#559b3e'], dirt: ['#b07b4c', '#74492c'],
  },
  night: {
    sky: ['#101a3f', '#283c78', '#4f5f98'], sun: '#fff6d8', glow: '210,225,255', moon: true,
    cloud: 'rgba(170,185,230,.32)', cloudShade: 'rgba(120,135,190,.25)',
    far: ['#2e3d70', '#283565'], near: ['#2d5a4e', '#264d43'], leaf: ['#2f6b4a', '#2a5f42'], trunk: '#4a3a30',
    grass: ['#4f9a48', '#63ae58', '#41853c'], dirt: ['#8d6844', '#5e3f26'],
  },
}

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, scene: Scene) {
  const { view, dpr } = scene
  const palette = SKIES[scene.sky]
  const k = view.scale * dpr
  const horizon = (GROUND_Y - view.top) * k
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon))
  sky.addColorStop(0, palette.sky[0])
  sky.addColorStop(.55, palette.sky[1])
  sky.addColorStop(1, palette.sky[2])
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  if (palette.moon) {
    // よるの ほし（ちかちか）。
    for (let i = 0; i < 70; i++) {
      const x = ((hash(i + 200) * 1.3 - view.left * .0004) % 1 + 1) % 1 * w
      const y = hash(i + 300) * Math.max(1, horizon - 160 * k)
      const twinkle = scene.reducedMotion ? .8 : .55 + .45 * Math.sin(scene.time * (1.5 + hash(i) * 2) + i)
      ctx.fillStyle = `rgba(255,255,240,${twinkle})`
      ctx.beginPath(); ctx.arc(x, y, (.8 + hash(i + 400) * 1.6) * k, 0, Math.PI * 2); ctx.fill()
    }
  }
  // おひさま・おつきさま（ほとんど うごかない）。
  const sunX = w * .82 - view.left * k * .03
  const sunY = Math.max(60 * k, horizon - (scene.sky === 'evening' ? 250 : 430) * k)
  const glow = ctx.createRadialGradient(sunX, sunY, 10 * k, sunX, sunY, 140 * k)
  glow.addColorStop(0, `rgba(${palette.glow},.95)`)
  glow.addColorStop(.35, `rgba(${palette.glow},.4)`)
  glow.addColorStop(1, `rgba(${palette.glow},0)`)
  ctx.fillStyle = glow
  ctx.fillRect(sunX - 140 * k, sunY - 140 * k, 280 * k, 280 * k)
  ctx.fillStyle = palette.sun
  ctx.beginPath(); ctx.arc(sunX, sunY, (scene.sky === 'evening' ? 46 : 38) * k, 0, Math.PI * 2); ctx.fill()
  if (palette.moon) {
    ctx.fillStyle = 'rgba(200,190,150,.45)'
    for (const [cx, cy, r] of [[-12, -8, 8], [10, 6, 10], [-4, 16, 5]]) { ctx.beginPath(); ctx.arc(sunX + cx * k, sunY + cy * k, r * k, 0, Math.PI * 2); ctx.fill() }
  }
  // くも（ゆっくり ながれる）。
  const drift = scene.reducedMotion ? 0 : scene.time * 6
  for (let i = 0; i < 7; i++) {
    const span = 2600
    const wx = ((i * 431 + drift * (1 + hash(i) * .6)) % span + span) % span - 300
    const x = (wx - view.left * .25) * k
    const y = horizon - (300 + hash(i + 9) * 260) * k
    drawCloud(ctx, x, y, (0.7 + hash(i + 3) * .6) * k, palette)
  }
  // とおくの 山と 手前の おか（おそく うごいて 奥行きを だす）。
  drawRidge(ctx, scene, .3, 150, 60, palette.far[0], palette.far[1], 3)
  drawRidge(ctx, scene, .55, 80, 36, palette.near[0], palette.near[1], 11)
  drawTrees(ctx, scene, palette)
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, palette: Palette) {
  ctx.fillStyle = palette.cloud
  ctx.beginPath()
  ctx.arc(x, y, 28 * s, 0, Math.PI * 2)
  ctx.arc(x + 32 * s, y - 14 * s, 34 * s, 0, Math.PI * 2)
  ctx.arc(x + 70 * s, y, 26 * s, 0, Math.PI * 2)
  ctx.arc(x + 36 * s, y + 8 * s, 28 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = palette.cloudShade
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

function drawTrees(ctx: CanvasRenderingContext2D, scene: Scene, palette: Palette) {
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
    ctx.fillStyle = palette.trunk
    ctx.fillRect(sx - 3 * s, ground - 26 * s, 6 * s, 30 * s)
    ctx.fillStyle = hash(i + 5) > .5 ? palette.leaf[0] : palette.leaf[1]
    ctx.beginPath(); ctx.arc(sx, ground - 36 * s, 20 * s, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.18)'
    ctx.beginPath(); ctx.arc(sx - 6 * s, ground - 42 * s, 8 * s, 0, Math.PI * 2); ctx.fill()
  }
}

function drawGround(ctx: CanvasRenderingContext2D, scene: Scene) {
  const palette = SKIES[scene.sky]
  const left = scene.view.left - 40
  const right = scene.view.left + scene.view.width + 40
  const dirt = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + 320)
  dirt.addColorStop(0, palette.dirt[0])
  dirt.addColorStop(1, palette.dirt[1])
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
  ctx.fillStyle = palette.grass[0]
  ctx.fillRect(left, GROUND_Y - 4, right - left, 16)
  ctx.fillStyle = palette.grass[1]
  ctx.fillRect(left, GROUND_Y - 4, right - left, 5)
  ctx.fillStyle = palette.grass[2]
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

/** こわれない てつの かべ。うごく かべには きいろと くろの しるしと やじるしを つける。 */
function drawSteel(ctx: CanvasRenderingContext2D, piece: Tracked, time: number) {
  const { x, y } = piece.body.position
  const w = piece.w, h = piece.h
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(piece.body.angle)
  const vertical = h > w
  const gradient = vertical ? ctx.createLinearGradient(-w / 2, 0, w / 2, 0) : ctx.createLinearGradient(0, -h / 2, 0, h / 2)
  gradient.addColorStop(0, '#d5dee8')
  gradient.addColorStop(.45, '#a9b6c4')
  gradient.addColorStop(1, '#7a8899')
  ctx.fillStyle = gradient
  roundRect(ctx, -w / 2, -h / 2, w, h, 4)
  ctx.fill()
  ctx.save()
  ctx.clip()
  if (piece.kind === 'mover') {
    // はしっこの しましま。
    const band = 22
    for (const side of [-1, 1]) {
      ctx.save()
      if (vertical) ctx.translate(0, side * (h / 2 - band / 2)); else ctx.translate(side * (w / 2 - band / 2), 0)
      ctx.fillStyle = '#ffd23f'
      ctx.fillRect(vertical ? -w / 2 : -band / 2, vertical ? -band / 2 : -h / 2, vertical ? w : band, vertical ? band : h)
      ctx.fillStyle = '#2b2f36'
      for (let i = -4; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(i * 12 - 4, -band); ctx.lineTo(i * 12 + 2, -band); ctx.lineTo(i * 12 + 2 + band * 2, band); ctx.lineTo(i * 12 - 4 + band * 2, band); ctx.fill()
      }
      ctx.restore()
    }
  }
  // ななめの ひかり。
  ctx.fillStyle = 'rgba(255,255,255,.28)'
  ctx.beginPath()
  ctx.moveTo(-w / 2, h * .1); ctx.lineTo(w * .1, -h / 2); ctx.lineTo(w * .3, -h / 2); ctx.lineTo(-w / 2, h * .3)
  ctx.fill()
  ctx.restore()
  // びょう。
  ctx.fillStyle = '#5b6878'
  const long = Math.max(w, h), short = Math.min(w, h)
  const rivets = Math.max(2, Math.floor(long / 56))
  for (let i = 0; i < rivets; i++) {
    const t = -long / 2 + 12 + i * (long - 24) / (rivets - 1)
    for (const side of short > 36 ? [-1, 1] : [0]) {
      const o = side * (short / 2 - 9)
      const rx = vertical ? o : t, ry = vertical ? t : o
      ctx.beginPath(); ctx.arc(rx, ry, 2.8, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.strokeStyle = '#4a5868'
  ctx.lineWidth = 2.5
  roundRect(ctx, -w / 2, -h / 2, w, h, 4)
  ctx.stroke()
  ctx.restore()
  if (piece.kind === 'mover' && piece.motion) {
    // うごく むきを しめす やじるし。
    const { dx, dy } = piece.motion
    const length = Math.hypot(dx, dy) || 1
    const ux = dx / length, uy = dy / length
    const reach = (Math.abs(ux) * w + Math.abs(uy) * h) / 2 + 14 + Math.sin(time * 4) * 3
    ctx.fillStyle = 'rgba(255,255,255,.85)'
    ctx.strokeStyle = 'rgba(43,47,54,.6)'
    ctx.lineWidth = 2
    for (const side of [-1, 1]) {
      const ax = x + ux * reach * side, ay = y + uy * reach * side
      ctx.beginPath()
      ctx.moveTo(ax + ux * side * 10, ay + uy * side * 10)
      ctx.lineTo(ax - uy * 9, ay + ux * 9)
      ctx.lineTo(ax + uy * 9, ay - ux * 9)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
    }
  }
}

/** トランポリン（ばねの だい）。はねた ときは いたが しずんで もどる。 */
function drawSpring(ctx: CanvasRenderingContext2D, piece: Tracked, time: number) {
  const { x, y } = piece.body.position
  const w = piece.w, h = piece.h
  const dip = Math.sin(piece.pulse / 16 * Math.PI) * 6
  ctx.save()
  ctx.translate(x, y)
  // したの だい。
  ctx.fillStyle = '#5b6878'
  roundRect(ctx, -w / 2 + 4, h / 2 - 5, w - 8, 5, 2)
  ctx.fill()
  // ぐるぐる ばね。
  const top = -h / 2 + 9 + dip
  ctx.strokeStyle = '#c3cbd4'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  const coils = Math.max(2, Math.round(w / 45))
  for (let c = 0; c < coils; c++) {
    const cx = -w / 2 + (c + .5) * w / coils
    ctx.beginPath()
    for (let i = 0; i <= 6; i++) ctx.lineTo(cx + (i % 2 ? 7 : -7), top + i * (h / 2 - 5 - top) / 6)
    ctx.stroke()
  }
  // うえの いた（あかと きいろの しましま）。
  ctx.save()
  ctx.translate(0, dip)
  roundRect(ctx, -w / 2, -h / 2, w, 10, 5)
  ctx.save()
  ctx.clip()
  for (let i = 0; i * 20 < w; i++) {
    ctx.fillStyle = i % 2 ? '#ffd23f' : '#ff5d5d'
    ctx.fillRect(-w / 2 + i * 20, -h / 2, 20, 10)
  }
  ctx.restore()
  ctx.strokeStyle = '#a3262b'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
  // とぶ むきの やじるし。
  const hop = Math.abs(Math.sin(time * 4)) * 6
  ctx.fillStyle = 'rgba(255,255,255,.85)'
  ctx.strokeStyle = 'rgba(163,38,43,.5)'
  ctx.lineWidth = 2
  ctx.translate(0, -h / 2 - 16 - hop)
  ctx.rotate(.18)
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-11, 2); ctx.lineTo(-4, 2); ctx.lineTo(-4, 10); ctx.lineTo(4, 10); ctx.lineTo(4, 2); ctx.lineTo(11, 2); ctx.closePath()
  ctx.fill(); ctx.stroke()
  ctx.restore()
}

/** せんぷうきの だい。はねが くるくる まわる。 */
function drawFan(ctx: CanvasRenderingContext2D, piece: Tracked, time: number) {
  const { x, y } = piece.body.position
  const w = piece.w, h = piece.h
  ctx.save()
  ctx.translate(x, y)
  const gradient = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
  gradient.addColorStop(0, '#9fdcff')
  gradient.addColorStop(1, '#4f9ed6')
  ctx.fillStyle = gradient
  roundRect(ctx, -w / 2, -h / 2, w, h + 4, 8)
  ctx.fill()
  ctx.strokeStyle = '#2a6a9a'
  ctx.lineWidth = 2.5
  ctx.stroke()
  // よこから 見た はね（はばが かわって まわって 見える）。
  ctx.fillStyle = '#ffffff'
  const blades = 4
  for (let i = 0; i < blades; i++) {
    const a = time * 14 + i * Math.PI * 2 / blades
    const bx = Math.cos(a) * (w / 2 - 18)
    const bw = Math.abs(Math.sin(a)) * 14 + 4
    ctx.globalAlpha = .55 + .45 * Math.max(0, Math.sin(a))
    ctx.beginPath(); ctx.ellipse(bx, -h / 2 + 2, bw, 4, 0, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = '#2a6a9a'
  for (let i = -2; i <= 2; i++) ctx.fillRect(i * (w / 6) - 2, -h / 2 + 8, 4, h - 10)
  ctx.restore()
}

/** うえむきの かぜ。すじが すうっと のぼっていく。 */
function drawWind(ctx: CanvasRenderingContext2D, zone: Bounds, time: number) {
  const w = zone.r - zone.l, h = zone.b - zone.t
  const column = ctx.createLinearGradient(0, zone.b, 0, zone.t)
  column.addColorStop(0, 'rgba(210,240,255,.35)')
  column.addColorStop(1, 'rgba(210,240,255,0)')
  ctx.fillStyle = column
  ctx.fillRect(zone.l, zone.t, w, h)
  ctx.strokeStyle = 'rgba(255,255,255,.8)'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  const streaks = Math.max(3, Math.round(w / 24))
  for (let i = 0; i < streaks; i++) {
    for (let j = 0; j < 3; j++) {
      const rise = ((time * 160 + hash(i * 7 + j) * h + j * h / 3) % h + h) % h
      const sy = zone.b - rise
      const sx = zone.l + (i + .5) * w / streaks + Math.sin(sy * .05 + i) * 4
      const fade = Math.min(1, rise / 40, (h - rise) / 60)
      ctx.globalAlpha = Math.max(0, fade) * .8
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 22); ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

/** ワープの わ。いりぐちは オレンジ、でぐちは あお。 */
function drawPortal(ctx: CanvasRenderingContext2D, portal: Portal, time: number) {
  const rings: [Point, string, string, number][] = [[portal.from, '#ff9a3c', '#ffe0b8', 1], [portal.to, '#3fa9f5', '#cdeeff', -1]]
  for (const [p, color, light, turn] of rings) {
    ctx.save()
    ctx.translate(p.x, p.y)
    const glow = ctx.createRadialGradient(0, 0, PORTAL_R * .2, 0, 0, PORTAL_R * 1.5)
    glow.addColorStop(0, light)
    glow.addColorStop(.6, `${color}88`)
    glow.addColorStop(1, `${color}00`)
    ctx.fillStyle = glow
    ctx.beginPath(); ctx.arc(0, 0, PORTAL_R * 1.5, 0, Math.PI * 2); ctx.fill()
    ctx.rotate(time * 3 * turn)
    ctx.strokeStyle = color
    ctx.lineCap = 'round'
    for (let i = 0; i < 3; i++) {
      ctx.lineWidth = 5 - i
      ctx.beginPath(); ctx.arc(0, 0, PORTAL_R * (1 - i * .25), i * 2, i * 2 + Math.PI * 1.3); ctx.stroke()
    }
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(0, 0, PORTAL_R, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
  }
}

/** ふうせんと、つりさげている ものへの ひも。 */
function drawBalloon(ctx: CanvasRenderingContext2D, piece: Tracked, time: number) {
  const { x, y } = piece.body.position
  const bob = Math.sin(time * 2 + piece.id) * 3
  const sway = Math.sin(time * 1.3 + piece.id) * 2
  const carry = piece.carry
  if (carry) {
    const a = carry.body.angle
    const end = { x: carry.body.position.x + Math.sin(a) * carry.h / 2, y: carry.body.position.y - Math.cos(a) * carry.h / 2 }
    ctx.strokeStyle = 'rgba(255,255,255,.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x + sway, y + BALLOON_R + bob + 6)
    ctx.quadraticCurveTo(x + sway * 3 + 6, (y + BALLOON_R + end.y) / 2, end.x, end.y)
    ctx.stroke()
  }
  const color = BALLOON_COLORS[piece.id % BALLOON_COLORS.length]
  ctx.save()
  ctx.translate(x + sway, y + bob)
  ctx.fillStyle = color
  ctx.beginPath(); ctx.moveTo(0, BALLOON_R - 2); ctx.lineTo(-5, BALLOON_R + 6); ctx.lineTo(5, BALLOON_R + 6); ctx.fill()
  const gradient = ctx.createRadialGradient(-BALLOON_R * .35, -BALLOON_R * .4, 2, 0, 0, BALLOON_R * 1.1)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(.25, color)
  gradient.addColorStop(1, color)
  ctx.fillStyle = gradient
  ctx.beginPath(); ctx.ellipse(0, 0, BALLOON_R * .9, BALLOON_R, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,.15)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,.55)'
  ctx.beginPath(); ctx.ellipse(-BALLOON_R * .38, -BALLOON_R * .42, BALLOON_R * .16, BALLOON_R * .26, -.5, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

const ROBOT_COLORS = [
  { body: '#6fd3c4', shade: '#3fa898', edge: '#2a7a6f' },
  { body: '#ffb35c', shade: '#e08a2e', edge: '#9a5714' },
  { body: '#b69cff', shade: '#8f70e6', edge: '#5e44a8' },
  { body: '#ff8fb3', shade: '#e2628d', edge: '#9c3558' },
]

const BOSS_COLOR = { body: '#ff6b6b', shade: '#d94848', edge: '#8f2a2a' }

function drawRobot(ctx: CanvasRenderingContext2D, piece: Tracked, time: number, look: Point) {
  const { x, y } = piece.body.position
  // おやぶんも おなじ えを 大きく かく。
  const s = ROBOT_SIZE
  const boss = piece.robot === 'boss'
  const color = boss ? BOSS_COLOR : ROBOT_COLORS[piece.id % ROBOT_COLORS.length]
  const hurt = piece.hp < piece.maxHp
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(piece.body.angle)
  ctx.scale(piece.w / s, piece.w / s)
  if (!boss && !piece.helmet) {
    // アンテナ。
    ctx.strokeStyle = color.edge
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(0, -s / 2); ctx.lineTo(0, -s / 2 - 12); ctx.stroke()
    const blink = Math.sin(time * 5 + piece.id) > 0
    ctx.fillStyle = blink ? '#ff4d4d' : '#ffb3b3'
    ctx.beginPath(); ctx.arc(0, -s / 2 - 14, 5, 0, Math.PI * 2); ctx.fill()
  }
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
  if (boss) drawBossFace(ctx, s)
  if (piece.helmet) drawHelmet(ctx, s)
  ctx.restore()
  if (boss && hurt) {
    // おやぶんの げんき メーター。
    const bw = piece.w, top = y - piece.h / 2 - 34
    ctx.fillStyle = 'rgba(30,30,40,.6)'
    roundRect(ctx, x - bw / 2 - 2, top - 2, bw + 4, 12, 6)
    ctx.fill()
    ctx.fillStyle = '#ff5d5d'
    roundRect(ctx, x - bw / 2, top, bw * Math.max(0, piece.hp / piece.maxHp), 8, 4)
    ctx.fill()
  }
}

/** おやぶんの おうかんと まゆげと ひげ。 */
function drawBossFace(ctx: CanvasRenderingContext2D, s: number) {
  ctx.strokeStyle = '#26324a'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * s * .3, -s * .36); ctx.lineTo(side * s * .06, -s * .3); ctx.stroke() }
  ctx.fillStyle = '#4a2a14'
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * 6, s * .17, 7, 3.2, side * .35, 0, Math.PI * 2); ctx.fill() }
  ctx.fillStyle = '#ffd23f'
  ctx.strokeStyle = '#b8860b'
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(-s * .34, -s / 2 + 2)
  ctx.lineTo(-s * .36, -s / 2 - 14)
  ctx.lineTo(-s * .17, -s / 2 - 5)
  ctx.lineTo(0, -s / 2 - 18)
  ctx.lineTo(s * .17, -s / 2 - 5)
  ctx.lineTo(s * .36, -s / 2 - 14)
  ctx.lineTo(s * .34, -s / 2 + 2)
  ctx.closePath()
  ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#5ec2ff'
  ctx.beginPath(); ctx.arc(0, -s / 2 - 5, 3, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ff5d5d'
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * s * .2, -s / 2 - 2, 2.2, 0, Math.PI * 2); ctx.fill() }
}

/** こうじげんばの ヘルメット（ロボの あたまの うえ）。 */
function drawHelmet(ctx: CanvasRenderingContext2D, s: number) {
  ctx.fillStyle = '#ffc61a'
  ctx.strokeStyle = '#a8740a'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, -s / 2 + 4, s * .44, Math.PI, 0)
  ctx.closePath()
  ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#ffe07a'
  ctx.fillRect(-3, -s / 2 + 4 - s * .44, 6, s * .44)
  roundRect(ctx, -s * .56, -s / 2 + 1, s * 1.12, 6, 3)
  ctx.fillStyle = '#ffb000'
  ctx.fill(); ctx.stroke()
}

function rotate(p: Point, angle: number): Point {
  const c = Math.cos(angle), s = Math.sin(angle)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

const BALL_LOOK: Record<BallKind, [string, string, string]> = {
  normal: ['#ff8a80', '#e53935', '#9e1f1b'],
  heavy: ['#8a939c', '#3f464e', '#23282d'],
  split: ['#8fd9ff', '#2f8fdc', '#1b5e9a'],
  bomb: ['#6b7280', '#2b2f36', '#111317'],
  drill: ['#fff1a8', '#ffc61a', '#c98a00'],
  bouncy: ['#c4f7a8', '#4cc35a', '#2b8a3e'],
}

export function drawBall(ctx: CanvasRenderingContext2D, kind: BallKind, x: number, y: number, r: number, angle: number, time = 0) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  const base = BALL_LOOK[kind]
  if (kind === 'drill') {
    // まえに つきでた ドリル。
    const drill = ctx.createLinearGradient(0, -r * .6, 0, r * .6)
    drill.addColorStop(0, '#f2f5f8')
    drill.addColorStop(.5, '#a9b6c4')
    drill.addColorStop(1, '#6b7a8a')
    ctx.fillStyle = drill
    ctx.beginPath(); ctx.moveTo(r * .4, -r * .62); ctx.lineTo(r * 1.65, 0); ctx.lineTo(r * .4, r * .62); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#4f5d6c'
    ctx.lineWidth = 1.5
    ctx.stroke()
    const spin = (time * 8) % 1
    for (let i = 0; i < 3; i++) {
      const t = (i + spin) / 3
      const px = r * .4 + t * r * 1.25, half = r * .62 * (1 - t)
      ctx.beginPath(); ctx.moveTo(px - 3, -half); ctx.lineTo(px + 3, half); ctx.stroke()
    }
  }
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
  } else if (kind === 'bomb') {
    // くちがねと どうかせん、さきっぽで ぱちぱち ひばな。
    ctx.fillStyle = '#8a939c'
    ctx.fillRect(-r * .3, -r * 1.12, r * .6, r * .32)
    ctx.strokeStyle = '#c9a26b'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(0, -r * 1.1); ctx.quadraticCurveTo(r * .1, -r * 1.55, r * .5, -r * 1.5); ctx.stroke()
    const flicker = 1 + Math.sin(time * 40) * .3
    ctx.save()
    ctx.translate(r * .55, -r * 1.52)
    ctx.rotate(time * 9)
    ctx.fillStyle = '#ffb02e'
    drawStar(ctx, r * .42 * flicker)
    ctx.fill()
    ctx.fillStyle = '#fff3a8'
    drawStar(ctx, r * .2 * flicker)
    ctx.fill()
    ctx.restore()
  } else if (kind === 'bouncy') {
    // ゴムの おびと にっこり口。
    ctx.strokeStyle = 'rgba(255,255,255,.75)'
    ctx.lineWidth = r * .18
    ctx.beginPath(); ctx.arc(0, r * 1.6, r * 1.75, -Math.PI * .66, -Math.PI * .34); ctx.stroke()
    ctx.fillStyle = '#ffffff'
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * r * .3, -r * .18, r * .13, 0, Math.PI * 2); ctx.fill() }
    ctx.strokeStyle = '#1f5f2a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.arc(0, r * .02, r * .3, Math.PI * .15, Math.PI * .85); ctx.stroke()
  } else if (kind === 'normal') {
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
  const radius = kind ? BALLS[kind].radius : 22
  // うしろの ゴム → たま → まえの ゴム の じゅんに かさねる。
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#4a2a14'
  ctx.lineWidth = 7
  if (loaded) {
    ctx.beginPath(); ctx.moveTo(FORK_RIGHT.x, FORK_RIGHT.y); ctx.lineTo(ball.x - radius * .7, ball.y); ctx.stroke()
    drawBall(ctx, kind, ball.x, ball.y, radius, 0, scene.time)
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
    const r = Math.round(BALLS[kind].radius * .78)
    const x = SLING.x - 70 - i * 46
    const hop = scene.reducedMotion ? 0 : Math.max(0, Math.sin(scene.time * 3 - i * .8)) * 5
    ctx.fillStyle = 'rgba(40,60,20,.25)'
    ctx.beginPath(); ctx.ellipse(x, GROUND_Y, r * .9, 4, 0, 0, Math.PI * 2); ctx.fill()
    drawBall(ctx, kind, x, GROUND_Y - r - hop, r, 0, scene.time)
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
    } else if (p.kind === 'helmet') {
      ctx.rotate(p.angle)
      drawHelmet(ctx, p.size * 2)
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
