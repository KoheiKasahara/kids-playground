import { BALL_RADIUS, CANNON, WORLD, type Difficulty, type TargetKind } from './levels'
import { blinkAlpha, muzzle, wallContact, type Game, type GameEvent, type Point, type Target, type Wall } from './world'

// canvas への 絵の かきかただけを 持つ。ゲームの すすみかたは world.ts が きめる。

/** 草の はじまる たかさ（せかいの 座標）。 */
const GROUND_Y = 648

export type View = { scale: number; ox: number; oy: number; w: number; h: number }

/** まとが でてこない せかいの 上の はば。ここは HUD と かさなっても よい。 */
const SKY_TOP = 70

/**
 * せかい ぜんぶが 画面に おさまるように する。上の HUD（せまい 画面では 2だん）の 下から
 * まとが はじまるように して、あまった たては 上に 多めに くばる。
 */
export function makeView(w: number, h: number): View {
  // よこながで りょうわきが ひろい ときは、HUD が わきに おさまるので 上を あけなくて よい。
  const sideRoom = (w - WORLD.width * (h - 8) / (WORLD.height - SKY_TOP)) / 2
  const hud = sideRoom >= 290 ? 8 : w <= 520 ? 118 : 64
  const scale = Math.max(.1, Math.min(w / WORLD.width, (h - hud) / (WORLD.height - SKY_TOP)))
  const top = hud - SKY_TOP * scale
  const free = Math.max(0, h - top - WORLD.height * scale)
  return { scale, w, h, ox: (w - WORLD.width * scale) / 2, oy: top + free * .6 }
}
export const toWorld = (view: View, sx: number, sy: number): Point => ({ x: (sx - view.ox) / view.scale, y: (sy - view.oy) / view.scale })

export type Particle = {
  kind: 'shard' | 'spark' | 'ring' | 'smoke' | 'text' | 'dot'
  x: number; y: number; vx: number; vy: number
  life: number; max: number
  size: number; color: string
  angle: number; spin: number
  gravity: number
  text?: string
}
export type Fx = {
  particles: Particle[]
  shake: number
  flash: number
  recoil: number
  pulse: Map<number, number>
  flashTarget: Map<number, number>
}
export const createFx = (): Fx => ({ particles: [], shake: 0, flash: 0, recoil: 0, pulse: new Map(), flashTarget: new Map() })

let seed = 7
function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
function hash(n: number) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }

const SHARDS: Record<TargetKind, string[]> = {
  normal: ['#ef4b4b', '#ffffff', '#ffc53d', '#ef4b4b'],
  hard: ['#9fb3c2', '#3d8ef0', '#ffffff', '#6b7f8e'],
  gold: ['#ffd54f', '#fff6b3', '#ff9f1a', '#ffe98a'],
}

function burst(fx: Fx, x: number, y: number, count: number, make: (i: number) => Partial<Particle> & Pick<Particle, 'kind' | 'color'>) {
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2
    const speed = 1 + rand() * 4.5
    fx.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 0, max: 36 + rand() * 26, size: 5 + rand() * 6, angle: rand() * 6, spin: (rand() - .5) * .5, gravity: .16, ...make(i) })
  }
}
const text = (x: number, y: number, value: string, color: string, size: number): Particle =>
  ({ kind: 'text', x, y, vx: 0, vy: -1.1, life: 0, max: 58, size, color, angle: 0, spin: 0, gravity: 0, text: value })
const ring = (x: number, y: number, size: number, color: string, max = 24): Particle =>
  ({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0, max, size, color, angle: 0, spin: 0, gravity: 0 })

