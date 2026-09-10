import { boardFlowSpeed, stageDriftDirection, waterSurfaceYOf, waterWheelSpinning, type PukupukaGameState } from './pukupukaGame'
import type { BoardFlowDirection, FloaterKind, SolidDefinition, StageDefinition } from './types'
import { surfaceYAt, waterBodyWidth } from './waterModel'
import PukupukaFaucet from './PukupukaFaucet'
import PukupukaDrain from './PukupukaDrain'
import PukupukaGate from './PukupukaGate'
import PukupukaBoard from './PukupukaBoard'
import PukupukaWaterWheel from './PukupukaWaterWheel'
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

function solidClassName(solid: SolidDefinition): string {
  if (solid.kind === 'floor') return styles.solidFloor
  if (solid.kind === 'platform') return styles.solidPlatform
  return styles.solidWall
}

// 浮遊物の見た目だけを種類ごとに描き分ける（#518）。当たり判定・浮力・ゴール判定は
// floatModel.ts / pukupukaGame.ts の共通処理をそのまま使うため、ここで分かれるのは
// 描画だけで、シルエットで見分けられることを優先する。

/** アヒル。丸い胴体・頭・くちばしのシルエット（Phase 1から変更なし）。 */
function DuckShape() {
  return (
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
  )
}

/**
 * ボート。横に広く平べったい船体のシルエットにして、丸いアヒル・輪っかの浮き輪とは
 * 一目で区別できるようにする。小さな旗を立て、遊び心とゴールの旗との統一感を持たせる。
 */
function BoatShape() {
  return (
    <g className={styles.floaterBob}>
      <ellipse cx="0" cy="8" rx="11" ry="1.8" fill="#1c7ed6" opacity="0.18" />
      <path
        d="M -12 -1.5 L 12 -1.5 Q 15.5 -1.5 12 4.5 Q 5 8.5 0 8.5 Q -5 8.5 -12 4.5 Q -15.5 -1.5 -12 -1.5 Z"
        fill="url(#pukupuka-boat-hull)"
        stroke="#6b4423"
        strokeWidth="0.8"
      />
      <rect x="-12" y="-2.6" width="24" height="1.8" rx="0.9" fill="#dba05f" />
      <rect x="-5.5" y="-0.4" width="11" height="1.6" rx="0.7" fill="#6b4423" opacity="0.7" />
      <rect x="9.6" y="-9.4" width="1.1" height="8" rx="0.55" fill="#8d6e4f" />
      <path d="M 10.7 -9.4 L 15.6 -7.6 L 10.7 -5.8 Z" fill="#ff922b" />
    </g>
  )
}

/**
 * 浮き輪+くま。赤白の輪っかの真ん中から、くまの顔だけが上にのぞいているシルエットにする。
 * 小さい画面でも「輪っかに乗っている」と分かるよう、輪と顔を思いきって単純化してある。
 */
function RingBearShape() {
  return (
    <g className={styles.floaterBob}>
      <ellipse cx="0" cy="7" rx="7.5" ry="1.5" fill="#1c7ed6" opacity="0.18" />
      <circle cx="0" cy="2" r="7.4" fill="none" stroke="#ffffff" strokeWidth="3.6" />
      <circle
        cx="0"
        cy="2"
        r="7.4"
        fill="none"
        stroke="#ff6b6b"
        strokeWidth="3.6"
        strokeDasharray="4.4 4.4"
      />
      <circle cx="-3.6" cy="-5.8" r="2" fill="url(#pukupuka-bear)" />
      <circle cx="3.6" cy="-5.8" r="2" fill="url(#pukupuka-bear)" />
      <circle cx="0" cy="-2.2" r="4.8" fill="url(#pukupuka-bear)" />
      <ellipse cx="0" cy="0.4" rx="1.8" ry="1.3" fill="#f3d3ae" />
      <circle cx="0" cy="0.2" r="0.5" fill="#3f2f1e" />
      <circle cx="-1.8" cy="-2.6" r="0.6" fill="#3f2f1e" />
      <circle cx="1.8" cy="-2.6" r="0.6" fill="#3f2f1e" />
    </g>
  )
}

