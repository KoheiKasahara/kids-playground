import type { GoalArea } from './boardLayout'
import type { GridCell, Point } from './grid'
import { nextRotationType, type PartTypeId } from './partTypes'
import { movePart, placePart, removePart, rotatePart, type PlacedPart } from './placement'
import {
  DEFAULT_PUZZLE_STAGE_ID,
  puzzleStage,
  type PuzzleStageId,
} from './puzzleStages'

/** ゲーム全体の進行状態。ゴール後も物理は継続するため cleared は表示上の状態だけを表す。 */
export type PuzzlePhase = 'edit' | 'running' | 'stopped' | 'cleared'

export type PuzzleBallStatus = 'ready' | 'moving' | 'stopped' | 'goal'

/** React stateへ保存するボール情報。Matter Bodyはここへ入れず、物理フック内で管理する。 */
export type PuzzleBallState = {
  readonly id: string
  readonly flagId: string
  readonly startPosition: Point
  readonly position: Point
  readonly status: PuzzleBallStatus
}

/** 物理フックから状態更新へ渡す、全ボールの現在値スナップショット。 */
export type PuzzleBallSnapshot = {
  readonly id: string
  readonly position: Point
  readonly status: PuzzleBallStatus
}

export type PuzzleState = {
  readonly stageId: PuzzleStageId
  readonly goalArea: GoalArea
  readonly phase: PuzzlePhase
  readonly balls: readonly PuzzleBallState[]
  readonly parts: readonly PlacedPart[]
  /** 盤面でいま選んでいるパーツのid。選んでいなければ null。 */
  readonly selectedPartId: string | null
  /** 物理世界の世代。「ボールをおとす」たびに増やす。 */
  readonly runId: number
  /** パーツIDの採番用。Reactのkeyと物理Bodyのラベルに使う。 */
  readonly nextPartNumber: number
}

const DEFAULT_FLAG_ID = 'jp'

function initialBalls(stageId: PuzzleStageId, flagId: string): PuzzleBallState[] {
  return puzzleStage(stageId).balls.map((ball) => ({
    id: ball.id,
    flagId: ball.flagId ?? flagId,
    startPosition: { ...ball.startPosition },
    position: { ...ball.startPosition },
    status: 'ready',
  }))
}

export function createPuzzleState(
  stageId: PuzzleStageId = DEFAULT_PUZZLE_STAGE_ID,
  flagId = DEFAULT_FLAG_ID,
): PuzzleState {
  const stage = puzzleStage(stageId)
  return {
    stageId: stage.id,
    goalArea: stage.goalArea,
    phase: 'edit',
    balls: initialBalls(stage.id, flagId),
    parts: [...(stage.fixedParts ?? [])],
    selectedPartId: null,
    runId: 0,
    nextPartNumber: 1,
  }
}

/** パーツを編集できる2つの状態。停止中も通常の編集操作を再利用する。 */
export function isEditingPhase(phase: PuzzlePhase): boolean {
  return phase === 'edit' || phase === 'stopped'
}

function stageAllowsPart(state: PuzzleState, typeId: PartTypeId): boolean {
  const stage = puzzleStage(state.stageId)
  if (!stage.availablePartTypeIds.includes(typeId)) return false
  const limit = stage.partLimits?.[typeId]
  if (limit === undefined) return true
  return state.parts.filter((part) => part.typeId === typeId).length < limit
}

/** パーツを1つ置く。ステージの使用可能種類・個数もここで守る。 */
export function tryPlacePart(
  state: PuzzleState,
  typeId: PartTypeId,
  cell: GridCell,
): PuzzleState | null {
  if (!isEditingPhase(state.phase) || !stageAllowsPart(state, typeId)) return null
  const parts = placePart(state.parts, typeId, cell, `part-${state.nextPartNumber}`)
  if (!parts) return null
  return { ...state, parts, selectedPartId: null, nextPartNumber: state.nextPartNumber + 1 }
}

export function tryMovePart(state: PuzzleState, partId: string, cell: GridCell): PuzzleState | null {
  if (!isEditingPhase(state.phase)) return null
  const parts = movePart(state.parts, partId, cell)
  if (!parts) return null
  return { ...state, parts }
}

export function selectPart(state: PuzzleState, partId: string): PuzzleState {
  if (!isEditingPhase(state.phase)) return state
  if (!state.parts.some((part) => part.id === partId)) return state
  return { ...state, selectedPartId: state.selectedPartId === partId ? null : partId }
}

export function clearPartSelection(state: PuzzleState): PuzzleState {
  if (state.selectedPartId === null) return state
  return { ...state, selectedPartId: null }
}

export function removeSelectedPart(state: PuzzleState): PuzzleState {
  if (!isEditingPhase(state.phase) || state.selectedPartId === null) return state
  return { ...state, parts: removePart(state.parts, state.selectedPartId), selectedPartId: null }
}

export function rotateSelectedPart(state: PuzzleState): PuzzleState {
  if (!isEditingPhase(state.phase) || state.selectedPartId === null) return state
  const current = state.parts.find((part) => part.id === state.selectedPartId)
  if (!current) return state
  const nextTypeId = nextRotationType(current.typeId)
  // 回転後の向き（例: longPlankVertical）はtrayに並ばない専用IDでも、
  // 既に置けるパーツからの派生なのでステージ制限を再適用しない。
  if (!nextTypeId) return state
  const parts = rotatePart(state.parts, current.id, nextTypeId)
  return parts ? { ...state, parts } : state
}