/** できごとに あわせて はへんや けむりを まく。 */
export function spawnFx(fx: Fx, event: GameEvent) {
  if (fx.particles.length > 420) fx.particles.splice(0, fx.particles.length - 420)
  if (event.type === 'fire') {
    fx.flash = 1
    fx.recoil = 1
    const dx = Math.sin(event.angle), dy = -Math.cos(event.angle)
    for (let i = 0; i < 7; i++) {
      const s = .6 + rand() * 1.6, side = (rand() - .5) * 1.6
      fx.particles.push({ kind: 'smoke', x: event.x, y: event.y, vx: dx * s + dy * side, vy: dy * s - dx * side, life: 0, max: 30 + rand() * 18, size: 7 + rand() * 7, color: '#ffffff', angle: 0, spin: 0, gravity: -.02 })
    }
  } else if (event.type === 'hit') {
    const colors = SHARDS[event.kind]
    const push = Math.hypot(event.vx, event.vy) || 1
    const nx = event.vx / push, ny = event.vy / push
    fx.flashTarget.set(event.target, 1)
    if (!event.broken) {
      burst(fx, event.x, event.y, 7, i => ({ kind: 'shard', color: colors[i % 2 ? 0 : 3], size: 4 + rand() * 3 }))
      fx.particles.push(ring(event.x, event.y, 46, '#ffffff', 18))
      fx.particles.push(text(event.x, event.y - 38, 'あと 1かい！', '#ffffff', 17))
      fx.shake = Math.max(fx.shake, 3)
      return
    }
    burst(fx, event.x, event.y, event.kind === 'gold' ? 12 : 16, i => ({
      kind: 'shard', color: colors[i % colors.length], vx: (rand() - .5) * 7 + nx * 3, vy: (rand() - .5) * 7 + ny * 2 - 1.5, size: 7 + rand() * 9,
    }))
    burst(fx, event.x, event.y, event.kind === 'gold' ? 18 : 9, i => ({ kind: 'spark', color: i % 2 ? '#fff7b0' : '#ffd23f', size: 5 + rand() * 6, gravity: .02, max: 30 + rand() * 20 }))
    fx.particles.push(ring(event.x, event.y, event.kind === 'gold' ? 90 : 70, event.kind === 'gold' ? '#ffe45c' : '#ffffff'))
    fx.particles.push(text(event.x, event.y - 36, `+${event.score}`, event.kind === 'gold' ? '#ffe45c' : '#ffffff', event.kind === 'gold' ? 30 : 24))
    if (event.combo >= 2) fx.particles.push({ ...text(event.x, event.y - 66, `れんぞく ${event.combo}！`, '#7df9ff', 19), max: 66 })
    fx.shake = Math.max(fx.shake, event.kind === 'normal' ? 3 : 6)
  } else if (event.type === 'block') {
    burst(fx, event.x, event.y, 6, () => ({ kind: 'smoke', color: '#f2efe8', size: 6 + rand() * 6, vx: (rand() - .5) * 2, vy: rand() * 1.5, gravity: -.01, max: 34 }))
    burst(fx, event.x, event.y, 5, () => ({ kind: 'dot', color: '#ffb74d', size: 3 + rand() * 2.5 }))
    fx.pulse.set(event.wall, .6)
    fx.shake = Math.max(fx.shake, 2)
  } else if (event.type === 'bounce') {
    fx.particles.push(ring(event.x, event.y, 34, '#ff8fc8', 18))
    burst(fx, event.x, event.y, 5, () => ({ kind: 'dot', color: '#ffc2e0', size: 3 + rand() * 2 }))
    fx.pulse.set(event.wall, 1)
  } else if (event.type === 'vanish') {
    burst(fx, event.x, event.y, 8, () => ({ kind: 'spark', color: '#fff7b0', gravity: 0, size: 4 + rand() * 4 }))
  }
}

export function updateFx(fx: Fx) {
  for (const p of fx.particles) {
    p.life++
    p.x += p.vx
    p.y += p.vy
    p.vy += p.gravity
    if (p.kind === 'smoke') { p.vx *= .93; p.vy *= .93; p.size *= 1.018 }
    if (p.kind === 'text') p.vy *= .96
    p.angle += p.spin
  }
  fx.particles = fx.particles.filter(p => p.life < p.max)
  fx.shake *= .86
  fx.flash = Math.max(0, fx.flash - .14)
  fx.recoil *= .8
  for (const map of [fx.pulse, fx.flashTarget]) {
    for (const [key, value] of map) {
      if (value < .03) map.delete(key)
      else map.set(key, value * .86)
    }
  }
}

// ---------------- はいけい ----------------

type Theme = {
  sky: [string, string, string]
  hills: [string, string, string]
  ground: [string, string]
  rail: string
}
const THEMES: Record<Difficulty, Theme> = {
  easy: { sky: ['#4fb9f2', '#a6e2fb', '#fdf6d8'], hills: ['#a6dd84', '#7ccb5b', '#5bb343'], ground: ['#63b949', '#3f9331'], rail: 'rgba(255,255,255,.7)' },
  normal: { sky: ['#6a4fb3', '#f07d86', '#ffd28a'], hills: ['#c07aa6', '#8b5a9c', '#5e457f'], ground: ['#6e4c86', '#4a3363'], rail: 'rgba(255,240,220,.72)' },
  hard: { sky: ['#070b2b', '#1c2766', '#3b3f8c'], hills: ['#27336b', '#1c2552', '#121a3d'], ground: ['#1d2a55', '#10183a'], rail: 'rgba(160,220,255,.6)' },
}

let bgCache: { key: string; canvas: HTMLCanvasElement } | null = null

function hill(ctx: CanvasRenderingContext2D, w: number, base: number, amp: number, freq: number, shift: number, color: string, bottom: number) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, bottom)
  for (let x = 0; x <= w + 8; x += 8) ctx.lineTo(x, base - amp * (.6 * Math.sin(x * freq + shift) + .4 * Math.sin(x * freq * 2.3 + shift * 1.7)))
  ctx.lineTo(w, bottom)
  ctx.closePath()
  ctx.fill()
}

