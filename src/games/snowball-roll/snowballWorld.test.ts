import { describe, expect, test } from 'vitest'
import { createSnowWorld, FIELD_LIMIT, GOAL_RADIUS, ITEM_TYPES, nextItemKind, progress, stepSnowWorld } from './snowballWorld'

describe('snowball collection and growth', () => {
  test('five size bands have unique reachable items and enough growth to unlock the next band', () => {
    const world = createSnowWorld()
    expect(new Set(world.items.map(item => item.id)).size).toBe(world.items.length)
    let radius = world.radius
    for (const [kind, type] of Object.entries(ITEM_TYPES)) {
      expect(radius).toBeGreaterThanOrEqual(type.required)
      const items = world.items.filter(item => item.kind === kind)
      expect(items).toHaveLength(type.count)
      items.forEach(item => expect(Math.max(Math.abs(item.x), Math.abs(item.z)) + type.size).toBeLessThan(FIELD_LIMIT))
      radius += type.growth * items.length
    }
    expect(radius).toBeGreaterThan(GOAL_RADIUS)
  })

  test('an oversized car pushes back without losing progress and becomes collectible after growing', () => {
    const world = createSnowWorld()
    const car = world.items.find(item => item.kind === 'car')!
    world.x = car.x - world.radius - ITEM_TYPES.car.size * 0.65 - 0.01
    world.z = car.z
    expect(stepSnowWorld(world, { x: 1, z: 0 }, 0.05).blocked).toBe('car')
    expect(car.collected).toBe(false)
    expect(world.collected).toBe(0)
    expect(world.won).toBe(false)
    world.radius = ITEM_TYPES.car.required
    expect(stepSnowWorld(world, { x: 1, z: 0 }, 0.05).picked).toContain(car)
    const count = world.collected
    stepSnowWorld(world, { x: 1, z: 0 }, 0.05)
    expect(world.collected).toBe(count)
  })

  test('a real walking route can collect progressively larger objects and finish, without teleporting', () => {
    const world = createSnowWorld()
    const kinds = new Set<string>()
    let wins = 0
    // Follow the same nearest-collectible hint shown in the game.
    for (let frame = 0; frame < 20000 && !world.won; frame++) {
      const target = world.items.filter(item => !item.collected && ITEM_TYPES[item.kind].required <= world.radius)
        .sort((a, b) => Math.hypot(a.x - world.x, a.z - world.z) - Math.hypot(b.x - world.x, b.z - world.z))[0]!
      expect(target).toBeDefined()
      const result = stepSnowWorld(world, { x: target.x - world.x, z: target.z - world.z }, 1 / 60)
      result.picked.forEach(item => kinds.add(item.kind))
      if (result.justWon) wins++
    }
    expect(world.won).toBe(true)
    expect(wins).toBe(1)
    expect(kinds).toEqual(new Set(Object.keys(ITEM_TYPES)))
    expect(progress(world)).toBe(1)
    const finished = structuredClone(world)
    expect(stepSnowWorld(world, { x: 1, z: 1 }, 1).justWon).toBe(false)
    expect(world).toEqual(finished)
    expect(createSnowWorld().collected).toBe(0)
  })

  test('release stops movement, diagonal speed is bounded, long frames cannot jump through the field', () => {
    const world = createSnowWorld()
    const copy = structuredClone(world)
    stepSnowWorld(world, { x: 0, z: 0 }, 100)
    expect(world).toEqual(copy)
    stepSnowWorld(world, { x: 1, z: 0 }, 1 / 60)
    stepSnowWorld(copy, { x: 1, z: 1 }, 1 / 60)
    expect(Math.hypot(copy.x, copy.z)).toBeCloseTo(world.x)
    const oldX = world.x
    stepSnowWorld(world, { x: 1, z: 0 }, 100)
    expect(world.x - oldX).toBeLessThan(0.3)
    world.x = FIELD_LIMIT
    world.z = FIELD_LIMIT
    stepSnowWorld(world, { x: 1, z: 1 }, 0.05)
    expect(world.x + world.radius).toBeLessThanOrEqual(FIELD_LIMIT)
    expect(world.z + world.radius).toBeLessThanOrEqual(FIELD_LIMIT)
    expect(nextItemKind(0.65)).toBe('gift')
    expect(nextItemKind(3.1)).toBeNull()
  })
})
