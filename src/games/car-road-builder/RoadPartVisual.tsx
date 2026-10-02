import { connectionsForPart, type PlacedPart } from './partDefinitions'
import { getPathSpec, pathSpecToSvgPath } from './roadGeometry'
import styles from './CarRoadBuilder.module.css'

export type RoadPartVisualProps = {
  part: Readonly<Pick<PlacedPart, 'kind' | 'rotationStep'>>
}

function pathSpecsForPart(part: RoadPartVisualProps['part']) {
  const connections = connectionsForPart(part)
  if (part.kind === 'goal') return connections.length > 0 ? [getPathSpec(part, connections[0]!)] : []
  if (part.kind === 'crossroad' || part.kind === 'xroad') {
    return connections.slice(0, 2).map((direction) => getPathSpec(part, direction))
  }
  if (part.kind === 'double-curve') {
    return connections.filter((_direction, index) => index % 2 === 0).map((direction) => getPathSpec(part, direction))
  }
  return [getPathSpec(part)]
}

/** How far from the cell centre the small flag stands. */
const GOAL_FLAG_DISTANCE = 0.4

/**
 * The finish line sits across the road at the cell centre, and a small
 * checkered flag stands in a tile corner behind it. Nothing is drawn on the
 * entrance half of the tile, so the road coming in stays visible in all
 * eight directions.
 */
function GoalMarks({ rotationStep }: { rotationStep: number }) {
  // Straight entrances put the flag in the back-right corner, diagonal ones in
  // the corner straight behind the finish line; both leave the road clear.
  const flagAngle = ((rotationStep - (rotationStep % 2 === 0 ? 1 : 0)) * Math.PI) / 4
  // Place the flag like the SVG rotate() below would, but keep it upright so
  // it always reads as a flag.
  const flagX = Math.round(-GOAL_FLAG_DISTANCE * Math.sin(flagAngle) * 1000) / 1000
  const flagY = Math.round(GOAL_FLAG_DISTANCE * Math.cos(flagAngle) * 1000) / 1000
  return (
    <>
      <g className={styles.goalGate} data-testid="goal-gate" transform={`rotate(${rotationStep * 45} 0 0)`}>
        <rect className={styles.goalLineFrame} x="-.2" y="-.1" width=".4" height=".2" rx=".03" />
        {Array.from({ length: 8 }, (_, index) => {
          const column = index % 4
          const row = Math.floor(index / 4)
          return (
            <rect
              key={index}
              className={column % 2 === row % 2 ? styles.goalCheckerLight : styles.goalCheckerDark}
              data-goal-checker="true"
              x={-.18 + column * .09}
              y={-.08 + row * .08}
              width=".09"
              height=".08"
            />
          )
        })}
      </g>
      <g data-testid="goal-flag" transform={`translate(${flagX} ${flagY}) scale(1.2)`}>
        <ellipse className={styles.goalFlagShadow} cx="-.05" cy=".13" rx=".06" ry=".02" />
        <rect className={styles.goalFlagPole} x="-.065" y="-.14" width=".03" height=".28" rx=".012" />
        <rect className={styles.goalLineFrame} x="-.04" y="-.14" width=".17" height=".12" rx=".015" />
        {Array.from({ length: 6 }, (_, index) => {
          const column = index % 3
          const row = Math.floor(index / 3)
          return (
            <rect
              key={index}
              className={column % 2 === row % 2 ? styles.goalCheckerDark : styles.goalCheckerLight}
              x={-.03 + column * .05}
              y={-.13 + row * .05}
              width=".05"
              height=".05"
            />
          )
        })}
        <circle className={styles.goalFlagCap} cx="-.05" cy="-.15" r=".025" />
      </g>
    </>
  )
}

export default function RoadPartVisual({ part }: RoadPartVisualProps) {
  const pathSpecs = pathSpecsForPart(part)
  const goalEntryDirection = part.kind === 'goal' ? connectionsForPart(part)[0] : undefined

  return (
    <span
      className={`${styles.roadShape} ${pathSpecs.length > 0 ? styles.pathShape : ''}`}
      data-testid="car-road-part-visual"
      data-goal-entry-direction={goalEntryDirection}
      aria-hidden="true"
    >
      <span className={styles.roadTileSurface} data-testid="road-tile-surface" aria-hidden="true" />
      {pathSpecs.length > 0 && (
        <svg className={styles.roadSvg} viewBox="-0.5 -0.5 1 1" aria-hidden="true">
          {part.kind === 'goal'
            ? pathSpecs.map((spec, index) => (
              <g key={index}>
                <path className={styles.goalRoadBase} data-goal-road-path="base" d={pathSpecToSvgPath(spec)} />
                <path className={styles.goalRoadStripe} data-goal-road-path="stripe" d={pathSpecToSvgPath(spec)} />
              </g>
            ))
            : pathSpecs.map((spec, index) => <path key={index} d={pathSpecToSvgPath(spec)} />)}
          {part.kind === 'goal' && <GoalMarks rotationStep={part.rotationStep} />}
        </svg>
      )}
      {part.kind === 'start' && <span className={styles.markerEmoji}>🚩</span>}
    </span>
  )
}
