import { BALL_COUNT, type PinballMode } from './types'
import { PINBALL_FLAG_IDS } from './data/pinballFlags'

/** プレイ画面へ渡す遷移state。並び順が ballIndex（0..flagIds.length-1）になる */
export type PinballPlayState = { mode: PinballMode; flagIds: string[] }

/** 結果画面へ渡す遷移state。scores は flagIds と同じ並び順・同じ長さの確定得点 */
export type PinballResultState = { mode: PinballMode; flagIds: string[]; scores: number[] }

function isKnownFlagId(value: unknown): value is string {
  return typeof value === 'string' && PINBALL_FLAG_IDS.includes(value)
}

/**
 * mode を検証して正規化する。`undefined` は既存（mode を持たない）state からの
 * 遷移を 'normal' として救済するための後方互換。それ以外の不正な値は null。
 */
function parseMode(value: unknown): PinballMode | null {
  if (value === undefined) return 'normal'
  if (value === 'normal' || value === 'allFlags') return value
  return null
}

/**
 * flagIds 単体の妥当性を確認する（配列・重複なし・全て既知の id）。
 * 長さはモードごとに意味が異なる（'normal' は BALL_COUNT、'allFlags' は全国旗の並べ替え）ため
 * ここでは検証せず、呼び出し側で mode に応じて確認する。
 */
function areKnownUniqueFlagIds(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false
  if (!value.every(isKnownFlagId)) return false
  return new Set(value).size === value.length
}

/**
 * mode に応じた flagIds の長さを確認する。
 * 'normal' は選択できる上限と同じ BALL_COUNT 件、'allFlags' は選べる全国旗をちょうど
 * 並べ替えたもの（件数が増減してもハードコードせず PINBALL_FLAG_IDS.length を参照する）。
 */
function hasValidLengthForMode(flagIds: string[], mode: PinballMode): boolean {
  const expectedLength = mode === 'normal' ? BALL_COUNT : PINBALL_FLAG_IDS.length
  return flagIds.length === expectedLength
}

/**
 * `/games/flag-pinball/play` への遷移state（`useLocation().state`）を検証し、
 * 正規化した state を返す。URL直打ちやブラウザの「戻る」などでstateなし・不正な形で
 * 開かれた場合は null を返すので、呼び出し側はそのとき選択画面へ Navigate する。
 * 型ガードではなく parse 関数にしているのは、mode 欠落時に 'normal' として救済する
 * 挙動が narrowing（isXxxState(value): value is Xxx）の意味とずれるため。
 */
export function parsePinballPlayState(value: unknown): PinballPlayState | null {
  if (typeof value !== 'object' || value === null) return null
  const state = value as Record<string, unknown>
  const mode = parseMode(state.mode)
  if (mode === null) return null
  if (!areKnownUniqueFlagIds(state.flagIds)) return null
  if (!hasValidLengthForMode(state.flagIds, mode)) return null
  return { mode, flagIds: state.flagIds }
}

/**
 * `/games/flag-pinball/result` への遷移state を検証し、正規化した state を返す。
 * scores は flagIds と同じ長さの有限数値配列であることを確認する
 * （NaN・Infinityなど、表示が壊れる値を弾く）。
 */
export function parsePinballResultState(value: unknown): PinballResultState | null {
  if (typeof value !== 'object' || value === null) return null
  const state = value as Record<string, unknown>
  const mode = parseMode(state.mode)
  if (mode === null) return null
  if (!areKnownUniqueFlagIds(state.flagIds)) return null
  if (!hasValidLengthForMode(state.flagIds, mode)) return null
  if (!Array.isArray(state.scores)) return null
  if (state.scores.length !== state.flagIds.length) return null
  if (!state.scores.every((score) => typeof score === 'number' && Number.isFinite(score))) return null
  return { mode, flagIds: state.flagIds, scores: state.scores }
}
