export type AdventurePhase = 'running' | 'moving' | 'goal'

export type AdventureState = {
  phase: AdventurePhase
  currentAreaId: string
  visitedAreaIds: readonly string[]
}

/**
 * プレイ開始時の状態を作る。
 * visitedAreaIds に開始エリアを含めることで、「入った」通知が重複したときにも
 * 同じエリアを訪問済みとして二重追加しない前提を最初から揃える。
 */
export function createAdventureState(startAreaId: string): AdventureState {
  return {
    phase: 'running',
    currentAreaId: startAreaId,
    visitedAreaIds: [startAreaId],
  }
}

/** カメラ移動開始。すでに移動中・ゴール後なら、重複イベントを無視して同じ参照を返す。 */
export function beginAreaMove(state: AdventureState): AdventureState {
  if (state.phase !== 'running') return state
  return { ...state, phase: 'moving' }
}

/**
 * 次エリアへの到着を確定する。
 * moving中だけを受け付け、訪問済みのエリアや現在エリアへの二重到着は無視する。
 * エンジンから同じセンサーイベントが複数回届いても、表示中のエリアと履歴が壊れない。
 */
export function enterArea(state: AdventureState, areaId: string): AdventureState {
  if (state.phase === 'goal') return state
  if (state.phase !== 'moving') return state
  if (areaId === state.currentAreaId || state.visitedAreaIds.includes(areaId)) return state
  return {
    phase: 'running',
    currentAreaId: areaId,
    visitedAreaIds: [...state.visitedAreaIds, areaId],
  }
}

/** ゴール後は状態を変えない。物理イベントの二重発火でも結果遷移が一度だけになる。 */
export function reachGoal(state: AdventureState): AdventureState {
  if (state.phase === 'goal') return state
  return { ...state, phase: 'goal' }
}
