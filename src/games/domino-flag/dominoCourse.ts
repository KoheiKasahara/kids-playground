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
import {
  SEESAW_PIVOT_HEIGHT,
  createDominoSeesawSection,
  type DominoSeesawSection,
} from './dominoSeesaw'

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
  /** 2つ目の坂からシーソーへ球を運ぶ区間。normalでは必ずnull。 */
  seesawBallSection: DominoBallSection | null
  /** シーソー/レバー本体。normalでは必ずnull。 */
  seesawSection: DominoSeesawSection | null
}

type ApproachSegment =
  | { kind: 'straight'; count: number }
  | { kind: 'arc'; count: number; turnDeg: number }

/**
 * 道中は短い直線、S字、左右の大きな折り返しを順につなぐ。
 * 1枚ごとの旋回を15度以下に抑え、連鎖が次の区間へ自然に進む形にする。
 * インデックス0〜43(既存Phase 6の上り坂・ボール・折り返し)はそのまま残し、
 * 44番以降へ「2つ目の上り坂→高台→ボール→シーソー→下り坂」を追加する。
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
  // --- ここから今回追加する「冒険コース」区間 ---
  // createApproachPathは終端の向きを0へ揃えるため回転を掛け直すが、その回転量は
  // yawフィールドには正しく加算される一方でx/z自体は逆回転で動いてしまう(既存のバグ)。
  // 追加区間の旋回を合計0度に保つことで、既存の44枚と同じく回転量を常に0にし、
  // このズレを踏まない設計にする。
  { kind: 'straight', count: 2 },
  { kind: 'arc', count: 8, turnDeg: -44 },
  { kind: 'straight', count: 4 },
  { kind: 'arc', count: 8, turnDeg: 44 },
  { kind: 'straight', count: 2 },
  { kind: 'arc', count: 6, turnDeg: -30 },
  { kind: 'arc', count: 6, turnDeg: 30 },
  // カメラの終盤ブレンド(CAMERA_BLEND_APPROACH_COUNT=8)がまっすぐな区間だけを
  // 見られるよう、最後の直線を長めに取って旋回の余韻を吸収する。
  { kind: 'straight', count: 10 },
]

const APPROACH_COUNT = APPROACH_SEGMENTS.reduce(
  (total, segment) => total + segment.count,
  0,
)
/** 0.7では2枚先の中心間隔が1.4になり、自己干渉の下限1.6を満たせないための安全余白。 */
const APPROACH_PITCH = LINE_PITCH_Z + 0.12
// 広い俯瞰カメラでも道中側の地面の切れ目が画面に入らないよう、350まで余裕を持たせる。
const LONG_GROUND_SIZE = 350

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
    seesawBallSection: null,
    seesawSection: null,
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

// --- 2つ目の上り坂・高台・ボール・シーソー・下り坂(今回追加分)のインデックス配置 ---
// APPROACH_SEGMENTSの追加区間(44番以降)に対応させる。既存の0〜43番は一切動かさない。
/** 2つ目の上り坂の段数と1段あたりの高さ。既存の坂より緩やかにして違いを出す。 */
const CLIMB2_STEP_COUNT = 8
const CLIMB2_STEP_RISE = 0.18
const CLIMB2_START_INDEX = 44 + 2 // 直線2枚ぶん助走してから登り始める
const CLIMB2_TOP_BASE_Y = CLIMB2_STEP_COUNT * CLIMB2_STEP_RISE
/** 登り切った先の高台(平場)。カメラからも「ここまで登った」と分かる長さにする。 */
const HIGHLAND2_START_INDEX = CLIMB2_START_INDEX + CLIMB2_STEP_COUNT
const HIGHLAND2_STEP_COUNT = 4
const HIGHLAND2_END_INDEX = HIGHLAND2_START_INDEX + HIGHLAND2_STEP_COUNT - 1
/** 高台最後のドミノが2つ目のボールを押し出すトリガー。 */
const BALL2_TRIGGER_INDEX = HIGHLAND2_END_INDEX
const BALL2_START_INDEX = BALL2_TRIGGER_INDEX + 1
const BALL2_RAIL_LENGTH = 7
const BALL2_RAIL_INDEXES = Array.from(
  { length: BALL2_RAIL_LENGTH },
  (_, index) => BALL2_START_INDEX + 1 + index,
)
/** シーソーに叩かれて連鎖を再開する、後段の先頭ドミノ。 */
const BALL2_RECEIVER_INDEX = BALL2_RAIL_INDEXES.at(-1)! + 2
/** シーソー本体ぶんの隙間を確保するため、既存Phase 6より緩い上限を使う。 */
const BALL2_MAX_RECEIVER_GAP = 2.4
/**
 * シーソーの先で高台から地面付近まで下る、下り坂ドミノの区間。
 * -30度→+30度と軽く蛇行させ、上り坂とは違う見た目にする(2つのarcセグメントぶん)。
 */
