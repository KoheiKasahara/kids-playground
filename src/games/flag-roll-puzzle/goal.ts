import { GOAL_AREA } from './boardLayout'

/**
 * ボールの中心がゴール領域に入ったか。
 * センサーBodyでの衝突判定ではなく座標の判定にしているのは、
 * 物理エンジンを動かさずに（＝UIにも matter-js にも依存せずに）
 * 単体テストできるようにするため。エンジン側は毎フレームこれを呼ぶだけでよい。
 */
export function isInGoalArea(x: number, y: number): boolean {
  return (
    x >= GOAL_AREA.x &&
    x <= GOAL_AREA.x + GOAL_AREA.width &&
    y >= GOAL_AREA.y &&
    y <= GOAL_AREA.y + GOAL_AREA.height
  )
}
