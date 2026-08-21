import { BALL_RADIUS } from './mazePhysics'
import { CELL_SIZE } from './mazeStage'

/**
 * ボールを画面の短辺で十分に大きく見せつつ、進行方向の通路も残すカメラ。
 * 画面全体を収める距離はステージの形に依存するため、追従カメラでは使わない。
 */

export const CAMERA_FOV = 50

/** 真上すぎると立体感が消え、低すぎると奥の通路が壁で隠れるため中間の仰角にする。 */
export const CAMERA_ELEVATION_RAD = (58 * Math.PI) / 180

/**
 * 短辺に対してボールの直径が占める割合。
 * この1つの値がカメラ距離を決めるため、「カメラを引く」と「ボールが小さくなる」は
 * 常に同じ比率で連動する。下げれば見える範囲が広がり、ボールはそのぶん小さくなる。
 *
 * 幅390pxのスマホで直径約67px、そこへ貼る国旗パネル（直径の62%）が約42pxになる。
 * FlagBallの円形クロップが使う48pxより小さいが、パネルは円形に切らず4:3のまま
 * 枠線付きで見せるので同じ画素数でも国旗として読みやすく、実機確認で
 * 「国旗は判別できる。曲がり角の先をもっと見たい」という結果からこの値にしている。
 */
export const BALL_SCREEN_DIAMETER_RATIO = 0.173

/**
 * 寄りすぎて進行方向の通路が見えなくならないよう、短辺へ残す最小マス数。
 * 上のボール占有率だけで約3.85マスが入るため、通常はこちらの下限は効かない。
 * 占有率を上げたり通路を細くしたときに、視界が1マスだけにならないための歯止め。
 */
export const MIN_VISIBLE_CELLS_ON_SHORT_SIDE = 3.0

/** 極端に小さいステージでもnear面へ入り込まないための絶対距離。 */
export const MIN_CAMERA_DISTANCE = 3

/** 進行方向を少し先まで見せるための先読み時間。 */
export const LOOK_AHEAD_SECONDS = 0.32

/** 先読みが大きくなりすぎてボールを見失わないための上限。 */
export const MAX_LOOK_AHEAD_IN_RADII = 2.4

/** カメラがボールへ追いつく指数減衰の強さ（1/秒）。 */
export const CAMERA_FOLLOW_LAMBDA = 5.0

/** フレーム落ちや高速移動が続いてもボールから離れすぎないための上限。 */
export const MAX_FOLLOW_LAG_IN_RADII = 3.0

/**
 * プレイ中の「＋ / −」で選べる、標準のカメラ距離へ掛ける倍率。
 *
 * 端末の大きさや持ち方で「もう少し先を見たい / もう少しボールを大きく見たい」の
 * 好みが分かれるため、実機で決めた標準値（index 2 の 1.0）を真ん中にして、
 * 前後2段ずつ用意する。index が大きいほど寄る（距離が縮む）。
 *
 * 一番引いても画面短辺に入るのは約4.6マスで、9×9の迷路全体は見渡せない。
 * 一番寄せてもボールは画面短辺の約21%で、以前「存在感は十分」と確認した22%を
 * 超えない。1段あたり8〜9%なので、数回押して好みの距離に合わせられる。
 */
export const MAZE_ZOOM_SCALES = [1.19, 1.09, 1, 0.92, 0.84] as const

export const MIN_MAZE_ZOOM_INDEX = 0
export const MAX_MAZE_ZOOM_INDEX = MAZE_ZOOM_SCALES.length - 1

/** ゲーム開始時のズーム。実機で決めた標準のカメラ距離をそのまま使う。 */
export const DEFAULT_MAZE_ZOOM_INDEX = 2

/** ズームを切り替えたとき、距離が跳ねずに寄る・引く速さ（1/秒）。 */
export const CAMERA_ZOOM_LAMBDA = 8

export type MazeCameraBounds = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export type MazeCameraFocus = {
  x: number
  z: number
}

export type MazeCameraSetup = {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  fov: number
  distance: number
}

export type MazeCameraDistanceOptions = {
  ballRadius?: number
  ballScreenDiameterRatio?: number
  minVisibleCellsOnShortSide?: number
  cellSize?: number
  minCameraDistance?: number
  fov?: number
}

