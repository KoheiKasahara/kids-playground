import { describe, expect, test } from 'vitest'
import { bake } from './model'
import { creatureModel, FRAMES } from './sprites'
import { addCreature, checkCreature, createWorld, dropFood, stepWorld } from './sim'
import { speciesDef } from './data'

describe('新しいいきもの', () => {
  test.each(['dolphin', 'penguin', 'starfish'] as const)('%s の絵・上限・えさやり', id => {
    const frames = Array.from({ length: FRAMES }, (_, f) => {
      const model = creatureModel(id, f)
      const pixels = bake(model.prims, model.w, model.h)
      expect(pixels.filter(p => p !== 0).length).toBeGreaterThan(40)
      return Array.from(pixels).join(',')
    })
    expect(new Set(frames).size).toBeGreaterThan(1)
    const world = createWorld(12)
    const c = addCreature(world, id, 200, 90)
    c.hunger = .95
    dropFood(world, speciesDef(id).eats[0], c.x)
    for (let i = 0; i < 2400 && c.hunger >= .95; i++) stepWorld(world, .05)
    expect(c.hunger).toBeLessThan(.95)
    expect(Number.isFinite(c.x) && Number.isFinite(c.y)).toBe(true)
    for (let i = 1; i < speciesDef(id).limit; i++) addCreature(world, id, 80, 90)
    expect(checkCreature(world, id, 100, 90).ok).toBe(false)
  })
})
