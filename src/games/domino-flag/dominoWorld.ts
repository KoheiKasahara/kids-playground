import type { RigidBody, World } from '@dimforge/rapier3d-compat'
import {
  DOMINO_DEPTH,
  DOMINO_HEIGHT,
  LINE_COUNT,
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
  TRIGGER_BAR_DENSITY,
  TRIGGER_BAR_FRICTION,
} from './dominoPhysics'

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

export type DominoWorld = {
  world: World
  placements: DominoPlacement[]
  bodies: DominoBodyEntry[]
  bodiesById: Map<string, DominoBodyEntry>
}

function getChainIndex(placement: DominoPlacement): number {
  if (placement.kind === 'line') return Number(placement.id.slice('line-'.length))
  if (placement.kind === 'trigger') return LINE_COUNT
  return LINE_COUNT + 1 + (placement.row ?? 0)
}

/** 寸法・密度・摩擦を一か所で適用し、地面と173個の動的ドミノを作る。 */
export function createDominoWorld(
  rapier: RapierModule,
  placements: DominoPlacement[] = createDominoPlacements(),
): DominoWorld {
  const world = new rapier.World({ x: 0, y: GRAVITY_Y, z: 0 })
  world.timestep = PHYSICS_TIMESTEP

  // 親RigidBodyを持たないColliderは固定物として扱われるため、剛体数を173に保てる。
  world.createCollider(
    rapier.ColliderDesc.cuboid(
      GROUND_SIZE / 2,
      GROUND_THICKNESS / 2,
      GROUND_SIZE / 2,
    )
      .setTranslation(0, -GROUND_THICKNESS / 2, 0)
      .setFriction(GROUND_FRICTION)
      .setRestitution(DOMINO_RESTITUTION),
  )

  const bodies: DominoBodyEntry[] = []
  const bodiesById = new Map<string, DominoBodyEntry>()
  for (const placement of placements) {
    const body = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(placement.x, DOMINO_HEIGHT / 2, placement.z)
        .setLinearDamping(LINEAR_DAMPING)
        .setAngularDamping(ANGULAR_DAMPING)
        .setCanSleep(true)
        .setSleeping(true),
    )
    const density = placement.kind === 'trigger' ? TRIGGER_BAR_DENSITY : DOMINO_DENSITY
    world.createCollider(
      rapier.ColliderDesc.cuboid(
        placement.width / 2,
        DOMINO_HEIGHT / 2,
        DOMINO_DEPTH / 2,
      )
        .setDensity(density)
        .setFriction(
          placement.kind === 'trigger' ? TRIGGER_BAR_FRICTION : DOMINO_FRICTION,
        )
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

  return { world, placements, bodies, bodiesById }
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

/** 最初のドミノの上端を+Zへ押す共通処理。 */
export function applyStartImpulse(body: RigidBody): void {
  body.applyImpulseAtPoint({ x: 0, y: 0, z: START_IMPULSE_Z }, pointNearTop(body), true)
  body.wakeUp()
}

/** shepherdの倍率だけを受け取り、物理的な基準値はこのファイルの定数から使う。 */
export function applyShepherdImpulse(body: RigidBody, strength: number): void {
  body.applyImpulseAtPoint(
    { x: 0, y: 0, z: SHEPHERD_IMPULSE_Z * strength },
    pointNearTop(body),
    true,
  )
  body.wakeUp()
}

/** Rapierの姿勢からローカルY軸が直立方向から何ラジアン傾いたかを返す。 */
export function tiltOf(body: RigidBody): number {
  const up = rotateLocalVector(body.rotation(), { x: 0, y: 1, z: 0 })
  return Math.acos(Math.max(-1, Math.min(1, up.y)))
}

/** 国旗面が貼られたローカル-Z軸をワールドへ変換したY成分を返す。 */
export function flagFaceUpY(body: RigidBody): number {
  const face = rotateLocalVector(body.rotation(), { x: 0, y: 0, z: -1 })
  return face.y
}
