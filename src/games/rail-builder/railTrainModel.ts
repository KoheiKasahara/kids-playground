import {
  railPathLength,
  type RailConnectorId,
  type RailPath,
  type RailPiece,
  type RailVec3,
  worldRailPathPoint,
  worldRailPathTangent,
} from './railModel'

/** 列車の調整値。子ども向けの見た目を保ちながら、数値だけ調整できるよう一か所にまとめる。 */
export const TRAIN_MAX_SPEED = 4.2
export const TRAIN_ACCELERATION = 2.4
export const TRAIN_DECELERATION = 3.8
// 先頭車の中心から前端までは約1.23。車体がレール端を越えず、
// 見た目にも少し手前で待てる余裕を持たせる。
export const TRAIN_END_STOP_MARGIN = 1.45
// 車体(約2.15)とカプラーが重ならない、スマホでも見分けやすい間隔。
export const TRAIN_CAR_SPACING = 2.5
export const TRAIN_CAR_COUNT = 2

// 名前から意味が分かりやすい別名も公開しておく。
export const MAX_TRAIN_SPEED = TRAIN_MAX_SPEED
export const TRAIN_BRAKING = TRAIN_DECELERATION
export const TRAIN_STOP_MARGIN = TRAIN_END_STOP_MARGIN
export const TRAIN_SPACING = TRAIN_CAR_SPACING
export const TRAIN_VEHICLE_COUNT = TRAIN_CAR_COUNT

const EPSILON = 1e-7
const DEFAULT_ITERATION_GUARD = 512
/**
 * React側では線路配列のidentityが編集時だけ変わるため、piece検索を配列ごと
 * cacheしておく。走行中に毎frame・各列車ごと全線路をfindしないための索引。
 */
const railPieceLookupCache = new WeakMap<readonly RailPiece[], ReadonlyMap<string, RailPiece>>()

/** directionはbranch進入時に確定した今回のroute lockも兼ねる。 */
export type RailTrainDirection = 'a-to-b' | 'b-to-a' | 'a-to-c' | 'c-to-a'
export type TrainDirection = RailTrainDirection

export type RailTrainCursor = {
  pieceId: string
  direction: RailTrainDirection
  /** 進行方向の入口コネクタから測った距離。 */
  distance: number
}

export type TrainCursor = RailTrainCursor

export type RailTrainStatus =
  | 'ready'
  | 'running'
  | 'paused'
  | 'waiting'
  | 'approachingStation'
  | 'stoppedAtStation'
  | 'departing'
export type TrainStatus = RailTrainStatus

export type RailTrainMotion = {
  cursor: RailTrainCursor
  speed: number
  status: RailTrainStatus
  /** 直前に停車した駅。駅pieceを抜けるまで次の駅探索から除外する。 */
  stationServicedId?: string
  /** stoppedAtStationの経過時間（秒）。 */
  stationStopElapsed?: number
}

export type TrainMotion = RailTrainMotion

export type RailTrainPose = {
  position: RailVec3
  forward: RailVec3
  /** forwardの別名。経路の接線として扱う呼び出し側にも分かりやすくする。 */
  tangent: RailVec3
  cursor: RailTrainCursor
}

export type TrainPose = RailTrainPose

type ValidPiece = {
  piece: RailPiece
  path: RailPath
  length: number
}

function finite(value: number): boolean {
  return Number.isFinite(value)
}

function copyVec(value: RailVec3): RailVec3 {
  return { x: value.x, y: value.y, z: value.z }
}

function copyCursor(cursor: RailTrainCursor): RailTrainCursor {
  return { ...cursor }
}

function railPieceForId(pieces: readonly RailPiece[], pieceId: string): RailPiece | undefined {
  let lookup = railPieceLookupCache.get(pieces)
  if (lookup === undefined) {
    lookup = new Map(pieces.map((piece) => [piece.id, piece]))
    railPieceLookupCache.set(pieces, lookup)
  }
  return lookup.get(pieceId)
}

