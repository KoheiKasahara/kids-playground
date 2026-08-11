import source from '../data/prefectures.json'
import type { Prefecture } from '../data/prefectures'
import { trimDisplayIslands } from './geometry'
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

/**
 * 離島で県の画像全体が小さくならない表示用geometryを返す。
 * 佐渡島のように主島の表示範囲をほぼ広げない島は、同じgeometry内に残る。
 */
export function displayPiecesForPrefecture(prefecture: Prefecture): DisplayPieces {
  const cached = displayPiecesCache.get(prefecture.id)
  if (cached) return cached
  const pieces: DisplayPieces = { main: trimDisplayIslands(featureForPrefecture(prefecture).geometry), insets: [] }
  displayPiecesCache.set(prefecture.id, pieces)
  return pieces
}

export function polygonCount(geometry: Geometry): number {
  return geometry.type === 'Polygon' ? 1 : Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0
}
