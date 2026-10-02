import { createStageProgressStore } from '../shared/progress/stageProgress'

/** かいてゴール！のステージごとの いちばん よい ★（Issue #784 A6）。キーはステージ番号。 */
export const drawGoalProgress = createStageProgressStore('draw-goal-progress-v1', (id) => /^\d+$/.test(id))

/**
 * ゴールしたときの★。少ない線でゴールできるほど★が増える。
 * ほしを置いたステージでは、ぜんぶ ひろえていないと★3にはしない。
 */
export function drawGoalStars(lineCount: number, pickedCount: number, starCount: number): 1 | 2 | 3 {
  const byLines = lineCount <= 2 ? 3 : lineCount <= 4 ? 2 : 1
  if (starCount > 0 && pickedCount < starCount) return Math.min(byLines, 2) as 1 | 2
  return byLines
}
