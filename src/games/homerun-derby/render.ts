import { drawBatter, drawPitcher, type PitcherPose } from './characters'
import {
  CONTACT, FENCE_HEIGHT, FOUL_ANGLE, MITT_PROGRESS, STOP_AT, fenceDistance, flightDuration, flightPoint, pitchKind, pitchPoint,
  pitchProgress, standHeight, windupTime, type Derby, type DerbyEvent, type Vec3,
} from './derby'
import { PITCH_LABELS, type SkyId } from './stages'

// canvas への 絵の かきかただけを もつ。すすみかたは derby.ts が きめる。
// ・ピッチャーの がめん: キャッチャーの うしろから みる。
// ・とんでいく がめん: ホームの うしろ うえから きゅうじょう ぜんたいを みる。

const DEG = Math.PI / 180
const FONT = '"Hiragino Maru Gothic ProN", "Hiragino Sans", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif'
const MOUND: Vec3 = { x: 0, y: .25, z: 18.44 }
const BATTER_FEET: Vec3 = { x: -.8, y: 0, z: .05 }
const BALL_RADIUS = .13
/** バットを ふる じかん[s]。 */
export const SWING_TIME = .3

type Sky = {
  sky: [string, string, string]
  body: 'sun' | 'moon'
  bodyAt: [number, number]
  bodyColor: string
  stars: number
  lights: boolean
  grass: [string, string]
  foul: string
  dirt: string
  wall: string
  seats: [string, string]
  /** きゅうじょうの そとの もり。 */
  trees: [string, string, string]
}

const SKIES: Record<SkyId, Sky> = {
  morning: { sky: ['#78c6ff', '#b9e4ff', '#eef9ff'], body: 'sun', bodyAt: [.16, .5], bodyColor: '#fff2a8', stars: 0, lights: false, grass: ['#67c957', '#59b94b'], foul: '#5cb04d', dirt: '#dba36b', wall: '#2f7d5b', seats: ['#3f7fd6', '#3470c2'], trees: ['#4a9e57', '#3f8f4c', '#58ad62'] },
  noon: { sky: ['#3aa6f5', '#7cc8fb', '#d3f0ff'], body: 'sun', bodyAt: [.82, .2], bodyColor: '#fff6bf', stars: 0, lights: false, grass: ['#65c655', '#57b649'], foul: '#5aad4b', dirt: '#d99f66', wall: '#2f7d5b', seats: ['#e2574c', '#cc4a40'], trees: ['#4a9e57', '#3f8f4c', '#58ad62'] },
  afternoon: { sky: ['#5ba4e6', '#a9d3f0', '#ffe6b3'], body: 'sun', bodyAt: [.84, .5], bodyColor: '#ffe28a', stars: 0, lights: false, grass: ['#62c053', '#55b047'], foul: '#57a84a', dirt: '#d79c62', wall: '#2c7656', seats: ['#f2a93b', '#de9730'], trees: ['#4f9a52', '#428a47', '#5aa85c'] },
  sunset: { sky: ['#6a58c2', '#ef7b7d', '#ffcb72'], body: 'sun', bodyAt: [.24, .84], bodyColor: '#ff9e45', stars: 0, lights: true, grass: ['#5bb24c', '#4fa243'], foul: '#4f9c43', dirt: '#cf9259', wall: '#2a6a50', seats: ['#8b5cd6', '#7a4ec4'], trees: ['#4a7f58', '#3e704d', '#57906a'] },
  evening: { sky: ['#272a6e', '#7a4f9a', '#e98da2'], body: 'moon', bodyAt: [.8, .26], bodyColor: '#fff6d8', stars: 40, lights: true, grass: ['#55ad4a', '#4a9c40'], foul: '#46923d', dirt: '#c98d57', wall: '#28624b', seats: ['#2fb5a8', '#279e93'], trees: ['#36584f', '#2d4c44', '#41665c'] },
  night: { sky: ['#080e30', '#162259', '#2e4c8c'], body: 'moon', bodyAt: [.18, .22], bodyColor: '#fffbe6', stars: 90, lights: true, grass: ['#52aa48', '#46993e'], foul: '#41893a', dirt: '#c58a55', wall: '#255a46', seats: ['#d6408a', '#c03579'], trees: ['#1f3a3a', '#193131', '#284646'] },
}

const CROWD = ['#ff6b6b', '#ffd43b', '#4dabf7', '#ffffff', '#69db7c', '#f783ac', '#ffa94d', '#9775fa']

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

// ---- みかた（カメラ） -----------------------------------------------------------

/** ピッチャーの がめんの カメラ（キャッチャーの うしろ）。 */
const CAM = { y: 2.6, z: -9 }

export type View = { w: number; h: number; f: number; cx: number; horizon: number }
export type ScreenPoint = { x: number; y: number; k: number }

export function makeView(w: number, h: number): View {
  const f = Math.min(h * 2, w * 2.7)
  const horizon = Math.max(h * .22, h * .88 - CAM.y * f / -CAM.z)
  return { w, h, f, cx: w / 2, horizon }
}

export function project(view: View, p: Vec3): ScreenPoint {
  const k = view.f / Math.max(.5, p.z - CAM.z)
  return { x: view.cx + p.x * k, y: view.horizon + (CAM.y - p.y) * k, k }
}

