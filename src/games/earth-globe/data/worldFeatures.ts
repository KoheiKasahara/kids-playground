import { feature } from 'topojson-client'
import worldTopology from 'world-atlas/countries-50m.json'
import type { Geometry, GlobeFeature } from '../types'

const collection = feature(
  worldTopology,
  (worldTopology as { objects: { countries: unknown } }).objects.countries,
)

const isGeometry = (value: unknown): value is Geometry => {
  if (value === null || typeof value !== 'object') return false

  const type = (value as { type?: unknown }).type
  return type === 'Polygon' || type === 'MultiPolygon'
}

/** TopoJSONを一度GeoJSONへ変換し、3D描画側が扱う国フィーチャーに揃える。 */
export const worldFeatures: readonly GlobeFeature[] = collection.features
  .filter(
    (item): item is typeof item & { id: string | number; geometry: Geometry } =>
      (typeof item.id === 'string' || typeof item.id === 'number') &&
      Number.isInteger(Number(item.id)) &&
      isGeometry(item.geometry),
  )
  .map((item) => ({ id: Number(item.id), geometry: item.geometry }))