function snapshotsById(snapshots: readonly PuzzleBallSnapshot[] | undefined): Map<string, PuzzleBallSnapshot> {
  return new Map((snapshots ?? []).map((snapshot) => [snapshot.id, snapshot]))
}

function updateBallSnapshots(
  balls: readonly PuzzleBallState[],
  snapshots: readonly PuzzleBallSnapshot[] | undefined,
): PuzzleBallState[] {
  const byId = snapshotsById(snapshots)
  return balls.map((ball) => {
    const snapshot = byId.get(ball.id)
    if (!snapshot) return ball
    return { ...ball, position: { ...snapshot.position } }
  })
}

function phaseAfterBallChange(balls: readonly PuzzleBallState[]): PuzzlePhase {
  if (balls.every((ball) => ball.status === 'goal')) return 'cleared'
  if (balls.some((ball) => ball.status === 'moving')) return 'running'
  if (balls.some((ball) => ball.status === 'ready')) return 'edit'
  return 'stopped'
}

/** 物理側から全ボールの位置だけを同期する。状態(status)はイベント関数で更新する。 */
export function syncBallSnapshots(
  state: PuzzleState,
  snapshots: readonly PuzzleBallSnapshot[],
): PuzzleState {
  return { ...state, balls: updateBallSnapshots(state.balls, snapshots) }
}

/** 「ボールをおとす」。未ゴールのready/stoppedボールだけを同時に動かす。 */
export function startRun(state: PuzzleState): PuzzleState {
  if (!isEditingPhase(state.phase)) return state
  const balls = state.balls.map((ball) =>
    ball.status === 'goal' ? ball : { ...ball, status: 'moving' as const },
  )
  return {
    ...state,
    phase: balls.every((ball) => ball.status === 'goal') ? 'cleared' : 'running',
    balls,
    selectedPartId: null,
    runId: state.runId + 1,
  }
}

/** 個別ボールがゴールへ入った。全ボール到達時だけ全体をclearedにする。 */
export function markBallGoal(
  state: PuzzleState,
  ballId: string,
  snapshots?: readonly PuzzleBallSnapshot[],
): PuzzleState {
  if (state.phase !== 'running' && state.phase !== 'cleared') return state
  if (!state.balls.some((ball) => ball.id === ballId)) return state
  const synced = updateBallSnapshots(state.balls, snapshots)
  const balls = synced.map((ball) =>
    ball.id === ballId ? { ...ball, status: 'goal' as const } : ball,
  )
  return { ...state, balls, phase: phaseAfterBallChange(balls) }
}

/** 個別ボールが途中停止した。ほかのボールが動いている間はrunningを維持する。 */
export function markBallStopped(
  state: PuzzleState,
  ballId: string,
  snapshots?: readonly PuzzleBallSnapshot[],
): PuzzleState {
  if (state.phase !== 'running') return state
  if (!state.balls.some((ball) => ball.id === ballId)) return state
  const synced = updateBallSnapshots(state.balls, snapshots)
  const balls = synced.map((ball) =>
    ball.id === ballId && ball.status !== 'goal' ? { ...ball, status: 'stopped' as const } : ball,
  )
  return { ...state, balls, phase: phaseAfterBallChange(balls) }
}

/** 既存の単一ボール用呼び出しとの互換。複数球では最初の未ゴール球を対象にする。 */
export function reachGoal(
  state: PuzzleState,
  ballId?: string,
  snapshots?: readonly PuzzleBallSnapshot[],
): PuzzleState {
  const targetId = ballId ?? state.balls.find((ball) => ball.status !== 'goal')?.id
  return targetId ? markBallGoal(state, targetId, snapshots) : state
}

/** 既存の単一ボール用呼び出しとの互換。イベントが個別化されたらmarkBallStoppedを使う。 */
export function stopRun(
  state: PuzzleState,
  ballId?: string,
  snapshots?: readonly PuzzleBallSnapshot[],
): PuzzleState {
  if (ballId) return markBallStopped(state, ballId, snapshots)
  const targetId = state.balls.find((ball) => ball.status === 'moving')?.id
  return targetId ? markBallStopped(state, targetId, snapshots) : state
}

/** 各ボールをそれぞれのスタート位置へ戻す。パーツと国旗は維持する。 */
export function returnBall(state: PuzzleState): PuzzleState {
  if (state.phase === 'edit' && state.balls.every((ball) => ball.status === 'ready')) return state
  return {
    ...state,
    phase: 'edit',
    balls: state.balls.map((ball) => ({ ...ball, position: { ...ball.startPosition }, status: 'ready' })),
    selectedPartId: null,
  }
}

/** パーツを全部外し、複数ボール状態も初期化する。ステージと国旗は維持する。 */
export function clearAll(state: PuzzleState): PuzzleState {
  const reset = returnBall({ ...state, phase: 'stopped' })
  return { ...reset, parts: [], selectedPartId: null, nextPartNumber: 1 }
}

/** ステージを選び直したときの初期化。現在選択中の国旗は各ボールへ引き継ぐ。 */
export function changeStage(state: PuzzleState, stageId: PuzzleStageId): PuzzleState {
  const selectedFlagId = state.balls[0]?.flagId ?? DEFAULT_FLAG_ID
  return createPuzzleState(stageId, selectedFlagId)
}

/** 現在選択中の国旗を全ボールへ反映する。内部はボールごとのflagIdを維持する。 */
export function setSelectedFlag(state: PuzzleState, flagId: string): PuzzleState {
  return { ...state, balls: state.balls.map((ball) => ({ ...ball, flagId })) }
}
