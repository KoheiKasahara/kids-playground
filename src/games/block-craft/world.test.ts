import { describe, expect, it } from 'vitest'
import { createWorld, decodeWorld, editWorld, HEIGHT, inside, key, MAX_SAVE_LENGTH, SIZE, topBlock, type Block } from './world'

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
})
