import { FLAG_BALL_IDS } from '../../components/flag-ball/flagBalls'

/** プレイ画面・ゴール画面へ渡す、選んだ国旗1件だけの遷移state。 */
export type AdventurePlayState = { flagId: string }
export type AdventureGoalState = AdventurePlayState

function isKnownFlagId(value: unknown): value is string {
  return typeof value === 'string' && FLAG_BALL_IDS.includes(value)
}

/**
 * stateはURLの代わりに使う一時データなので、必要なflagId以外を受け付けない。
 * 余分なフィールドを通すと、将来別の画面のstateを誤って再利用しやすくなるため、
 * Object.keysの件数まで検証して安全な開始画面へ戻せるようにする。
 */
function isExactFlagState(value: unknown): value is AdventurePlayState {
  if (typeof value !== 'object' || value === null) return false
  const state = value as Record<string, unknown>
  const keys = Object.keys(state)
  return keys.length === 1 && keys[0] === 'flagId' && isKnownFlagId(state.flagId)
}

/** `/play` のlocation.stateを検証する型ガード。 */
export function isAdventurePlayState(value: unknown): value is AdventurePlayState {
  return isExactFlagState(value)
}

/** 不正stateを画面側がNavigateへ渡しやすいよう、検証済みstateかnullを返す。 */
export function parseAdventurePlayState(value: unknown): AdventurePlayState | null {
  return isExactFlagState(value) ? value : null
}

/** `/goal` も同じ形のstateを受け取るが、画面の意図を型名に残す。 */
export function isAdventureGoalState(value: unknown): value is AdventureGoalState {
  return isExactFlagState(value)
}

export function parseAdventureGoalState(value: unknown): AdventureGoalState | null {
  return isExactFlagState(value) ? value : null
}