/** cursorのrouteに対応するPath。A-CはbranchPath、それ以外は従来path。 */
export function railPathForTrainDirection(
  piece: RailPiece,
  direction: RailTrainDirection,
): RailPath | null {
  if (direction === 'a-to-c' || direction === 'c-to-a') {
    return piece.kind === 'branch' && piece.branchPath !== undefined ? piece.branchPath : null
  }
  return piece.path
}

function validPiece(
  pieces: readonly RailPiece[],
  pieceId: string,
  direction: RailTrainDirection = 'a-to-b',
): ValidPiece | null {
  const piece = railPieceForId(pieces, pieceId)
  if (piece === undefined || piece.path === undefined) return null
  const path = railPathForTrainDirection(piece, direction)
  if (path === null) return null
  try {
    const length = railPathLength(path)
    if (!finite(length) || length < 0) return null
    return { piece, path, length }
  } catch {
    return null
  }
}

function clampDistance(distance: number, length: number): number {
  if (!finite(distance)) return distance > 0 ? length : 0
  return Math.min(length, Math.max(0, distance))
}

function entryConnector(direction: RailTrainDirection): RailConnectorId {
  if (direction === 'a-to-b' || direction === 'a-to-c') return 'a'
  return direction === 'b-to-a' ? 'b' : 'c'
}

function exitConnector(direction: RailTrainDirection): RailConnectorId {
  if (direction === 'a-to-b') return 'b'
  if (direction === 'a-to-c') return 'c'
  return 'a'
}

function oppositeRailTrainDirection(direction: RailTrainDirection): RailTrainDirection {
  if (direction === 'a-to-b') return 'b-to-a'
  if (direction === 'b-to-a') return 'a-to-b'
  if (direction === 'a-to-c') return 'c-to-a'
  return 'a-to-c'
}

/** 接続先へ入る瞬間にbranchDirectionを読み、列車固有のrouteを確定する。 */
function directionLeavingConnector(
  piece: RailPiece,
  connectorId: RailConnectorId,
): RailTrainDirection {
  if (connectorId === 'a') {
    return piece.kind === 'branch' && piece.branchDirection === 'c' ? 'a-to-c' : 'a-to-b'
  }
  return connectorId === 'c' ? 'c-to-a' : 'b-to-a'
}

function directionArrivingAtConnector(
  piece: RailPiece,
  connectorId: RailConnectorId,
): RailTrainDirection {
  if (connectorId === 'b') return 'a-to-b'
  if (connectorId === 'c') return 'a-to-c'
  return piece.kind === 'branch' && piece.branchDirection === 'c' ? 'c-to-a' : 'b-to-a'
}

function findConnection(
  pieces: readonly RailPiece[],
  piece: RailPiece,
  connectorId: RailConnectorId,
): { piece: RailPiece; connectorId: RailConnectorId } | null {
  const connection = piece.connections?.[connectorId]
  if (connection === undefined || typeof connection.pieceId !== 'string') return null
  if (
    connection.connectorId !== 'a'
    && connection.connectorId !== 'b'
    && connection.connectorId !== 'c'
  ) return null
  const nextPiece = railPieceForId(pieces, connection.pieceId)
  if (connection.connectorId === 'c' && nextPiece?.kind !== 'branch') return null
  return nextPiece === undefined ? null : { piece: nextPiece, connectorId: connection.connectorId }
}

function cursorWithDistance(cursor: RailTrainCursor, pieces: readonly RailPiece[]): RailTrainCursor {
  const direction = cursor.direction === 'b-to-a'
    || cursor.direction === 'a-to-c'
    || cursor.direction === 'c-to-a'
    ? cursor.direction
    : 'a-to-b'
  const resolved = validPiece(pieces, cursor.pieceId, direction)
  if (resolved === null) return copyCursor(cursor)
  return {
    pieceId: cursor.pieceId,
    direction,
    distance: clampDistance(cursor.distance, resolved.length),
  }
}

