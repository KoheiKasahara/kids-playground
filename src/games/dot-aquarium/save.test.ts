import { describe, expect, test } from 'vitest'
import { restore, serialize, starterTank } from './save'
import { addCreature, addDecor, createWorld, floorY } from './sim'

describe('save', () => {
  test('ほぞんして もどすと おなじ ならび（はばが かわっても わりあいで もどる）', () => {
    const world = createWorld(1, 400, 225)
    addDecor(world, 'castle', 200, floorY(world, .5))
    addDecor(world, 'kelp', 60, floorY(world, .2))
    addCreature(world, 'shark', 120, 80)
    addCreature(world, 'eel', 300, floorY(world, .7))
    world.pearls = 3
    const back = restore(JSON.parse(JSON.stringify(serialize(world))), 800, 225)
    expect(back.decor.map(d => d.kind)).toEqual(['castle', 'kelp'])
    expect(back.decor[0].x).toBeCloseTo(400, 0)
    expect(back.creatures.map(c => c.species)).toEqual(['shark', 'eel'])
    expect(back.creatures[1].homeX).toBeCloseTo(600, 0)
    expect(back.pearls).toBe(3)
  })

  test('こわれた データや ルールいはんは すてる', () => {
    expect(restore(null).creatures).toHaveLength(0)
    expect(restore('x').decor).toHaveLength(0)
    const back = restore({
      clock: 5,
      pearls: -1,
      d: [{ k: 'castle', x: .5, z: .5 }, { k: 'castle', x: .1, z: .5 }, { k: 'ufo', x: .2, z: .2 }, { k: 'rock', x: 9, z: 0 }],
      c: [{ s: 'shark', x: .5, y: .5, z: .5 }, { s: 'shark', x: .2, y: .5, z: .5 }, { s: 'dragon', x: .3, y: .3, z: .3 }, { s: 'neon', x: -1, y: .5, z: .5 }],
      m: [{ x: .5, y: .5, r: 8, a: .5, seed: 1 }, { x: 'a' }],
    })
    expect(back.decor.map(d => d.kind)).toEqual(['castle'])
    expect(back.creatures.map(c => c.species)).toEqual(['shark'])
    expect(back.moss).toHaveLength(1)
    expect(back.clock).toBeLessThan(1)
    expect(back.pearls).toBe(0)
  })

  test('おてほんの すいそうは ルールを まもっている', () => {
    const world = starterTank()
    expect(world.creatures.length).toBeGreaterThan(5)
    expect(world.decor.some(d => d.kind === 'anemone')).toBe(true)
    expect(world.creatures.some(c => c.species === 'clown')).toBe(true)
  })
})
