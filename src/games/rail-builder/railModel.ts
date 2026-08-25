/**
 * せんろづくりの描画に依存しないデータモデル。
 *
 * X/Z が地面、Y が高さのワールド座標。線路のローカル座標は
 * 「直線なら +X 方向へ進む」ことを基準にそろえる。コネクタの
 * outward は線路の端から外向きの単位ベクトルなので、接続時は
 * 2つの outward が正反対になる。
 */

export type RailVec3 = {
  x: number
  y: number
  z: number
}

export type RailPieceKind = 'straight' | 'curve'
export type CurveDirection = 'left' | 'right'
export type RailConnectorId = 'a' | 'b'

export type RailConnector = {
  id: RailConnectorId
  /** 線路のローカル座標。端点の中心位置。 */
  localPosition: RailVec3
  /** 端から外側を向く単位ベクトル。 */
  outward: RailVec3
  /** X/Z平面上の outward の向き（ラジアン）。 */
  heading: number
}

export type StraightPath = {
  kind: 'straight'
  length: number
}

export type CurvePath = {
  kind: 'curve'
  radius: number
  angle: number
  direction: CurveDirection
}

export type RailPath = StraightPath | CurvePath

export type RailConnection = {
  pieceId: string
  connectorId: RailConnectorId
}

export type RailConnections = Partial<Record<RailConnectorId, RailConnection>>

export type RailPiece = {
  id: string
  kind: RailPieceKind
  position: RailVec3
  rotationY: number
  connectorA: RailConnector
  connectorB: RailConnector
  path: RailPath
  connections: RailConnections
}

export type RailTransform = {
  position: RailVec3
  rotationY: number
}

export type WorldRailConnector = RailConnector & {
  position: RailVec3
}

export type SnapCandidate = {
  movingPieceId: string
  movingConnectorId: RailConnectorId
  targetPieceId: string
  targetConnectorId: RailConnectorId
  transform: RailTransform
  distance: number
  heightDifference: number
  angleDifference: number
}

export type SnapOptions = {
  maxDistance?: number
  maxHeightDifference?: number
  maxAngleDifference?: number
}

export const STRAIGHT_LENGTH = 5
export const CURVE_RADIUS = 4
export const CURVE_ANGLE = Math.PI / 2
export const DEFAULT_SNAP_DISTANCE = 1.15
export const DEFAULT_SNAP_HEIGHT = 0.35
export const DEFAULT_SNAP_ANGLE = (58 * Math.PI) / 180

const EPSILON = 1e-8

const ZERO: RailVec3 = { x: 0, y: 0, z: 0 }

function vec(x: number, y: number, z: number): RailVec3 {
  return { x, y, z }
}

function cloneVec(value: RailVec3): RailVec3 {
  return { x: value.x, y: value.y, z: value.z }
}

function add(a: RailVec3, b: RailVec3): RailVec3 {
  return vec(a.x + b.x, a.y + b.y, a.z + b.z)
}

function subtract(a: RailVec3, b: RailVec3): RailVec3 {
  return vec(a.x - b.x, a.y - b.y, a.z - b.z)
}

function scale(a: RailVec3, amount: number): RailVec3 {
  return vec(a.x * amount, a.y * amount, a.z * amount)
}

function length(a: RailVec3): number {
  return Math.hypot(a.x, a.y, a.z)
}

function normalize(a: RailVec3): RailVec3 {
  const magnitude = length(a)
  return magnitude <= EPSILON ? cloneVec(ZERO) : scale(a, 1 / magnitude)
}

function cleanVec(a: RailVec3): RailVec3 {
  return vec(
    Math.abs(a.x) <= EPSILON ? 0 : a.x,
    Math.abs(a.y) <= EPSILON ? 0 : a.y,
    Math.abs(a.z) <= EPSILON ? 0 : a.z,
  )
}

function rotateY(value: RailVec3, rotationY: number): RailVec3 {
  const cos = Math.cos(rotationY)
  const sin = Math.sin(rotationY)
  // Three.jsのEuler Yと同じ向き（+Xを回すと-Z側へ進む）。
  return vec(
    cos * value.x + sin * value.z,
    value.y,
    -sin * value.x + cos * value.z,
  )
}