/** とんでいく がめんの カメラ（ホームの うしろ うえ から みおろす）。 */
const FLY_CAM = { y: 52, z: -40, pitch: 31 * DEG }

export type FlyView = { w: number; h: number; f: number; cx: number; cy: number }

function flyRaw(p: Vec3) {
  const ry = p.y - FLY_CAM.y, rz = p.z - FLY_CAM.z
  const depth = Math.max(1, rz * Math.cos(FLY_CAM.pitch) - ry * Math.sin(FLY_CAM.pitch))
  const up = ry * Math.cos(FLY_CAM.pitch) + rz * Math.sin(FLY_CAM.pitch)
  return { x: p.x / depth, y: -up / depth, depth }
}

/**
 * きゅうじょうが がめんに おおきく うつるように する。たてながの がめんでは
 * ファウルラインの はしを すこし はみださせて、まんなかの フェンスまでを おおきく みせる。
 */
export function makeFlyView(w: number, h: number, top = 0): FlyView {
  const side = w / h < .8 ? 27 * DEG : FOUL_ANGLE
  const points: Vec3[] = [{ x: 0, y: 0, z: -4 }]
  for (const a of [-side, 0, side]) {
    const fence = fenceDistance(a), d = fence + 24
    points.push({ x: Math.sin(a) * fence, y: 0, z: Math.cos(a) * fence })
    points.push({ x: Math.sin(a) * d, y: standHeight(d, fence) + 4, z: Math.cos(a) * d })
  }
  const raw = points.map(flyRaw)
  const minX = Math.min(...raw.map(p => p.x)), maxX = Math.max(...raw.map(p => p.x))
  const minY = Math.min(...raw.map(p => p.y)), maxY = Math.max(...raw.map(p => p.y))
  const room = Math.max(40, h - top - 56)
  const f = Math.min((w * .98) / (maxX - minX), (room * .96) / (maxY - minY))
  const cy = top + (room - (maxY - minY) * f) * .5 - minY * f
  return { w, h, f, cx: w / 2, cy }
}

export function projectFly(view: FlyView, p: Vec3): ScreenPoint {
  const r = flyRaw(p)
  return { x: view.cx + r.x * view.f, y: view.cy + r.y * view.f, k: view.f / r.depth }
}

// ---- えんしゅつ ---------------------------------------------------------------

type Particle = {
  x: number; y: number; vx: number; vy: number
  life: number; max: number; size: number; color: string
  kind: 'spark' | 'confetti' | 'dust' | 'ring'
  spin: number
}

export type Fx = {
  particles: Particle[]
  /** がめんが しろく ひかる つよさ。 */
  flash: number
  shake: number
  /** バットを ふりはじめた じかん（がめんの じかん）。 */
  swingAt: number | null
  /** ボールの なまえを だしはじめた じかん。 */
  labelAt: number
  label: string
  /** ホームランの はなびを うちあげる のこり じかん。 */
  fireworks: number
  nextFirework: number
  /** とんでいる ボールの あと（せかいの 座標）。 */
  trail: Vec3[]
  /** 「ピタッ」の もじを だした じかん。 */
  pauseAt: number
  /** うごきを へらす せってい（はなびを みじかく する）。 */
  calm: boolean
}

export function createFx(calm = false): Fx {
  return { particles: [], flash: 0, shake: 0, swingAt: null, labelAt: -9, label: '', fireworks: 0, nextFirework: 0, trail: [], pauseAt: -9, calm }
}

let seed = 11
function rand() {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

function burst(fx: Fx, x: number, y: number, count: number, colors: readonly string[], speed: number, kind: Particle['kind'], size: number) {
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2, v = speed * (.35 + rand() * .65)
    fx.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 40 + rand() * 30, size: size * (.6 + rand() * .7), color: colors[i % colors.length], kind, spin: rand() * 6 })
  }
}

/** できごとに あわせて えんしゅつを はじめる。time は がめんの じかん。 */
export function spawnFx(fx: Fx, event: DerbyEvent, view: View, time: number) {
  if (fx.particles.length > 500) fx.particles.splice(0, fx.particles.length - 500)
  if (event.type === 'release') {
    fx.label = `${PITCH_LABELS[event.kind]}！`
    fx.labelAt = time
    fx.trail = []
  } else if (event.type === 'swing') {
    fx.swingAt = time
  } else if (event.type === 'pause') {
    fx.pauseAt = time
  } else if (event.type === 'contact') {
    const at = project(view, CONTACT)
    fx.flash = .9
    fx.shake = 10
    burst(fx, at.x, at.y, 26, ['#fff6b0', '#ffffff', '#ffd43b'], 9, 'spark', 7)
    fx.particles.push({ x: at.x, y: at.y, vx: 0, vy: 0, life: 0, max: 22, size: 30, color: '#ffffff', kind: 'ring', spin: 0 })
  } else if (event.type === 'land') {
    fx.trail = []
    if (event.hit.outcome === 'homerun') {
      fx.fireworks = fx.calm ? .3 : 2.2
      fx.nextFirework = 0
      fx.shake = fx.calm ? 0 : 6
    }
  } else if (event.type === 'windup') {
    fx.swingAt = null
    fx.trail = []
    fx.fireworks = 0
  }
}

