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
// 車種ごとの表示両数ではなく、配置・占有判定・列車間隔で予約する最大編成両数。
// 現在はE5の「先頭 + 中間 + 最後尾」に合わせ、2両車種にも安全側で適用する。
export const TRAIN_CAR_COUNT = 3

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
export type RailTrainDirection = 'a-to-b' | 'b-to-a' | 'a-to-c' | 'c-to-a' | 'c-to-d' | 'd-to-c'
export type TrainDirection = RailTrainDirection

export type RailTrainCursor = {
  pieceId: string
  direction: RailTrainDirection
  /** 進行方向の入口コネクタから測った距離。 */
  distance: number
}

export type TrainCursor = RailTrainCursor

/**
 * 先頭車が実際に通過したrouteの1区間。pieceIdだけでは同じpieceを
 * ループで何度も通った順序や、分岐のA-B/A-Cを区別できないため、
 * directionと区間へ入ったときの距離も一緒に保持する。
 */
export type RailTrainRouteHistoryEntry = {
  pieceId: string
  direction: RailTrainDirection
  /** この区間へ入った時点の、入口connectorからの距離。 */
  startDistance: number
}

export const TRAIN_ROUTE_HISTORY_MAX_ENTRIES = 128
export const TRAIN_ROUTE_HISTORY_MAX_DISTANCE = 64

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
  /**
   * 直近の先頭車route。cursorだけからは、分岐を逆向きに戻るときに
   * 先頭車が実際に選んだ側を復元できないため、編成後続車の位置にも使う。
   * 旧状態やテストの手組みmotionとの互換性のためoptionalだが、走行更新後は保持する。
   */
  routeHistory?: RailTrainRouteHistoryEntry[]
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

/** cursorのrouteに対応するPath。A-CはbranchPath、C-DはsecondaryPath、それ以外は従来path。 */
export function railPathForTrainDirection(
  piece: RailPiece,
  direction: RailTrainDirection,
): RailPath | null {
  if (direction === 'a-to-c' || direction === 'c-to-a') {
    return piece.kind === 'branch' && piece.branchPath !== undefined ? piece.branchPath : null
  }
  if (direction === 'c-to-d' || direction === 'd-to-c') {
    return piece.kind === 'depot' && piece.secondaryPath !== undefined ? piece.secondaryPath : null
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
  if (direction === 'c-to-d') return 'c'
  if (direction === 'd-to-c') return 'd'
  return direction === 'b-to-a' ? 'b' : 'c'
}

function exitConnector(direction: RailTrainDirection): RailConnectorId {
  if (direction === 'a-to-b') return 'b'
  if (direction === 'a-to-c') return 'c'
  if (direction === 'c-to-d') return 'd'
  if (direction === 'd-to-c') return 'c'
  return 'a'
}

function oppositeRailTrainDirection(direction: RailTrainDirection): RailTrainDirection {
  if (direction === 'a-to-b') return 'b-to-a'
  if (direction === 'b-to-a') return 'a-to-b'
  if (direction === 'a-to-c') return 'c-to-a'
  if (direction === 'c-to-a') return 'a-to-c'
  if (direction === 'c-to-d') return 'd-to-c'
  return 'c-to-d'
}

/** 接続先へ入る瞬間にbranchDirectionを読み、列車固有のrouteを確定する。 */
function directionLeavingConnector(
  piece: RailPiece,
  connectorId: RailConnectorId,
): RailTrainDirection {
  if (piece.kind === 'depot') {
    if (connectorId === 'a') return 'a-to-b'
    if (connectorId === 'b') return 'b-to-a'
    if (connectorId === 'c') return 'c-to-d'
    if (connectorId === 'd') return 'd-to-c'
  }
  if (connectorId === 'a') {
    return piece.kind === 'branch' && piece.branchDirection === 'c' ? 'a-to-c' : 'a-to-b'
  }
  return connectorId === 'c' ? 'c-to-a' : 'b-to-a'
}

function directionArrivingAtConnector(
  piece: RailPiece,
  connectorId: RailConnectorId,
): RailTrainDirection {
  if (piece.kind === 'depot') {
    if (connectorId === 'b') return 'a-to-b'
    if (connectorId === 'a') return 'b-to-a'
    if (connectorId === 'd') return 'c-to-d'
    if (connectorId === 'c') return 'd-to-c'
  }
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
    && connection.connectorId !== 'd'
  ) return null
  const nextPiece = railPieceForId(pieces, connection.pieceId)
  // 'c' はbranchの副線入口またはdepotの2番線入口としてだけ有効。
  // 'd' はdepotの2番線出口としてだけ有効。壊れたデータは安全に弾く。
  if (
    connection.connectorId === 'c'
    && nextPiece?.kind !== 'branch'
    && nextPiece?.kind !== 'depot'
  ) return null
  if (connection.connectorId === 'd' && nextPiece?.kind !== 'depot') return null
  return nextPiece === undefined ? null : { piece: nextPiece, connectorId: connection.connectorId }
}