function horizontalHeading(value: RailVec3): number {
  return Math.atan2(-value.z, value.x)
}

function cloneConnector(connector: RailConnector): RailConnector {
  return {
    ...connector,
    localPosition: cloneVec(connector.localPosition),
    outward: cloneVec(connector.outward),
  }
}

function clonePath(path: RailPath): RailPath {
  return { ...path }
}

function clonePiece(piece: RailPiece): RailPiece {
  return {
    ...piece,
    position: cloneVec(piece.position),
    connectorA: cloneConnector(piece.connectorA),
    connectorB: cloneConnector(piece.connectorB),
    path: clonePath(piece.path),
    connections: { ...piece.connections },
  }
}

function connector(
  id: RailConnectorId,
  localPosition: RailVec3,
  outward: RailVec3,
): RailConnector {
  const normalizedOutward = cleanVec(normalize(outward))
  return {
    id,
    localPosition: cloneVec(localPosition),
    outward: normalizedOutward,
    heading: horizontalHeading(normalizedOutward),
  }
}

function connectorFor(piece: RailPiece, connectorId: RailConnectorId): RailConnector {
  return connectorId === 'a' ? piece.connectorA : piece.connectorB
}

function setConnection(
  piece: RailPiece,
  connectorId: RailConnectorId,
  connection: RailConnection | undefined,
): RailPiece {
  const next = clonePiece(piece)
  if (connection === undefined) delete next.connections[connectorId]
  else next.connections[connectorId] = { ...connection }
  return next
}

function normalizeAngle(angle: number): number {
  let result = angle
  while (result <= -Math.PI) result += Math.PI * 2
  while (result > Math.PI) result -= Math.PI * 2
  return result
}

function angleBetween(a: RailVec3, b: RailVec3): number {
  const aa = normalize(vec(a.x, 0, a.z))
  const bb = normalize(vec(b.x, 0, b.z))
  if (length(aa) <= EPSILON || length(bb) <= EPSILON) return Math.PI
  return Math.acos(Math.min(1, Math.max(-1, aa.x * bb.x + aa.z * bb.z)))
}

/** Pathの0..1サンプル。曲線は端点と接線がコネクタと一致する。 */
export function sampleRailPath(path: RailPath, t: number): RailVec3 {
  const clampedT = Math.min(1, Math.max(0, t))
  if (path.kind === 'straight') {
    return vec((clampedT - 0.5) * path.length, 0, 0)
  }

  const theta = clampedT * path.angle
  const sign = path.direction === 'left' ? 1 : -1
  // left: (0,-R) -> (R,0), tangent +X -> +Z.
  return cleanVec(vec(
    sign * path.radius * Math.sin(theta),
    0,
    -path.radius * Math.cos(theta),
  ))
}

/** パス上の進行方向（単位ベクトル）。将来の電車の経路追従にも利用できる。 */
export function sampleRailPathTangent(path: RailPath, t: number): RailVec3 {
  const clampedT = Math.min(1, Math.max(0, t))
  if (path.kind === 'straight') return vec(1, 0, 0)

  const theta = clampedT * path.angle
  const sign = path.direction === 'left' ? 1 : -1
  return cleanVec(normalize(vec(
    sign * Math.cos(theta),
    0,
    Math.sin(theta),
  )))
}

function makeConnectors(path: RailPath): [RailConnector, RailConnector] {
  if (path.kind === 'straight') {
    return [
      connector('a', vec(-path.length / 2, 0, 0), vec(-1, 0, 0)),
      connector('b', vec(path.length / 2, 0, 0), vec(1, 0, 0)),
    ]
  }

  const start = sampleRailPath(path, 0)
  const end = sampleRailPath(path, 1)
  const startTangent = sampleRailPathTangent(path, 0)
  const endTangent = sampleRailPathTangent(path, 1)
  return [
    connector('a', start, scale(startTangent, -1)),
    connector('b', end, endTangent),
  ]
}

