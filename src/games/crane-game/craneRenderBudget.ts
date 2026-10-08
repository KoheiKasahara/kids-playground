import type { LightShadow } from 'three'

/** Small scenes do not need a desktop-sized shadow texture every animation frame. */
export function getCraneShadowMapSize(width: number, height: number): 1024 | 2048 {
  return Math.min(Math.max(1, width), Math.max(1, height)) <= 640 ? 1024 : 2048
}

export function resizeCraneShadowMap(shadow: Pick<LightShadow, 'mapSize' | 'map'>, width: number, height: number) {
  const size = getCraneShadowMapSize(width, height)
  if (shadow.mapSize.x === size && shadow.mapSize.y === size) return
  shadow.mapSize.set(size, size)
  // Three does not resize an existing PCF shadow target when only mapSize changes.
  shadow.map?.setSize(size, size)
}
