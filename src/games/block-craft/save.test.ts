import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ANIMAL_SPAWNS, herdFrom, spawnHerd } from './animals'
import { biome } from './biomes'
import { decodeExtra, decodeGame, encodeGame, EXTRA_KEY, MAX_WHEAT, newGame, readGame, readWool, SAVE_KEY, WOOL_KEY, writeGame, writeWool, type Game } from './save'
import { createWorld, editWorld, MATERIALS, World, type Block } from './world'
import { encodeGrid, LEGACY_SAVE_KEY } from './saveCodec'
import { NEW_WORLD } from './terrain'

const snapshot = ({ world, ...rest }: Game) => ({ ...rest, size: world.size, height: world.height, blocks: [...world.blocks()] })

const store = new Map<string, string>()
const localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
  removeItem: (key: string) => { store.delete(key) },
}
beforeEach(() => { store.clear(); vi.stubGlobal('localStorage', localStorage) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

/** ひろい せかいは ブロックを ならべずに、ほぞんした かたちで くらべる。 */
const packed = ({ world, ...rest }: Game) => ({ ...rest, ...encodeGrid(world) })

it('saves and reads back the wide world with its land, seed, wheat and animals', () => {
  const game = { ...newGame('snow'), wheat: 4 }
  expect(game.world).toMatchObject(NEW_WORLD)
  expect(game.herd).toEqual(spawnHerd(game.world, biome('snow').animals, game.seed))
  expect(writeGame(game)).toBe(true)
  expect(packed(readGame()!)).toEqual(packed(game))
})

it('makes a different world each time, and the same world again from its seed', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.25).mockReturnValueOnce(0.75)
  const [first, second] = [newGame('forest'), newGame('forest')]
  random.mockRestore()
  expect(first.seed).not.toBe(second.seed)
  expect(packed(first)).not.toEqual(packed(second))
  expect(packed(newGame('forest', first.world, first.seed))).toEqual(packed(first))
  // まえの ばんの ほぞんには seed が なく、こわれた seed も 0 に する
  const { seed: _seed, ...old } = JSON.parse(encodeGame(first))
  expect(_seed).toBe(first.seed)
  expect(decodeGame(JSON.stringify(old))?.seed).toBe(0)
  expect(decodeGame(JSON.stringify({ ...old, seed: -3 }))?.seed).toBe(0)
})

it('reads a save from before lands and animals were kept as the meadow', () => {
  localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify([...createWorld().blocks()]))
  expect(snapshot(readGame()!)).toEqual(snapshot({ world: createWorld(), biome: 'meadow', wheat: 0, herd: spawnHerd(createWorld(), biome('meadow').animals), seed: 0 }))
  localStorage.setItem(EXTRA_KEY, '{broken')
  expect(readGame()?.biome).toBe('meadow')
  localStorage.removeItem(LEGACY_SAVE_KEY)
  expect(readGame()).toBeNull()
})

it('falls back for each broken field without losing the others', () => {
  const world = createWorld()
  expect(decodeExtra(JSON.stringify({ biome: 'island', wheat: -1, herd: 'oops' }), world)).toEqual({ biome: 'island', wheat: 0, herd: spawnHerd(world, biome('island').animals), seed: 0 })
  expect(decodeExtra(JSON.stringify({ biome: 'moon', wheat: MAX_WHEAT + 5, herd: [] }), world)).toEqual({ biome: 'meadow', wheat: MAX_WHEAT, herd: [], seed: 0 })
  expect(decodeExtra(JSON.stringify({ herd: herdFrom(ANIMAL_SPAWNS) }), world).herd).toEqual(herdFrom(ANIMAL_SPAWNS))
  expect(decodeExtra('7', world).biome).toBe('meadow')
})

