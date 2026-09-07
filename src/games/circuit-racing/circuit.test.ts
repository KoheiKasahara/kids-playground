import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CIRCUIT, buildCircuit } from './circuit'

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
