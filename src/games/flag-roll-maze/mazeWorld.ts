import type { RigidBody, World } from '@dimforge/rapier3d-compat'
import {
  BALL_ANGULAR_DAMPING,
  BALL_FRICTION,
  BALL_LINEAR_DAMPING,
  BALL_MASS,
  BALL_RADIUS,
  BALL_RESTITUTION,
  BALL_SPAWN_CLEARANCE_IN_RADII,
  BUMPER_FRICTION,
  BUMPER_HEIGHT,
  BUMPER_RESTITUTION,
  clampSpeed,
  FLOOR_FRICTION,
  FLOOR_THICKNESS,
  GOAL_RADIUS,
  gravityFromTilt,
  MAX_BALL_SPEED,
  PHYSICS_TIMESTEP,
  SPINNER_FRICTION,
  SPINNER_RESTITUTION,
  WALL_FRICTION,
  WALL_HEIGHT,
  WALL_RESTITUTION,
  type PhysicsVector,
} from './mazePhysics'
import {
  bumperKick,
  canKickBumper,
  markBumperKicked,
  spinnerAngleAt,
  type BumperCooldowns,
  type BumperGimmick,
  type SpinnerGimmick,
} from './mazeGimmicks'
import type { MazePoint, MazeStage } from './mazeStage'
import type { TiltInput } from './tiltInput'

/** Hookとheadlessテストが同じRapierコンストラクタを共有するための最小インターフェース。 */
export type RapierModule = Pick<
  typeof import('@dimforge/rapier3d-compat'),
  'World' | 'RigidBodyDesc' | 'ColliderDesc'
>

export type MazeWorld = {
  world: World
  ball: RigidBody
  stage: MazeStage
  /** 回転棒のkinematic body。配列順をギミック配列と揃え、描画側が対応付けやすくする。 */
  spinners: { gimmick: SpinnerGimmick; body: RigidBody }[]
}

/** ボールは盤面の少し上から置き、初期フレームで床へめり込まないようにする。 */
export function ballSpawnPosition(start: MazePoint): PhysicsVector {
  return { x: start.x, y: BALL_RADIUS * (1 + BALL_SPAWN_CLEARANCE_IN_RADII), z: start.z }
}

/**
 * 床・壁・ギミック・ボールを同じRapier世界へ組み立てる。
 * 穴の位置だけ床を抜く必要があるため、床は盤面全体ではなく矩形ごとに分ける。
 */
export function createMazeWorld(rapier: RapierModule, stage: MazeStage): MazeWorld {
  // 初期重力は真下。最初のフレームで入力から上書きされる。
  const world = new rapier.World({ x: 0, y: -1, z: 0 })
  world.timestep = PHYSICS_TIMESTEP

  // 穴を含む大きな床を1枚置くと落下できなくなるため、穴を除いた矩形ごとに固定する。
  for (const floor of stage.floors) {
    world.createCollider(
      rapier.ColliderDesc.cuboid(
        floor.width / 2,
        FLOOR_THICKNESS / 2,
        floor.depth / 2,
      )
        .setTranslation(floor.x, -FLOOR_THICKNESS / 2, floor.z)
        .setFriction(FLOOR_FRICTION)
        .setRestitution(WALL_RESTITUTION),
    )
  }

  for (const wall of stage.walls) {
    world.createCollider(
      rapier.ColliderDesc.cuboid(wall.width / 2, WALL_HEIGHT / 2, wall.depth / 2)
        .setTranslation(wall.x, WALL_HEIGHT / 2, wall.z)
        .setFriction(WALL_FRICTION)
        .setRestitution(WALL_RESTITUTION),
    )
  }

  const spinners: MazeWorld['spinners'] = []
  for (const gimmick of stage.gimmicks.spinners) {
    const body = world.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(gimmick.center.x, gimmick.height / 2, gimmick.center.z)
        .setRotation(quaternionAroundY(gimmick.initialAngle)),
    )
    world.createCollider(
      rapier.ColliderDesc.cuboid(
        gimmick.length / 2,
        gimmick.height / 2,
        gimmick.thickness / 2,
      )
        .setFriction(SPINNER_FRICTION)
        .setRestitution(SPINNER_RESTITUTION),
      body,
    )
    spinners.push({ gimmick, body })
  }

  for (const bumper of stage.gimmicks.bumpers) {
    // 親RigidBodyを持たないColliderは固定物なので、バンパー用の剛体を増やさずに済む。
    world.createCollider(
      rapier.ColliderDesc.cylinder(BUMPER_HEIGHT / 2, bumper.radius)
        .setTranslation(bumper.center.x, BUMPER_HEIGHT / 2, bumper.center.z)
        .setFriction(BUMPER_FRICTION)
        .setRestitution(BUMPER_RESTITUTION),
    )
  }

  const spawn = ballSpawnPosition(stage.start)
  const ball = world.createRigidBody(
    rapier.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, spawn.y, spawn.z)
      .setLinearDamping(BALL_LINEAR_DAMPING)
      .setAngularDamping(BALL_ANGULAR_DAMPING)
      // 速い場面でも壁を通り抜けないよう連続衝突判定を有効にする。
      .setCcdEnabled(true)
      // 傾きを止めたまま眠らせると次の入力への反応が遅れるため、sleepさせない。
      .setCanSleep(false),
  )
  world.createCollider(
    rapier.ColliderDesc.ball(BALL_RADIUS)
      .setMass(BALL_MASS)
      .setFriction(BALL_FRICTION)
      .setRestitution(BALL_RESTITUTION),
    ball,
  )

  return { world, ball, stage, spinners }
}

