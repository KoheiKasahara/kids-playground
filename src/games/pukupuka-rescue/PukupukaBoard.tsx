import type { BoardDefinition, BoardFlowDirection } from './types'
import styles from './PukupukaRescuePlay.module.css'

// 流れ板（#519）の見た目と入力だけを持つコンポーネント。ゲート・せんと同じ形で、
// 放水方向を変える処理そのものは pukupukaGame.ts 側が持つ。
//
// タップのたびに「ゴールへ流す/ゴールから遠ざける」が反転し、対象水域全体へ効く。
// めり込み防止の当たり判定は持たず、放水中だけ安全な目標速度として作用する。
// タップ領域は本物の<button>にし、見た目より広めに取る。

const HIT_MARGIN_X = 5
const HIT_MARGIN_Y = 6

type Props = {
  board: BoardDefinition
  flowDirection: BoardFlowDirection
  /** 実際に押し流す向き（+1: みぎ、-1: ひだり）。矢印の向きに使う。 */
  pushDirection: number
  active?: boolean
  disabled: boolean
  onToggle: () => void
}

export default function PukupukaBoard({ board, flowDirection, pushDirection, active = false, disabled, onToggle }: Props) {
  const towardGoal = flowDirection === 'goal'
  const centerX = board.x + board.width / 2
  const centerY = board.y + board.height / 2
  // 実際に押し流している向き（pushDirection）へ傾けることで、タップした瞬間に
  // 「向きが変わった」と見た目でも分かるようにする。
  const tilt = Math.sign(pushDirection || 1) * 6
  const color = towardGoal ? '#2f9e44' : '#ff922b'
  const strokeColor = towardGoal ? '#237a37' : '#e8590c'
  const arrowSize = Math.min(board.height * 0.6, 4.5)
  const floorMounted = centerY > 75

  return (
    <g data-testid="pukupuka-board" data-board-flow={flowDirection}>
      <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
        {board.circulation ? (
          <>
            {/* 流れをつくるプロペラ。水そうの床に立てるか、上のふちからつるす。矢印の向きに水がまわる。 */}
            {floorMounted ? (
              <>
                <path d={`M${centerX} ${centerY + 8} V125`} stroke="#5c7591" strokeWidth="1.8" />
                <rect x={centerX - 4} y="123.6" width="8" height="2.6" rx="1" fill="#456f7d" />
              </>
            ) : (
              <>
                <path d={`M${centerX} 21 V${centerY - 8}`} stroke="#5c7591" strokeWidth="1.6" />
                <rect x={centerX - 3.4} y="19.6" width="6.8" height="2.2" rx="1" fill="#456f7d" />
              </>
            )}
            <circle cx={centerX} cy={centerY} r="8.6" fill="#ffffff" stroke={strokeColor} strokeWidth="1.3" />
            <circle cx={centerX} cy={centerY} r="7.2" fill={towardGoal ? '#ebfbee' : '#fff4e6'} />
            <g transform={`translate(${centerX} ${centerY})`}>
              <g className={active ? styles.currentRotor : undefined}>
                {[0, 120, 240].map((angle) => (
                  <path key={angle} transform={`rotate(${angle})`} d="M0 0 Q-4.6 -6.4 0 -6.6 Q3.4 -6 0 0Z" fill="#a5d8ff" opacity="0.9" />
                ))}
                <circle r="1.2" fill="#5c7591" />
              </g>
            </g>
            <g transform={`translate(${centerX} ${centerY}) scale(${pushDirection >= 0 ? 1 : -1} 1)`}>
              <path
                className={styles.boardFlowMark}
                d="M-5 -1.6 H0.8 V-4.2 L5.4 0 L0.8 4.2 V1.6 H-5 Z"
                fill={color}
                stroke="#ffffff"
                strokeWidth="0.7"
                strokeLinejoin="round"
              />
            </g>
          </>
        ) : (
          <>
            <rect
              transform={`rotate(${tilt} ${centerX} ${centerY})`}
              x={board.x}
              y={board.y}
              width={board.width}
              height={board.height}
              rx={board.height / 2} opacity="0.94"
              fill={color}
              stroke={strokeColor}
              strokeWidth="0.8"
            />
            {/* 押し流す向きの矢印。板の色とあわせて、進む/戻すをひと目で示す。 */}
            <path
              className={styles.boardFlowMark}
              d={
                pushDirection >= 0
                  ? `M ${centerX - arrowSize} ${centerY - arrowSize} L ${centerX + arrowSize} ${centerY} L ${centerX - arrowSize} ${centerY + arrowSize} Z`
                  : `M ${centerX + arrowSize} ${centerY - arrowSize} L ${centerX - arrowSize} ${centerY} L ${centerX + arrowSize} ${centerY + arrowSize} Z`
              }
              fill="#ffffff"
            />
          </>
        )}
      </g>
      <foreignObject
        x={board.x - HIT_MARGIN_X}
        y={board.y - HIT_MARGIN_Y}
        width={board.width + HIT_MARGIN_X * 2}
        height={board.height + HIT_MARGIN_Y * 2}
      >
        <button
          type="button"
          className={styles.boardHit}
          disabled={disabled}
          aria-label={pushDirection >= 0 ? 'ながれの いた。みずを みぎへ ながします' : 'ながれの いた。みずを ひだりへ ながします'}
          aria-pressed={towardGoal}
          onClick={onToggle}
        />
      </foreignObject>
    </g>
  )
}