/** うごかない はいけいを 1まいの 絵に しておき、毎フレームは はりつけるだけに する。 */
function staticBackground(view: View, difficulty: Difficulty, dpr: number): HTMLCanvasElement | null {
  const key = `${view.w}x${view.h}@${dpr}:${difficulty}`
  if (bgCache?.key === key) return bgCache.canvas
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(view.w * dpr))
  canvas.height = Math.max(1, Math.round(view.h * dpr))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(dpr, dpr)
  const theme = THEMES[difficulty]
  const { w, h } = view
  const gy = view.oy + GROUND_Y * view.scale
  const sky = ctx.createLinearGradient(0, 0, 0, gy)
  sky.addColorStop(0, theme.sky[0])
  sky.addColorStop(.6, theme.sky[1])
  sky.addColorStop(1, theme.sky[2])
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  const s = view.scale
  if (difficulty === 'normal') {
    // ゆうひ。
    const sx = w * .72, sy = gy - 150 * s
    const glow = ctx.createRadialGradient(sx, sy, 10 * s, sx, sy, 220 * s)
    glow.addColorStop(0, 'rgba(255,236,170,.9)')
    glow.addColorStop(1, 'rgba(255,190,120,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#ffe9a8'
    ctx.beginPath(); ctx.arc(sx, sy, 58 * s, 0, Math.PI * 2); ctx.fill()
  }
  if (difficulty === 'hard') {
    // つき。
    const mx = Math.min(w * .78, view.ox + 350 * s), my = view.oy + 150 * s
    const glow = ctx.createRadialGradient(mx, my, 20 * s, mx, my, 150 * s)
    glow.addColorStop(0, 'rgba(255,250,210,.35)')
    glow.addColorStop(1, 'rgba(255,250,210,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)
    // みかづきは べつの 小さな canvas で まるを くりぬいて つくる（空の いろに たよらない）。
    const size = Math.ceil(80 * s)
    const moon = document.createElement('canvas')
    moon.width = moon.height = Math.max(1, Math.round(size * dpr))
    const m = moon.getContext('2d')
    if (m) {
      m.scale(dpr, dpr)
      m.fillStyle = '#fff8d6'
      m.beginPath(); m.arc(size / 2, size / 2, 34 * s, 0, Math.PI * 2); m.fill()
      m.globalCompositeOperation = 'destination-out'
      m.beginPath(); m.arc(size / 2 + 15 * s, size / 2 - 10 * s, 30 * s, 0, Math.PI * 2); m.fill()
      ctx.drawImage(moon, mx - size / 2, my - size / 2, size, size)
    }
  }
  hill(ctx, w, gy - 70 * s, 34 * s, .012 / s, 1.3, theme.hills[0], h)
  hill(ctx, w, gy - 30 * s, 26 * s, .018 / s, 4.1, theme.hills[1], h)
  hill(ctx, w, gy + 4 * s, 12 * s, .026 / s, 2.2, theme.hills[2], h)
  const ground = ctx.createLinearGradient(0, gy, 0, h)
  ground.addColorStop(0, theme.ground[0])
  ground.addColorStop(1, theme.ground[1])
  ctx.fillStyle = ground
  ctx.fillRect(0, gy + 10 * s, w, h)
  // はな・くさ（夜は ほたるの かわりに ちいさな ひかり）。
  for (let i = 0; i < Math.round(w / 14); i++) {
    const x = hash(i) * w, y = gy + 18 * s + hash(i + 50) * Math.max(10, h - gy - 24 * s)
    if (difficulty === 'easy') {
      ctx.fillStyle = ['#ffffff', '#ffe066', '#ff9ec7'][i % 3]
      ctx.beginPath(); ctx.arc(x, y, 2.6 * s, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.strokeStyle = difficulty === 'normal' ? 'rgba(255,220,200,.25)' : 'rgba(150,190,255,.2)'
      ctx.lineWidth = 2 * s
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3 * s, y - 7 * s); ctx.moveTo(x, y); ctx.lineTo(x + 3 * s, y - 8 * s); ctx.stroke()
    }
  }
  bgCache = { key, canvas }
  return canvas
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, 18 * s, 0, Math.PI * 2)
  ctx.arc(x + 20 * s, y - 10 * s, 22 * s, 0, Math.PI * 2)
  ctx.arc(x + 44 * s, y, 17 * s, 0, Math.PI * 2)
  ctx.rect(x, y, 44 * s, 17 * s)
  ctx.fill()
}