const DESCENT2_START_INDEX = BALL2_RECEIVER_INDEX + 1
const DESCENT2_STEP_COUNT = 12
const DESCENT2_END_INDEX = DESCENT2_START_INDEX + DESCENT2_STEP_COUNT - 1

/**
 * 2つ目の上り坂・高台・シーソー先のドミノ・下り坂へbaseYを与える。
 * withApproachStairsとは別区間(44番以降)にしか触れないため、既存の坂とは独立して調整できる。
 */
function withApproachClimbAndDescent2(
  placements: DominoPlacement[],
  strikeDominoBaseY: number,
): DominoPlacement[] {
  return placements.map((placement, index) => {
    if (index >= CLIMB2_START_INDEX && index < HIGHLAND2_START_INDEX) {
      const stepNumber = index - CLIMB2_START_INDEX + 1
      return { ...placement, baseY: CLIMB2_STEP_RISE * stepNumber }
    }
    if (index >= HIGHLAND2_START_INDEX && index <= HIGHLAND2_END_INDEX) {
      return { ...placement, baseY: CLIMB2_TOP_BASE_Y }
    }
    if (index === BALL2_RECEIVER_INDEX) {
      return { ...placement, baseY: strikeDominoBaseY }
    }
    if (index >= DESCENT2_START_INDEX && index <= DESCENT2_END_INDEX) {
      const stepNumber = index - DESCENT2_START_INDEX + 1
      // 最後の段でちょうど0へ着地させ、直後の平場との段差をなくす。
      const remainingRatio = 1 - stepNumber / DESCENT2_STEP_COUNT
      return { ...placement, baseY: strikeDominoBaseY * remainingRatio }
    }
    return placement
  })
}

function createLongCourse(flagId: DominoFlagId): DominoCourse {
  const flagCoursePlacements = createDominoPlacements(flagId)
  const lineZero = flagCoursePlacements.find((placement) => placement.id === 'line-0')
  if (!lineZero) throw new Error('通常コースにline-0がありません')

  const approach = createApproachPlacements(lineZero)
  const ballSection = createDominoBallSection(approach.path, STAIR_TOP_BASE_Y)
  const seesawSection = createDominoSeesawSection(approach.path, BALL2_RECEIVER_INDEX)
  const seesawBallSection = createDominoBallSection(approach.path, CLIMB2_TOP_BASE_Y, {
    triggerIndex: BALL2_TRIGGER_INDEX,
    startIndex: BALL2_START_INDEX,
    railIndexes: BALL2_RAIL_INDEXES,
    receiverIndex: BALL2_RECEIVER_INDEX,
    exitSurfaceY: SEESAW_PIVOT_HEIGHT,
    maxReceiverGap: BALL2_MAX_RECEIVER_GAP,
  })
  const climbedPlacements = withApproachClimbAndDescent2(
    withApproachStairs(approach.placements),
    seesawSection.strikeDominoBaseY,
  )
  const ballFreeApproachPlacements = withoutBallSectionApproachPlacements(
    withoutBallSectionApproachPlacements(climbedPlacements, ballSection),
    seesawBallSection,
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
    // 取り除いたドミノの位置をカメラ専用レールとして残し、球やシーソーの区間も滑らかに見せる。
    cameraProgressCount: approach.path.length + LINE_COUNT,
    approachPath: ballFreeApproachPlacements.map((placement) => ({
      x: placement.x,
      z: placement.z,
      yaw: placement.yaw ?? 0,
    })),
    cameraApproachPath: approach.path,
    ballSection,
    seesawBallSection,
    seesawSection,
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
    seesawBallSection: null,
    seesawSection: null,
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