function FloaterShape({ kind }: { kind: FloaterKind }) {
  if (kind === 'boat') return <BoatShape />
  if (kind === 'ringBear') return <RingBearShape />
  return <DuckShape />
}

/**
 * 複数の浮遊物が重なったとき、重なっても見分けやすいように描く順番。
 * 横に広いボートをいちばん奥（土台）に、浮き輪+くまをその手前に、いちばん見慣れた
 * アヒルをいちばん手前にすることで、狭い水そうで寄り集まってもアヒルだけは
 * 必ず隠れきらないようにする（見た目だけの並べ替え。当たり判定・ゴール判定には影響しない）。
 */
const FLOATER_DRAW_ORDER: Record<FloaterKind, number> = { boat: 0, ringBear: 1, duck: 2 }

type Props = {
  stage: StageDefinition
  state: PukupukaGameState
  /** じゃぐちが押されている（＝注水中）かどうか。 */
  faucetActive: boolean
  faucetDisabled: boolean
  onFaucetHoldStart: () => void
  onFaucetHoldEnd: () => void
  onFaucetTap: () => void
  /** せん/排水が開いている（＝排水中）かどうか。 */
  drainOpen: boolean
  drainDisabled: boolean
  onDrainToggle: () => void
  /** ゲートが開いている（＝通り抜けられる）かどうか。 */
  gateOpen: boolean
  gateDisabled: boolean
  onGateToggle: () => void
  /** 流れ板が押し流している向き。 */
  boardFlowDirection: BoardFlowDirection
  boardDisabled: boolean
  onWave?: (x: number, y: number) => void
  focusedFloaterId?: string
  onBoardToggle: () => void
}

