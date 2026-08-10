import { PANEL_COUNT } from './PanelFlag'

/**
 * パネルクイズ1問ぶんの得点を計算する純粋関数。
 *
 * - 不正解は常に0点。
 * - 正解は開いたパネルの枚数が少ないほど高得点になる。
 *   1枚目で正解 = 100点、以降1枚めくるごとに10点ずつ減り、10枚以降は10点で下げ止まる
 *   （`110 - openedCount * 10` を10で下限クリップ）。
 * - `openedCount` が0以下やPANEL_COUNT超えなど異常な値で呼ばれても安全に動くよう、
 *   1〜PANEL_COUNTの範囲へ丸めてから計算する。
 *
 * 1ゲームの満点は 10問 × 100点 = 1000点（全問1枚目で正解した場合）。
 */
export function scoreForPanels(openedCount: number, correct: boolean): number {
  if (!correct) return 0
  const safeOpenedCount = Math.min(Math.max(Math.trunc(openedCount), 1), PANEL_COUNT)
  return Math.max(10, 110 - safeOpenedCount * 10)
}
