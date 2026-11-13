import { describe, expect, test } from 'vitest'
import { createRailCourse, railCourseZoom, RAIL_COURSES } from './railCourses'
import { areRailConnectionsSymmetric, railPathLength, worldConnectorForRailPiece, RAIL_APPEND_LIMIT } from './railModel'
import { advanceRailTrainCursor } from './railTrainModel'

describe('ready-to-run courses', () => {
  test('offers ten courses plus an empty field', () => {
    expect(RAIL_COURSES).toHaveLength(10)
    expect(new Set(RAIL_COURSES.map((c) => c.id)).size).toBe(10)
    expect(createRailCourse('empty', 'empty')).toEqual([])
  })
  test.each(RAIL_COURSES)('$id is connected, level at joints, and completes a lap', ({ id }) => {
    const pieces = createRailCourse(id, id)
    expect(areRailConnectionsSymmetric(pieces)).toBe(true)
    for (const piece of pieces) {
      for (const connector of ['a', 'b'] as const) {
        const joint = worldConnectorForRailPiece(piece, connector)
        expect(Math.abs(joint.position.x)).toBeLessThan(RAIL_APPEND_LIMIT)
        expect(Math.abs(joint.position.z)).toBeLessThan(RAIL_APPEND_LIMIT)
        const connection = piece.connections[connector]!
        const other = worldConnectorForRailPiece(pieces.find((p) => p.id === connection.pieceId)!, connection.connectorId)
        expect(Math.hypot(joint.position.x - other.position.x, joint.position.y - other.position.y, joint.position.z - other.position.z)).toBeLessThan(1e-6)
        expect(joint.outward.x * other.outward.x + joint.outward.z * other.outward.z).toBeCloseTo(-1)
      }
    }
    let cursor = { pieceId: pieces[0]!.id, direction: 'a-to-b' as const, distance: 0.1 }
    for (const piece of pieces) cursor = advanceRailTrainCursor(pieces, cursor, railPathLength(piece.path)) as typeof cursor
    expect(cursor.pieceId).toBe(pieces[0]!.id)
    expect(cursor.distance).toBeCloseTo(0.1)
  })
  test('each load has independent geometry and IDs', () => {
    const first = createRailCourse('bridge', 'one')
    const second = createRailCourse('bridge', 'two')
    first[0]!.position.x = 999
    expect(second[0]!.position.x).not.toBe(999)
    expect(first.some((a) => second.some((b) => a.id === b.id))).toBe(false)
  })
})

test('large courses start farther out and an empty field starts at normal zoom', () => {
  const small = railCourseZoom(createRailCourse('circle', 'small'), 15)
  const large = railCourseZoom(createRailCourse('tour', 'large'), 15)
  expect(large).toBeLessThan(small)
  expect(large).toBeGreaterThan(0.1)
  expect(railCourseZoom([], 15)).toBe(1)
})
