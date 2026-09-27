import { memo } from 'react'
import type { SolidDefinition, StageDefinition } from './types'
import styles from './PukupukaRescuePlay.module.css'

// 動かない背景（空・丘・水そうのタイル壁）と固定物（かべ・床・しま）、ゴールの目印の絵。
// ステージごとに変わらないので memo して、毎フレームの再描画から外す。

/** 画面が縦長・横長でステージの外に余白ができても、空と地面で埋める広さ。 */
const BLEED = 400

/** 背景用のグラデーション・模様。ステージSVGの<defs>に1回だけ置く。 */
export function SceneryDefs() {
  return (
    <>
      <linearGradient id="pukupuka-sky" x1="0" y1="-160" x2="0" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#3aa8e6" />
        <stop offset="55%" stopColor="#8fd6f6" />
        <stop offset="85%" stopColor="#d9f3ff" />
        <stop offset="100%" stopColor="#fff3d1" />
      </linearGradient>
      <radialGradient id="pukupuka-sun" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fff9db" />
        <stop offset="40%" stopColor="#ffe066" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#ffe066" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="pukupuka-ground" x1="0" y1="136" x2="0" y2="220" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#8fd16d" />
        <stop offset="100%" stopColor="#5fae4b" />
      </linearGradient>
      <linearGradient id="pukupuka-hill-far" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a8dcc0" />
        <stop offset="100%" stopColor="#8fcfae" />
      </linearGradient>
      <linearGradient id="pukupuka-hill-near" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#9bd67a" />
        <stop offset="100%" stopColor="#6fbf5c" />
      </linearGradient>
      <pattern id="pukupuka-tiles" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#f1fafc" />
        <rect x="0.35" y="0.35" width="7.3" height="7.3" rx="1.1" fill="#fbfeff" />
        <path d="M1.2 1.6 Q1.4 1.2 2.6 1.2" stroke="#ffffff" strokeWidth="0.6" strokeLinecap="round" />
        <path d="M0 8 H8 M8 0 V8" stroke="#d2e8ee" strokeWidth="0.45" />
      </pattern>
      <linearGradient id="pukupuka-inner-shade" x1="0" y1="22" x2="0" y2="126" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
        <stop offset="60%" stopColor="#7cc3d6" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#2f7f99" stopOpacity="0.25" />
      </linearGradient>
      <pattern id="pukupuka-wall-tiles" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill="#bfe6f1" />
        <rect x="0.3" y="0.3" width="3.4" height="3.4" rx="0.7" fill="#d7f1f8" />
        <path d="M0.8 1 H2" stroke="#f5fdff" strokeWidth="0.45" strokeLinecap="round" />
      </pattern>
      <linearGradient id="pukupuka-wall-shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
        <stop offset="35%" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="100%" stopColor="#1d6d86" stopOpacity="0.28" />
      </linearGradient>
      <linearGradient id="pukupuka-rock" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f3d9a4" />
        <stop offset="100%" stopColor="#c9955c" />
      </linearGradient>
      <pattern id="pukupuka-pebbles" width="10" height="9" patternUnits="userSpaceOnUse">
        <ellipse cx="3" cy="3" rx="2.2" ry="1.3" fill="#b77f47" opacity="0.28" />
        <ellipse cx="8" cy="7" rx="1.6" ry="1" fill="#b77f47" opacity="0.24" />
        <ellipse cx="2.6" cy="2.6" rx="1" ry="0.45" fill="#fff4dc" opacity="0.5" />
      </pattern>
      <linearGradient id="pukupuka-grass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a9e57f" />
        <stop offset="100%" stopColor="#5cb847" />
      </linearGradient>
      <linearGradient id="pukupuka-wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e2a868" />
        <stop offset="100%" stopColor="#a8683a" />
      </linearGradient>
      <radialGradient id="pukupuka-whale" cx="35%" cy="25%" r="85%">
        <stop offset="0%" stopColor="#8fd0ff" />
        <stop offset="100%" stopColor="#1971c2" />
      </radialGradient>
      <radialGradient id="pukupuka-bell-gold" cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#fff5c0" />
        <stop offset="50%" stopColor="#ffd43b" />
        <stop offset="100%" stopColor="#e89400" />
      </radialGradient>
      <linearGradient id="pukupuka-chrome" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f8fdff" />
        <stop offset="50%" stopColor="#b9ced6" />
        <stop offset="100%" stopColor="#7d98a4" />
      </linearGradient>
      <linearGradient id="pukupuka-gate-panel" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#ffc56b" />
        <stop offset="100%" stopColor="#e07b24" />
      </linearGradient>
      <radialGradient id="pukupuka-goal-glow" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#fff3bf" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#fff3bf" stopOpacity="0" />
      </radialGradient>
    </>
  )
}

