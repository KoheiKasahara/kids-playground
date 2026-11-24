import { describe, expect, it } from 'vitest'
import {
  arriveAt, blockAt, brushCells, createWorld, DEFAULT_WORLD, eatCake, editWorld as mutateWorld, explode, FLOW_LIMIT, FLOW_REACH, foundTreasures, growTree as mutateTree, inside, isStable, key,
  materialCode, MAX_BLAST_CHAIN, netMaterialChange, nextPortal, PALETTE, pickAs, portalGates, SPONGE_LIMIT, tendCrops as mutateCrops, toggleDoor, undoChanges, wheatAt,
  settleWalker, startWalker, surfaceOf, topBlock, TREASURES, walk, World, type Block, type Material, type Position,
} from './world'

import { decodeLegacyWorld as decodeWorld } from './saveCodec'

const { size: SIZE, height: HEIGHT } = DEFAULT_WORLD
const MAX_SAVE_LENGTH = 250_000
const snapshot = (world: World) => [...world.blocks()]
// The original scenarios compare before/after worlds. Copy only in these fixtures.
const editWorld = (world: World, target: Position | readonly Position[], material: Material, mode: 'place' | 'remove') => {
  const copy = new World(world, world.blocks())
  return mutateWorld(copy, target, material, mode).length ? copy : world
}
const growTree = (world: World, sapling: Block) => {
  const copy = new World(world, world.blocks())
  return mutateTree(copy, sapling).length ? copy : world
}
const tendCrops = (world: World, targets: Parameters<typeof mutateCrops>[1]) => {
  const copy = new World(world, world.blocks())
  const { changes, harvested } = mutateCrops(copy, targets)
  return { world: changes.length ? copy : world, harvested }
}

const waterAt = (world: World) => snapshot(world).filter(b => b.material === 'water')

