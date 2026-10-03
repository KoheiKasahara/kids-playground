import Matter from 'matter-js'
import { BALLOON_R, balloonAt, BOX_SIZE, FAN_H, fanZone, GROUND_Y, PORTAL_R, SLING, SPRING_H, type BallKind, type Bounds, type Level, type Material, type Piece, type Point, type RobotKind } from './levels'

export type { Point } from './levels'

const { Bodies, Body, Composite, Constraint, Engine, Events, Sleeping } = Matter

/** 1フレームを こまかく 分けて すすめ、はやい たまが 板を すりぬけないようにする。 */
const SUBSTEPS = 2
const STEP_MS = 1000 / 60 / SUBSTEPS
export const MAX_PULL = 120
export const MAX_SPEED = 24
/** これより みじかく ひっぱったら うたない（タップの まちがいを ふせぐ）。 */
export const MIN_PULL = 22
/** うってから つぎの たままで まつ さいだいの フレーム数。 */
const TURN_LIMIT = 60 * 8
const QUIET_FRAMES = 45
const SLOW_BALL_FRAMES = 90
/** あおい たまは とびだして すぐには わかれない（パチンコの すぐ そばで わかれない）。 */
const AUTO_SPLIT_MIN_FRAMES = 12
/** やまなりに ならない まっすぐな うちかたでも、この フレームで かならず わかれる。 */
const AUTO_SPLIT_MAX_FRAMES = 36
/** トランポリンが はねかえす はやさと むき（すこし まえへ たおす）、よこむきの はやさを のこす わりあい。 */
const SPRING_SPEED = 16
const SPRING_TILT = .2
const SPRING_KEEP = .5
/** おなじ ものを 1ターンに トランポリンで はねかえす さいだいの かいすう（ずっと はねつづけない）。 */
const SPRING_LIMIT = 2
/** かぜは たまを この はやさで ななめ うえへ はこぶ。grip は 1こまで どれだけ その はやさに ちかづくか。 */
const WIND = { x: 3, y: -9, grip: .1 }
/** ドリルが ものを つきぬける たびに おそくなる わりあいと、つきぬけられる さいていの はやさ。 */
const DRILL_DRAG = .9
const DRILL_MIN_SPEED = 5
/** ぽよんの たまが よく はねる かいすうと、1かい はねて のこす はやさの わりあい。 */
const BOUNCY_HITS = 6
const BOUNCY_KEEP = .9

export const BALLS: Record<BallKind, { radius: number; density: number; restitution: number }> = {
  normal: { radius: 22, density: .004, restitution: .35 },
  heavy: { radius: 26, density: .012, restitution: .12 },
  split: { radius: 17, density: .004, restitution: .35 },
  bomb: { radius: 21, density: .005, restitution: .2 },
  drill: { radius: 18, density: .006, restitution: .2 },
  bouncy: { radius: 20, density: .003, restitution: .86 },
}

export const MATERIALS: Record<Material, { density: number; hp: number; friction: number; score: number }> = {
  wood: { density: .0012, hp: 10, friction: .7, score: 50 },
  ice: { density: .0009, hp: 4, friction: .25, score: 30 },
  stone: { density: .004, hp: 34, friction: .9, score: 80 },
}

export const ROBOTS: Record<RobotKind, { hp: number; score: number }> = {
  normal: { hp: 5, score: 500 },
  helmet: { hp: 16, score: 800 },
  boss: { hp: 40, score: 2000 },
}
/** ヘルメットロボの のこりの げんきが これより へると ヘルメットが とれる。 */
const HELMET_HP = 8
const BOX_HP = 2
const POP_SCORE = 30
export const ROBOT_SCORE = ROBOTS.normal.score
export const BALL_BONUS = 1000

/** びっくりばこと ばくだんの ばくはつ。ばくだんは いしも こわせる。 */
const BLASTS = {
  box: { radius: 230, push: 16, damage: 14 },
  bomb: { radius: 210, push: 18, damage: 60 },
} as const