export type MazeCameraFocusOptions = {
  lookAheadSeconds?: number
  maxLookAheadInRadii?: number
  ballRadius?: number
  /** 歩ける範囲から外周を何ワールド単位ぶん除くか。既定は外周1マスぶん。 */
  inset?: number
}

/** 範囲外や壊れた値を渡されても、必ず選べる段のどれかに収める。 */
export function clampMazeZoomIndex(index: number): number {
  if (!Number.isFinite(index)) return DEFAULT_MAZE_ZOOM_INDEX
  return Math.min(MAX_MAZE_ZOOM_INDEX, Math.max(MIN_MAZE_ZOOM_INDEX, Math.round(index)))
}

/** 段に対応する、標準のカメラ距離へ掛ける倍率。 */
export function mazeZoomScale(index: number): number {
  return MAZE_ZOOM_SCALES[clampMazeZoomIndex(index)]!
}

/**
 * 現在の倍率を目標の倍率へ滑らかに寄せる。
 * ボタンを押した瞬間に距離が飛ぶと画面が跳ねて見えるため、追従と同じ指数減衰で埋める。
 */
export function followZoomScale(
  current: number,
  target: number,
  deltaSeconds: number,
  lambda = CAMERA_ZOOM_LAMBDA,
): number {
  const safeCurrent = safePositive(current, 1)
  const safeTarget = safePositive(target, 1)
  const elapsed = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0
  const factor = Math.min(1, Math.max(0, 1 - Math.exp(-safePositive(lambda, CAMERA_ZOOM_LAMBDA) * elapsed)))
  return safeCurrent + (safeTarget - safeCurrent) * factor
}

export type MazeCameraFollowOptions = {
  followLambda?: number
  maxFollowLagInRadii?: number
  ballRadius?: number
}

function safePositive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback
}

function safeNonNegative(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback
}

function safeAspect(aspect: number): number {
  return Number.isFinite(aspect) && aspect > 0 ? aspect : 1
}

