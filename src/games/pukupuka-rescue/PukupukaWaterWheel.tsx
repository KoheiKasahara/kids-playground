import type { WaterWheelDefinition } from './types'
import styles from './PukupukaRescuePlay.module.css'

// 水車（#520）の見た目だけを持つコンポーネント。専用の操作は持たず、せん/排水(#516)の
// 開閉にそのまま連動する完全自動のギミック（回っているかどうかは pukupukaGame.ts の
// waterWheelSpinning が持つ）。「せんを あける→水が流れ出る→水車がまわる」という
// 既存の排水の因果に、回転という新しい結果を1つ足すだけにしてある。
//
// 回転に連動して隣の小さな水門(linkedGate)も同時に開閉させ、「水車がまわる→何かが動く」を
// もう一段見せる。見た目はメインのゲート（PukupukaGate、閉:オレンジのしま／開:緑の点線わく）と
// 同じ言語にそろえ、「これも門なんだ」とひと目で伝わるようにする。通常ステージでは
// 床下の演出だが、linkedGateBlocksPassage のステージでは通路を実際に開閉する。
// いずれも水車自体は操作せず、せんとの因果だけで動く。
//
// 回転そのものはCSSアニメーションの再生/一時停止だけで表現し、ゲーム状態には角度を
// 持たせない（水位・浮遊物と同じく、判定に使わない見た目の演出は表示側に閉じる方針 #514 を踏襲）。

type Props = {
  wheel: WaterWheelDefinition
  /** 回っている（＝せん/排水が開いている）かどうか。 */
  spinning: boolean
}

const SPOKE_ANGLES = [0, 60, 120, 180, 240, 300]

export default function PukupukaWaterWheel({ wheel, spinning }: Props) {
  const { x, y, radius } = wheel
  const gate = wheel.linkedGate
  const capHeight = 1
  const pipeWidth = radius * 0.7

  return (
    <g aria-hidden="true" pointerEvents="none">
      {/* せんの排水口(main-drain)から水車の軸まで、床に埋め込まれたパイプ。 */}
      <rect
        x={x - pipeWidth / 2}
        y={y - radius - 5}
        width={pipeWidth}
        height={5 + radius * 0.3}
        fill="#748ca6"
      />

      {/* 水車の軸受け。回転しても位置が変わらない土台。 */}
      <circle cx={x} cy={y} r={radius + 1.4} fill="#5c7591" />

      <g
        className={spinning ? styles.waterWheelSpin : undefined}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        data-testid="pukupuka-water-wheel"
        data-spinning={spinning}
      >
        <circle cx={x} cy={y} r={radius} fill="#a5d8ff" stroke="#1c7ed6" strokeWidth="0.8" />
        {SPOKE_ANGLES.map((angle) => (
          <rect
            key={angle}
            x={x - radius}
            y={y - 0.9}
            width={radius * 2}
            height="1.8"
            rx="0.9"
            fill="#1c7ed6"
            transform={`rotate(${angle} ${x} ${y})`}
          />
        ))}
        <circle cx={x} cy={y} r={radius * 0.26} fill="#1c7ed6" />
      </g>

      {/* 連動する小さな水門（#520）。水車がまわっているあいだだけ開く。 */}
      <g data-testid="pukupuka-water-wheel-gate" data-open={spinning}>
        <rect x={gate.x} y={gate.y} width={gate.width} height={capHeight} rx="0.6" fill="#748ca6" />
        <rect
          x={gate.x}
          y={gate.y + gate.height - capHeight}
          width={gate.width}
          height={capHeight}
          rx="0.6"
          fill="#748ca6"
        />
        {spinning ? (
          <rect
            x={gate.x + 0.4}
            y={gate.y + capHeight + 0.6}
            width={gate.width - 0.8}
            height={gate.height - capHeight * 2 - 1.2}
            rx="0.6"
            fill="none"
            stroke="#2f9e44"
            strokeWidth="0.7"
            strokeDasharray="1.6 1.3"
          />
        ) : (
          <rect
            x={gate.x + 0.4}
            y={gate.y + capHeight}
            width={gate.width - 0.8}
            height={gate.height - capHeight * 2}
            rx="0.6"
            fill="#ff922b"
            stroke="#e8590c"
            strokeWidth="0.5"
          />
        )}
      </g>
    </g>
  )
}
