import { describe, expect, test } from 'vitest'
import { Vector3 } from 'three'
import { BLOCKS, CITY_CROSSING, SKYLINE, createCityDistrict, type CityScenery } from './journeyCity'
import { createJourneyCourse, TRACK_Y } from './journeyModel'

const course = createJourneyCourse()
const rails = Object.values(course.curves).flatMap(curve => curve.getSpacedPoints(700))
type Placed = { shape: string; position: Vector3; scale: Vector3 }

function buildTown() {
  const parts: Placed[] = []
  const wires: { a: Vector3; b: Vector3 }[] = []
  const scenery: CityScenery = {
    part: (shape, _color, x, y, z, sx, sy, sz) => { parts.push({ shape, position: new Vector3(x, y, z), scale: new Vector3(sx, sy, sz) }) },
    beam: (_color, a, b) => { wires.push({ a: a.clone(), b: b.clone() }) },
    clear: (x, z, radius) => !rails.some(p => Math.hypot(p.x - x, p.z - z) < radius),
  }
  const { gates } = createCityDistrict(scenery, course.curves.city, course.lengths.city)
  return { parts, wires, gates }
}
/** Widest horizontal reach of a part, whichever way its heading turns it. */
const reach = (part: Placed) => Math.hypot(part.scale.x, part.scale.z) / 2
const nearestRail = (x: number, z: number) => Math.min(...rails.map(p => Math.hypot(p.x - x, p.z - z)))
/** Closest approach to a rail a train could actually be using at that height. */
function gaugeClearance(part: Placed) {
  const top = part.position.y + part.scale.y / 2
  const bottom = part.position.y - part.scale.y / 2
  const passing = rails.filter(rail => top > rail.y + 0.05 && bottom < rail.y + 2.6)
  return passing.length ? Math.min(...passing.map(rail => Math.hypot(rail.x - part.position.x, rail.z - part.position.z))) : Infinity
}

describe('town along the city branch', () => {
  const { parts, wires, gates } = buildTown()
  test('every block on the list finds room beside the rails', () => {
    const towers = parts.filter(part => part.shape === 'box' && part.scale.y > 2 && Math.abs(part.position.y - part.scale.y / 2) < 0.001)
    expect(towers).toHaveLength(BLOCKS.length + SKYLINE.length)
    expect(Math.max(...towers.map(tower => tower.scale.y))).toBeGreaterThan(6)
  })
  test('nothing the town adds reaches into the path of a train', () => {
    // Paving passes under the wheels, wires overhead, and a car may stand
    // beneath the viaduct, so each part is measured against the rails it shares
    // a height with.
    for (const part of parts) {
      expect(gaugeClearance(part), `${part.shape} at ${part.position.x.toFixed(1)}, ${part.position.z.toFixed(1)}`).toBeGreaterThan(1.25 + reach(part))
    }
  })
  test('the contact wire hangs over the rails, above the tallest train', () => {
    expect(wires.length).toBeGreaterThan(2)
    for (const wire of wires) {
      expect(Math.min(wire.a.y, wire.b.y)).toBeGreaterThan(TRACK_Y + 2.9)
      expect(nearestRail(wire.a.x, wire.a.z)).toBeLessThan(0.2)
    }
  })
  test('lowered barriers block the road without fouling the track', () => {
    const point = course.curves.city.getPointAt(CITY_CROSSING / course.lengths.city)
    expect(gates).toHaveLength(2)
    for (const gate of gates) {
      expect(Math.hypot(gate.position.x - point.x, gate.position.z - point.z)).toBeCloseTo(2.1, 2)
      gate.rotation.x = 0
      gate.updateMatrixWorld(true)
      const tip = gate.localToWorld(new Vector3(0, 0, 2.2))
      expect(tip.y).toBeCloseTo(gate.position.y, 5)
      expect(nearestRail(tip.x, tip.z)).toBeGreaterThan(1.25)
      gate.rotation.x = -Math.PI / 2
      gate.updateMatrixWorld(true)
      // Raised, the arm stands clear above every train and the contact wire.
      expect(gate.localToWorld(new Vector3(0, 0, 2.2)).y).toBeGreaterThan(TRACK_Y + 3.4)
    }
  })
  test('the whole town stands on the island', () => {
    for (const part of parts) {
      expect(Math.abs(part.position.x) + reach(part)).toBeLessThan(29)
      expect(part.position.z - reach(part)).toBeGreaterThan(-28)
      expect(part.position.z + reach(part)).toBeLessThan(30)
    }
  })
})
