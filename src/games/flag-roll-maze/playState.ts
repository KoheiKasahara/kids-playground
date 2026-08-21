import { FLAG_BALL_IDS } from '../../components/flag-ball/flagBalls'

/** プレイ画面へ渡す、選んだ国旗1件だけの遷移state。 */
export type MazePlayState = { flagId: string }

function isKnownFlagId(value: unknown): value is string {
  return typeof value === 'string' && FLAG_BALL_IDS.includes(value)
}

/**
 * location.state はURLの代わりに使う一時データなので、flagIdだけを受け付ける。
 * 余分な値や未知の国旗を通さず、壊れた直リンクは選択画面へ戻せるようにする。
 */
function isExactFlagState(value: unknown): value is MazePlayState {
  if (typeof value !== 'object' || value === null) return false
  const state = value as Record<string, unknown>
  const keys = Object.keys(state)
  return keys.length === 1 && keys[0] === 'flagId' && isKnownFlagId(state.flagId)
}

/** `/games/flag-roll-maze/play` のlocation.stateを検証する型ガード。 */
export function isMazePlayState(value: unknown): value is MazePlayState {
  return isExactFlagState(value)
}

/** 不正stateならnullを返す、画面側で使いやすいパーサー。 */
export function parseMazePlayState(value: unknown): MazePlayState | null {
  return isExactFlagState(value) ? value : null
}

// ゲーム名を明示した別名も公開しておく。ほかの国旗ゲームのstate型と並べて読むときに便利。
export const isFlagRollMazePlayState = isMazePlayState
export const parseFlagRollMazePlayState = parseMazePlayState