/** カーソルの距離を、そのpieceのローカルパラメータへ変換する。 */
export function railTrainCursorT(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
): number | null {
  const resolved = validPiece(pieces, cursor.pieceId, cursor.direction)
  if (resolved === null || resolved.length <= EPSILON) return resolved === null ? null : 0
  const normalized = cursorWithDistance(cursor, pieces)
  const fraction = normalized.distance / resolved.length
  return normalized.direction === 'a-to-b' || normalized.direction === 'a-to-c'
    ? fraction
    : 1 - fraction
}

/** カーソルを線路上のワールド姿勢へ変換する。 */
export function sampleRailTrainPose(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
): RailTrainPose | null {
  const resolved = validPiece(pieces, cursor.pieceId, cursor.direction)
  if (resolved === null) return null
  const normalized = cursorWithDistance(cursor, pieces)
  const t = railTrainCursorT(pieces, normalized)
  if (t === null || !finite(t)) return null
  try {
    const position = worldRailPathPoint(resolved.piece, t, resolved.path)
    const tangent = worldRailPathTangent(resolved.piece, t, resolved.path)
    const forward = normalized.direction === 'a-to-b' || normalized.direction === 'a-to-c'
      ? tangent
      : { x: -tangent.x, y: -tangent.y, z: -tangent.z }
    return {
      position: copyVec(position),
      forward: copyVec(forward),
      tangent: copyVec(forward),
      cursor: normalized,
    }
  } catch {
    return null
  }
}

export const sampleTrainPose = sampleRailTrainPose
export const sampleRailTrainPath = sampleRailTrainPose

/** 進行方向へ距離を進め、接続があれば次のpieceへ乗り移る。 */
export function advanceRailTrainCursor(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
  distance: number,
): RailTrainCursor {
  let current = cursorWithDistance(cursor, pieces)
  let remaining = finite(distance) ? Math.max(0, distance) : 0
  if (remaining <= EPSILON) return current

  for (let iteration = 0; iteration < DEFAULT_ITERATION_GUARD; iteration += 1) {
    const resolved = validPiece(pieces, current.pieceId, current.direction)
    if (resolved === null) return current
    current.distance = clampDistance(current.distance, resolved.length)
    const toExit = Math.max(0, resolved.length - current.distance)
    const connection = findConnection(pieces, resolved.piece, exitConnector(current.direction))
    // 接続のある端点では、ちょうど端まで進んだ時も次のpieceの入口を
    // 正規形にする。接続がなければ、そのpieceの端点で止める。
    if (remaining < toExit - EPSILON || connection === null) {
      current.distance = Math.min(resolved.length, current.distance + remaining)
      if (connection === null) return current
      if (remaining <= toExit + EPSILON) return current
    }

    remaining -= toExit
    if (connection === null) {
      current.distance = resolved.length
      return current
    }
    const nextDirection = directionLeavingConnector(connection.piece, connection.connectorId)
    const next = validPiece(pieces, connection.piece.id, nextDirection)
    if (next === null) {
      current.distance = resolved.length
      return current
    }
    current = {
      pieceId: next.piece.id,
      direction: nextDirection,
      distance: 0,
    }
    if (remaining <= EPSILON) return current
  }

  // 無限ループや壊れたトポロジーでも、描画ループを止めず現在位置を返す。
  return current
}

export const advanceTrainCursor = advanceRailTrainCursor
export const moveRailTrainCursor = advanceRailTrainCursor

/** 進行方向とは逆へ距離を戻す。車両の後続車を同じ線路上で求めるために使う。 */
export function retreatRailTrainCursor(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
  distance: number,
): RailTrainCursor {
  let current = cursorWithDistance(cursor, pieces)
  let remaining = finite(distance) ? Math.max(0, distance) : 0
  if (remaining <= EPSILON) return current

  for (let iteration = 0; iteration < DEFAULT_ITERATION_GUARD; iteration += 1) {
    const resolved = validPiece(pieces, current.pieceId, current.direction)
    if (resolved === null) return current
    current.distance = clampDistance(current.distance, resolved.length)
    const toEntry = current.distance
    const connection = findConnection(pieces, resolved.piece, entryConnector(current.direction))
    // 先頭車がちょうど入口に来た時も、後続車は接続先の出口側へ
    // 正規化する。未接続なら入口で安全にクランプする。
    if (remaining < toEntry - EPSILON || connection === null) {
      current.distance = Math.max(0, toEntry - remaining)
      if (connection === null) return current
      if (remaining <= toEntry + EPSILON) return current
    }

    remaining -= toEntry
    if (connection === null) {
      current.distance = 0
      return current
    }
    const previousDirection = directionArrivingAtConnector(connection.piece, connection.connectorId)
    const previous = validPiece(pieces, connection.piece.id, previousDirection)
    if (previous === null) {
      current.distance = 0
      return current
    }
    current = {
      pieceId: previous.piece.id,
      direction: previousDirection,
      distance: previous.length,
    }
    if (remaining <= EPSILON) return current
  }

  return current
}

