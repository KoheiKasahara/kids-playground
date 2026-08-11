export type Position = readonly [number, number]

export type Geometry = {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: unknown
}

export type MapFeature = {
  properties: { N03_001: string }
  geometry: Geometry
}

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

function collectPositions(value: unknown, positions: Position[]): void {
  if (!Array.isArray(value)) return
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    positions.push([value[0], value[1]])
    return
  }
  value.forEach((child) => collectPositions(child, positions))
}

export function positionsForGeometry(geometry: Geometry): Position[] {
  const positions: Position[] = []
  collectPositions(geometry.coordinates, positions)
  return positions
}

export function boundsForGeometry(geometry: Geometry): Bounds {
  const positions = positionsForGeometry(geometry)
  if (positions.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  return positions.reduce<Bounds>(
    (bounds, [x, y]) => ({
      minX: Math.min(bounds.minX, x), minY: Math.min(bounds.minY, y),
      maxX: Math.max(bounds.maxX, x), maxY: Math.max(bounds.maxY, y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  )
}

export function mergeBounds(boundsList: readonly Bounds[]): Bounds {
  return boundsList.reduce<Bounds>(
    (merged, bounds) => ({
      minX: Math.min(merged.minX, bounds.minX), minY: Math.min(merged.minY, bounds.minY),
      maxX: Math.max(merged.maxX, bounds.maxX), maxY: Math.max(merged.maxY, bounds.maxY),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  )
}

export type Projection = (position: Position) => Position

/** Web Mercator（形状を保つ円筒図法）への変換。 */
export function webMercator([longitude, latitude]: Position): Position {
  const latitudeRadians = Math.max(-85, Math.min(85, latitude)) * Math.PI / 180
  return [longitude * Math.PI / 180, Math.log(Math.tan(Math.PI / 4 + latitudeRadians / 2))]
}

/** 投影後の座標でboundsを求める。 */
export function projectedBoundsForGeometry(geometry: Geometry): Bounds {
  const positions = positionsForGeometry(geometry).map(webMercator)
  if (positions.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  return positions.reduce<Bounds>(
    (bounds, [x, y]) => ({ minX: Math.min(bounds.minX, x), minY: Math.min(bounds.minY, y), maxX: Math.max(bounds.maxX, x), maxY: Math.max(bounds.maxY, y) }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  )
}

/** Web Mercator座標を SVG 座標へfitする。外部の地図ライブラリは使わない。 */
export function createProjection(bounds: Bounds, width: number, height: number, padding = 8): Projection {
  const longitudeSpan = Math.max(bounds.maxX - bounds.minX, 0.01)
  const latitudeSpan = Math.max(bounds.maxY - bounds.minY, 0.01)
  const scale = Math.min((width - padding * 2) / longitudeSpan, (height - padding * 2) / latitudeSpan)
  const drawWidth = longitudeSpan * scale
  const drawHeight = latitudeSpan * scale
  const offsetX = (width - drawWidth) / 2
  const offsetY = (height - drawHeight) / 2
  return (position) => {
    const [x, y] = webMercator(position)
    return [
    offsetX + (x - bounds.minX) * scale,
    offsetY + (bounds.maxY - y) * scale,
  ]
  }
}

function ringPath(ring: unknown, project: Projection): string {
  if (!Array.isArray(ring)) return ''
  const points = ring.filter(
    (value): value is [number, number] => Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number',
  )
  return points.map((point, index) => {
    const [x, y] = project(point)
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ') + (points.length > 0 ? ' Z' : '')
}

export function pathForGeometry(geometry: Geometry, project: Projection): string {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  if (!Array.isArray(polygons)) return ''
  return polygons.flatMap((polygon) => Array.isArray(polygon) ? polygon.map((ring) => ringPath(ring, project)) : []).join(' ')
}

/** GeometryをPolygon単位に分割する（MultiPolygonなら要素ごと、Polygonなら1件の配列）。 */
export function splitPolygons(geometry: Geometry): Geometry[] {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  if (!Array.isArray(polygons)) return []
  return polygons.map((polygon) => ({ type: 'Polygon', coordinates: polygon }))
}

/**
 * 離島が極端に離れている県は、全国図・単県図で本土部分を読める大きさに保つために
 * polygon 単位で切り出す。元の GeoJSON は変更せず、表示にだけ適用する。
 */
export function cropGeometry(geometry: Geometry, keep: (bounds: Bounds) => boolean): Geometry {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  if (!Array.isArray(polygons)) return geometry
  const kept = polygons.filter((polygon) => {
    const bounds = boundsForGeometry({ type: 'Polygon', coordinates: polygon })
    return keep(bounds)
  })
  if (kept.length === 0) return geometry
  return { type: 'MultiPolygon', coordinates: kept }
}
