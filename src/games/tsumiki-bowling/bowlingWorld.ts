/**
 * Rapierの世界（レーン・積み木・玉）を組み立て、1投ぶんの操作を提供する。
 *
 * Three.jsにもDOMにも依存させていないので、vitestの中で実際に物理を回して
 * 「最大パワーですり抜けないか」「本当に積み木が崩れるか」を確認できる。
 * 見た目の生成は useTsumikiBowlingEngine 側の責務。
 */

import type { RigidBody, World } from '@dimforge/rapier3d-compat'
import {
  BLOCK_ANGULAR_DAMPING,
  BLOCK_CAN_SLEEP,
  BLOCK_DENSITY,
  BLOCK_FRICTION,
  BLOCK_LINEAR_DAMPING,
  BLOCK_RESTITUTION,
  GRAVITY_Y,
  LANE_FRICTION,
  LANE_RESTITUTION,
  LAUNCH_HEIGHT,
  LAUNCH_Z,
  MAX_ANGULAR_SPEED,
  MAX_BALL_SPEED,
  MAX_BLOCK_SPEED,
  OUT_OF_BOUNDS_Y,
  PHYSICS_TIMESTEP,
  RAIL_FRICTION,
  RAIL_RESTITUTION,
} from './bowlingPhysics'
import {
  BACK_WALL_HALF_HEIGHT,
  BACK_WALL_Z,
  getBowlingStage,
  laneBodyTransform,
  laneSurfaceY,
  laneTiltQuaternion,
  LANE_HALF_LENGTH,
  LANE_HALF_THICKNESS,
  LANE_HALF_WIDTH,
  RAIL_HALF_HEIGHT,
  RAIL_HALF_WIDTH,
  stageBlockPlacements,
  type BlockPlacement,
  type BowlingStage,
} from './bowlingStage'
import { getBowlingBall, type BowlingBallId, type BowlingBallSpec } from './bowlingBalls'
import { launchVelocity, pullOffset, type LaunchAim, type Vector3 } from './bowlingLaunch'
import type { BlockSample } from './bowlingTopple'
import type { MotionSample } from './bowlingSettle'

/** Hookとheadlessテストが同じRapierコンストラクタを共有するための最小インターフェース。 */
export type RapierModule = Pick<
  typeof import('@dimforge/rapier3d-compat'),
  'World' | 'RigidBodyDesc' | 'ColliderDesc'
>

export type BowlingBlockEntry = {
  body: RigidBody
  placement: BlockPlacement
  /** レーン外へ落ちて、シミュレーションから外したか。 */
  removed: boolean
}

export type BowlingWorld = {
  world: World
  stage: BowlingStage
  placements: BlockPlacement[]
  blocks: BowlingBlockEntry[]
  ball: RigidBody
  ballSpec: BowlingBallSpec
  /** 発射位置（スリングショットの支点）。 */
  anchor: Vector3
  /** 発射済みか。ねらっている間は重力を切って空中に固定している。 */
  launched: boolean
}

const ZERO: Vector3 = { x: 0, y: 0, z: 0 }

/**
 * ソルバの反復回数。既定(4)のままだと19個を積んだ塔がわずかに沈み込み、
 * 触っていないのにゆっくり歪んでいく。8にすると初期状態が安定する。
 */
const SOLVER_ITERATIONS = 8

