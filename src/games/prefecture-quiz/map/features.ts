import source from '../data/prefectures.json'
import type { Prefecture } from '../data/prefectures'
import { cropGeometry } from './geometry'
import type { Geometry, MapFeature } from './geometry'

const features = (source as { features: MapFeature[] }).features
const featureByName = new Map(features.map((feature) => [feature.properties.N03_001, feature]))
const displayPiecesCache = new Map<string, DisplayPieces>()

export function featureForPrefecture(prefecture: Prefecture): MapFeature {
  const feature = featureByName.get(prefecture.mapFeatureName)
  if (!feature) throw new Error(`地図データに ${prefecture.mapFeatureName} がありません`)
  return feature
}

type Inset = { geometry: Geometry; x: number; y: number; width: number; height: number }
type DisplayPieces = { main: Geometry; insets: readonly Inset[] }

/** Polygonを落とさず、主図と補助insetの合計で元featureの全polygonを描画する。 */
export function displayPiecesForPrefecture(prefecture: Prefecture): DisplayPieces {
  const cached = displayPiecesCache.get(prefecture.id)
  if (cached) return cached
  const geometry = featureForPrefecture(prefecture).geometry
  let pieces: DisplayPieces
  if (prefecture.id === '13') {
    pieces = { main: cropGeometry(geometry, (bounds) => bounds.minY >= 30), insets: [{ geometry: cropGeometry(geometry, (bounds) => bounds.minY < 30), x: 285, y: 8, width: 66, height: 48 }] }
  } else if (prefecture.id === '46') {
    pieces = { main: cropGeometry(geometry, (bounds) => bounds.minY >= 29), insets: [{ geometry: cropGeometry(geometry, (bounds) => bounds.minY < 29), x: 220, y: 224, width: 64, height: 45 }] }
  } else if (prefecture.id === '47') {
    pieces = { main: cropGeometry(geometry, (bounds) => bounds.minX >= 126.5 && bounds.minY >= 24.3), insets: [{ geometry: cropGeometry(geometry, (bounds) => !(bounds.minX >= 126.5 && bounds.minY >= 24.3)), x: 8, y: 224, width: 78, height: 45 }] }
  } else {
    pieces = { main: geometry, insets: [] }
  }
  displayPiecesCache.set(prefecture.id, pieces)
  return pieces
}

export function polygonCount(geometry: Geometry): number {
  return geometry.type === 'Polygon' ? 1 : Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0
}