function Cloud({ x, y, scale, className }: { x: number; y: number; scale: number; className?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className={className}>
        <ellipse cx="0" cy="2.4" rx="11" ry="3.4" fill="#cbe8f5" opacity="0.8" />
        <circle cx="-5" cy="0" r="4.2" fill="#ffffff" />
        <circle cx="1" cy="-2.2" r="5.6" fill="#ffffff" />
        <circle cx="7" cy="0.4" r="3.8" fill="#ffffff" />
        <ellipse cx="1" cy="2" rx="10.4" ry="2.8" fill="#ffffff" />
        <circle cx="-0.6" cy="-4" r="2" fill="#ffffff" opacity="0.9" />
      </g>
    </g>
  )
}

/** 空・太陽・雲・丘・地面と、水そうの内側のタイル壁。 */
export const SceneryBackdrop = memo(function SceneryBackdrop({ stage }: { stage: StageDefinition }) {
  const width = stage.width
  const hillPath = (baseY: number, amplitude: number, period: number) => {
    let path = `M${-BLEED} ${baseY}`
    for (let x = -BLEED; x < width + BLEED; x += period) {
      path += ` Q${x + period / 4} ${baseY - amplitude} ${x + period / 2} ${baseY} T${x + period} ${baseY}`
    }
    return `${path} V${stage.height + BLEED} H${-BLEED} Z`
  }
  return (
    <g aria-hidden="true">
      <rect x={-BLEED} y={-BLEED} width={width + BLEED * 2} height={BLEED + 60} fill="url(#pukupuka-sky)" />
      <circle cx={width - 16} cy="9" r="13" fill="url(#pukupuka-sun)" className={styles.sunGlow} />
      <circle cx={width - 16} cy="9" r="5.2" fill="#fff3a6" stroke="#ffd43b" strokeWidth="0.8" />
      <Cloud x={18} y={-14} scale={0.9} className={styles.cloudDrift} />
      <Cloud x={width * 0.55} y={-26} scale={0.7} className={styles.cloudDriftSlow} />
      <Cloud x={width * 0.36} y={8} scale={0.62} className={styles.cloudDriftSlow} />
      <Cloud x={-10} y={-50} scale={1.1} className={styles.cloudDrift} />
      <path d={hillPath(20, 9, 46)} fill="url(#pukupuka-hill-far)" />
      <path d={hillPath(26, 6, 30)} fill="url(#pukupuka-hill-near)" />
      {/* 地面と草 */}
      <rect x={-BLEED} y="134" width={width + BLEED * 2} height={BLEED} fill="url(#pukupuka-ground)" />
      <path
        d={Array.from({ length: Math.ceil((width + 40) / 7) }, (_, index) => {
          const x = -20 + index * 7
          return `M${x} 137 q1 -3 1.6 0 q1.2 -4 2 0`
        }).join(' ')}
        fill="none"
        stroke="#4f9e3d"
        strokeWidth="0.6"
        strokeLinecap="round"
      />
      {/* 水そうの影と、内側のタイル壁 */}
      <rect x="7.5" y="23" width={width - 11} height="120" rx="7" fill="#1d5f73" opacity="0.2" />
      <rect x="14" y="20" width={width - 28} height="108" fill="url(#pukupuka-tiles)" />
      <rect x="14" y="20" width={width - 28} height="108" fill="url(#pukupuka-inner-shade)" />
      <path
        d={`M14 27 ${Array.from({ length: Math.ceil((width - 28) / 6) }, () => `q1.5 -1.6 3 0 q1.5 1.6 3 0`).join(' ')}`}
        fill="none"
        stroke="#74c0fc"
        strokeWidth="1.3"
        opacity="0.55"
      />
      <path
        d={`M14 29.4 ${Array.from({ length: Math.ceil((width - 28) / 6) }, () => `q1.5 1.6 3 0 q1.5 -1.6 3 0`).join(' ')}`}
        fill="none"
        stroke="#63e6be"
        strokeWidth="0.9"
        opacity="0.45"
      />
      {/* タイル壁のさかなのもよう */}
      {Array.from({ length: Math.max(1, Math.floor((width - 28) / 36)) }, (_, index) => (
        <g key={index} transform={`translate(${26 + index * 36} ${58 + (index % 2) * 34})`} opacity="0.16">
          <path d="M-5 0 Q0 -4 5 0 Q0 4 -5 0 Z M5 0 L8.4 -2.6 L8.4 2.6 Z" fill="#1c7ed6" />
          <circle cx="-2.4" cy="-0.6" r="0.7" fill="#ffffff" />
        </g>
      ))}
    </g>
  )
})