export const retreatTrainCursor = retreatRailTrainCursor
export const backRailTrainCursor = retreatRailTrainCursor

/** 現在位置から、接続をたどった最初の行き止まりまでの距離を返す。ループならInfinity。 */
export function distanceToRailTrainDeadEnd(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
): number {
  let current = cursorWithDistance(cursor, pieces)
  let total = 0
  const seen = new Set<string>()

  for (let iteration = 0; iteration < DEFAULT_ITERATION_GUARD; iteration += 1) {
    const resolved = validPiece(pieces, current.pieceId, current.direction)
    if (resolved === null) return total
    const state = `${resolved.piece.id}:${current.direction}`
    if (seen.has(state)) return Infinity
    seen.add(state)

    current.distance = clampDistance(current.distance, resolved.length)
    total += Math.max(0, resolved.length - current.distance)
    const connection = findConnection(pieces, resolved.piece, exitConnector(current.direction))
    if (connection === null) return total
    const nextDirection = directionLeavingConnector(connection.piece, connection.connectorId)
    const next = validPiece(pieces, connection.piece.id, nextDirection)
    if (next === null) return total
    current = {
      pieceId: next.piece.id,
      direction: nextDirection,
      distance: 0,
    }
  }

  // 反復上限に達したトポロジーは、走行を安全側に扱う。
  return Infinity
}

export const forwardDistanceToDeadEnd = distanceToRailTrainDeadEnd
export const railTrainDistanceToDeadEnd = distanceToRailTrainDeadEnd

/**
 * followerから選択済みrouteを前方へたどり、同じPath上にいるleaderまでの
 * 経路距離を返す。逆方向列車も同じPath座標へ換算するため、B-B/A-A接続で
 * 正面接近する場合を検知できる。空間距離は使わず、立体交差では誤停止しない。
 */
export function distanceAheadToRailTrainCursor(
  pieces: readonly RailPiece[],
  follower: RailTrainCursor,
  leader: RailTrainCursor,
  maxDistance = 12,
): number | null {
  let current = cursorWithDistance(follower, pieces)
  const target = cursorWithDistance(leader, pieces)
  let total = 0
  const limit = finite(maxDistance) ? Math.max(0, maxDistance) : 0
  const seen = new Set<string>()

  for (let iteration = 0; iteration < DEFAULT_ITERATION_GUARD; iteration += 1) {
    const resolved = validPiece(pieces, current.pieceId, current.direction)
    if (resolved === null || total > limit + EPSILON) return null

    if (target.pieceId === current.pieceId) {
      const targetDistanceInCurrentDirection = target.direction === current.direction
        ? target.distance
        : target.direction === oppositeRailTrainDirection(current.direction)
          ? resolved.length - target.distance
          : null
      const aheadOnPiece = targetDistanceInCurrentDirection === null
        ? -Infinity
        : targetDistanceInCurrentDirection - current.distance
      if (aheadOnPiece >= -EPSILON && total + Math.max(0, aheadOnPiece) <= limit + EPSILON) {
        return total + Math.max(0, aheadOnPiece)
      }
    }

    const state = `${current.pieceId}:${current.direction}`
    if (seen.has(state)) return null
    seen.add(state)
    total += Math.max(0, resolved.length - current.distance)
    if (total > limit + EPSILON) return null
    const connection = findConnection(pieces, resolved.piece, exitConnector(current.direction))
    if (connection === null) return null
    const nextDirection = directionLeavingConnector(connection.piece, connection.connectorId)
    const next = validPiece(pieces, connection.piece.id, nextDirection)
    if (next === null) return null
    current = { pieceId: next.piece.id, direction: nextDirection, distance: 0 }
  }
  return null
}

