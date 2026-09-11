import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { initializeRapier } from '../../physics/rapierLoader'
import { createPartGeometries } from './marbleGeometry'
import { appendPart, createPart, initialCourse, type Course } from './marbleModel'
import { createMarbleWorld, type RunStatus } from './marbleWorld'

const geometries = createPartGeometries()
beforeAll(async () => { await initializeRapier() })
afterAll(() => { for (const geometry of Object.values(geometries)) geometry.dispose() })

function simulate(course: Course, offset = 0) {
  const run = createMarbleWorld(course, geometries, offset)!
  let status: RunStatus = 'rolling'
  let maxSpeed = 0
  const path: { x: number; y: number; z: number }[] = []
  try {
    for (let i = 0; i < 2400 && status === 'rolling'; i++) {
      status = run.step()
      const velocity = run.ball.linvel()
      maxSpeed = Math.max(maxSpeed, Math.hypot(velocity.x, velocity.y, velocity.z))
      if (i % 12 === 0) path.push({ ...run.ball.translation() })
    }
    return { status, position: run.ball.translation(), maxSpeed, path }
  } finally { run.dispose() }
}

describe('real marble physics', () => {
  it('rolls down a slope, over a straight seam and into a goal cup', () => {
    let course = appendPart(initialCourse(), 'straight', 'straight', 'part-0')
    course = appendPart(course, 'goal', 'goal', 'straight')
    const result = simulate(course)
    expect(result.maxSpeed).toBeGreaterThan(3.5)
    expect(result.status).toBe('goal')
    expect(result.position.x).toBeGreaterThan(7)
  })
  it('follows the curved physical trough into a rotated goal', () => {
    let course = appendPart(initialCourse(), 'curve', 'curve', 'part-0')
    course = appendPart(course, 'goal', 'goal', 'curve')
    const result = simulate(course)
    expect(result.status).toBe('goal')
    expect(result.position.z).toBeGreaterThan(3)
  })
  it('uses sphere contact, rather than a switch, to take either Y outlet', () => {
    const outcomes = [-0.07, 0.07].map(offset => {
      let course = appendPart(initialCourse(), 'branch', 'branch', 'part-0')
      course = appendPart(course, 'goal', 'left', 'branch')
      course = appendPart(course, 'goal', 'right', 'branch')
      return simulate(course, offset)
    })
    expect(outcomes.map(result => ({ status: result.status, position: result.position }))).toEqual([expect.objectContaining({ status: 'goal' }), expect.objectContaining({ status: 'goal' })])
    expect(outcomes[0]!.position.z * outcomes[1]!.position.z).toBeLessThan(0)
  })
  it('can travel uphill using momentum from a preceding higher slope', () => {
    const course: Course = {
      parts: [createPart('slope', 's'), { ...createPart('slope', 'up', { x: 4, y: 2.4, z: 0 }), rotation: 2 }],
      startId: 's',
    }
    const result = simulate(course)
    expect(result.path.some(p => p.x > 4 && p.y > 3.4)).toBe(true)
  })
  it('quietly becomes ready after leaving a disconnected track, and can rerun', () => {
    for (let i = 0; i < 2; i++) expect(simulate(initialCourse()).status).toBe('ready')
  })
  it('stops a stationary ball and keeps geometry draw groups bounded', () => {
    const course: Course = { parts: [createPart('straight', 's')], startId: 's' }
    const run = createMarbleWorld(course, geometries)!
    try {
      run.ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
      let status: RunStatus = 'rolling'
      for (let i = 0; i < 600 && status === 'rolling'; i++) status = run.step()
      expect(status).toBe('ready')
      for (const geometry of Object.values(geometries)) {
        expect(geometry.groups).toHaveLength(2)
        expect(geometry.getAttribute('position').count).toBeLessThan(5000)
      }
    } finally { run.dispose() }
  })
})
