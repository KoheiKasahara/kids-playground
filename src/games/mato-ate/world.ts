import { BALL_RADIUS, BALL_SPEED, CANNON, TARGET_HP, TARGET_RADIUS, TARGET_SCORE, WORLD, type Blink, type Level, type Motion, type TargetKind, type WallDef } from './levels'

// ゲームの すすみかた（たまの いどう・あたりはんてい・スコア）だけを 持つ。
// 画面や canvas には さわらないので、テストで そのまま うごかせる。

export type Point = { x: number; y: number }
export type GameState = 'play' | 'clear' | 'fail'

export type Ball = { id: number; x: number; y: number; vx: number; vy: number; age: number; bounces: number; trail: Point[] }
export type Target = { index: number; kind: TargetKind; r: number; hp: number; x: number; y: number; alive: boolean }
export type Wall = { index: number; def: WallDef; x: number; y: number; active: boolean }

export type GameEvent =
  | { type: 'fire'; x: number; y: number; angle: number }
  | { type: 'hit'; x: number; y: number; target: number; kind: TargetKind; broken: boolean; score: number; combo: number; vx: number; vy: number }
  | { type: 'block'; x: number; y: number; wall: number }
  | { type: 'bounce'; x: number; y: number; wall: number }
  | { type: 'miss'; x: number; y: number }
  | { type: 'vanish'; x: number; y: number }

export type Game = {
  readonly level: Level
  readonly time: number
  readonly state: GameState
  readonly balls: readonly Ball[]
  readonly targets: readonly Target[]
  readonly walls: readonly Wall[]
  readonly ammo: number
  readonly shots: number
  readonly misses: number
  /** まとに あたった たまの かず。 */
  readonly hits: number
  readonly score: number
  readonly combo: number
  /** のこっている クリアに ひつような まとの かず。 */
  readonly targetsLeft: number
  canFire(): boolean
  fire(angle: number): boolean
  step(): void
  drainEvents(): GameEvent[]
}

export const STEP = 1 / 60
const SUBSTEPS = 3
/** つぎの たまを うてるまでの びょう。れんしゃ しすぎない ていど。 */
export const RELOAD = .3
/** これより ながく とんだ たまは はずれ あつかい。 */
const MAX_AGE = 5
/** まっすぐ よこより すこし 上まで ねらえる。 */
export const MAX_ANGLE = 1.3
const TRAIL = 12

const TAU = Math.PI * 2
const frac = (n: number) => n - Math.floor(n)

export function motionOffset(motion: Motion | undefined, time: number): Point {
  if (!motion) return { x: 0, y: 0 }
  const u = time / motion.period + (motion.phase ?? 0)
  if (motion.kind === 'line') {
    const s = Math.sin(u * TAU)
    return { x: motion.dx * s, y: motion.dy * s }
  }
  const a = u * TAU * (motion.reverse ? -1 : 1)
  return { x: Math.cos(a) * motion.radius, y: Math.sin(a) * motion.radius }
}

/** きえる かべが いま あるか。 */
export function blinkActive(blink: Blink | undefined, time: number): boolean {
  if (!blink) return true
  return frac(time / blink.period + (blink.phase ?? 0)) < blink.on
}

/** きえる かべの こさ（0〜1）。あらわれる すこし前から チカチカして しらせる。 */
export function blinkAlpha(blink: Blink | undefined, time: number): number {
  if (!blink) return 1
  const u = frac(time / blink.period + (blink.phase ?? 0)) * blink.period
  const on = blink.on * blink.period
  const fade = .18
  if (u < on) return u > on - fade ? .35 + .65 * (on - u) / fade : 1
  const until = blink.period - u
  // あらわれる .6びょう前から うすく てんめつする。
  return until < .6 ? .12 + .22 * (Math.sin(until * 40) * .5 + .5) : 0
}

export const clampAngle = (angle: number) => Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, angle))

/** たいほうから みた その ばしょの かくど（まうえが 0、みぎが プラス）。 */
export function angleTo(point: Point): number {
  return clampAngle(Math.atan2(point.x - CANNON.x, Math.max(1, CANNON.y - point.y)))
}

