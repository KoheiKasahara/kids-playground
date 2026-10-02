/**
 * パターゴルフの物理世界（Rapier）。
 *
 * Three.js にも DOM にも依存しないので、vitest の中で本物の物理を回して
 * 「うったボールがカップに入るか」「ふうしゃの はねに はじかれるか」「水に落ちたら戻るか」を確かめられる。
 * 床と壁は golfGeometry.ts が作った見た目と同じ形。ここは結果（位置・できごと）だけを外へ返す。
 */
import RAPIER from '@dimforge/rapier3d-compat'
import type { CourseDefinition, HoleDefinition, Vec2 } from './golfCourses'
import type { HoleGeometry } from './golfGeometry'
import {
  BALL_RADIUS,
  BOOSTER,
  BRIDGE,
  BUMPER_HEIGHT,
  CRITTER,
  cupPull,
  GATE,
  isHoled,
  MAX_BALL_SPEED,
  patrolOffset,
  patrolPhase,
  PHYSICS_STEP,
  powerForDistance,
  REST_SECONDS,
  REST_SPEED,
  REST_SPIN,
  REFLECTOR,
  rollDistance,
  rollingDecel,
  rollingFactor,
  SHOT_TIMEOUT_SECONDS,
  shotSpeed,
  shotVelocity,
  TREE,
  WARP,
  WINDMILL,
  windmillAngle,
  type Surface,
  type Vec3,
} from './golfPhysics'

export type Quat = { x: number; y: number; z: number; w: number }
/** ready: うてる / rolling: ころがり中 / holed: カップイン / out: コースの外へ出た */
export type GolfPhase = 'ready' | 'rolling' | 'holed' | 'out'
export type GolfEvent =
  | { kind: 'shot'; power: number; position: Vec3 }
  | { kind: 'wall' | 'rock' | 'windmill' | 'tree'; strength: number; position: Vec3 }
  | { kind: 'bumper'; id: string; strength: number; position: Vec3 }
  /** うごくカベに あたった。 */
  | { kind: 'gate'; id: string; strength: number; position: Vec3 }
  /** はねかえし いたで はねた。 */
  | { kind: 'reflector'; id: string; strength: number; position: Vec3 }
  /** 歩く どうぶつに あたって はねた。 */
  | { kind: 'critter'; id: string; strength: number; position: Vec3 }
  /** どかんに入って、to から出てきた。 */
  | { kind: 'warp'; id: string; position: Vec3; to: Vec3 }
  | { kind: 'boost'; id: string; position: Vec3 }
  | { kind: 'takeoff'; position: Vec3 }
  | { kind: 'land'; strength: number; position: Vec3 }
  /** 芝ではない ゆかに入った。 */
  | { kind: 'surface'; surface: Exclude<Surface, 'green'>; position: Vec3 }
  /** 水に落ちた。pond は コースの中の いけや かわに おちたとき。 */
  | { kind: 'splash'; position: Vec3; pond?: boolean; velocity?: Vec2 }
  /** 壁の上など、床のない所で止まった。 */
  | { kind: 'lost'; position: Vec3 }
  | { kind: 'cup'; position: Vec3 }
  | { kind: 'rest'; position: Vec3 }
export type ShotSuggestion = { direction: Vec2; power: number; target: Vec2 }
/** 動くしかけの いまの様子。見た目（golfScene）は これだけを受け取って動かす。 */
export type GadgetMotion = {
  windmills: number[]
  gates: Vec2[]
  critters: { x: number; z: number; facing: number }[]
}

const BUMPER_KICK = 2.8
const CRITTER_KICK = 2.1

type Role = {
  kind: 'floor' | 'wall' | 'bumper' | 'rock' | 'tree' | 'blade' | 'gate' | 'critter' | 'reflector'
  id: string
  x: number
  z: number
  /** はねかえし いたの 両はし。はねる向きを いたの面から決める。 */
  ends?: [Vec2, Vec2]
  /** 動くしかけは、ぶつかった ときの位置を からだから読む。 */
  body?: RAPIER.RigidBody
}

const quatY = (angle: number): Quat => ({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) })
const quatZ = (angle: number): Quat => ({ x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) })
const IDENTITY: Quat = { x: 0, y: 0, z: 0, w: 1 }
const ZERO = { x: 0, y: 0, z: 0 }

function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)))
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t))
}

