import type {
  Geometry,
  GlobeCountry,
  GlobeFeature,
  GlobeVector3,
  ZoomLevel,
} from './types'

export const LABEL_AREA_RANK_LIMITS: Readonly<Record<ZoomLevel, number>> = {
  0: 8,
  1: 18,
  // ズーム時は世界順位で候補を落とさず、投影位置と可視半球で地域を絞る。
  2: Number.POSITIVE_INFINITY,
  3: Number.POSITIVE_INFINITY,
}

export const MAX_VISIBLE_LABELS: Readonly<Record<ZoomLevel, number>> = {
  0: 6,
  1: 10,
  2: 16,
  3: 22,
}

export const VISIBLE_HEMISPHERE_EDGE_THRESHOLDS: Readonly<Record<ZoomLevel, number>> = {
  0: 0.08,
  1: 0.12,
  2: 0.22,
  3: 0.4,
}

export const LABEL_VIEWPORT_PADDING = 8
export const LABEL_COLLISION_GAP = 4
export const LABEL_HEIGHT_PX = 30

const NORMAL_PRIORITY_BASE = 10_000
const GEOMETRY_EPSILON = 1e-8
const LABEL_SLOT_WIDTH_PX = 48
const MIN_VISIBLE_LABELS = 6
const CENTER_PROXIMITY_BONUS = 300

type Coordinate = readonly [longitude: number, latitude: number]
type RawCoordinate = readonly unknown[]
type RawRing = readonly RawCoordinate[]
type RawPolygon = readonly RawRing[]

type PolygonStats = {
  longitude: number
  latitude: number
  area: number
}

export type CountryLabelCandidate = {
  countryId: string
  nameJa: string
  anchor: GlobeVector3
  area: number
  areaRank: number
  priority: number
}

export type LabelRect = {
  left: number
  top: number
  right: number
  bottom: number
}

export type LabelLayoutCandidate = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  priority: number
}

export type LabelPlacement = LabelLayoutCandidate & {
  nameJa: string
  rect: LabelRect
}

type LabelLayoutCandidateInput =
  | LabelLayoutCandidate
  | (Omit<LabelLayoutCandidate, 'name'> & { nameJa: string })

export type LabelViewport = {
  width: number
  height: number
  padding?: number
}

export function maxVisibleLabelsForViewport(
  zoomLevel: ZoomLevel,
  viewportWidth: number,
): number {
  const widthBasedLimit = Math.max(
    MIN_VISIBLE_LABELS,
    Math.floor(Math.max(0, viewportWidth) / LABEL_SLOT_WIDTH_PX) + 1,
  )
  return Math.min(MAX_VISIBLE_LABELS[zoomLevel], widthBasedLimit)
}

export function visibleHemisphereEdgeThresholdForZoom(zoomLevel: ZoomLevel): number {
  return VISIBLE_HEMISPHERE_EDGE_THRESHOLDS[zoomLevel]
}

function distanceFromViewportCenter(x: number, y: number, viewport: LabelViewport): number {
  return Math.hypot(
    (x - viewport.width / 2) / viewport.width,
    (y - viewport.height / 2) / viewport.height,
  )
}

export function priorityForLabelLayout(
  candidate: Pick<CountryLabelCandidate, 'priority'>,
  x: number,
  y: number,
  viewport: LabelViewport,
  zoomLevel: ZoomLevel,
): number {
  if (zoomLevel < 2) return candidate.priority

  // ズーム中は画面中央に近い地域を先に置き、同じ地域では面積順位を優先する。
  const screenDistance = Math.min(1, distanceFromViewportCenter(x, y, viewport))
  const centerProximityBonus = (1 - screenDistance) * CENTER_PROXIMITY_BONUS
  return candidate.priority + centerProximityBonus
}

function coordinateOf(value: unknown): Coordinate | null {
  if (!Array.isArray(value) || value.length < 2) return null

  const longitude = value[0]
  const latitude = value[1]
  if (typeof longitude !== 'number' || typeof latitude !== 'number') return null
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null

  return [longitude, latitude]
}

function polygonsOf(geometry: Geometry): readonly RawPolygon[] {
  if (!Array.isArray(geometry.coordinates)) return []

  if (geometry.type === 'Polygon') {
    return [geometry.coordinates as RawPolygon]
  }

  return geometry.coordinates as RawPolygon[]
}

function normalizeLongitude(longitude: number): number {
  return ((longitude + 180) % 360 + 360) % 360 - 180
}

