export type Position = readonly [number, number]
export type Geometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown }
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

export const MAP_WIDTH = 1000
export const MAP_HEIGHT = 560
const emptyBounds = (): Bounds => ({ minX: 0, minY: 0, maxX: MAP_WIDTH, maxY: MAP_HEIGHT })

function positions(value: unknown, output: Position[]): void {
  if (!Array.isArray(value)) return
  if (typeof value[0] === 'number' && typeof value[1] === 'number') { output.push([value[0], value[1]]); return }
  value.forEach((child) => positions(child, output))
}
export function webMercator([longitude, latitude]: Position): Position {
  const clipped = Math.max(-85, Math.min(85, latitude)) * Math.PI / 180
  return [longitude * Math.PI / 180, Math.log(Math.tan(Math.PI / 4 + clipped / 2))]
}
export function project(position: Position): Position {
  const [x, y] = webMercator(position)
  return [MAP_WIDTH / 2 + x * (MAP_WIDTH / (2 * Math.PI)), MAP_HEIGHT / 2 - y * (MAP_WIDTH / (2 * Math.PI))]
}
export function boundsForPositions(points: readonly Position[]): Bounds {
  return boundsForPoints(points)
}

export type LongitudeBounds = { minLongitude: number; maxLongitude: number; centerLongitude: number }

/**
 * 点群を含む最短の経度範囲を、連続した経度（必要なら 180° を超える値）で返す。
 * 例: 170°, 175°, -175° は 170°〜185° として扱う。
 */
export function shortestLongitudeBounds(longitudes: readonly number[]): LongitudeBounds {
  if (!longitudes.length) return { minLongitude: -180, maxLongitude: 180, centerLongitude: 0 }
  const normalized = longitudes.map((longitude) => ((longitude % 360) + 360) % 360).sort((a, b) => a - b)
  if (normalized.length === 1) return { minLongitude: normalized[0], maxLongitude: normalized[0], centerLongitude: normalized[0] }

  let largestGap = -1
  let afterLargestGap = 0
  for (let index = 0; index < normalized.length; index += 1) {
    const next = index === normalized.length - 1 ? normalized[0] + 360 : normalized[index + 1]
    const gap = next - normalized[index]
    if (gap > largestGap) {
      largestGap = gap
      afterLargestGap = (index + 1) % normalized.length
    }
  }
  const minLongitude = normalized[afterLargestGap]
  const maxLongitude = minLongitude + 360 - largestGap
  return { minLongitude, maxLongitude, centerLongitude: (minLongitude + maxLongitude) / 2 }
}

