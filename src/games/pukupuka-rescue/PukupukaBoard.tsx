import type { BoardDefinition, BoardFlowDirection } from './types'
import styles from './PukupukaRescuePlay.module.css'

// 流れ板（#519）の見た目と入力だけを持つコンポーネント。ゲート・せんと同じ形で、
// 押し流す処理そのもの（目標速度を変える処理）は floatModel.ts / pukupukaGame.ts 側の
// 純粋な関数（boardFlowSpeed）が持つ。
//
// ゲートが「とおれる/とおれない」の二択なのに対し、この板は常にとおり抜けられる。
// タップのたびに「ゴールへ後押しする/ゴールから遠ざける」の向きが反転するだけで、
// めり込み防止の当たり判定は持たせない（floatModel.ts が既存のドリフトと同じ
// 「目標速度に寄せる」処理として扱うため、接触してもめり込み・吹き飛び・振動が起きない）。
// タップ領域は本物の<button>にし、見た目より広めに取る。

const HIT_MARGIN_X = 5
const HIT_MARGIN_Y = 6

type Props = {
  board: BoardDefinition
  flowDirection: BoardFlowDirection
  /** 実際に押し流す向き（+1: みぎ、-1: ひだり）。矢印の向きに使う。 */
  pushDirection: number
  disabled: boolean
  onToggle: () => void
}

export default function PukupukaBoard({ board, flowDirection, pushDirection, disabled, onToggle }: Props) {
  const towardGoal = flowDirection === 'goal'
  const centerX = board.x + board.width / 2
  const centerY = board.y + board.height / 2
  // 実際に押し流している向き（pushDirection）へ傾けることで、タップした瞬間に
  // 「向きが変わった」と見た目でも分かるようにする。
  const tilt = Math.sign(pushDirection || 1) * 6
  const color = towardGoal ? '#2f9e44' : '#ff922b'
  const strokeColor = towardGoal ? '#237a37' : '#e8590c'
  const arrowSize = Math.min(board.height * 0.6, 4.5)

  return (
    <g data-testid="pukupuka-board" data-board-flow={flowDirection}>
      <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
        <rect
          transform={`rotate(${tilt} ${centerX} ${centerY})`}
          x={board.x}
          y={board.y}
          width={board.width}
          height={board.height}
          rx={board.height / 2}
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
          aria-label={towardGoal ? 'いた。ゴールの ほうへ ながしています' : 'いた。ゴールから とおざけて います'}
          aria-pressed={towardGoal}
          onClick={onToggle}
        />
      </foreignObject>
    </g>
  )
}
