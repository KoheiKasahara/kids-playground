import { describe, expect, test } from 'vitest'
import { restore, serialize, starterZoo } from './save'
import { addAnimal, addObject, createWorld } from './sim'

describe('save', () => {
  test('ほぞんして もどすと おなじ ならび', () => {
    const world = createWorld()
    addObject(world, 'pond', 2, 2)
    addObject(world, 'tree', 8, 8)
    addAnimal(world, 'penguin', 3, 3)
    addAnimal(world, 'giraffe', 6, 6)
    const back = restore(JSON.parse(JSON.stringify(serialize(world))))
    expect(back.objects.map(o => [o.kind, o.x, o.z])).toEqual([['pond', 2, 2], ['tree', 8, 8]])
    expect(back.animals.map(a => a.species)).toEqual(['penguin', 'giraffe'])
  })

  test('こわれた データや ルールいはんは すてる', () => {
    expect(restore(null).animals).toHaveLength(0)
    expect(restore('x').objects).toHaveLength(0)
    const back = restore({
      clock: 5,
      objects: [{ k: 'tree', x: 1, z: 1 }, { k: 'tree', x: 1, z: 1 }, { k: 'castle', x: 2, z: 2 }, { k: 'rock', x: 99, z: 0 }],
      animals: [{ s: 'giraffe', x: 4.5, z: 4.5 }, { s: 'giraffe', x: 5.5, z: 5.5 }, { s: 'dragon', x: 3, z: 3 }, { s: 'penguin', x: 6, z: 6 }, { s: 'lion', x: -3, z: 2 }],
    })
    expect(back.objects).toHaveLength(1)
    expect(back.animals.map(a => a.species)).toEqual(['giraffe'])
    expect(back.clock).toBeLessThan(1)
  })

  test('おてほんの どうぶつえんは ルールを まもっている', () => {
    const world = starterZoo()
    expect(world.animals.length).toBeGreaterThan(2)
    expect(world.objects.some(o => o.kind === 'pond')).toBe(true)
    expect(world.animals.some(a => a.species === 'penguin')).toBe(true)
  })
})
