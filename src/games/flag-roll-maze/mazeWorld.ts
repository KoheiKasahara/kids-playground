import type { RigidBody, World } from '@dimforge/rapier3d-compat'
import {
  BALL_ANGULAR_DAMPING,
  BALL_FRICTION,
  BALL_LINEAR_DAMPING,
  BALL_MASS,
  BALL_RADIUS,
  BALL_RESTITUTION,
  clampSpeed,
  FLOOR_FRICTION,
  FLOOR_THICKNESS,
  GOAL_RADIUS,
  gravityFromTilt,
  MAX_BALL_SPEED,
  PHYSICS_TIMESTEP,
  WALL_FRICTION,
  WALL_HEIGHT,
  WALL_RESTITUTION,
  type PhysicsVector,
} from './mazePhysics'
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
}

/** ボールは盤面の少し上から置き、初期フレームで床へめり込まないようにする。 */
export function ballSpawnPosition(start: MazePoint): PhysicsVector {
  return { x: start.x, y: BALL_RADIUS + 0.02, z: start.z }
}

/**
 * 床・壁・ボールだけの単純な世界を作る。
 * 盤面は動かさず、重力の向きだけで転がすので、床と壁はすべて固定コライダーにする。
 */
export function createMazeWorld(rapier: RapierModule, stage: MazeStage): MazeWorld {
  // 初期重力は真下。最初のフレームで入力から上書きされる。
  const world = new rapier.World({ x: 0, y: -1, z: 0 })
  world.timestep = PHYSICS_TIMESTEP

  // 親RigidBodyを持たないColliderは固定物になるため、動的な剛体はボール1個だけになる。
  world.createCollider(
    rapier.ColliderDesc.cuboid(
      stage.boardWidth / 2,
      FLOOR_THICKNESS / 2,
      stage.boardDepth / 2,
    )
      .setTranslation(0, -FLOOR_THICKNESS / 2, 0)
      .setFriction(FLOOR_FRICTION)
      .setRestitution(WALL_RESTITUTION),
  )

  for (const wall of stage.walls) {
    world.createCollider(
      rapier.ColliderDesc.cuboid(wall.width / 2, WALL_HEIGHT / 2, wall.depth / 2)
        .setTranslation(wall.x, WALL_HEIGHT / 2, wall.z)
        .setFriction(WALL_FRICTION)
        .setRestitution(WALL_RESTITUTION),
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

  return { world, ball, stage }
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

/** ボールをスタートへ戻し、勢いも完全に消す。リトライと場外復帰の両方で使う。 */
export function resetBall(ball: RigidBody, start: MazePoint): void {
  const spawn = ballSpawnPosition(start)
  ball.setTranslation(spawn, true)
  ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
  ball.setAngvel({ x: 0, y: 0, z: 0 }, true)
  ball.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
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
