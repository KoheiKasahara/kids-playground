import type { RigidBody, World } from '@dimforge/rapier3d-compat'
import {
  DOMINO_DEPTH,
  DOMINO_HEIGHT,
  createDominoPlacements,
  type DominoPlacement,
} from './dominoLayout'
import {
  ANGULAR_DAMPING,
  DOMINO_DENSITY,
  DOMINO_FRICTION,
  DOMINO_RESTITUTION,
  GRAVITY_Y,
  GROUND_FRICTION,
  GROUND_SIZE,
  GROUND_THICKNESS,
  IMPULSE_POINT_Y,
  LINEAR_DAMPING,
  PHYSICS_TIMESTEP,
  SHEPHERD_IMPULSE_Z,
  START_IMPULSE_Z,
} from './dominoPhysics'
import {
  BALL_FRICTION,
  BALL_MASS,
  BALL_RADIUS,
  BALL_RAIL_FRICTION,
  BALL_RAIL_THICKNESS,
  BALL_RAIL_WALL_HEIGHT,
  BALL_RAIL_WALL_THICKNESS,
  BALL_RAIL_WIDTH,
  BALL_RESTITUTION,
  getBallRailPieces,
  type DominoBallSection,
} from './dominoBall'
import { getStairPlatforms } from './dominoStairs'
import {
  SEESAW_PLANK_FRICTION,
  SEESAW_PLANK_HALF_LENGTH,
  SEESAW_PLANK_THICKNESS,
  SEESAW_PLANK_WIDTH,
  seesawPlankRotation,
  type DominoSeesawSection,
} from './dominoSeesaw'

/** Hookとheadlessテストが同じRapierコンストラクタを使うための最小インターフェース。 */
export type RapierModule = Pick<
  typeof import('@dimforge/rapier3d-compat'),
  'World' | 'RigidBodyDesc' | 'ColliderDesc'
>

export type DominoBodyEntry = {
  placement: DominoPlacement
  body: RigidBody
  chainIndex: number
}

export type DominoBallBodyEntry = {
  body: RigidBody
  section: DominoBallSection
}

export type DominoSeesawBodyEntry = {
  /** kinematicPositionBased。角度はuseDominoEngineがsetNextKinematicRotationで毎ステップ更新する。 */
  body: RigidBody
  section: DominoSeesawSection
}

export type DominoWorld = {
  world: World
  placements: DominoPlacement[]
  bodies: DominoBodyEntry[]
  bodiesById: Map<string, DominoBodyEntry>
  /** normalではnull。ロングにだけ動的Sphereを1個作る(既存Phase 6のボール)。 */
  ball: DominoBallBodyEntry | null
  /** 2つ目の坂からシーソーへ球を運ぶ、ロング専用の2個目のボール。 */
  secondBall: DominoBallBodyEntry | null
  /** シーソー/レバー本体。ロング以外はnull。 */
  seesaw: DominoSeesawBodyEntry | null
}

function getChainIndex(placement: DominoPlacement): number {
  return placement.chainIndex
}

/**
 * ボールとレール(床・左右ガイド壁)をまとめて作る。既存Phase 6と、今回追加した
 * シーソー行きの2個目のボールの両方から呼べるよう、区間定義だけを受け取る形にした。
 */
function createBallSectionBody(
  world: World,
  rapier: RapierModule,
  section: DominoBallSection,
): RigidBody {
  const ballBody = world.createRigidBody(
    rapier.RigidBodyDesc.dynamic()
      .setTranslation(section.start.x, section.start.y, section.start.z)
      .setLinearDamping(0.025)
      .setAngularDamping(0.02)
      .setCcdEnabled(true)
      .setCanSleep(true)
      .setSleeping(true),
  )
  world.createCollider(
    rapier.ColliderDesc.ball(BALL_RADIUS)
      .setMass(BALL_MASS)
      .setFriction(BALL_FRICTION)
      .setRestitution(BALL_RESTITUTION),
    ballBody,
  )

  for (const piece of getBallRailPieces(section)) {
    const halfYaw = piece.yaw / 2
    const halfPitch = piece.pitch / 2
    // Yaw * pitch。ローカル+Zが坂の下り方向を向く回転。
    const rotation = {
      x: Math.cos(halfYaw) * Math.sin(halfPitch),
      y: Math.sin(halfYaw) * Math.cos(halfPitch),
      z: -Math.sin(halfYaw) * Math.sin(halfPitch),
      w: Math.cos(halfYaw) * Math.cos(halfPitch),
    }
    world.createCollider(
      rapier.ColliderDesc.cuboid(
        BALL_RAIL_WIDTH / 2,
        BALL_RAIL_THICKNESS / 2,
        piece.length / 2 + 0.07,
      )
        .setTranslation(piece.center.x, piece.center.y - BALL_RAIL_THICKNESS / 2, piece.center.z)
        .setRotation(rotation)
        .setFriction(BALL_RAIL_FRICTION)
        .setRestitution(BALL_RESTITUTION),
    )

    // 低い左右ガイドは見た目にもそのまま表示する。球を閉じ込める透明Colliderは使わない。
    const sideX = Math.cos(piece.yaw) * (BALL_RAIL_WIDTH / 2 - BALL_RAIL_WALL_THICKNESS / 2)
    const sideZ = -Math.sin(piece.yaw) * (BALL_RAIL_WIDTH / 2 - BALL_RAIL_WALL_THICKNESS / 2)
    const wallRotation = {
      x: 0,
      y: Math.sin(halfYaw),
      z: 0,
      w: Math.cos(halfYaw),
    }
    for (const side of [-1, 1] as const) {
      world.createCollider(
        rapier.ColliderDesc.cuboid(
          BALL_RAIL_WALL_THICKNESS / 2,
          BALL_RAIL_WALL_HEIGHT / 2,
          piece.length / 2 + 0.07,
        )
          .setTranslation(
            piece.center.x + side * sideX,
            piece.surfaceY + BALL_RAIL_WALL_HEIGHT / 2,
            piece.center.z + side * sideZ,
          )
          .setRotation(wallRotation)
          .setFriction(BALL_RAIL_FRICTION)
          .setRestitution(BALL_RESTITUTION),
      )
    }
  }
  return ballBody
}

