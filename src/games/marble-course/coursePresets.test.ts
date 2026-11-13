import { afterAll, beforeAll, expect, it } from 'vitest'
import { initializeRapier } from '../../physics/rapierLoader'
import { COURSE_PRESETS, presetCourse } from './coursePresets'
import { appendPart, canPlace, hasConnectedInput, MAX_PARTS, type Course } from './marbleModel'
import { createPartGeometries } from './marbleGeometry'
import { createMarbleWorld, type RunStatus } from './marbleWorld'

const geometries = createPartGeometries()
beforeAll(initializeRapier)
afterAll(() => Object.values(geometries).forEach(geometry => geometry.dispose()))

it('offers ten distinct courses and a clean empty board', () => {
  expect(new Set(COURSE_PRESETS.map(preset => preset.parts.join(','))).size).toBe(10)
  expect(presetCourse('empty')).toEqual({ parts: [], startId: null })
})

for (const preset of COURSE_PRESETS) it(`${preset.id}: connects every piece and reaches the goal from varied releases`, () => {
  const course = presetCourse(preset.id)
  expect(course.parts.every(canPlace)).toBe(true)
  expect(course.parts.slice(1).every(part => hasConnectedInput(part, course.parts))).toBe(true)
  for (const offset of [-0.08, 0, 0.08]) {
    const run = createMarbleWorld(course, geometries, offset)!
    let status: RunStatus = 'rolling'
    let steps = 0
    try {
      while (status === 'rolling' && steps++ < 120 * 30) status = run.step()
      expect(status, `${preset.id}, offset ${offset}, ${JSON.stringify(run.ball.translation())}`).toBe('goal')
    } finally { run.dispose() }
  }
})

for (const kind of ['long', 'slope', 'funnel'] as const) it(`keeps ${MAX_PARTS} consecutive ${kind} taps connected`, () => {
  let course: Course = { parts: [], startId: null }
  for (let index = 0; index < MAX_PARTS; index++) course = appendPart(course, kind, `p${index}`, course.parts.at(-1)?.id ?? null)
  expect(course.parts).toHaveLength(MAX_PARTS)
  expect(course.parts.every(canPlace)).toBe(true)
  expect(course.parts.slice(1).every(part => hasConnectedInput(part, course.parts))).toBe(true)
})