export function muzzle(angle: number): Point {
  return { x: CANNON.x + Math.sin(angle) * CANNON.barrel, y: CANNON.y - Math.cos(angle) * CANNON.barrel }
}

/** たまと かべの かさなり。かさなって いれば おしだす むき（たんいベクトル）と ばしょを かえす。 */
export function wallContact(wall: Wall, x: number, y: number, radius = BALL_RADIUS): { nx: number; ny: number; px: number; py: number } | null {
  const def = wall.def
  if (def.r !== undefined) {
    const dx = x - wall.x, dy = y - wall.y
    const dist = Math.hypot(dx, dy)
    if (dist >= def.r + radius) return null
    const nx = dist ? dx / dist : 0, ny = dist ? dy / dist : 1
    return { nx, ny, px: wall.x + nx * (def.r + radius + .5), py: wall.y + ny * (def.r + radius + .5) }
  }
  const hw = (def.w ?? 0) / 2, hh = (def.h ?? 0) / 2
  const cx = Math.max(wall.x - hw, Math.min(wall.x + hw, x))
  const cy = Math.max(wall.y - hh, Math.min(wall.y + hh, y))
  const dx = x - cx, dy = y - cy
  const dist = Math.hypot(dx, dy)
  if (dist >= radius) return null
  if (dist > 0) {
    const nx = dx / dist, ny = dy / dist
    return { nx, ny, px: cx + nx * (radius + .5), py: cy + ny * (radius + .5) }
  }
  // まんなかが かべの 中に はいった ときは、ちかい ほうの へんから おしだす。
  const ox = hw + radius - Math.abs(x - wall.x), oy = hh + radius - Math.abs(y - wall.y)
  if (ox < oy) {
    const nx = Math.sign(x - wall.x) || 1
    return { nx, ny: 0, px: wall.x + nx * (hw + radius + .5), py: y }
  }
  const ny = Math.sign(y - wall.y) || 1
  return { nx: 0, ny, px: x, py: wall.y + ny * (hh + radius + .5) }
}

type Options = { time?: number; hp?: readonly number[]; ammo?: number }

