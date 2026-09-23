import { describe, expect, test } from 'vitest'
import { Vector3 } from 'three'
import { AVENUE, createDowntownDistrict, SKYSCRAPERS, SUBWAY_TUNNEL, TOWER_SPOT, WHEEL_SPOT, type DowntownScenery } from './journeyDowntown'
import { createJourneyCourse } from './journeyModel'

const course = createJourneyCourse('downtown')
const rails = Object.values(course.curves).flatMap(curve => curve.getSpacedPoints(700))
type Placed = { shape: string; position: Vector3; scale: Vector3; heading: number }

function buildDistrict() {
  const parts: Placed[] = []
  const beams: { a: Vector3; b: Vector3 }[] = []
  const scenery: DowntownScenery = {
    part: (...[shape, , x, y, z, sx, sy, sz, , ry = 0]) => { parts.push({ shape, position: new Vector3(x, y, z), scale: new Vector3(sx, sy, sz), heading: ry }) },
    beam: (_color, a, b) => { beams.push({ a: a.clone(), b: b.clone() }) },
    clear: (x, z, radius) => !rails.some(p => Math.hypot(p.x - x, p.z - z) < radius),
  }
  createDowntownDistrict(scenery)
  return { parts, beams }
}
/** Half extents on the ground: exact for square-on parts, a bounding circle otherwise. */
function extents(part: Placed) {
  const quarter = Math.abs(Math.sin(part.heading * 2)) < 1e-6
  if (!quarter) { const r = Math.hypot(part.scale.x, part.scale.z) / 2; return { x: r, z: r } }
  const turned = Math.abs(Math.sin(part.heading)) > 0.5
  return { x: (turned ? part.scale.z : part.scale.x) / 2, z: (turned ? part.scale.x : part.scale.z) / 2 }
}
/** Gap from a ground point to the edge of a part's footprint. */
function gap(part: Placed, x: number, z: number) {
  const half = extents(part)
  return Math.hypot(Math.max(0, Math.abs(x - part.position.x) - half.x), Math.max(0, Math.abs(z - part.position.z) - half.z))
}
const nearestRail = (x: number, z: number) => Math.min(...rails.map(p => Math.hypot(p.x - x, p.z - z)))
/** Closest approach to a rail a train could actually be using at that height. */
function gaugeClearance(part: Placed) {
  const top = part.position.y + part.scale.y / 2
  const bottom = part.position.y - part.scale.y / 2
  const passing = rails.filter(rail => top > rail.y + 0.05 && bottom < rail.y + 2.6)
  return passing.length ? Math.min(...passing.map(rail => gap(part, rail.x, rail.z))) : Infinity
}

describe('downtown scenery', () => {
  const { parts, beams } = buildDistrict()
  test('nothing downtown reaches into the path of a train', () => {
    for (const part of parts) {
      // Half a carriage, with a little room to spare.
      expect(gaugeClearance(part), `${part.shape} at ${part.position.x.toFixed(1)}, ${part.position.z.toFixed(1)}`).toBeGreaterThan(1.1)
    }
  })
  test('every skyscraper finds room in the core, and they read as a skyline', () => {
    for (const [x, z, , , height] of SKYSCRAPERS) {
      expect(parts.some(part => part.position.x === x && part.position.z === z && part.scale.y === height), `tower at ${x}, ${z}`).toBe(true)
    }
    expect(Math.max(...SKYSCRAPERS.map(tower => tower[4]))).toBeGreaterThanOrEqual(15)
  })
  test('the lattice tower and the big wheel stand well clear of the rails', () => {
    expect(nearestRail(TOWER_SPOT.x, TOWER_SPOT.z)).toBeGreaterThan(5)
    for (const beam of beams) expect(nearestRail(beam.a.x, beam.a.z)).toBeGreaterThan(2)
    expect(nearestRail(WHEEL_SPOT.x, WHEEL_SPOT.z)).toBeGreaterThan(6)
  })
  test('the avenue traffic never drives onto the railway', () => {
    for (let x = AVENUE.from - 1; x <= AVENUE.to + 1; x += 0.5) expect(nearestRail(x, AVENUE.z)).toBeGreaterThan(2.5)
  })
  test('the subway tunnel lies inside its branch, clear of both junctions', () => {
    expect(SUBWAY_TUNNEL.start).toBeGreaterThan(9)
    expect(SUBWAY_TUNNEL.end).toBeLessThan(course.lengths.subway - 9)
  })
  test('the city stands on its board, apart from the pier and the ships in the bay', () => {
    for (const part of parts) {
      if (part.position.y < 0 || part.position.x > 28) continue
      const half = extents(part)
      expect(Math.abs(part.position.x) + half.x).toBeLessThan(29.5)
      expect(part.position.z - half.z).toBeGreaterThan(-28.5)
      expect(part.position.z + half.z).toBeLessThan(30.5)
    }
  })
})
