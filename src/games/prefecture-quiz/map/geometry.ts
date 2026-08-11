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
 * MultiPolygonのうち、投影後bboxの面積が最大のpolygonのboundsだけを返す。
 * 東京都・鹿児島県の「main」piece は伊豆諸島など近い離島を選択可能なまま残すため、
 * 本土だけでなく複数polygonを含む。地方地図のfit範囲をこの合計bboxで決めると、
 * 離島ぶんの緯度幅に引っ張られて本土側の各県が不自然に小さく描かれてしまうため、
 * 地方地図のスケール計算にはこちらを使う（描画自体は従来どおり全polygonを使う）。
 */
export function primaryProjectedBounds(geometry: Geometry): Bounds {
  const polygons = splitPolygons(geometry)
  let best: Bounds | null = null
  let bestArea = -1
  for (const polygon of polygons) {
    const bounds = projectedBoundsForGeometry(polygon)
    const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
    if (area > bestArea) {
      bestArea = area
      best = bounds
    }
  }
  return best ?? projectedBoundsForGeometry(geometry)
}

/**
 * 主島を基準に、画像の表示倍率を大きく下げる離島だけを除外する。
 *
 * 県の形として十分近い島や、主島のbbox内に収まる佐渡島のような島は残す。一方で、
 * 小さな離島のために県全体の画像が縮小される場合は描画対象から外す。元のGeoJSONは
 * 変更せず、表示用geometryにだけ適用する。
 */
export function trimDisplayIslands(geometry: Geometry, minimumScaleRatio = 0.92): Geometry {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  if (!Array.isArray(polygons)) return geometry
  if (polygons.length <= 1) return geometry

  const pieces = polygons.map((coordinates, index) => {
    const polygon: Geometry = { type: 'Polygon', coordinates }
    const bounds = projectedBoundsForGeometry(polygon)
    return { index, coordinates, bounds, area: (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) }
  }).sort((a, b) => b.area - a.area)

  const main = pieces[0]
  const scaleForBounds = (bounds: Bounds) => {
    const width = Math.max(bounds.maxX - bounds.minX, 0.01)
    const height = Math.max(bounds.maxY - bounds.minY, 0.01)
    // PrefectureShapeの描画領域（240×170、padding 14）と同じ縦横比で判定する。
    return Math.min(212 / width, 142 / height)
  }

  const mainScale = scaleForBounds(main.bounds)
  let keptBounds = main.bounds
  const keptIndexes = new Set([main.index])

  for (const piece of pieces.slice(1)) {
    const nextBounds = mergeBounds([keptBounds, piece.bounds])
    if (scaleForBounds(nextBounds) / mainScale >= minimumScaleRatio) {
      keptBounds = nextBounds
      keptIndexes.add(piece.index)
    }
  }

  return { type: 'MultiPolygon', coordinates: polygons.filter((_, index) => keptIndexes.has(index)) }
}