/** えんしゅつを 1フレーム すすめる。 */
export function updateFx(fx: Fx, dt: number, w: number, h: number) {
  fx.flash = Math.max(0, fx.flash - dt * 3)
  fx.shake = Math.max(0, fx.shake - dt * 30)
  if (fx.fireworks > 0) {
    fx.fireworks -= dt
    fx.nextFirework -= dt
    if (fx.nextFirework <= 0) {
      fx.nextFirework = .32
      const x = w * (.15 + rand() * .7), y = h * (.1 + rand() * .22)
      const colors = [CROWD[Math.floor(rand() * CROWD.length)], '#ffffff', CROWD[Math.floor(rand() * CROWD.length)]]
      burst(fx, x, y, 34, colors, 5.5, 'spark', 4.5)
      burst(fx, w * rand(), -10, 10, CROWD, 2, 'confetti', 7)
    }
  }
  const frames = dt * 60
  for (const p of fx.particles) {
    p.life += frames
    p.x += p.vx * frames
    p.y += p.vy * frames
    if (p.kind === 'spark') { p.vx *= .95; p.vy = p.vy * .95 + .08 * frames }
    else if (p.kind === 'confetti') { p.vy = Math.min(2.4, p.vy + .06 * frames); p.vx += Math.sin(p.life * .1 + p.spin) * .05; p.spin += .1 * frames }
    else if (p.kind === 'dust') { p.vx *= .9; p.vy *= .9 }
  }
  fx.particles = fx.particles.filter(p => p.life < p.max)
}

