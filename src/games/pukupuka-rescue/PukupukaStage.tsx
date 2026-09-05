import { waterSurfaceYOf, type PukupukaGameState } from './pukupukaGame'
import type { SolidDefinition, StageDefinition } from './types'
import { surfaceYAt, waterBodyWidth } from './waterModel'
import PukupukaFaucet from './PukupukaFaucet'
import styles from './PukupukaRescuePlay.module.css'

// ステージの見た目だけを持つコンポーネント。位置はすべてゲーム状態（2D座標）から決め、
// 波・泡・アヒルの揺れはCSSアニメーションに寄せている（＝表示の演出をゲーム判定から切り離す）。
// 中身のほとんどは装飾なので aria-hidden の<g>にまとめ、状態の読み上げは画面側のテキストが担当する。
// じゃぐち（PukupukaFaucet）だけは実際の操作なので、この<g>の外に置いてAT/キーボードから見えるようにする。

/** 波1周期の長さ。この長さぶん左へ動かすアニメーションでループが継ぎ目なくつながる。 */
const WAVE_LENGTH = 20
const WAVE_AMPLITUDE = 1.3
/** 水面の帯（波として色を濃くする部分）の高さ。 */
const WAVE_BAND_DEPTH = 5

function buildWavePath(width: number, amplitude: number): string {
  const span = width + WAVE_LENGTH
  const segments = Math.ceil(span / WAVE_LENGTH)
  const half = WAVE_LENGTH / 2
  const quarter = WAVE_LENGTH / 4
  let path = 'M 0 0'
  for (let index = 0; index < segments; index += 1) {
    path += ` q ${quarter} ${-amplitude} ${half} 0 q ${quarter} ${amplitude} ${half} 0`
  }
  path += ` L ${segments * WAVE_LENGTH} ${WAVE_BAND_DEPTH} L 0 ${WAVE_BAND_DEPTH} Z`
  return path
}

/** しきりは当たり判定こそ四角のままだが、見た目は上を丸く、底に水の通り道を開けて描く。 */
function dividerPath(solid: SolidDefinition): string {
  const left = solid.x
  const right = solid.x + solid.width
  const bottom = solid.y + solid.height
  const radius = solid.width / 2
  const center = left + radius
  const holeLeft = center - 1.5
  const holeRight = center + 1.5
  const holeTop = bottom - 7
  return [
    `M ${left} ${solid.y + radius}`,
    `A ${radius} ${radius} 0 0 1 ${right} ${solid.y + radius}`,
    `V ${bottom}`,
    `H ${holeRight}`,
    `V ${holeTop}`,
    `Q ${center} ${holeTop - 3} ${holeLeft} ${holeTop}`,
    `V ${bottom}`,
    `H ${left}`,
    'Z',
  ].join(' ')
}

function solidClassName(solid: SolidDefinition): string {
  if (solid.kind === 'floor') return styles.solidFloor
  if (solid.kind === 'platform') return styles.solidPlatform
  return styles.solidWall
}

type Props = {
  stage: StageDefinition
  state: PukupukaGameState
  /** じゃぐちが押されている（＝注水中）かどうか。 */
  faucetActive: boolean
  faucetDisabled: boolean
  onFaucetHoldStart: () => void
  onFaucetHoldEnd: () => void
  onFaucetTap: () => void
}