export default function PukupukaStage({
  stage,
  state,
  faucetActive,
  faucetDisabled,
  onFaucetHoldStart,
  onFaucetHoldEnd,
  onFaucetTap,
  drainOpen,
  drainDisabled,
  onDrainToggle,
  gateOpen,
  gateDisabled,
  onGateToggle,
  boardFlowDirection,
  boardDisabled,
  onBoardToggle,
  onWave,
  focusedFloaterId,
}: Props) {
  const cleared = state.phase === 'cleared'
  const goal = stage.goal.area
  const faucetSurfaceY = waterSurfaceYOf(stage, state, stage.faucet?.targetBodyId ?? stage.waterBodies[0].id)
  const gateFlowY = stage.gate
    ? Math.max(
        stage.gate.y + 10,
        Math.min(
          stage.gate.y + stage.gate.height - 10,
          (waterSurfaceYOf(stage, state, stage.gate.leftBodyId) +
            waterSurfaceYOf(stage, state, stage.gate.rightBodyId)) /
            2,
        ),
      )
    : 0
  const boardPushDirection = Math.sign(boardFlowSpeed(state, stageDriftDirection(stage))) || 1
  const goalRingX = goal.x + goal.width * 0.72
  const goalRingY = goal.y + goal.height * 0.52
  const goalFlagX = goal.x + goal.width * 0.18
  const viewportWidth = Math.min(stage.viewportWidth ?? stage.width, stage.width)
  const remainingFloaters = state.floaters.filter((floater) => stage.goal.floaterIds.includes(floater.id) && !state.rescuedIds.includes(floater.id))
  const focused = remainingFloaters.find((floater) => floater.id === focusedFloaterId)
  const followedFloaters = focused ? [focused] : remainingFloaters.length ? remainingFloaters : state.floaters
  const focusX = followedFloaters.length
    ? followedFloaters.reduce((sum, floater) => sum + floater.x, 0) / followedFloaters.length
    : viewportWidth / 2
  const cameraX = Math.max(0, Math.min(stage.width - viewportWidth, focusX - viewportWidth * 0.4))

  return (
    <svg
      className={styles.stageSvg}
      viewBox={`${cameraX} 0 ${viewportWidth} ${stage.height}`}
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
      data-testid="pukupuka-stage"
      data-camera-x={cameraX.toFixed(2)}
      onPointerDown={(event) => {
        if ((event.target as Element).closest('foreignObject') || event.button > 0) return
        const matrix = event.currentTarget.getScreenCTM()
        if (!matrix) return
        const point = event.currentTarget.createSVGPoint()
        point.x = event.clientX
        point.y = event.clientY
        const local = point.matrixTransform(matrix.inverse())
        onWave?.(local.x, local.y)
      }}
    >
      <defs>
        <linearGradient id="pukupuka-stone" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#accfd1" /><stop offset="1" stopColor="#628e9c" />
        </linearGradient>
        <pattern id="pukupuka-tiles" width="12" height="10" patternUnits="userSpaceOnUse">
          <rect width="12" height="10" fill="#edf6ee" />
          <path d="M0 10H12 M12 0V10" fill="none" stroke="#d6e7dd" strokeWidth="0.5" />
          <rect x="1" y="1" width="10" height="8" rx="1.5" fill="#fff" opacity="0.3" />
        </pattern>
        <linearGradient id="pukupuka-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9cdae3" />
          <stop offset="100%" stopColor="#f1f3da" />
        </linearGradient>
        <linearGradient id="pukupuka-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#67dfe3" />
          <stop offset="100%" stopColor="#258cb9" />
        </linearGradient>
        <linearGradient id="pukupuka-duck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="100%" stopColor="#fcc419" />
        </linearGradient>
        <linearGradient id="pukupuka-boat-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c98a4b" />
          <stop offset="100%" stopColor="#8a5a2b" />
        </linearGradient>
        <linearGradient id="pukupuka-bear" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d9a86c" />
          <stop offset="100%" stopColor="#a9764a" />
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
        {Array.from({ length: Math.ceil(stage.width / 100) }, (_, index) => (
          <g key={`clouds-${index}`} transform={`translate(${index * 100} 0)`}>
            <ellipse cx="22" cy="12" rx="13" ry="5.5" fill="#ffffff" opacity="0.75" />
            <ellipse cx="74" cy="9" rx="10" ry="4.5" fill="#ffffff" opacity="0.6" />
          </g>
        ))}

        {/* 水そうの内側。水がないところはうすい水色にして、水面の位置を分かりやすくする。 */}
        <path d={`M0 24 Q18 7 42 24 T92 20 T${stage.width} 24 V145 H0Z`} fill="#a1cbb7" opacity="0.6" />
        <rect x="6" y="22" width={stage.width - 10} height="121" rx="7" fill="#427a83" opacity="0.25" />
        <rect x="6" y="20" width={stage.width - 12} height="120" rx="6" fill="url(#pukupuka-tiles)" />
        {stage.waterBodies.map((body) => <g key={`marks-${body.id}`} opacity="0.45">
          {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${body.left + 1} ${body.floorY - 12 * (i + 1)} h${i % 2 ? 2 : 4}`} stroke="#4c8e9a" strokeWidth="0.6" />)}
        </g>)}

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
              {stage.board?.circulation && stage.board.targetBodyId === body.id && depth > 2 ? (
                <g clipPath={`url(#pukupuka-clip-${body.id})`} opacity="0.45">
                  {[0.25, 0.55, 0.8].map((part) => <g key={part} transform={`translate(${body.left + width * part} ${surfaceY + Math.min(12, depth * 0.5)}) scale(${boardPushDirection} 1)`}>
                    <path className={styles.currentArrow} d="M-3 -2 L0 0 L-3 2 M1 -2 L4 0 L1 2" fill="none" stroke="#edffff" strokeWidth="1.2" strokeLinecap="round" />
                  </g>)}
                </g>
              ) : null}
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

        {stage.gate && state.gateFlow.direction !== 0 && state.gateFlow.strength > 0 ? (
          <g
            className={styles.gateWaterFlow}
            data-testid="pukupuka-gate-flow"
            data-flow-direction={state.gateFlow.direction > 0 ? 'right' : 'left'}
            data-flow-strength={state.gateFlow.strength.toFixed(2)}
            transform={`translate(${stage.gate.x + stage.gate.width / 2} ${gateFlowY}) scale(${state.gateFlow.direction} 1)`}
          >
            <path d="M -13 -5 L -3 0 L -13 5" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M -3 -5 L 7 0 L -3 5" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="-7" r="2.4" fill="#d8f5ff" />
            <circle cx="13" cy="4" r="1.8" fill="#ffffff" />
          </g>
        ) : null}

        {stage.levelMarkerY ? <g>
          <path d={`M16 ${stage.levelMarkerY} H44`} stroke="#448856" strokeWidth="1.3" strokeDasharray="2 2" />
          <path d={`M15 ${stage.levelMarkerY - 3} l4 3 l-4 3Z`} fill="#448856" />
        </g> : null}
        {/* ゴールの光。水位に関係なく同じ場所で光り続け、目印になる。 */}
        <ellipse
          className={styles.goalGlow}
          cx={goal.x + goal.width / 2}
          cy={goal.y + goal.height / 2}
          rx={goal.width * 0.75}
          ry={goal.height * 1.4}
          fill="url(#pukupuka-goal-glow)"
        />

        {stage.solids.map((solid) => (
          <g key={solid.id}>
            <rect className={solidClassName(solid)} x={solid.x} y={solid.y} width={solid.width} height={solid.height} rx="1.3" />
            <rect x={solid.x + 0.6} y={solid.y + 0.6} width={Math.max(0, solid.width - 1.2)} height={Math.max(0, solid.height - 1.2)} rx="1" fill="url(#pukupuka-stone)" />
            {Array.from({ length: Math.floor(solid.height / 9) }, (_, i) => <path key={i} d={`M${solid.x + 0.5} ${solid.y + (i + 1) * 9} h${solid.width - 1} m${-solid.width / 2} 0 v-4`} stroke="#547f90" strokeWidth="0.5" opacity="0.55" />)}
            <path d={`M${solid.x + 1} ${solid.y + 1} H${solid.x + solid.width - 1}`} stroke={solid.kind === 'platform' ? '#a3d481' : '#e1f0e3'} strokeWidth="2" strokeLinecap="round" />
            {solid.kind === 'platform' ? <path d={`M${solid.x + 2} ${solid.y - 0.5} l1 -2 l1 2 m3 0 l1 -3 l1 3`} stroke="#5e9f74" fill="none" strokeWidth="0.8" /> : null}
          </g>
        ))}
        <g>
          <rect x={goal.x} y={goal.y + goal.height} width={goal.width} height="3" rx="1" fill="#b37c4a" />
          <path d={`M${goal.x + 1} ${goal.y + goal.height + 1} h${goal.width - 2}`} stroke="#f6d3a1" strokeWidth="0.7" />
          <rect x={goal.x + 1} y={goal.y + goal.height + 3} width="2" height="5" fill="#805c3f" />
          <rect x={goal.x + goal.width - 3} y={goal.y + goal.height + 3} width="2" height="5" fill="#805c3f" />
        </g>

        {/* ゴールの目印: はたと浮き輪。台の上に置いて「ここへ運ぶ」と分かるようにする。 */}
        <g>
          <rect x={goalFlagX} y={goal.y - 2} width="1.6" height={goal.height + 2} rx="0.8" fill="#8d6e4f" />
          <path
            d={`M${goalFlagX + 1.6} ${goal.y - 1.4} L${goalFlagX + 9.8} ${goal.y + 1.6} L${goalFlagX + 1.6} ${goal.y + 4.6} Z`}
            fill="#ff6b6b"
          />
          <g className={cleared ? styles.goalRingCleared : undefined}>
            <circle cx={goalRingX} cy={goalRingY} r={Math.min(7, goal.height * 0.32)} fill="none" stroke="#ffffff" strokeWidth="3.4" />
            <circle
              cx={goalRingX}
              cy={goalRingY}
              r={Math.min(7, goal.height * 0.32)}
              fill="none"
              stroke="#ff6b6b"
              strokeWidth="3.4"
              strokeDasharray="5.5 5.5"
            />
          </g>
        </g>

      </g>

      <g aria-hidden="true" pointerEvents="none">
        {(stage.stars ?? []).filter((star) => !state.collectedStarIds.includes(star.id)).map((star) => (
          <g key={star.id} transform={`translate(${star.x} ${star.y})`} data-testid={`pukupuka-${star.id}`}>
            <circle r="6" fill="#fff9db" opacity="0.85" />
            <path d="M0 -5 L1.5 -1.5 L5 -1.5 L2.4 1 L3.2 4.8 L0 2.8 L-3.2 4.8 L-2.4 1 L-5 -1.5 L-1.5 -1.5 Z" fill="#fcc419" stroke="#e67700" strokeWidth="0.5" />
          </g>
        ))}
        {state.wave ? (
          <g data-testid="pukupuka-player-wave" opacity={state.wave.remainingMs / 1000}>
            <ellipse cx={state.wave.x} cy={state.wave.y} rx={4 + (1 - state.wave.remainingMs / 1000) * 32} ry={3 + (1 - state.wave.remainingMs / 1000) * 8} fill="none" stroke="#fff" strokeWidth="2" />
            <path d={`M${state.wave.x - 8} ${state.wave.y} l-4 -3 m4 3 l-4 3 M${state.wave.x + 8} ${state.wave.y} l4 -3 m-4 3 l4 3`} fill="none" stroke="#1971c2" strokeWidth="1.4" />
          </g>
        ) : null}
      </g>

      {stage.faucet ? (
        <PukupukaFaucet
          faucet={stage.faucet}
          active={faucetActive}
          disabled={faucetDisabled}
          surfaceY={faucetSurfaceY}
          onHoldStart={onFaucetHoldStart}
          onHoldEnd={onFaucetHoldEnd}
          onTap={onFaucetTap}
        />
      ) : null}
      {stage.drain ? (
        <PukupukaDrain drain={stage.drain} open={drainOpen} disabled={drainDisabled} onToggle={onDrainToggle} />
      ) : null}
      {stage.gate ? (
        <PukupukaGate gate={stage.gate} open={gateOpen} lift={state.gateLift} disabled={gateDisabled} onToggle={onGateToggle} />
      ) : null}
      {stage.board ? (
        <PukupukaBoard
          board={stage.board}
          active={waterSurfaceYOf(stage, state, stage.board.targetBodyId) < (stage.waterBodies.find((body) => body.id === stage.board?.targetBodyId)?.floorY ?? 126) - 2}
          flowDirection={boardFlowDirection}
          pushDirection={boardPushDirection}
          disabled={boardDisabled}
          onToggle={onBoardToggle}
        />
      ) : null}
      {stage.waterWheel ? <PukupukaWaterWheel wheel={stage.waterWheel} spinning={waterWheelSpinning(state)} /> : null}

      {/* 浮遊物はゲートの点線わくなど他の装飾より手前に描き、重なっても隠れないようにする。
          じゃぐち・せん・ゲートより後に描く関係上、素通りにしておかないとボタンの上に
          乗ったときにタップを奪ってしまうため、明示的にクリックを素通りさせる。 */}
      <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
        {[...state.floaters]
          .sort((a, b) => {
            const kindOf = (id: string) => stage.floaters.find((candidate) => candidate.id === id)?.kind
            return (
              (FLOATER_DRAW_ORDER[kindOf(a.id) ?? 'duck'] ?? 0) -
              (FLOATER_DRAW_ORDER[kindOf(b.id) ?? 'duck'] ?? 0)
            )
          })
          .map((floater) => {
            const definition = stage.floaters.find((candidate) => candidate.id === floater.id)
            if (!definition) return null
            // 波紋は「その浮遊物がいる水域」の水面へ描く（水域が増えても正しい水面に付く）。
            const surfaceY = surfaceYAt(stage.waterBodies, state.water, floater.x, floater.y)
            return (
              <g key={floater.id} opacity={!cleared && state.rescuedIds.includes(floater.id) ? 0.35 : 1}>
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
                  <g transform={`scale(${definition.radius / (definition.kind === 'duck' ? 8 : definition.kind === 'boat' ? 9 : 7)})`}>
                    <FloaterShape kind={definition.kind} />
                  </g>
                  {definition.kind !== 'duck' && !state.rescuedIds.includes(floater.id) && floater.submergedRatio < 0.1 ? <g className={styles.waitingFriend}>
                    <path d="M-4 -12 Q-4 -17 0 -17 H6 Q9 -17 9 -14 V-11 Q9 -8 6 -8 H2 L0 -5 V-8 H-1 Q-4 -8 -4 -12Z" fill="#fffdf1" stroke="#d2ac67" strokeWidth="0.5" />
                    <text x="2.5" y="-10" textAnchor="middle" fontSize="6" fill="#b87943" fontWeight="bold">!</text>
                  </g> : null}
                </g>
              </g>
            )
          })}
      </g>
    </svg>
  )
}