export function createBowlingWorld(
  rapier: RapierModule,
  options: { stageId?: string; ballId?: BowlingBallId | string } = {},
): BowlingWorld {
  const world = new rapier.World({ x: 0, y: GRAVITY_Y, z: 0 })
  world.timestep = PHYSICS_TIMESTEP
  world.integrationParameters.numSolverIterations = SOLVER_ITERATIONS

  // ---- レーン本体 ----
  const lane = laneBodyTransform()
  world.createCollider(
    rapier.ColliderDesc.cuboid(LANE_HALF_WIDTH, LANE_HALF_THICKNESS, LANE_HALF_LENGTH)
      .setTranslation(lane.center.x, lane.center.y, lane.center.z)
      .setRotation(lane.rotation)
      .setFriction(LANE_FRICTION)
      .setRestitution(LANE_RESTITUTION),
  )

  // ---- 左右の縁と奥の壁 ----
  for (const side of [-1, 1]) {
    const x = side * (LANE_HALF_WIDTH - RAIL_HALF_WIDTH)
    world.createCollider(
      rapier.ColliderDesc.cuboid(RAIL_HALF_WIDTH, RAIL_HALF_HEIGHT, LANE_HALF_LENGTH)
        .setTranslation(x, laneSurfaceY(lane.center.z) + RAIL_HALF_HEIGHT, lane.center.z)
        .setRotation(laneTiltQuaternion())
        .setFriction(RAIL_FRICTION)
        .setRestitution(RAIL_RESTITUTION),
    )
  }
  world.createCollider(
    rapier.ColliderDesc.cuboid(LANE_HALF_WIDTH, BACK_WALL_HALF_HEIGHT, 0.25)
      .setTranslation(0, laneSurfaceY(BACK_WALL_Z) + BACK_WALL_HALF_HEIGHT, BACK_WALL_Z)
      .setRotation(laneTiltQuaternion())
      .setFriction(RAIL_FRICTION)
      .setRestitution(RAIL_RESTITUTION),
  )

  // ---- 積み木 ----
  const stage = getBowlingStage(options.stageId)
  const placements = stageBlockPlacements(stage)
  const blocks: BowlingBlockEntry[] = placements.map((placement) => {
    const body = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(placement.position.x, placement.position.y, placement.position.z)
        .setRotation(placement.rotation)
        .setLinearDamping(BLOCK_LINEAR_DAMPING)
        .setAngularDamping(BLOCK_ANGULAR_DAMPING)
        // 吹き飛んだ積み木がレーンや壁を1ステップで飛び越えないようにする。
        .setCcdEnabled(true)
        // 崩れ切ったあとに細かく震え続けないよう、静止したらsleepさせる。
        .setCanSleep(BLOCK_CAN_SLEEP),
    )
    world.createCollider(
      rapier.ColliderDesc.cuboid(
        placement.size[0] / 2,
        placement.size[1] / 2,
        placement.size[2] / 2,
      )
        .setDensity(BLOCK_DENSITY)
        .setFriction(BLOCK_FRICTION)
        .setRestitution(BLOCK_RESTITUTION),
      body,
    )
    return { body, placement, removed: false }
  })

  // ---- 玉 ----
  const ballSpec = getBowlingBall(options.ballId)
  const anchor: Vector3 = {
    x: 0,
    y: laneSurfaceY(LAUNCH_Z) + LAUNCH_HEIGHT,
    z: LAUNCH_Z,
  }
  const ball = world.createRigidBody(
    rapier.RigidBodyDesc.dynamic()
      .setTranslation(anchor.x, anchor.y, anchor.z)
      .setLinearDamping(ballSpec.linearDamping)
      .setAngularDamping(ballSpec.angularDamping)
      // 高速時のすり抜け対策の主役。速度が上がってもここは切らない。
      .setCcdEnabled(true)
      // 連続CCDだけだと積み木の角をかすめたときに貫通が残るため、
      // 予測ベースのsoft CCDも半径2個ぶんで併用する。
      .setSoftCcdPrediction(ballSpec.radius * 2)
      // 判定を続けたいので寝かせない。
      .setCanSleep(false)
      // ねらっている間は重力を切り、発射の瞬間に戻す。
      .setGravityScale(0),
  )
  world.createCollider(
    rapier.ColliderDesc.ball(ballSpec.radius)
      .setDensity(ballSpec.density)
      .setFriction(ballSpec.friction)
      .setRestitution(ballSpec.restitution),
    ball,
  )

  const bowling: BowlingWorld = {
    world,
    stage,
    placements,
    blocks,
    ball,
    ballSpec,
    anchor,
    launched: false,
  }
  parkBall(bowling, null)
  return bowling
}

/**
 * 玉を発射位置へ固定する。ドラッグ中は引いた向きの逆へずらして、
 * スリングショットを引いている見た目にする。
 */
export function parkBall(bowling: BowlingWorld, aim: LaunchAim | null): void {
  const offset = aim && aim.active ? pullOffset(aim) : ZERO
  bowling.launched = false
  bowling.ball.setGravityScale(0, true)
  bowling.ball.setLinvel(ZERO, true)
  bowling.ball.setAngvel(ZERO, true)
  bowling.ball.setTranslation(
    {
      x: bowling.anchor.x + offset.x,
      y: bowling.anchor.y + offset.y,
      z: bowling.anchor.z + offset.z,
    },
    true,
  )
  bowling.ball.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
  bowling.ball.resetForces(true)
  bowling.ball.resetTorques(true)
}

/**
 * 発射する。重力を戻し、速度と転がりの回転を一度に与える。
 * 転がりぶんの角速度を最初から入れておくと、着地の瞬間に
 * 摩擦で回転を作るための減速が起きず、勢いが落ちて見えない。
 */
export function launchBall(bowling: BowlingWorld, aim: LaunchAim): Vector3 | null {
  if (!aim.active || bowling.launched) return null
  const velocity = launchVelocity(aim, bowling.ballSpec)
  bowling.ball.setGravityScale(1, true)
  bowling.ball.setLinvel(velocity, true)
  bowling.ball.setAngvel(
    {
      x: velocity.z / bowling.ballSpec.radius,
      y: 0,
      z: -velocity.x / bowling.ballSpec.radius,
    },
    true,
  )
  bowling.launched = true
  return velocity
}