export default function PukupukaStage({
  stage,
  state,
  faucetActive,
  faucetDisabled,
  onFaucetHoldStart,
  onFaucetHoldEnd,
  onFaucetTap,
}: Props) {
  const cleared = state.phase === 'cleared'
  const goal = stage.goal.area
  const faucetSurfaceY = waterSurfaceYOf(stage, state, stage.faucet.targetBodyId)

  return (
    <svg
      className={styles.stageSvg}
      viewBox={`0 0 ${stage.width} ${stage.height}`}
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
      data-testid="pukupuka-stage"
    >
      <defs>
        <linearGradient id="pukupuka-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e7f7ff" />
          <stop offset="100%" stopColor="#fff6e0" />
        </linearGradient>
        <linearGradient id="pukupuka-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7fd6f7" />
          <stop offset="100%" stopColor="#3aa7e0" />
        </linearGradient>
        <linearGradient id="pukupuka-duck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="100%" stopColor="#fcc419" />
        </linearGradient>
        <radialGradient id="pukupuka-goal-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#fff3bf" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fff3bf" stopOpacity="0" />
        </radialGradient>
        {stage.waterBodies.map((body) => {
          const surfaceY = waterSurfaceYOf(stage, state, body.id)
          return (
            <g key={body.id}>
              {/* 水域の柱そのもの。波は水面より横に長く描くため、これではみ出しを切る。 */}
              <clipPath id={`pukupuka-column-${body.id}`}>
                <rect
                  x={body.left}
                  y={body.ceilingY - WAVE_BAND_DEPTH}
                  width={waterBodyWidth(body)}
                  height={body.floorY - body.ceilingY + WAVE_BAND_DEPTH}
                />
              </clipPath>
              {/* 水面から下だけ。あわが水面の上に出ないようにする。 */}
              <clipPath id={`pukupuka-clip-${body.id}`}>
                <rect
                  x={body.left}
                  y={surfaceY}
                  width={waterBodyWidth(body)}
                  height={Math.max(0, body.floorY - surfaceY)}
                />
              </clipPath>
            </g>
          )
        })}
      </defs>

      {/* 装飾・状態表示だけの内容。じゃぐちの操作ボタンだけはこの外に置き、AT/キーボードから見える。 */}
      <g aria-hidden="true">
        <rect x="0" y="0" width={stage.width} height={stage.height} fill="url(#pukupuka-sky)" />
        <ellipse cx="22" cy="12" rx="13" ry="5.5" fill="#ffffff" opacity="0.75" />
        <ellipse cx="74" cy="9" rx="10" ry="4.5" fill="#ffffff" opacity="0.6" />

        {/* 水そうの内側。水がないところはうすい水色にして、水面の位置を分かりやすくする。 */}
        <rect x="6" y="20" width="88" height="120" rx="8" fill="#f4fbff" />

        {stage.waterBodies.map((body) => {
          const surfaceY = waterSurfaceYOf(stage, state, body.id)
          const width = waterBodyWidth(body)
          const depth = Math.max(0, body.floorY - surfaceY)
          return (
            <g
              key={body.id}
              clipPath={`url(#pukupuka-column-${body.id})`}
              data-testid={`pukupuka-water-${body.id}`}
              data-surface-y={surfaceY.toFixed(2)}
            >
              <rect x={body.left} y={surfaceY} width={width} height={depth} fill="url(#pukupuka-water)" />
              {/* あわ。水の中だけに見えるよう、水面から下だけを切り抜いて描く。 */}
              <g clipPath={`url(#pukupuka-clip-${body.id})`}>
                {[0.2, 0.45, 0.72].map((position, index) => (
                  <circle
                    key={position}
                    className={styles.bubble}
                    cx={body.left + width * position}
                    cy={body.floorY - 4}
                    r={1.4 + index * 0.35}
                    fill="#ffffff"
                    opacity="0.5"
                    style={{ animationDelay: `${index * 0.9}s` }}
                  />
                ))}
              </g>
              {depth > 0 ? (
                <g transform={`translate(${body.left} ${surfaceY})`}>
                  <path
                    className={styles.waveBack}
                    d={buildWavePath(width, WAVE_AMPLITUDE)}
                    fill="#ffffff"
                    opacity="0.35"
                  />
                  <path
                    className={styles.waveFront}
                    d={buildWavePath(width, WAVE_AMPLITUDE * 0.7)}
                    fill="#ffffff"
                    opacity="0.55"
                  />
                </g>
              ) : null}
            </g>
          )
        })}

        {/* ゴールの光。水位に関係なく同じ場所で光り続け、目印になる。 */}
        <ellipse
          className={styles.goalGlow}
          cx={goal.x + goal.width / 2}
          cy={goal.y + goal.height / 2}
          rx={goal.width * 0.75}
          ry={goal.height * 1.4}
          fill="url(#pukupuka-goal-glow)"
        />

        {stage.solids.map((solid) =>
          solid.kind === 'divider' ? (
            <path key={solid.id} className={styles.solidWall} d={dividerPath(solid)} />
          ) : (
            <rect
              key={solid.id}
              className={solidClassName(solid)}
              x={solid.x}
              y={solid.y}
              width={solid.width}
              height={solid.height}
              rx={solid.kind === 'floor' ? 3 : 4}
            />
          ),
        )}

        {/* ゴールの目印: はたと浮き輪。台の上に置いて「ここへ運ぶ」と分かるようにする。 */}
        <g>
          <rect x="61.2" y="82" width="1.6" height="14" rx="0.8" fill="#8d6e4f" />
          <path d="M62.8 82.6 L71 85.6 L62.8 88.6 Z" fill="#ff6b6b" />
          <g className={cleared ? styles.goalRingCleared : undefined}>
            <circle cx="76" cy="87.6" r="7" fill="none" stroke="#ffffff" strokeWidth="3.4" />
            <circle
              cx="76"
              cy="87.6"
              r="7"
              fill="none"
              stroke="#ff6b6b"
              strokeWidth="3.4"
              strokeDasharray="5.5 5.5"
            />
          </g>
        </g>

        {state.floaters.map((floater) => {
          const definition = stage.floaters.find((candidate) => candidate.id === floater.id)
          if (!definition) return null
          // 波紋は「その浮遊物がいる水域」の水面へ描く（水域が増えても正しい水面に付く）。
          const surfaceY = surfaceYAt(stage.waterBodies, state.water, floater.x, floater.y)
          return (
            <g key={floater.id}>
              {surfaceY !== undefined && floater.submergedRatio > 0.05 ? (
                <ellipse
                  className={styles.ripple}
                  cx={floater.x}
                  cy={surfaceY}
                  rx={definition.radius * 1.5}
                  ry={2}
                  fill="#ffffff"
                  opacity="0.55"
                />
              ) : null}
              <g
                data-testid={`pukupuka-floater-${floater.id}`}
                data-floater-x={floater.x.toFixed(2)}
                data-floater-y={floater.y.toFixed(2)}
                transform={`translate(${floater.x} ${floater.y})`}
              >
                <g className={styles.floaterBob}>
                  <ellipse cx="0" cy="7" rx="8.5" ry="1.6" fill="#1c7ed6" opacity="0.18" />
                  <path d="M -6.5 -1 L -11 -5 L -6 2 Z" fill="#fcc419" />
                  <ellipse cx="0" cy="1" rx="8" ry="6" fill="url(#pukupuka-duck)" />
                  <ellipse cx="-1.2" cy="1.6" rx="4.2" ry="3" fill="#f6b704" opacity="0.75" />
                  <circle cx="4.6" cy="-5.4" r="4.4" fill="url(#pukupuka-duck)" />
                  <path d="M 8.4 -5.6 L 12.6 -4.3 L 8.4 -2.9 Z" fill="#ff922b" />
                  <circle cx="3.4" cy="-3.9" r="1.2" fill="#ffa8a8" opacity="0.6" />
                  <circle cx="5.7" cy="-6.5" r="0.9" fill="#3f2f1e" />
                  <circle cx="6" cy="-6.8" r="0.3" fill="#ffffff" />
                </g>
              </g>
            </g>
          )
        })}
      </g>

      <PukupukaFaucet
        faucet={stage.faucet}
        active={faucetActive}
        disabled={faucetDisabled}
        surfaceY={faucetSurfaceY}
        onHoldStart={onFaucetHoldStart}
        onHoldEnd={onFaucetHoldEnd}
        onTap={onFaucetTap}
      />
    </svg>
  )
}
