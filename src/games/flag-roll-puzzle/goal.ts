import { GOAL_AREA, type GoalArea } from './boardLayout'

/**
 * ボールの中心がゴール領域に入ったか。
 * センサーBodyでの衝突判定ではなく座標の判定にしているのは、
 * 物理エンジンを動かさずに（＝UIにも matter-js にも依存せずに）
 * 単体テストできるようにするため。エンジン側は毎フレームこれを呼ぶだけでよい。
 */
export function isInGoalArea(x: number, y: number, goalArea: GoalArea = GOAL_AREA): boolean {
  return (
    x >= goalArea.x &&
    x <= goalArea.x + goalArea.width &&
    y >= goalArea.y &&
    y <= goalArea.y + goalArea.height
  )
}