describe('block world', () => {
  it('starts with unique bounded terrain, water and trees, with an unbreakable floor', () => {
    const world = createWorld()
    expect(new Set(snapshot(world).map(key)).size).toBe(snapshot(world).length)
    expect(snapshot(world).every(b => inside(world, b))).toBe(true)
    expect(snapshot(world).some(b => b.material === 'water')).toBe(true)
    expect(snapshot(world).some(b => b.material === 'leaf')).toBe(true)
    expect(SIZE).toBeGreaterThan(12)
    expect(snapshot(world).filter(b => b.y === 0)).toHaveLength(SIZE * SIZE)
    expect(editWorld(world, { x: 0, y: 0, z: 0 }, 'wood', 'remove')).toBe(world)
  })
  it('builds a wall and roof, mines its side, and preserves other blocks', () => {
    const initial = createWorld()
    let world = initial
    for (let y = 3; y <= 5; y++) world = editWorld(world, { x: 5, y, z: 5 }, 'brick', 'place')
    world = editWorld(world, { x: 6, y: 5, z: 5 }, 'wood', 'place')
    expect(topBlock(world, 5, 5).y).toBe(5)
    const mined = editWorld(world, { x: 5, y: 4, z: 5 }, 'wood', 'remove')
    expect(snapshot(mined)).toHaveLength(snapshot(initial).length + 3)
    expect(snapshot(mined).some(b => b.x === 6 && b.y === 5 && b.z === 5)).toBe(true)
    expect(snapshot(initial)).toEqual(snapshot(createWorld()))
  })
  it('rejects occupied, floating, out-of-bounds and fractional placements', () => {
    const world = createWorld()
    for (const position of [{ x: 5, y: 2, z: 5 }, { x: 5, y: 8, z: 5 }, { x: -1, y: 3, z: 5 }, { x: SIZE, y: 3, z: 5 }, { x: 5, y: HEIGHT, z: 5 }, { x: 0.5, y: 3, z: 5 }]) {
      expect(editWorld(world, position, 'wood', 'place')).toBe(world)
    }
  })
  it('round trips saves and rejects corrupt, oversized, duplicate, and floorless data', () => {
    const world = createWorld()
    expect(snapshot(decodeWorld(JSON.stringify(snapshot(world)))!)).toEqual(snapshot(world))
    for (const raw of [null, '{}', 'oops', '[]', ' '.repeat(MAX_SAVE_LENGTH + 1), JSON.stringify([...snapshot(world), snapshot(world)[0]]), JSON.stringify(snapshot(world).slice(1)), JSON.stringify(snapshot(world).map((b, i) => i ? b : { ...b, material: 'bad' }))]) {
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
    expect(snapshot(createWorld()).filter(b => b.material === 'gold').length).toBeGreaterThan(0)
  })
  it('has a snowy hill to climb', () => {
    const peak = snapshot(createWorld()).reduce((top, b) => b.material === 'snow' && b.y > top.y ? b : top, { x: 0, y: 0, z: 0 })
    expect(peak.y).toBeGreaterThan(3)
    expect(topBlock(createWorld(), peak.x, peak.z).material).toBe('snow')
  })
  it('lets sand fall down when nothing holds it', () => {
    const sandAt = (world: readonly Block[]) => world.find(b => b.x === 9 && b.z === 8 && b.material === 'sand')?.y
    let world = createWorld()
    for (let y = 3; y <= 5; y++) world = editWorld(world, { x: 8, y, z: 8 }, 'brick', 'place')
    world = editWorld(world, { x: 9, y: 5, z: 8 }, 'sand', 'place')
    expect(sandAt(snapshot(world))).toBe(3)
    world = editWorld(world, { x: 9, y: 4, z: 8 }, 'sand', 'place')
    expect(snapshot(world).filter(b => b.x === 9 && b.z === 8 && b.material === 'sand').map(b => b.y).sort()).toEqual([3, 4])
    // したの つちを ほると、すなも いっしょに おちる
    world = editWorld(world, { x: 9, y: 2, z: 8 }, 'wood', 'remove')
    expect(snapshot(world).filter(b => b.x === 9 && b.z === 8 && b.material === 'sand').map(b => b.y).sort()).toEqual([2, 3])
    expect(snapshot(world).filter(b => b.x === 8 && b.z === 8 && b.material === 'brick')).toHaveLength(3)
  })
  it('keeps a world saved before the area grew, adding flat ground around it', () => {
    const legacy: Block[] = []
    for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) legacy.push({ x, y: 0, z, material: 'stone' }, { x, y: 1, z, material: 'grass' })
    legacy.push({ x: 3, y: 2, z: 3, material: 'brick' })
    const loaded = decodeWorld(JSON.stringify(legacy))!
    expect(loaded).not.toBeNull()
    expect(snapshot(loaded)).toEqual(expect.arrayContaining(legacy))
    expect(new Set(snapshot(loaded).map(key)).size).toBe(snapshot(loaded).length)
    expect(snapshot(loaded).filter(b => b.y === 0)).toHaveLength(SIZE * SIZE)
    expect(topBlock(loaded, SIZE - 1, SIZE - 1).material).toBe('grass')
    expect(snapshot(decodeWorld(JSON.stringify(snapshot(loaded)))!)).toEqual(snapshot(loaded))
    expect(decodeWorld(JSON.stringify(legacy.slice(1)))).toBeNull()
  })
  it('fills both palette layouts with complete rows', () => {
    // 2だんでも 3だんでも さいごの れつが うまる
    expect(PALETTE.length % 6).toBe(0)
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
    expect(new Set(snapshot(world).map(key)).size).toBe(snapshot(world).length)
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
    const meadow = createWorld()
    expect(editWorld(meadow, { x: 4, y: 2, z: 1 }, 'water', 'place')).toBe(meadow)
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
    expect(snapshot(wall).length - snapshot(initial).length).toBe(6)
    const mined = editWorld(wall, brushCells({ x: 8, y: 1, z: 8 }, { x: 0, y: 0, z: 1 }, true), 'wood', 'remove')
    expect(snapshot(mined).filter(b => b.y === 0)).toHaveLength(SIZE * SIZE)
    expect(blockAt(mined, { x: 8, y: 2, z: 8 })).toBeUndefined()
  })
})