function unwrappedRing(rawRing: RawRing): Coordinate[] {
  const coordinates = rawRing
    .map(coordinateOf)
    .filter((coordinate): coordinate is Coordinate => coordinate !== null)

  if (coordinates.length > 1) {
    const first = coordinates[0]!
    const last = coordinates[coordinates.length - 1]!
    if (first[0] === last[0] && first[1] === last[1]) coordinates.pop()
  }

  if (coordinates.length === 0) return []

  const firstLongitude = coordinates[0]![0]
  return coordinates.map(([longitude, latitude]) => {
    let unwrappedLongitude = longitude
    while (unwrappedLongitude - firstLongitude > 180) unwrappedLongitude -= 360
    while (unwrappedLongitude - firstLongitude < -180) unwrappedLongitude += 360
    return [unwrappedLongitude, latitude]
  })
}

function statsForRing(rawRing: RawRing): PolygonStats | null {
  const ring = unwrappedRing(rawRing)
  if (ring.length < 3) return null

  let crossSum = 0
  let longitudeSum = 0
  let latitudeSum = 0

  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index]!
    const next = ring[(index + 1) % ring.length]!
    const cross = current[0] * next[1] - next[0] * current[1]
    crossSum += cross
    longitudeSum += (current[0] + next[0]) * cross
    latitudeSum += (current[1] + next[1]) * cross
  }

  if (Math.abs(crossSum) < GEOMETRY_EPSILON) {
    const average = ring.reduce(
      (sum, [longitude, latitude]) => ({
        longitude: sum.longitude + longitude,
        latitude: sum.latitude + latitude,
      }),
      { longitude: 0, latitude: 0 },
    )

    return {
      longitude: normalizeLongitude(average.longitude / ring.length),
      latitude: average.latitude / ring.length,
      area: 0,
    }
  }

  const latitude = latitudeSum / (3 * crossSum)
  const longitude = normalizeLongitude(longitudeSum / (3 * crossSum))
  // 緯度の高い地域ほど経度方向が短くなるため、LODの重要度だけ補正する。
  const area = Math.abs(crossSum) * 0.5 * Math.max(0.1, Math.cos(latitude * Math.PI / 180))

  return { longitude, latitude, area }
}

function largestPolygonStats(geometry: Geometry): PolygonStats | null {
  let largest: PolygonStats | null = null

  for (const polygon of polygonsOf(geometry)) {
    const outerRing = polygon[0]
    if (!Array.isArray(outerRing)) continue

    const stats = statsForRing(outerRing)
    if (stats !== null && (largest === null || stats.area > largest.area)) {
      largest = stats
    }
  }

  return largest
}

export function latLngToGlobePosition(
  latitude: number,
  longitude: number,
  radius = 1,
): GlobeVector3 {
  const latitudeRadians = latitude * Math.PI / 180
  const theta = (90 - longitude) * Math.PI / 180
  const horizontalRadius = Math.cos(latitudeRadians) * radius

  return {
    x: horizontalRadius * Math.cos(theta),
    y: Math.sin(latitudeRadians) * radius,
    z: horizontalRadius * Math.sin(theta),
  }
}

export function isInVisibleHemisphere(
  cameraPosition: GlobeVector3,
  countryPosition: GlobeVector3,
  edgeThreshold = VISIBLE_HEMISPHERE_EDGE_THRESHOLDS[3],
): boolean {
  const cameraLength = Math.hypot(cameraPosition.x, cameraPosition.y, cameraPosition.z)
  const countryLength = Math.hypot(countryPosition.x, countryPosition.y, countryPosition.z)
  if (cameraLength === 0 || countryLength === 0) return false

  const dot = (
    cameraPosition.x * countryPosition.x
    + cameraPosition.y * countryPosition.y
    + cameraPosition.z * countryPosition.z
  ) / (cameraLength * countryLength)

  return dot >= edgeThreshold
}

