import type { Ref } from 'react'
import PaperWrestler from './PaperWrestler'
import { BOX_HALF, type Side, type SumoState } from './sumoGame'
import { CENTER, DEPTH_PX, FIGURE_SCALE, RING_PX, SIDE_COLORS, perspective, type View, project, ringPath } from './projection'
import styles from './TontonSumoPlay.module.css'

export type Ripple = { id: number; x: number; z: number; player: Side }

const BOX_FRONT = 66
const RING = ringPath(1)
const point = (x: number, z: number) => { const p = project(x, z); return `${p.x.toFixed(1)} ${p.y.toFixed(1)}` }
const quad = (hx: number, hz: number) => `M${point(-hx, hz)} L${point(hx, hz)} L${point(hx, -hz)} L${point(-hx, -hz)}Z`
const TOP = quad(BOX_HALF.x, BOX_HALF.z)
const SHEET = quad(BOX_HALF.x - 0.12, BOX_HALF.z - 0.1)
const FRONT_LEFT = project(-BOX_HALF.x, -BOX_HALF.z)
const FRONT_RIGHT = project(BOX_HALF.x, -BOX_HALF.z)
const FRONT = `M${FRONT_LEFT.x} ${FRONT_LEFT.y} L${FRONT_RIGHT.x} ${FRONT_RIGHT.y} L${FRONT_RIGHT.x - 4} ${FRONT_RIGHT.y + BOX_FRONT} L${FRONT_LEFT.x + 4} ${FRONT_LEFT.y + BOX_FRONT}Z`
const STARTING_LINES = [-0.13, 0.13].map((x) => `M${point(x, 0.13)} L${point(x, -0.13)}`).join(' ')

type Props = {
  state: SumoState
  ripples?: Ripple[]
  label: string
  svgRef?: Ref<SVGSVGElement>
  idle?: boolean
  view: View
}

/** The cardboard box, the drawn ring, and the two folded paper wrestlers on top. */
export default function SumoScene({ state, ripples = [], label, svgRef, idle = false, view }: Props) {
  const order = (['left', 'right'] as const).slice().sort((a, b) => state.bodies[b].z - state.bodies[a].z)
  return (
    <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
      <ellipse cx={CENTER.x} cy={FRONT_LEFT.y + BOX_FRONT + 4} rx="330" ry="20" fill="#9a7a55" opacity=".2" />
      <g key={`box-${state.taps}`} className={state.taps && !state.winner ? styles.boxBounce : undefined}>
        <path d={FRONT} fill="#c8945c" stroke="#9c7247" strokeWidth="3" strokeLinejoin="round" />
        <path d={`M${FRONT_LEFT.x + 14} ${FRONT_LEFT.y + 18} L${FRONT_RIGHT.x - 14} ${FRONT_RIGHT.y + 18}`} stroke="#b07d4b" strokeWidth="2" opacity=".6" />
        <text x={CENTER.x} y={FRONT_LEFT.y + 48} textAnchor="middle" fill="#7d5532" fontSize="26" fontWeight="900" letterSpacing="6" opacity=".75">どすこい</text>
        <path d={TOP} fill="#ddb683" stroke="#9c7247" strokeWidth="3" strokeLinejoin="round" />
        <path d={SHEET} fill="#f8ecd3" />
        <path d={RING} fill="#f2dbac" />
        <path d={RING} fill="none" stroke="#b98b52" strokeWidth="11" strokeLinejoin="round" />
        <path d={RING} fill="none" stroke="#e8c886" strokeWidth="4" strokeDasharray="5 9" />
        <path d={STARTING_LINES} stroke="#fffaf0" strokeWidth="4" strokeLinecap="round" opacity=".8" />
      </g>

      {ripples.map((ripple) => {
        const p = project(ripple.x, ripple.z)
        return (
          <g key={ripple.id} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`} aria-hidden="true">
            <ellipse className={styles.ripple} rx="34" ry={34 * (DEPTH_PX / RING_PX)} fill="none" stroke={SIDE_COLORS[ripple.player].ink} strokeWidth="4" />
            <text className={styles.tapWord} y="-14" textAnchor="middle" fill={SIDE_COLORS[ripple.player].ink}>トン!</text>
          </g>
        )
      })}

      {order.map((side) => {
        const body = state.bodies[side]
        const base = project(body.x, body.z)
        const scale = FIGURE_SCALE * perspective(body.z)
        const facing = Math.cos(body.heading)
        const lean = (body.lean * 180 / Math.PI) * (facing < 0 ? -1 : 1)
        const losing = Boolean(state.winner && state.winner !== side)
        const motion = state.winner ? (losing ? undefined : styles.cheer) : idle ? styles.idle : undefined
        return (
          <g key={side} data-side={side}>
            <ellipse cx={base.x} cy={base.y} rx={52 * scale} ry={52 * scale * (DEPTH_PX / RING_PX)} fill="#7a5a36" opacity={0.2 / (1 + body.y * 12)} />
            <g transform={`translate(${base.x.toFixed(1)} ${(base.y - body.y * RING_PX).toFixed(1)}) scale(${scale.toFixed(3)}) rotate(${lean.toFixed(1)})`}>
              <g className={motion}>
                <PaperWrestler index={state.fighters[side]} belt={SIDE_COLORS[side].belt} heading={body.heading} />
              </g>
            </g>
          </g>
        )
      })}

      {state.winner && (
        <g className={styles.confetti} aria-hidden="true">
          {[100, 175, 250, 325, 400, 475, 550, 620].map((x, i) => (
            <path key={x} d={`M${x} ${60 + (i % 3) * 30} l8 -13 8 13 -8 13Z`} fill={['#dba44b', '#dd8b76', '#85b5ae'][i % 3]} />
          ))}
        </g>
      )}
    </svg>
  )
}
