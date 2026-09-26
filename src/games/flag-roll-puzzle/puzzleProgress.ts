import { createStageProgressStore } from '../shared/progress/stageProgress'
import { PUZZLE_STAGES, type PuzzleStageId } from './puzzleStages'
import type { PlacedPart } from './placement'

/** ステージごとの クリア記録と ★（Issue #784 A6）。 */
export const puzzleProgress = createStageProgressStore('flag-roll-puzzle-progress-v1', (id) =>
  PUZZLE_STAGES.some((stage) => stage.id === id),
)

/** 自分で置いた パーツが すくないほど ★が ふえる（はじめから置いてある パーツは数えない）。 */
export function puzzleStars(parts: readonly PlacedPart[], stageId: PuzzleStageId): 1 | 2 | 3 {
  const fixed = PUZZLE_STAGES.find((stage) => stage.id === stageId)?.fixedParts?.length ?? 0
  const placed = Math.max(0, parts.length - fixed)
  return placed <= 2 ? 3 : placed <= 4 ? 2 : 1
}