function isExposedTop(solid: SolidDefinition): boolean {
  return solid.y > 0
}

function TileBlock({ solid, stageBottom }: { solid: SolidDefinition; stageBottom: number }) {
  const { x, y, width, height } = solid
  const hanging = y + height < stageBottom - 1
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx="1.4" fill="url(#pukupuka-wall-tiles)" />
      <rect x={x} y={y} width={width} height={height} rx="1.4" fill="url(#pukupuka-wall-shade)" />
      <rect x={x} y={y} width={width} height={height} rx="1.4" fill="none" stroke="#5b9fb4" strokeWidth="0.55" />
      {isExposedTop(solid) ? (
        <g>
          <rect x={x - 0.7} y={y - 1} width={width + 1.4} height="3" rx="1.5" fill="#ffffff" stroke="#7fb8c9" strokeWidth="0.5" />
          <path d={`M${x + 0.8} ${y - 0.1} H${x + width - 0.8}`} stroke="#e3f7ff" strokeWidth="0.6" strokeLinecap="round" />
        </g>
      ) : null}
      {hanging ? (
        <rect x={x - 0.7} y={y + height - 2} width={width + 1.4} height="3" rx="1.5" fill="#e9f7fb" stroke="#7fb8c9" strokeWidth="0.5" />
      ) : null}
    </g>
  )
}

function FloorBlock({ solid }: { solid: SolidDefinition }) {
  const { x, y, width, height } = solid
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx="2.4" fill="url(#pukupuka-wall-tiles)" />
      <rect x={x} y={y} width={width} height={height} rx="2.4" fill="#1d6d86" opacity="0.12" />
      <rect x={x} y={y} width={width} height={height} rx="2.4" fill="none" stroke="#5b9fb4" strokeWidth="0.55" />
      <path d={`M${x + 8} ${y + 0.8} H${x + width - 8}`} stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
    </g>
  )
}

/** しま・岩場。土の岩肌に、草のふたをのせる。 */
function IslandBlock({ solid }: { solid: SolidDefinition }) {
  const { x, y, width, height } = solid
  const bumps = Math.max(2, Math.round(width / 3.2))
  const step = (width + 1.6) / bumps
  let grass = `M${x - 0.8} ${y + 0.4}`
  for (let index = 0; index < bumps; index += 1) {
    grass += ` q${step / 2} ${index % 2 ? 2.6 : 3.4} ${step} 0`
  }
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx="2" fill="url(#pukupuka-rock)" />
      <rect x={x} y={y} width={width} height={height} rx="2" fill="url(#pukupuka-pebbles)" />
      <rect x={x + width - 2.2} y={y + 1} width="2" height={Math.max(0, height - 2)} rx="1" fill="#8a5a2b" opacity="0.18" />
      <rect x={x} y={y} width={width} height={height} rx="2" fill="none" stroke="#9c6b3c" strokeWidth="0.55" />
      <path d={`${grass} V${y - 1.2} Q${x + width / 2} ${y - 2.4} ${x - 0.8} ${y - 1.2} Z`} fill="url(#pukupuka-grass)" stroke="#3f8f33" strokeWidth="0.5" strokeLinejoin="round" />
      <path d={`M${x + 1} ${y - 0.9} Q${x + width / 2} ${y - 1.8} ${x + width - 1} ${y - 0.9}`} fill="none" stroke="#d3f9b5" strokeWidth="0.55" strokeLinecap="round" />
      <path d={`M${x + 1.6} ${y - 1.2} l0.5 -1.8 l0.6 1.8 M${x + width - 3} ${y - 1.2} l0.6 -2.2 l0.5 2.2`} fill="none" stroke="#3f8f33" strokeWidth="0.45" strokeLinecap="round" />
      {width >= 10 ? (
        <g transform={`translate(${x + width * 0.62} ${y - 2.1})`}>
          <circle r="0.9" fill="#ffffff" />
          <circle r="0.4" fill="#fcc419" />
        </g>
      ) : null}
    </g>
  )
}

/** かべ・床・しまの絵。当たり判定の矩形そのままの位置に描く。 */
export const ScenerySolids = memo(function ScenerySolids({ stage }: { stage: StageDefinition }) {
  const floorTop = stage.solids.find((solid) => solid.kind === 'floor')?.y ?? 126
  return (
    <g aria-hidden="true">
      {stage.solids.map((solid) => (
        <g key={solid.id} data-solid-id={solid.id}>
          {solid.kind === 'floor' ? (
            <FloorBlock solid={solid} />
          ) : solid.kind === 'platform' ? (
            <IslandBlock solid={solid} />
          ) : (
            <TileBlock solid={solid} stageBottom={floorTop} />
          )}
        </g>
      ))}
    </g>
  )
})

