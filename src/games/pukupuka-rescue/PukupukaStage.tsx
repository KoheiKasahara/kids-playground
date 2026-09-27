import {
  boardFlowSpeed,
  getFloater,
  leaderIdOf,
  stageDriftDirection,
  waterSurfaceYOf,
  waterWheelSpinning,
  type PukupukaGameState,
} from './pukupukaGame'
import type { BoardFlowDirection, StageDefinition } from './types'
import { surfaceYAt, waterBodyWidth } from './waterModel'
import { CharacterDefs, CharacterShape } from './PukupukaCharacters'
import { CHARACTER_BASE_RADIUS } from './characterInfo'
import { GoalMarker, SceneryBackdrop, SceneryDefs, ScenerySolids } from './PukupukaScenery'
import PukupukaFaucet from './PukupukaFaucet'
import PukupukaDrain from './PukupukaDrain'
import PukupukaGate from './PukupukaGate'
import PukupukaBoard from './PukupukaBoard'
import PukupukaWaterWheel from './PukupukaWaterWheel'
import { PukupukaBell, PukupukaDoor } from './PukupukaBellDoor'
import PukupukaWhale from './PukupukaWhale'
import PukupukaSlide from './PukupukaSlide'
import PukupukaEffects from './PukupukaEffects'
import styles from './PukupukaRescuePlay.module.css'

