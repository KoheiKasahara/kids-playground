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

/**
 * 線路パーツの種類。施設も「線路を含むpiece」として扱うことで、
 * 配置・接続・列車のPath追従をPhase 1/2から共有する。
 */
export type RailPieceKind =
  | 'straight'
  | 'short-straight'
  | 'curve'
  | 'slope'
  | 'bridge'
  | 'station'
  | 'tunnel'
  | 'branch'
export type CurveDirection = 'left' | 'right'
export type RailConnectorId = 'a' | 'b' | 'c'
export type RailBranchDirection = 'b' | 'c'

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
  /** パス端点の高さ。未指定は従来どおり地面(y=0)。 */
  startHeight?: number
  endHeight?: number
  /** 坂の高さ補間。smoothstepは端点で水平な接線になる。 */
  elevationCurve?: 'linear' | 'smoothstep'
}

export type CurvePath = {
  kind: 'curve'
  radius: number
  angle: number
  direction: CurveDirection
}

/** 分岐レールの副線にだけ使う、端点と接線が明示された軽量Bezier。 */
export type QuadraticPath = {
  kind: 'quadratic'
  start: RailVec3
  control: RailVec3
  end: RailVec3
}

export type RailPath = StraightPath | CurvePath | QuadraticPath

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
  /** 3つ目の接続点。branchだけが持つ。 */
  connectorC?: RailConnector
  path: RailPath
  /** A-Cを結ぶ副Path。branchだけが持つ。 */
  branchPath?: RailPath
  /** Aから進入した列車が今回選ぶ出口。 */
  branchDirection?: RailBranchDirection
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
export const SHORT_STRAIGHT_LENGTH = 3
export const SLOPE_LENGTH = 7
export const ELEVATED_LENGTH = 6.5
export const STATION_LENGTH = 7
export const TUNNEL_LENGTH = 7
export const BRANCH_LENGTH = 6
export const BRANCH_SPREAD = 3
export const ELEVATED_HEIGHT = 2
export const CURVE_RADIUS = 4
export const CURVE_ANGLE = Math.PI / 2
export const DEFAULT_SNAP_DISTANCE = 1.15
export const DEFAULT_SNAP_HEIGHT = 0.35
export const DEFAULT_SNAP_ANGLE = (58 * Math.PI) / 180

/**
 * ループ閉鎖の補助（通常のsnapでは成立しない終端同士を、玩具として
 * 許容できる範囲でだけ自動でつなげる）に使うしきい値。
 * 通常のDEFAULT_SNAP_*より少し広いが、明らかに離れた/向きが違う
 * 線路まで吸着しないよう、いずれも通常の2倍未満に収めている。
 */
export const LOOP_CLOSURE_MAX_DISTANCE = DEFAULT_SNAP_DISTANCE * 1.85
export const LOOP_CLOSURE_MAX_HEIGHT_DIFFERENCE = DEFAULT_SNAP_HEIGHT * 1.6
export const LOOP_CLOSURE_MAX_ANGLE_DIFFERENCE = (78 * Math.PI) / 180
/** 終端付近で補正を分散する対象の最大パーツ数（今つないだ側を含む）。 */
export const LOOP_CLOSURE_MAX_CHAIN_PIECES = 4
/**
 * 分散補正の配分。先頭が今回閉じる側にいちばん近いパーツ、
 * 以降は奥のパーツほど補正量が小さくなるよう逓減させる。
 * 合計が1未満なので、末尾で触れない一番奥の継ぎ目にはごくわずかな
 * 残差しか出ない。
 */
export const LOOP_CLOSURE_TAPER_WEIGHTS: readonly number[] = [0.55, 0.3, 0.15]

const EPSILON = 1e-8
const pathLengthCache = new WeakMap<RailPath, number>()

/**
 * 駅・トンネル・橋・坂道は高低差や向きに強い意味を持つため、
 * ループ閉鎖の自動補正では動かさない（通常の線路側だけで吸収する）。
 */
const LOOP_CLOSURE_FACILITY_KINDS: ReadonlySet<RailPieceKind> = new Set([
  'station',
  'tunnel',
  'bridge',
  'slope',
])

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
  if (path.kind === 'quadratic') {
    return {
      ...path,
      start: cloneVec(path.start),
      control: cloneVec(path.control),
      end: cloneVec(path.end),
    }
  }
  return { ...path }
}

