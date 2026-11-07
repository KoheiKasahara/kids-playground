import { describe, expect, it } from 'vitest'
import {
  blockAt, brushCells, createWorld, decodeWorld, editWorld, FLOW_LIMIT, FLOW_REACH, foundTreasures, growTree, HEIGHT, inside, key, MATERIALS,
  MAX_SAVE_LENGTH, settleWalker, SIZE, startWalker, surfaceOf, topBlock, TREASURES, walk, type Block, type World,
} from './world'

const waterAt = (world: World) => world.filter(b => b.material === 'water')

describe('block world', () => {
  it('starts with unique bounded terrain, water and trees, with an unbreakable floor', () => {
    const world = createWorld()
    expect(new Set(world.map(key)).size).toBe(world.length)
    expect(world.every(inside)).toBe(true)
    expect(world.some(b => b.material === 'water')).toBe(true)
    expect(world.some(b => b.material === 'leaf')).toBe(true)
    expect(SIZE).toBeGreaterThan(12)
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
    for (const raw of [null, '{}', 'oops', '[]', ' '.repeat(MAX_SAVE_LENGTH + 1), JSON.stringify([...world, world[0]]), JSON.stringify(world.slice(1)), JSON.stringify(world.map((b, i) => i ? b : { ...b, material: 'bad' }))]) {
      expect(decodeWorld(raw)).toBeNull()
    }
  })
})

describe('minecraft-like features', () => {
  it('hides treasure under the grass that appears when digging', () => {
    let world = createWorld()
    expect(topBlock(world, 4, 9).material).toBe('grass')
    world = editWorld(world, { x: 4, y: 2, z: 9 }, 'wood', 'remove')
    expect(topBlock(world, 4, 9).material).toBe('diamond')
    expect(createWorld().filter(b => b.material === 'gold').length).toBeGreaterThan(0)
  })
  it('has a snowy hill to climb', () => {
    const peak = createWorld().reduce((top, b) => b.material === 'snow' && b.y > top.y ? b : top, { x: 0, y: 0, z: 0 })
    expect(peak.y).toBeGreaterThan(3)
    expect(topBlock(createWorld(), peak.x, peak.z).material).toBe('snow')
  })
  it('lets sand fall down when nothing holds it', () => {
    const sandAt = (world: readonly Block[]) => world.find(b => b.x === 9 && b.z === 8 && b.material === 'sand')?.y
    let world = createWorld()
    for (let y = 3; y <= 5; y++) world = editWorld(world, { x: 8, y, z: 8 }, 'brick', 'place')
    world = editWorld(world, { x: 9, y: 5, z: 8 }, 'sand', 'place')
    expect(sandAt(world)).toBe(3)
    world = editWorld(world, { x: 9, y: 4, z: 8 }, 'sand', 'place')
    expect(world.filter(b => b.x === 9 && b.z === 8 && b.material === 'sand').map(b => b.y).sort()).toEqual([3, 4])
    // したの つちを ほると、すなも いっしょに おちる
    world = editWorld(world, { x: 9, y: 2, z: 8 }, 'wood', 'remove')
    expect(world.filter(b => b.x === 9 && b.z === 8 && b.material === 'sand').map(b => b.y).sort()).toEqual([2, 3])
    expect(world.filter(b => b.x === 8 && b.z === 8 && b.material === 'brick')).toHaveLength(3)
  })
  it('keeps a world saved before the area grew, adding flat ground around it', () => {
    const legacy: Block[] = []
    for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) legacy.push({ x, y: 0, z, material: 'stone' }, { x, y: 1, z, material: 'grass' })
    legacy.push({ x: 3, y: 2, z: 3, material: 'brick' })
    const loaded = decodeWorld(JSON.stringify(legacy))!
    expect(loaded).not.toBeNull()
    expect(loaded.slice(0, legacy.length)).toEqual(legacy)
    expect(new Set(loaded.map(key)).size).toBe(loaded.length)
    expect(loaded.filter(b => b.y === 0)).toHaveLength(SIZE * SIZE)
    expect(topBlock(loaded, SIZE - 1, SIZE - 1).material).toBe('grass')
    expect(decodeWorld(JSON.stringify(loaded))).toEqual(loaded)
    expect(decodeWorld(JSON.stringify(legacy.slice(1)))).toBeNull()
  })
  it('fills both palette layouts with complete rows', () => {
    expect(MATERIALS.length % 6).toBe(0)
    expect(MATERIALS.length % 9).toBe(0)
  })
})

