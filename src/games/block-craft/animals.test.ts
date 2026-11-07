import { describe, expect, it } from 'vitest'
import { ANIMAL_SPAWNS, nextCell } from './animals'
import { createWorld, editWorld, SIZE, surfaceOf } from './world'

describe('animals', () => {
  it('start on dry ground inside the world', () => {
    const surface = surfaceOf(createWorld())
    for (const spawn of ANIMAL_SPAWNS) {
      expect(spawn.x).toBeGreaterThanOrEqual(0)
      expect(spawn.x).toBeLessThan(SIZE)
      expect(surface(spawn.x, spawn.z)?.material).toBe('grass')
    }
  })
  it('step to a neighbor, never into water, onto cactus, up high steps or outside', () => {
    const surface = surfaceOf(createWorld())
    for (let i = 0; i < 40; i++) {
      const random = () => i / 40
      for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
        const here = surface(x, z)!
        const next = nextCell(surface, { x, z }, random)
        if (next.x === x && next.z === z) continue
        expect(Math.abs(next.x - x) + Math.abs(next.z - z)).toBe(1)
        const ground = surface(next.x, next.z)!
        expect(['water', 'cactus']).not.toContain(ground.material)
        expect(Math.abs(ground.y - here.y)).toBeLessThanOrEqual(1)
      }
    }
  })
  it('stays put when fenced in', () => {
    let world = createWorld()
    for (const [x, z] of [[4, 5], [6, 5], [5, 4], [5, 6]]) {
      world = editWorld(world, { x, y: 3, z }, 'stone', 'place')
      world = editWorld(world, { x, y: 4, z }, 'stone', 'place')
    }
    const at = { x: 5, z: 5 }
    expect(nextCell(surfaceOf(world), at, () => 0.5)).toBe(at)
  })
})
