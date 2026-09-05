import type { GateDefinition } from './types'
import styles from './PukupukaRescuePlay.module.css'

// ゲート（#517）の見た目と入力だけを持つコンポーネント。じゃぐち・せんと同じ形で、
// 通路をふさぐ/開ける処理そのものは pukupukaGame.ts 側の純粋な関数（activeSolids）が持つ。
//
// せんと同じく「タップで開閉」の単純なトグルにする。閉じている間は左右の壁と同じ高さの
// 板がまんなかをふさぎ、開くと板がわきへ引っ込んで通り道が見える見た目にすることで、
// 単なる細い線ではなく「通れない/通れる」がひと目で分かるようにしている。
// タップ領域は本物の<button>にし、見た目より広めに取る。

const HIT_WIDTH = 24
// ゲートの当たり判定は縦に長いため、上下いっぱいまで広げるとじゃぐち・せんの
// タップ領域と重なり、実機で先にゲートがタップを奪ってしまう。
// 上下に余白を残し、じゃぐち（上部）・せん（下部）のタップ領域を避ける。
const HIT_TOP_MARGIN = 12
const HIT_BOTTOM_MARGIN = 26

type Props = {
  gate: GateDefinition
  /** 開いている（＝通り抜けられる）かどうか。見た目（板の位置・色）に反映する。 */
  open: boolean
  disabled: boolean
  onToggle: () => void
}

export default function PukupukaGate({ gate, open, disabled, onToggle }: Props) {
  const capHeight = 4
  const doorY = gate.y + capHeight
  const doorHeight = gate.height - capHeight * 2

  return (
    <g data-testid="pukupuka-gate" data-gate-open={open}>
      {/* aria-hiddenは読み上げからの除外だけで、実ブラウザでのヒットテストは防がない。
          ゲートは縦に長く、せん・じゃぐちのタップ領域に絵が重なりうるため、
          装飾側は明示的にクリックを素通りさせ、実際の操作は<button>だけに絞る。 */}
      <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
        {/* 上下の枠。開閉に関わらず常に表示し、「ここに通路がある」ことを示す。 */}
        <rect x={gate.x} y={gate.y} width={gate.width} height={capHeight} rx="1" fill="#748ca6" />
        <rect x={gate.x} y={gate.y + gate.height - capHeight} width={gate.width} height={capHeight} rx="1" fill="#748ca6" />
        {open ? (
          <>
            {/* 通り道の目印。開いた枠を点線で示し、進む向きの矢印を添える。 */}
            <rect
              x={gate.x - 1.5}
              y={doorY + 2}
              width={gate.width + 3}
              height={doorHeight - 4}
              rx="2"
              fill="none"
              stroke="#2f9e44"
              strokeWidth="1.2"
              strokeDasharray="3 2.4"
            />
            <path
              className={styles.gateOpenMark}
              d={`M ${gate.x - 0.5} ${gate.y + gate.height / 2 - 3} L ${gate.x + 3.5} ${gate.y + gate.height / 2} L ${gate.x - 0.5} ${gate.y + gate.height / 2 + 3} Z`}
              fill="#2f9e44"
            />
          </>
        ) : null}
        {/* とびら本体。閉じているときはここが道をふさぐ板。開くとわきへ引っ込む。 */}
        <rect
          className={`${styles.gateDoor} ${open ? styles.gateDoorOpen : ''}`}
          x={gate.x}
          y={doorY}
          width={gate.width}
          height={doorHeight}
          rx="1.2"
          fill={open ? '#a9e5b8' : '#ff922b'}
          stroke={open ? '#2f9e44' : '#e8590c'}
          strokeWidth="0.8"
        />
        {!open ? (
          <>
            {/* 閉じているときだけ見える横じま。バーやふみきりのような「とおれない」印象にする。 */}
            {[0.22, 0.42, 0.62, 0.82].map((position) => (
              <rect
                key={position}
                x={gate.x + 0.6}
                y={doorY + doorHeight * position}
                width={gate.width - 1.2}
                height="2.2"
                rx="1"
                fill="#ffffff"
                opacity="0.75"
              />
            ))}
          </>
        ) : null}
      </g>
      <foreignObject
        x={gate.x + gate.width / 2 - HIT_WIDTH / 2}
        y={gate.y + HIT_TOP_MARGIN}
        width={HIT_WIDTH}
        height={gate.height - HIT_TOP_MARGIN - HIT_BOTTOM_MARGIN}
      >
        <button
          type="button"
          className={styles.gateHit}
          disabled={disabled}
          aria-label={open ? 'ゲート。あいています。とおれます' : 'ゲート。とじています。おすと あきます'}
          aria-pressed={open}
          onClick={onToggle}
        />
      </foreignObject>
    </g>
  )
}
