import { describe, expect, it } from 'vitest'
import { appendPart, connectors, createPart, initialCourse, launchPose, MAX_PARTS, openConnectors, snapPart, toLocal, toWorld, type Course } from './marbleModel'

describe('marble course placement', () => {
  it('snaps all four orientations and inherits height at the mouth', () => {
    for (let rotation = 0; rotation < 4; rotation++) {
      const slope = { ...createPart('slope', 's'), rotation }
      const end = connectors(slope)[1]!
      const loose = { ...createPart('straight', 'a', { x: end.position.x, y: 7, z: end.position.z }), rotation }
      const input = connectors(loose)[0]!
      loose.position.x += end.position.x - input.position.x + 0.3
      loose.position.z += end.position.z - input.position.z + 0.2
      const result = snapPart(loose, [slope])
      expect(result.snapped).toBe(true)
      expect(connectors(result.part)[0]!.position.x).toBeCloseTo(end.position.x)
      expect(connectors(result.part)[0]!.position.y).toBeCloseTo(end.position.y)
      expect(connectors(result.part)[0]!.position.z).toBeCloseTo(end.position.z)
    }
  })
  it('builds rising and falling courses with slopes, without a height control', () => {
    const initial = initialCourse()
    const downhill = appendPart(initial, 'slope', 'down', 'part-0')
    expect(downhill.parts[1]!.position.y).toBeCloseTo(0.8)
    const uphill = { ...createPart('slope', 'up', { x: 4.1, y: 2.4, z: 0 }), rotation: 2 }
    const result = snapPart(uphill, initial.parts)
    expect(result.snapped).toBe(true)
    const upperEnd = connectors(result.part)[0]!.position
    expect(upperEnd.y).toBeCloseTo(4)
  })
  it('keeps occupied mouths unavailable and rejects incompatible headings', () => {
    const first = initialCourse()
    const course = appendPart(first, 'straight', 'a', 'part-0')
    expect(openConnectors(course.parts)).toHaveLength(2)
    expect(snapPart(createPart('straight', 'b', course.parts[1]!.position), course.parts).snapped).toBe(false)
    expect(snapPart({ ...createPart('straight', 'b', { x: 4, y: 2.4, z: 0 }), rotation: 1 }, first.parts).snapped).toBe(false)
  })
  it('releases old connections on a move and leaves the previous course immutable', () => {
    const initial = initialCourse()
    const next = appendPart(initial, 'curve', 'c', 'part-0')
    const moved = next.parts.map(part => part.id === 'c' ? { ...part, position: { x: 12, y: 2.4, z: 12 } } : part)
    expect(openConnectors(moved)).toHaveLength(4)
    expect(initial.parts).toHaveLength(1)
    expect(next.parts[1]!.position.x).toBe(4)
  })
  it('connects after curves and to either physical branch outlet', () => {
    let course = appendPart(initialCourse(), 'curve', 'c', 'part-0')
    course = appendPart(course, 'branch', 'b', 'c')
    const branch = course.parts[2]!
    expect(branch.rotation).toBe(1)
    course = appendPart(course, 'goal', 'g', 'b')
    expect(openConnectors(course.parts)).toHaveLength(2)
  })
  it('bounds scene growth and requires a non-goal start', () => {
    let course: Course = { parts: [], startId: null }
    course = appendPart(course, 'goal', 'goal', null)
    expect(launchPose(course)).toBeNull()
    course = appendPart(course, 'straight', 'start', null)
    expect(course.startId).toBe('start')
    expect(launchPose(course)).not.toBeNull()
    course = { ...course, parts: Array.from({ length: MAX_PARTS }, (_, i) => createPart('straight', `${i}`)) }
    expect(appendPart(course, 'branch', 'overflow', null)).toBe(course)
  })
  it('round trips local coordinates and launch direction through rotation', () => {
    const part = { ...createPart('slope', 's', { x: 3, y: 5, z: -8 }), rotation: 1 }
    const point = { x: 1.2, y: -0.4, z: 2 }
    const local = toLocal(part, toWorld(part, point))
    expect(local.x).toBeCloseTo(point.x)
    expect(local.y).toBeCloseTo(point.y)
    expect(local.z).toBeCloseTo(point.z)
    expect(launchPose({ parts: [part], startId: 's' })!.velocity.z).toBeCloseTo(2.5)
  })
})