// ステージの見た目だけを持つコンポーネント。位置はすべてゲーム状態（2D座標）から決め、
// 波・泡・揺れはCSSアニメーションに寄せている（＝表示の演出をゲーム判定から切り離す）。
// 中身のほとんどは装飾なので aria-hidden の<g>にまとめ、状態の読み上げは画面側のテキストが担当する。
// 操作できる仕掛け（じゃぐち・せん・ゲート・プロペラ・くじら）だけは本物のボタンにして、
// AT/キーボードからも使えるようにする。
//
// 重ね順: 空と壁 → 奥の水 → しま・かべ → ゴール・さく・ベル・すべりだい → なかま → 手前の水のうすい色 → 操作 → 演出。
// 手前の水をなかまの上へ重ねることで、水に入っている下半分だけが水の色になり、浮いて見える。

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
  onWhaleTap?: () => void
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
  onWhaleTap,
}: Props) {
  const cleared = state.phase === 'cleared'
  const leaderId = leaderIdOf(stage)
  const leader = getFloater(state, leaderId)
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
  const viewportWidth = Math.min(stage.viewportWidth ?? stage.width, stage.width)
  const focusX = leader?.x ?? viewportWidth / 2
  const cameraX = Math.max(0, Math.min(stage.width - viewportWidth, focusX - viewportWidth * 0.4))
  const whale = stage.whale
  const whaleBody = whale ? stage.waterBodies.find((body) => whale.x >= body.left && whale.x <= body.right) : undefined
  const whaleReady = !!whale && !!leader && Math.abs(leader.x - whale.x) <= whale.halfWidth && leader.y < whale.y &&
    leader.submergedRatio > 0.05 && (leader.launchMs ?? 0) <= 0
  const joinedRecently = new Set(state.effects.filter((effect) => effect.kind === 'join').map((effect) => effect.id.split('-')[1]))

  // 奥から: 待っている仲間 → ついてくる仲間（後ろの子ほど奥）→ 隊長。
  const followerOrder = [...state.rescuedIds]
  const drawOrder = [
    ...state.floaters.filter((floater) => floater.id !== leaderId && !state.rescuedIds.includes(floater.id)),
    ...followerOrder.map((id) => getFloater(state, id)).filter((floater) => floater !== undefined),
    ...(leader ? [leader] : []),
  ]

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
        <SceneryDefs />
        <CharacterDefs />
        <linearGradient id="pukupuka-water" x1="0" y1="30" x2="0" y2="126" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6fe0f2" stopOpacity="0.9" />
          <stop offset="55%" stopColor="#2fa8dc" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#1b64ad" stopOpacity="0.96" />
        </linearGradient>
        <pattern id="pukupuka-caustics" width="24" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 4 Q4 1 8 4 T16 4 T24 4 M-4 11 Q0 8 4 11 T12 11 T20 11 T28 11" fill="none" stroke="#ffffff" strokeWidth="0.7" opacity="0.2" />
        </pattern>
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
              {/* 水面から下だけ。あわ・光が水面の上に出ないようにする。 */}
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

      <SceneryBackdrop stage={stage} />

      <g aria-hidden="true" pointerEvents="none">
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
              <g clipPath={`url(#pukupuka-clip-${body.id})`}>
                <g className={styles.caustics}>
                  <rect x={body.left - 24} y={surfaceY} width={width + 48} height={depth} fill="url(#pukupuka-caustics)" />
                </g>
                {[0.18, 0.5, 0.8].map((position, index) => (
                  <path
                    key={position}
                    className={styles.lightRay}
                    style={{ animationDelay: `${index * 1.1}s` }}
                    d={`M${body.left + width * position - 3} ${surfaceY} h6 l${-8} ${depth} h-5 Z`}
                    fill="#ffffff"
                    opacity="0.1"
                  />
                ))}
                {/* あわ。水の中だけに見えるよう、水面から下だけを切り抜いて描く。 */}
                {[0.2, 0.45, 0.72].map((position, index) => (
                  <circle
                    key={position}
                    className={styles.bubble}
                    cx={body.left + width * position}
                    cy={body.floorY - 4}
                    r={1.1 + index * 0.35}
                    fill="#ffffff"
                    fillOpacity="0.35"
                    stroke="#ffffff"
                    strokeWidth="0.35"
                    style={{ animationDelay: `${index * 0.9}s` }}
                  />
                ))}
                {stage.board?.circulation && stage.board.targetBodyId === body.id && depth > 2 ? (
                  <g opacity="0.55">
                    {[0.2, 0.5, 0.8].map((part) => (
                      <g key={part} transform={`translate(${body.left + width * part} ${surfaceY + Math.min(12, depth * 0.5)}) scale(${boardPushDirection} 1)`}>
                        <path className={styles.currentArrow} d="M-3 -2 L0 0 L-3 2 M1 -2 L4 0 L1 2" fill="none" stroke="#edffff" strokeWidth="1.2" strokeLinecap="round" />
                      </g>
                    ))}
                  </g>
                ) : null}
              </g>
              {depth > 0 ? (
                <g transform={`translate(${body.left} ${surfaceY})`}>
                  <path className={styles.waveBack} d={buildWavePath(width, WAVE_AMPLITUDE)} fill="#ffffff" opacity="0.3" />
                  <path className={styles.waveFront} d={buildWavePath(width, WAVE_AMPLITUDE * 0.7)} fill="#ffffff" opacity="0.45" />
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

        {stage.levelMarkerY ? (
          <g>
            <path d={`M16 ${stage.levelMarkerY} H44`} stroke="#448856" strokeWidth="1.3" strokeDasharray="2 2" />
            <path d={`M15 ${stage.levelMarkerY - 3} l4 3 l-4 3Z`} fill="#448856" />
          </g>
        ) : null}
      </g>

      <ScenerySolids stage={stage} />
      <GoalMarker stage={stage} cleared={cleared} />
      {(stage.doors ?? []).map((door) => <PukupukaDoor key={door.id} door={door} lift={state.doorLifts[door.id] ?? 0} />)}
      {(stage.bells ?? []).map((bell) => <PukupukaBell key={bell.id} bell={bell} rung={state.rungBellIds.includes(bell.id)} />)}
      {stage.slide ? <PukupukaSlide slide={stage.slide} layer="back" active={state.slide !== null} /> : null}
      {whale ? (
        <PukupukaWhale
          whale={whale}
          jetting={state.whaleJetMs > 0}
          ready={whaleReady}
          surfaceY={whaleBody ? waterSurfaceYOf(stage, state, whaleBody.id) : whale.y}
          disabled={cleared}
          onTap={() => onWhaleTap?.()}
        />
      ) : null}

      <g aria-hidden="true" pointerEvents="none">
        {(stage.stars ?? []).filter((star) => !state.collectedStarIds.includes(star.id)).map((star) => (
          <g key={star.id} transform={`translate(${star.x} ${star.y})`} data-testid={`pukupuka-${star.id}`}>
            <g className={styles.starTwinkle}>
              <circle r="5.4" fill="#fff9db" opacity="0.7" />
              <path d="M0 -5 L1.5 -1.5 L5 -1.5 L2.4 1 L3.2 4.8 L0 2.8 L-3.2 4.8 L-2.4 1 L-5 -1.5 L-1.5 -1.5 Z" fill="#fcc419" stroke="#e67700" strokeWidth="0.5" strokeLinejoin="round" />
              <path d="M-1.4 -2.6 L-0.4 -3.6" stroke="#fff9db" strokeWidth="0.7" strokeLinecap="round" />
            </g>
          </g>
        ))}
        {state.wave ? (
          <g data-testid="pukupuka-player-wave" opacity={state.wave.remainingMs / 1000}>
            <ellipse cx={state.wave.x} cy={state.wave.y} rx={4 + (1 - state.wave.remainingMs / 1000) * 32} ry={3 + (1 - state.wave.remainingMs / 1000) * 8} fill="none" stroke="#fff" strokeWidth="2" />
            <path d={`M${state.wave.x - 8} ${state.wave.y} l-4 -3 m4 3 l-4 3 M${state.wave.x + 8} ${state.wave.y} l4 -3 m-4 3 l4 3`} fill="none" stroke="#1971c2" strokeWidth="1.4" />
          </g>
        ) : null}
      </g>

      {/* 浮遊物はゲートの点線わくなど他の装飾より手前に描き、重なっても隠れないようにする。
          じゃぐち・せん・ゲートのボタンを奪わないよう、明示的にクリックを素通りさせる。 */}
      <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
        {drawOrder.map((floater) => {
          const definition = stage.floaters.find((candidate) => candidate.id === floater.id)
          if (!definition) return null
          const isLeader = floater.id === leaderId
          const rescued = state.rescuedIds.includes(floater.id)
          const mood = isLeader ? 'leader' : rescued ? 'happy' : 'waiting'
          const scale = definition.radius / CHARACTER_BASE_RADIUS
          const facing = floater.facing ?? 1
          const flying = (floater.launchMs ?? 0) > 0 || (isLeader && state.slide !== null)
          // 波紋は「その浮遊物がいる水域」の水面へ描く（水域が増えても正しい水面に付く）。
          const surfaceY = surfaceYAt(stage.waterBodies, state.water, floater.x, floater.y)
          return (
            <g key={floater.id} data-mood={mood}>
              {surfaceY !== undefined && floater.submergedRatio > 0.05 && !flying ? (
                <ellipse
                  className={styles.ripple}
                  cx={floater.x}
                  cy={surfaceY + 0.4}
                  rx={definition.radius * 1.5}
                  ry={1.6}
                  fill="#ffffff"
                  opacity="0.5"
                />
              ) : null}
              <g
                data-testid={`pukupuka-floater-${floater.id}`}
                data-floater-x={floater.x.toFixed(2)}
                data-floater-y={floater.y.toFixed(2)}
                data-facing={facing}
                transform={`translate(${floater.x} ${floater.y})`}
              >
                <g className={joinedRecently.has(floater.id) ? styles.joinPop : undefined}>
                  <g transform={`scale(${scale * facing} ${scale})`}>
                    <g className={flying ? styles.floaterFly : cleared ? styles.floaterCheer : styles.floaterBob}>
                      <CharacterShape kind={definition.kind} mood={cleared && !isLeader ? 'happy' : mood} />
                    </g>
                  </g>
                </g>
                {mood === 'waiting' ? (
                  <g transform={`translate(${definition.radius * 0.7 * -facing} ${-definition.radius * 1.35 - 4})`}>
                    <g className={styles.waitingFriend}>
                      <path d="M-4.4 -3.4 Q-4.4 -6.2 -1.8 -6.2 H1.8 Q4.4 -6.2 4.4 -3.4 Q4.4 -0.8 1.8 -0.8 H1 L0 1.4 L-1 -0.8 H-1.8 Q-4.4 -0.8 -4.4 -3.4 Z" fill="#fffdf1" stroke="#e8a44a" strokeWidth="0.5" />
                      <text x="0" y="-1.8" textAnchor="middle" fontSize="4.8" fill="#e8590c" fontWeight="bold">!</text>
                    </g>
                  </g>
                ) : null}
              </g>
            </g>
          )
        })}
      </g>

      {stage.slide ? <PukupukaSlide slide={stage.slide} layer="front" active={state.slide !== null} /> : null}

      {/* 手前の水。浮いている仲間の下半分を水の色にし、しまの水に入った部分もうすく染める。 */}
      <g aria-hidden="true" pointerEvents="none">
        {stage.waterBodies.map((body) => {
          const surfaceY = waterSurfaceYOf(stage, state, body.id)
          const width = waterBodyWidth(body)
          const depth = Math.max(0, body.floorY - surfaceY)
          if (depth <= 0) return null
          return (
            <g key={body.id} clipPath={`url(#pukupuka-column-${body.id})`}>
              <rect x={body.left} y={surfaceY + 0.8} width={width} height={Math.max(0, depth - 0.8)} fill="#1c9fd6" opacity="0.2" />
              <path d={`M${body.left} ${surfaceY + 0.5} H${body.left + width}`} stroke="#effcff" strokeWidth="0.7" opacity="0.8" />
            </g>
          )
        })}
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

      <PukupukaEffects effects={state.effects} />
    </svg>
  )
}
