import type { RailPiece, RailPieceKind } from './railModel'
import {
  TRAIN_CAR_COUNT,
  TRAIN_CAR_SPACING,
  TRAIN_MAX_SPEED,
  createInitialRailTrainMotion,
  distanceAheadToRailTrainCursor,
  getOccupiedRailPieceIds,
  pauseRailTrain,
  startRailTrain,
  updateRailTrainMotion,
  type RailTrainCursor,
  type RailTrainMotion,
  type RailTrainStatus,
} from './railTrainModel'

export const MAX_RAIL_FLEET_SIZE = 3
export const RAIL_FLEET_SAFE_GAP = TRAIN_CAR_SPACING * TRAIN_CAR_COUNT + 0.8
export const RAIL_FLEET_RESUME_GAP = RAIL_FLEET_SAFE_GAP + 0.7
export const RAIL_FLEET_LOOKAHEAD = RAIL_FLEET_SAFE_GAP + 5

export type RailTrainAppearance = {
  color: string
  frontColor: string
  roofColor: string
}

/** 車両タイプ別に切り替わる見た目パラメータ。走行ロジックは一切参照しない。 */
export type TrainVisualConfig = RailTrainAppearance

export const RAIL_TRAIN_APPEARANCES: readonly RailTrainAppearance[] = [
  { color: '#f97316', frontColor: '#ea580c', roofColor: '#facc15' },
  { color: '#0ea5e9', frontColor: '#0284c7', roofColor: '#e0f2fe' },
  { color: '#a855f7', frontColor: '#9333ea', roofColor: '#f5d0fe' },
]

/**
 * 列車の車両タイプ。走行ロジック(railTrainModel/railFleetModel の更新処理)は
 * このtypeを一切分岐条件に使わない。参照するのは見た目を組み立てる側だけにする。
 * 新しい車両タイプを増やすときはこのunionとTRAIN_TYPE_VISUAL_CONFIGSに
 * 追加するだけで済むようにする。
 */
export type TrainType = 'basic' | 'e5' | 'e6' | 'n700s' | 'doctorYellow' | 'e7w7'

export const TRAIN_TYPES: readonly TrainType[] = ['basic', 'e5', 'e6', 'n700s', 'doctorYellow', 'e7w7']

export const DEFAULT_TRAIN_TYPE: TrainType = 'basic'

export function isTrainType(value: unknown): value is TrainType {
  return typeof value === 'string' && (TRAIN_TYPES as readonly string[]).includes(value)
}

/** 未指定・不正な値は既存のオリジナル車両(basic)へ安全にフォールバックする。 */
export function resolveTrainType(value: unknown): TrainType {
  return isTrainType(value) ? value : DEFAULT_TRAIN_TYPE
}

/**
 * 車両タイプ単位で共有する外装の基調色。詳細な車体シルエットや窓・帯は
 * railTrainVisuals.ts の描画プロファイルが担当し、走行状態からは分離する。
 */
const TRAIN_TYPE_VISUAL_CONFIGS: Record<Exclude<TrainType, 'basic'>, TrainVisualConfig> = {
  e5: { color: '#168c8f', frontColor: '#0e6672', roofColor: '#f8f4ea' },
  e6: { color: '#f3f1ed', frontColor: '#c52d40', roofColor: '#b52639' },
  n700s: { color: '#f8faf9', frontColor: '#edf1f2', roofColor: '#ffffff' },
  doctorYellow: { color: '#f5c928', frontColor: '#dba315', roofColor: '#f3e5a3' },
  e7w7: { color: '#f7f8f4', frontColor: '#124578', roofColor: '#0d4b86' },
}

/**
 * 車両タイプと編成内インデックスから見た目設定を求める。basicは既存どおり
 * インデックス順の色ローテーションを保ち、複数列車の見分けやすさを変えない。
 */