function animatedBackground(ctx: CanvasRenderingContext2D, view: View, difficulty: Difficulty, time: number, reducedMotion: boolean) {
  const { w, scale: s } = view
  const t = reducedMotion ? 0 : time
  if (difficulty === 'easy') {
    const sx = view.ox + 60 * s, sy = view.oy + 80 * s
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(t * .15)
    ctx.fillStyle = 'rgba(255,245,170,.55)'
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6)
      ctx.beginPath(); ctx.moveTo(-6 * s, 42 * s); ctx.lineTo(0, 64 * s); ctx.lineTo(6 * s, 42 * s); ctx.fill()
    }
    ctx.restore()
    const sun = ctx.createRadialGradient(sx - 8 * s, sy - 8 * s, 4 * s, sx, sy, 36 * s)
    sun.addColorStop(0, '#fffbe0')
    sun.addColorStop(1, '#ffd84a')
    ctx.fillStyle = sun
    ctx.beginPath(); ctx.arc(sx, sy, 34 * s, 0, Math.PI * 2); ctx.fill()
    for (let i = 0; i < 4; i++) {
      const span = w + 140 * s
      const x = ((hash(i + 3) * span + t * (8 + i * 4) * s) % span) - 90 * s
      cloud(ctx, x, view.oy + (70 + hash(i + 9) * 260) * s, s * (.8 + hash(i) * .5), 'rgba(255,255,255,.85)')
    }
  } else if (difficulty === 'normal') {
    for (let i = 0; i < 3; i++) {
      const span = w + 120 * s
      const x = ((hash(i + 3) * span + t * (6 + i * 3) * s) % span) - 80 * s
      cloud(ctx, x, view.oy + (90 + hash(i + 19) * 200) * s, s * (.9 + hash(i) * .5), 'rgba(255,214,200,.45)')
    }
    ctx.strokeStyle = 'rgba(70,40,90,.55)'
    ctx.lineWidth = 2.2 * s
    ctx.lineCap = 'round'
    for (let i = 0; i < 4; i++) {
      const span = w + 60 * s
      const x = ((hash(i + 30) * span + t * 18 * s) % span) - 30 * s
      const y = view.oy + (140 + hash(i + 40) * 150) * s + Math.sin(t * 2 + i) * 4 * s
      const flap = Math.sin(t * 8 + i * 2) * 4 * s
      ctx.beginPath(); ctx.moveTo(x - 8 * s, y - flap); ctx.quadraticCurveTo(x - 4 * s, y - 4 * s, x, y); ctx.quadraticCurveTo(x + 4 * s, y - 4 * s, x + 8 * s, y - flap); ctx.stroke()
    }
  } else {
    const gy = view.oy + GROUND_Y * s
    for (let i = 0; i < 70; i++) {
      const x = hash(i) * w, y = hash(i + 100) * (gy - 80 * s)
      const tw = .45 + .55 * Math.abs(Math.sin(t * (.6 + hash(i + 7) * 1.4) + i))
      ctx.fillStyle = `rgba(255,255,240,${(tw * (.4 + hash(i + 3) * .6)).toFixed(3)})`
      const r = (.8 + hash(i + 11) * 1.6) * s
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }
    for (let i = 0; i < 9; i++) {
      const x = hash(i + 60) * w + Math.sin(t * .7 + i * 3) * 18 * s
      const y = gy - (10 + hash(i + 70) * 60) * s + Math.cos(t * .9 + i) * 10 * s
      const a = .35 + .35 * Math.sin(t * 3 + i * 2)
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 9 * s)
      glow.addColorStop(0, `rgba(220,255,140,${a.toFixed(3)})`)
      glow.addColorStop(1, 'rgba(220,255,140,0)')
      ctx.fillStyle = glow
      ctx.beginPath(); ctx.arc(x, y, 9 * s, 0, Math.PI * 2); ctx.fill()
    }
  }
  // えんにちの はた（ガーランド）。
  const top = Math.max(0, view.oy - 6 * s) + 58 * s
  const colors = difficulty === 'hard' ? ['#ff6b6b', '#ffd23f', '#7df9ff', '#b388ff'] : ['#ff6b6b', '#ffd23f', '#5ec2ff', '#7bd66f', '#ff9ad5']
  const count = Math.max(6, Math.round(w / (34 * s)))
  const sag = 22 * s
  ctx.strokeStyle = 'rgba(255,255,255,.75)'
  ctx.lineWidth = 1.5 * s
  ctx.beginPath()
  for (let i = 0; i <= count; i++) {
    const x = (i / count) * w, y = top + Math.sin((i / count) * Math.PI) * sag
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()
  for (let i = 0; i < count; i++) {
    const u = (i + .5) / count
    const x = u * w, y = top + Math.sin(u * Math.PI) * sag
    const sway = Math.sin(t * 2 + i) * 2 * s
    ctx.fillStyle = colors[i % colors.length]
    ctx.beginPath(); ctx.moveTo(x - 9 * s, y - 1); ctx.lineTo(x + 9 * s, y - 1); ctx.lineTo(x + sway, y + 17 * s); ctx.closePath(); ctx.fill()
    if (difficulty === 'hard') {
      ctx.fillStyle = 'rgba(255,255,255,.18)'
      ctx.beginPath(); ctx.arc(x + sway * .5, y + 6 * s, 8 * s, 0, Math.PI * 2); ctx.fill()
    }
  }
}

// ---------------- ぶたいの もの ----------------

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function dashedPath(ctx: CanvasRenderingContext2D, color: string, draw: () => void) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.setLineDash([2, 9])
  ctx.beginPath()
  draw()
  ctx.stroke()
  ctx.restore()
}

/** うごく ものの とおりみちを うすく かいて、どこへ いくか わかるように する。 */
function drawTracks(ctx: CanvasRenderingContext2D, game: Game, theme: Theme) {
  game.level.targets.forEach((def, i) => {
    const m = def.motion
    if (!m || !game.targets[i].alive) return
    if (m.kind === 'line') {
      dashedPath(ctx, theme.rail, () => { ctx.moveTo(def.x - m.dx, def.y - m.dy); ctx.lineTo(def.x + m.dx, def.y + m.dy) })
      ctx.fillStyle = theme.rail
      for (const k of [-1, 1]) { ctx.beginPath(); ctx.arc(def.x + m.dx * k, def.y + m.dy * k, 4, 0, Math.PI * 2); ctx.fill() }
    } else dashedPath(ctx, theme.rail, () => ctx.arc(def.x, def.y, m.radius, 0, Math.PI * 2))
  })
  for (const w of game.walls) {
    const m = w.def.motion
    if (!m) continue
    if (m.kind === 'line') {
      dashedPath(ctx, 'rgba(90,60,30,.35)', () => {
        ctx.moveTo(w.def.x - m.dx - (w.def.w ?? 0) / 2, w.def.y - m.dy)
        ctx.lineTo(w.def.x + m.dx + (w.def.w ?? 0) / 2, w.def.y + m.dy)
      })
    } else dashedPath(ctx, 'rgba(200,160,255,.5)', () => ctx.arc(w.def.x, w.def.y, m.radius, 0, Math.PI * 2))
  }
}