/** 寸法・密度・摩擦を一か所で適用し、地面と173個の動的ドミノを作る。 */
export function createDominoWorld(
  rapier: RapierModule,
  placements: DominoPlacement[] = createDominoPlacements(),
  options: {
    groundSize?: number
    ballSection?: DominoBallSection | null
    secondBallSection?: DominoBallSection | null
    seesawSection?: DominoSeesawSection | null
    solverIterations?: number | null
  } = {},
): DominoWorld {
  const world = new rapier.World({ x: 0, y: GRAVITY_Y, z: 0 })
  world.timestep = PHYSICS_TIMESTEP
  if (options.solverIterations !== undefined && options.solverIterations !== null) {
    // 1,600個が同時にawakeになるビッグだけ反復回数を2へ下げると、実測で物理コストが約3割減り、
    // 倒れ切る割合は100%を維持した。未指定時は既存モードのRapier既定値を変更しない。
    world.integrationParameters.numSolverIterations = options.solverIterations
  }
  const groundSize = options.groundSize ?? GROUND_SIZE

  // 親RigidBodyを持たないColliderは固定物として扱われるため、剛体数を173に保てる。
  world.createCollider(
    rapier.ColliderDesc.cuboid(
      groundSize / 2,
      GROUND_THICKNESS / 2,
      groundSize / 2,
    )
      .setTranslation(0, -GROUND_THICKNESS / 2, 0)
      .setFriction(GROUND_FRICTION)
      .setRestitution(DOMINO_RESTITUTION),
  )

  const bodies: DominoBodyEntry[] = []
  const bodiesById = new Map<string, DominoBodyEntry>()
  for (const placement of placements) {
    const yaw = placement.yaw ?? 0
    const baseY = placement.baseY ?? 0
    const body = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(placement.x, baseY + DOMINO_HEIGHT / 2, placement.z)
        .setRotation({
          x: 0,
          y: Math.sin(yaw / 2),
          z: 0,
          w: Math.cos(yaw / 2),
        })
        .setLinearDamping(LINEAR_DAMPING)
        .setAngularDamping(ANGULAR_DAMPING)
        .setCanSleep(true)
        .setSleeping(true),
    )
    world.createCollider(
      rapier.ColliderDesc.cuboid(
        placement.width / 2,
        DOMINO_HEIGHT / 2,
        DOMINO_DEPTH / 2,
      )
        .setDensity(DOMINO_DENSITY)
        .setFriction(DOMINO_FRICTION)
        .setRestitution(DOMINO_RESTITUTION),
      body,
    )
    const entry: DominoBodyEntry = {
      placement,
      body,
      chainIndex: getChainIndex(placement),
    }
    bodies.push(entry)
    bodiesById.set(placement.id, entry)
  }

  // ボール区間トリガーへ登る階段。台は固定物として、地面から各段の高さまで支える。
  for (const platform of getStairPlatforms(placements)) {
    world.createCollider(
      rapier.ColliderDesc.cuboid(platform.width / 2, platform.height / 2, platform.depth / 2)
        .setTranslation(platform.center.x, platform.center.y, platform.center.z)
        .setRotation({
          x: 0,
          y: Math.sin(platform.yaw / 2),
          z: 0,
          w: Math.cos(platform.yaw / 2),
        })
        .setFriction(GROUND_FRICTION)
        .setRestitution(DOMINO_RESTITUTION),
    )
  }

  let ball: DominoBallBodyEntry | null = null
  if (options.ballSection !== null && options.ballSection !== undefined) {
    const section = options.ballSection
    ball = { body: createBallSectionBody(world, rapier, section), section }
  }

  let secondBall: DominoBallBodyEntry | null = null
  if (options.secondBallSection !== null && options.secondBallSection !== undefined) {
    const section = options.secondBallSection
    secondBall = { body: createBallSectionBody(world, rapier, section), section }
  }

  let seesaw: DominoSeesawBodyEntry | null = null
  if (options.seesawSection !== null && options.seesawSection !== undefined) {
    const section = options.seesawSection
    const seesawBody = world.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(section.pivot.x, section.pivot.y, section.pivot.z)
        .setRotation(seesawPlankRotation(section.yaw, 0)),
    )
    world.createCollider(
      rapier.ColliderDesc.cuboid(
        SEESAW_PLANK_WIDTH / 2,
        SEESAW_PLANK_THICKNESS / 2,
        SEESAW_PLANK_HALF_LENGTH,
      )
        .setFriction(SEESAW_PLANK_FRICTION)
        .setRestitution(DOMINO_RESTITUTION),
      seesawBody,
    )
    seesaw = { body: seesawBody, section }
  }

  return { world, placements, bodies, bodiesById, ball, secondBall, seesaw }
}

