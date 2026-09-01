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
              <circle className={styles.goalTargetShadow} cx="0" cy="0" r=".18" />
              <circle className={styles.goalTarget} cx="0" cy="0" r=".145" />
              <circle className={styles.goalTargetDot} cx="0" cy="0" r=".045" />
            </>
          )}
          {part.kind === 'goal' && (
            <g className={styles.goalGate} data-testid="goal-gate" transform={`rotate(${part.rotationStep * 45})`}>
              <path className={styles.goalGateShadow} d="M-.36-.07V-.35H.36V-.07" />
              <rect className={styles.goalPillar} x="-.4" y="-.35" width=".09" height=".29" rx=".025" />
              <rect className={styles.goalPillar} x=".31" y="-.35" width=".09" height=".29" rx=".025" />
              <rect className={styles.goalBanner} x="-.34" y="-.47" width=".68" height=".12" rx=".025" />
              {Array.from({ length: 16 }, (_, index) => {
                const column = index % 8
                const row = Math.floor(index / 8)
                return <rect key={index} className={index % 2 === row % 2 ? styles.goalCheckerLight : styles.goalCheckerDark} x={-.32 + column * .08} y={-.455 + row * .055} width=".08" height=".055" />
              })}
              <rect className={styles.goalFinishLine} x="-.24" y="-.13" width=".48" height=".09" rx=".012" />
              {Array.from({ length: 8 }, (_, index) => (
                <rect key={index} className={index % 2 === 0 ? styles.goalCheckerLight : styles.goalCheckerDark} x={-.24 + index * .06} y="-.13" width=".06" height=".09" />
              ))}
              <path className={styles.goalArrow} d="M-.12-.205H.12M.08-.235L.12-.205.08-.175" />
            </g>
          )}
        </svg>
      )}
      {part.kind === 'start' && <span className={styles.markerEmoji}>🚩</span>}
    </span>
  )
}
