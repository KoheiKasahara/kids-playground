import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { herdFrom } from './animals'
import { biome } from './biomes'
import { decodeExtra, EXTRA_KEY, MAX_WHEAT, newGame, readGame, readWool, WOOL_KEY, writeGame, writeWool } from './save'
import { createWorld, SAVE_KEY } from './world'

const store = new Map<string, string>()
const localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
  removeItem: (key: string) => { store.delete(key) },
}
beforeEach(() => { store.clear(); vi.stubGlobal('localStorage', localStorage) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('saves and reads back the world with its land, wheat and animals', () => {
  const game = { ...newGame('snow'), wheat: 4 }
  writeGame(game)
  expect(readGame()).toEqual(game)
})

it('reads a save from before lands and animals were kept as the meadow', () => {
  localStorage.setItem(SAVE_KEY, JSON.stringify(createWorld()))
  expect(readGame()).toEqual({ world: createWorld(), biome: 'meadow', wheat: 0, herd: herdFrom(biome('meadow').spawns) })
  localStorage.setItem(EXTRA_KEY, '{broken')
  expect(readGame()?.biome).toBe('meadow')
  localStorage.removeItem(SAVE_KEY)
  expect(readGame()).toBeNull()
})

it('falls back for each broken field without losing the others', () => {
  expect(decodeExtra(JSON.stringify({ biome: 'island', wheat: -1, herd: 'oops' }))).toEqual({ biome: 'island', wheat: 0, herd: herdFrom(biome('island').spawns) })
  expect(decodeExtra(JSON.stringify({ biome: 'moon', wheat: MAX_WHEAT + 5, herd: [] }))).toEqual({ biome: 'meadow', wheat: MAX_WHEAT, herd: [] })
  expect(decodeExtra('7').biome).toBe('meadow')
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
