import { describe, expect, it } from 'vitest'
import { threeGlobeUnusedDeps } from './threeGlobeUnusedDeps'

type Hook = (this: unknown, ...args: unknown[]) => unknown

const THREE_GLOBE = '/repo/node_modules/three-globe/dist/three-globe.mjs'

function hooks() {
  const plugin = threeGlobeUnusedDeps()
  return { resolveId: plugin.resolveId as Hook, load: plugin.load as Hook }
}

describe('threeGlobeUnusedDeps', () => {
  it('stubs WebGPU and h3-js only when three-globe imports them', () => {
    const { resolveId } = hooks()

    for (const source of ['three/webgpu', 'three/tsl', 'h3-js']) {
      expect(resolveId.call(null, source, THREE_GLOBE)).toBe(`\0three-globe-unused:${source}`)
      expect(resolveId.call(null, source, '/repo/src/games/other.ts')).toBeNull()
    }
    expect(resolveId.call(null, 'three', THREE_GLOBE)).toBeNull()
  })

  it('provides every name three-globe imports from the stubbed modules', () => {
    const { load } = hooks()

    expect(load.call(null, '\0three-globe-unused:three/webgpu')).toMatch(/StorageInstancedBufferAttribute[\s\S]*WebGPURenderer/)
    expect(load.call(null, '\0three-globe-unused:h3-js')).toMatch(/latLngToCell[\s\S]*cellToLatLng[\s\S]*cellToBoundary[\s\S]*polygonToCells/)
    expect(load.call(null, '\0three-globe-unused:three/tsl')).toMatch(/export \{ float_ as float \}/)
    expect(load.call(null, '/repo/src/main.ts')).toBeNull()
  })
})