/**
 * 次の投球のために積み木を組み直し、玉を発射位置へ戻す。
 *
 * Bodyを作り直さず、位置・姿勢・速度・力をすべて初期値へ書き戻す。
 * 「もういちど」でも同じ関数を使うので、前の投球の物理状態は残らない。
 */
export function resetForNextThrow(bowling: BowlingWorld): void {
  for (const block of bowling.blocks) {
    if (block.removed) {
      block.body.setEnabled(true)
      block.removed = false
    }
    block.body.setTranslation(block.placement.position, true)
    block.body.setRotation(block.placement.rotation, true)
    block.body.setLinvel(ZERO, true)
    block.body.setAngvel(ZERO, true)
    block.body.resetForces(true)
    block.body.resetTorques(true)
  }
  parkBall(bowling, null)
}

/** 倒れ判定へ渡す、いまの積み木の姿勢。 */
export function readBlockSamples(bowling: BowlingWorld): BlockSample[] {
  return bowling.blocks.map((block) => {
    const position = block.body.translation()
    const rotation = block.body.rotation()
    return {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
    }
  })
}

function speedsOf(body: RigidBody): MotionSample {
  const linear = body.linvel()
  const angular = body.angvel()
  return {
    linearSpeed: Math.hypot(linear.x, linear.y, linear.z),
    angularSpeed: Math.hypot(angular.x, angular.y, angular.z),
  }
}

/**
 * 「1投が終わったか」の判定へ渡す速度。
 * レーン外へ落ちて取り除いたものは、永久に落下し続けるので含めない。
 */
export function readSettleSamples(bowling: BowlingWorld): MotionSample[] {
  const samples: MotionSample[] = []
  if (bowling.launched && !ballOutOfPlay(bowling)) samples.push(speedsOf(bowling.ball))
  for (const block of bowling.blocks) {
    if (block.removed) continue
    samples.push(speedsOf(block.body))
  }
  return samples
}

/** 玉が場外（レーンの下）へ落ちたか。 */
export function ballOutOfPlay(bowling: BowlingWorld): boolean {
  return bowling.ball.translation().y < OUT_OF_BOUNDS_Y
}

/**
 * 場外まで落ちた玉を止める。
 *
 * そのままにすると落下し続け、速度上限に張り付いたまま延々と計算が続く。
 * 位置は残すので、見た目側は「画面外にある」ものとして扱えばよい。
 */
export function parkFallenBall(bowling: BowlingWorld): void {
  if (!bowling.launched || !ballOutOfPlay(bowling)) return
  bowling.ball.setLinvel(ZERO, true)
  bowling.ball.setAngvel(ZERO, true)
  bowling.ball.setGravityScale(0, true)
}

/**
 * レーン外まで落ちた積み木をシミュレーションから外す。
 * 落ち続ける物体が残っていると「落ち着いた」の判定が永久に成立しない。
 */
export function removeFallenBlocks(bowling: BowlingWorld): void {
  for (const block of bowling.blocks) {
    if (block.removed) continue
    if (block.body.translation().y >= OUT_OF_BOUNDS_Y) continue
    block.body.setEnabled(false)
    block.removed = true
  }
}

function clampBody(body: RigidBody, maxSpeed: number): void {
  const linear = body.linvel()
  const speed = Math.hypot(linear.x, linear.y, linear.z)
  if (!Number.isFinite(speed)) {
    body.setLinvel(ZERO, true)
  } else if (speed > maxSpeed) {
    const scale = maxSpeed / speed
    body.setLinvel(
      { x: linear.x * scale, y: linear.y * scale, z: linear.z * scale },
      true,
    )
  }
  const angular = body.angvel()
  const spin = Math.hypot(angular.x, angular.y, angular.z)
  if (!Number.isFinite(spin)) {
    body.setAngvel(ZERO, true)
  } else if (spin > MAX_ANGULAR_SPEED) {
    const scale = MAX_ANGULAR_SPEED / spin
    body.setAngvel(
      { x: angular.x * scale, y: angular.y * scale, z: angular.z * scale },
      true,
    )
  }
}

/** 数値の暴走を止める安全弁。速度を「遅くするための調整」には使わない。 */
export function clampBowlingMotion(bowling: BowlingWorld): void {
  clampBody(bowling.ball, MAX_BALL_SPEED)
  for (const block of bowling.blocks) {
    if (block.removed) continue
    clampBody(block.body, MAX_BLOCK_SPEED)
  }
}

/** 玉のいまの位置と速度。演出（衝撃・カメラの揺れ）の判断に使う。 */
export function readBall(bowling: BowlingWorld): {
  position: Vector3
  velocity: Vector3
  speed: number
} {
  const position = bowling.ball.translation()
  const velocity = bowling.ball.linvel()
  return {
    position: { x: position.x, y: position.y, z: position.z },
    velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
    speed: Math.hypot(velocity.x, velocity.y, velocity.z),
  }
}