/**
 * ゴールの目印。桟橋に着地する面は板の桟橋と小屋、水に浮いたまま入る面は旗つきのブイで示す。
 * 光は水位に関係なく同じ場所で光り続け、「ここへ連れて帰る」目印になる。
 */
export const GoalMarker = memo(function GoalMarker({ stage, cleared }: { stage: StageDefinition; cleared: boolean }) {
  const goal = stage.goal.area
  const bottom = goal.y + goal.height
  const landing = !!stage.goal.requiresLanding
  const support = stage.solids.find((solid) =>
    solid.kind === 'platform' && solid.x <= goal.x + goal.width / 2 && solid.x + solid.width >= goal.x + goal.width / 2 &&
    solid.y >= goal.y && solid.y <= bottom + 8)
  const deckY = landing ? bottom : support?.y
  const hutX = goal.x + goal.width - 10.5
  const poleX = goal.x + goal.width - 3.2
  return (
    <g aria-hidden="true" data-testid="pukupuka-goal">
      <ellipse
        className={styles.goalGlow}
        cx={goal.x + goal.width / 2}
        cy={goal.y + goal.height / 2}
        rx={goal.width * 0.75}
        ry={Math.min(goal.height, 24) * 0.9}
        fill="url(#pukupuka-goal-glow)"
      />
      {deckY !== undefined ? (
        <g>
          {/* 小屋 */}
          <g transform={`translate(${hutX} ${deckY})`}>
            <rect x="0.6" y="-8.6" width="8.8" height="8.6" rx="0.8" fill="#fff4e0" stroke="#9c6b3c" strokeWidth="0.5" />
            <path d="M-0.8 -8 L5 -13.2 L10.8 -8 Z" fill="#ff6b6b" stroke="#c92a2a" strokeWidth="0.55" strokeLinejoin="round" />
            <rect x="3.6" y="-5" width="2.8" height="5" rx="1.2" fill="#e8a25c" stroke="#9c6b3c" strokeWidth="0.4" />
            <circle cx="5" cy="-10" r="1.1" fill="#fff3bf" stroke="#c92a2a" strokeWidth="0.35" />
          </g>
          {/* 板の桟橋 */}
          <rect x={goal.x} y={deckY - 0.2} width={goal.width} height="2.6" rx="0.8" fill="url(#pukupuka-wood)" stroke="#7a4a24" strokeWidth="0.45" />
          {Array.from({ length: Math.max(1, Math.floor(goal.width / 4)) }, (_, index) => (
            <path key={index} d={`M${goal.x + 4 * (index + 1)} ${deckY} v2.2`} stroke="#7a4a24" strokeWidth="0.35" opacity="0.7" />
          ))}
        </g>
      ) : (
        <g>
          {/* 浮きのロープ */}
          <path d={`M${goal.x} ${goal.y + 3} Q${goal.x - 1.6} ${goal.y + goal.height / 2} ${goal.x} ${bottom}`} fill="none" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.4 1.2" opacity="0.8" />
          {Array.from({ length: 3 }, (_, index) => (
            <g key={index} transform={`translate(${goal.x} ${goal.y + 6 + index * ((goal.height - 10) / 2)})`}>
              <ellipse rx="1.6" ry="1.2" fill="#ff6b6b" stroke="#a51d1d" strokeWidth="0.35" />
              <path d="M-1.5 0 H1.5" stroke="#ffffff" strokeWidth="0.7" />
            </g>
          ))}
        </g>
      )}
      {/* 旗 */}
      <g className={cleared ? styles.goalFlagCleared : styles.goalFlag}>
        <rect x={poleX} y={goal.y - 7} width="1.2" height={(deckY ?? bottom) - goal.y + 7} rx="0.6" fill="#8d6e4f" />
        <circle cx={poleX + 0.6} cy={goal.y - 7.4} r="1" fill="#ffd43b" stroke="#e67700" strokeWidth="0.3" />
        <path
          d={`M${poleX} ${goal.y - 6.2} L${poleX - 8.4} ${goal.y - 3.4} L${poleX} ${goal.y - 0.6} Z`}
          fill="#ff6b6b"
          stroke="#c92a2a"
          strokeWidth="0.4"
          strokeLinejoin="round"
        />
        <path d={`M${poleX - 4.9} ${goal.y - 3.2} l1.6 -1.4 l1.6 1.4 v1.4 h-3.2 Z`} fill="#ffffff" />
      </g>
    </g>
  )
})