export type PieceKind = 'block' | 'robot' | 'box' | 'hill' | 'steel' | 'mover' | 'spring' | 'fan' | 'balloon'
export type Tracked = {
  id: number
  kind: PieceKind
  material?: Material
  robot?: RobotKind
  /** ヘルメットを かぶっている あいだ true。 */
  helmet?: boolean
  body: Matter.Body
  w: number
  h: number
  hp: number
  maxHp: number
  /** ふうせん: つりさげている もの と ひも。 */
  carry?: Tracked
  rope?: Matter.Constraint
  /** つりさげられている もの: その ふうせん。 */
  balloon?: Tracked
  /** うごく かべ: まんなかと うごく はば。 */
  motion?: { x: number; y: number; dx: number; dy: number; period: number }
  /** トランポリンが はねた あとの のこり フレーム（えの ゆれに つかう）。 */
  pulse: number
}
export type Projectile = { id: number; kind: BallKind; body: Matter.Body; radius: number; canSplit: boolean; hits: number }
export type Portal = { from: Point; to: Point }

/** 画面が 絵や 音に つかう できごと。物理の 中身は わたさない。 */
export type GameEvent =
  | { type: 'break'; x: number; y: number; material: Material | 'box'; score: number }
  | { type: 'robot'; x: number; y: number; score: number; kind: RobotKind }
  | { type: 'hit'; x: number; y: number; strength: number; material: Material | 'robot' | 'ground' | 'ball' | 'steel' | 'bouncy' }
  | { type: 'blast'; x: number; y: number; source: keyof typeof BLASTS }
  | { type: 'launch' }
  | { type: 'split'; x: number; y: number }
  | { type: 'bonus'; score: number }
  | { type: 'pop'; x: number; y: number; score: number }
  | { type: 'helmet'; x: number; y: number }
  | { type: 'spring'; x: number; y: number }
  | { type: 'warp'; from: Point; to: Point }
  | { type: 'pierce'; x: number; y: number }

export type GameState = 'aim' | 'flying' | 'clear' | 'fail'

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

/** 型定義には ないが、matter-js の setPosition は 3つめの ひきすうで はやさも かえられる。 */
const moveStatic = Body.setPosition as (body: Matter.Body, position: Matter.Vector, updateVelocity?: boolean) => void

function inside(p: Point, z: Bounds) {
  return p.x > z.l && p.x < z.r && p.y > z.t && p.y < z.b
}

/** かぜの なかに いる たまを かぜに のせて うえへ はこぶ。 */
function blow(body: Matter.Body, fans: readonly Bounds[]) {
  if (!fans.some(z => inside(body.position, z))) return
  const v = Body.getVelocity(body)
  Body.setVelocity(body, { x: v.x + (WIND.x - v.x) * WIND.grip, y: v.y + (WIND.y - v.y) * WIND.grip })
}

/** ワープの わに はいった たまの でぐち。 */
function warpExit(at: Point, portals: readonly Portal[]) {
  return portals.find(p => Math.hypot(at.x - p.from.x, at.y - p.from.y) < PORTAL_R)
}

function levelPortals(level: Level): Portal[] {
  return level.pieces.flatMap(p => p.type === 'portal' ? [{ from: { x: p.x, y: p.y }, to: p.to }] : [])
}

function levelFans(level: Level): Bounds[] {
  return level.pieces.flatMap(p => p.type === 'fan' ? [fanZone(p)] : [])
}

/**
 * とばした ときの みちすじ。本物と おなじ エンジン・おなじ きざみで たまだけを うごかすので、
 * 何かに ぶつかるまでは 実際の 動きと ぴったり かさなる（かぜと ワープも おなじように うける）。
 */
