import Matter from 'matter-js'
import { BOX_SIZE, GROUND_Y, SLING, type BallKind, type Level, type Material } from './levels'

const { Bodies, Body, Composite, Engine, Events, Sleeping } = Matter

/** 1フレームを こまかく 分けて すすめ、はやい たまが 板を すりぬけないようにする。 */
const SUBSTEPS = 2
const STEP_MS = 1000 / 60 / SUBSTEPS
export const MAX_PULL = 120
export const MAX_SPEED = 24
/** これより みじかく ひっぱったら うたない（タップの まちがいを ふせぐ）。 */
export const MIN_PULL = 22
const BLAST_RADIUS = 230
/** うってから つぎの たままで まつ さいだいの フレーム数。 */
const TURN_LIMIT = 60 * 8
const QUIET_FRAMES = 45
const SLOW_BALL_FRAMES = 90

export const BALLS: Record<BallKind, { radius: number; density: number; restitution: number }> = {
  normal: { radius: 22, density: .004, restitution: .35 },
  heavy: { radius: 26, density: .012, restitution: .12 },
  split: { radius: 17, density: .004, restitution: .35 },
}

export const MATERIALS: Record<Material, { density: number; hp: number; friction: number; score: number }> = {
  wood: { density: .0012, hp: 10, friction: .7, score: 50 },
  ice: { density: .0009, hp: 4, friction: .25, score: 30 },
  stone: { density: .004, hp: 34, friction: .9, score: 80 },
}
const ROBOT_HP = 5
const BOX_HP = 2
export const ROBOT_SCORE = 500
export const BALL_BONUS = 1000

export type PieceKind = 'block' | 'robot' | 'box' | 'hill'
export type Tracked = {
  id: number
  kind: PieceKind
  material?: Material
  body: Matter.Body
  w: number
  h: number
  hp: number
  maxHp: number
}
export type Projectile = { id: number; kind: BallKind; body: Matter.Body; radius: number; canSplit: boolean }

/** 画面が 絵や 音に つかう できごと。物理の 中身は わたさない。 */
export type GameEvent =
  | { type: 'break'; x: number; y: number; material: Material | 'box'; score: number }
  | { type: 'robot'; x: number; y: number; score: number }
  | { type: 'hit'; x: number; y: number; strength: number; material: Material | 'robot' | 'ground' | 'ball' }
  | { type: 'blast'; x: number; y: number }
  | { type: 'launch' }
  | { type: 'split'; x: number; y: number }
  | { type: 'bonus'; score: number }

export type GameState = 'aim' | 'flying' | 'clear' | 'fail'

export type Point = { x: number; y: number }

/** ひっぱった ベクトルを 長さ MAX_PULL までに おさえる。 */
export function clampPull(pull: Point): Point {
  const length = Math.hypot(pull.x, pull.y)
  if (length <= MAX_PULL || length === 0) return pull
  return { x: pull.x * MAX_PULL / length, y: pull.y * MAX_PULL / length }
}

/** ゴムを ひっぱった ぶんだけ、はんたいむきに とばす。 */
export function launchVelocity(pull: Point): Point {
  const p = clampPull(pull)
  const k = MAX_SPEED / MAX_PULL
  return { x: -p.x * k, y: -p.y * k }
}

function stepEngine(engine: Matter.Engine) {
  for (let i = 0; i < SUBSTEPS; i++) Engine.update(engine, STEP_MS)
}

/**
 * とばした ときの みちすじ。本物と おなじ エンジン・おなじ きざみで たまだけを うごかすので、
 * 何かに ぶつかるまでは 実際の 動きと ぴったり かさなる。
 */
export function predictPath(pull: Point, kind: BallKind, frames = 42, every = 3): Point[] {
  const engine = Engine.create()
  const spec = BALLS[kind]
  const start = clampPull(pull)
  const ball = Bodies.circle(SLING.x + start.x, SLING.y + start.y, spec.radius, { density: spec.density, frictionAir: 0 })
  Composite.add(engine.world, ball)
  Body.setVelocity(ball, launchVelocity(pull))
  const points: Point[] = []
  for (let i = 1; i <= frames; i++) {
    stepEngine(engine)
    if (i % every === 0) points.push({ x: ball.position.x, y: ball.position.y })
    if (ball.position.y > GROUND_Y) break
  }
  Engine.clear(engine)
  return points
}