/** Y軸まわりの回転だけを扱うため、Rapierの型に依存しないリテラルで作る。 */
function quaternionAroundY(angle: number): { x: number; y: number; z: number; w: number } {
  return {
    x: 0,
    y: Math.sin(angle / 2),
    z: 0,
    w: Math.cos(angle / 2),
  }
}

/**
 * 物理ステップ直前に、絶対時刻から決めた角度を回転棒へ渡す。
 * 前フレームの角度へ加算しないので、フレーム落ちがあっても回転のずれが蓄積しない。
 */
export function advanceSpinners(
  spinners: MazeWorld['spinners'],
  elapsedSeconds: number,
): void {
  for (const { gimmick, body } of spinners) {
    body.setNextKinematicRotation(
      quaternionAroundY(spinnerAngleAt(gimmick, elapsedSeconds)),
    )
  }
}

/**
 * バンパーへ触れたボールへ外向きの一定インパルスを加える。
 * コライダーの反発だけでは低速時の「ポン！」が弱いため、速度に依存しないキックを重ねる。
 */
export function applyBumperKicks(
  ball: RigidBody,
  bumpers: readonly BumperGimmick[],
  cooldowns: BumperCooldowns,
  nowMs: number,
): string[] {
  const kicked: string[] = []
  const position = ball.translation()

  for (const bumper of bumpers) {
    if (!canKickBumper(cooldowns, bumper.id, nowMs)) continue
    const kick = bumperKick(position, bumper)
    if (kick === null) continue

    ball.applyImpulse(kick, true)
    markBumperKicked(cooldowns, bumper.id, nowMs)
    kicked.push(bumper.id)
  }

  return kicked
}

/** 傾き入力を重力へ反映する。盤面コライダーは動かさない。 */
export function applyTiltToGravity(world: World, tilt: TiltInput): void {
  world.gravity = gravityFromTilt(tilt)
}

/** 速度上限を超えたら方向を保ったまま抑える。抑えたときだけ true。 */
export function limitBallSpeed(ball: RigidBody, maxSpeed = MAX_BALL_SPEED): boolean {
  const limited = clampSpeed(ball.linvel(), maxSpeed)
  if (limited === null) return false
  ball.setLinvel(limited, true)
  return true
}

/** ゴール中心との水平距離だけで判定する。高さは跳ねても判定を落とさないよう無視する。 */
export function isGoalReached(
  position: PhysicsVector,
  goal: MazePoint,
  radius = GOAL_RADIUS,
): boolean {
  return Math.hypot(position.x - goal.x, position.z - goal.z) <= radius
}

/** ゴールした合図の小さなジャンプ。水平の勢いは残さず、その場で軽く跳ねるだけにする。 */
export function popBallAtGoal(ball: RigidBody, strength = 2.6): void {
  const velocity = ball.linvel()
  ball.setLinvel(
    { x: velocity.x * 0.3, y: strength, z: velocity.z * 0.3 },
    true,
  )
}

/** ボールをスタートへ戻し、勢いも完全に消す。リトライと場外復帰の両方で使う。 */
export function resetBall(ball: RigidBody, start: MazePoint): void {
  const spawn = ballSpawnPosition(start)
  ball.setTranslation(spawn, true)
  ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
  ball.setAngvel({ x: 0, y: 0, z: 0 }, true)
  ball.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
}

/** 回転棒の中心から外向きへ押し出し、回され続ける状態から抜けさせる。 */
export function pushBallOutOfSpinner(
  ball: RigidBody,
  spinner: SpinnerGimmick,
  strength = 1.6,
): void {
  const position = ball.translation()
  const dx = position.x - spinner.center.x
  const dz = position.z - spinner.center.z
  const distance = Math.hypot(dx, dz)
  if (distance === 0) return

  ball.applyImpulse(
    {
      x: (dx / distance) * strength,
      y: 0,
      z: (dz / distance) * strength,
    },
    true,
  )
}

/**
 * 万一止まってしまったボールへ、傾けている方向にごく弱い力を加える。
 * 幼児が「動かない」まま諦めないための保険で、通常の転がりには影響しない大きさにする。
 */
export function nudgeBall(ball: RigidBody, tilt: TiltInput, strength = 0.12): void {
  const length = Math.hypot(tilt.x, tilt.y)
  if (length === 0) return
  ball.applyImpulse(
    {
      x: (tilt.x / length) * strength,
      y: 0,
      z: (tilt.y / length) * strength,
    },
    true,
  )
}