function drawWall(ctx: CanvasRenderingContext2D, wall: Wall, time: number, pulse: number) {
  const def = wall.def
  const alpha = blinkAlpha(def.blink, time)
  ctx.save()
  ctx.translate(wall.x, wall.y)
  if (def.r !== undefined) {
    // まわる ガード。
    const r = def.r * (1 + pulse * .15)
    ctx.fillStyle = 'rgba(0,0,0,.2)'
    ctx.beginPath(); ctx.ellipse(3, 5, r, r * .9, 0, 0, Math.PI * 2); ctx.fill()
    const g = ctx.createRadialGradient(-r * .35, -r * .35, r * .1, 0, 0, r)
    g.addColorStop(0, '#e5d4ff')
    g.addColorStop(.45, '#a77bff')
    g.addColorStop(1, '#5b2aa8')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#3d1a7a'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#2b1150'
    ctx.beginPath(); ctx.arc(-r * .32, -r * .05, r * .14, 0, Math.PI * 2); ctx.arc(r * .32, -r * .05, r * .14, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(-r * .28, -r * .1, r * .05, 0, Math.PI * 2); ctx.arc(r * .36, -r * .1, r * .05, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    return
  }
  const w = def.w ?? 0, h = def.h ?? 0
  if (def.blink) {
    if (alpha <= 0) {
      ctx.strokeStyle = 'rgba(160,240,255,.4)'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 7])
      roundRect(ctx, -w / 2, -h / 2, w, h, 8)
      ctx.stroke()
    } else {
      ctx.globalAlpha = alpha
      ctx.shadowColor = '#5ef0ff'
      ctx.shadowBlur = 16
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
      g.addColorStop(0, 'rgba(160,250,255,.85)')
      g.addColorStop(1, 'rgba(40,170,230,.75)')
      ctx.fillStyle = g
      roundRect(ctx, -w / 2, -h / 2, w, h, 8)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.strokeStyle = '#e8feff'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.save()
      roundRect(ctx, -w / 2, -h / 2, w, h, 8)
      ctx.clip()
      ctx.strokeStyle = 'rgba(255,255,255,.45)'
      ctx.lineWidth = 3
      const shift = (time * 40) % 18
      for (let x = -w / 2 - h + shift; x < w / 2; x += 18) { ctx.beginPath(); ctx.moveTo(x, h / 2); ctx.lineTo(x + h, -h / 2); ctx.stroke() }
      ctx.restore()
    }
    ctx.restore()
    return
  }
  if (def.kind === 'bouncy') {
    const squash = 1 + Math.sin(pulse * 18) * pulse * .12
    const vertical = h > w
    ctx.scale(vertical ? squash : 1 / squash, vertical ? 1 / squash : squash)
    ctx.fillStyle = 'rgba(0,0,0,.18)'
    roundRect(ctx, -w / 2 + 3, -h / 2 + 5, w, h, Math.min(w, h) / 2)
    ctx.fill()
    const g = vertical ? ctx.createLinearGradient(-w / 2, 0, w / 2, 0) : ctx.createLinearGradient(0, -h / 2, 0, h / 2)
    g.addColorStop(0, '#ffb3dc')
    g.addColorStop(.5, '#ff5fae')
    g.addColorStop(1, '#d6337f')
    ctx.fillStyle = g
    roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) / 2)
    ctx.fill()
    ctx.strokeStyle = '#a61e5f'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,.55)'
    const long = Math.max(w, h), short = Math.min(w, h)
    for (let d = -long / 2 + short; d < long / 2 - short / 2; d += short * 1.4) {
      ctx.beginPath()
      if (vertical) ctx.arc(-w * .12, d, short * .16, 0, Math.PI * 2)
      else ctx.arc(d, -h * .12, short * .16, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    return
  }
  const shake = pulse > 0 ? Math.sin(pulse * 40) * pulse * 2 : 0
  ctx.translate(shake, 0)
  ctx.fillStyle = 'rgba(0,0,0,.2)'
  roundRect(ctx, -w / 2 + 3, -h / 2 + 5, w, h, 6)
  ctx.fill()
  if (def.motion) {
    // うごく かべは 木の いた。
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
    g.addColorStop(0, '#f0b36a')
    g.addColorStop(1, '#b97431')
    ctx.fillStyle = g
    roundRect(ctx, -w / 2, -h / 2, w, h, 6)
    ctx.fill()
    ctx.strokeStyle = '#7a4a1e'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.strokeStyle = 'rgba(122,74,30,.35)'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(-w / 2 + 8, -h * .12); ctx.bezierCurveTo(-w * .1, -h * .3, w * .1, h * .1, w / 2 - 8, -h * .05); ctx.stroke()
    ctx.fillStyle = '#6b4a2e'
    for (const x of [-w / 2 + 9, w / 2 - 9]) { ctx.beginPath(); ctx.arc(x, 0, 2.5, 0, Math.PI * 2); ctx.fill() }
    // やじるしで うごく ことを しめす。
    ctx.fillStyle = 'rgba(255,255,255,.75)'
    for (const k of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(k * 22, -5); ctx.lineTo(k * 30, 0); ctx.lineTo(k * 22, 5); ctx.closePath(); ctx.fill()
    }
  } else {
    // いしの かべ。
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
    g.addColorStop(0, '#c9d1dc')
    g.addColorStop(1, '#8391a4')
    ctx.fillStyle = g
    roundRect(ctx, -w / 2, -h / 2, w, h, 6)
    ctx.fill()
    ctx.save()
    roundRect(ctx, -w / 2, -h / 2, w, h, 6)
    ctx.clip()
    ctx.strokeStyle = 'rgba(70,82,100,.45)'
    ctx.lineWidth = 1.5
    const rows = Math.max(1, Math.round(h / 13))
    for (let r = 1; r < rows; r++) { const y = -h / 2 + (h / rows) * r; ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); ctx.stroke() }
    for (let r = 0; r < rows; r++) {
      const y0 = -h / 2 + (h / rows) * r
      for (let x = -w / 2 + (r % 2 ? 14 : 28); x < w / 2; x += 28) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + h / rows); ctx.stroke() }
    }
    ctx.fillStyle = 'rgba(255,255,255,.35)'
    ctx.fillRect(-w / 2, -h / 2, w, 3)
    ctx.restore()
    ctx.strokeStyle = '#5b687a'
    ctx.lineWidth = 2
    roundRect(ctx, -w / 2, -h / 2, w, h, 6)
    ctx.stroke()
  }
  ctx.restore()
}