export function predictPath(pull: Point, kind: BallKind, frames = 42, every = 3, level?: Level): Point[] {
  const engine = Engine.create()
  const spec = BALLS[kind]
  const start = clampPull(pull)
  const ball = Bodies.circle(SLING.x + start.x, SLING.y + start.y, spec.radius, { density: spec.density, frictionAir: 0 })
  Composite.add(engine.world, ball)
  Body.setVelocity(ball, launchVelocity(pull))
  const fans = level ? levelFans(level) : []
  const portals = level ? levelPortals(level) : []
  const points: Point[] = []
  for (let i = 1; i <= frames; i++) {
    for (let s = 0; s < SUBSTEPS; s++) {
      blow(ball, fans)
      Engine.update(engine, STEP_MS)
      const portal = warpExit(ball.position, portals)
      if (portal) Body.setPosition(ball, portal.to)
    }
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
  const portals = levelPortals(level)
  const fans = levelFans(level)
  let nextId = 1
  let state: GameState = 'aim'
  let score = 0
  let turnFrames = 0
  let quietFrames = 0
  let clearDelay = 0
  let shots = 0
  /** うごく かべの とけい（こまかい きざみの かず）。 */
  let ticks = 0
  /** まえの たまの とおった あと。ねらいの 目じるしに なる。 */
  let trail: Point[] = []
  let currentTrail: Point[] = []

  const ground = Bodies.rectangle(level.width / 2, GROUND_Y + 100, level.width * 3, 200, { isStatic: true, friction: .9, label: 'ground' })
  Composite.add(engine.world, ground)

  function track(kind: PieceKind, body: Matter.Body, w: number, h: number, hp = Infinity, extra: Partial<Tracked> = {}): Tracked {
    const tracked: Tracked = { id: nextId++, kind, body, w, h, hp, maxHp: hp, pulse: 0, ...extra }
    pieces.push(tracked)
    return tracked
  }

  const ropes: Matter.Constraint[] = []
  function hang(item: Tracked, piece: Piece) {
    const at = balloonAt(piece)
    if (!at) return
    const body = Bodies.circle(at.x, at.y, BALLOON_R, { isStatic: true, isSensor: true })
    const rope = Constraint.create({ bodyA: body, pointA: { x: 0, y: BALLOON_R }, bodyB: item.body, pointB: { x: 0, y: -item.h / 2 }, stiffness: 1, damping: .05 })
    ropes.push(rope)
    item.balloon = track('balloon', body, BALLOON_R * 2, BALLOON_R * 2, 1, { carry: item, rope })
    // つられて ゆれる ものは はやめに おちつかせる。
    item.body.frictionAir = .04
  }

  for (const piece of level.pieces) {
    if (piece.type === 'hill') {
      const body = Bodies.rectangle(piece.x, piece.y, piece.w, piece.h, { isStatic: true, friction: .9, chamfer: { radius: [26, 26, 0, 0] }, label: 'ground' })
      track('hill', body, piece.w, piece.h)
    } else if (piece.type === 'block') {
      const m = MATERIALS[piece.material]
      const body = Bodies.rectangle(piece.x, piece.y, piece.w, piece.h, { density: m.density, friction: m.friction, frictionStatic: 1, restitution: .05, angle: piece.angle ?? 0, chamfer: { radius: 2 } })
      track('block', body, piece.w, piece.h, m.hp, { material: piece.material })
    } else if (piece.type === 'robot') {
      const kind = piece.kind ?? 'normal'
      const body = Bodies.rectangle(piece.x, piece.y, piece.size, piece.size, { density: .0012, friction: .8, frictionStatic: 1, restitution: .1, chamfer: { radius: piece.size * .28 } })
      const robot = track('robot', body, piece.size, piece.size, ROBOTS[kind].hp, { robot: kind, helmet: kind === 'helmet' })
      hang(robot, piece)
    } else if (piece.type === 'box') {
      const body = Bodies.rectangle(piece.x, piece.y, BOX_SIZE, BOX_SIZE, { density: .001, friction: .8, frictionStatic: 1, restitution: .05, chamfer: { radius: 4 } })
      hang(track('box', body, BOX_SIZE, BOX_SIZE, BOX_HP), piece)
    } else if (piece.type === 'steel') {
      const body = Bodies.rectangle(piece.x, piece.y, piece.w, piece.h, { isStatic: true, friction: .4, restitution: .45, angle: piece.angle ?? 0, chamfer: { radius: 3 } })
      track('steel', body, piece.w, piece.h)
    } else if (piece.type === 'mover') {
      const body = Bodies.rectangle(piece.x, piece.y, piece.w, piece.h, { isStatic: true, friction: .4, restitution: .45, chamfer: { radius: 3 } })
      track('mover', body, piece.w, piece.h, Infinity, { motion: { x: piece.x, y: piece.y, dx: piece.dx, dy: piece.dy, period: piece.period } })
    } else if (piece.type === 'spring') {
      const body = Bodies.rectangle(piece.x, piece.y, piece.w, SPRING_H, { isStatic: true, friction: .3, chamfer: { radius: 6 } })
      track('spring', body, piece.w, SPRING_H)
    } else if (piece.type === 'fan') {
      const body = Bodies.rectangle(piece.x, GROUND_Y - FAN_H / 2, piece.w, FAN_H, { isStatic: true, friction: .6, chamfer: { radius: [8, 8, 0, 0] } })
      track('fan', body, piece.w, FAN_H)
    }
  }
  const byBody = new Map<number, Tracked>(pieces.map(p => [p.body.id, p]))
  const projectileByBody = new Map<number, Projectile>()
  Composite.add(engine.world, [...pieces.map(p => p.body), ...ropes])
  // つみきは ねむった まま はじめる。何かが ぶつかるまで ぴくりとも しない。
  for (const p of pieces) if (!p.body.isStatic) Sleeping.set(p.body, true)
  const movers = pieces.filter(p => p.motion)

  const pending = new Set<Tracked>()
  const pendingBlasts: Tracked[] = []
  const pendingPops = new Set<Tracked>()
  /** こまかい きざみの あとで まとめて やる こと（ぶつかった しゅんかんには はやさを かえられない）。 */
  const bounces = new Map<Matter.Body, Tracked>()
  const springCount = new Map<Matter.Body, number>()
  const drills = new Set<Projectile>()
  const bombs = new Set<Projectile>()
  /** ぽよんの たまと、ぶつかる まえの はやさ。 */
  const bouncing = new Map<Projectile, number>()

  function damage(target: Tracked, amount: number) {
    if (!Number.isFinite(target.hp) || target.hp <= 0 || target.kind === 'balloon') return
    target.hp -= amount
    if (target.helmet && target.hp <= HELMET_HP && target.hp > 0) {
      target.helmet = false
      events.push({ type: 'helmet', x: target.body.position.x, y: target.body.position.y - target.h / 2 })
    }
    if (target.hp <= 0) pending.add(target)
  }

  function massOf(body: Matter.Body) {
    return body.isStatic ? 6 : Math.min(body.mass, 12)
  }

  /** ドリルが つきぬけられる もの。いしと おやぶんロボは とめる。 */
  function pierceable(target: Tracked) {
    return target.kind === 'box' || (target.kind === 'robot' && target.robot !== 'boss') || (target.kind === 'block' && target.material !== 'stone')
  }

  Events.on(engine, 'collisionStart', event => {
    for (const pair of event.pairs) {
      const a = pair.bodyA.parent, b = pair.bodyB.parent
      const ta = byBody.get(a.id), tb = byBody.get(b.id)
      // ふうせんは さわった だけで われる（つりさげている ものは べつ）。
      const balloon = ta?.kind === 'balloon' ? ta : tb?.kind === 'balloon' ? tb : undefined
      if (balloon) {
        const other = balloon === ta ? b : a
        if (!other.isStatic && other !== balloon.carry?.body) pendingPops.add(balloon)
        continue
      }
      const pa = projectileByBody.get(a.id), pb = projectileByBody.get(b.id)
      const ball = pa ?? pb
      const target = pa ? tb : ta
      if (ball?.kind === 'bomb') bombs.add(ball)
      if (ball?.kind === 'drill' && target && pierceable(target) && Body.getSpeed(ball.body) > DRILL_MIN_SPEED) {
        // ぶつからずに つきぬけ、あいては その場で こわれる。
        pair.isSensor = true
        damage(target, target.hp)
        drills.add(ball)
        events.push({ type: 'pierce', x: target.body.position.x, y: target.body.position.y })
        continue
      }
      if (ball?.kind === 'bouncy' && ball.hits < BOUNCY_HITS) {
        // スーパーボールのように、かべや ものに ぶつかっても はやさを ほとんど なくさない（じめんでは ふつうに はねる）。
        if ((ball === pa ? b : a).label !== 'ground') bouncing.set(ball, Math.max(bouncing.get(ball) ?? 0, Body.getSpeed(ball.body)))
        if (++ball.hits >= BOUNCY_HITS) ball.body.restitution = .3
      }
      const spring = ta?.kind === 'spring' ? ta : tb?.kind === 'spring' ? tb : undefined
      if (spring) {
        const other = spring === ta ? b : a
        if (!other.isStatic && (springCount.get(other) ?? 0) < SPRING_LIMIT) bounces.set(other, spring)
      }
      const va = a.isStatic || a.isSleeping ? { x: 0, y: 0 } : Body.getVelocity(a)
      const vb = b.isStatic || b.isSleeping ? { x: 0, y: 0 } : Body.getVelocity(b)
      const n = pair.collision.normal
      const speed = Math.abs((va.x - vb.x) * n.x + (va.y - vb.y) * n.y)
      if (speed < 1.4) continue
      // うける いたさは ぶつかった はやさと あいての おもさで きまる。
      if (ta) damage(ta, speed * Math.sqrt(massOf(b)) * .5)
      if (tb) damage(tb, speed * Math.sqrt(massOf(a)) * .5)
      if (speed > 3.5) {
        const hit = pair.collision.supports[0] ?? a.position
        const struck = [tb, ta].find(t => t?.kind === 'robot' || t?.material || t?.kind === 'steel' || t?.kind === 'mover')
        const material = ball?.kind === 'bouncy' ? 'bouncy'
          : struck?.kind === 'robot' ? 'robot'
            : struck?.kind === 'steel' || struck?.kind === 'mover' ? 'steel'
              : struck?.material ?? (ball ? 'ball' : 'ground')
        events.push({ type: 'hit', x: hit.x, y: hit.y, strength: Math.min(1, speed / 16), material })
      }
    }
  })

  function wakeAround(x: number, y: number, size: number) {
    // ねむっている つみきは 下の 板が きえても おきないので、まわりを おこして おとす。
    const reach = size / 2 + 90
    for (const other of pieces) {
      if (other.body.isSleeping && Math.hypot(other.body.position.x - x, other.body.position.y - y) < reach + Math.max(other.w, other.h) / 2) Sleeping.set(other.body, false)
    }
  }

  function detach(target: Tracked) {
    const index = pieces.indexOf(target)
    if (index < 0) return false
    pieces.splice(index, 1)
    byBody.delete(target.body.id)
    Composite.remove(engine.world, target.body)
    return true
  }

  /** ふうせんが われて、つりさげていた ものが おちる。 */
  function pop(balloon: Tracked) {
    if (!detach(balloon)) return
    if (balloon.rope) Composite.remove(engine.world, balloon.rope)
    const carry = balloon.carry
    if (carry) {
      carry.balloon = undefined
      carry.body.frictionAir = .01
      Sleeping.set(carry.body, false)
    }
    const { x, y } = balloon.body.position
    score += POP_SCORE
    events.push({ type: 'pop', x, y, score: POP_SCORE })
  }

  function remove(target: Tracked) {
    if (!detach(target)) return
    const { x, y } = target.body.position
    wakeAround(x, y, Math.max(target.w, target.h))
    if (target.balloon) pop(target.balloon)
    if (target.kind === 'robot') {
      const kind = target.robot ?? 'normal'
      const s = ROBOTS[kind].score
      score += s
      events.push({ type: 'robot', x, y, score: s, kind })
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

  function blast(origin: Point, source: keyof typeof BLASTS) {
    const spec = BLASTS[source]
    events.push({ type: 'blast', x: origin.x, y: origin.y, source })
    for (const p of pieces) {
      if (p.kind === 'balloon' && Math.hypot(p.body.position.x - origin.x, p.body.position.y - origin.y) < spec.radius + BALLOON_R) pendingPops.add(p)
    }
    const bodies = [...pieces.map(p => p.body), ...projectiles.map(p => p.body)]
    for (const body of bodies) {
      if (body.isStatic) continue
      const dx = body.position.x - origin.x, dy = body.position.y - origin.y
      const d = Math.hypot(dx, dy)
      if (d > spec.radius || d === 0) continue
      const power = 1 - d / spec.radius
      Sleeping.set(body, false)
      const v = Body.getVelocity(body)
      Body.setVelocity(body, { x: v.x + dx / d * spec.push * power, y: v.y + (dy / d - .6) * spec.push * power })
      Body.setAngularVelocity(body, (dx > 0 ? .12 : -.12) * power)
      const tracked = byBody.get(body.id)
      if (tracked) damage(tracked, spec.damage * power)
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
    const projectile: Projectile = { id: nextId++, kind, body, radius: spec.radius, canSplit, hits: 0 }
    projectiles.push(projectile)
    projectileByBody.set(body.id, projectile)
    return projectile
  }

  function removeProjectile(p: Projectile) {
    const index = projectiles.indexOf(p)
    if (index < 0) return
    Composite.remove(engine.world, p.body)
    projectiles.splice(index, 1)
    projectileByBody.delete(p.body.id)
  }

  function clearProjectiles() {
    for (const p of projectiles) Composite.remove(engine.world, p.body)
    projectiles.length = 0
    projectileByBody.clear()
  }

  function moveMovers() {
    const t = ticks / SUBSTEPS
    for (const m of movers) {
      const motion = m.motion!
      const s = Math.sin(t / motion.period * Math.PI * 2)
      // はやさも いっしょに かえて、あたった たまが かべの うごきを うけるように する。
      moveStatic(m.body, { x: motion.x + motion.dx * s, y: motion.y + motion.dy * s }, true)
    }
  }

  /** トランポリン・ドリル・ばくだん・ワープの しあげ。ぶつかる けいさんが おわってから はやさを かえる。 */
  function afterSubstep() {
    for (const [body, spring] of bounces) {
      const n = { x: Math.sin(SPRING_TILT), y: -Math.cos(SPRING_TILT) }
      const v = Body.getVelocity(body)
      const along = v.x * n.x + v.y * n.y
      const tx = (v.x - n.x * along) * SPRING_KEEP, ty = (v.y - n.y * along) * SPRING_KEEP
      Body.setVelocity(body, { x: tx + n.x * SPRING_SPEED, y: ty + n.y * SPRING_SPEED })
      springCount.set(body, (springCount.get(body) ?? 0) + 1)
      spring.pulse = 16
      events.push({ type: 'spring', x: spring.body.position.x, y: spring.body.position.y })
    }
    bounces.clear()
    for (const drill of drills) {
      const v = Body.getVelocity(drill.body)
      Body.setVelocity(drill.body, { x: v.x * DRILL_DRAG, y: v.y * DRILL_DRAG })
    }
    drills.clear()
    for (const [ball, before] of bouncing) {
      const v = Body.getVelocity(ball.body)
      const speed = Math.hypot(v.x, v.y)
      const keep = before * BOUNCY_KEEP
      if (speed > .5 && speed < keep) Body.setVelocity(ball.body, { x: v.x * keep / speed, y: v.y * keep / speed })
    }
    bouncing.clear()
    for (const bomb of bombs) {
      if (!projectiles.includes(bomb)) continue
      const at = { x: bomb.body.position.x, y: bomb.body.position.y }
      removeProjectile(bomb)
      blast(at, 'bomb')
    }
    bombs.clear()
    for (const p of projectiles) {
      const portal = warpExit(p.body.position, portals)
      if (!portal) continue
      Body.setPosition(p.body, portal.to)
      events.push({ type: 'warp', from: portal.from, to: portal.to })
    }
  }

  function stepWorld() {
    for (let s = 0; s < SUBSTEPS; s++) {
      ticks++
      moveMovers()
      for (const p of projectiles) blow(p.body, fans)
      Engine.update(engine, STEP_MS)
      afterSubstep()
    }
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

  /**
   * あおい たまは とんでいる とちゅうで じどうで 3つに わかれる。
   * やまの てっぺん（おちはじめた ところ）で わかれ、まっすぐ うっても すこし とんだら わかれる。
   */
  function autoSplit() {
    const source = projectiles.find(p => p.canSplit)
    if (!source || turnFrames < AUTO_SPLIT_MIN_FRAMES) return
    if (Body.getVelocity(source.body).y >= 0 || turnFrames >= AUTO_SPLIT_MAX_FRAMES) api.split()
  }

  const api = {
    level,
    pieces,
    projectiles,
    portals,
    fans,
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
      springCount.clear()
      shots++
      events.push({ type: 'launch' })
      return true
    },
    /** とんでいる あおい たまを 3つに わける（ふつうは step の なかで じどうで よばれる）。 */
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
      stepWorld()
      if (state === 'flying') autoSplit()
      for (const p of pieces) if (p.pulse > 0) p.pulse--
      for (const target of [...pending]) remove(target)
      pending.clear()
      for (const balloon of [...pendingPops]) pop(balloon)
      pendingPops.clear()
      for (const box of pendingBlasts.splice(0)) blast(box.body.position, 'box')
      for (const target of [...pieces]) if (!target.body.isStatic && outOfWorld(target.body)) remove(target)
      for (const p of [...projectiles]) if (outOfWorld(p.body)) removeProjectile(p)
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
  return api
}

export type Game = ReturnType<typeof createGame>