describe('saplings, treasure and walking', () => {
  it('grows a sapling into a tree only when there is room above', () => {
    const world = createWorld()
    const sapling = snapshot(world).find(b => b.material === 'sapling')!
    const grown = growTree(world, sapling)
    expect(blockAt(grown, sapling)?.material).toBe('wood')
    expect(blockAt(grown, { ...sapling, y: sapling.y + 4 })?.material).toBe('leaf')
    expect(new Set(snapshot(grown).map(key)).size).toBe(snapshot(grown).length)
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

describe('lava, ice and farming', () => {
  it('hardens lava that touches water or ice into obsidian, melting the ice', () => {
    expect(isStable(createWorld())).toBe(true)
    const intoWater = editWorld(createWorld(), { x: 4, y: 2, z: 1 }, 'lava', 'place')
    expect(blockAt(intoWater, { x: 4, y: 2, z: 1 })?.material).toBe('obsidian')
    expect(isStable(intoWater)).toBe(true)
    let world = editWorld(createWorld(), { x: 8, y: 3, z: 8 }, 'lava', 'place')
    expect(blockAt(world, { x: 8, y: 3, z: 8 })?.material).toBe('lava')
    world = editWorld(world, { x: 9, y: 3, z: 8 }, 'ice', 'place')
    expect(blockAt(world, { x: 8, y: 3, z: 8 })?.material).toBe('obsidian')
    expect(blockAt(world, { x: 9, y: 3, z: 8 })?.material).toBe('water')
  })
  it('freezes water that touches snow', () => {
    const world = editWorld(createWorld(), { x: 4, y: 3, z: 1 }, 'snow', 'place')
    expect(blockAt(world, { x: 4, y: 2, z: 1 })?.material).toBe('ice')
    expect(blockAt(world, { x: 3, y: 2, z: 1 })?.material).toBe('water')
  })
  it('plants seeds only on soil, tilling it into farmland', () => {
    const world = editWorld(createWorld(), { x: 8, y: 3, z: 8 }, 'seed', 'place')
    expect(blockAt(world, { x: 8, y: 3, z: 8 })?.material).toBe('seed')
    expect(blockAt(world, { x: 8, y: 2, z: 8 })?.material).toBe('farmland')
    const stone = editWorld(createWorld(), { x: 8, y: 3, z: 8 }, 'stone', 'place')
    expect(editWorld(stone, { x: 8, y: 4, z: 8 }, 'seed', 'place')).toBe(stone)
    const sand = createWorld()
    expect(editWorld(sand, { x: 4, y: 3, z: 2 }, 'seed', 'place')).toBe(sand)
    // ひろく で 3×3 の はたけ
    const field = editWorld(createWorld(), brushCells({ x: 8, y: 3, z: 8 }, { x: 0, y: 1, z: 0 }, true), 'seed', 'place')
    expect(snapshot(field).filter(b => b.material === 'farmland')).toHaveLength(9)
  })
  it('grows crops one stage per tap and harvests wheat back into seeds', () => {
    const seed = { x: 8, y: 3, z: 8 }
    let world = editWorld(createWorld(), seed, 'seed', 'place')
    const stages: string[] = []
    let harvested = 0
    for (let i = 0; i < 3; i++) {
      const result = tendCrops(world, [seed])
      world = result.world
      harvested += result.harvested
      stages.push(blockAt(world, seed)!.material)
      if (i === 1) expect(wheatAt(world, [seed, { x: 0, y: 1, z: 0 }])).toBe(1)
    }
    expect(stages).toEqual(['sprout', 'wheat', 'seed'])
    expect(harvested).toBe(1)
    const plain = createWorld()
    expect(tendCrops(plain, [{ x: 8, y: 2, z: 8 }])).toEqual({ world: plain, harvested: 0 })
    expect([pickAs('wheat'), pickAs('sprout'), pickAs('farmland'), pickAs('stone')]).toEqual(['seed', 'seed', 'dirt', 'stone'])
  })
  it('takes away plants when the ground under them is dug', () => {
    const world = editWorld(createWorld(), { x: 6, y: 2, z: 9 }, 'wood', 'remove')
    expect(blockAt(world, { x: 6, y: 3, z: 9 })).toBeUndefined()
  })
  it('slides the walker across ice and never steps onto lava', () => {
    let world = createWorld()
    for (let x = 5; x <= 8; x++) world = editWorld(world, { x, y: 3, z: 8 }, 'ice', 'place')
    expect(walk(world, { x: 4, y: 3, z: 8 }, { x: 1, z: 0 })).toEqual({ x: 9, y: 3, z: 8 })
    // とちゅうに かべが あれば そこで とまる
    const walled = editWorld(world, { x: 8, y: 4, z: 8 }, 'stone', 'place')
    expect(walk(walled, { x: 4, y: 3, z: 8 }, { x: 1, z: 0 })).toEqual({ x: 7, y: 4, z: 8 })
    const lava = editWorld(createWorld(), { x: 5, y: 3, z: 8 }, 'lava', 'place')
    const from = { x: 4, y: 3, z: 8 }
    expect(walk(lava, from, { x: 1, z: 0 })).toBe(from)
    let pit = editWorld(createWorld(), { x: 5, y: 2, z: 8 }, 'wood', 'remove')
    pit = editWorld(pit, { x: 5, y: 2, z: 8 }, 'lava', 'place')
    expect(walk(pit, from, { x: 1, z: 0 })).toBe(from)
  })
})

describe('blocks made at the crafting table', () => {
  const east = { x: 1, z: 0 }
  it('opens and closes stacked doors together, and only an open door lets the walker through', () => {
    const world = createWorld()
    for (const z of [7, 9]) for (const y of [3, 4]) mutateWorld(world, { x: 9, y, z }, 'stone', 'place')
    for (const y of [3, 4]) mutateWorld(world, { x: 9, y, z: 8 }, 'door', 'place')
    const from = { x: 8, y: 3, z: 8 }
    // しまった ドアは とおれず、のぼれもしない
    expect(walk(world, from, east)).toBe(from)
    expect(toggleDoor(world, { x: 9, y: 4, z: 8 })).toHaveLength(2)
    expect([3, 4].map(y => world.materialAt({ x: 9, y, z: 8 }))).toEqual(['door_open', 'door_open'])
    expect(walk(world, from, east)).toEqual({ x: 9, y: 3, z: 8 })
    // ひらいた ドアは じめんに ならない（どうぶつも とおれる）
    expect(surfaceOf(world)(9, 8)?.material).toBe('grass')
    expect(pickAs('door_open')).toBe('door')
    toggleDoor(world, { x: 9, y: 3, z: 8 })
    expect([3, 4].map(y => world.materialAt({ x: 9, y, z: 8 }))).toEqual(['door', 'door'])
    expect(toggleDoor(world, { x: 8, y: 2, z: 8 })).toEqual([])
  })
  it('never lets the walker step up onto a fence or a closed door, but a plain block is one step', () => {
    for (const material of ['fence', 'door', 'stone'] as const) {
      const world = createWorld()
      mutateWorld(world, { x: 9, y: 3, z: 8 }, material, 'place')
      const from = { x: 8, y: 3, z: 8 }
      expect(walk(world, from, east)).toEqual(material === 'stone' ? { x: 9, y: 4, z: 8 } : from)
    }
  })
  it('soaks up the water around a sponge, within its reach and limit', () => {
    const world = createWorld()
    // みずうみは z = 0, 1 の y = 2
    mutateWorld(world, { x: 8, y: 3, z: 1 }, 'sponge', 'place')
    for (const x of [4, 8, 12]) expect(world.materialAt({ x, y: 2, z: 1 })).toBeUndefined()
    for (const x of [3, 13]) expect(world.materialAt({ x, y: 2, z: 1 })).toBe('water')
    const pool = new World(DEFAULT_WORLD, (function* () {
      for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
        yield { x, y: 0, z, material: 'stone' as const }
        for (let y = 1; y <= 3; y++) yield { x, y, z, material: 'water' as const }
      }
    })())
    const changes = mutateWorld(pool, { x: 8, y: 2, z: 8 }, 'sponge', 'place')
    // スポンジが おきかえた 1つと、すいとった ぶん
    expect(netMaterialChange(changes, materialCode('water'))).toBe(-(SPONGE_LIMIT + 1))
  })
  it('blows up the blocks around a bomb, sets off bombs nearby, and keeps obsidian and the floor', () => {
    const world = createWorld()
    const before = snapshot(world)
    for (const p of [{ x: 8, y: 3, z: 8 }, { x: 6, y: 3, z: 8 }]) mutateWorld(world, p, 'bomb', 'place')
    mutateWorld(world, { x: 8, y: 3, z: 9 }, 'obsidian', 'place')
    const built = snapshot(world)
    const { changes, bombs } = explode(world, { x: 8, y: 3, z: 8 })
    expect(bombs).toEqual([{ x: 8, y: 3, z: 8 }, { x: 6, y: 3, z: 8 }])
    expect(world.materialAt({ x: 8, y: 3, z: 9 })).toBe('obsidian')
    // となりの ばくだんの まわりも こわれる
    for (const x of [4, 6, 8, 10]) expect(world.materialAt({ x, y: 2, z: 8 })).toBeUndefined()
    expect(world.materialAt({ x: 3, y: 2, z: 8 })).toBe('grass')
    expect(snapshot(world).filter(b => b.y === 0)).toHaveLength(SIZE * SIZE)
    expect(explode(world, { x: 8, y: 3, z: 8 })).toEqual({ changes: [], bombs: [] })
    undoChanges(world, changes)
    expect(snapshot(world)).toEqual(built)
    expect(before.length).toBe(built.length - 3)
  })
  it('digs up treasure with a bomb and limits how many bombs go off together', () => {
    const world = createWorld()
    const gold = TREASURES.find(t => t.x === 9 && t.z === 10)!
    mutateWorld(world, { x: 9, y: 3, z: 10 }, 'bomb', 'place')
    const { changes } = explode(world, { x: 9, y: 3, z: 10 })
    expect(world.discovered(changes)).toEqual([gold])
    const field = createWorld()
    for (let x = 1; x < SIZE - 1; x++) mutateWorld(field, { x, y: 3, z: 8 }, 'bomb', 'place')
    expect(explode(field, { x: 1, y: 3, z: 8 }).bombs).toHaveLength(MAX_BLAST_CHAIN)
  })
  it('eats a cake in two bites', () => {
    const world = createWorld()
    const cake = { x: 8, y: 3, z: 8 }
    mutateWorld(world, cake, 'cake', 'place')
    expect(eatCake(world, cake)).toHaveLength(1)
    expect(world.materialAt(cake)).toBe('cake_half')
    expect(pickAs('cake_half')).toBe('cake')
    eatCake(world, cake)
    expect(world.materialAt(cake)).toBeUndefined()
    expect(eatCake(world, cake)).toEqual([])
  })
  it('takes a torch away with the ground under it, like other plants', () => {
    const world = createWorld()
    mutateWorld(world, { x: 8, y: 3, z: 8 }, 'torch', 'place')
    expect(walk(world, { x: 7, y: 3, z: 8 }, east)).toEqual({ x: 8, y: 3, z: 8 })
    mutateWorld(world, { x: 8, y: 2, z: 8 }, 'wood', 'remove')
    expect(world.materialAt({ x: 8, y: 3, z: 8 })).toBeUndefined()
  })
})

describe('painting blocks', () => {
  it('turns the touched block into the chosen one, but not air, the floor, water or plants', () => {
    const world = createWorld()
    const grass = { x: 8, y: 2, z: 8 }
    expect(mutateWorld(world, grass, 'brick', 'paint')).toEqual([{ ...grass, before: materialCode('grass'), after: materialCode('brick') }])
    expect(snapshot(world)).toHaveLength(snapshot(createWorld()).length)
    const flower = snapshot(world).find(b => b.material === 'flower')!
    for (const target of [grass, { x: 8, y: 3, z: 8 }, { x: 8, y: 0, z: 8 }, { x: 4, y: 2, z: 0 }, flower]) {
      expect(mutateWorld(world, target, 'brick', 'paint')).toEqual([])
    }
    // くさばな・みずでは ぬれない
    for (const material of ['flower', 'seed', 'water'] as const) expect(mutateWorld(world, { x: 9, y: 2, z: 8 }, material, 'paint')).toEqual([])
  })
  it('paints a whole 3×3 face, lets painted sand fall and hardens painted lava next to water', () => {
    const world = createWorld()
    mutateWorld(world, brushCells({ x: 8, y: 2, z: 8 }, { x: 0, y: 1, z: 0 }, true), 'stone', 'paint')
    expect(snapshot(world).filter(b => b.y === 2 && b.material === 'stone' && Math.abs(b.x - 8) <= 1 && Math.abs(b.z - 8) <= 1)).toHaveLength(9)
    // うかんだ ブロックを すなに すると おちる
    mutateWorld(world, { x: 8, y: 3, z: 8 }, 'brick', 'place')
    mutateWorld(world, { x: 8, y: 4, z: 8 }, 'brick', 'place')
    mutateWorld(world, { x: 8, y: 3, z: 8 }, 'brick', 'remove')
    mutateWorld(world, { x: 8, y: 4, z: 8 }, 'sand', 'paint')
    expect(blockAt(world, { x: 8, y: 3, z: 8 })?.material).toBe('sand')
    expect(blockAt(world, { x: 8, y: 4, z: 8 })).toBeUndefined()
    // みずうみの きしの すなを ようがんに すると、すぐ くろいしに なる
    const changes = mutateWorld(world, { x: 4, y: 2, z: 2 }, 'lava', 'paint')
    expect(blockAt(world, { x: 4, y: 2, z: 2 })?.material).toBe('obsidian')
    expect(netMaterialChange(changes, materialCode('obsidian'))).toBe(1)
  })
})

describe('warp gates', () => {
  it('jumps to the next gate in turn, counting joined portal blocks as one gate', () => {
    const world = createWorld()
    const a = { x: 3, y: 3, z: 8 }, b = { x: 12, y: 3, z: 12 }, c = { x: 8, y: 3, z: 4 }
    mutateWorld(world, a, 'portal', 'place')
    // ゲートが 1つだけ・ワープでない ブロックからは とばない
    expect(nextPortal(world, a)).toBeNull()
    mutateWorld(world, b, 'portal', 'place')
    expect(nextPortal(world, { x: 3, y: 2, z: 8 })).toBeNull()
    // つみかさねた ワープは 1つの ゲート
    mutateWorld(world, { ...a, y: 4 }, 'portal', 'place')
    expect(portalGates(world)).toEqual([a, b])
    expect(nextPortal(world, { ...a, y: 4 })).toEqual(b)
    expect(nextPortal(world, b)).toEqual(a)
    // ゲートが ふえると じゅんばんに めぐる
    mutateWorld(world, c, 'portal', 'place')
    expect(portalGates(world)).toEqual([c, a, b])
    expect([nextPortal(world, a), nextPortal(world, b), nextPortal(world, c)]).toEqual([b, c, a])
    // ついたら ゲートの いちばん うえに たつ
    expect(arriveAt(world, a)).toEqual({ ...a, y: 5 })
    expect(arriveAt(world, b)).toEqual({ ...b, y: 4 })
  })
})
