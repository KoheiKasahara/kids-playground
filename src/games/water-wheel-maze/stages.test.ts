import { describe, expect, test } from 'vitest'
import { STAGES } from './stages'
import { RING_SLOTS } from './scene'
import { buildRingMask, totalGapWidth } from './rings'
import { WaterMaze } from './waterMaze'

/** した＝90度。ここが ふさがっていれば、まわさずに 水が おちることはない。 */
const BOTTOM = 90

describe('ステージ', () => {
  test('id が 重複していない', () => {
    const ids = STAGES.map((stage) => stage.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('わっかは 用意した ばしょ だけを つかう', () => {
    for (const stage of STAGES) {
      expect(stage.rings.length).toBeGreaterThan(0)
      const slots = stage.rings.map((ring) => ring.slot)
      expect(new Set(slots).size).toBe(slots.length)
      for (const slot of slots) {
        expect(slot).toBeGreaterThanOrEqual(0)
        expect(slot).toBeLessThan(RING_SLOTS.length)
      }
    }
  })

  test('どのステージにも みずたまりの かべと、通りぬける すきまが ある', () => {
    for (const stage of STAGES) {
      const pool = stage.rings.find((ring) => ring.slot === 0)
      expect(pool, `${stage.id} に みずたまりの かべが ない`).toBeDefined()
      for (const ring of stage.rings) {
        expect(totalGapWidth(ring), `${stage.id} slot${ring.slot} に すきまが ない`).toBeGreaterThan(0)
        expect(totalGapWidth(ring)).toBeLessThan(180)
      }
    }
  })

  test('はじめは すきまが 下を むいていない（まわさないと おちない）', () => {
    for (const stage of STAGES) {
      const pool = stage.rings.find((ring) => ring.slot === 0)!
      expect(buildRingMask(pool.gaps)[BOTTOM], `${stage.id} は まわさずに 水が おちる`).toBe(1)
    }
  })

  test('あとの ステージほど すきまが せまい', () => {
    const widths = STAGES.map((stage) => Math.max(...stage.rings.map((ring) => Math.max(...ring.gaps.map((gap) => gap.width)))))
    for (let index = 1; index < widths.length; index++) expect(widths[index]).toBeLessThanOrEqual(widths[index - 1])
  })

  test('目あては 用意した 水の 中で とどく かず', () => {
    const total = new WaterMaze(STAGES[0].rings, () => 0.5).total
    for (const stage of STAGES) {
      expect(stage.need).toBeGreaterThan(0)
      expect(stage.need, `${stage.id} の need が 水の かずを こえている`).toBeLessThan(total)
    }
  })

  test('どのステージも まわし続ければ クリアできる', () => {
    for (const stage of STAGES) {
      let seed = 4242
      const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
      const maze = new WaterMaze(stage.rings, random)
      for (let frame = 0; frame < 2400 && maze.caught < stage.need; frame++) {
        maze.rotate(2)
        maze.step()
      }
      expect(maze.caught, `${stage.id} が クリアできない`).toBeGreaterThanOrEqual(stage.need)
    }
  }, 15_000)
})
