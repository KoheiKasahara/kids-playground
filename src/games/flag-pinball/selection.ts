/** えらべるボールの数 */
export const MAX_SELECTION = 3

/**
 * 選択のトグル。すでに選択済みなら外し、未選択なら追加する。
 * 上限に達している場合は何も変えない（追加も外すのも子どもが迷わないよう、
 * 「上限中は未選択タップを無視する」動きに統一する）。
 * 元配列は破壊しない。
 */
export function toggleSelection(selected: readonly string[], flagId: string): string[] {
  if (selected.includes(flagId)) {
    return selected.filter((id) => id !== flagId)
  }
  if (selected.length >= MAX_SELECTION) {
    return [...selected]
  }
  return [...selected, flagId]
}

/** 3個そろったか */
export function isSelectionComplete(selected: readonly string[]): boolean {
  return selected.length >= MAX_SELECTION
}

/** あと何個えらべるか */
export function remainingCount(selected: readonly string[]): number {
  return Math.max(0, MAX_SELECTION - selected.length)
}