function safeCoordinate(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function safeFocus(focus: MazeCameraFocus): MazeCameraFocus {
  return { x: safeCoordinate(focus.x), z: safeCoordinate(focus.z) }
}

function normalizedRange(min: number, max: number): { min: number; max: number } {
  const safeMin = safeCoordinate(min)
  const safeMax = safeCoordinate(max)
  return safeMin <= safeMax
    ? { min: safeMin, max: safeMax }
    : { min: safeMax, max: safeMin }
}

function clampToRange(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2
  return Math.min(max, Math.max(min, value))
}

function focusInsideWalkableBounds(
  focus: MazeCameraFocus,
  bounds: MazeCameraBounds,
  inset: number,
): MazeCameraFocus {
  const xRange = normalizedRange(bounds.minX, bounds.maxX)
  const zRange = normalizedRange(bounds.minZ, bounds.maxZ)
  return {
    x: clampToRange(focus.x, xRange.min + inset, xRange.max - inset),
    z: clampToRange(focus.z, zRange.min + inset, zRange.max - inset),
  }
}

/**
 * 画面短辺へボールを何割見せるか、短辺へ何マス残すか、near面からの距離を
 * それぞれ距離へ変換し、最も遠い条件を採用する。aspectが不正でも縦横比1として
 * 計算を続け、リサイズ中にカメラがNaNになるのを防ぐ。
 */
export function computeMazeCameraDistance(
  aspect: number,
  options: MazeCameraDistanceOptions = {},
): number {
  const safeFov = Math.min(179, safePositive(options.fov, CAMERA_FOV))
  const safeRadius = safePositive(options.ballRadius, BALL_RADIUS)
  const safeRatio = safePositive(
    options.ballScreenDiameterRatio,
    BALL_SCREEN_DIAMETER_RATIO,
  )
  const safeCellSize = safePositive(options.cellSize, CELL_SIZE)
  const minVisibleCells = safeNonNegative(
    options.minVisibleCellsOnShortSide,
    MIN_VISIBLE_CELLS_ON_SHORT_SIDE,
  )
  const minDistance = safeNonNegative(options.minCameraDistance, MIN_CAMERA_DISTANCE)
  const tanShortHalf =
    Math.tan((safeFov * Math.PI) / 360) * Math.min(1, safeAspect(aspect))

  const ballDistance = safeRadius / (safeRatio * tanShortHalf)
  const visibleCellsDistance =
    (minVisibleCells * safeCellSize) / (2 * tanShortHalf)
  return Math.max(ballDistance, visibleCellsDistance, minDistance)
}

/**
 * 速度の水平成分だけから先読みした注視点を求め、外周1マスぶん内側の
 * 歩ける矩形へ収める。boundsの形そのものは参照しないので、長い一本道や
 * 複数エリアのステージでも同じ計算を使える。
 */
export function desiredCameraFocus(
  ball: MazeCameraFocus,
  velocity: MazeCameraFocus,
  bounds: MazeCameraBounds,
  options: MazeCameraFocusOptions = {},
): MazeCameraFocus {
  const safeBall = safeFocus(ball)
  const vx = safeCoordinate(velocity.x)
  const vz = safeCoordinate(velocity.z)
  const speed = Math.hypot(vx, vz)
  const safeRadius = safePositive(options.ballRadius, BALL_RADIUS)
  const lookAheadSeconds = safeNonNegative(options.lookAheadSeconds, LOOK_AHEAD_SECONDS)
  const maxLookAhead =
    safeNonNegative(options.maxLookAheadInRadii, MAX_LOOK_AHEAD_IN_RADII) * safeRadius

  let aheadX = 0
  let aheadZ = 0
  if (speed > 0 && Number.isFinite(speed) && maxLookAhead > 0) {
    const aheadLength = Math.min(speed * lookAheadSeconds, maxLookAhead)
    aheadX = (vx / speed) * aheadLength
    aheadZ = (vz / speed) * aheadLength
  }

  const inset = safeNonNegative(options.inset, CELL_SIZE)
  return focusInsideWalkableBounds(
    { x: safeBall.x + aheadX, z: safeBall.z + aheadZ },
    bounds,
    inset,
  )
}

/**
 * 現在の注視点を指数減衰で目的地へ近づける。deltaSecondsをフレーム数ではなく
 * 経過時間として使うため、30fpsでも60fpsでも同じ時間で同じ位置へ収束する。
 * 先読みを含まないボール位置から3Rを超えた場合は、遅れ方向を保ったまま戻す。
 */
export function followCameraFocus(
  current: MazeCameraFocus,
  desired: MazeCameraFocus,
  ballPosition: MazeCameraFocus,
  deltaSeconds: number,
  options: MazeCameraFollowOptions = {},
): MazeCameraFocus {
  const safeCurrent = safeFocus(current)
  const safeDesired = safeFocus(desired)
  const safeBall = safeFocus(ballPosition)
  const lambda = safePositive(options.followLambda, CAMERA_FOLLOW_LAMBDA)
  const maxLag =
    safeNonNegative(options.maxFollowLagInRadii, MAX_FOLLOW_LAG_IN_RADII) *
    safePositive(options.ballRadius, BALL_RADIUS)
  const elapsed = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0
  const factor = Math.min(1, Math.max(0, 1 - Math.exp(-lambda * elapsed)))
  const interpolated = {
    x: safeCurrent.x + (safeDesired.x - safeCurrent.x) * factor,
    z: safeCurrent.z + (safeDesired.z - safeCurrent.z) * factor,
  }

  const lagX = interpolated.x - safeBall.x
  const lagZ = interpolated.z - safeBall.z
  const lag = Math.hypot(lagX, lagZ)
  if (lag > maxLag && lag > 0) {
    return {
      x: safeBall.x + (lagX / lag) * maxLag,
      z: safeBall.z + (lagZ / lag) * maxLag,
    }
  }
  return interpolated
}

/**
 * 水平位置から固定の仰角・FOVでカメラの位置と注視点を作る。
 * 高さはボールの跳ねに影響されないよう、常にBALL_RADIUSへ固定する。
 */
export function cameraSetupForFocus(
  focus: MazeCameraFocus,
  distance: number,
): MazeCameraSetup {
  const safeFocusValue = safeFocus(focus)
  const safeDistance = safePositive(distance, MIN_CAMERA_DISTANCE)
  const target = {
    x: safeFocusValue.x,
    y: BALL_RADIUS,
    z: safeFocusValue.z,
  }
  const sinElevation = Math.sin(CAMERA_ELEVATION_RAD)
  const cosElevation = Math.cos(CAMERA_ELEVATION_RAD)
  return {
    position: {
      x: target.x,
      y: target.y + safeDistance * sinElevation,
      z: target.z + safeDistance * cosElevation,
    },
    target,
    fov: CAMERA_FOV,
    distance: safeDistance,
  }
}