/** 指定した経度帯に合わせて点群を連続化してから地図上の bounds を求める。 */
export function boundsForPositionsNear(points: readonly Position[], referenceLongitude: number): Bounds {
  return boundsForPoints(points.map(([longitude, latitude]) => [longitudeNear(longitude, referenceLongitude), latitude] as Position))
}
function pointsForGeometry(geometry: Geometry): Position[] { const result: Position[] = []; positions(geometry.coordinates, result); return result }
export function boundsForGeometry(geometry: Geometry): Bounds {
  const points = pointsForGeometry(geometry).map(project)
  if (!points.length) return emptyBounds()
  return points.reduce<Bounds>((bounds, [x, y]) => ({ minX: Math.min(bounds.minX, x), minY: Math.min(bounds.minY, y), maxX: Math.max(bounds.maxX, x), maxY: Math.max(bounds.maxY, y) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
}
export function primaryBounds(geometry: Geometry): Bounds {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : Array.isArray(geometry.coordinates) ? geometry.coordinates : []
  // フィジーのように日付変更線をまたぐ国は、元の座標の外接矩形だと世界幅になる。
  // 描画と同じく帯ごとに分割してから、もっとも大きい主領土を選ぶ。
  const candidates = polygons.flatMap((coordinates) => Array.isArray(coordinates)
    ? coordinates.flatMap((ring) => antimeridianClippedRings(ring).map((points) => boundsForPoints(points)))
    : [])
  return candidates.reduce((best, candidate) => ((candidate.maxX - candidate.minX) * (candidate.maxY - candidate.minY) > (best.maxX - best.minX) * (best.maxY - best.minY) ? candidate : best), candidates[0] ?? emptyBounds())
}

function boundsForPoints(points: readonly Position[]): Bounds {
  if (!points.length) return emptyBounds()
  return points.map(project).reduce<Bounds>((bounds, [x, y]) => ({ minX: Math.min(bounds.minX, x), minY: Math.min(bounds.minY, y), maxX: Math.max(bounds.maxX, x), maxY: Math.max(bounds.maxY, y) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
}
export function mergeBounds(bounds: readonly Bounds[]): Bounds {
  if (!bounds.length) return emptyBounds()
  return bounds.reduce<Bounds>((all, current) => ({ minX: Math.min(all.minX, current.minX), minY: Math.min(all.minY, current.minY), maxX: Math.max(all.maxX, current.maxX), maxY: Math.max(all.maxY, current.maxY) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
}
function pointsForRing(ring: unknown): Position[] {
  if (!Array.isArray(ring)) return []
  return ring.filter((point): point is Position => Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number')
}

/**
 * 経度を連続した座標系にほどく。170°→-170°のような反子午線またぎを
 * -340°の直線ではなく、170°→190°という短い辺として扱えるようにする。
 */
function unwrapRing(points: readonly Position[]): Position[] {
  if (!points.length) return []
  const result: Position[] = [[points[0][0], points[0][1]]]
  for (const [longitude, latitude] of points.slice(1)) {
    let unwrapped = longitude
    const previous = result[result.length - 1][0]
    while (unwrapped - previous > 180) unwrapped -= 360
    while (unwrapped - previous < -180) unwrapped += 360
    result.push([unwrapped, latitude])
  }
  return result
}

function intersection(a: Position, b: Position, boundary: number): Position {
  const distance = b[0] - a[0]
  if (distance === 0) return [boundary, a[1]]
  const t = (boundary - a[0]) / distance
  return [boundary, a[1] + (b[1] - a[1]) * t]
}

function clipAtBoundary(points: readonly Position[], boundary: number, keepGreater: boolean): Position[] {
  if (!points.length) return []
  const result: Position[] = []
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index + points.length - 1) % points.length]
    const current = points[index]
    const wasInside = keepGreater ? previous[0] >= boundary : previous[0] <= boundary
    const isInside = keepGreater ? current[0] >= boundary : current[0] <= boundary
    if (isInside !== wasInside) result.push(intersection(previous, current, boundary))
    if (isInside) result.push(current)
  }
  return result
}

/**
 * 反子午線をまたぐリングを [-180, 180] の世界にクリップする。
 *
 * Sutherland–Hodgman で各360°帯に切り出すため、ロシア・フィジー・南極の
 * 隣接点がSVGの左右端を横断する一本の辺になることはない。穴もfillRule=evenodd
 * の別リングとして同じ規則で扱える。
 */
export function antimeridianClippedRings(ring: unknown): Position[][] {
  const unwrapped = unwrapRing(pointsForRing(ring))
  if (unwrapped.length < 3) return []
  const longitudes = unwrapped.map(([longitude]) => longitude)
  const firstBand = Math.floor((Math.min(...longitudes) + 180) / 360)
  const lastBand = Math.floor((Math.max(...longitudes) + 180 - Number.EPSILON) / 360)
  const clipped: Position[][] = []
  for (let band = firstBand; band <= lastBand; band += 1) {
    const left = -180 + band * 360
    const right = 180 + band * 360
    const afterLeft = clipAtBoundary(unwrapped, left, true)
    const inBand = clipAtBoundary(afterLeft, right, false)
    if (inBand.length >= 3) clipped.push(inBand.map(([longitude, latitude]) => [longitude - band * 360, latitude]))
  }
  return clipped
}

function ringPath(ring: unknown): string {
  return antimeridianClippedRings(ring).map((items) => items.map((point, index) => {
    const [x, y] = project(point)
    return `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ') + 'Z').join(' ')
}
export function pathForGeometry(geometry: Geometry): string {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  if (!Array.isArray(polygons)) return ''
  return polygons.flatMap((polygon) => Array.isArray(polygon) ? polygon.map((ring) => ringPath(ring)) : []).join(' ')
}

/**
 * 国境を referenceLongitude に近い世界コピーへ一度だけ描画する。
 * 常に3枚の世界地図を重ねる方式を避け、日付変更線の両側を同じ連続座標帯に置く。
 */
export function pathForGeometryNear(geometry: Geometry, referenceLongitude: number): string {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  if (!Array.isArray(polygons)) return ''
  return polygons.flatMap((polygon) => Array.isArray(polygon) ? polygon.map((ring) => {
    const unwrapped = unwrapRing(pointsForRing(ring))
    if (unwrapped.length < 3) return ''
    const offset = longitudeNear(unwrapped[0][0], referenceLongitude) - unwrapped[0][0]
    return unwrapped.map(([longitude, latitude], index) => {
      const [x, y] = project([longitude + offset, latitude])
      return `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
    }).join(' ') + 'Z'
  }) : []).join(' ')
}
export type Camera = { scale: number; x: number; y: number }
type CameraLimits = { minimumDimension?: number; maximumScale?: number }

export function cameraForBounds(bounds: Bounds, coverage = 0.52, { minimumDimension = 20, maximumScale = 9 }: CameraLimits = {}): Camera {
  const width = Math.max(minimumDimension, bounds.maxX - bounds.minX)
  const height = Math.max(minimumDimension, bounds.maxY - bounds.minY)
  const scale = Math.max(1, Math.min(maximumScale, Math.min((MAP_WIDTH * coverage) / width, (MAP_HEIGHT * coverage) / height)))
  return { scale, x: MAP_WIDTH / 2 - ((bounds.minX + bounds.maxX) / 2) * scale, y: MAP_HEIGHT / 2 - ((bounds.minY + bounds.maxY) / 2) * scale }
}

/**
 * 国土の外接矩形が小さいときだけ、周辺地理を残せる範囲で拡大上限を上げる。
 * 通常サイズ以上の国は従来と同じ cameraForBounds の計算を使う。
 */
export function cameraForCountryBounds(bounds: Bounds): Camera {
  const longestDimension = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
  const smallCountryThreshold = 14
  if (longestDimension >= smallCountryThreshold) return cameraForBounds(bounds)

  // 小国は色で強調済みなので、形の拡大より周辺との位置関係を優先する。
  // 最大4.8倍ならバヌアツ等でも近くの島・オーストラリア側を画面に残せる。
  return cameraForBounds(bounds, 0.58, { minimumDimension: 22, maximumScale: 4.8 })
}

/** -180〜180 の経度を、reference から最短になる連続座標へ移す。 */
export function longitudeNear(longitude: number, reference: number): number {
  const normalized = ((longitude + 180) % 360 + 360) % 360 - 180
  return normalized + 360 * Math.round((reference - normalized) / 360)
}

/** 日付変更線をまたぐ行程も、地球上で短い方向へ連続化する。 */
export function shortestLongitudePath(points: readonly Position[]): Position[] {
  if (!points.length) return []
  const result: Position[] = [[points[0][0], points[0][1]]]
  for (const [longitude, latitude] of points.slice(1)) {
    result.push([longitudeNear(longitude, result[result.length - 1][0]), latitude])
  }
  return result
}
export function quadraticBezier(from: Position, to: Position, t: number): Position {
  const mx = (from[0] + to[0]) / 2
  const my = (from[1] + to[1]) / 2 - Math.min(75, Math.abs(to[0] - from[0]) * 0.18 + 20)
  const u = 1 - t
  return [u * u * from[0] + 2 * u * t * mx + t * t * to[0], u * u * from[1] + 2 * u * t * my + t * t * to[1]]
}
export function bezierPath(from: Position, to: Position): string {
  const mx = (from[0] + to[0]) / 2
  const my = (from[1] + to[1]) / 2 - Math.min(75, Math.abs(to[0] - from[0]) * 0.18 + 20)
  return `M${from[0]} ${from[1]} Q${mx} ${my} ${to[0]} ${to[1]}`
}