it('keeps collected wool colors in order, ignoring unknown ones and storage failures', () => {
  expect(readWool()).toEqual([])
  writeWool(['blue', 'pink'])
  expect(readWool()).toEqual(['pink', 'blue'])
  localStorage.setItem(WOOL_KEY, JSON.stringify(['gold', 'white']))
  expect(readWool()).toEqual(['white'])
  localStorage.setItem(WOOL_KEY, '{')
  expect(readWool()).toEqual([])
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
  expect(() => { writeWool(['white']); writeGame(newGame('meadow')) }).not.toThrow()
})
it('migrates the 12-wide v1 pair on save and recovers it if v2 is unreadable', () => {
  const legacy: Block[] = []
  for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) legacy.push({ x, y: 0, z, material: 'stone' })
  legacy.push({ x: 3, y: 1, z: 5, material: 'glass' })
  const extra = { biome: 'snow', wheat: 7, herd: [{ kind: 'rabbit', x: 11, z: 11, id: 0 }] }
  localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify(legacy))
  localStorage.setItem(EXTRA_KEY, JSON.stringify(extra))
  const game = readGame()!
  expect(game).toMatchObject(extra)
  expect(game.world.size).toBe(16)
  expect(game.world.materialAt(legacy.at(-1)!)).toBe('glass')
  expect(game.world.materialAt({ x: 15, y: 2, z: 15 })).toBe('grass')
  expect(writeGame(game)).toBe(true)
  expect(snapshot(readGame()!)).toEqual(snapshot(game))
  expect(localStorage.getItem(LEGACY_SAVE_KEY)).toBe(JSON.stringify(legacy))
  localStorage.setItem(SAVE_KEY, '{broken')
  expect(snapshot(readGame()!)).toEqual(snapshot(game))
})

it('keeps the previous whole record when validation or the single write fails', () => {
  const before = { ...newGame('meadow'), wheat: 8 }
  expect(writeGame(before)).toBe(true)
  const raw = localStorage.getItem(SAVE_KEY)
  const after = { ...newGame('snow'), wheat: 13 }
  const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
  expect(writeGame(after)).toBe(false)
  expect(setItem).toHaveBeenCalledOnce()
  expect(setItem).toHaveBeenCalledWith(SAVE_KEY, expect.any(String))
  expect(localStorage.getItem(SAVE_KEY)).toBe(raw)
  expect(snapshot(readGame()!)).toEqual(snapshot(before))
  setItem.mockClear()
  expect(writeGame({ ...after, wheat: -1 })).toBe(false)
  expect(setItem).not.toHaveBeenCalled()
})

it('rejects unknown palettes, nonmatching dimensions, truncated, zero and overflowing runs', () => {
  const valid = JSON.parse(encodeGame(newGame('meadow')))
  expect(valid.encoding).toBe('rle')
  for (const patch of [
    { size: 129 }, { height: 65 }, { size: 64 }, { height: '12' },
    { palette: ['unknown'] }, { palette: ['stone', 'stone'] },
    { cells: btoa(String.fromCharCode(1, 0, 0)) }, { cells: btoa(String.fromCharCode(1, 255, 255)) },
    { cells: btoa(String.fromCharCode(1, 1)) }, { cells: btoa(String.fromCharCode(255, 1, 0)) },
    { cells: btoa(String.fromCharCode(0, 0, 12)) }, // complete but empty floor
    { cells: '!%*' }, { herd: [{ id: 0, kind: 'rabbit', x: valid.size, z: 0 }] },
  ]) expect(decodeGame(JSON.stringify({ ...valid, ...patch })), JSON.stringify(patch)).toBeNull()
})

it.each(['meadow', 'desert', 'snow', 'island', 'sky', 'castle'] as const)('round trips a large %s build and farm together', biome => {
  const game = { ...newGame(biome, { size: 64, height: 24 }), wheat: 11 }
  const { world } = game
  const y = world.topY(62, 62) + 1
  const edits = editWorld(world, { x: 62, y, z: 62 }, 'brick', 'place')
  expect(edits).toHaveLength(1)
  game.herd = [...game.herd, { id: 20, kind: 'sheep', x: 62, z: 62, wool: 'yellow', baby: true }]
  const raw = encodeGame(game)
  expect(raw.length).toBeLessThan(JSON.stringify([...world.blocks()]).length / 10)
  expect(snapshot(decodeGame(raw)!)).toEqual(snapshot(game))
  expect(snapshot(decodeGame(JSON.stringify({ version: 2, ...encodeGrid(world, 'columns'), biome, wheat: game.wheat, herd: game.herd, seed: game.seed }))!)).toEqual(snapshot(game))
})

it('stores dense seeded random material layouts with the bounded byte fallback', () => {
  let seed = 72
  const dims = { size: 64, height: 12 }
  function* blocks(): IterableIterator<Block> {
    for (let y = 0; y < dims.height; y++) for (let z = 0; z < dims.size; z++) for (let x = 0; x < dims.size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      yield { x, y, z, material: MATERIALS[(seed >>> 16) % MATERIALS.length].id }
    }
  }
  const game = { ...newGame('meadow', dims), world: new World(dims, blocks()) }
  const raw = encodeGame(game)
  expect(JSON.parse(raw).encoding).toBe('bytes')
  expect(raw.length).toBeLessThan(70_000)
  expect(snapshot(decodeGame(raw)!)).toEqual(snapshot(game))
})