function drawParticles(ctx: CanvasRenderingContext2D, fx: Fx) {
  for (const p of fx.particles) {
    const a = 1 - p.life / p.max
    ctx.globalAlpha = Math.max(0, a)
    if (p.kind === 'ring') {
      ctx.strokeStyle = p.color
      ctx.lineWidth = 6 * a
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * (1 + p.life / 6), 0, Math.PI * 2)
      ctx.stroke()
    } else if (p.kind === 'confetti') {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.spin)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.restore()
    } else {
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, Math.max(.5, p.size * (p.kind === 'dust' ? 1 + p.life / 30 : a)), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

// ---- そら・スタンド -----------------------------------------------------------

function drawSky(ctx: CanvasRenderingContext2D, sky: Sky, w: number, bottom: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, bottom)
  gradient.addColorStop(0, sky.sky[0])
  gradient.addColorStop(.55, sky.sky[1])
  gradient.addColorStop(1, sky.sky[2])
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, bottom + 2)
  for (let i = 0; i < sky.stars; i++) {
    const x = hash(i) * w, y = hash(i + 99) * bottom * .8
    ctx.globalAlpha = .4 + hash(i + 7) * .6
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x, y, 1.6 + hash(i + 3) * 1.6, 1.6 + hash(i + 3) * 1.6)
  }
  ctx.globalAlpha = 1
  const [bx, by] = sky.bodyAt
  const x = w * bx, y = bottom * by, r = Math.max(14, Math.min(w, bottom * 2) * .06)
  const glow = ctx.createRadialGradient(x, y, r * .5, x, y, r * 3)
  glow.addColorStop(0, sky.body === 'sun' ? 'rgba(255, 244, 190, .7)' : 'rgba(255, 250, 220, .35)')
  glow.addColorStop(1, 'rgba(255, 244, 190, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6)
  ctx.fillStyle = sky.bodyColor
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  if (sky.body === 'moon') {
    ctx.fillStyle = sky.sky[0]
    ctx.globalAlpha = .9
    ctx.beginPath()
    ctx.arc(x + r * .45, y - r * .3, r * .85, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, sky: SkyId, w: number, bottom: number, time: number) {
  if (sky === 'night') return
  ctx.fillStyle = sky === 'evening' ? 'rgba(255, 200, 220, .35)' : sky === 'sunset' ? 'rgba(255, 226, 210, .7)' : 'rgba(255, 255, 255, .85)'
  for (let i = 0; i < 4; i++) {
    const span = w + 240
    const x = ((hash(i + 40) * span + time * (6 + i * 3)) % span) - 120
    const y = bottom * (.12 + hash(i + 50) * .45)
    const s = Math.max(.6, Math.min(1.4, w / 500)) * (.7 + hash(i + 60) * .5)
    ctx.beginPath()
    ctx.ellipse(x, y, 46 * s, 14 * s, 0, 0, Math.PI * 2)
    ctx.ellipse(x - 22 * s, y - 8 * s, 22 * s, 16 * s, 0, 0, Math.PI * 2)
    ctx.ellipse(x + 16 * s, y - 12 * s, 26 * s, 19 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

type Projector = (p: Vec3) => ScreenPoint

/** スタンドの おく ゆき[m] と だんの かず。 */
const STAND_DEPTH = 24
const STAND_ROWS = 9
/** ファウルゾーンの はば[m]（ファウルラインから スタンドまで）。 */
const FOUL_ROOM = 14

/**
 * スタンドの うちがわの ふちまでの きょり。a は まんなかを 0 と した むき（-π〜π）。
 * がいやは フェンス、ファウルゾーンは ラインに そった まっすぐの かべ、ホームの うしろは まるい かべ。
 */
function wallDistance(a: number): number {
  const abs = Math.abs(a)
  if (abs <= FOUL_ANGLE) return fenceDistance(a)
  if (abs >= Math.PI * .75) return FOUL_ROOM
  return Math.min(92 + 18 * Math.cos(2 * a), FOUL_ROOM / Math.sin(Math.min(Math.PI / 2, abs - FOUL_ANGLE)))
}

/** かべから offset[m] おくの スタンドの てん（y を きめなければ その だんの たかさ）。 */
function ringPoint(a: number, offset: number, y = FENCE_HEIGHT + offset * .55): Vec3 {
  const d = wallDistance(a) + offset
  return { x: Math.sin(a) * d, y, z: Math.cos(a) * d }
}

function angles(from: number, to: number, step = 1.5 * DEG) {
  const list: number[] = []
  for (let a = from; a < to; a += step) list.push(a)
  list.push(to)
  return list
}

function polygon(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], fill: string) {
  ctx.beginPath()
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

function band(ctx: CanvasRenderingContext2D, project: Projector, list: number[], inner: (a: number) => Vec3, outer: (a: number) => Vec3, fill: string) {
  polygon(ctx, [...list.map(a => project(inner(a))), ...list.map(a => project(outer(a))).reverse()], fill)
}

/** フェンス・スタンド・おきゃくさん。from〜to の むきだけ かく。 */
function drawStands(ctx: CanvasRenderingContext2D, project: Projector, sky: Sky, from: number, to: number) {
  const list = angles(from, to)
  // フェンス（がいやは みどり、ファウルゾーンは すこし こい いろ）。
  band(ctx, project, list, a => ringPoint(a, 0, 0), a => ringPoint(a, 0), sky.wall)
  // うしろの かべ。
  band(ctx, project, list, a => ringPoint(a, STAND_DEPTH), a => ringPoint(a, STAND_DEPTH, FENCE_HEIGHT + STAND_DEPTH * .55 + 4), '#e9edf5')
  for (let r = 0; r < STAND_ROWS; r++) {
    band(ctx, project, list, a => ringPoint(a, (r / STAND_ROWS) * STAND_DEPTH), a => ringPoint(a, ((r + 1) / STAND_ROWS) * STAND_DEPTH), sky.seats[r % 2])
  }
  // おきゃくさん（1mくらいずつ ならべる）。
  for (let r = 0; r < STAND_ROWS; r++) {
    const offset = ((r + .5) / STAND_ROWS) * STAND_DEPTH
    let i = 0
    for (let a = from; a <= to; i++) {
      const n = r * 7919 + i
      const point = ringPoint(a, offset)
      a += 1 / Math.max(8, Math.hypot(point.x, point.z))
      if (hash(n) < .16) continue
      const p = project({ ...point, y: point.y + .45 })
      ctx.fillStyle = CROWD[Math.floor(hash(n + 5) * CROWD.length)]
      ctx.beginPath()
      ctx.arc(p.x, p.y, Math.max(1, p.k * .42), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // がいやの フェンスの きいろい ふち。
  const top = angles(Math.max(from, -FOUL_ANGLE), Math.min(to, FOUL_ANGLE)).map(a => project(ringPoint(a, 0)))
  ctx.strokeStyle = '#ffd43b'
  ctx.lineWidth = Math.max(1.5, top[Math.floor(top.length / 2)].k * .35)
  ctx.beginPath()
  top.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.stroke()
}

/** うえの おびと かさならないよう、けいじばんを かく いちばん うえ[px]。 */
const SCOREBOARD_TOP = 100

/** センターの うしろの でんこうけいじばん。ホームランの ときは ぴかぴか ひかる。 */
function drawScoreboard(ctx: CanvasRenderingContext2D, project: Projector, lit: boolean, time: number) {
  const d = wallDistance(0) + STAND_DEPTH + 3
  const a = project({ x: -14, y: 35, z: d }), b = project({ x: 14, y: 24, z: d })
  const w = b.x - a.x, h = b.y - a.y
  if (w < 8 || h < 4 || a.y < SCOREBOARD_TOP) return
  const legs = project({ x: 0, y: 20, z: d })
  ctx.fillStyle = '#4b5366'
  ctx.fillRect(a.x + w * .2, b.y, w * .08, legs.y - b.y)
  ctx.fillRect(a.x + w * .72, b.y, w * .08, legs.y - b.y)
  ctx.fillStyle = '#2d3142'
  ctx.beginPath()
  ctx.roundRect(a.x, a.y, w, h, Math.min(w, h) * .08)
  ctx.fill()
  ctx.fillStyle = '#121626'
  ctx.fillRect(a.x + w * .04, a.y + h * .12, w * .92, h * .76)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${h * .34}px ${FONT}`
  if (lit) {
    const hue = Math.floor(time * 6) % 2 ? '#ffd43b' : '#ff8787'
    ctx.fillStyle = hue
    ctx.fillText('ホームラン！', a.x + w / 2, a.y + h * .52)
  } else {
    ctx.fillStyle = '#ffe066'
    ctx.fillText('かっとばせ！', a.x + w / 2, a.y + h * .52)
  }
}

function drawLightTowers(ctx: CanvasRenderingContext2D, project: Projector, sky: Sky) {
  if (!sky.lights) return
  for (const side of [-1, 1]) {
    const a = side * 38 * DEG
    const base = project(ringPoint(a, STAND_DEPTH + 2, 10))
    const top = project(ringPoint(a, STAND_DEPTH + 2, 34))
    ctx.strokeStyle = '#5d6577'
    ctx.lineWidth = Math.max(2, base.k * .8)
    ctx.beginPath()
    ctx.moveTo(base.x, base.y)
    ctx.lineTo(top.x, top.y)
    ctx.stroke()
    const size = Math.max(6, top.k * 3.2)
    const glow = ctx.createRadialGradient(top.x, top.y, size * .3, top.x, top.y, size * 3.2)
    glow.addColorStop(0, 'rgba(255, 252, 220, .9)')
    glow.addColorStop(1, 'rgba(255, 252, 220, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(top.x - size * 3.2, top.y - size * 3.2, size * 6.4, size * 6.4)
    ctx.fillStyle = '#fffdf0'
    ctx.fillRect(top.x - size, top.y - size * .55, size * 2, size * 1.1)
  }
}

// ---- グラウンド ---------------------------------------------------------------

function groundPoly(project: Projector, points: [number, number][]) {
  return points.map(([x, z]) => project({ x, y: 0, z }))
}

function circlePoints(cx: number, cz: number, r: number, steps = 40): [number, number][] {
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2
    return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]
  })
}

function drawField(ctx: CanvasRenderingContext2D, project: Projector, sky: Sky) {
  // フェアゾーンの しま もよう。
  const fair: [number, number][] = [[0, 0]]
  for (let a = -FOUL_ANGLE; a <= FOUL_ANGLE + 1e-6; a += 1.5 * DEG) fair.push([Math.sin(a) * fenceDistance(a), Math.cos(a) * fenceDistance(a)])
  polygon(ctx, groundPoly(project, fair), sky.grass[0])
  ctx.save()
  ctx.beginPath()
  groundPoly(project, fair).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath()
  ctx.clip()
  for (let i = 0; i < 24; i += 2) {
    const z0 = i * 5, z1 = z0 + 5
    polygon(ctx, groundPoly(project, [[-130, z0], [130, z0], [130, z1], [-130, z1]]), sky.grass[1])
  }
  // フェンスの まえの ちゃいろい みち。
  const track: [number, number][] = []
  for (let a = -FOUL_ANGLE; a <= FOUL_ANGLE + 1e-6; a += 1.5 * DEG) track.push([Math.sin(a) * (fenceDistance(a) - 5), Math.cos(a) * (fenceDistance(a) - 5)])
  for (let a = FOUL_ANGLE; a >= -FOUL_ANGLE - 1e-6; a -= 1.5 * DEG) track.push([Math.sin(a) * (fenceDistance(a) + 2), Math.cos(a) * (fenceDistance(a) + 2)])
  polygon(ctx, groundPoly(project, track), sky.dirt)
  ctx.restore()
  // ないやの つち。
  const infield: [number, number][] = [[-3, -3]]
  for (let a = -78; a <= 78; a += 4) infield.push([Math.sin(a * DEG) * 29, 18.44 + Math.cos(a * DEG) * 29])
  infield.push([3, -3])
  polygon(ctx, groundPoly(project, infield), sky.dirt)
  polygon(ctx, groundPoly(project, [[0, 3.6], [17.2, 19.4], [0, 36], [-17.2, 19.4]]), sky.grass[0])
  polygon(ctx, groundPoly(project, circlePoints(0, 0, 4.2)), sky.dirt)
  polygon(ctx, groundPoly(project, circlePoints(0, 18.44, 2.8)), '#e0ae78')
  polygon(ctx, groundPoly(project, [[-.3, 18.3], [.3, 18.3], [.3, 18.5], [-.3, 18.5]]), '#ffffff')
  // ファウルライン。
  ctx.strokeStyle = 'rgba(255, 255, 255, .95)'
  for (const side of [-1, 1]) {
    const a = project({ x: side * 1, y: 0, z: 1 })
    const b = project({ x: side * 66, y: 0, z: 66 })
    ctx.lineWidth = Math.max(1.5, a.k * .1)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  // ベース。
  for (const [x, z] of [[19.4, 19.4], [0, 38.8], [-19.4, 19.4]]) {
    polygon(ctx, groundPoly(project, [[x - .4, z], [x, z + .4], [x + .4, z], [x, z - .4]]), '#ffffff')
  }
  // バッターボックス と ホームベース。
  ctx.strokeStyle = 'rgba(255, 255, 255, .9)'
  for (const side of [-1, 1]) {
    const box = groundPoly(project, [[side * .2, -.9], [side * 1.4, -.9], [side * 1.4, .9], [side * .2, .9]])
    ctx.lineWidth = Math.max(1.5, box[0].k * .05)
    ctx.beginPath()
    box.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    ctx.closePath()
    ctx.stroke()
  }
  polygon(ctx, groundPoly(project, [[-.22, .22], [.22, .22], [.22, 0], [0, -.22], [-.22, 0]]), '#ffffff')
}

// ---- がめん ぜんたい ---------------------------------------------------------

type Layer = { canvas: HTMLCanvasElement; key: string }
let pitchLayer: Layer | null = null
let flyLayer: Layer | null = null

function cachedLayer(cache: Layer | null, key: string, w: number, h: number, dpr: number, paint: (ctx: CanvasRenderingContext2D) => void): Layer | null {
  if (cache?.key === key) return cache
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * dpr))
  canvas.height = Math.max(1, Math.round(h * dpr))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  paint(ctx)
  return { canvas, key }
}

/** ピッチャーの がめんで みえる スタンドの むき。 */
const PITCH_VIEW_SPAN = 62 * DEG

function paintPitchBackground(ctx: CanvasRenderingContext2D, view: View, skyId: SkyId) {
  const sky = SKIES[skyId]
  const proj: Projector = p => project(view, p)
  drawSky(ctx, sky, view.w, view.horizon)
  ctx.fillStyle = sky.foul
  ctx.fillRect(0, view.horizon, view.w, view.h - view.horizon)
  drawLightTowers(ctx, proj, sky)
  drawStands(ctx, proj, sky, -PITCH_VIEW_SPAN, PITCH_VIEW_SPAN)
  drawField(ctx, proj, sky)
}

function paintFlyBackground(ctx: CanvasRenderingContext2D, view: FlyView, skyId: SkyId) {
  const sky = SKIES[skyId]
  const proj: Projector = p => projectFly(view, p)
  const horizon = projectFly(view, { x: 0, y: 0, z: 3000 }).y
  // きゅうじょうの そとは もりと そら。
  ctx.fillStyle = sky.trees[0]
  ctx.fillRect(0, 0, view.w, view.h)
  for (let i = 0; i < 160; i++) {
    const x = hash(i + 300) * view.w, y = horizon + hash(i + 600) * (view.h - horizon)
    const r = 8 + hash(i + 900) * 16
    ctx.fillStyle = sky.trees[1 + (i % 2)]
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  drawSky(ctx, sky, view.w, horizon)
  const all = angles(-Math.PI, Math.PI)
  polygon(ctx, all.map(a => proj(ringPoint(a, 0, 0))), sky.foul)
  drawField(ctx, proj, sky)
  drawLightTowers(ctx, proj, sky)
  drawStands(ctx, proj, sky, -Math.PI, Math.PI)
  // フェンスの きょりの かず。
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const a of [-FOUL_ANGLE + 3 * DEG, 0, FOUL_ANGLE - 3 * DEG]) {
    const d = fenceDistance(a) - 9
    const p = proj({ x: Math.sin(a) * d, y: 0, z: Math.cos(a) * d })
    ctx.font = `900 ${Math.max(10, p.k * 3.4)}px ${FONT}`
    ctx.fillStyle = 'rgba(255, 255, 255, .8)'
    ctx.fillText(`${Math.round(fenceDistance(a))}`, p.x, p.y)
  }
}

export type Scene = {
  view: View
  fly: FlyView
  dpr: number
  time: number
  derby: Derby
  fx: Fx
  reducedMotion: boolean
  /** はじめての ボールで「ここで うつ」を みせる。 */
  hint: boolean
}

/** いまは とんでいく がめんか。 */
export function showsFlight(derby: Derby): boolean {
  return derby.hit !== null && (derby.phase === 'flight' || derby.phase === 'result' || derby.phase === 'done')
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { view, fx, derby, dpr } = scene
  const sky = derby.stage.sky
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const shake = scene.reducedMotion ? 0 : fx.shake
  const sx = shake ? (rand() - .5) * shake : 0, sy = shake ? (rand() - .5) * shake : 0
  ctx.save()
  ctx.translate(sx, sy)
  if (showsFlight(derby)) {
    const key = `${view.w}x${view.h}@${dpr}:${sky}:${scene.fly.f.toFixed(3)}`
    flyLayer = cachedLayer(flyLayer, key, view.w, view.h, dpr, c => paintFlyBackground(c, scene.fly, sky))
    if (flyLayer) ctx.drawImage(flyLayer.canvas, 0, 0, view.w, view.h)
    else paintFlyBackground(ctx, scene.fly, sky)
    drawClouds(ctx, sky, view.w, projectFly(scene.fly, { x: 0, y: 0, z: 3000 }).y * .8, scene.time)
    drawScoreboard(ctx, p => projectFly(scene.fly, p), derby.hit?.outcome === 'homerun' && derby.phase !== 'flight', scene.time)
    drawFlight(ctx, scene)
  } else {
    const key = `${view.w}x${view.h}@${dpr}:${sky}`
    pitchLayer = cachedLayer(pitchLayer, key, view.w, view.h, dpr, c => paintPitchBackground(c, view, sky))
    if (pitchLayer) ctx.drawImage(pitchLayer.canvas, 0, 0, view.w, view.h)
    else paintPitchBackground(ctx, view, sky)
    drawClouds(ctx, sky, view.w, view.horizon * .62, scene.time)
    drawScoreboard(ctx, p => project(view, p), false, scene.time)
    drawPitch(ctx, scene)
  }
  drawParticles(ctx, fx)
  ctx.restore()
  if (fx.flash > 0) {
    ctx.globalAlpha = Math.min(1, fx.flash) * (scene.reducedMotion ? .4 : .8)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, view.w, view.h)
    ctx.globalAlpha = 1
  }
}

// ---- ピッチャーの がめん ------------------------------------------------------

/** なげる うでの うごき。 */
function pitcherPose(derby: Derby, time: number): PitcherPose {
  const idle = 1.95, raised = 4.05, thrown = 6.95
  const kind = pitchKind(derby)
  const holding = derby.phase === 'windup'
  let arm = idle, fire = 0
  if (derby.phase === 'windup') {
    const w = derby.t / windupTime(derby)
    const lift = Math.max(0, Math.min(1, (w - .45) / .55))
    arm = idle + (raised - idle) * (1 - (1 - lift) ** 2)
  } else if (derby.phase === 'pitch') {
    const t = derby.t
    if (t < .16) arm = raised + (thrown - raised) * (1 - (1 - t / .16) ** 2)
    else if (t < .6) arm = thrown + (idle + Math.PI * 2 - thrown) * ((t - .16) / .44)
    if (kind === 'fast' && derby.stage.pitcher === 'dragon') fire = Math.max(0, 1 - t / .5)
  }
  const stopped = derby.phase === 'pitch' && kind === 'stop' && pitchProgress(kind, derby.stage.travel, derby.t) === STOP_AT
  return { arm, holding, time, fire, stopped }
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
  ctx.fillStyle = '#fffdf6'
  ctx.strokeStyle = 'rgba(45, 42, 62, .55)'
  ctx.lineWidth = Math.max(1, r * .12)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  if (r < 3) return
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.strokeStyle = '#e0453a'
  ctx.lineWidth = Math.max(1, r * .16)
  const o = Math.sin(spin) * r * .5
  ctx.beginPath()
  ctx.arc(x - r * 1.25 + o, y, r * .95, -.7, .7)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + r * 1.25 + o, y, r * .95, Math.PI - .7, Math.PI + .7)
  ctx.stroke()
  ctx.restore()
  ctx.fillStyle = 'rgba(255, 255, 255, .9)'
  ctx.beginPath()
  ctx.arc(x - r * .35, y - r * .4, r * .25, 0, Math.PI * 2)
  ctx.fill()
}

function bubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, alpha: number, color = '#ff5b45') {
  ctx.globalAlpha = alpha
  ctx.font = `900 ${size}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const w = ctx.measureText(text).width + size * 1.1, h = size * 1.7
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = color
  ctx.fillText(text, x, y + 1)
  ctx.globalAlpha = 1
}

function drawPitch(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { view, derby, fx, time } = scene
  const kind = pitchKind(derby)
  const mound = project(view, MOUND)
  ctx.save()
  ctx.translate(mound.x, mound.y)
  ctx.scale(mound.k / 100, mound.k / 100)
  drawPitcher(ctx, derby.stage.pitcher, pitcherPose(derby, time))
  ctx.restore()

  // ここで うつ わ。
  const contact = project(view, CONTACT)
  const ringR = BALL_RADIUS * contact.k * 1.9
  const ready = derby.phase === 'windup' || derby.phase === 'pitch'
  if (ready) {
    ctx.save()
    ctx.setLineDash([6, 6])
    ctx.lineDashOffset = -time * 12
    ctx.strokeStyle = 'rgba(255, 255, 255, .75)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(contact.x, contact.y, ringR, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    if (scene.hint && derby.index === 0 && !derby.swing) {
      const pulse = 1 + Math.sin(time * 6) * .06
      bubble(ctx, 'ここで うつ！', contact.x + ringR * 2.6, contact.y - ringR * 1.4, Math.max(13, ringR * .5) * pulse, .92, '#2f7de1')
    }
  }

  // なげた ボール。
  if (derby.phase === 'pitch' || (derby.phase === 'result' && derby.results[derby.results.length - 1] === 'miss')) {
    const progress = derby.phase === 'pitch' ? pitchProgress(kind, derby.stage.travel, derby.t) : MITT_PROGRESS
    const point = pitchPoint(kind, shownProgress(progress))
    const p = project(view, point)
    const ground = project(view, { ...point, y: 0 })
    const r = Math.max(2.5, BALL_RADIUS * p.k)
    if (point.alpha > .02) {
      ctx.globalAlpha = .28 * point.alpha * Math.max(.2, 1 - point.y / 4)
      ctx.fillStyle = '#16301a'
      ctx.beginPath()
      ctx.ellipse(ground.x, ground.y, r * 1.2, r * .4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    if (kind === 'fast' && derby.phase === 'pitch') {
      const glow = ctx.createRadialGradient(p.x, p.y, r * .5, p.x, p.y - r, r * 3)
      glow.addColorStop(0, 'rgba(255, 200, 60, .9)')
      glow.addColorStop(1, 'rgba(255, 90, 40, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(p.x, p.y - r * .8, r * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    if (point.alpha < 1 && kind === 'ghost') {
      // きえている あいだも、ほんの すこしだけ きらきらが みえる。
      ctx.globalAlpha = .18 + Math.sin(time * 20) * .06
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    if (derby.phase === 'pitch' && progress > 1.02) drawMitt(ctx, view, Math.min(1, (progress - 1.02) / (MITT_PROGRESS - 1.02)))
    if (point.alpha > 0) {
      ctx.globalAlpha = point.alpha
      drawBall(ctx, p.x, p.y, r, time * 30)
      ctx.globalAlpha = 1
    }
    if (derby.phase === 'result') drawMitt(ctx, view, 1)
    if (kind === 'stop' && time - fx.pauseAt < 1) bubble(ctx, 'ピタッ！', p.x, p.y - r * 3.2, Math.max(13, r * 1.3), Math.min(1, 1.6 - (time - fx.pauseAt) * 1.6), '#e8590c')
  }

  // うった しゅんかん: ボールが そらへ とんでいく。
  if (derby.phase === 'impact' && derby.hit) {
    const t = derby.t
    const a = derby.hit.angle
    const speed = derby.hit.outcome === 'foul' ? 30 : 42
    const point = { x: CONTACT.x + Math.sin(a) * speed * t * 1.4, y: CONTACT.y + (derby.hit.peak * .9) * t, z: CONTACT.z + Math.cos(a) * speed * t }
    const p = project(view, point)
    drawBall(ctx, p.x, p.y, Math.max(2, BALL_RADIUS * p.k), time * 40)
  }

  // バッター。
  const feet = project(view, BATTER_FEET)
  const u = fx.swingAt === null ? null : (time - fx.swingAt) / SWING_TIME
  ctx.save()
  ctx.translate(feet.x, feet.y)
  ctx.scale(feet.k / 100, feet.k / 100)
  drawBatter(ctx, u === null ? null : Math.min(1, u), time)
  ctx.restore()

  // ボールの なまえ。
  const since = time - fx.labelAt
  if (derby.phase === 'pitch' && since < 1.1 && fx.label) {
    const head = project(view, { ...MOUND, y: 2.9 })
    bubble(ctx, fx.label, head.x, head.y - 6 - since * 8, Math.min(26, Math.max(14, view.w * .04)), Math.min(1, (1.1 - since) * 3))
  }
}

/** バットを すぎた ボールは ミットに むかって ゆっくりに みせる（がめんの したに はみださない）。 */
function shownProgress(progress: number) {
  return progress > 1 ? 1 + (Math.min(progress, MITT_PROGRESS) - 1) * .6 : progress
}

function drawMitt(ctx: CanvasRenderingContext2D, view: View, amount: number) {
  const p = project(view, pitchPoint('straight', shownProgress(MITT_PROGRESS)))
  const size = BALL_RADIUS * p.k * 2.6
  const y = p.y + (1 - amount) * size * 2
  ctx.save()
  ctx.translate(p.x, y + size * .2)
  ctx.fillStyle = '#b86b2c'
  ctx.strokeStyle = '#2d2a3e'
  ctx.lineWidth = Math.max(2, size * .08)
  ctx.beginPath()
  ctx.ellipse(0, 0, size, size * .9, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#7a4314'
  ctx.beginPath()
  ctx.ellipse(0, -size * .05, size * .55, size * .5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ---- とんでいく がめん --------------------------------------------------------

function drawFlight(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { fly, derby, fx, time } = scene
  const hit = derby.hit
  if (!hit) return
  const proj: Projector = p => projectFly(fly, p)

  const t = derby.phase === 'flight' ? derby.t : flightDuration(hit)
  const ball = flightPoint(hit, t)
  if (derby.phase === 'flight') {
    fx.trail.push(ball)
    if (fx.trail.length > 26) fx.trail.shift()
  }
  // あと。
  ctx.lineCap = 'round'
  fx.trail.forEach((p, i) => {
    if (i === 0) return
    const a = proj(fx.trail[i - 1]), b = proj(p)
    ctx.strokeStyle = `rgba(255, 255, 255, ${(i / fx.trail.length * .6).toFixed(3)})`
    ctx.lineWidth = Math.max(1.5, b.k * .6 * (i / fx.trail.length))
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  })
  const ground = proj({ ...ball, y: hit.outcome === 'homerun' && Math.hypot(ball.x, ball.z) > hit.fence ? standHeight(Math.hypot(ball.x, ball.z), hit.fence) : 0 })
  const p = proj(ball)
  const r = Math.max(5, p.k * 1.4)
  ctx.globalAlpha = .3
  ctx.fillStyle = '#16301a'
  ctx.beginPath()
  ctx.ellipse(ground.x, ground.y, r * 1.1, r * .45, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  if (derby.phase !== 'flight' && hit.outcome !== 'homerun') {
    ctx.strokeStyle = 'rgba(255, 255, 255, .85)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.ellipse(ground.x, ground.y, r * 2.6 + Math.sin(time * 6) * 2, r * 1.1, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  drawBall(ctx, p.x, p.y, r, time * 20)

  // とんだ きょり（スタンドに はいった ときに ちょうど とんだ きょりに なる）。
  const distance = Math.round(hit.distance * Math.min(1, t / flightDuration(hit)))
  if (distance > 3) {
    const size = Math.max(16, Math.min(30, fly.w * .055))
    ctx.font = `900 ${size}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.lineWidth = 5
    ctx.strokeStyle = '#2d2a3e'
    ctx.lineJoin = 'round'
    const label = `${distance}m`
    const lx = Math.max(size * 1.6, Math.min(fly.w - size * 1.6, p.x)), ly = Math.max(size * 3.4, p.y - r - 6)
    ctx.strokeText(label, lx, ly)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, lx, ly)
  }
}
