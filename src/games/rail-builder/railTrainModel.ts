import {
  railPathLength,
  type RailConnectorId,
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

export type RailTrainDirection = 'a-to-b' | 'b-to-a'
export type TrainDirection = RailTrainDirection

export type RailTrainCursor = {
  pieceId: string
  direction: RailTrainDirection
  /** 進行方向の入口コネクタから測った距離。 */
  distance: number
}

export type TrainCursor = RailTrainCursor

export type RailTrainStatus = 'ready' | 'running' | 'waiting'
export type TrainStatus = RailTrainStatus

export type RailTrainMotion = {
  cursor: RailTrainCursor
  speed: number
  status: RailTrainStatus
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

function validPiece(pieces: readonly RailPiece[], pieceId: string): ValidPiece | null {
  const piece = pieces.find((candidate) => candidate.id === pieceId)
  if (piece === undefined || piece.path === undefined) return null
  try {
    const length = railPathLength(piece.path)
    if (!finite(length) || length < 0) return null
    return { piece, length }
  } catch {
    return null
  }
}

function clampDistance(distance: number, length: number): number {
  if (!finite(distance)) return distance > 0 ? length : 0
  return Math.min(length, Math.max(0, distance))
}

function entryConnector(direction: RailTrainDirection): RailConnectorId {
  return direction === 'a-to-b' ? 'a' : 'b'
}

function exitConnector(direction: RailTrainDirection): RailConnectorId {
  return direction === 'a-to-b' ? 'b' : 'a'
}

function directionLeavingConnector(connectorId: RailConnectorId): RailTrainDirection {
  return connectorId === 'a' ? 'a-to-b' : 'b-to-a'
}

function directionArrivingAtConnector(connectorId: RailConnectorId): RailTrainDirection {
  return connectorId === 'a' ? 'b-to-a' : 'a-to-b'
}

function findConnection(
  pieces: readonly RailPiece[],
  piece: RailPiece,
  connectorId: RailConnectorId,
): { piece: RailPiece; connectorId: RailConnectorId } | null {
  const connection = piece.connections?.[connectorId]
  if (connection === undefined || typeof connection.pieceId !== 'string') return null
  if (connection.connectorId !== 'a' && connection.connectorId !== 'b') return null
  const nextPiece = pieces.find((candidate) => candidate.id === connection.pieceId)
  return nextPiece === undefined ? null : { piece: nextPiece, connectorId: connection.connectorId }
}

function cursorWithDistance(cursor: RailTrainCursor, pieces: readonly RailPiece[]): RailTrainCursor {
  const resolved = validPiece(pieces, cursor.pieceId)
  if (resolved === null) return copyCursor(cursor)
  return {
    pieceId: cursor.pieceId,
    direction: cursor.direction === 'b-to-a' ? 'b-to-a' : 'a-to-b',
    distance: clampDistance(cursor.distance, resolved.length),
  }
}

/** カーソルの距離を、そのpieceのローカルパラメータへ変換する。 */
export function railTrainCursorT(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
): number | null {
  const resolved = validPiece(pieces, cursor.pieceId)
  if (resolved === null || resolved.length <= EPSILON) return resolved === null ? null : 0
  const normalized = cursorWithDistance(cursor, pieces)
  const fraction = normalized.distance / resolved.length
  return normalized.direction === 'a-to-b' ? fraction : 1 - fraction
}

/** カーソルを線路上のワールド姿勢へ変換する。 */
export function sampleRailTrainPose(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
): RailTrainPose | null {
  const resolved = validPiece(pieces, cursor.pieceId)
  if (resolved === null) return null
  const normalized = cursorWithDistance(cursor, pieces)
  const t = railTrainCursorT(pieces, normalized)
  if (t === null || !finite(t)) return null
  try {
    const position = worldRailPathPoint(resolved.piece, t)
    const tangent = worldRailPathTangent(resolved.piece, t)
    const forward = normalized.direction === 'a-to-b'
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
    const resolved = validPiece(pieces, current.pieceId)
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
    const next = validPiece(pieces, connection.piece.id)
    if (next === null) {
      current.distance = resolved.length
      return current
    }
    current = {
      pieceId: next.piece.id,
      direction: directionLeavingConnector(connection.connectorId),
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
    const resolved = validPiece(pieces, current.pieceId)
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
    const previous = validPiece(pieces, connection.piece.id)
    if (previous === null) {
      current.distance = 0
      return current
    }
    current = {
      pieceId: previous.piece.id,
      direction: directionArrivingAtConnector(connection.connectorId),
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
    const resolved = validPiece(pieces, current.pieceId)
    if (resolved === null) return total
    const state = `${resolved.piece.id}:${current.direction}`
    if (seen.has(state)) return Infinity
    seen.add(state)

    current.distance = clampDistance(current.distance, resolved.length)
    total += Math.max(0, resolved.length - current.distance)
    const connection = findConnection(pieces, resolved.piece, exitConnector(current.direction))
    if (connection === null) return total
    const next = validPiece(pieces, connection.piece.id)
    if (next === null) return total
    current = {
      pieceId: next.piece.id,
      direction: directionLeavingConnector(connection.connectorId),
      distance: 0,
    }
  }

  // 反復上限に達したトポロジーは、走行を安全側に扱う。
  return Infinity
}

export const forwardDistanceToDeadEnd = distanceToRailTrainDeadEnd
export const railTrainDistanceToDeadEnd = distanceToRailTrainDeadEnd

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
    if (validPiece(pieces, carCursor.pieceId) !== null) occupied.add(carCursor.pieceId)
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
  const preferred = validPiece(pieces, preferredPieceId)
  const resolved = preferred ?? pieces
    .map((piece) => validPiece(pieces, piece.id))
    .find((candidate): candidate is ValidPiece => candidate !== null)
  if (resolved === undefined || resolved === null) return null
  const startDistance = Math.min(
    Math.max(0, resolved.length - TRAIN_END_STOP_MARGIN),
    Math.max(0, TRAIN_CAR_SPACING * (TRAIN_CAR_COUNT - 1) + 0.35),
  )
  return {
    cursor: {
      pieceId: resolved.piece.id,
      direction: 'a-to-b',
      distance: startDistance,
    },
    speed: 0,
    status: 'ready',
  }
}

export const createInitialTrainMotion = createInitialRailTrainMotion
export const makeInitialRailTrainMotion = createInitialRailTrainMotion

/** 発車・再開。待機中でもカーソルはそのまま保持する。 */
export function startRailTrain(motion: RailTrainMotion): RailTrainMotion {
  return { ...motion, cursor: copyCursor(motion.cursor), speed: Math.max(0, motion.speed), status: 'running' }
}

export const restartRailTrain = startRailTrain
export const startTrainMotion = startRailTrain

/** 毎フレームの完全に管理された加減速更新。物理エンジンは使わない。 */
export function updateRailTrainMotion(
  motion: RailTrainMotion,
  pieces: readonly RailPiece[],
  deltaSeconds: number,
): RailTrainMotion {
  if (motion.status !== 'running') {
    return { ...motion, cursor: copyCursor(motion.cursor), speed: Math.max(0, motion.speed) }
  }
  // 実際のRAFはengine側で0.1秒程度に制限するが、純粋関数として
  // 大きめのテスト刻みを渡しても安全に停止位置へ着けるようにする。
  const delta = finite(deltaSeconds) ? Math.min(1, Math.max(0, deltaSeconds)) : 0
  if (delta <= EPSILON) return { ...motion, cursor: copyCursor(motion.cursor) }

  const cursor = cursorWithDistance(motion.cursor, pieces)
  const forwardDistance = distanceToRailTrainDeadEnd(pieces, cursor)
  const available = finite(forwardDistance)
    ? Math.max(0, forwardDistance - TRAIN_END_STOP_MARGIN)
    : Infinity
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

  return {
    cursor: nextCursor,
    speed: atStop ? 0 : nextSpeed,
    status: atStop ? 'waiting' : 'running',
  }
}

export const updateTrainMotion = updateRailTrainMotion
export const tickRailTrain = updateRailTrainMotion
