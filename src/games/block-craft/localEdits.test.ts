import { afterEach, describe, expect, it, vi } from 'vitest'
import { BIOMES } from './biomes'
import { herdFrom, walkable } from './animals'
import { referenceEdit } from './referenceEdit.test-fixture'
import {
  brushCells, createWorld, editWorld, foundTreasures, growTree, key, materialCode, netMaterialChange, settleWalker,
  surfaceOf, tendCrops, undoChanges, walk, World, type Block, type Material, type Position,
} from './world'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe.each([21, 64, 128])('%i-wide worlds', size => {
  it('generates each biome, treasures and animal spawns within its own dimensions', () => {
    for (const land of BIOMES) {
      const world = land.create({ size, height: 24 })
      expect(world.size).toBe(size)
      expect(world.height).toBe(24)
      expect(foundTreasures(world)).toEqual([])
      const surface = surfaceOf(world)
      for (const animal of herdFrom(land.spawns, size)) {
        expect(walkable(surface(animal.x, animal.z))).toBe(true)
      }
    }
  })
})

it('produces the same edits as the full scan, including simultaneous and pre-existing reactions', () => {
  const dimensions = { size: 64, height: 18 }
  const initial = createWorld(dimensions)
  const base: Block[] = [...initial.blocks(), { x: 58, y: 4, z: 56, material: 'sand' }]
  const world = new World(dimensions, base)
  let reference: readonly Block[] = base
  const x = 40, z = 38
  const cases: [Position | readonly Position[], Material, 'place' | 'remove'][] = [
    [{ x, y: 3, z }, 'snow', 'place'],
    [{ x: x + 2, y: 3, z }, 'lava', 'place'],
    [{ x: x + 1, y: 3, z }, 'ice', 'place'],
    [brushCells({ x, y: 3, z: z + 2 }, { x: 0, y: 1, z: 0 }, true), 'water', 'place'],
    [{ x, y: 2, z: z + 2 }, 'stone', 'remove'],
    [brushCells({ x: x + 3, y: 3, z }, { x: 0, y: 1, z: 0 }, true), 'seed', 'place'],
    [{ x, y: 2, z }, 'stone', 'remove'],
    [{ x, y: 4, z }, 'sand', 'place'],
    [{ x: 17, y: 2, z: 3 }, 'lava', 'place'],
  ]
  const asMap = (blocks: Iterable<Block>) => new Map(Array.from(blocks, b => [key(b), b.material]))
  for (const args of cases) {
    const before = asMap(world.blocks())
    const changes = editWorld(world, ...args)
    reference = referenceEdit(dimensions, reference, ...args)
    const expected = asMap(reference)
    expect(asMap(world.blocks())).toEqual(expected)
    for (const change of changes) {
      expect(change.before).toBe(materialCode(before.get(key(change))))
      expect(change.after).toBe(materialCode(expected.get(key(change))))
    }
    expect(new Set(changes.map(key)).size).toBe(changes.length)
    undoChanges(world, changes)
    expect(asMap(world.blocks())).toEqual(before)
    expect(editWorld(world, ...args)).toEqual(changes)
  }
})

it('undos plant growth and publishes one batch for each edit and reverse edit', () => {
  const world = createWorld({ size: 64, height: 12 })
  const initial = [...world.blocks()]
  const listener = vi.fn()
  const unsubscribe = world.subscribe(listener)
  const sapling = initial.find(b => b.material === 'sapling')!
  const tree = growTree(world, sapling)
  const seed = { x: 29, y: 3, z: 30 }
  const planting = editWorld(world, seed, 'seed', 'place')
  const sprout = tendCrops(world, [seed]).changes
  expect(world.materialAt(seed)).toBe('sprout')
  undoChanges(world, sprout)
  undoChanges(world, planting)
  undoChanges(world, tree)
  expect([...world.blocks()]).toEqual(initial)
  expect(listener).toHaveBeenCalledTimes(6)
  expect(listener.mock.calls[0][0]).toBe(tree)
  expect(listener.mock.calls[5][0]).toEqual(tree.map(c => ({ ...c, before: c.after, after: c.before })))
  unsubscribe()
  growTree(world, sapling)
  expect(listener).toHaveBeenCalledTimes(6)
})

it('counts net obsidian changes when placing into water or when the brush also removes obsidian', () => {
  const world = createWorld()
  const obsidian = materialCode('obsidian')
  expect(netMaterialChange(editWorld(world, { x: 4, y: 2, z: 1 }, 'lava', 'place'), obsidian)).toBe(1)
  expect(netMaterialChange(editWorld(world, { x: 8, y: 3, z: 8 }, 'obsidian', 'place'), obsidian)).toBe(1)
  editWorld(world, { x: 6, y: 3, z: 2 }, 'lava', 'place')
  const changes = editWorld(world, [{ x: 6, y: 2, z: 2 }, { x: 4, y: 2, z: 1 }], 'wood', 'remove')
  expect(changes.some(c => c.before === obsidian && c.after !== obsidian)).toBe(true)
  expect(changes.some(c => c.after === obsidian && c.before !== obsidian)).toBe(true)
  expect(netMaterialChange(changes, obsidian)).toBe(0)
})

it('keeps local edit, reverse edit and walking reads bounded without copying a cell buffer', () => {
  const sizes = [16, 64, 128]
  const worlds = sizes.map(size => createWorld({ size, height: 24 }))
  const typedCopies = vi.spyOn(Uint8Array.prototype, 'slice')
  const arrays = vi.fn()
  const TypedArray = Uint8Array
  vi.stubGlobal('Uint8Array', new Proxy(TypedArray, {
    construct(target, args) {
      arrays(args[0])
      return Reflect.construct(target, args)
    },
  }))
  const work = worlds.map(world => {
    const reads = vi.spyOn(world, 'codeAt')
    const indexedReads = vi.spyOn(world, 'codeAtIndex')
    const scans = vi.spyOn(world, 'blocks')
    const target = { x: 1, y: 3, z: world.size - 2 }
    const changes = editWorld(world, target, 'brick', 'place')
    expect(changes).toHaveLength(1)
    expect(world.topY(target.x, target.z)).toBe(3)
    const walking = settleWalker(world, target)
    walk(world, walking, { x: 1, z: 0 })
    undoChanges(world, changes)
    expect(world.topY(target.x, target.z)).toBe(2)
    expect(scans).not.toHaveBeenCalled()
    return reads.mock.calls.length + indexedReads.mock.calls.length
  })
  expect(work).toEqual([work[0], work[0], work[0]])
  expect(work[0]).toBeLessThan(200)
  expect(typedCopies).not.toHaveBeenCalled()
  expect(arrays).not.toHaveBeenCalled()
})
