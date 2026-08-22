import type { DominoFlagId } from './flagDefinitions'
import {
  BIG_FLAG_LAYOUT,
  DOMINO_WIDTH,
  LINE_COUNT,
  LINE_PITCH_Z,
  NORMAL_FLAG_LAYOUT,
  createDominoPlacements,
  getLayoutBounds,
  type FlagLayoutSpec,
  type DominoPlacement,
} from './dominoLayout'
import {
  BIG_HARD_TIMEOUT_MS,
  HARD_TIMEOUT_MS,
  LONG_HARD_TIMEOUT_MS,
} from './dominoCompletion'
import { GROUND_SIZE } from './dominoPhysics'
import {
  createDominoBallSection,
  withoutBallSectionApproachPlacements,
  type DominoBallSection,
} from './dominoBall'
import { STAIR_STEP_COUNT, STAIR_STEP_RISE, STAIR_TOP_BASE_Y } from './dominoStairs'

export type DominoCourseType = 'normal' | 'long' | 'big'
export type DominoCameraMode = 'fixed' | 'longRail' | 'bigPullout'

export type DominoCourse = {
  type: DominoCourseType
  /** コースごとの国旗サイズ。ビッグのカメラ計算と配置検証で共有する。 */
  flagLayout: FlagLayoutSpec
  /** nullならRapierの既定値を使い、既存モードの物理パラメータに触れない。 */
  solverIterations: number | null
  /** 大量の静止剛体を明示的にsleepさせるのはビッグだけに限定する。 */
  settleSleepEnabled: boolean
  cameraMode: DominoCameraMode
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
  /** ボール区間の演出用一点を含む、ロングカメラ専用の中心線。 */
  cameraApproachPath: readonly { x: number; z: number; yaw: number }[]
  /** ロング専用のボールと坂。normalでは必ずnull。 */
  ballSection: DominoBallSection | null
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

/**
 * ビッグの配置はX方向が最大約±16.5、Z方向が約-14.7〜+10.9になる。
 * 端から2ユニットの余白を計算した必要サイズは約38.0だが、引きのカメラと
 * 地面端の見切れを避けるため、固定Collider 1枚のまま80を下限にする。
 */
const BIG_GROUND_MIN_SIZE = 80
const BIG_GROUND_MARGIN = 2

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
    flagLayout: NORMAL_FLAG_LAYOUT,
    solverIterations: null,
    settleSleepEnabled: false,
    cameraMode: 'fixed',
    placements,
    startId: 'line-0',
    groundSize: GROUND_SIZE,
    hardTimeoutMs: HARD_TIMEOUT_MS,
    flagCameraBounds: getLayoutBounds(placements),
    approachCount: 0,
    cameraProgressCount: 0,
    approachPath: [],
    cameraApproachPath: [],
    ballSection: null,
  }
}

/** ボール区間トリガー(approach-14)の道中インデックス。dominoBall.tsの前提と揃える。 */
const BALL_TRIGGER_APPROACH_INDEX = 14

/**
 * トリガーの手前STAIR_STEP_COUNT枚に、1段ずつ高くなるbaseYを与える。
 * トリガー自身は最後の段と同じ高さの「平場」にし、トリガーへの一押しは
 * 平らな道中と同じ受け渡しにして、球への接触精度を落とさない。
 * x/z/yawは既存の道中経路のまま変えないため、旋回中でも階段として登っていける。
 */
function withApproachStairs(placements: DominoPlacement[]): DominoPlacement[] {
  const stairStartIndex = BALL_TRIGGER_APPROACH_INDEX - STAIR_STEP_COUNT
  return placements.map((placement, index) => {
    if (index < stairStartIndex || index > BALL_TRIGGER_APPROACH_INDEX) return placement
    const stepNumber = Math.min(index - stairStartIndex + 1, STAIR_STEP_COUNT)
    return { ...placement, baseY: STAIR_STEP_RISE * stepNumber }
  })
}