export function createGame(level: Level) {
  const engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 })
  const pieces: Tracked[] = []
  const projectiles: Projectile[] = []
  const events: GameEvent[] = []
  const queue = [...level.balls]
  let nextId = 1
  let state: GameState = 'aim'
  let score = 0
  let turnFrames = 0
  let quietFrames = 0
  let clearDelay = 0
  let shots = 0
  /** まえの たまの とおった あと。ねらいの 目じるしに なる。 */
  let trail: Point[] = []
  let currentTrail: Point[] = []

  const ground = Bodies.rectangle(level.width / 2, GROUND_Y + 100, level.width * 3, 200, { isStatic: true, friction: .9, label: 'ground' })
  Composite.add(engine.world, ground)

  for (const piece of level.pieces) {
    if (piece.type === 'hill') {
      const body = Bodies.rectangle(piece.x, piece.y, piece.w, piece.h, { isStatic: true, friction: .9, chamfer: { radius: [26, 26, 0, 0] }, label: 'ground' })
      pieces.push({ id: nextId++, kind: 'hill', body, w: piece.w, h: piece.h, hp: Infinity, maxHp: Infinity })
    } else if (piece.type === 'block') {
      const m = MATERIALS[piece.material]
      const body = Bodies.rectangle(piece.x, piece.y, piece.w, piece.h, { density: m.density, friction: m.friction, frictionStatic: 1, restitution: .05, angle: piece.angle ?? 0, chamfer: { radius: 2 } })
      pieces.push({ id: nextId++, kind: 'block', material: piece.material, body, w: piece.w, h: piece.h, hp: m.hp, maxHp: m.hp })
    } else if (piece.type === 'robot') {
      const body = Bodies.rectangle(piece.x, piece.y, piece.size, piece.size, { density: .0012, friction: .8, frictionStatic: 1, restitution: .1, chamfer: { radius: piece.size * .28 } })
      pieces.push({ id: nextId++, kind: 'robot', body, w: piece.size, h: piece.size, hp: ROBOT_HP, maxHp: ROBOT_HP })
    } else {
      const body = Bodies.rectangle(piece.x, piece.y, BOX_SIZE, BOX_SIZE, { density: .001, friction: .8, frictionStatic: 1, restitution: .05, chamfer: { radius: 4 } })
      pieces.push({ id: nextId++, kind: 'box', body, w: BOX_SIZE, h: BOX_SIZE, hp: BOX_HP, maxHp: BOX_HP })
    }
  }
  const byBody = new Map<number, Tracked>(pieces.map(p => [p.body.id, p]))
  const projectileByBody = new Map<number, Projectile>()
  Composite.add(engine.world, pieces.map(p => p.body))
  // つみきは ねむった まま はじめる。何かが ぶつかるまで ぴくりとも しない。
  for (const p of pieces) if (!p.body.isStatic) Sleeping.set(p.body, true)

  const pending = new Set<Tracked>()
  const pendingBlasts: Tracked[] = []

  function damage(target: Tracked, amount: number) {
    if (!Number.isFinite(target.hp) || target.hp <= 0) return
    target.hp -= amount
    if (target.hp <= 0) pending.add(target)
  }

  function massOf(body: Matter.Body) {
    return body.isStatic ? 6 : Math.min(body.mass, 12)
  }

  Events.on(engine, 'collisionStart', event => {
    for (const pair of event.pairs) {
      const a = pair.bodyA.parent, b = pair.bodyB.parent
      const va = a.isStatic || a.isSleeping ? { x: 0, y: 0 } : Body.getVelocity(a)
      const vb = b.isStatic || b.isSleeping ? { x: 0, y: 0 } : Body.getVelocity(b)
      const n = pair.collision.normal
      const speed = Math.abs((va.x - vb.x) * n.x + (va.y - vb.y) * n.y)
      if (speed < 1.4) continue
      const ta = byBody.get(a.id), tb = byBody.get(b.id)
      // うける いたさは ぶつかった はやさと あいての おもさで きまる。
      if (ta) damage(ta, speed * Math.sqrt(massOf(b)) * .5)
      if (tb) damage(tb, speed * Math.sqrt(massOf(a)) * .5)
      if (speed > 3.5) {
        const hit = pair.collision.supports[0] ?? a.position
        const target = [tb, ta].find(t => t?.kind === 'robot' || t?.material)
        const material = target?.kind === 'robot' ? 'robot' : target?.material ?? (projectileByBody.has(a.id) || projectileByBody.has(b.id) ? 'ball' : 'ground')
        events.push({ type: 'hit', x: hit.x, y: hit.y, strength: Math.min(1, speed / 16), material })
      }
    }
  })

  function remove(target: Tracked) {
    const index = pieces.indexOf(target)
    if (index < 0) return
    pieces.splice(index, 1)
    byBody.delete(target.body.id)
    Composite.remove(engine.world, target.body)
    const { x, y } = target.body.position
    // ねむっている つみきは 下の 板が きえても おきないので、まわりを おこして おとす。
    const reach = Math.max(target.w, target.h) / 2 + 90
    for (const other of pieces) {
      if (other.body.isSleeping && Math.hypot(other.body.position.x - x, other.body.position.y - y) < reach + Math.max(other.w, other.h) / 2) Sleeping.set(other.body, false)
    }
    if (target.kind === 'robot') {
      score += ROBOT_SCORE
      events.push({ type: 'robot', x, y, score: ROBOT_SCORE })
    } else if (target.kind === 'box') {
      events.push({ type: 'break', x, y, material: 'box', score: 100 })
      score += 100
      pendingBlasts.push(target)
    } else if (target.material) {
      const s = MATERIALS[target.material].score
      score += s
      events.push({ type: 'break', x, y, material: target.material, score: s })
    }
  }

  function blast(origin: Point) {
    events.push({ type: 'blast', x: origin.x, y: origin.y })
    const bodies = [...pieces.map(p => p.body), ...projectiles.map(p => p.body)]
    for (const body of bodies) {
      if (body.isStatic) continue
      const dx = body.position.x - origin.x, dy = body.position.y - origin.y
      const d = Math.hypot(dx, dy)
      if (d > BLAST_RADIUS || d === 0) continue
      const power = 1 - d / BLAST_RADIUS
      Sleeping.set(body, false)
      const v = Body.getVelocity(body)
      Body.setVelocity(body, { x: v.x + dx / d * 16 * power, y: v.y + (dy / d - .6) * 16 * power })
      Body.setAngularVelocity(body, (dx > 0 ? .12 : -.12) * power)
      const tracked = byBody.get(body.id)
      if (tracked) damage(tracked, 14 * power)
    }
  }

  function outOfWorld(body: Matter.Body) {
    return body.position.x < -200 || body.position.x > level.width + 150 || body.position.y > GROUND_Y + 300 || !Number.isFinite(body.position.x) || !Number.isFinite(body.position.y)
  }

  function addProjectile(kind: BallKind, at: Point, velocity: Point, canSplit: boolean) {
    const spec = BALLS[kind]
    // たま どうしは ぶつからない（わかれた たまが かさなって はじきあわない）。
    const body = Bodies.circle(at.x, at.y, spec.radius, { density: spec.density, restitution: spec.restitution, friction: .6, frictionAir: 0, collisionFilter: { group: -1 } })
    Composite.add(engine.world, body)
    Body.setVelocity(body, velocity)
    const projectile: Projectile = { id: nextId++, kind, body, radius: spec.radius, canSplit }
    projectiles.push(projectile)
    projectileByBody.set(body.id, projectile)
    return projectile
  }

  function clearProjectiles() {
    for (const p of projectiles) Composite.remove(engine.world, p.body)
    projectiles.length = 0
    projectileByBody.clear()
  }

  function robotsLeft() {
    return pieces.filter(p => p.kind === 'robot').length
  }

  function endTurn() {
    clearProjectiles()
    trail = currentTrail
    currentTrail = []
    if (robotsLeft() === 0) return finishClear()
    state = queue.length ? 'aim' : 'fail'
  }

  function finishClear() {
    state = 'clear'
    const bonus = queue.length * BALL_BONUS
    if (bonus) { score += bonus; events.push({ type: 'bonus', score: bonus }) }
  }

  return {
    level,
    pieces,
    projectiles,
    get state() { return state },
    get score() { return score },
    get shots() { return shots },
    get trail() { return trail },
    get currentTrail() { return currentTrail },
    /** まだ うっていない たま（さいしょの ものが パチンコに のっている）。 */
    get queue(): readonly BallKind[] { return queue },
    get robotsLeft() { return robotsLeft() },
    /** うてたら true。みじかすぎる ひっぱりは うたずに false を かえす。 */
    launch(pull: Point) {
      if (state !== 'aim' || !queue.length) return false
      if (Math.hypot(pull.x, pull.y) < MIN_PULL) return false
      const kind = queue.shift()!
      const p = clampPull(pull)
      addProjectile(kind, { x: SLING.x + p.x, y: SLING.y + p.y }, launchVelocity(pull), kind === 'split')
      state = 'flying'
      turnFrames = quietFrames = 0
      currentTrail = []
      shots++
      events.push({ type: 'launch' })
      return true
    },
    /** とんでいる あおい たまを 3つに わける。 */
    split() {
      const source = projectiles.find(p => p.canSplit)
      if (state !== 'flying' || !source) return false
      source.canSplit = false
      const v = Body.getVelocity(source.body)
      const at = source.body.position
      for (const turn of [-.2, .2]) {
        const c = Math.cos(turn), s = Math.sin(turn)
        addProjectile('split', { x: at.x, y: at.y }, { x: v.x * c - v.y * s, y: v.x * s + v.y * c }, false)
      }
      events.push({ type: 'split', x: at.x, y: at.y })
      return true
    },
    get canSplit() { return state === 'flying' && projectiles.some(p => p.canSplit) },
    step() {
      stepEngine(engine)
      for (const target of [...pending]) remove(target)
      pending.clear()
      for (const box of pendingBlasts.splice(0)) blast(box.body.position)
      for (const target of [...pieces]) if (!target.body.isStatic && outOfWorld(target.body)) remove(target)
      for (const p of [...projectiles]) {
        if (outOfWorld(p.body)) {
          Composite.remove(engine.world, p.body)
          projectiles.splice(projectiles.indexOf(p), 1)
          projectileByBody.delete(p.body.id)
        }
      }
      // クリアの あとも 物理は うごかし、くずれる ようすを 見せる。
      if (state === 'clear') return
      // ゆっくり くずれた つみきで さいごの ロボットが たおれたら、うたなくても クリア。
      // たまぎれの あとで たおれても クリアに する。
      if ((state === 'aim' || state === 'fail') && robotsLeft() === 0) { finishClear(); return }
      if (state !== 'flying') return
      turnFrames++
      const lead = projectiles[0]
      if (lead && turnFrames % 2 === 0 && currentTrail.length < 240) currentTrail.push({ x: lead.body.position.x, y: lead.body.position.y })
      if (robotsLeft() === 0) {
        // さいごの ロボットが いなくなったら すこし まってから おいわい。
        if (++clearDelay > 50) { clearDelay = 0; endTurn() }
        return
      }
      // 地面を ころころ ころがる だけの たまは、しばらく したら とまったと みなす。
      const rolling = turnFrames > SLOW_BALL_FRAMES ? 1 : .25
      const moving = pieces.some(p => !p.body.isStatic && !p.body.isSleeping && p.body.speed > .25) || projectiles.some(p => p.body.speed > rolling)
      quietFrames = moving ? 0 : quietFrames + 1
      if ((turnFrames > 40 && quietFrames > QUIET_FRAMES) || turnFrames > TURN_LIMIT) endTurn()
    },
    /** たまった できごとを とりだす（とりだすと からっぽに なる）。 */
    drainEvents() { return events.splice(0) },
    destroy() {
      Events.off(engine, 'collisionStart')
      Composite.clear(engine.world, false)
      Engine.clear(engine)
    },
  }
}

export type Game = ReturnType<typeof createGame>
