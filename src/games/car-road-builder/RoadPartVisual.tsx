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
          {part.kind === 'goal' && (
            <>
              <g className={styles.goalGate} data-testid="goal-gate" transform={`rotate(${part.rotationStep * 45})`}>
                {/* The lane remains visible from the one connected edge to the centre. */}
                <rect className={styles.goalPillarShadow} x="-.4" y="-.31" width=".1" height=".57" rx=".03" />
                <rect className={styles.goalPillarShadow} x=".3" y="-.31" width=".1" height=".57" rx=".03" />
                <rect className={styles.goalPillar} data-goal-pillar="left" x="-.375" y="-.32" width=".07" height=".55" rx=".02" />
                <rect className={styles.goalPillar} data-goal-pillar="right" x=".305" y="-.32" width=".07" height=".55" rx=".02" />
                <circle className={styles.goalPillarCap} cx="-.34" cy=".23" r=".045" />
                <circle className={styles.goalPillarCap} cx=".34" cy=".23" r=".045" />
                <rect className={styles.goalBannerFrame} x="-.4" y="-.48" width=".8" height=".21" rx=".035" />
                {Array.from({ length: 16 }, (_, index) => {
                  const column = index % 8
                  const row = Math.floor(index / 8)
                  return (
                    <rect
                      key={index}
                      className={index % 2 === row % 2 ? styles.goalCheckerLight : styles.goalCheckerDark}
                      data-goal-checker="true"
                      x={-.37 + column * .0925}
                      y={-.46 + row * .085}
                      width=".0925"
                      height=".085"
                    />
                  )
                })}
                <rect className={styles.goalBannerHighlight} x="-.35" y="-.452" width=".7" height=".014" rx=".007" />
              </g>
            </>
          )}
        </svg>
      )}
      {part.kind === 'start' && <span className={styles.markerEmoji}>🚩</span>}
    </span>
  )
}