export const forwardRailDistanceBetweenCursors = distanceAheadToRailTrainCursor

export type RailTrainStationTarget = {
  stationId: string
  /** 現在のカーソルから駅のホーム中央までの経路距離。 */
  distance: number
}

/**
 * 現在の進行方向で最初に見つかる駅のホーム中央までを接続順に探索する。
 * 駅の中央を過ぎた後は同じpieceを次の駅として再検出しない。
 * ignoredStationIdは停車直後の駅をpieceから抜けるまで除外するために使う。
 */
export function findNextRailTrainStation(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
  ignoredStationId?: string,
): RailTrainStationTarget | null {
  let current = cursorWithDistance(cursor, pieces)
  let total = 0
  const seen = new Set<string>()

  for (let iteration = 0; iteration < DEFAULT_ITERATION_GUARD; iteration += 1) {
    const resolved = validPiece(pieces, current.pieceId, current.direction)
    if (resolved === null) return null
    const state = `${resolved.piece.id}:${current.direction}`
    if (seen.has(state)) return null
    seen.add(state)

    current.distance = clampDistance(current.distance, resolved.length)
    const stationCenter = resolved.length / 2
    if (
      resolved.piece.kind === 'station'
      && resolved.piece.id !== ignoredStationId
      && current.distance < stationCenter - EPSILON
    ) {
      return { stationId: resolved.piece.id, distance: total + stationCenter - current.distance }
    }

    total += Math.max(0, resolved.length - current.distance)
    const connection = findConnection(pieces, resolved.piece, exitConnector(current.direction))
    if (connection === null) return null
    const nextDirection = directionLeavingConnector(connection.piece, connection.connectorId)
    const next = validPiece(pieces, connection.piece.id, nextDirection)
    if (next === null) return null
    current = {
      pieceId: next.piece.id,
      direction: nextDirection,
      distance: 0,
    }
  }
  return null
}

export const nextRailTrainStation = findNextRailTrainStation

/** 駅がなければInfinityを返す距離専用の純粋関数。 */
export function distanceToRailTrainStation(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
  ignoredStationId?: string,
): number {
  return findNextRailTrainStation(pieces, cursor, ignoredStationId)?.distance ?? Infinity
}

export const distanceToNextRailTrainStation = distanceToRailTrainStation

/** カーソルから先頭車・後続車のカーソルを線路上で求める。 */
export function railTrainCarCursors(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
  carCount = TRAIN_CAR_COUNT,
  spacing = TRAIN_CAR_SPACING,
): RailTrainCursor[] {
  const count = Math.max(1, Math.floor(carCount))
  const result: RailTrainCursor[] = []
  for (let index = 0; index < count; index += 1) {
    result.push(retreatRailTrainCursor(pieces, cursor, Math.max(0, spacing) * index))
  }
  return result
}

export const getRailTrainCarCursors = railTrainCarCursors
export const getTrainCarCursors = railTrainCarCursors

export function sampleRailTrainCars(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
  carCount = TRAIN_CAR_COUNT,
  spacing = TRAIN_CAR_SPACING,
): RailTrainPose[] {
  return railTrainCarCursors(pieces, cursor, carCount, spacing)
    .map((carCursor) => sampleRailTrainPose(pieces, carCursor))
    .filter((pose): pose is RailTrainPose => pose !== null)
}

export const sampleTrainCars = sampleRailTrainCars
export const sampleRailTrainPoses = sampleRailTrainCars

