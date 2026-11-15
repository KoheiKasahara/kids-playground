import { expect, test } from 'vitest'
import { ALL_POSES, animalModel } from './models'

test.each(['fox', 'sheep', 'tortoise'] as const)('%s の すべての しぐさを かける', id => {
  for (const pose of ALL_POSES) for (const time of [0, .25, .5, .75]) {
    const model = animalModel(id, pose, time)
    expect(model.prims.length).toBeGreaterThan(0)
    for (const p of model.prims) {
      expect(model.mats[p.mat]).toBeDefined()
      expect(p.c.every(Number.isFinite)).toBe(true)
      expect(p.r.every(v => Number.isFinite(v) && v > 0)).toBe(true)
    }
  }
})
