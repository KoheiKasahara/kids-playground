import { describe, expect, it } from 'vitest'
import { createMapTown, MAPS } from './maps'
import { clearSlot, LEGACY_SAVE_KEY, migrateLegacySave, readAllSlots, readSlot, writeSlot, type SaveStore } from './saves'
import { applyTool, COLS, createEmptyTown, encodeTile, ROWS } from './town'

function memoryStore(initial: Record<string, string> = {}): SaveStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
    removeItem: (key) => { data.delete(key) },
  }
}

/** ちずを えらべなかった ころの ほぞん（おおきさの ない version 1）。 */
function legacySave(): string {
  const town = applyTool(createEmptyTown(), 3, 'castle')
  return JSON.stringify({ version: 1, cols: COLS, rows: ROWS, tiles: town.map(encodeTile) })
}

describe('saves', () => {
  it('keeps one save per map and reports which maps have a saved town', () => {
    const store = memoryStore()
    expect(Object.values(readAllSlots(store)).every((town) => town === null)).toBe(true)
    const seaside = applyTool(createMapTown('seaside'), 0, 'house', 2)
    expect(writeSlot('seaside', seaside, store)).toBe(true)
    expect(readSlot('seaside', store)).toEqual(seaside)
    expect(readSlot('starter', store)).toBeNull()
    const slots = readAllSlots(store)
    expect(Object.keys(slots).sort()).toEqual(MAPS.map((map) => map.id).sort())
    expect(slots.seaside).toEqual(seaside)
    expect(clearSlot('seaside', store)).toBe(true)
    expect(readSlot('seaside', store)).toBeNull()
  })

  it('moves the old single save into the starter town once, without losing it', () => {
    const store = memoryStore({ [LEGACY_SAVE_KEY]: legacySave() })
    migrateLegacySave(store)
    expect(store.data.has(LEGACY_SAVE_KEY)).toBe(false)
    expect(readSlot('starter', store)?.[3]).toEqual({ ground: 'grass', part: 'castle' })
    expect(readSlot('island', store)).toBeNull()

    // すでに あたらしい ほぞんが ある ときは うわがき しない。
    const newer = applyTool(createMapTown('starter'), 0, 'tower')
    const both = memoryStore({ [LEGACY_SAVE_KEY]: legacySave() })
    writeSlot('starter', newer, both)
    migrateLegacySave(both)
    expect(readSlot('starter', both)).toEqual(newer)
    // こわれた むかしの ほぞんは すてる。
    const broken = memoryStore({ [LEGACY_SAVE_KEY]: '{broken' })
    migrateLegacySave(broken)
    expect(broken.data.size).toBe(0)
  })

  it('treats a storage that throws or is missing as "not saved"', () => {
    const failing: SaveStore = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('quota') },
      removeItem: () => { throw new Error('blocked') },
    }
    expect(readSlot('starter', failing)).toBeNull()
    expect(writeSlot('starter', createMapTown('starter'), failing)).toBe(false)
    expect(clearSlot('starter', failing)).toBe(false)
    expect(() => migrateLegacySave(failing)).not.toThrow()
    expect(writeSlot('starter', createMapTown('starter'), null)).toBe(false)
    expect(readSlot('starter', null)).toBeNull()
  })
})