export function createGame(level: Level, options: Options = {}): Game {
  let time = options.time ?? 0
  let state: GameState = 'play'
  let ammo = options.ammo ?? level.balls
  let shots = 0, misses = 0, hits = 0, score = 0, combo = 0, cooldown = 0, nextId = 1
  let balls: Ball[] = []
  let events: GameEvent[] = []
  const targets: Target[] = level.targets.map((def, index) => {
    const kind = def.kind ?? 'normal'
    const hp = options.hp?.[index] ?? TARGET_HP[kind]
    return { index, kind, r: def.r ?? TARGET_RADIUS[kind], hp, x: def.x, y: def.y, alive: hp > 0 }
  })
  const walls: Wall[] = level.walls.map((def, index) => ({ index, def, x: def.x, y: def.y, active: true }))

  const required = () => targets.reduce((n, t) => n + (t.alive && t.kind !== 'gold' ? 1 : 0), 0)

  function place() {
    targets.forEach((t, i) => {
      const def = level.targets[i]
      const o = motionOffset(def.motion, time)
      t.x = def.x + o.x
      t.y = def.y + o.y
    })
    for (const w of walls) {
      const o = motionOffset(w.def.motion, time)
      w.x = w.def.x + o.x
      w.y = w.def.y + o.y
      w.active = blinkActive(w.def.blink, time)
    }
  }
  place()

  function miss(ball: Ball) {
    misses++
    combo = 0
    events.push({ type: 'miss', x: ball.x, y: ball.y })
  }

  /** たまを すこし すすめる。きえた ときは false。 */
  function advance(ball: Ball, dt: number): boolean {
    ball.x += ball.vx * dt
    ball.y += ball.vy * dt
    for (const w of walls) {
      if (!w.active) continue
      const hit = wallContact(w, ball.x, ball.y)
      if (!hit) continue
      if (w.def.kind !== 'bouncy') {
        events.push({ type: 'block', x: hit.px - hit.nx * BALL_RADIUS, y: hit.py - hit.ny * BALL_RADIUS, wall: w.index })
        misses++
        combo = 0
        return false
      }
      const dot = ball.vx * hit.nx + ball.vy * hit.ny
      if (dot < 0) {
        ball.vx -= 2 * dot * hit.nx
        ball.vy -= 2 * dot * hit.ny
        ball.bounces++
        events.push({ type: 'bounce', x: hit.px - hit.nx * BALL_RADIUS, y: hit.py - hit.ny * BALL_RADIUS, wall: w.index })
      }
      ball.x = hit.px
      ball.y = hit.py
    }
    for (const t of targets) {
      if (!t.alive || Math.hypot(ball.x - t.x, ball.y - t.y) >= t.r + BALL_RADIUS) continue
      t.hp--
      combo++
      hits++
      const broken = t.hp <= 0
      const gained = broken ? TARGET_SCORE[t.kind] + 50 * (Math.min(combo, 5) - 1) : 50
      score += gained
      if (broken) t.alive = false
      events.push({ type: 'hit', x: t.x, y: t.y, target: t.index, kind: t.kind, broken, score: gained, combo, vx: ball.vx, vy: ball.vy })
      return false
    }
    const out = ball.y < -BALL_RADIUS * 3 || ball.x < -BALL_RADIUS * 3 || ball.x > WORLD.width + BALL_RADIUS * 3 || ball.y > WORLD.height + BALL_RADIUS * 3
    if (out || ball.age > MAX_AGE) { miss(ball); return false }
    return true
  }

  return {
    level,
    get time() { return time },
    get state() { return state },
    get balls() { return balls },
    targets,
    walls,
    get ammo() { return ammo },
    get shots() { return shots },
    get misses() { return misses },
    get hits() { return hits },
    get score() { return score },
    get combo() { return combo },
    get targetsLeft() { return required() },
    canFire: () => state === 'play' && ammo > 0 && cooldown <= 1e-6,
    fire(angle) {
      if (state !== 'play' || ammo <= 0 || cooldown > 1e-6) return false
      const a = clampAngle(angle)
      const start = muzzle(a)
      balls.push({ id: nextId++, x: start.x, y: start.y, vx: Math.sin(a) * BALL_SPEED, vy: -Math.cos(a) * BALL_SPEED, age: 0, bounces: 0, trail: [] })
      ammo--
      shots++
      cooldown = RELOAD
      events.push({ type: 'fire', x: start.x, y: start.y, angle: a })
      return true
    },
    step() {
      time += STEP
      cooldown = Math.max(0, cooldown - STEP)
      place()
      if (state !== 'play') return
      balls = balls.filter(ball => {
        ball.age += STEP
        ball.trail.push({ x: ball.x, y: ball.y })
        if (ball.trail.length > TRAIL) ball.trail.shift()
        for (let i = 0; i < SUBSTEPS; i++) if (!advance(ball, STEP / SUBSTEPS)) return false
        return true
      })
      if (required() === 0) {
        state = 'clear'
        for (const ball of balls) events.push({ type: 'vanish', x: ball.x, y: ball.y })
        balls = []
      } else if (ammo === 0 && balls.length === 0) state = 'fail'
    },
    drainEvents() {
      const out = events
      events = []
      return out
    },
  }
}

/**
 * いまの じょうたいから その かくどで うったら どの まとに あたるかを しらべる（あたらなければ null）。
 * うごく まと・かべも 時間ごとに すすめて ためすので、テストで「クリアできる ステージか」を たしかめられる。
 */
export function simulateShot(game: Game, angle: number): number | null {
  const probe = createGame(game.level, { time: game.time, hp: game.targets.map(t => (t.alive ? t.hp : 0)), ammo: 1 })
  probe.fire(angle)
  for (let i = 0; i < MAX_AGE / STEP + 2; i++) {
    probe.step()
    for (const event of probe.drainEvents()) {
      if (event.type === 'hit') return event.target
      if (event.type === 'miss' || event.type === 'block') return null
    }
    if (probe.state === 'clear') return null
  }
  return null
}
