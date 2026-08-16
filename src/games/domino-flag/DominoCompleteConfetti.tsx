import type { CSSProperties } from 'react'
import styles from './DominoCompleteConfetti.module.css'

/** 24片なら左右の装飾感を保ちつつ、中央の国旗とスマホの描画を圧迫しない。 */
const DOMINO_CONFETTI_COUNT = 24
const DOMINO_CONFETTI_COLORS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2'] as const
const DOMINO_CONFETTI_SIDE_COUNT = DOMINO_CONFETTI_COUNT / 2

type ConfettiStyle = CSSProperties & Record<`--${string}`, string>

type ConfettiPiece = {
  color: string
  left: string
  top: string
  duration: string
  delay: string
  rotation: string
  midRotation: string
  midSway: string
  endSway: string
}

/** 中央38〜62%を避け、毎回同じ位置・回転・遅延になるようインデックスから配置する。 */
const DOMINO_CONFETTI_PIECES: ConfettiPiece[] = Array.from(
  { length: DOMINO_CONFETTI_COUNT },
  (_, index) => {
    const sideIndex = index % DOMINO_CONFETTI_SIDE_COUNT
    const isRightSide = index >= DOMINO_CONFETTI_SIDE_COUNT
    const leftPercent = isRightSide
      ? 69 + ((sideIndex * 17) % 27)
      : 5 + ((sideIndex * 19) % 27)
    const topPercent = -8 - (sideIndex % 4) * 4
    const rotation = ((index * 47) % 360) - 180
    const sway = (index % 2 === 0 ? 1 : -1) * (12 + (index % 4) * 3)

    return {
      color: DOMINO_CONFETTI_COLORS[index % DOMINO_CONFETTI_COLORS.length],
      left: `${leftPercent}%`,
      top: `${topPercent}%`,
      duration: `${(1.6 + (index % 9) * 0.1).toFixed(1)}s`,
      delay: `${(index * 83) % 601}ms`,
      rotation: `${rotation}deg`,
      midRotation: `${rotation * 0.45}deg`,
      midSway: `${sway}px`,
      endSway: `${-sway * 0.45}px`,
    }
  },
)

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

/** 完成した国旗を隠さない左右配置の軽い紙吹雪。タイマーは使わずCSSだけで終了させる。 */
export default function DominoCompleteConfetti() {
  if (prefersReducedMotion()) return null

  return (
    <div
      className={styles.confetti}
      data-testid="domino-complete-confetti"
      aria-hidden="true"
    >
      {DOMINO_CONFETTI_PIECES.map((piece, index) => {
        const style: ConfettiStyle = {
          '--confetti-color': piece.color,
          '--confetti-left': piece.left,
          '--confetti-top': piece.top,
          '--confetti-duration': piece.duration,
          '--confetti-delay': piece.delay,
          '--confetti-rotation': piece.rotation,
          '--confetti-mid-rotation': piece.midRotation,
          '--confetti-mid-sway': piece.midSway,
          '--confetti-end-sway': piece.endSway,
        }
        return <span key={index} className={styles.piece} style={style} />
      })}
    </div>
  )
}