export function resolveTrainVisualConfig(trainType: TrainType, fleetIndex: number): TrainVisualConfig {
  if (trainType === 'basic') {
    const index = Number.isFinite(fleetIndex) ? Math.max(0, Math.floor(fleetIndex)) : 0
    return RAIL_TRAIN_APPEARANCES[index % RAIL_TRAIN_APPEARANCES.length]!
  }
  return TRAIN_TYPE_VISUAL_CONFIGS[trainType]
}

export type RailFleetTrain = {
  id: string
  label: string
  /** 走行ロジックからは参照しない、見た目専用の車両タイプ。 */
  trainType: TrainType
  appearance: RailTrainAppearance
  motion: RailTrainMotion
  /** ユーザーが発車状態にしたか。blockedや駅停車とは独立。 */
  wantsToRun: boolean
  /** 前走列車との安全間隔のため一時停止中。空けば自動解除する。 */
  blocked: boolean
}

export type RailFleetTrainSummary = {
  id: string
  label: string
  trainType: TrainType
  color: string
  status: RailTrainStatus
  wantsToRun: boolean
  blocked: boolean
}

function cloneMotion(motion: RailTrainMotion): RailTrainMotion {
  return { ...motion, cursor: { ...motion.cursor } }
}

/**
 * スポーン候補の優先度。トンネルの中や車庫の奥から列車が始まると、
 * 初期表示で電車が見えず子どもが戸惑うため、見える平地の線路を優先する。
 * 同じ優先度内は従来どおりpiecesの並び順を保つ。
 */
function spawnPriority(kind: RailPieceKind): number {
  if (kind === 'depot') return 1
  if (kind === 'tunnel') return 2
  return 0
}

function spawnOrderedPieces(pieces: readonly RailPiece[]): RailPiece[] {
  return pieces
    .map((piece, index) => ({ piece, index }))
    .sort((a, b) => {
      const priorityDelta = spawnPriority(a.piece.kind) - spawnPriority(b.piece.kind)
      return priorityDelta !== 0 ? priorityDelta : a.index - b.index
    })
    .map((entry) => entry.piece)
}

function safeSpawnMotion(
  pieces: readonly RailPiece[],
  trains: readonly RailFleetTrain[],
): RailTrainMotion | null {
  const used = new Set<string>()
  for (const train of trains) {
    for (const pieceId of getOccupiedRailPieceIds(pieces, train.motion.cursor)) used.add(pieceId)
  }
  for (const piece of spawnOrderedPieces(pieces)) {
    if (used.has(piece.id)) continue
    const motion = createInitialRailTrainMotion(pieces, piece.id)
    if (motion === null || motion.cursor.pieceId !== piece.id) continue
    const candidateOccupied = getOccupiedRailPieceIds(pieces, motion.cursor)
    if (candidateOccupied.some((pieceId) => used.has(pieceId))) continue

    const tooClose = trains.some((train) => (
      distanceAheadToRailTrainCursor(
        pieces,
        motion.cursor,
        train.motion.cursor,
        RAIL_FLEET_SAFE_GAP,
      ) !== null
      || distanceAheadToRailTrainCursor(
        pieces,
        train.motion.cursor,
        motion.cursor,
        RAIL_FLEET_SAFE_GAP,
      ) !== null
    ))
    if (!tooClose) return motion
  }
  return null
}

/** 既存idと衝突しない最小のtrain-N番号を探す。途中の1台を消して追加してもidが衝突しない。 */
function nextFreeFleetIndex(existing: readonly RailFleetTrain[]): number {
  const usedIds = new Set(existing.map((train) => train.id))
  let index = 0
  while (usedIds.has(`train-${index + 1}`)) index += 1
  return index
}