/** 先頭車と後続車が触れているpiece IDを返す。 */
export function occupiedRailPieceIds(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
  carCount = TRAIN_CAR_COUNT,
  spacing = TRAIN_CAR_SPACING,
): string[] {
  const occupied = new Set<string>()
  for (const carCursor of railTrainCarCursors(pieces, cursor, carCount, spacing)) {
    if (validPiece(pieces, carCursor.pieceId, carCursor.direction) !== null) occupied.add(carCursor.pieceId)
  }
  return [...occupied]
}

export const getOccupiedRailPieceIds = occupiedRailPieceIds
export const occupiedRailIds = occupiedRailPieceIds

/** 最初に走れるpieceを選び、後続車が載るぶん入口から離した初期カーソルを作る。 */
export function createInitialRailTrainMotion(
  pieces: readonly RailPiece[],
  preferredPieceId = 'rail-1',
): RailTrainMotion | null {
  const directionForPiece = (piece: RailPiece): RailTrainDirection => (
    piece.kind === 'branch' && piece.branchDirection === 'c' ? 'a-to-c' : 'a-to-b'
  )
  const preferredPiece = railPieceForId(pieces, preferredPieceId)
  const preferredDirection = preferredPiece === undefined ? 'a-to-b' : directionForPiece(preferredPiece)
  const preferred = validPiece(pieces, preferredPieceId, preferredDirection)
  const resolved = preferred ?? pieces
    .map((piece) => validPiece(pieces, piece.id, directionForPiece(piece)))
    .find((candidate): candidate is ValidPiece => candidate !== null)
  if (resolved === undefined || resolved === null) return null
  const direction = directionForPiece(resolved.piece)
  const selectedPath = railPathForTrainDirection(resolved.piece, direction)
  const selectedLength = selectedPath === null ? resolved.length : railPathLength(selectedPath)
  const startDistance = Math.min(
    Math.max(0, selectedLength - TRAIN_END_STOP_MARGIN),
    Math.max(0, TRAIN_CAR_SPACING * (TRAIN_CAR_COUNT - 1) + 0.35),
  )
  return {
    cursor: {
      pieceId: resolved.piece.id,
      direction,
      distance: startDistance,
    },
    speed: 0,
    status: 'ready',
  }
}

export const createInitialTrainMotion = createInitialRailTrainMotion
export const makeInitialRailTrainMotion = createInitialRailTrainMotion

export const TRAIN_STATION_STOP_DURATION = 1.5
export const TRAIN_STATION_APPROACH_DISTANCE = 4.5

/** 発車・再開。待機中でもカーソルはそのまま保持する。 */
export function startRailTrain(motion: RailTrainMotion): RailTrainMotion {
  if (motion.status !== 'ready' && motion.status !== 'waiting' && motion.status !== 'paused') {
    return { ...motion, cursor: copyCursor(motion.cursor), speed: Math.max(0, motion.speed) }
  }
  return { ...motion, cursor: copyCursor(motion.cursor), speed: Math.max(0, motion.speed), status: 'running' }
}

export const restartRailTrain = startRailTrain
export const startTrainMotion = startRailTrain

/** 個別停止。cursorと駅サービス情報は保持する。 */
export function pauseRailTrain(motion: RailTrainMotion): RailTrainMotion {
  return { ...motion, cursor: copyCursor(motion.cursor), speed: 0, status: 'paused' }
}

export const stopRailTrain = pauseRailTrain

