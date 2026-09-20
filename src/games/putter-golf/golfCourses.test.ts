import { describe, expect, test } from 'vitest'
import { COURSE_IDS, findCourse, GOLF_COURSES } from './golfCourses'

const HOLES = GOLF_COURSES.flatMap(course => course.holes)

describe('パターゴルフのコース定義', () => {
  test('コースの並びは COURSE_IDS のとおりで、どのコースも4ホール', () => {
    expect(GOLF_COURSES.map(course => course.id)).toEqual([...COURSE_IDS])
    for (const course of GOLF_COURSES) expect(course.holes.length, course.id).toBe(4)
  })

  test('コースの名前・アイコン・色は ほかのコースと重ならない', () => {
    for (const key of ['label', 'icon', 'color'] as const) {
      const values = GOLF_COURSES.map(course => course[key])
      expect(new Set(values).size, key).toBe(values.length)
    }
  })

  test('ホールとしかけの id は重ならない', () => {
    const holeIds = HOLES.map(hole => hole.id)
    expect(new Set(holeIds).size).toBe(holeIds.length)
    for (const hole of HOLES) {
      const gadgetIds = (hole.gadgets ?? []).map(gadget => gadget.id)
      expect(new Set(gadgetIds).size, hole.id).toBe(gadgetIds.length)
    }
  })

  test('みちすじは ティーから はじまり カップで おわる。名前とひとことも入っている', () => {
    for (const hole of HOLES) {
      expect(hole.route.length, hole.id).toBeGreaterThanOrEqual(2)
      expect(hole.route[0], hole.id).toMatchObject(hole.tee)
      expect(hole.route.at(-1), hole.id).toMatchObject(hole.cup)
      expect(hole.par, hole.id).toBeGreaterThanOrEqual(2)
      expect(hole.name.length, hole.id).toBeGreaterThan(0)
      expect(hole.tip.length, hole.id).toBeGreaterThan(0)
    }
  })

  test('findCourse は id でコースを返し、知らない id では undefined', () => {
    expect(findCourse('candy')?.label).toBe('おかしのくに')
    expect(findCourse('mars')).toBeUndefined()
  })
})