const easeOutBack = (u: number) => { const c = 1.7; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2) }

function star(ctx: CanvasRenderingContext2D, r: number, inner = .45) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5
    const rr = i % 2 ? r * inner : r
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath()
}

function drawTarget(ctx: CanvasRenderingContext2D, target: Target, time: number, flash: number, reducedMotion: boolean) {
  const appear = Math.max(0, Math.min(1, (time - target.index * .09) / .45))
  const bob = reducedMotion ? 1 : 1 + Math.sin(time * 3 + target.index) * .025
  const scale = Math.max(0, easeOutBack(appear)) * bob * (1 + flash * .12)
  if (scale < .02) return
  const r = target.r
  ctx.save()
  ctx.translate(target.x, target.y)
  ctx.fillStyle = 'rgba(0,0,0,.18)'
  ctx.beginPath(); ctx.ellipse(4 * scale, 7 * scale, r * scale, r * .92 * scale, 0, 0, Math.PI * 2); ctx.fill()
  ctx.scale(scale, scale)
  if (target.kind === 'gold') {
    const halo = ctx.createRadialGradient(0, 0, r * .6, 0, 0, r * 2)
    halo.addColorStop(0, 'rgba(255,230,120,.55)')
    halo.addColorStop(1, 'rgba(255,230,120,0)')
    ctx.fillStyle = halo
    ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, Math.PI * 2); ctx.fill()
    const g = ctx.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r)
    g.addColorStop(0, '#fff8c4')
    g.addColorStop(.55, '#ffd23f')
    g.addColorStop(1, '#e08a00')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#a85f00'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#fff3b0'
    ctx.strokeStyle = '#d98200'
    ctx.lineWidth = 1.5
    star(ctx, r * .62)
    ctx.fill()
    ctx.stroke()
    const tw = reducedMotion ? .6 : (Math.sin(time * 5) * .5 + .5)
    ctx.save()
    ctx.translate(r * .55, -r * .55)
    ctx.rotate(time * 2)
    ctx.fillStyle = `rgba(255,255,255,${(.4 + tw * .6).toFixed(3)})`
    star(ctx, 6 + tw * 3, .25)
    ctx.fill()
    ctx.restore()
  } else {
    const hard = target.kind === 'hard'
    const rings = hard ? ['#2f7fe0', '#ffffff', '#2f7fe0', '#ffffff', '#ffc53d'] : ['#e53935', '#ffffff', '#e53935', '#ffffff', '#ffc53d']
    const inner = hard ? r * .8 : r
    if (hard) {
      // はがねの ふち。
      const rim = ctx.createLinearGradient(-r, -r, r, r)
      rim.addColorStop(0, '#eef3f7')
      rim.addColorStop(.5, '#98a9b8')
      rim.addColorStop(1, '#5d6e7d')
      ctx.fillStyle = rim
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#46525e'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#56636f'
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + Math.PI / 6
        ctx.beginPath(); ctx.arc(Math.cos(a) * r * .9, Math.sin(a) * r * .9, 2, 0, Math.PI * 2); ctx.fill()
      }
    }
    rings.forEach((color, i) => {
      ctx.fillStyle = color
      ctx.beginPath(); ctx.arc(0, 0, inner * (1 - i * .2), 0, Math.PI * 2); ctx.fill()
    })
    ctx.strokeStyle = hard ? '#1b4f99' : '#9c1f1b'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, inner, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,.5)'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.arc(0, 0, inner * .86, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke()
    if (hard && target.hp === 1) {
      ctx.strokeStyle = '#1f2a36'
      ctx.lineWidth = 2.2
      ctx.lineJoin = 'round'
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + .4
        ctx.beginPath()
        ctx.moveTo(0, 0)
        for (let s = 1; s <= 3; s++) ctx.lineTo(Math.cos(a + (s % 2 ? .25 : -.2)) * r * s / 3, Math.sin(a + (s % 2 ? .25 : -.2)) * r * s / 3)
        ctx.stroke()
      }
    }
  }
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(flash * .8).toFixed(3)})`
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r = BALL_RADIUS) {
  const g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .15, x, y, r)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(.35, '#ffe07a')
  g.addColorStop(1, '#f08a0c')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#b35d00'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function drawCannon(ctx: CanvasRenderingContext2D, angle: number, fx: Fx, ready: boolean, ammo: number) {
  const { x, y } = CANNON
  // のこりの たま（たいほうの よこに ならべる）。
  for (let i = 0; i < ammo; i++) {
    const left = i % 2 === 0
    const k = Math.floor(i / 2)
    drawBall(ctx, left ? x - 64 - k * 19 : x + 64 + k * 19, y + 26, 8)
  }
  const recoil = fx.recoil * 9
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.translate(0, recoil)
  const bw = 17, len = CANNON.barrel + 6
  const g = ctx.createLinearGradient(-bw, 0, bw, 0)
  g.addColorStop(0, '#26306e')
  g.addColorStop(.35, '#6272d6')
  g.addColorStop(.6, '#3d4bb0')
  g.addColorStop(1, '#1d2458')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(-bw, 6)
  ctx.lineTo(-bw * .78, -len + 6)
  ctx.lineTo(bw * .78, -len + 6)
  ctx.lineTo(bw, 6)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#141a45'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#ffc53d'
  ctx.strokeStyle = '#a86b00'
  roundRect(ctx, -bw * .95, -len * .45, bw * 1.9, 7, 3)
  ctx.fill(); ctx.stroke()
  roundRect(ctx, -bw * .92, -len - 2, bw * 1.84, 11, 4)
  ctx.fill(); ctx.stroke()
  if (ready) {
    ctx.fillStyle = '#141a45'
    ctx.beginPath(); ctx.ellipse(0, -len - 2, bw * .62, 4, 0, 0, Math.PI * 2); ctx.fill()
    drawBall(ctx, 0, -len + 2, 8)
  }
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255,236,150,${fx.flash.toFixed(3)})`
    ctx.translate(0, -len - 8)
    star(ctx, 22 * fx.flash + 8, .4)
    ctx.fill()
  }
  ctx.restore()
  // しゃりん と だい。
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = 'rgba(0,0,0,.2)'
  ctx.beginPath(); ctx.ellipse(0, 36, 54, 8, 0, 0, Math.PI * 2); ctx.fill()
  const base = ctx.createLinearGradient(0, -6, 0, 26)
  base.addColorStop(0, '#d0894a')
  base.addColorStop(1, '#8a5325')
  ctx.fillStyle = base
  ctx.beginPath()
  ctx.moveTo(-34, 26); ctx.lineTo(-24, -4); ctx.quadraticCurveTo(0, -16, 24, -4); ctx.lineTo(34, 26); ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#5c3413'
  ctx.lineWidth = 2
  ctx.stroke()
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(side * 30, 22)
    ctx.rotate(-fx.recoil * side * .6)
    ctx.fillStyle = '#6b3e19'
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#e0a764'
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#6b3e19'
    ctx.lineWidth = 2.5
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.stroke() }
    ctx.fillStyle = '#ffc53d'
    ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
  ctx.fillStyle = '#ffc53d'
  ctx.strokeStyle = '#a86b00'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.restore()
}

