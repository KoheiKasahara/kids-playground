import type { DominoFlagId } from './flagDefinitions'
import {
  DOMINO_WIDTH,
  LINE_COUNT,
  LINE_PITCH_Z,
  createDominoPlacements,
  getLayoutBounds,
  type DominoPlacement,
} from './dominoLayout'
import { HARD_TIMEOUT_MS, LONG_HARD_TIMEOUT_MS } from './dominoCompletion'
import { GROUND_SIZE } from './dominoPhysics'

export type DominoCourseType = 'normal' | 'long'

export type DominoCourse = {
  type: DominoCourseType
  placements: DominoPlacement[]
  /** 最初に押すドミノのid。normalはline-0、longは道中の先頭。 */
  startId: string
  /** 地面コライダーと表示平面の一辺。 */
  groundSize: number
  /** 完成判定のハードタイムアウト。 */
  hardTimeoutMs: number
  /** 国旗カメラの構図に使う通常コース部分の境界。 */
  flagCameraBounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  /** ロング道中のドミノ数。Task Bの進行度計算で使う。 */
  approachCount: number
  /** 道中と共有直線を含む、カメラ進行度の対象ドミノ数。 */
  cameraProgressCount: number
  /** ロング道中の中心線。Task Bのカメラレール生成で使う。 */
  approachPath: readonly { x: number; z: number; yaw: number }[]
}

type ApproachSegment =
  | { kind: 'straight'; count: number }
  | { kind: 'arc'; count: number; turnDeg: number }

/**
 * 道中は短い直線、S字、左右の大きな折り返しを順につなぐ。
 * 1枚ごとの旋回を15度以下に抑え、連鎖が次の区間へ自然に進む形にする。
 */
const APPROACH_SEGMENTS: readonly ApproachSegment[] = [
  { kind: 'straight', count: 2 },
  { kind: 'arc', count: 6, turnDeg: -45 },
  { kind: 'arc', count: 6, turnDeg: 45 },
  { kind: 'straight', count: 2 },
  { kind: 'arc', count: 12, turnDeg: 180 },
  { kind: 'straight', count: 2 },
  { kind: 'arc', count: 12, turnDeg: -180 },
  { kind: 'straight', count: 2 },
]

const APPROACH_COUNT = APPROACH_SEGMENTS.reduce(
  (total, segment) => total + segment.count,
  0,
)
/** 0.7では2枚先の中心間隔が1.4になり、自己干渉の下限1.6を満たせないための安全余白。 */
const APPROACH_PITCH = LINE_PITCH_Z + 0.12
// 広い俯瞰カメラでも道中側の地面の切れ目が画面に入らないよう、144まで余裕を持たせる。
const LONG_GROUND_SIZE = 144

type PathPoint = { x: number; z: number; yaw: number }

/** セグメント列を、原点から歩くローカル中心線へ展開する。 */
function createLocalApproachPath(): PathPoint[] {
  const path: PathPoint[] = []
  const cursor = { x: 0, z: 0 }
  let yaw = 0

  const addPathPoint = () => {
    path.push({ x: cursor.x, z: cursor.z, yaw })
    cursor.x += APPROACH_PITCH * Math.sin(yaw)
    cursor.z += APPROACH_PITCH * Math.cos(yaw)
  }

  for (const segment of APPROACH_SEGMENTS) {
    if (segment.kind === 'straight') {
      for (let index = 0; index < segment.count; index += 1) {
        addPathPoint()
      }
      continue
    }

    const turnStep = (segment.turnDeg * Math.PI) / 180 / segment.count
    for (let index = 0; index < segment.count; index += 1) {
      yaw += turnStep
      addPathPoint()
    }
  }

  if (path.length !== APPROACH_COUNT) {
    throw new Error('ロング道中のセグメント数と経路点数が一致しません')
  }
  return path
}

/** 終端の姿勢と位置を固定し、ローカル中心線をワールドへ剛体変換する。 */
function createApproachPath(lineZero: DominoPlacement): PathPoint[] {
  const localPath = createLocalApproachPath()
  const last = localPath.at(-1)
  if (!last) throw new Error('ロング道中の経路が空です')

  const target = {
    x: 0,
    z: lineZero.z - LINE_PITCH_Z,
    yaw: 0,
  }
  const rotation = target.yaw - last.yaw
  const sinRotation = Math.sin(rotation)
  const cosRotation = Math.cos(rotation)
  const rotatedLast = {
    x: last.x * cosRotation - last.z * sinRotation,
    z: last.x * sinRotation + last.z * cosRotation,
  }
  const translation = {
    x: target.x - rotatedLast.x,
    z: target.z - rotatedLast.z,
  }

  return localPath.map((point) => ({
    x:
      point.x * cosRotation - point.z * sinRotation + translation.x,
    z:
      point.x * sinRotation + point.z * cosRotation + translation.z,
    yaw: point.yaw + rotation,
  }))
}

function createApproachPlacements(lineZero: DominoPlacement): {
  placements: DominoPlacement[]
  path: readonly { x: number; z: number; yaw: number }[]
} {
  const path = createApproachPath(lineZero)
  const placements = path.map((point, index) => ({
    id: `approach-${index}`,
    kind: 'approach' as const,
    x: point.x,
    z: point.z,
    width: DOMINO_WIDTH,
    yaw: point.yaw,
    chainYaw: point.yaw,
    chainIndex: index,
  }))
  return { placements, path }
}

function createNormalCourse(flagId: DominoFlagId): DominoCourse {
  const placements = createDominoPlacements(flagId)
  return {
    type: 'normal',
    placements,
    startId: 'line-0',
    groundSize: GROUND_SIZE,
    hardTimeoutMs: HARD_TIMEOUT_MS,
    flagCameraBounds: getLayoutBounds(placements),
    approachCount: 0,
    cameraProgressCount: 0,
    approachPath: [],
  }
}

function createLongCourse(flagId: DominoFlagId): DominoCourse {
  const flagCoursePlacements = createDominoPlacements(flagId)
  const lineZero = flagCoursePlacements.find((placement) => placement.id === 'line-0')
  if (!lineZero) throw new Error('通常コースにline-0がありません')

  const approach = createApproachPlacements(lineZero)
  const approachCount = approach.placements.length
  const placements = [
    ...approach.placements,
    ...flagCoursePlacements.map((placement) => ({
      ...placement,
      chainIndex: placement.chainIndex + approachCount,
    })),
  ]

  return {
    type: 'long',
    placements,
    startId: 'approach-0',
    groundSize: LONG_GROUND_SIZE,
    hardTimeoutMs: LONG_HARD_TIMEOUT_MS,
    // 道中を含めないことで、通常コースの国旗画面の構図をそのまま保つ。
    flagCameraBounds: getLayoutBounds(flagCoursePlacements),
    approachCount,
    cameraProgressCount: approachCount + LINE_COUNT,
    approachPath: approach.path,
  }
}

export function createDominoCourse(
  type: DominoCourseType,
  flagId: DominoFlagId,
): DominoCourse {
  if (type === 'normal') return createNormalCourse(flagId)
  return createLongCourse(flagId)
}