export function computeCountryLabelCandidates(
  countries: readonly GlobeCountry[],
  features: readonly GlobeFeature[],
): readonly CountryLabelCandidate[] {
  const featuresByNumericId = new Map<number, GlobeFeature[]>()
  for (const feature of features) {
    const featureList = featuresByNumericId.get(feature.id)
    if (featureList === undefined) {
      featuresByNumericId.set(feature.id, [feature])
    } else {
      featureList.push(feature)
    }
  }

  const candidatesWithArea = countries.flatMap((country) => {
    const countryFeatures = featuresByNumericId.get(country.numericId) ?? []
    let largest: PolygonStats | null = null

    for (const feature of countryFeatures) {
      const stats = largestPolygonStats(feature.geometry)
      if (stats !== null && (largest === null || stats.area > largest.area)) {
        largest = stats
      }
    }

    if (largest === null) return []

    return [{
      countryId: country.id,
      nameJa: country.nameJa,
      anchor: latLngToGlobePosition(largest.latitude, largest.longitude),
      area: largest.area,
      areaRank: 0,
      priority: 0,
    }]
  })

  const areaSorted = [...candidatesWithArea].sort((first, second) => (
    second.area - first.area || first.countryId.localeCompare(second.countryId)
  ))
  const areaRankByCountryId = new Map(
    areaSorted.map((candidate, index) => [candidate.countryId, index + 1]),
  )

  return candidatesWithArea.map((candidate) => {
    const areaRank = areaRankByCountryId.get(candidate.countryId) ?? candidatesWithArea.length
    return {
      ...candidate,
      areaRank,
      priority: NORMAL_PRIORITY_BASE - areaRank,
    }
  })
}

function compareLabelPriority(first: Pick<CountryLabelCandidate, 'priority' | 'areaRank'>, second: Pick<CountryLabelCandidate, 'priority' | 'areaRank'>): number {
  return second.priority - first.priority || first.areaRank - second.areaRank
}

export function filterLabelCandidatesForZoom(
  candidates: readonly CountryLabelCandidate[],
  zoomLevel: ZoomLevel,
): readonly CountryLabelCandidate[] {
  const rankLimit = LABEL_AREA_RANK_LIMITS[zoomLevel]
  const eligible = candidates.filter((candidate) => candidate.areaRank <= rankLimit)

  return [...eligible].sort(compareLabelPriority)
}

export function rectanglesOverlap(
  first: LabelRect,
  second: LabelRect,
  gap = 0,
): boolean {
  return first.left < second.right + gap
    && first.right > second.left - gap
    && first.top < second.bottom + gap
    && first.bottom > second.top - gap
}

function rectFor(candidate: LabelLayoutCandidate): LabelRect {
  return {
    left: candidate.x - candidate.width / 2,
    top: candidate.y - candidate.height / 2,
    right: candidate.x + candidate.width / 2,
    bottom: candidate.y + candidate.height / 2,
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

export function clampLabelToViewport(
  candidate: LabelLayoutCandidate,
  viewport: LabelViewport,
): LabelLayoutCandidate {
  const padding = viewport.padding ?? 0
  const minimumX = padding + candidate.width / 2
  const maximumX = viewport.width - padding - candidate.width / 2
  const minimumY = padding + candidate.height / 2
  const maximumY = viewport.height - padding - candidate.height / 2

  return {
    ...candidate,
    x: clamp(candidate.x, Math.min(minimumX, maximumX), Math.max(minimumX, maximumX)),
    y: clamp(candidate.y, Math.min(minimumY, maximumY), Math.max(minimumY, maximumY)),
  }
}

export function placeLabelsGreedily(
  candidates: readonly LabelLayoutCandidateInput[],
  viewport: LabelViewport,
  maxLabels: number | undefined = undefined,
  zoomLevel: ZoomLevel = 3,
): readonly LabelPlacement[] {
  const normalizedCandidates = candidates.map((candidate): LabelLayoutCandidate => (
    'name' in candidate
      ? candidate
      : { ...candidate, name: candidate.nameJa }
  ))
  const ordered = normalizedCandidates
    .map((candidate) => ({
      candidate,
      priority: priorityForLabelLayout(
        candidate,
        candidate.x,
        candidate.y,
        viewport,
        zoomLevel,
      ),
    }))
    .sort((first, second) => (
      second.priority - first.priority || first.candidate.id.localeCompare(second.candidate.id)
    ))
    .map(({ candidate }) => candidate)
  const placements: LabelPlacement[] = []
  const labelLimit = maxLabels ?? maxVisibleLabelsForViewport(zoomLevel, viewport.width)

  for (const candidate of ordered) {
    if (placements.length >= labelLimit) break

    const clampedCandidate = clampLabelToViewport(candidate, viewport)
    const rect = rectFor(clampedCandidate)

    if (placements.some((placement) => rectanglesOverlap(
      rect,
      placement.rect,
      LABEL_COLLISION_GAP,
    ))) continue

    placements.push({
      ...clampedCandidate,
      nameJa: clampedCandidate.name,
      rect,
    })
  }

  return placements
}

export function estimateLabelWidth(name: string): number {
  return Math.min(150, Math.max(52, name.length * 17 + 16))
}