function cursorWithDistance(cursor: RailTrainCursor, pieces: readonly RailPiece[]): RailTrainCursor {
  const direction = cursor.direction === 'b-to-a'
    || cursor.direction === 'a-to-c'
    || cursor.direction === 'c-to-a'
    || cursor.direction === 'c-to-d'
    || cursor.direction === 'd-to-c'
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

function copyRouteHistory(
  history: readonly RailTrainRouteHistoryEntry[] | undefined,
): RailTrainRouteHistoryEntry[] | undefined {
  return history === undefined ? undefined : history.map((entry) => ({ ...entry }))
}

function sameRoutePosition(
  a: Pick<RailTrainRouteHistoryEntry, 'pieceId' | 'direction'>,
  b: Pick<RailTrainRouteHistoryEntry, 'pieceId' | 'direction'>,
): boolean {
  return a.pieceId === b.pieceId && a.direction === b.direction
}

function routeHistoryEntryIsUsable(
  pieces: readonly RailPiece[],
  entry: RailTrainRouteHistoryEntry,
): boolean {
  return finite(entry.startDistance)
    && entry.startDistance >= -EPSILON
    && validPiece(pieces, entry.pieceId, entry.direction) !== null
}

/**
 * historyが現在のcursorに連続していなければ、そこを新しい配置起点として
 * reseedする。線路編集でpiece自体が残っている場合は、保存したdirectionを
 * そのまま使うので、現在のbranchDirection変更で過去routeが書き換わらない。
 */
function routeHistoryFromCursor(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
  history: readonly RailTrainRouteHistoryEntry[] | undefined,
): RailTrainRouteHistoryEntry[] {
  const normalized = cursorWithDistance(cursor, pieces)
  const usable = (history ?? []).filter((entry) => routeHistoryEntryIsUsable(pieces, entry))
  const latest = usable[usable.length - 1]
  if (
    latest === undefined
    || !sameRoutePosition(latest, normalized)
    || normalized.distance + EPSILON < latest.startDistance
  ) {
    return [{
      pieceId: normalized.pieceId,
      direction: normalized.direction,
      startDistance: normalized.distance,
    }]
  }
  return usable
}

function routeHistoryDistanceBehind(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
  history: readonly RailTrainRouteHistoryEntry[],
): number {
  const latest = history[history.length - 1]
  if (latest === undefined || !sameRoutePosition(latest, cursor)) return 0
  let total = Math.max(0, cursor.distance - latest.startDistance)
  for (let index = history.length - 2; index >= 0; index -= 1) {
    const entry = history[index]!
    const resolved = validPiece(pieces, entry.pieceId, entry.direction)
    if (resolved === null) continue
    total += Math.max(0, resolved.length - clampDistance(entry.startDistance, resolved.length))
  }
  return total
}

/**
 * 古い区間は捨てるが、最後尾車両が必要とする距離は必ず残す。距離上限は
 * 通常の編成間隔より十分大きく、同じpieceを周回する履歴も順序を保ったまま
 * boundedにする。
 */
function trimRouteHistory(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
  history: readonly RailTrainRouteHistoryEntry[],
): RailTrainRouteHistoryEntry[] {
  let trimmed = history.map((entry) => ({ ...entry }))
  const minimumRetainedDistance = TRAIN_CAR_SPACING * (TRAIN_CAR_COUNT - 1)
  while (trimmed.length > 1) {
    const overEntryLimit = trimmed.length > TRAIN_ROUTE_HISTORY_MAX_ENTRIES
    const overDistanceLimit = routeHistoryDistanceBehind(pieces, cursor, trimmed)
      > TRAIN_ROUTE_HISTORY_MAX_DISTANCE + EPSILON
    if (!overEntryLimit && !overDistanceLimit) break
    const candidate = trimmed.slice(1)
    // A malformed/degenerate topology may not provide enough distance after a
    // trim; retain the old entry in that case so the last car stays on route.
    if (routeHistoryDistanceBehind(pieces, cursor, candidate) + EPSILON < minimumRetainedDistance) break
    trimmed = candidate
  }
  return trimmed
}

function appendRouteHistoryEntry(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
  history: readonly RailTrainRouteHistoryEntry[],
): RailTrainRouteHistoryEntry[] {
  // This function is called only after a real connector transition. Even when
  // a loop re-enters the same piece in the same direction, retain a new
  // occurrence instead of collapsing it by pieceId/direction.
  const next = [...history, {
    pieceId: cursor.pieceId,
    direction: cursor.direction,
    startDistance: cursor.distance,
  }]
  return trimRouteHistory(pieces, cursor, next)
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
  return normalized.direction === 'a-to-b' || normalized.direction === 'a-to-c' || normalized.direction === 'c-to-d'
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
    const forward = normalized.direction === 'a-to-b' || normalized.direction === 'a-to-c' || normalized.direction === 'c-to-d'
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
function advanceRailTrainCursorWithRouteHistory(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
  distance: number,
  routeHistory?: readonly RailTrainRouteHistoryEntry[],
): { cursor: RailTrainCursor; routeHistory: RailTrainRouteHistoryEntry[] } {
  let current = cursorWithDistance(cursor, pieces)
  let history = routeHistoryFromCursor(pieces, current, routeHistory)
  let remaining = finite(distance) ? Math.max(0, distance) : 0
  if (remaining <= EPSILON) {
    return { cursor: current, routeHistory: trimRouteHistory(pieces, current, history) }
  }

  for (let iteration = 0; iteration < DEFAULT_ITERATION_GUARD; iteration += 1) {
    const resolved = validPiece(pieces, current.pieceId, current.direction)
    if (resolved === null) return { cursor: current, routeHistory: history }
    current.distance = clampDistance(current.distance, resolved.length)
    const toExit = Math.max(0, resolved.length - current.distance)
    const connection = findConnection(pieces, resolved.piece, exitConnector(current.direction))
    // 接続のある端点では、ちょうど端まで進んだ時も次のpieceの入口を
    // 正規形にする。接続がなければ、そのpieceの端点で止める。
    if (remaining < toExit - EPSILON || connection === null) {
      current.distance = Math.min(resolved.length, current.distance + remaining)
      if (connection === null) return { cursor: current, routeHistory: history }
      if (remaining <= toExit + EPSILON) {
        return { cursor: current, routeHistory: trimRouteHistory(pieces, current, history) }
      }
    }

    remaining -= toExit
    if (connection === null) {
      current.distance = resolved.length
      return { cursor: current, routeHistory: history }
    }
    const nextDirection = directionLeavingConnector(connection.piece, connection.connectorId)
    const next = validPiece(pieces, connection.piece.id, nextDirection)
    if (next === null) {
      current.distance = resolved.length
      return { cursor: current, routeHistory: history }
    }
    current = {
      pieceId: next.piece.id,
      direction: nextDirection,
      distance: 0,
    }
    // Record the exact transition selected by directionLeavingConnector. This
    // is intentionally an ordered list: a pieceId map loses loop occurrences.
    history = appendRouteHistoryEntry(pieces, current, history)
    if (remaining <= EPSILON) return { cursor: current, routeHistory: history }
  }

  // 無限ループや壊れたトポロジーでも、描画ループを止めず現在位置を返す。
  return { cursor: current, routeHistory: history }
}

export function advanceRailTrainCursor(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
  distance: number,
): RailTrainCursor {
  return advanceRailTrainCursorWithRouteHistory(pieces, cursor, distance).cursor
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

/**
 * 先頭車のroute履歴を使って後続車を戻す。履歴にない古い距離だけは従来の
 * topology探索へ渡すが、直近の分岐通過については現在のbranchDirectionを
 * 参照しないため、先頭車と同じA-B/A-Cを確実に選べる。
 */
function retreatRailTrainCursorAlongHistory(
  pieces: readonly RailPiece[],
  cursor: RailTrainCursor,
  distance: number,
  routeHistory: readonly RailTrainRouteHistoryEntry[],
): RailTrainCursor | null {
  const current = cursorWithDistance(cursor, pieces)
  const history = routeHistory.filter((entry) => routeHistoryEntryIsUsable(pieces, entry))
  let index = history.length - 1
  while (index >= 0 && !sameRoutePosition(history[index]!, current)) index -= 1
  if (index < 0) return null

  const latest = history[index]!
  if (current.distance + EPSILON < latest.startDistance) return null
  let remaining = finite(distance) ? Math.max(0, distance) : 0
  const availableOnCurrent = Math.max(0, current.distance - latest.startDistance)
  if (remaining < availableOnCurrent - EPSILON) {
    return { ...current, distance: current.distance - remaining }
  }
  if (remaining <= availableOnCurrent + EPSILON) {
    return { ...current, distance: latest.startDistance }
  }
  remaining -= availableOnCurrent

  for (index -= 1; index >= 0; index -= 1) {
    const entry = history[index]!
    const resolved = validPiece(pieces, entry.pieceId, entry.direction)
    if (resolved === null) return null
    const startDistance = clampDistance(entry.startDistance, resolved.length)
    const available = Math.max(0, resolved.length - startDistance)
    if (remaining < available - EPSILON) {
      return {
        pieceId: entry.pieceId,
        direction: entry.direction,
        distance: resolved.length - remaining,
      }
    }
    if (remaining <= available + EPSILON) {
      return {
        pieceId: entry.pieceId,
        direction: entry.direction,
        distance: resolved.length,
      }
    }
    remaining -= available
  }

  // The requested spacing can exceed retained history (for example, a caller
  // asks for more than the three-car formation). Continue safely from the
  // oldest recorded position using the existing topology fallback.
  const oldest = history[0]
  if (oldest === undefined) return null
  const oldestCursor: RailTrainCursor = {
    pieceId: oldest.pieceId,
    direction: oldest.direction,
    distance: clampDistance(
      oldest.startDistance,
      validPiece(pieces, oldest.pieceId, oldest.direction)?.length ?? oldest.startDistance,
    ),
  }
  return retreatRailTrainCursor(pieces, oldestCursor, remaining)
}

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
  routeHistory?: readonly RailTrainRouteHistoryEntry[],
): RailTrainCursor[] {
  const count = Math.max(1, Math.floor(carCount))
  const result: RailTrainCursor[] = []
  for (let index = 0; index < count; index += 1) {
    const distance = Math.max(0, spacing) * index
    const fromHistory = routeHistory !== undefined && routeHistory.length > 0
      ? retreatRailTrainCursorAlongHistory(pieces, cursor, distance, routeHistory)
      : null
    result.push(fromHistory ?? retreatRailTrainCursor(pieces, cursor, distance))
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
  routeHistory?: readonly RailTrainRouteHistoryEntry[],
): RailTrainPose[] {
  return railTrainCarCursors(pieces, cursor, carCount, spacing, routeHistory)
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
  routeHistory?: readonly RailTrainRouteHistoryEntry[],
): string[] {
  const occupied = new Set<string>()
  for (const carCursor of railTrainCarCursors(pieces, cursor, carCount, spacing, routeHistory)) {
    if (validPiece(pieces, carCursor.pieceId, carCursor.direction) !== null) occupied.add(carCursor.pieceId)
  }
  return [...occupied]
}

export const getOccupiedRailPieceIds = occupiedRailPieceIds
export const occupiedRailIds = occupiedRailPieceIds

export type NearestRailTrainCursor = {
  cursor: RailTrainCursor
  /** 与えた点と、レール上の最寄り点との3D距離。 */
  distance: number
}

export type NearestRailTrainCursorOptions = {
  /** これより遠いときは null。既定 8。 */
  maxDistance?: number
  /** 進行方向の維持に使う参照ベクトル。接線との内積が負なら逆向きのdirectionを返す。 */
  preferForward?: RailVec3
}

const NEAREST_CURSOR_MAX_DISTANCE = 8
const NEAREST_CURSOR_SAMPLES = 48
const NEAREST_CURSOR_REFINE_PASSES = 4

function pointDistance(a: RailVec3, b: RailVec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

/** pieceが走行に使う正方向のroute一覧。分岐・車庫の副線もドラッグ配置の対象にする。 */
function forwardRailTrainDirectionsForPiece(piece: RailPiece): RailTrainDirection[] {
  const directions: RailTrainDirection[] = ['a-to-b']
  if (piece.kind === 'branch' && piece.branchPath !== undefined) directions.push('a-to-c')
  if (piece.kind === 'depot' && piece.secondaryPath !== undefined) directions.push('c-to-d')
  return directions
}

/**
 * pathを粗くサンプリングしてから、最寄りサンプルの前後だけを数回細分し、
 * 与えた点に最も近いtとその3D距離を求める。壊れたPathでも安全にnullを返す。
 */
function nearestParameterOnPath(
  piece: RailPiece,
  path: RailPath,
  point: RailVec3,
): { t: number; distance: number } | null {
  try {
    let bestT = 0
    let bestDistance = Infinity
    for (let index = 0; index <= NEAREST_CURSOR_SAMPLES; index += 1) {
      const t = index / NEAREST_CURSOR_SAMPLES
      const distance = pointDistance(worldRailPathPoint(piece, t, path), point)
      if (distance < bestDistance) {
        bestDistance = distance
        bestT = t
      }
    }

    let step = 1 / NEAREST_CURSOR_SAMPLES
    for (let pass = 0; pass < NEAREST_CURSOR_REFINE_PASSES; pass += 1) {
      const nextStep = step / 3
      if (nextStep <= EPSILON) break
      for (let index = -1; index <= 1; index += 1) {
        if (index === 0) continue
        const t = Math.min(1, Math.max(0, bestT + nextStep * index))
        const distance = pointDistance(worldRailPathPoint(piece, t, path), point)
        if (distance < bestDistance) {
          bestDistance = distance
          bestT = t
        }
      }
      step = nextStep
    }

    return { t: bestT, distance: bestDistance }
  } catch {
    return null
  }
}

/**
 * 3D空間の任意の点から、レール上の最寄りカーソルを求める純粋関数。
 * 電車をドラッグして線路上へ配置する操作の当たり判定に使う。
 */
export function findNearestRailTrainCursor(
  pieces: readonly RailPiece[],
  point: RailVec3,
  options?: NearestRailTrainCursorOptions,
): NearestRailTrainCursor | null {
  const maxDistance = options?.maxDistance !== undefined && finite(options.maxDistance)
    ? Math.max(0, options.maxDistance)
    : NEAREST_CURSOR_MAX_DISTANCE

  let best: {
    piece: RailPiece
    path: RailPath
    canonicalDirection: RailTrainDirection
    length: number
    t: number
    spatialDistance: number
  } | null = null

  for (const piece of pieces) {
    for (const direction of forwardRailTrainDirectionsForPiece(piece)) {
      const resolved = validPiece(pieces, piece.id, direction)
      if (resolved === null) continue
      const nearest = nearestParameterOnPath(resolved.piece, resolved.path, point)
      if (nearest === null || nearest.distance > maxDistance + EPSILON) continue
      if (best !== null && nearest.distance >= best.spatialDistance) continue
      best = {
        piece: resolved.piece,
        path: resolved.path,
        canonicalDirection: direction,
        length: resolved.length,
        t: nearest.t,
        spatialDistance: nearest.distance,
      }
    }
  }

  if (best === null) return null

  let direction = best.canonicalDirection
  if (options?.preferForward !== undefined) {
    const tangent = worldRailPathTangent(best.piece, best.t, best.path)
    const dot = tangent.x * options.preferForward.x
      + tangent.y * options.preferForward.y
      + tangent.z * options.preferForward.z
    if (dot < 0) direction = oppositeRailTrainDirection(direction)
  }

  // distanceは進行方向の入口コネクタから測る。正方向のときはt*length、
  // preferForwardで逆向きになったときは端から測り直す。
  const forwardDistance = clampDistance(best.t * best.length, best.length)
  const distance = direction === best.canonicalDirection
    ? forwardDistance
    : best.length - forwardDistance

  return {
    cursor: { pieceId: best.piece.id, direction, distance },
    distance: best.spatialDistance,
  }
}

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
    routeHistory: [{
      pieceId: resolved.piece.id,
      direction,
      startDistance,
    }],
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
    return {
      ...motion,
      cursor: copyCursor(motion.cursor),
      routeHistory: copyRouteHistory(motion.routeHistory),
      speed: Math.max(0, motion.speed),
    }
  }
  return {
    ...motion,
    cursor: copyCursor(motion.cursor),
    routeHistory: copyRouteHistory(motion.routeHistory),
    speed: Math.max(0, motion.speed),
    status: 'running',
  }
}

export const restartRailTrain = startRailTrain
export const startTrainMotion = startRailTrain

/** 個別停止。cursorと駅サービス情報は保持する。 */
export function pauseRailTrain(motion: RailTrainMotion): RailTrainMotion {
  return {
    ...motion,
    cursor: copyCursor(motion.cursor),
    routeHistory: copyRouteHistory(motion.routeHistory),
    speed: 0,
    status: 'paused',
  }
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
    return {
      ...motion,
      cursor: copyCursor(motion.cursor),
      routeHistory: copyRouteHistory(motion.routeHistory),
      speed: 0,
    }
  }
  if (motion.status === 'stoppedAtStation') {
    const elapsed = Math.max(0, motion.stationStopElapsed ?? 0) + delta
    if (elapsed + EPSILON < TRAIN_STATION_STOP_DURATION) {
      return {
        ...motion,
        cursor: copyCursor(motion.cursor),
        routeHistory: copyRouteHistory(motion.routeHistory),
        speed: 0,
        stationStopElapsed: elapsed,
      }
    }
    // 停車時間を満たしたら、次のフレームから自然に加速する。
    return {
      ...motion,
      cursor: copyCursor(motion.cursor),
      routeHistory: copyRouteHistory(motion.routeHistory),
      speed: 0,
      status: 'departing',
      stationStopElapsed: elapsed,
    }
  }
  if (delta <= EPSILON) {
    return {
      ...motion,
      cursor: copyCursor(motion.cursor),
      routeHistory: copyRouteHistory(motion.routeHistory),
    }
  }

  const cursor = cursorWithDistance(motion.cursor, pieces)
  const routeHistory = routeHistoryFromCursor(pieces, cursor, motion.routeHistory)
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
  const moved = travelled > EPSILON
    ? advanceRailTrainCursorWithRouteHistory(pieces, cursor, travelled, routeHistory)
    : { cursor, routeHistory: trimRouteHistory(pieces, cursor, routeHistory) }
  const nextCursor = moved.cursor
  const nextRouteHistory = moved.routeHistory
  const nextForwardDistance = distanceToRailTrainDeadEnd(pieces, nextCursor)
  const reachedReservedStop = finite(available) && travelled >= available - 1e-5
  const atStop = finite(nextForwardDistance)
    && nextForwardDistance <= TRAIN_END_STOP_MARGIN + 1e-5
    && (nextSpeed <= 0.03 || reachedReservedStop)

  if (stationIsBeforeDeadEnd && reachedReservedStop && nextStation !== null) {
    return {
      cursor: nextCursor,
      routeHistory: nextRouteHistory,
      speed: 0,
      status: 'stoppedAtStation',
      stationServicedId: nextStation.stationId,
      stationStopElapsed: 0,
    }
  }

  if (atStop) {
    return {
      cursor: nextCursor,
      routeHistory: nextRouteHistory,
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
    routeHistory: nextRouteHistory,
    speed: nextSpeed,
    status: nextStatus,
    stationServicedId: hasLeftServicedStation ? undefined : stationServicedId,
  }
}

export const updateTrainMotion = updateRailTrainMotion
export const tickRailTrain = updateRailTrainMotion
