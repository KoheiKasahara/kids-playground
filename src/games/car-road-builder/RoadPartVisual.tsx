import { connectionsForPart, type PlacedPart } from './partDefinitions'
import { getPathSpec, pathSpecToSvgPath } from './roadGeometry'
import styles from './CarRoadBuilder.module.css'

export type RoadPartVisualProps = {
  part: Readonly<Pick<PlacedPart, 'kind' | 'rotationStep'>>
}

function pathSpecsForPart(part: RoadPartVisualProps['part']) {
  const connections = connectionsForPart(part)
  if (part.kind === 'goal') return connections.map((direction) => getPathSpec(part, direction))
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

  return (
    <span className={`${styles.roadShape} ${pathSpecs.length > 0 ? styles.pathShape : ''}`} data-testid="car-road-part-visual" aria-hidden="true">
      <span className={styles.roadTileSurface} data-testid="road-tile-surface" aria-hidden="true" />
      {pathSpecs.length > 0 && (
        <svg className={styles.roadSvg} viewBox="-0.5 -0.5 1 1" aria-hidden="true">
          {pathSpecs.map((spec, index) => <path key={index} d={pathSpecToSvgPath(spec)} />)}
          {part.kind === 'goal' && <circle className={styles.roadHub} cx="0" cy="0" r=".16" />}
        </svg>
      )}
      {part.kind === 'start' && <span className={styles.markerEmoji}>🚩</span>}
      {part.kind === 'goal' && <span className={styles.markerEmoji}>🏁</span>}
    </span>
  )
}