type QuaternionLike = { x: number; y: number; z: number; w: number }
type VectorLike = { x: number; y: number; z: number }

function rotateLocalVector(rotation: QuaternionLike, vector: VectorLike): VectorLike {
  const { x, y, z, w } = rotation
  return {
    x:
      (1 - 2 * (y * y + z * z)) * vector.x +
      2 * (x * y - z * w) * vector.y +
      2 * (x * z + y * w) * vector.z,
    y:
      2 * (x * y + z * w) * vector.x +
      (1 - 2 * (x * x + z * z)) * vector.y +
      2 * (y * z - x * w) * vector.z,
    z:
      2 * (x * z - y * w) * vector.x +
      2 * (y * z + x * w) * vector.y +
      (1 - 2 * (x * x + y * y)) * vector.z,
  }
}

function pointNearTop(body: RigidBody): VectorLike {
  const translation = body.translation()
  const rotatedTop = rotateLocalVector(body.rotation(), {
    x: 0,
    y: IMPULSE_POINT_Y,
    z: 0,
  })
  return {
    x: translation.x + rotatedTop.x,
    y: translation.y + rotatedTop.y,
    z: translation.z + rotatedTop.z,
  }
}

/** 最初のドミノの上端を、配置が示す連鎖方向へ押す共通処理。 */
export function applyStartImpulse(body: RigidBody, chainYaw = 0): void {
  body.applyImpulseAtPoint(
    {
      x: Math.sin(chainYaw) * START_IMPULSE_Z,
      y: 0,
      z: Math.cos(chainYaw) * START_IMPULSE_Z,
    },
    pointNearTop(body),
    true,
  )
  body.wakeUp()
}

/** shepherdの倍率だけを受け取り、物理的な基準値はこのファイルの定数から使う。 */
export function applyShepherdImpulse(
  body: RigidBody,
  strength: number,
  chainYaw = 0,
): void {
  body.applyImpulseAtPoint(
    {
      x: Math.sin(chainYaw) * SHEPHERD_IMPULSE_Z * strength,
      y: 0,
      z: Math.cos(chainYaw) * SHEPHERD_IMPULSE_Z * strength,
    },
    pointNearTop(body),
    true,
  )
  body.wakeUp()
}

/** Rapierの姿勢からローカルY軸が直立方向から何ラジアン傾いたかを返す。 */
export function tiltOf(body: RigidBody): number {
  return Math.acos(Math.max(-1, Math.min(1, upYOf(body))))
}

function upYOf(body: RigidBody): number {
  const { x, z } = body.rotation()
  return 1 - 2 * (x * x + z * z)
}

/**
 * tiltOfと同じ判定を、acosを使わずに行う。音・カメラなどの頻繁な比較では
 * クォータニオンから直接求めた上向きベクトルのY成分だけを使い、1,600個分の計算量を抑える。
 */
export function isTiltAtLeast(body: RigidBody, radians: number): boolean {
  if (!Number.isFinite(radians)) return false
  if (radians <= 0) return true
  if (radians > Math.PI) return false
  return upYOf(body) <= Math.cos(radians)
}

/** 国旗面が貼られたローカル-Z軸をワールドへ変換したY成分を返す。 */
export function flagFaceUpY(body: RigidBody): number {
  const face = rotateLocalVector(body.rotation(), { x: 0, y: 0, z: -1 })
  return face.y
}
