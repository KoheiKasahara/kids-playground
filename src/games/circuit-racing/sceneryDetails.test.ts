import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CIRCUITS } from './circuit'
import { createCircuitScenery } from './scenery'

describe('colorful circuit landscape', () => {
  it.each(CIRCUITS)('$id includes new landscape and paddock features without overlapping footprints', (circuit) => {
    const scenery = createCircuitScenery(circuit)
    try {
      const kinds = new Set(scenery.footprints.map((footprint) => footprint.kind))
      const expected = circuit.scenery === 'city' ? ['building', 'streetlight']
        : circuit.scenery === 'coast' ? ['lighthouse', 'palm', 'beach']
          : ['pond', 'meadow', 'pavilion', 'banners', 'tireWall']
      for (const kind of expected) {
        expect(kinds.has(kind), `${circuit.id}: ${kind}`).toBe(true)
      }
      expect(kinds.has('cottage')).toBe(!['stadium', 'city', 'coast'].includes(circuit.scenery))
      for (let i = 0; i < scenery.footprints.length; i++) {
        const a = scenery.footprints[i]!
        for (let j = i + 1; j < scenery.footprints.length; j++) {
          const b = scenery.footprints[j]!
          expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(a.radius + b.radius + 2 - 1e-6)
        }
      }
    } finally {
      scenery.dispose()
    }
  })

  it.each(CIRCUITS)('$id rebuilds finite, identical geometry without changing the driving curve', (circuit) => {
    const before = circuit.curve.getSpacedPoints(32)
    const first = createCircuitScenery(circuit)
    const second = createCircuitScenery(circuit)
    try {
      expect(second.footprints).toEqual(first.footprints)
      expect(second.group.children.map((child) => child.name)).toEqual(first.group.children.map((child) => child.name))
      first.group.children.forEach((child, i) => {
        const a = child as THREE.InstancedMesh
        const b = second.group.children[i] as THREE.InstancedMesh
        expect(a.instanceMatrix.array.every(Number.isFinite)).toBe(true)
        expect(a.instanceColor?.array.every(Number.isFinite)).toBe(true)
        expect(a.boundingSphere).not.toBeNull()
        expect(Number.isFinite(a.boundingSphere!.radius)).toBe(true)
        expect(b.instanceMatrix.array).toEqual(a.instanceMatrix.array)
        expect(b.instanceColor?.array).toEqual(a.instanceColor?.array)
      })
      expect(circuit.curve.getSpacedPoints(32)).toEqual(before)
    } finally {
      first.dispose()
      second.dispose()
    }
  })
})
