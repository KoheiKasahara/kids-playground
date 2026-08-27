declare module 'topojson-client' {
  export function feature(topology: unknown, object: unknown): {
    type: 'FeatureCollection'
    features: Array<{
      id?: string | number
      properties?: Record<string, unknown>
      geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } | null
    }>
  }
}

declare module 'world-atlas/countries-50m.json' {
  const topology: unknown
  export default topology
}

declare module 'world-atlas/land-110m.json' {
  const topology: unknown
  export default topology
}