describe('flowing water', () => {
  it('spreads a few cells sideways over the ground', () => {
    const before = createWorld()
    const world = editWorld(before, { x: 8, y: 3, z: 8 }, 'water', 'place')
    const added = waterAt(world).filter(b => b.y === 3)
    expect(added.length).toBeGreaterThan(5)
    expect(added.every(b => Math.abs(b.x - 8) + Math.abs(b.z - 8) <= FLOW_REACH)).toBe(true)
    expect(waterAt(world).length - waterAt(before).length).toBe(added.length)
  })
  it('falls off the edge of a tower and spreads again at the bottom, within a limit', () => {
    let world = createWorld()
    for (let y = 3; y <= 6; y++) world = editWorld(world, { x: 5, y, z: 5 }, 'brick', 'place')
    const before = waterAt(world).length
    world = editWorld(world, { x: 5, y: 7, z: 5 }, 'water', 'place')
    expect(blockAt(world, { x: 6, y: 3, z: 5 })?.material).toBe('water')
    expect(blockAt(world, { x: 6, y: 5, z: 5 })?.material).toBe('water')
    expect(waterAt(world).length - before).toBeLessThanOrEqual(FLOW_LIMIT + 1)
    expect(new Set(world.map(key)).size).toBe(world.length)
  })
  it('flows into a hole dug beside it, but a removed water block stays empty', () => {
    let world = createWorld()
    world = editWorld(world, { x: 4, y: 2, z: 2 }, 'wood', 'remove')
    expect(blockAt(world, { x: 4, y: 2, z: 2 })?.material).toBe('water')
    world = editWorld(world, { x: 4, y: 2, z: 0 }, 'wood', 'remove')
    expect(blockAt(world, { x: 4, y: 2, z: 0 })).toBeUndefined()
  })
  it('lets blocks be placed into water to dam it', () => {
    const world = editWorld(createWorld(), { x: 4, y: 2, z: 1 }, 'brick', 'place')
    expect(blockAt(world, { x: 4, y: 2, z: 1 })?.material).toBe('brick')
    expect(editWorld(createWorld(), { x: 4, y: 2, z: 1 }, 'water', 'place')).toEqual(createWorld())
  })
})

describe('wide brush', () => {
  it('covers the 3×3 plane facing the touched side', () => {
    const center = { x: 5, y: 5, z: 5 }
    expect(brushCells(center, { x: 0, y: 1, z: 0 }, false)).toEqual([center])
    const flat = brushCells(center, { x: 0, y: 1, z: 0 }, true)
    expect(flat[0]).toEqual(center)
    expect(flat).toHaveLength(9)
    expect(flat.every(p => p.y === 5)).toBe(true)
    expect(brushCells(center, { x: 1, y: 0, z: 0 }, true).every(p => p.x === 5)).toBe(true)
    expect(brushCells(center, { x: 0, y: 0, z: -1 }, true).every(p => p.z === 5)).toBe(true)
  })
  it('places and mines the whole area in one change, skipping the floor and the outside', () => {
    const initial = createWorld()
    const wall = editWorld(initial, brushCells({ x: 0, y: 3, z: 8 }, { x: 0, y: 1, z: 0 }, true), 'brick', 'place')
    expect(wall.length - initial.length).toBe(6)
    const mined = editWorld(wall, brushCells({ x: 8, y: 1, z: 8 }, { x: 0, y: 0, z: 1 }, true), 'wood', 'remove')
    expect(mined.filter(b => b.y === 0)).toHaveLength(SIZE * SIZE)
    expect(blockAt(mined, { x: 8, y: 2, z: 8 })).toBeUndefined()
  })
})

