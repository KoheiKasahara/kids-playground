import type { WaterWheelDefinition } from './types'

// 水車（#520）の見た目だけを持つコンポーネント。タップ操作は持たせず、いま何度まで
// 回っているか（angleDeg）と、はっきり回っているか（spinning）だけを受け取って描く。
// 回転そのものは pukupukaGame.ts / waterWheelModel.ts 側の純粋な関数が計算するため、
// ここでは transform="rotate(...)" にそのまま渡すだけにしてある。
// ゲート・せんと違い操作対象ではないため、装飾と同じ完全な aria-hidden にしてある。

const PADDLE_COUNT = 6

type Props = {
  wheel: WaterWheelDefinition
  /** 現在の回転角(度)。 */
  angleDeg: number
  /** はっきり回っている（＝浮遊物を押し流している）かどうか。色の変化で伝える。 */
  spinning: boolean
}

export default function PukupukaWaterWheel({ wheel, angleDeg, spinning }: Props) {
  const { cx, cy, radius } = wheel
  const hubRadius = radius * 0.32
  const paddleLength = radius * 0.78
  const paddleWidth = radius * 0.34
  const rimColor = spinning ? '#5fa8d3' : '#a9b7c4'
  const paddleColor = spinning ? '#2f7fb8' : '#8794a1'

  return (
    <g
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
      data-testid="pukupuka-water-wheel"
      data-wheel-spinning={spinning}
      data-wheel-angle={angleDeg.toFixed(1)}
    >
      {/* 取り付け位置（壁ぎわの軸受け）。水車が回っても位置そのものは動かない。 */}
      <circle cx={cx} cy={cy} r={radius + 1.4} fill="none" stroke="#6b4423" strokeWidth="1.4" opacity="0.55" />
      <g transform={`rotate(${angleDeg} ${cx} ${cy})`}>
        {Array.from({ length: PADDLE_COUNT }, (_, index) => {
          const paddleAngle = (360 / PADDLE_COUNT) * index
          return (
            <rect
              key={index}
              x={cx - paddleWidth / 2}
              y={cy - radius}
              width={paddleWidth}
              height={paddleLength}
              rx={paddleWidth / 2}
              fill={paddleColor}
              stroke="#3f2f1e"
              strokeWidth="0.5"
              transform={`rotate(${paddleAngle} ${cx} ${cy})`}
            />
          )
        })}
        <circle cx={cx} cy={cy} r={hubRadius} fill="#8d6e4f" stroke="#3f2f1e" strokeWidth="0.6" />
      </g>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke={rimColor} strokeWidth="1.6" />
    </g>
  )
}
