import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CIRCUIT, CIRCUITS, buildCircuit, circuitPreview } from './circuit'

describe('circuit', () => {
  it('builds a smooth closed circuit in the ground plane', () => {
    const circuit = buildCircuit()
    expect(circuit.width).toBe(12)
    expect(circuit.curve).toBeInstanceOf(THREE.CatmullRomCurve3)
    expect(circuit.curve.getLength()).toBeGreaterThan(500)
    expect(circuit.curve.getLength()).toBeLessThan(800)
    expect(circuit.curve.getPointAt(0).distanceTo(circuit.curve.getPointAt(1))).toBeLessThan(1e-6)
    for (const point of circuit.curve.getPoints(128)) {
      expect(point.y).toBeCloseTo(0, 8)
    }
  })

  it('exports an independent ready-to-use definition', () => {
    expect(CIRCUIT.id).toBe('classic-circuit')
    expect(CIRCUIT.curve).not.toBe(buildCircuit().curve)
  })
})


describe('selectable circuits', () => {
  it('has unique choices and previews derived from each closed road', () => {
    expect(CIRCUITS).toHaveLength(4)
    expect(new Set(CIRCUITS.map((course) => course.id)).size).toBe(CIRCUITS.length)
    expect(new Set(CIRCUITS.map((course) => circuitPreview(course).points)).size).toBe(CIRCUITS.length)
  })

  it.each(CIRCUITS)('$id keeps the road clear of itself and its lane offsets smooth', (course) => {
    const count = 360
    const points = Array.from({ length: count }, (_, i) => course.curve.getPointAt(i / count))
    const step = course.curve.getLength() / count
    expect(course.curve.getPointAt(0).distanceTo(course.curve.getPointAt(1))).toBeLessThan(1e-6)
    for (let i = 0; i < count; i++) {
      const before = course.curve.getTangentAt((i + count - 1) % count / count)
      const after = course.curve.getTangentAt((i + 1) % count / count)
      // Radius must exceed the road half-width: no folded inner road edge.
      expect(before.angleTo(after) / (2 * step)).toBeLessThan(1 / (course.width / 2 + 2))
      for (let j = i + 1; j < count; j++) {
        const alongRoad = Math.min(j - i, count - (j - i)) * step
        if (alongRoad < course.width * 3) continue
        expect(points[i]!.distanceTo(points[j]!)).toBeGreaterThan(course.width + 4)
      }
    }
  })
})
