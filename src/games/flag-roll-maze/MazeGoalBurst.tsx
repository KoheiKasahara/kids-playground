import type { CSSProperties } from 'react'
import styles from './MazeGoalBurst.module.css'

const MAZE_GOAL_BURST_COUNT = 12
const MAZE_GOAL_BURST_COLORS = ['#ffd43b', '#ffa8a8', '#74c0fc', '#b2f2bb'] as const

type BurstStyle = CSSProperties & Record<`--${string}`, string>

type BurstPiece = {
  color: string
  midX: string
  midY: string
  endX: string
  endY: string
  endRotation: string
  delay: string
}

/** 中心からの距離と角度をインデックスだけで決め、毎回同じ小さな演出にする。 */
const MAZE_GOAL_BURST_PIECES: readonly BurstPiece[] = Array.from(
  { length: MAZE_GOAL_BURST_COUNT },
  (_, index) => {
    const angle = (index / MAZE_GOAL_BURST_COUNT) * Math.PI * 2 - Math.PI / 2
    const distance = 48 + (index % 3) * 12
    const endX = Math.round(Math.cos(angle) * distance)
    const endY = Math.round(Math.sin(angle) * distance)

    return {
      color: MAZE_GOAL_BURST_COLORS[index % MAZE_GOAL_BURST_COLORS.length],
      midX: `${Math.round(endX * 0.55)}px`,
      midY: `${Math.round(endY * 0.55)}px`,
      endX: `${endX}px`,
      endY: `${endY}px`,
      endRotation: `${(index * 43) % 180 - 90}deg`,
      delay: `${(index % 5) * 32}ms`,
    }
  },
)

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

/** ゴールの瞬間だけ、盤面の中央から小さなキラキラを広げる。タイマーは使わずCSSで消す。 */
export default function MazeGoalBurst() {
  if (prefersReducedMotion()) return null

  return (
    <div className={styles.burst} data-testid="maze-goal-burst" aria-hidden="true">
      {MAZE_GOAL_BURST_PIECES.map((piece, index) => {
        const style: BurstStyle = {
          '--burst-color': piece.color,
          '--burst-mid-x': piece.midX,
          '--burst-mid-y': piece.midY,
          '--burst-end-x': piece.endX,
          '--burst-end-y': piece.endY,
          '--burst-end-rotation': piece.endRotation,
          '--burst-delay': piece.delay,
        }
        return (
          <span key={index} className={styles.piece} style={style}>
            ✦
          </span>
        )
      })}
    </div>
  )
}