export function createRailPiece(
  kind: RailPieceKind,
  id = `${kind}-piece`,
  position: RailVec3 = ZERO,
  rotationY = 0,
  curveDirection: CurveDirection = 'left',
): RailPiece {
  const path: RailPath = kind === 'straight'
    ? { kind: 'straight', length: STRAIGHT_LENGTH }
    : {
      kind: 'curve',
      radius: CURVE_RADIUS,
      angle: CURVE_ANGLE,
      direction: curveDirection,
    }
  const [connectorA, connectorB] = makeConnectors(path)
  return {
    id,
    kind,
    position: cloneVec(position),
    rotationY,
    connectorA,
    connectorB,
    path,
    connections: {},
  }
}

/** UIとテストから呼びやすい別名。 */
export const makeRailPiece = createRailPiece

export function getRailConnector(
  piece: RailPiece,
  connectorId: RailConnectorId,
): RailConnector {
  return cloneConnector(connectorFor(piece, connectorId))
}

export function getRailConnectors(piece: RailPiece): RailConnector[] {
  return [cloneConnector(piece.connectorA), cloneConnector(piece.connectorB)]
}

export function worldPointForRailPiece(piece: RailPiece, localPoint: RailVec3): RailVec3 {
  return add(piece.position, rotateY(localPoint, piece.rotationY))
}

export function worldDirectionForRailPiece(piece: RailPiece, localDirection: RailVec3): RailVec3 {
  return normalize(rotateY(localDirection, piece.rotationY))
}

export function worldConnectorForRailPiece(
  piece: RailPiece,
  connectorId: RailConnectorId,
): WorldRailConnector {
  const local = connectorFor(piece, connectorId)
  const outward = worldDirectionForRailPiece(piece, local.outward)
  return {
    ...cloneConnector(local),
    position: worldPointForRailPiece(piece, local.localPosition),
    outward,
    heading: horizontalHeading(outward),
  }
}

export const worldConnector = worldConnectorForRailPiece

export function worldRailPathPoint(piece: RailPiece, t: number): RailVec3 {
  return worldPointForRailPiece(piece, sampleRailPath(piece.path, t))
}

export function distanceBetweenRailPoints(a: RailVec3, b: RailVec3): number {
  return length(subtract(a, b))
}

export function clampRailPosition(position: RailVec3, min = -25, max = 25): RailVec3 {
  return {
    x: Math.min(max, Math.max(min, position.x)),
    y: Math.min(2, Math.max(-2, position.y)),
    z: Math.min(max, Math.max(min, position.z)),
  }
}

function snapTransformForConnectors(
  movingPiece: RailPiece,
  movingConnectorId: RailConnectorId,
  targetPiece: RailPiece,
  targetConnectorId: RailConnectorId,
): RailTransform {
  const movingConnector = connectorFor(movingPiece, movingConnectorId)
  const targetConnector = worldConnectorForRailPiece(targetPiece, targetConnectorId)
  const movingOutwardWorld = worldDirectionForRailPiece(movingPiece, movingConnector.outward)
  const desiredOutward = scale(targetConnector.outward, -1)
  const rotationDelta = normalizeAngle(
    horizontalHeading(desiredOutward) - horizontalHeading(movingOutwardWorld),
  )
  const rotationY = movingPiece.rotationY + rotationDelta
  const rotatedLocalPosition = rotateY(movingConnector.localPosition, rotationY)
  return {
    rotationY,
    position: subtract(targetConnector.position, rotatedLocalPosition),
  }
}

function optionsWithDefaults(options?: SnapOptions) {
  return {
    maxDistance: options?.maxDistance ?? DEFAULT_SNAP_DISTANCE,
    maxHeightDifference: options?.maxHeightDifference ?? DEFAULT_SNAP_HEIGHT,
    maxAngleDifference: options?.maxAngleDifference ?? DEFAULT_SNAP_ANGLE,
  }
}

/**
 * movingPiece の現在の向きで自然に届くコネクタを最近傍順で探す。
 * 位置が閾値内なら、結果のtransformはコネクタ同士を完全一致させる。
 */
