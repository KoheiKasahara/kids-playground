import { describe, expect, it } from 'vitest'
import { createWorld, decodeWorld, editWorld, HEIGHT, inside, key, SIZE, topBlock } from './world'

describe('block world', () => {
  it('starts with unique bounded terrain, water and trees, with an unbreakable floor', () => {
    const world = createWorld()
    expect(new Set(world.map(key)).size).toBe(world.length)
    expect(world.every(inside)).toBe(true)
    expect(world.some(b => b.material === 'water')).toBe(true)
    expect(world.some(b => b.material === 'leaf')).toBe(true)
    expect(world.filter(b => b.y === 0)).toHaveLength(SIZE * SIZE)
    expect(editWorld(world, { x: 0, y: 0, z: 0 }, 'wood', 'remove')).toBe(world)
  })
  it('builds a wall and roof, mines its side, and preserves other blocks', () => {
    const initial = createWorld()
    let world = initial
    for (let y = 3; y <= 5; y++) world = editWorld(world, { x: 5, y, z: 5 }, 'brick', 'place')
    world = editWorld(world, { x: 6, y: 5, z: 5 }, 'wood', 'place')
    expect(topBlock(world, 5, 5).y).toBe(5)
    const mined = editWorld(world, { x: 5, y: 4, z: 5 }, 'wood', 'remove')
    expect(mined).toHaveLength(initial.length + 3)
    expect(mined.some(b => b.x === 6 && b.y === 5 && b.z === 5)).toBe(true)
    expect(initial).toEqual(createWorld())
  })
  it('rejects occupied, floating, out-of-bounds and fractional placements', () => {
    const world = createWorld()
    for (const position of [{ x: 5, y: 2, z: 5 }, { x: 5, y: 8, z: 5 }, { x: -1, y: 3, z: 5 }, { x: SIZE, y: 3, z: 5 }, { x: 5, y: HEIGHT, z: 5 }, { x: 0.5, y: 3, z: 5 }]) {
      expect(editWorld(world, position, 'wood', 'place')).toBe(world)
    }
  })
  it('round trips saves and rejects corrupt, oversized, duplicate, and floorless data', () => {
    const world = createWorld()
    expect(decodeWorld(JSON.stringify(world))).toEqual(world)
    for (const raw of [null, '{}', 'oops', '[]', ' '.repeat(150001), JSON.stringify([...world, world[0]]), JSON.stringify(world.slice(1)), JSON.stringify(world.map((b, i) => i ? b : { ...b, material: 'bad' }))]) {
      expect(decodeWorld(raw)).toBeNull()
    }
  })
})