export function createGolfWorld(course: CourseDefinition, hole: HoleDefinition, geometry: HoleGeometry) {
  const world = new RAPIER.World({ x: 0, y: -course.gravity, z: 0 })
  world.timestep = PHYSICS_STEP
  const queue = new RAPIER.EventQueue(true)
  const roles = new Map<number, Role>()
  const floorHandles = new Set<number>()
  const obstacleHandles = new Set<number>()
  const { cup } = geometry
  const add = (desc: RAPIER.ColliderDesc, role: Role, body?: RAPIER.RigidBody) => {
    const collider = world.createCollider(desc, body)
    roles.set(collider.handle, role)
    if (role.kind === 'floor') floorHandles.add(collider.handle)
    // ふうしゃの はねと とびらは「待てば どく」ので、ねらいの見通しでは じゃま物あつかいしない。
    if (role.kind !== 'floor' && role.kind !== 'blade' && role.kind !== 'gate') obstacleHandles.add(collider.handle)
    return collider
  }

  add(RAPIER.ColliderDesc.trimesh(geometry.floor.positions, geometry.floor.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(0.8).setRestitution(0), { kind: 'floor', id: 'floor', x: 0, z: 0 })
  add(RAPIER.ColliderDesc.trimesh(geometry.cupWall.positions, geometry.cupWall.indices).setFriction(0.6).setRestitution(0.05), { kind: 'floor', id: 'cup', x: cup.x, z: cup.z })
  add(RAPIER.ColliderDesc.cylinder(0.05, cup.radius + 0.05).setTranslation(cup.x, cup.y - cup.depth - 0.05, cup.z).setFriction(0.9).setRestitution(0), { kind: 'floor', id: 'cup', x: cup.x, z: cup.z })
  for (const wall of geometry.walls) {
    add(RAPIER.ColliderDesc.cuboid(wall.hx, wall.hy, wall.hz).setTranslation(wall.x, wall.y, wall.z).setRotation(quatY(wall.yaw)).setFriction(0).setRestitution(0.75), { kind: 'wall', id: 'wall', x: wall.x, z: wall.z })
  }

  const groundOf = (x: number, z: number) => geometry.heightAt(x, z) ?? geometry.tee.y
  const windmills: { speed: number; body: RAPIER.RigidBody }[] = []
  const boosters: { id: string; x: number; z: number; dir: Vec2; speed: number; inside: boolean }[] = []
  const gates: { x: number; z: number; y: number; axis: Vec2; span: number; speed: number; body: RAPIER.RigidBody }[] = []
  const critters: { from: Vec2; to: Vec2; speed: number; base: number; body: RAPIER.RigidBody }[] = []
  const warps: { id: string; x: number; z: number; radius: number; exit: Vec2; dir: Vec2; inside: boolean }[] = []
  const unit = (v: Vec2): Vec2 => {
    const length = Math.hypot(v.x, v.z) || 1
    return { x: v.x / length, z: v.z / length }
  }
  for (const gadget of hole.gadgets ?? []) {
    const ground = groundOf(gadget.x, gadget.z)
    if (gadget.kind === 'bumper') {
      add(RAPIER.ColliderDesc.cylinder(BUMPER_HEIGHT / 2, gadget.radius).setTranslation(gadget.x, ground + BUMPER_HEIGHT / 2 - 0.02, gadget.z).setFriction(0).setRestitution(1), { kind: 'bumper', id: gadget.id, x: gadget.x, z: gadget.z })
    } else if (gadget.kind === 'rock') {
      add(RAPIER.ColliderDesc.ball(gadget.radius).setTranslation(gadget.x, ground - gadget.radius * 0.3, gadget.z).setFriction(0.3).setRestitution(0.3), { kind: 'rock', id: gadget.id, x: gadget.x, z: gadget.z })
    } else if (gadget.kind === 'tree') {
      // きの みき。ほとんど はねないので、あたると その場に ぽとりと 落ちる。
      add(RAPIER.ColliderDesc.cylinder(TREE.trunk / 2, gadget.radius)
        .setTranslation(gadget.x, ground + TREE.trunk / 2 - 0.05, gadget.z)
        .setFriction(0.5).setRestitution(0.35), { kind: 'tree', id: gadget.id, x: gadget.x, z: gadget.z })
    } else if (gadget.kind === 'windmill') {
      // トンネルの両わきの柱。ボールはトンネルの中しか通れない。
      for (const side of [-1, 1]) {
        add(RAPIER.ColliderDesc.cuboid((WINDMILL.outer - WINDMILL.tunnelHalf) / 2, WINDMILL.pillarHeight / 2, WINDMILL.halfDepth)
          .setTranslation(gadget.x + (side * (WINDMILL.outer + WINDMILL.tunnelHalf)) / 2, ground + WINDMILL.pillarHeight / 2 - 0.05, gadget.z)
          .setFriction(0).setRestitution(0.6), { kind: 'wall', id: gadget.id, x: gadget.x, z: gadget.z })
      }
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(gadget.x, ground + WINDMILL.hubHeight, gadget.z + WINDMILL.bladeFront))
      for (let index = 0; index < WINDMILL.blades; index++) {
        const alpha = (index / WINDMILL.blades) * Math.PI * 2
        const reach = 0.1 + WINDMILL.bladeLength / 2
        add(RAPIER.ColliderDesc.cuboid(WINDMILL.bladeWidth / 2, WINDMILL.bladeLength / 2, WINDMILL.bladeThickness / 2)
          .setTranslation(Math.sin(alpha) * reach, Math.cos(alpha) * reach, 0)
          .setRotation(quatZ(-alpha)).setFriction(0.1).setRestitution(0.5), { kind: 'blade', id: gadget.id, x: gadget.x, z: gadget.z }, body)
      }
      windmills.push({ speed: gadget.speed, body })
    } else if (gadget.kind === 'gate') {
      // うごくカベ。からだは まっすぐ動かすだけにして、向きはコライダー側で付ける。
      const axis = unit(gadget.axis)
      const y = ground + GATE.height / 2 - 0.05
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(gadget.x, y, gadget.z))
      add(RAPIER.ColliderDesc.cuboid(gadget.halfWidth, GATE.height / 2, GATE.halfDepth)
        // すこし はねかえし、動くと ボールを よこへ はらう（止まった ボールが とびらの前に へばりつかない）。
        .setRotation(quatY(Math.atan2(-axis.z, axis.x))).setFriction(0.12).setRestitution(0.5),
        { kind: 'gate', id: gadget.id, x: gadget.x, z: gadget.z, body }, body)
      gates.push({ x: gadget.x, z: gadget.z, y, axis, span: gadget.span, speed: gadget.speed, body })
    } else if (gadget.kind === 'critter') {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(gadget.x, ground + CRITTER.height / 2, gadget.z))
      add(RAPIER.ColliderDesc.cylinder(CRITTER.height / 2, CRITTER.radius).setFriction(0.2).setRestitution(0.4),
        { kind: 'critter', id: gadget.id, x: gadget.x, z: gadget.z, body }, body)
      critters.push({ from: { x: gadget.x, z: gadget.z }, to: gadget.to, speed: gadget.speed, base: ground, body })
    } else if (gadget.kind === 'bridge') {
      // はしの てすり。はしの両がわに ながい カベを置く。
      if (!gadget.rails) continue
      const axis = unit(gadget.dir)
      for (const side of [-1, 1]) {
        const offset = side * (gadget.halfWidth + BRIDGE.railHalf)
        const x = gadget.x + axis.z * offset
        const z = gadget.z - axis.x * offset
        add(RAPIER.ColliderDesc.cuboid(gadget.halfLength, BRIDGE.railHeight / 2 + 0.15, BRIDGE.railHalf)
          .setTranslation(x, groundOf(x, z) + BRIDGE.railHeight / 2 - 0.15, z)
          .setRotation(quatY(Math.atan2(-axis.z, axis.x))).setFriction(0).setRestitution(0.6), { kind: 'wall', id: gadget.id, x, z })
      }
    } else if (gadget.kind === 'reflector') {
      const axis = unit(gadget.dir)
      const ends: [Vec2, Vec2] = [
        { x: gadget.x - axis.x * gadget.halfLength, z: gadget.z - axis.z * gadget.halfLength },
        { x: gadget.x + axis.x * gadget.halfLength, z: gadget.z + axis.z * gadget.halfLength },
      ]
      add(RAPIER.ColliderDesc.cuboid(gadget.halfLength, REFLECTOR.height / 2, REFLECTOR.halfDepth)
        .setTranslation(gadget.x, ground + REFLECTOR.height / 2 - 0.05, gadget.z)
        .setRotation(quatY(Math.atan2(-axis.z, axis.x))).setFriction(0).setRestitution(0.9), { kind: 'reflector', id: gadget.id, x: gadget.x, z: gadget.z, ends })
    } else if (gadget.kind === 'warp') {
      warps.push({ id: gadget.id, x: gadget.x, z: gadget.z, radius: gadget.radius, exit: gadget.exit, dir: unit(gadget.exitDir), inside: false })
    } else {
      const length = Math.hypot(gadget.dir.x, gadget.dir.z) || 1
      boosters.push({ id: gadget.id, x: gadget.x, z: gadget.z, dir: { x: gadget.dir.x / length, z: gadget.dir.z / length }, speed: gadget.speed, inside: false })
    }
  }

  const spawn = { x: geometry.tee.x, y: geometry.tee.y + BALL_RADIUS + 0.003, z: geometry.tee.z }
  // 減速は転がり抵抗（rollingFactor）だけで表す。dampingを重ねると飛距離の目安が合わなくなる。
  const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(spawn.x, spawn.y, spawn.z).setCcdEnabled(true).setCanSleep(false))
  const ballCollider = world.createCollider(RAPIER.ColliderDesc.ball(BALL_RADIUS).setDensity(1.2).setFriction(0.6).setRestitution(0.45).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), ball)

  const outY = Math.min(geometry.bounds.minY, cup.y - cup.depth) - 0.4
  const waterY = Math.min(...geometry.outlines.map(outline => outline.base)) - 0.3
  const decelOf = (surface: Surface) => rollingDecel(surface, course.gravity, course.rollingScale)
  /** その線の上の ゆかを ならした 転がり抵抗。こおりの上を通る線は、弱く うつ目安になる。 */
  const decelAlong = (from: Vec2, to: Vec2) => {
    const steps = 6
    let total = 0
    for (let index = 0; index <= steps; index++) {
      const t = index / steps
      total += decelOf(geometry.surfaceAt(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t) ?? 'green')
    }
    return total / (steps + 1)
  }
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })
  const probe = new RAPIER.Ball(BALL_RADIUS)
  const isFloor = (collider: RAPIER.Collider) => floorHandles.has(collider.handle)
  const isObstacle = (collider: RAPIER.Collider) => obstacleHandles.has(collider.handle)

  let phase: GolfPhase = 'ready'
  let rest: Vec3 = { ...spawn }
  let time = 0
  let shotTime = 0
  let restTimer = 0
  let airTime = 0
  let airborne = false
  let airSpeed = 0
  let lastSurface: Surface = 'green'
  let events: GolfEvent[] = []
  const lastEmit = new Map<string, number>()
  const emit = (event: GolfEvent, key?: string, cooldown = 0.1) => {
    if (key) {
      if (time - (lastEmit.get(key) ?? -Infinity) < cooldown) return
      lastEmit.set(key, time)
    }
    events.push(event)
  }

  function position(): Vec3 {
    const p = ball.translation()
    return { x: p.x, y: p.y, z: p.z }
  }

  function pin(at: Vec3) {
    ball.setTranslation(at, true)
    ball.setLinvel(ZERO, true)
    ball.setAngvel(ZERO, true)
  }

  function place(point: Vec2): Vec3 {
    const ground = geometry.heightAt(point.x, point.z) ?? geometry.tee.y
    rest = clearOfGates({ x: point.x, y: ground + BALL_RADIUS + 0.003, z: point.z })
    for (const warp of warps) warp.inside = false
    pin(rest)
    ball.setRotation(IDENTITY, true)
    phase = 'ready'
    restTimer = 0
    return rest
  }

  function ground(p: Vec3) {
    ray.origin = p
    return world.castRayAndGetNormal(ray, BALL_RADIUS + 0.06, true, undefined, undefined, ballCollider, ball, isFloor)
  }

  function contact(role: Role, speed: number, before: Vec3) {
    const p = position()
    const strength = Math.min(1, speed / 6)
    if (role.kind === 'reflector' && role.ends) {
      // いたの面で 鏡のように はねかえす。回転も 新しい向きに そろえて、はねたあと すべらずに 転がす。
      const [a, b] = role.ends
      const dx = b.x - a.x
      const dz = b.z - a.z
      const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)))
      let nx = p.x - (a.x + dx * t)
      let nz = p.z - (a.z + dz * t)
      const length = Math.hypot(nx, nz) || 1
      nx /= length
      nz /= length
      const into = before.x * nx + before.z * nz
      if (into < 0) {
        const vx = (before.x - 2 * into * nx) * REFLECTOR.keep
        const vz = (before.z - 2 * into * nz) * REFLECTOR.keep
        ball.setLinvel({ x: vx, y: Math.min(0, before.y), z: vz }, true)
        ball.setAngvel({ x: vz / BALL_RADIUS, y: 0, z: -vx / BALL_RADIUS }, true)
      }
      emit({ kind: 'reflector', id: role.id, strength: Math.max(0.5, strength), position: p }, `reflector-${role.id}`, 0.15)
    }
    if (role.kind === 'wall' && speed > 0.35) emit({ kind: 'wall', strength, position: p }, 'wall', 0.08)
    if (role.kind === 'rock') emit({ kind: 'rock', strength, position: p }, 'rock', 0.12)
    if (role.kind === 'tree') emit({ kind: 'tree', strength: Math.max(0.35, strength), position: p }, 'tree', 0.14)
    if (role.kind === 'blade') emit({ kind: 'windmill', strength: Math.max(0.4, strength), position: p }, 'blade', 0.2)
    if (role.kind === 'gate' && speed > 0.3) emit({ kind: 'gate', id: role.id, strength: Math.max(0.4, strength), position: p }, `gate-${role.id}`, 0.15)
    if (role.kind === 'bumper' || role.kind === 'critter') {
      // 反発だけでは遅い球の「ぽよん」が弱いので、外向きの速さを最低限そろえる。
      // 動く どうぶつは、いまの居場所を からだから読む。
      const center = role.body?.translation() ?? role
      const dx = p.x - center.x
      const dz = p.z - center.z
      const length = Math.hypot(dx, dz) || 1
      const v = ball.linvel()
      const outward = (v.x * dx + v.z * dz) / length
      const kick = role.kind === 'bumper' ? BUMPER_KICK : CRITTER_KICK
      if (outward < kick) ball.setLinvel({ x: v.x + (dx / length) * (kick - outward), y: v.y, z: v.z + (dz / length) * (kick - outward) }, true)
      emit(role.kind === 'bumper'
        ? { kind: 'bumper', id: role.id, strength: Math.max(0.5, strength), position: p }
        : { kind: 'critter', id: role.id, strength: Math.max(0.5, strength), position: p }, `${role.kind}-${role.id}`, 0.15)
    }
  }

  /**
   * うごくカベの通り道で止まったら、カベの外へ そっとずらす。
   * 止まったボールは その場に固定するので、カベと重なったままにしないため。
   */
  function clearOfGates(p: Vec3): Vec3 {
    let point = p
    for (const gate of gates) {
      const side = (point.x - gate.x) * gate.axis.z - (point.z - gate.z) * gate.axis.x
      const reach = GATE.halfDepth + BALL_RADIUS + 0.04
      if (Math.abs(side) >= reach) continue
      const shift = (reach - Math.abs(side)) * (side < 0 ? -1 : 1)
      const moved = { x: point.x + gate.axis.z * shift, z: point.z - gate.axis.x * shift }
      const ground = geometry.heightAt(moved.x, moved.z)
      if (ground === null) continue
      point = { x: moved.x, y: ground + BALL_RADIUS + 0.003, z: moved.z }
    }
    return point
  }

  function settle() {
    const p = position()
    restTimer = 0
    if (geometry.heightAt(p.x, p.z) === null) {
      phase = 'out'
      emit({ kind: 'lost', position: p })
      return
    }
    const spot = clearOfGates(p)
    pin(spot)
    rest = spot
    phase = 'ready'
    emit({ kind: 'rest', position: spot })
  }

  /** いま どこを歩いているか。見た目と物理で同じ時刻から求める。 */
  function critterAt(critter: { from: Vec2; to: Vec2; speed: number }): Vec2 {
    const t = patrolPhase(critter.speed, time)
    return { x: critter.from.x + (critter.to.x - critter.from.x) * t, z: critter.from.z + (critter.to.z - critter.from.z) * t }
  }

  /** うごくカベの いまの位置。 */
  function gateAt(gate: { x: number; z: number; axis: Vec2; span: number; speed: number }): Vec2 {
    const offset = patrolOffset(gate.speed, time, gate.span)
    return { x: gate.x + gate.axis.x * offset, z: gate.z + gate.axis.z * offset }
  }

  function step(): void {
    time += PHYSICS_STEP
    for (const windmill of windmills) windmill.body.setNextKinematicRotation(quatZ(windmillAngle(windmill.speed, time)))
    for (const gate of gates) {
      const at = gateAt(gate)
      gate.body.setNextKinematicTranslation({ x: at.x, y: gate.y, z: at.z })
    }
    for (const critter of critters) {
      const at = critterAt(critter)
      critter.body.setNextKinematicTranslation({ x: at.x, y: (geometry.heightAt(at.x, at.z) ?? critter.base) + CRITTER.height / 2, z: at.z })
    }
    const before = ball.linvel()
    const velocityBefore = { x: before.x, y: before.y, z: before.z }
    const speedBefore = Math.hypot(before.x, before.y, before.z)
    if (phase === 'rolling') {
      const p = ball.translation()
      const pull = cupPull(p, speedBefore, cup, cup.radius)
      if (pull && Math.abs(p.y - cup.y - BALL_RADIUS) < 0.12) ball.setLinvel({ x: before.x + pull.x * PHYSICS_STEP, y: before.y, z: before.z + pull.z * PHYSICS_STEP }, true)
    }
    world.step(queue)
    queue.drainCollisionEvents((a, b, started) => {
      if (!started || phase !== 'rolling') return
      const other = a === ballCollider.handle ? b : b === ballCollider.handle ? a : null
      const role = other === null ? undefined : roles.get(other)
      if (role) contact(role, speedBefore, velocityBefore)
    })
    if (phase === 'ready') { pin(rest); return }
    if (phase !== 'rolling') return

    const p = position()
    if (isHoled(p, cup, cup.radius)) {
      phase = 'holed'
      emit({ kind: 'cup', position: p })
      return
    }
    const b = geometry.bounds
    if (p.y < outY || p.x < b.minX - 3 || p.x > b.maxX + 3 || p.z < b.minZ - 3 || p.z > b.maxZ + 3) {
      phase = 'out'
      emit({ kind: 'splash', position: { x: p.x, y: waterY, z: p.z } })
      return
    }
    for (const warp of warps) {
      const near = Math.hypot(p.x - warp.x, p.z - warp.z) < warp.radius
      if (!near) { warp.inside = false; continue }
      if (warp.inside) continue
      warp.inside = true
      const before = ball.linvel()
      const speed = Math.hypot(before.x, before.y, before.z)
      if (speed < WARP.minSpeed) continue
      const to = { x: warp.exit.x, y: (geometry.heightAt(warp.exit.x, warp.exit.z) ?? geometry.tee.y) + BALL_RADIUS + 0.01, z: warp.exit.z }
      const next = speed * WARP.keepSpeed
      ball.setTranslation(to, true)
      ball.setLinvel({ x: warp.dir.x * next, y: 0, z: warp.dir.z * next }, true)
      ball.setAngvel({ x: (warp.dir.z * next) / BALL_RADIUS, y: 0, z: (-warp.dir.x * next) / BALL_RADIUS }, true)
      // 出口の どかんで すぐ入り直さないように、重なっている どかんは通ったことにする。
      for (const other of warps) other.inside = Math.hypot(to.x - other.x, to.z - other.z) < other.radius
      airborne = false
      airTime = 0
      emit({ kind: 'warp', id: warp.id, position: p, to })
      return
    }
    const grounded = ground(p) !== null
    let v = ball.linvel()
    if (!grounded) {
      airTime += PHYSICS_STEP
      airSpeed = Math.max(0, -v.y)
      // カップへ落ちていくのは「ジャンプ」ではない。
      if (!airborne && airTime > 0.12 && Math.hypot(p.x - cup.x, p.z - cup.z) > cup.radius + 0.1) { airborne = true; emit({ kind: 'takeoff', position: p }) }
    } else {
      if (airborne) emit({ kind: 'land', strength: Math.min(1, airSpeed / 4), position: p })
      airborne = false
      airTime = 0
      // いけや かわに ころがりこんだ。とんで こえている あいだは おちない。
      if (geometry.waterAt(p.x, p.z)) {
        phase = 'out'
        emit({ kind: 'splash', position: { x: p.x, y: p.y - BALL_RADIUS, z: p.z }, pond: true, velocity: { x: v.x, z: v.z } })
        // 水の上を ころがりつづけないよう、その場で とめる。しずむ 見た目は 実行係が つける。
        ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
        ball.setAngvel({ x: 0, y: 0, z: 0 }, true)
        return
      }
      const speed = Math.hypot(v.x, v.y, v.z)
      const surface = geometry.surfaceAt(p.x, p.z) ?? 'green'
      if (surface !== 'green' && surface !== lastSurface && speed > 0.3) emit({ kind: 'surface', surface, position: p })
      lastSurface = surface
      const factor = rollingFactor(speed, decelOf(surface), PHYSICS_STEP)
      if (factor < 1) {
        const w = ball.angvel()
        ball.setLinvel({ x: v.x * factor, y: v.y * factor, z: v.z * factor }, true)
        ball.setAngvel({ x: w.x * factor, y: w.y * factor, z: w.z * factor }, true)
      }
      for (const booster of boosters) {
        const dx = p.x - booster.x
        const dz = p.z - booster.z
        const along = dx * booster.dir.x + dz * booster.dir.z
        const side = dx * booster.dir.z - dz * booster.dir.x
        const inside = Math.abs(along) < BOOSTER.halfLength && Math.abs(side) < BOOSTER.halfWidth
        if (inside && !booster.inside && speed > 0.15) {
          v = ball.linvel()
          const forward = v.x * booster.dir.x + v.z * booster.dir.z
          const lateral = (v.x * booster.dir.z - v.z * booster.dir.x) * 0.4
          const next = Math.max(forward, booster.speed)
          ball.setLinvel({ x: booster.dir.x * next + booster.dir.z * lateral, y: v.y, z: booster.dir.z * next - booster.dir.x * lateral }, true)
          ball.setAngvel({ x: (booster.dir.z * next) / BALL_RADIUS, y: 0, z: (-booster.dir.x * next) / BALL_RADIUS }, true)
          emit({ kind: 'boost', id: booster.id, position: p })
        }
        booster.inside = inside
      }
    }
    v = ball.linvel()
    const speed = Math.hypot(v.x, v.y, v.z)
    if (speed > MAX_BALL_SPEED) ball.setLinvel({ x: (v.x / speed) * MAX_BALL_SPEED, y: (v.y / speed) * MAX_BALL_SPEED, z: (v.z / speed) * MAX_BALL_SPEED }, true)
    shotTime += PHYSICS_STEP
    const w = ball.angvel()
    if (grounded && speed < REST_SPEED && Math.hypot(w.x, w.y, w.z) < REST_SPIN) restTimer += PHYSICS_STEP
    else restTimer = 0
    if (restTimer >= REST_SECONDS || shotTime > SHOT_TIMEOUT_SECONDS) settle()
  }

  /** ボールの形で、じゃまな物（壁・バンパー・いわ・とびら・どうぶつ）へ当たるまでの距離と、当たった面の向き・種類。 */
  function cast(from: Vec3, direction: Vec2, distance: number): { distance: number; normal: Vec2; kind: Role['kind'] } | null {
    const origin = { x: from.x, y: from.y + 0.02, z: from.z }
    const hit = world.castShape(origin, IDENTITY, { x: direction.x, y: 0, z: direction.z }, probe, 0, distance, false, undefined, undefined, ballCollider, ball, isObstacle)
    if (!hit) return null
    const at = { x: origin.x + direction.x * hit.time_of_impact, y: origin.y, z: origin.z + direction.z * hit.time_of_impact }
    const projection = world.projectPoint(at, true, undefined, undefined, ballCollider, ball, isObstacle)
    let normal = { x: -direction.x, z: -direction.z }
    if (projection) {
      const nx = at.x - projection.point.x
      const nz = at.z - projection.point.z
      const length = Math.hypot(nx, nz)
      if (length > 1e-5) normal = { x: nx / length, z: nz / length }
    }
    return { distance: hit.time_of_impact, normal, kind: roles.get(hit.collider.handle)?.kind ?? 'wall' }
  }

  function clearLine(from: Vec3, to: Vec2): boolean {
    const dx = to.x - from.x
    const dz = to.z - from.z
    const length = Math.hypot(dx, dz)
    if (length < 0.05) return true
    if (cast(from, { x: dx / length, z: dz / length }, length)) return false
    // みずを わたる線と、がけの そとへ はみだす線は えらばない（はしの上は よい）。
    // ジャンプ台や どかんで とびこえる ホールでは、ゆかの きれめを こえるのが みちすじなので ゆかは しらべない。
    const ux = dx / length
    const uz = dz / length
    for (let travel = 0.3; travel <= length; travel += 0.1) {
      const x = from.x + ux * travel
      const z = from.z + uz * travel
      if (geometry.waterAt(x, z, 0.12)) return false
      if (!leaps && [0, -0.2, 0.2].some(side => geometry.heightAt(x + uz * side, z - ux * side) === null)) return false
    }
    // ころがりにくい ゆか（すなば・ふかふか）の中を横切る線は選ばない。こおりは よく すべるので通ってよい。
    return !(hole.zones ?? []).some(zone => zone.kind !== 'ice' && Math.hypot(to.x - zone.x, to.z - zone.z) > zone.radius && segmentDistance(zone, from, to) < zone.radius + 0.12)
  }

  const leaps = (hole.features ?? []).some(feature => feature.kind === 'kicker') || warps.length > 0
  // Rapierの問い合わせ（ねらいの見通し）は、1ステップ進めて当たり判定の索引ができてから使える。
  world.step(queue)
  queue.drainCollisionEvents(() => {})
  pin(rest)

  return {
    get phase() { return phase },
    get time() { return time },
    get restPosition() { return { ...rest } },
    ball() {
      const rotation = ball.rotation()
      const velocity = ball.linvel()
      return { position: position(), rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }, velocity: { x: velocity.x, y: velocity.y, z: velocity.z } }
    },
    /** 動くしかけの いまの様子。見た目だけが使う。 */
    motion(): GadgetMotion {
      return {
        windmills: windmills.map(windmill => windmillAngle(windmill.speed, time)),
        gates: gates.map(gateAt),
        critters: critters.map(critter => {
          const at = critterAt(critter)
          const heading = Math.atan2(critter.to.x - critter.from.x, critter.to.z - critter.from.z)
          // 行きと帰りで むきを かえる。速さの向き（sin の かたむき）で見分ける。
          return { x: at.x, z: at.z, facing: Math.cos(critter.speed * time) >= 0 ? heading : heading + Math.PI }
        }),
      }
    },
    step,
    consumeEvents(): GolfEvent[] { const next = events; events = []; return next },
    /** 止まっているボールをうつ。うてないときは false。 */
    shoot(direction: Vec2, power: number): boolean {
      if (phase !== 'ready' || !(Math.hypot(direction.x, direction.z) > 0)) return false
      const { linear, angular } = shotVelocity(direction, power)
      ball.setLinvel(linear, true)
      ball.setAngvel(angular, true)
      phase = 'rolling'
      shotTime = 0
      restTimer = 0
      airborne = false
      airTime = 0
      lastSurface = 'green'
      // どかんの上で止まっていたら、ここから うって そのまま入れる。
      for (const warp of warps) warp.inside = false
      emit({ kind: 'shot', power, position: position() })
      return true
    },
    /** ボールを床の上へ置き直す（水に落ちたとき・おたすけ・やりなおし）。 */
    placeBall(point: Vec2): Vec3 { return place(point) },
    /** 水に落ちる前に止まっていた場所へ戻す。 */
    returnToRest(): Vec3 { return place(rest) },
    /** ねらいの道すじ。まっすぐ転がる距離の目安まで、壁で1回はね返るところまでを返す。 */
    aimPath(direction: Vec2, power: number, maxLength = 6): Vec3[] {
      const start = position()
      const length = Math.hypot(direction.x, direction.z) || 1
      let d = { x: direction.x / length, z: direction.z / length }
      let remaining = Math.min(maxLength, rollDistance(shotSpeed(power), decelAlong(start, { x: start.x + d.x * maxLength, z: start.z + d.z * maxLength })))
      const points: Vec3[] = [start]
      let from = start
      for (let bounce = 0; bounce < 2 && remaining > 0.05; bounce++) {
        const hit = cast(from, d, remaining)
        if (!hit) { points.push({ x: from.x + d.x * remaining, y: from.y, z: from.z + d.z * remaining }); break }
        const travel = Math.max(0, hit.distance - 0.005)
        from = { x: from.x + d.x * travel, y: from.y, z: from.z + d.z * travel }
        points.push(from)
        remaining = (remaining - travel) * 0.55
        const dot = d.x * hit.normal.x + d.z * hit.normal.z
        d = { x: d.x - 2 * dot * hit.normal.x, z: d.z - 2 * dot * hit.normal.z }
      }
      return points
    },
    /**
     * いまの場所からのおすすめのうち方。みちすじの先の点から順に、まっすぐ見通せる点をねらう。
     * 「うつ！」ボタンの最初のねらい、ヒントの矢印、自動テストが同じ答えを使う。
     */
    suggestShot(): ShotSuggestion {
      const p = position()
      const route = hole.route
      let segment = 0
      let nearest = Infinity
      for (let index = 0; index < route.length - 1; index++) {
        const distance = segmentDistance(p, route[index]!, route[index + 1]!)
        if (distance <= nearest + 1e-6) { nearest = distance; segment = index }
      }
      const aimAt = (target: Vec2, extra: number, lastPassed: number): ShotSuggestion => {
        const dx = target.x - p.x
        const dz = target.z - p.z
        const distance = Math.hypot(dx, dz) || 1
        const decel = decelAlong(p, target)
        // 上り坂は、転がる玉の運動エネルギー（回転ぶん7/5倍）で登る高さのぶんだけ強くする。
        // 下り坂は逆に、落ちたぶんだけ よぶんに転がるので、その距離を引いて弱くうつ。
        // ボールは床からほんの少しうかせて置くので、わずかな高さの差は平らとみなす。
        const rise = (geometry.heightAt(target.x, target.z) ?? p.y - BALL_RADIUS) - (p.y - BALL_RADIUS)
        const climb = Math.abs(rise) < 0.02 ? 0 : (course.gravity * rise * (rise > 0 ? 1.4 : 0.7)) / decel
        let power = powerForDistance(distance + extra + climb, decel)
        for (let index = segment + 1; index <= lastPassed; index++) power = Math.max(power, route[index]!.minPower ?? 0)
        return { direction: { x: dx / distance, z: dz / distance }, power: Math.min(1, Math.max(0.12, power)), target: { x: target.x, z: target.z } }
      }
      // はねかえし いたの手前の点は、いたで はねて その先の点まで ころがる強さにする。
      // はねると すこし おそくなるので、はねたあとの きょりは REFLECTOR.keep で わって 見つもる。
      const aimAtIndex = (index: number) => {
        let last = index
        let after = 0
        let keep = 1
        while (route[last]!.bank && last < route.length - 1) {
          keep *= REFLECTOR.keep * REFLECTOR.keep
          after += Math.hypot(route[last + 1]!.x - route[last]!.x, route[last + 1]!.z - route[last]!.z) / keep
          last++
        }
        return aimAt(route[index]!, after + (last === route.length - 1 ? 0.6 : 0.25), last)
      }
      // 1. 先の点のうち、見通せる いちばん先の点。途中の点はそこで止まる強さにする（点は次の点が見通せる所に置いてある）。
      for (let index = route.length - 1; index > segment; index--) {
        if (clearLine(p, route[index]!)) return aimAtIndex(index)
      }
      // 2. 次の点の向きを少しずつ ずらし、バンパーや いわ・とびらの よこを通す。
      //    近くで ふさがれているときは、大きく ずらさないと すきまへ入らないので、角度は広めまで ためす。
      const next = route[segment + 1]!
      const toward = Math.atan2(next.z - p.z, next.x - p.x)
      const reach = Math.hypot(next.x - p.x, next.z - p.z)
      for (const offset of [8, -8, 16, -16, 24, -24, 32, -32, 45, -45, 60, -60]) {
        const angle = toward + (offset * Math.PI) / 180
        const target = { x: p.x + Math.cos(angle) * reach, z: p.z + Math.sin(angle) * reach }
        if (clearLine(p, target)) return aimAt(target, 0.6, segment + 1)
      }
      // 3. ふうしゃの柱のかげなどでは、いまの区間の はじめの点（トンネルの入口など）へ戻る。
      //    ふさいでいるのが うごくカベなら、開くのを待てばよいので さがらない。
      const blocking = cast(p, { x: Math.cos(toward), z: Math.sin(toward) }, reach)
      const back = route[segment]!
      if (blocking?.kind !== 'gate' && Math.hypot(back.x - p.x, back.z - p.z) > 0.4 && clearLine(p, back)) return aimAt(back, 0.25, segment)
      return aimAt(next, 0.6, segment + 1)
    },
    dispose() {
      queue.free()
      world.free()
    },
  }
}

export type GolfWorld = ReturnType<typeof createGolfWorld>