export function findRailSnapCandidate(
  movingPiece: RailPiece,
  targets: readonly RailPiece[],
  movingConnectorId?: RailConnectorId,
  options?: SnapOptions,
): SnapCandidate | null {
  const thresholds = optionsWithDefaults(options)
  const movingConnectorIds = movingConnectorId === undefined
    ? (['a', 'b'] as RailConnectorId[])
    : [movingConnectorId]
  const movingWorld = new Map<RailConnectorId, WorldRailConnector>()
  for (const id of movingConnectorIds) movingWorld.set(id, worldConnectorForRailPiece(movingPiece, id))

  let best: SnapCandidate | null = null
  for (const targetPiece of targets) {
    if (targetPiece.id === movingPiece.id) continue
    for (const targetConnectorId of ['a', 'b'] as RailConnectorId[]) {
      if (targetPiece.connections[targetConnectorId] !== undefined) continue
      const targetWorld = worldConnectorForRailPiece(targetPiece, targetConnectorId)
      for (const currentMovingId of movingConnectorIds) {
        if (movingPiece.connections[currentMovingId] !== undefined) continue
        const currentMoving = movingWorld.get(currentMovingId)
        if (currentMoving === undefined) continue
        const distance = distanceBetweenRailPoints(currentMoving.position, targetWorld.position)
        const heightDifference = Math.abs(currentMoving.position.y - targetWorld.position.y)
        const angleDifference = angleBetween(currentMoving.outward, scale(targetWorld.outward, -1))
        if (
          distance > thresholds.maxDistance
          || heightDifference > thresholds.maxHeightDifference
          || angleDifference > thresholds.maxAngleDifference
        ) continue

        if (best !== null && distance >= best.distance) continue
        best = {
          movingPieceId: movingPiece.id,
          movingConnectorId: currentMovingId,
          targetPieceId: targetPiece.id,
          targetConnectorId,
          transform: snapTransformForConnectors(
            movingPiece,
            currentMovingId,
            targetPiece,
            targetConnectorId,
          ),
          distance,
          heightDifference,
          angleDifference,
        }
      }
    }
  }
  return best
}

export const findSnapCandidate = findRailSnapCandidate

function piecesMap(pieces: readonly RailPiece[]): Map<string, RailPiece> {
  return new Map(pieces.map((piece) => [piece.id, piece]))
}

/** 指定した1コネクタと、その相手側だけを切断する。 */
export function disconnectRailConnection(
  pieces: readonly RailPiece[],
  pieceId: string,
  connectorId: RailConnectorId,
): RailPiece[] {
  const next = pieces.map(clonePiece)
  const pieceIndex = next.findIndex((piece) => piece.id === pieceId)
  const piece = next[pieceIndex]
  if (piece === undefined) return next
  const other = piece.connections[connectorId]
  next[pieceIndex] = setConnection(piece, connectorId, undefined)
  if (other === undefined) return next
  const otherIndex = next.findIndex((candidate) => candidate.id === other.pieceId)
  const otherPiece = next[otherIndex]
  if (otherPiece !== undefined) {
    next[otherIndex] = setConnection(otherPiece, other.connectorId, undefined)
  }
  return next
}

export const disconnectConnection = disconnectRailConnection

/** pieceの全接続を相手側からも除去して返す。 */
export function disconnectRailPiece(
  pieces: readonly RailPiece[],
  pieceId: string,
): RailPiece[] {
  const piece = pieces.find((candidate) => candidate.id === pieceId)
  if (piece === undefined) return pieces.map(clonePiece)
  let next = pieces.map(clonePiece)
  for (const connectorId of ['a', 'b'] as RailConnectorId[]) {
    next = disconnectRailConnection(next, pieceId, connectorId)
  }
  return next
}

export const disconnectPiece = disconnectRailPiece

/** 接続中に動かし始めたpieceを切り離し、指定transformを適用する。 */
export function moveRailPiece(
  pieces: readonly RailPiece[],
  pieceId: string,
  transform: Partial<RailTransform>,
): RailPiece[] {
  const disconnected = disconnectRailPiece(pieces, pieceId)
  return disconnected.map((piece) => {
    if (piece.id !== pieceId) return piece
    return {
      ...piece,
      position: transform.position === undefined
        ? piece.position
        : cloneVec(transform.position),
      rotationY: transform.rotationY ?? piece.rotationY,
    }
  })
}

export const movePiece = moveRailPiece