/** 毎フレームの完全に管理された加減速更新。物理エンジンは使わない。 */
export function updateRailTrainMotion(
  motion: RailTrainMotion,
  pieces: readonly RailPiece[],
  deltaSeconds: number,
): RailTrainMotion {
  // 実際のRAFはengine側で0.1秒程度に制限するが、純粋関数として
  // 大きめのテスト刻みを渡しても安全に停止位置へ着けるようにする。
  const delta = finite(deltaSeconds) ? Math.min(1, Math.max(0, deltaSeconds)) : 0
  if (motion.status === 'ready' || motion.status === 'waiting' || motion.status === 'paused') {
    return { ...motion, cursor: copyCursor(motion.cursor), speed: 0 }
  }
  if (motion.status === 'stoppedAtStation') {
    const elapsed = Math.max(0, motion.stationStopElapsed ?? 0) + delta
    if (elapsed + EPSILON < TRAIN_STATION_STOP_DURATION) {
      return {
        ...motion,
        cursor: copyCursor(motion.cursor),
        speed: 0,
        stationStopElapsed: elapsed,
      }
    }
    // 停車時間を満たしたら、次のフレームから自然に加速する。
    return {
      ...motion,
      cursor: copyCursor(motion.cursor),
      speed: 0,
      status: 'departing',
      stationStopElapsed: elapsed,
    }
  }
  if (delta <= EPSILON) return { ...motion, cursor: copyCursor(motion.cursor) }

  const cursor = cursorWithDistance(motion.cursor, pieces)
  let stationServicedId = motion.stationServicedId
  // 駅pieceを抜けたら同じ駅を再び探索対象に戻す。ループでは次周に再停車できる。
  if (stationServicedId !== undefined && cursor.pieceId !== stationServicedId) {
    stationServicedId = undefined
  }
  const forwardDistance = distanceToRailTrainDeadEnd(pieces, cursor)
  const deadEndAvailable = finite(forwardDistance)
    ? Math.max(0, forwardDistance - TRAIN_END_STOP_MARGIN)
    : Infinity
  const nextStation = findNextRailTrainStation(pieces, cursor, stationServicedId)
  const stationDistance = nextStation?.distance ?? Infinity
  const stationIsBeforeDeadEnd = stationDistance < deadEndAvailable - EPSILON
  const available = stationIsBeforeDeadEnd ? stationDistance : deadEndAvailable
  const currentSpeed = finite(motion.speed) ? Math.max(0, motion.speed) : 0
  const brakingTarget = finite(available)
    ? Math.sqrt(Math.max(0, 2 * TRAIN_DECELERATION * available))
    : TRAIN_MAX_SPEED
  const targetSpeed = Math.min(TRAIN_MAX_SPEED, brakingTarget)
  const nextSpeed = targetSpeed >= currentSpeed
    ? Math.min(targetSpeed, currentSpeed + TRAIN_ACCELERATION * delta)
    : Math.max(targetSpeed, currentSpeed - TRAIN_DECELERATION * delta)
  const travelled = Math.min(
    finite(available) ? available : Infinity,
    ((currentSpeed + nextSpeed) / 2) * delta,
  )
  const nextCursor = travelled > EPSILON
    ? advanceRailTrainCursor(pieces, cursor, travelled)
    : cursor
  const nextForwardDistance = distanceToRailTrainDeadEnd(pieces, nextCursor)
  const reachedReservedStop = finite(available) && travelled >= available - 1e-5
  const atStop = finite(nextForwardDistance)
    && nextForwardDistance <= TRAIN_END_STOP_MARGIN + 1e-5
    && (nextSpeed <= 0.03 || reachedReservedStop)

  if (stationIsBeforeDeadEnd && reachedReservedStop && nextStation !== null) {
    return {
      cursor: nextCursor,
      speed: 0,
      status: 'stoppedAtStation',
      stationServicedId: nextStation.stationId,
      stationStopElapsed: 0,
    }
  }

  if (atStop) {
    return {
      cursor: nextCursor,
      speed: 0,
      status: 'waiting',
      stationServicedId,
    }
  }

  const wasDeparting = motion.status === 'departing'
  const hasLeftServicedStation = wasDeparting
    && stationServicedId !== undefined
    && nextCursor.pieceId !== stationServicedId
  const nextStatus: RailTrainStatus = hasLeftServicedStation
    ? 'running'
    : stationIsBeforeDeadEnd
      && (stationDistance <= TRAIN_STATION_APPROACH_DISTANCE || motion.status === 'approachingStation')
      ? 'approachingStation'
      : wasDeparting
        ? 'departing'
        : 'running'

  return {
    cursor: nextCursor,
    speed: nextSpeed,
    status: nextStatus,
    stationServicedId: hasLeftServicedStation ? undefined : stationServicedId,
  }
}

export const updateTrainMotion = updateRailTrainMotion
export const tickRailTrain = updateRailTrainMotion