function createLongCourse(flagId: DominoFlagId): DominoCourse {
  const flagCoursePlacements = createDominoPlacements(flagId)
  const lineZero = flagCoursePlacements.find((placement) => placement.id === 'line-0')
  if (!lineZero) throw new Error('通常コースにline-0がありません')

  const approach = createApproachPlacements(lineZero)
  const ballSection = createDominoBallSection(approach.path, STAIR_TOP_BASE_Y)
  const ballFreeApproachPlacements = withoutBallSectionApproachPlacements(
    withApproachStairs(approach.placements),
    ballSection,
  )
  const approachCount = ballFreeApproachPlacements.length
  const placements = [
    ...ballFreeApproachPlacements.map((placement, chainIndex) => ({
      ...placement,
      // ボールを挟んでもshepherdが存在しない連番を待たないよう、物理ドミノは連番にする。
      chainIndex,
    })),
    ...flagCoursePlacements.map((placement) => ({
      ...placement,
      chainIndex: placement.chainIndex + approachCount,
    })),
  ]

  return {
    type: 'long',
    flagLayout: NORMAL_FLAG_LAYOUT,
    solverIterations: null,
    settleSleepEnabled: false,
    cameraMode: 'longRail',
    placements,
    startId: 'approach-0',
    groundSize: LONG_GROUND_SIZE,
    hardTimeoutMs: LONG_HARD_TIMEOUT_MS,
    // 道中を含めないことで、通常コースの国旗画面の構図をそのまま保つ。
    flagCameraBounds: getLayoutBounds(flagCoursePlacements),
    approachCount,
    // 取り除いた15枚の位置をカメラ専用レールとして残し、球が転がる坂全体を滑らかに見せる。
    cameraProgressCount: approach.path.length + LINE_COUNT,
    approachPath: ballFreeApproachPlacements.map((placement) => ({
      x: placement.x,
      z: placement.z,
      yaw: placement.yaw ?? 0,
    })),
    cameraApproachPath: approach.path,
    ballSection,
  }
}

function groundSizeForBigCourse(placements: DominoPlacement[]): number {
  const bounds = getLayoutBounds(placements)
  const maximumDistanceFromCenter = Math.max(
    Math.abs(bounds.minX),
    Math.abs(bounds.maxX),
    Math.abs(bounds.minZ),
    Math.abs(bounds.maxZ),
  )
  return Math.max(
    BIG_GROUND_MIN_SIZE,
    Math.ceil((maximumDistanceFromCenter + BIG_GROUND_MARGIN) * 2),
  )
}

/**
 * ビッグは通常コースと同じ短い導線から、そのまま拡大国旗へ接続する。
 * layoutを差し替えられるようにし、サイズ比較用の物理テストでも同じ生成経路を使う。
 */
export function createBigCourse(
  flagId: DominoFlagId,
  layout: FlagLayoutSpec = BIG_FLAG_LAYOUT,
): DominoCourse {
  const bigLayout: FlagLayoutSpec =
    layout.chainGroupWeight === undefined
      ? {
          ...layout,
          // サイズ比較用layoutで省略されても、ビッグの連鎖見積りは常に重み2にする。
          chainGroupWeight: BIG_FLAG_LAYOUT.chainGroupWeight,
        }
      : layout
  const placements = createDominoPlacements(flagId, bigLayout)
  return {
    type: 'big',
    flagLayout: bigLayout,
    solverIterations: 2,
    settleSleepEnabled: true,
    cameraMode: 'bigPullout',
    placements,
    startId: 'line-0',
    groundSize: groundSizeForBigCourse(placements),
    hardTimeoutMs: BIG_HARD_TIMEOUT_MS,
    flagCameraBounds: getLayoutBounds(placements),
    approachCount: 0,
    cameraProgressCount: 0,
    approachPath: [],
    cameraApproachPath: [],
    ballSection: null,
  }
}

export function createDominoCourse(
  type: DominoCourseType,
  flagId: DominoFlagId,
): DominoCourse {
  if (type === 'normal') return createNormalCourse(flagId)
  if (type === 'big') return createBigCourse(flagId)
  return createLongCourse(flagId)
}