describe('saplings, treasure and walking', () => {
  it('grows a sapling into a tree only when there is room above', () => {
    const world = createWorld()
    const sapling = world.find(b => b.material === 'sapling')!
    const grown = growTree(world, sapling)
    expect(blockAt(grown, sapling)?.material).toBe('wood')
    expect(blockAt(grown, { ...sapling, y: sapling.y + 4 })?.material).toBe('leaf')
    expect(new Set(grown.map(key)).size).toBe(grown.length)
    expect(growTree(grown, sapling)).toBe(grown)
    const blocked = editWorld(world, { ...sapling, y: sapling.y + 1 }, 'stone', 'place')
    expect(growTree(blocked, sapling)).toBe(blocked)
  })
  it('counts a treasure as found once it is dug out of its spot', () => {
    let world = createWorld()
    expect(foundTreasures(world)).toEqual([])
    const [first] = TREASURES
    world = editWorld(world, { ...first, y: 2 }, 'wood', 'remove')
    expect(foundTreasures(world)).toEqual([])
    world = editWorld(world, first, 'wood', 'remove')
    expect(foundTreasures(world)).toEqual([first])
  })
  it('walks one cell at a time, climbs one step, drops down and never leaves the world', () => {
    let world = createWorld()
    const start = startWalker(world, 8, 8)
    expect(start).toEqual({ x: 8, y: 3, z: 8 })
    world = editWorld(world, { x: 9, y: 3, z: 8 }, 'stone', 'place')
    const up = walk(world, start, { x: 1, z: 0 })
    expect(up).toEqual({ x: 9, y: 4, z: 8 })
    expect(walk(world, up, { x: 0, z: 1 })).toEqual({ x: 9, y: 3, z: 9 })
    world = editWorld(world, { x: 9, y: 4, z: 8 }, 'stone', 'place')
    expect(walk(world, start, { x: 1, z: 0 })).toBe(start)
    const edge = startWalker(world, 0, 8)
    expect(walk(world, edge, { x: -1, z: 0 })).toBe(edge)
    // みずと くさばなは とおりぬけられる
    expect(walk(createWorld(), startWalker(createWorld(), 4, 2), { x: 0, z: -1 })).toEqual({ x: 4, y: 2, z: 1 })
    expect(walk(createWorld(), { x: 6, y: 3, z: 8 }, { x: 0, z: 1 })).toEqual({ x: 6, y: 3, z: 9 })
  })
  it('moves the walker up when a block fills its feet and down when the ground is dug', () => {
    let world = createWorld()
    const walker = startWalker(world, 8, 8)
    world = editWorld(world, walker, 'stone', 'place')
    expect(settleWalker(world, walker)).toEqual({ x: 8, y: 4, z: 8 })
    world = editWorld(createWorld(), { x: 8, y: 2, z: 8 }, 'stone', 'remove')
    expect(settleWalker(world, walker)).toEqual({ x: 8, y: 2, z: 8 })
    for (let y = 1; y < HEIGHT; y++) world = editWorld(world, { x: 3, y, z: 3 }, 'stone', 'place')
    expect(settleWalker(world, { x: 3, y: 1, z: 3 }).y).toBe(HEIGHT - 1)
  })
  it('finds the ground for animals, ignoring flowers', () => {
    const surface = surfaceOf(createWorld())
    expect(surface(6, 9)?.material).toBe('grass')
    expect(surface(12, 6)?.material).toBe('snow')
    expect(surface(4, 0)?.material).toBe('water')
  })
})