/** ねらいの てんせん。いま かべが ある ところで とめる（うごく ものの さきよみは しない）。 */
function aimLength(game: Game, angle: number, distance: number): number {
  const start = muzzle(angle)
  const dx = Math.sin(angle), dy = -Math.cos(angle)
  for (let d = 0; d < distance; d += 6) {
    const x = start.x + dx * d, y = start.y + dy * d
    if (game.walls.some(w => w.active && wallContact(w, x, y, 3))) return d
  }
  return distance
}

function drawAim(ctx: CanvasRenderingContext2D, game: Game, aim: Point, angle: number, time: number) {
  const start = muzzle(angle)
  const dist = Math.max(40, Math.hypot(aim.x - start.x, aim.y - start.y))
  const length = aimLength(game, angle, dist)
  const dx = Math.sin(angle), dy = -Math.cos(angle)
  const shift = (time * 50) % 18
  for (let d = shift + 10; d < length; d += 18) {
    const fade = 1 - d / (dist + 40) * .55
    ctx.fillStyle = `rgba(255,255,255,${fade.toFixed(3)})`
    ctx.strokeStyle = 'rgba(30,40,80,.35)'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(start.x + dx * d, start.y + dy * d, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  if (length < dist - 2) {
    // かべに さえぎられる しるし。
    const bx = start.x + dx * length, by = start.y + dy * length
    ctx.strokeStyle = '#ff5c5c'
    ctx.lineWidth = 3.5
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(bx - 7, by - 7); ctx.lineTo(bx + 7, by + 7); ctx.moveTo(bx + 7, by - 7); ctx.lineTo(bx - 7, by + 7); ctx.stroke()
  }
  ctx.save()
  ctx.translate(aim.x, aim.y)
  ctx.rotate(time * 1.5)
  ctx.strokeStyle = 'rgba(20,30,70,.5)'
  ctx.lineWidth = 5
  ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke()
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2)
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, 24); ctx.stroke()
  }
  ctx.fillStyle = '#ff5c5c'
  ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawParticles(ctx: CanvasRenderingContext2D, fx: Fx) {
  for (const p of fx.particles) {
    const u = p.life / p.max
    const a = 1 - u
    ctx.save()
    ctx.globalAlpha = Math.max(0, a)
    ctx.translate(p.x, p.y)
    if (p.kind === 'shard') {
      ctx.rotate(p.angle)
      ctx.fillStyle = p.color
      ctx.strokeStyle = 'rgba(0,0,0,.25)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(-p.size / 2, -p.size / 3); ctx.lineTo(p.size / 2, -p.size / 2); ctx.lineTo(p.size * .1, p.size / 2); ctx.closePath(); ctx.fill(); ctx.stroke()
    } else if (p.kind === 'spark') {
      ctx.rotate(p.angle)
      ctx.fillStyle = p.color
      star(ctx, p.size * (1 - u * .5), .35)
      ctx.fill()
    } else if (p.kind === 'ring') {
      ctx.strokeStyle = p.color
      ctx.lineWidth = 5 * a + 1
      ctx.beginPath(); ctx.arc(0, 0, p.size * (.3 + u * .7), 0, Math.PI * 2); ctx.stroke()
    } else if (p.kind === 'smoke') {
      ctx.globalAlpha = a * .7
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill()
    } else if (p.kind === 'dot') {
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill()
    } else if (p.text) {
      const pop = u < .15 ? .6 + u / .15 * .4 : 1
      ctx.scale(pop, pop)
      ctx.font = `900 ${p.size}px "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 5
      ctx.strokeStyle = 'rgba(30,30,70,.75)'
      ctx.strokeText(p.text, 0, 0)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, 0, 0)
    }
    ctx.restore()
  }
}

/** さいしょの ステージで「ここを タップ」と しらせる わっか。 */
function drawTapHint(ctx: CanvasRenderingContext2D, target: Target, time: number) {
  for (let k = 0; k < 2; k++) {
    const u = ((time * .9 + k * .5) % 1)
    ctx.strokeStyle = `rgba(255,255,255,${(1 - u).toFixed(3)})`
    ctx.lineWidth = 4
    ctx.beginPath(); ctx.arc(target.x, target.y, target.r + 6 + u * 26, 0, Math.PI * 2); ctx.stroke()
  }
  const bounce = Math.abs(Math.sin(time * 4)) * 8
  ctx.save()
  ctx.translate(target.x + 20, target.y + target.r + 18 + bounce)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#2b3a55'
  ctx.lineWidth = 2.5
  // ゆびさす て。
  ctx.beginPath()
  ctx.moveTo(-5, -20); ctx.quadraticCurveTo(0, -27, 5, -20); ctx.lineTo(5, -4); ctx.lineTo(13, -2); ctx.quadraticCurveTo(19, 0, 18, 8)
  ctx.lineTo(15, 20); ctx.lineTo(-7, 20); ctx.lineTo(-14, 6); ctx.quadraticCurveTo(-15, 0, -9, 1); ctx.lineTo(-5, 5); ctx.closePath()
  ctx.fill(); ctx.stroke()
  ctx.restore()
}

export type Scene = {
  view: View
  dpr: number
  time: number
  game: Game
  angle: number
  aim: Point | null
  fx: Fx
  reducedMotion: boolean
  showHint: boolean
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { view, dpr, game, fx } = scene
  const difficulty = game.level.difficulty
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const bg = staticBackground(view, difficulty, dpr)
  if (bg) ctx.drawImage(bg, 0, 0, view.w, view.h)
  else { ctx.fillStyle = THEMES[difficulty].sky[1]; ctx.fillRect(0, 0, view.w, view.h) }
  animatedBackground(ctx, view, difficulty, scene.time, scene.reducedMotion)
  const shake = scene.reducedMotion ? 0 : fx.shake
  const sx = shake ? (rand() - .5) * shake : 0, sy = shake ? (rand() - .5) * shake : 0
  ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * (view.ox + sx), dpr * (view.oy + sy))
  const theme = THEMES[difficulty]
  drawTracks(ctx, game, theme)
  for (const wall of game.walls) drawWall(ctx, wall, game.time, fx.pulse.get(wall.index) ?? 0)
  for (const target of game.targets) if (target.alive) drawTarget(ctx, target, game.time, fx.flashTarget.get(target.index) ?? 0, scene.reducedMotion)
  if (scene.showHint) {
    const first = game.targets.find(t => t.alive && t.kind !== 'gold')
    if (first) drawTapHint(ctx, first, scene.time)
  }
  for (const ball of game.balls) {
    ball.trail.forEach((p, i) => {
      const u = (i + 1) / ball.trail.length
      ctx.fillStyle = `rgba(255,214,110,${(u * .5).toFixed(3)})`
      ctx.beginPath(); ctx.arc(p.x, p.y, BALL_RADIUS * (.35 + u * .55), 0, Math.PI * 2); ctx.fill()
    })
    drawBall(ctx, ball.x, ball.y)
    ctx.fillStyle = 'rgba(255,255,255,.9)'
    ctx.beginPath(); ctx.arc(ball.x - 3.5, ball.y - 4, 2.6, 0, Math.PI * 2); ctx.fill()
  }
  if (scene.aim && game.state === 'play') drawAim(ctx, game, scene.aim, scene.angle, scene.time)
  drawCannon(ctx, scene.angle, fx, game.canFire(), Math.max(0, game.ammo - (game.canFire() ? 1 : 0)))
  drawParticles(ctx, fx)
}