function clonePiece(piece: RailPiece): RailPiece {
  return {
    ...piece,
    position: cloneVec(piece.position),
    connectorA: cloneConnector(piece.connectorA),
    connectorB: cloneConnector(piece.connectorB),
    connectorC: piece.connectorC === undefined ? undefined : cloneConnector(piece.connectorC),
    path: clonePath(piece.path),
    branchPath: piece.branchPath === undefined ? undefined : clonePath(piece.branchPath),
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
  if (connectorId === 'a') return piece.connectorA
  if (connectorId === 'b') return piece.connectorB
  if (piece.connectorC !== undefined) return piece.connectorC
  // 壊れた外部データでも描画ループを落とさない。通常の呼び出しは
  // getRailConnectorIdsで存在する端点だけを列挙するため、ここには来ない。
  return piece.connectorB
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
  // コネクタの接線は現時点では端点を水平にそろえるが、判定は3Dで行う。
  // 将来、垂直方向の接続点を追加してもXZだけで誤接続しないようにする。
  const aa = normalize(a)
  const bb = normalize(b)
  if (length(aa) <= EPSILON || length(bb) <= EPSILON) return Math.PI
  return Math.acos(Math.min(1, Math.max(-1, aa.x * bb.x + aa.y * bb.y + aa.z * bb.z)))
}

function pathHeight(path: StraightPath, t: number): number {
  const start = Number.isFinite(path.startHeight) ? (path.startHeight ?? 0) : 0
  const end = Number.isFinite(path.endHeight) ? (path.endHeight ?? start) : start
  const clampedT = Math.min(1, Math.max(0, t))
  if (path.elevationCurve !== 'smoothstep') {
    return start + (end - start) * clampedT
  }
  const smoothT = clampedT * clampedT * (3 - 2 * clampedT)
  return start + (end - start) * smoothT
}

function pathHeightDerivative(path: StraightPath, t: number): number {
  const start = Number.isFinite(path.startHeight) ? (path.startHeight ?? 0) : 0
  const end = Number.isFinite(path.endHeight) ? (path.endHeight ?? start) : start
  const clampedT = Math.min(1, Math.max(0, t))
  if (path.elevationCurve !== 'smoothstep') return end - start
  return (end - start) * 6 * clampedT * (1 - clampedT)
}

/** Pathの0..1サンプル。曲線は端点と接線がコネクタと一致する。 */
export function sampleRailPath(path: RailPath, t: number): RailVec3 {
  const clampedT = Math.min(1, Math.max(0, t))
  if (path.kind === 'straight') {
    return vec((clampedT - 0.5) * path.length, pathHeight(path, clampedT), 0)
  }

  if (path.kind === 'quadratic') {
    const inverse = 1 - clampedT
    return cleanVec(vec(
      inverse * inverse * path.start.x + 2 * inverse * clampedT * path.control.x + clampedT * clampedT * path.end.x,
      inverse * inverse * path.start.y + 2 * inverse * clampedT * path.control.y + clampedT * clampedT * path.end.y,
      inverse * inverse * path.start.z + 2 * inverse * clampedT * path.control.z + clampedT * clampedT * path.end.z,
    ))
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
  if (path.kind === 'straight') {
    const horizontalLength = Math.max(EPSILON, Math.abs(path.length))
    return cleanVec(normalize(vec(1, pathHeightDerivative(path, clampedT) / horizontalLength, 0)))
  }
  if (path.kind === 'quadratic') {
    const inverse = 1 - clampedT
    return cleanVec(normalize(vec(
      2 * inverse * (path.control.x - path.start.x) + 2 * clampedT * (path.end.x - path.control.x),
      2 * inverse * (path.control.y - path.start.y) + 2 * clampedT * (path.end.y - path.control.y),
      2 * inverse * (path.control.z - path.start.z) + 2 * clampedT * (path.end.z - path.control.z),
    )))
  }

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
    const start = sampleRailPath(path, 0)
    const end = sampleRailPath(path, 1)
    const startTangent = sampleRailPathTangent(path, 0)
    const endTangent = sampleRailPathTangent(path, 1)
    return [
      connector('a', start, scale(startTangent, -1)),
      connector('b', end, endTangent),
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
    : kind === 'short-straight'
      ? { kind: 'straight', length: SHORT_STRAIGHT_LENGTH }
      : kind === 'slope'
        ? {
          kind: 'straight',
          length: SLOPE_LENGTH,
          startHeight: 0,
          endHeight: ELEVATED_HEIGHT,
          elevationCurve: 'smoothstep',
        }
        : kind === 'bridge'
          ? {
            kind: 'straight',
            length: ELEVATED_LENGTH,
            startHeight: ELEVATED_HEIGHT,
            endHeight: ELEVATED_HEIGHT,
          }
          : kind === 'station'
            ? { kind: 'straight', length: STATION_LENGTH }
            : kind === 'tunnel'
              ? { kind: 'straight', length: TUNNEL_LENGTH }
              : kind === 'branch'
                ? { kind: 'straight', length: BRANCH_LENGTH }
                : {
                  kind: 'curve',
                  radius: CURVE_RADIUS,
                  angle: CURVE_ANGLE,
                  direction: curveDirection,
                }
  const [connectorA, connectorB] = makeConnectors(path)
  const branchPath: RailPath | undefined = kind === 'branch'
    ? {
      kind: 'quadratic',
      start: { x: -BRANCH_LENGTH / 2, y: 0, z: 0 },
      control: { x: 0, y: 0, z: 0 },
      end: { x: BRANCH_LENGTH / 2, y: 0, z: BRANCH_SPREAD },
    }
    : undefined
  const connectorC = branchPath === undefined
    ? undefined
    : connector(
      'c',
      sampleRailPath(branchPath, 1),
      sampleRailPathTangent(branchPath, 1),
    )
  return {
    id,
    kind,
    position: cloneVec(position),
    rotationY,
    connectorA,
    connectorB,
    connectorC,
    path,
    branchPath,
    branchDirection: kind === 'branch' ? 'b' : undefined,
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
  return getRailConnectorIds(piece).map((connectorId) => cloneConnector(connectorFor(piece, connectorId)))
}

/** pieceが実際に持つ端点だけを返す。3端対応処理の列挙元は必ずこれを使う。 */
export function getRailConnectorIds(piece: RailPiece): RailConnectorId[] {
  return piece.kind === 'branch' && piece.connectorC !== undefined
    ? ['a', 'b', 'c']
    : ['a', 'b']
}

/** 分岐の選択出口だけを反転する純粋関数。通常線路は同一内容のcloneを返す。 */
export function toggleRailBranch(
  pieces: readonly RailPiece[],
  pieceId: string,
): RailPiece[] {
  return pieces.map((piece) => {
    const next = clonePiece(piece)
    if (piece.id !== pieceId || piece.kind !== 'branch') return next
    next.branchDirection = piece.branchDirection === 'c' ? 'b' : 'c'
    return next
  })
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

export function worldRailPathPoint(piece: RailPiece, t: number, path: RailPath = piece.path): RailVec3 {
  return worldPointForRailPiece(piece, sampleRailPath(path, t))
}

/** パスの実距離。曲線も弦長ではなく、列車が走る弧の長さを返す。 */
export function railPathLength(path: RailPath): number {
  if (path.kind === 'straight') {
    const horizontalLength = Math.max(0, path.length)
    const start = path.startHeight ?? 0
    const end = path.endHeight ?? start
    if (Math.abs(end - start) <= EPSILON || horizontalLength <= EPSILON) return horizontalLength

    const cached = pathLengthCache.get(path)
    if (cached !== undefined) return cached

    // 坂は高さ補間が非線形なので、固定分割した弦長で実長を近似する。
    // Pathオブジェクト単位でキャッシュし、列車走行中の毎フレーム再計算を避ける。
    const segments = 32
    let total = 0
    let previous = sampleRailPath(path, 0)
    for (let index = 1; index <= segments; index += 1) {
      const next = sampleRailPath(path, index / segments)
      total += length(subtract(next, previous))
      previous = next
    }
    pathLengthCache.set(path, total)
    return total
  }
  if (path.kind === 'curve') return Math.max(0, path.radius) * Math.abs(path.angle)

  const cached = pathLengthCache.get(path)
  if (cached !== undefined) return cached
  const segments = 32
  let total = 0
  let previous = sampleRailPath(path, 0)
  for (let index = 1; index <= segments; index += 1) {
    const next = sampleRailPath(path, index / segments)
    total += length(subtract(next, previous))
    previous = next
  }
  pathLengthCache.set(path, total)
  return total
}

/** パス上の接線をワールド座標へ変換する。 */
export function worldRailPathTangent(piece: RailPiece, t: number, path: RailPath = piece.path): RailVec3 {
  return worldDirectionForRailPiece(piece, sampleRailPathTangent(path, t))
}

export function distanceBetweenRailPoints(a: RailVec3, b: RailVec3): number {
  return length(subtract(a, b))
}

export function clampRailPosition(position: RailVec3, min = -25, max = 25): RailVec3 {
  return {
    x: Math.min(max, Math.max(min, position.x)),
    // 高架の標準高さ(2)に加えて、配置の余裕を少し確保する。
    y: Math.min(ELEVATED_HEIGHT + 3, Math.max(-2, position.y)),
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
    ? getRailConnectorIds(movingPiece)
    : [movingConnectorId]
  const movingWorld = new Map<RailConnectorId, WorldRailConnector>()
  for (const id of movingConnectorIds) movingWorld.set(id, worldConnectorForRailPiece(movingPiece, id))

  let best: SnapCandidate | null = null
  for (const targetPiece of targets) {
    if (targetPiece.id === movingPiece.id) continue
    for (const targetConnectorId of getRailConnectorIds(targetPiece)) {
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

export type SnapNearMiss = {
  movingPieceId: string
  movingConnectorId: RailConnectorId
  targetPieceId: string
  targetConnectorId: RailConnectorId
  /** 3D位置距離。 */
  distance: number
  /** XZ平面だけで見た距離。 */
  horizontalDistance: number
  heightDifference: number
  angleDifference: number
}

/**
 * XZでは接続点が近いのに、高さまたは3D向きが合わず接続できない
 * 「惜しい」候補を返す。自由配置をエラー扱いしないため、距離が
 * snap閾値より少し外側(35%以内)の候補だけを対象にする。
 */
export function findRailSnapNearMiss(
  movingPiece: RailPiece,
  targets: readonly RailPiece[],
  movingConnectorId?: RailConnectorId,
  options?: SnapOptions,
): SnapNearMiss | null {
  const thresholds = optionsWithDefaults(options)
  const movingConnectorIds = movingConnectorId === undefined
    ? getRailConnectorIds(movingPiece)
    : [movingConnectorId]
  const nearDistance = thresholds.maxDistance * 1.35
  let best: SnapNearMiss | null = null

  for (const targetPiece of targets) {
    if (targetPiece.id === movingPiece.id) continue
    for (const targetConnectorId of getRailConnectorIds(targetPiece)) {
      if (targetPiece.connections?.[targetConnectorId] !== undefined) continue
      const targetWorld = worldConnectorForRailPiece(targetPiece, targetConnectorId)
      for (const currentMovingId of movingConnectorIds) {
        if (movingPiece.connections?.[currentMovingId] !== undefined) continue
        const currentMoving = worldConnectorForRailPiece(movingPiece, currentMovingId)
        const dx = currentMoving.position.x - targetWorld.position.x
        const dz = currentMoving.position.z - targetWorld.position.z
        const horizontalDistance = Math.hypot(dx, dz)
        if (horizontalDistance > nearDistance) continue
        const distance = distanceBetweenRailPoints(currentMoving.position, targetWorld.position)
        const heightDifference = Math.abs(currentMoving.position.y - targetWorld.position.y)
        const angleDifference = angleBetween(currentMoving.outward, scale(targetWorld.outward, -1))
        const isValid = distance <= thresholds.maxDistance
          && heightDifference <= thresholds.maxHeightDifference
          && angleDifference <= thresholds.maxAngleDifference
        if (isValid) continue
        if (best !== null && horizontalDistance >= best.horizontalDistance) continue
        best = {
          movingPieceId: movingPiece.id,
          movingConnectorId: currentMovingId,
          targetPieceId: targetPiece.id,
          targetConnectorId,
          distance,
          horizontalDistance,
          heightDifference,
          angleDifference,
        }
      }
    }
  }
  return best
}

export const findSnapNearMiss = findRailSnapNearMiss

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
  for (const connectorId of getRailConnectorIds(piece)) {
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
    for (const connectorId of getRailConnectorIds(piece)) {
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

/*
 * ループ閉鎖の補助（loop closure assist）
 * ------------------------------------------------------------
 * 通常のfindRailSnapCandidateは変更しない。ここでは、通常接続が
 * 成立しなかった端点だけを対象に、もう少し広い許容範囲で
 * 「閉じられそうなループ」を探し、見つかった場合だけ終端付近の
 * 数パーツへわずかな位置・向きの補正を分散して自然につなげる。
 *
 * 安全のため、以下をすべて満たす場合だけ候補として採用する。
 * - 距離・高さ・向きがLOOP_CLOSURE_MAX_*以内
 * - つなごうとしている相手が、今回固定された側の線路グラフから
 *   実際にたどり着ける（＝この接続が本当に閉路を作る）
 * - 相手側の先頭パーツが駅・トンネル・橋・坂道ではない
 * - 実際に必要な補正量（回転・並進）もLOOP_CLOSURE_MAX_*以内
 */

export type LoopClosureOptions = {
  maxDistance?: number
  maxHeightDifference?: number
  maxAngleDifference?: number
  maxChainPieces?: number
}

function loopClosureOptionsWithDefaults(options?: LoopClosureOptions) {
  return {
    maxDistance: options?.maxDistance ?? LOOP_CLOSURE_MAX_DISTANCE,
    maxHeightDifference: options?.maxHeightDifference ?? LOOP_CLOSURE_MAX_HEIGHT_DIFFERENCE,
    maxAngleDifference: options?.maxAngleDifference ?? LOOP_CLOSURE_MAX_ANGLE_DIFFERENCE,
    maxChainPieces: options?.maxChainPieces ?? LOOP_CLOSURE_MAX_CHAIN_PIECES,
  }
}

/** pieces内のconnectionsだけをたどり、fromからtoへ到達できるか調べる。 */
function isRailPieceReachable(
  pieces: readonly RailPiece[],
  fromPieceId: string,
  toPieceId: string,
): boolean {
  if (fromPieceId === toPieceId) return true
  const map = piecesMap(pieces)
  if (!map.has(fromPieceId)) return false
  const visited = new Set<string>([fromPieceId])
  const queue: string[] = [fromPieceId]
  let guard = 0
  while (queue.length > 0 && guard < 256) {
    guard += 1
    const currentId = queue.shift()
    if (currentId === undefined) break
    const piece = map.get(currentId)
    if (piece === undefined) continue
    for (const connectorId of getRailConnectorIds(piece)) {
      const connection = piece.connections[connectorId]
      if (connection === undefined) continue
      if (connection.pieceId === toPieceId) return true
      if (visited.has(connection.pieceId)) continue
      visited.add(connection.pieceId)
      queue.push(connection.pieceId)
    }
  }
  return false
}

/**
 * 通常のfindRailSnapCandidateが失敗した場合に呼ぶ補助探索。
 *
 * fixedPiece/fixedConnectorId は、今まさに通常接続で位置が確定した
 * 側の「まだ空いている」端点。targetsの中から、それへ閉じられそうな
 * 別の空き端点を探す。見つけた相手（moving側）は、fixedPieceへ
 * ぴったりつながる位置までtransformで動かす想定で返す
 * （実際の分散補正はapplyRailLoopClosureが行う）。
 */
export function findRailLoopClosureCandidate(
  fixedPiece: RailPiece,
  fixedConnectorId: RailConnectorId,
  targets: readonly RailPiece[],
  anchorPieceId: string,
  options?: LoopClosureOptions,
): SnapCandidate | null {
  const thresholds = loopClosureOptionsWithDefaults(options)
  // PR #203の分散補正は2端pieceの直列チェーン専用。分岐では候補探索をしない。
  if (fixedPiece.kind === 'branch' || fixedConnectorId === 'c') return null
  if (fixedPiece.connections[fixedConnectorId] !== undefined) return null
  const fixedWorld = worldConnectorForRailPiece(fixedPiece, fixedConnectorId)

  let best: SnapCandidate | null = null
  for (const farPiece of targets) {
    if (farPiece.id === fixedPiece.id) continue
    if (farPiece.kind === 'branch' || LOOP_CLOSURE_FACILITY_KINDS.has(farPiece.kind)) continue
    for (const farConnectorId of getRailConnectorIds(farPiece)) {
      if (farPiece.connections[farConnectorId] !== undefined) continue
      const farWorld = worldConnectorForRailPiece(farPiece, farConnectorId)
      const distance = distanceBetweenRailPoints(fixedWorld.position, farWorld.position)
      const heightDifference = Math.abs(fixedWorld.position.y - farWorld.position.y)
      const angleDifference = angleBetween(fixedWorld.outward, scale(farWorld.outward, -1))
      if (
        distance > thresholds.maxDistance
        || heightDifference > thresholds.maxHeightDifference
        || angleDifference > thresholds.maxAngleDifference
      ) continue
      if (best !== null && distance >= best.distance) continue
      // 無関係な線路同士を誤ってつながないよう、今回の接続で本当に
      // 閉路になる（＝相手が既存の接続グラフでanchor側へたどり着ける）
      // 場合だけを対象にする。
      if (!isRailPieceReachable(targets, anchorPieceId, farPiece.id)) continue

      const exactTransform = snapTransformForConnectors(farPiece, farConnectorId, fixedPiece, fixedConnectorId)
      const rotationDelta = Math.abs(normalizeAngle(exactTransform.rotationY - farPiece.rotationY))
      const translationDelta = distanceBetweenRailPoints(exactTransform.position, farPiece.position)
      // 補正量そのものにも上限を設け、無理な配置は閉じない。
      if (rotationDelta > thresholds.maxAngleDifference || translationDelta > thresholds.maxDistance) continue

      best = {
        movingPieceId: farPiece.id,
        movingConnectorId: farConnectorId,
        targetPieceId: fixedPiece.id,
        targetConnectorId: fixedConnectorId,
        transform: exactTransform,
        distance,
        heightDifference,
        angleDifference,
      }
    }
  }
  return best
}

export const findLoopClosureCandidate = findRailLoopClosureCandidate

type LoopClosureChainEntry = {
  piece: RailPiece
  /** このpieceの中で、固定側（今回閉じる継ぎ目に近い側）を向くコネクタ。 */
  towardFixedConnectorId: RailConnectorId
}

/**
 * candidate.movingPieceId から、駅・トンネル・橋・坂道に当たるか
 * 上限数に達するまで、既存の接続をたどって「補正を分散する対象」の
 * パーツ列を集める。先頭が今回閉じる側にいちばん近いパーツになる。
 */
function collectLoopClosureChain(
  pieces: readonly RailPiece[],
  startPieceId: string,
  startConnectorId: RailConnectorId,
  maxCount: number,
  /** 固定側のpiece（今回の接続相手）。分散対象には含めない。 */
  excludePieceId: string,
): LoopClosureChainEntry[] {
  const map = piecesMap(pieces)
  const chain: LoopClosureChainEntry[] = []
  const visited = new Set<string>([excludePieceId])
  let currentId: string | undefined = startPieceId
  let towardFixedConnectorId: RailConnectorId = startConnectorId

  while (currentId !== undefined && chain.length < Math.max(1, maxCount)) {
    const piece = map.get(currentId)
    if (piece === undefined || piece.kind === 'branch' || visited.has(piece.id)) break
    visited.add(piece.id)
    chain.push({ piece, towardFixedConnectorId })

    const outgoingConnectorId: RailConnectorId = towardFixedConnectorId === 'a' ? 'b' : 'a'
    const connection = piece.connections[outgoingConnectorId]
    if (connection === undefined) break
    const nextPiece = map.get(connection.pieceId)
    // 固定側のpieceや、施設パーツより先へは分散させない。
    if (
      nextPiece === undefined
      || nextPiece.id === excludePieceId
      || LOOP_CLOSURE_FACILITY_KINDS.has(nextPiece.kind)
    ) break
    currentId = nextPiece.id
    towardFixedConnectorId = connection.connectorId
  }
  return chain
}

/**
 * chain[0]（今回ぴったり接続するパーツ）はexactTransformで確定させ、
 * chain[1]以降にはLOOP_CLOSURE_TAPER_WEIGHTSに従って回転の一部だけを
 * 少しずつ適用する。各パーツの位置は、直前（すでに補正済み）のパーツと
 * 継ぎ目が離れないよう、そのつどコネクタ位置から再計算する。
 */
function computeLoopClosureCorrections(
  chain: readonly LoopClosureChainEntry[],
  exactTransform: RailTransform,
): Map<string, RailTransform> {
  const corrections = new Map<string, RailTransform>()
  if (chain.length <= 1) return corrections
  const first = chain[0]
  if (first === undefined) return corrections

  let previousPiece: RailPiece = {
    ...first.piece,
    position: cloneVec(exactTransform.position),
    rotationY: exactTransform.rotationY,
  }
  let previousTowardFixedConnectorId = first.towardFixedConnectorId

  for (let index = 1; index < chain.length; index += 1) {
    const entry = chain[index]
    const weight = LOOP_CLOSURE_TAPER_WEIGHTS[index - 1] ?? 0
    if (weight <= 0) break

    const linkConnectorId = entry.towardFixedConnectorId
    const previousOutgoingConnectorId: RailConnectorId = previousTowardFixedConnectorId === 'a' ? 'b' : 'a'
    const idealTransform = snapTransformForConnectors(
      entry.piece,
      linkConnectorId,
      previousPiece,
      previousOutgoingConnectorId,
    )
    const idealDelta = normalizeAngle(idealTransform.rotationY - entry.piece.rotationY)
    const appliedRotationY = entry.piece.rotationY + weight * idealDelta
    const localConnector = connectorFor(entry.piece, linkConnectorId)
    const rotatedLocal = rotateY(localConnector.localPosition, appliedRotationY)
    const targetWorldPosition = worldConnectorForRailPiece(previousPiece, previousOutgoingConnectorId).position
    const appliedPosition = subtract(targetWorldPosition, rotatedLocal)

    corrections.set(entry.piece.id, { position: appliedPosition, rotationY: appliedRotationY })
    previousPiece = { ...entry.piece, position: appliedPosition, rotationY: appliedRotationY }
    previousTowardFixedConnectorId = linkConnectorId
  }
  return corrections
}

/**
 * findRailLoopClosureCandidateで見つけた候補を実際に反映する。
 * candidate.movingPieceId側の終端付近（最大でLOOP_CLOSURE_MAX_CHAIN_PIECES
 * パーツ）へ補正を分散しつつ、通常のconnectRailPiecesと同じ形で
 * connections（track graph）も正式につなぐ。電車の走行Pathは
 * connectionsだけを見て組み立てられるため、これで自動的に閉路になる。
 */
export function applyRailLoopClosure(
  pieces: readonly RailPiece[],
  candidate: SnapCandidate,
): RailPiece[] {
  const movingPiece = pieces.find((piece) => piece.id === candidate.movingPieceId)
  const targetPiece = pieces.find((piece) => piece.id === candidate.targetPieceId)
  if (
    movingPiece?.kind === 'branch'
    || targetPiece?.kind === 'branch'
    || candidate.movingConnectorId === 'c'
    || candidate.targetConnectorId === 'c'
  ) return pieces.map(clonePiece)
  const chain = collectLoopClosureChain(
    pieces,
    candidate.movingPieceId,
    candidate.movingConnectorId,
    LOOP_CLOSURE_MAX_CHAIN_PIECES,
    candidate.targetPieceId,
  )
  const connected = connectRailPieces(
    pieces,
    candidate.movingPieceId,
    candidate.movingConnectorId,
    candidate.targetPieceId,
    candidate.targetConnectorId,
    candidate.transform,
  )
  const corrections = computeLoopClosureCorrections(chain, candidate.transform)
  if (corrections.size === 0) return connected
  return connected.map((piece) => {
    const correction = corrections.get(piece.id)
    if (correction === undefined) return piece
    return { ...clonePiece(piece), position: cloneVec(correction.position), rotationY: correction.rotationY }
  })
}

export const applyLoopClosure = applyRailLoopClosure
