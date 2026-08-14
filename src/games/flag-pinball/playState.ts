import { BALL_COUNT } from './types'
import { PINBALL_FLAG_IDS } from './data/pinballFlags'

/** プレイ画面へ渡す遷移state。並び順が ballIndex（0..BALL_COUNT-1）になる */
export type PinballPlayState = {
  flagIds: string[]
}

/** 結果画面へ渡す遷移state。scores は flagIds と同じ並び順・同じ長さの確定得点 */
export type PinballResultState = {
  flagIds: string[]
  scores: number[]
}

function isKnownFlagId(value: unknown): value is string {
  return typeof value === 'string' && PINBALL_FLAG_IDS.includes(value)
}

/**
 * flagIds 単体の妥当性を確認する（配列・長さ BALL_COUNT・重複なし・全て既知の id）。
 * プレイ・結果両方の state 検証で共有する。
 */
function areValidFlagIds(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false
  if (value.length !== BALL_COUNT) return false
  if (!value.every(isKnownFlagId)) return false
  return new Set(value).size === value.length
}

/**
 * `/games/flag-pinball/play` への遷移state（`useLocation().state`）を検証する型ガード。
 * URL直打ちやブラウザの「戻る」などでstateなし・不正な形で開かれた場合は
 * 選択画面へ安全に戻すため、呼び出し側は false のとき Navigate する。
 */
export function isPinballPlayState(value: unknown): value is PinballPlayState {
  if (typeof value !== 'object' || value === null) return false
  const state = value as Record<string, unknown>
  return areValidFlagIds(state.flagIds)
}

/**
 * `/games/flag-pinball/result` への遷移state を検証する型ガード。
 * scores は flagIds と同じ長さの有限数値配列であることを確認する
 * （NaN・Infinityなど、表示が壊れる値を弾く）。
 */
export function isPinballResultState(value: unknown): value is PinballResultState {
  if (typeof value !== 'object' || value === null) return false
  const state = value as Record<string, unknown>
  if (!areValidFlagIds(state.flagIds)) return false
  if (!Array.isArray(state.scores)) return false
  if (state.scores.length !== state.flagIds.length) return false
  return state.scores.every((score) => typeof score === 'number' && Number.isFinite(score))
}
