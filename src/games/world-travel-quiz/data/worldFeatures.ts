import { feature } from 'topojson-client'
import worldTopology from 'world-atlas/countries-50m.json'
import type { Geometry } from '../map/geometry'

export type WorldFeature = { id: number; geometry: Geometry }

const collection = feature(worldTopology, (worldTopology as { objects: { countries: unknown } }).objects.countries)

/** TopoJSON は一度だけ GeoJSON にし、以後の描画では同じ path/bounds キャッシュを使う。 */
export const worldFeatures: readonly WorldFeature[] = collection.features
  .filter((item): item is typeof item & { id: string | number } => item.id !== undefined && item.geometry !== null)
  .map((item) => ({ id: Number(item.id), geometry: item.geometry as Geometry }))