export function rotateRailPiece(
  pieces: readonly RailPiece[],
  pieceId: string,
  angle = Math.PI / 2,
): RailPiece[] {
  const piece = pieces.find((candidate) => candidate.id === pieceId)
  if (piece === undefined) return pieces.map(clonePiece)
  return moveRailPiece(pieces, pieceId, { rotationY: piece.rotationY + angle })
}

export const rotatePiece = rotateRailPiece

/** 2つのコネクタを双方向に接続する。必要なら先に古い接続を外す。 */
export function connectRailPieces(
  pieces: readonly RailPiece[],
  movingPieceId: string,
  movingConnectorId: RailConnectorId,
  targetPieceId: string,
  targetConnectorId: RailConnectorId,
  transform?: RailTransform,
): RailPiece[] {
  if (movingPieceId === targetPieceId) return pieces.map(clonePiece)
  const disconnectedMoving = disconnectRailConnection(pieces, movingPieceId, movingConnectorId)
  const disconnectedTarget = disconnectRailConnection(disconnectedMoving, targetPieceId, targetConnectorId)
  const map = piecesMap(disconnectedTarget)
  const movingPiece = map.get(movingPieceId)
  const targetPiece = map.get(targetPieceId)
  if (movingPiece === undefined || targetPiece === undefined) return disconnectedTarget

  const resolvedTransform = transform ?? snapTransformForConnectors(
    movingPiece,
    movingConnectorId,
    targetPiece,
    targetConnectorId,
  )
  const transformed = disconnectedTarget.map((piece) => (
    piece.id === movingPieceId
      ? {
        ...piece,
        position: cloneVec(resolvedTransform.position),
        rotationY: resolvedTransform.rotationY,
      }
      : piece
  ))
  const result = transformed.map(clonePiece)
  const movingIndex = result.findIndex((piece) => piece.id === movingPieceId)
  const targetIndex = result.findIndex((piece) => piece.id === targetPieceId)
  const movingResult = result[movingIndex]
  const targetResult = result[targetIndex]
  if (movingResult === undefined || targetResult === undefined) return result
  result[movingIndex] = setConnection(movingResult, movingConnectorId, {
    pieceId: targetPieceId,
    connectorId: targetConnectorId,
  })
  result[targetIndex] = setConnection(targetResult, targetConnectorId, {
    pieceId: movingPieceId,
    connectorId: movingConnectorId,
  })
  return result
}

export const connectPieces = connectRailPieces

/** 候補を計算して接続。候補がなければ切断済みのレイアウトを返す。 */
export function snapAndConnectRailPiece(
  pieces: readonly RailPiece[],
  movingPieceId: string,
  options?: SnapOptions,
): RailPiece[] {
  const moving = pieces.find((piece) => piece.id === movingPieceId)
  if (moving === undefined) return pieces.map(clonePiece)
  const disconnected = disconnectRailPiece(pieces, movingPieceId)
  const detachedMoving = disconnected.find((piece) => piece.id === movingPieceId)
  if (detachedMoving === undefined) return disconnected
  const targets = disconnected.filter((piece) => piece.id !== movingPieceId)
  const candidate = findRailSnapCandidate(detachedMoving, targets, undefined, options)
  if (candidate === null) return disconnected
  return connectRailPieces(
    disconnected,
    movingPieceId,
    candidate.movingConnectorId,
    candidate.targetPieceId,
    candidate.targetConnectorId,
    candidate.transform,
  )
}

export function deleteRailPiece(
  pieces: readonly RailPiece[],
  pieceId: string,
): RailPiece[] {
  return disconnectRailPiece(pieces, pieceId).filter((piece) => piece.id !== pieceId)
}

export const removeRailPiece = deleteRailPiece

export function areRailConnectionsSymmetric(pieces: readonly RailPiece[]): boolean {
  const map = piecesMap(pieces)
  for (const piece of pieces) {
    for (const connectorId of ['a', 'b'] as RailConnectorId[]) {
      const connection = piece.connections[connectorId]
      if (connection === undefined) continue
      const target = map.get(connection.pieceId)
      if (target === undefined) return false
      const reverse = target.connections[connection.connectorId]
      if (
        reverse === undefined
        || reverse.pieceId !== piece.id
        || reverse.connectorId !== connectorId
      ) return false
    }
  }
  return true
}

export const hasSymmetricConnections = areRailConnectionsSymmetric
