import { createStageProgressStore } from '../shared/progress/stageProgress'
import type { BlockPuzzleMode } from './blockPuzzleModes'

/**
 * モードごとの クリア記録と ★（Issue #784 A6）。
 * - じゆうに ならべる: かたちを ぜんぶ うめたら ★3
 * - おちてくる ブロック: そろえた れつの数で ★1〜3
 */
export const blockPuzzleProgress = createStageProgressStore(
  'block-puzzle-progress-v1',
  (id): id is BlockPuzzleMode => id === 'free' || id === 'falling',
)

/** おちてくる ブロックで そろえた れつの数から ★を決める。1れつも そろっていなければ 0。 */
export function fallingStars(clearedRows: number): 0 | 1 | 2 | 3 {
  return clearedRows >= 10 ? 3 : clearedRows >= 5 ? 2 : clearedRows >= 1 ? 1 : 0
}

const BEST_KEY = 'block-puzzle-falling-best-v1'

/** おちてくる ブロックの ハイスコア（そろえた れつの数）。 */
export function readFallingBest(): number {
  try {
    const value = Number(localStorage.getItem(BEST_KEY) ?? 0)
    return Number.isInteger(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

/** ハイスコアを こえたときだけ保存し、新しい ハイスコアを返す。 */
export function recordFallingBest(clearedRows: number): number {
  const best = readFallingBest()
  if (clearedRows <= best) return best
  try {
    localStorage.setItem(BEST_KEY, String(clearedRows))
  } catch {
    // 保存できなくても あそべる。
  }
  return clearedRows
}
