import { describe, expect, test } from 'vitest'
import { COURSE_IDS, findCourse, GOLF_COURSES, type Vec2 } from './golfCourses'
import { buildHoleGeometry } from './golfGeometry'
import { BALL_RADIUS } from './golfPhysics'

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

  test('きは みちすじの 線から はなれていて、ボールが とおれる', () => {
    const distanceToSegment = (point: Vec2, a: Vec2, b: Vec2) => {
      const dx = b.x - a.x
      const dz = b.z - a.z
      const t = Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz || 1)))
      return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t))
    }
    for (const hole of HOLES) {
      for (const gadget of hole.gadgets ?? []) {
        if (gadget.kind !== 'tree') continue
        hole.route.slice(0, -1).forEach((point, index) => {
          const distance = distanceToSegment(gadget, point, hole.route[index + 1]!)
          // みちすじは きの みきを よけて通る（ボールの太さぶんの すきま つき）。
          expect(distance, `${hole.id} の ${gadget.id} と ${index}ばんめの線`).toBeGreaterThan(gadget.radius + BALL_RADIUS + 0.3)
        })
      }
    }
  })

  test('みちすじは いけや かわを よこぎらない（はしの上は よい）', () => {
    for (const hole of HOLES) {
      if (!hole.water?.length) continue
      const geometry = buildHoleGeometry(hole)
      hole.route.slice(0, -1).forEach((point, index) => {
        const next = hole.route[index + 1]!
        const length = Math.hypot(next.x - point.x, next.z - point.z)
        for (let travel = 0; travel <= length; travel += 0.1) {
          const t = travel / length
          expect(geometry.waterAt(point.x + (next.x - point.x) * t, point.z + (next.z - point.z) * t, BALL_RADIUS), `${hole.id} の ${index}ばんめの線`).toBe(false)
        }
      })
    }
  })

  test('はねかえし いたの てまえの点は いたの まえにあり、はねた先の点も いたの おなじ がわにある', () => {
    for (const hole of HOLES) {
      const reflectors = (hole.gadgets ?? []).flatMap(gadget => (gadget.kind === 'reflector' ? [gadget] : []))
      hole.route.forEach((point, index) => {
        if (!point.bank) return
        const next = hole.route[index + 1]!
        const nearest = [...reflectors].sort((a, b) => Math.hypot(a.x - point.x, a.z - point.z) - Math.hypot(b.x - point.x, b.z - point.z))[0]
        expect(nearest, `${hole.id} の ${index}ばんめ`).toBeDefined()
        const side = (p: Vec2) => (p.x - nearest!.x) * nearest!.dir.z - (p.z - nearest!.z) * nearest!.dir.x
        expect(Math.sign(side(point)), `${hole.id} の ${index}ばんめ`).toBe(Math.sign(side(next)))
        expect(Math.hypot(nearest!.x - point.x, nearest!.z - point.z), `${hole.id} の ${index}ばんめ`).toBeLessThan(nearest!.halfLength + 2)
      })
    }
  })

  test('findCourse は id でコースを返し、知らない id では undefined', () => {
    expect(findCourse('candy')?.label).toBe('おかしのくに')
    expect(findCourse('mars')).toBeUndefined()
  })
})