/** `train-N` のNから0始まりのインデックスを復元する。basicの色ローテーションをid基準で安定させる。 */
function fleetIndexFromId(trainId: string): number {
  const match = /^train-(\d+)$/.exec(trainId)
  if (match === null) return 0
  const parsed = Number.parseInt(match[1]!, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed - 1 : 0
}

function makeFleetTrain(
  pieces: readonly RailPiece[],
  existing: readonly RailFleetTrain[],
  trainType: TrainType = DEFAULT_TRAIN_TYPE,
): RailFleetTrain | null {
  const motion = safeSpawnMotion(pieces, existing)
  if (motion === null) return null

  const index = nextFreeFleetIndex(existing)
  const appearance = resolveTrainVisualConfig(trainType, index)
  return {
    id: `train-${index + 1}`,
    label: `${index + 1}`,
    trainType,
    appearance: { ...appearance },
    motion,
    wantsToRun: false,
    blocked: false,
  }
}

export function createInitialRailFleet(
  pieces: readonly RailPiece[],
  count = 1,
  trainTypes?: readonly TrainType[],
): RailFleetTrain[] {
  const result: RailFleetTrain[] = []
  const targetCount = Math.min(MAX_RAIL_FLEET_SIZE, Math.max(0, Math.floor(count)))
  for (let index = 0; index < targetCount; index += 1) {
    const train = makeFleetTrain(pieces, result, trainTypes?.[index] ?? DEFAULT_TRAIN_TYPE)
    if (train !== null) result.push(train)
  }
  return result
}

export function addRailFleetTrain(
  trains: readonly RailFleetTrain[],
  pieces: readonly RailPiece[],
  trainType: TrainType = DEFAULT_TRAIN_TYPE,
): RailFleetTrain[] {
  const cloned = trains.map((train) => ({ ...train, appearance: { ...train.appearance }, motion: cloneMotion(train.motion) }))
  if (cloned.length >= MAX_RAIL_FLEET_SIZE) return cloned
  const next = makeFleetTrain(pieces, cloned, trainType)
  return next === null ? cloned : [...cloned, next]
}

/**
 * 指定した列車の車両タイプ(見た目)だけを差し替える。Phase 3の車両選択UIから
 * 呼ばれる想定のAPI。cursor・speed・statusなど走行状態は一切変更しない。
 */
export function setRailFleetTrainType(
  trains: readonly RailFleetTrain[],
  trainId: string,
  trainType: TrainType,
): RailFleetTrain[] {
  return trains.map((train) => {
    const motion = cloneMotion(train.motion)
    if (train.id !== trainId) return { ...train, appearance: { ...train.appearance }, motion }
    return {
      ...train,
      trainType,
      appearance: { ...resolveTrainVisualConfig(trainType, fleetIndexFromId(train.id)) },
      motion,
    }
  })
}

export function setRailFleetTrainRunning(
  trains: readonly RailFleetTrain[],
  trainId: string,
  running: boolean,
): RailFleetTrain[] {
  return trains.map((train) => {
    const motion = cloneMotion(train.motion)
    if (train.id !== trainId) return { ...train, appearance: { ...train.appearance }, motion }
    return {
      ...train,
      appearance: { ...train.appearance },
      wantsToRun: running,
      blocked: false,
      motion: running ? startRailTrain(motion) : pauseRailTrain(motion),
    }
  })
}

function nearestTrainAhead(
  trains: readonly RailFleetTrain[],
  follower: RailFleetTrain,
  pieces: readonly RailPiece[],
): number | null {
  let nearest: number | null = null
  for (const leader of trains) {
    if (leader.id === follower.id) continue
    const distance = distanceAheadToRailTrainCursor(
      pieces,
      follower.motion.cursor,
      leader.motion.cursor,
      RAIL_FLEET_LOOKAHEAD,
    )
    if (distance === null) continue
    // 完全に同じcursorへ復旧した壊れかけの状態でも全列車を相互停止させない。
    // ID順で後の列車だけを後続扱いにして、先頭側が離れれば自動復旧できる。
    if (
      distance <= 1e-7
      && leader.motion.cursor.pieceId === follower.motion.cursor.pieceId
      && leader.motion.cursor.direction === follower.motion.cursor.direction
      && leader.id > follower.id
    ) continue
    if (nearest === null || distance < nearest) nearest = distance
  }
  return nearest
}

/** 2〜3本向けの純粋なfleet更新。探索は各列車の前方数segmentだけ。 */
export function updateRailFleet(
  trains: readonly RailFleetTrain[],
  pieces: readonly RailPiece[],
  deltaSeconds: number,
): RailFleetTrain[] {
  return trains.map((train) => {
    if (!train.wantsToRun) {
      return {
        ...train,
        appearance: { ...train.appearance },
        blocked: false,
        motion: pauseRailTrain(train.motion),
      }
    }

    const gap = nearestTrainAhead(trains, train, pieces)
    const shouldRemainBlocked = train.blocked && gap !== null && gap < RAIL_FLEET_RESUME_GAP
    const shouldBlock = gap !== null && gap <= RAIL_FLEET_SAFE_GAP
    if (shouldRemainBlocked || shouldBlock) {
      return {
        ...train,
        appearance: { ...train.appearance },
        blocked: true,
        motion: { ...cloneMotion(train.motion), speed: 0 },
      }
    }

    const slowdown = gap === null || gap >= RAIL_FLEET_LOOKAHEAD
      ? 1
      : Math.max(0.2, (gap - RAIL_FLEET_SAFE_GAP) / (RAIL_FLEET_LOOKAHEAD - RAIL_FLEET_SAFE_GAP))
    const prepared = train.motion.status === 'paused'
      ? startRailTrain(train.motion)
      : {
        ...cloneMotion(train.motion),
        speed: Math.min(train.motion.speed, TRAIN_MAX_SPEED * slowdown),
      }
    const nextMotion = updateRailTrainMotion(prepared, pieces, deltaSeconds * slowdown)
    return {
      ...train,
      appearance: { ...train.appearance },
      // 行き止まりはユーザー操作上の停止。線路を延ばしたあと、この列車の
      // ▶を押して同じcursorから再開できるよう個別の運転意図もOFFへ戻す。
      wantsToRun: nextMotion.status !== 'waiting',
      blocked: false,
      motion: nextMotion,
    }
  })
}

/** 電車を1台減らす。trainId未指定なら最後の1台。最低1台は必ず残す。 */
export function removeRailFleetTrain(
  trains: readonly RailFleetTrain[],
  trainId?: string,
): RailFleetTrain[] {
  const cloned = trains.map((train) => ({ ...train, appearance: { ...train.appearance }, motion: cloneMotion(train.motion) }))
  if (cloned.length <= 1) return cloned
  const targetId = trainId ?? cloned[cloned.length - 1]?.id
  if (targetId === undefined || !cloned.some((train) => train.id === targetId)) return cloned
  return cloned.filter((train) => train.id !== targetId)
}

/** ドラッグで電車を線路上へ置き直す。停止状態にして駅の状態もリセットする。 */
export function moveRailFleetTrainTo(
  trains: readonly RailFleetTrain[],
  trainId: string,
  cursor: RailTrainCursor,
): RailFleetTrain[] {
  return trains.map((train) => {
    const motion = cloneMotion(train.motion)
    if (train.id !== trainId) return { ...train, appearance: { ...train.appearance }, motion }
    return {
      ...train,
      appearance: { ...train.appearance },
      wantsToRun: false,
      blocked: false,
      motion: {
        cursor: { ...cursor },
        speed: 0,
        status: 'ready',
      },
    }
  })
}

export function occupiedRailFleetPieceIds(
  trains: readonly RailFleetTrain[],
  pieces: readonly RailPiece[],
): string[] {
  const occupied = new Set<string>()
  for (const train of trains) {
    for (const pieceId of getOccupiedRailPieceIds(pieces, train.motion.cursor)) occupied.add(pieceId)
  }
  return [...occupied].sort()
}

export function summarizeRailFleet(trains: readonly RailFleetTrain[]): RailFleetTrainSummary[] {
  return trains.map((train) => ({
    id: train.id,
    label: train.label,
    trainType: train.trainType,
    color: train.appearance.color,
    status: train.motion.status,
    wantsToRun: train.wantsToRun,
    blocked: train.blocked,
  }))
}
