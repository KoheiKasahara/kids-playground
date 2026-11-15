import { describe, expect, it } from 'vitest'
import { createMapTown, MAPS, STAMP_LEFT, STAMP_TOP } from './maps'
import { clearSlot, LEGACY_SAVE_KEY, legacySlotOf, migrateLegacySave, readAllSlots, readSlot, slotKey, writeSlot, type SaveStore } from './saves'
import { applyTool, COLS, encodeTown } from './town'
import { createWorld } from './worlds'

function memoryStore(initial: Record<string, string> = {}): SaveStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
    removeItem: (key) => { data.delete(key) },
  }
}

/** 14×14 の なかの ばしょを、ひろい ちずの ばんごうに する。 */
const inStamp = (col: number, row: number) => (STAMP_TOP + row) * COLS + STAMP_LEFT + col

/** ちずを えらべなかった ころの ほぞん（14×14 で おおきさの ない version 1）。 */
function legacySave(): string {
  const tiles = Array.from({ length: 14 * 14 }, () => 'g')
  tiles[3] = 'g:castle'
  return JSON.stringify({ version: 1, cols: 14, rows: 14, tiles })
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

  it('moves the old 14×14 single save into the middle of the starter town once, without losing it', () => {
    const store = memoryStore({ [LEGACY_SAVE_KEY]: legacySave() })
    migrateLegacySave(store)
    expect(store.data.has(LEGACY_SAVE_KEY)).toBe(false)
    const starter = readSlot('starter', store)
    expect(starter?.[inStamp(3, 0)]).toEqual({ ground: 'grass', part: 'castle' })
    // まわりは はじめの まちの まわりの まま。
    expect(starter?.[0]).toEqual(createMapTown('starter')[0])
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

  it('moves the old wide single save (the river world of that time) into the river world', () => {
    const town = applyTool(createWorld('river', 5), 10, 'castle')
    // ひろい ちずの ころの ほぞん（「*かず」で まとめた version 2）。
    const raw = encodeTown(town).replace('"version":3', '"version":2')
    expect(legacySlotOf(raw)).toBe('world-river')
    expect(legacySlotOf(legacySave())).toBe('starter')
    const store = memoryStore({ [LEGACY_SAVE_KEY]: raw })
    migrateLegacySave(store)
    expect(readSlot('world-river', store)).toEqual(town)
    expect(readSlot('starter', store)).toBeNull()
  })

  it('reads a 14×14 map save with big buildings and old part names, placing it in the middle of that map', () => {
    // ひろい ちずに なる まえの ちずごとの ほぞん（ひだりうえ・おおきさ つきの version 2）。
    const tiles = Array.from({ length: 14 * 14 }, () => 'g')
    for (const cell of [15, 16, 29, 30]) tiles[cell] = 'g:house:15:2'
    tiles[0] = 'g:camp'
    const store = memoryStore({ [slotKey('seaside')]: JSON.stringify({ version: 2, cols: 14, rows: 14, tiles }) })
    const town = readSlot('seaside', store)!
    expect(town[inStamp(1, 1)]).toEqual({ ground: 'grass', part: 'house', anchor: inStamp(1, 1), scale: 2 })
    expect(town[inStamp(2, 2)]).toEqual({ ground: 'grass', part: 'house', anchor: inStamp(1, 1), scale: 2 })
    // まえの「キャンプ」は いまの「テント」。
    expect(town[inStamp(0, 0)]).toEqual({ ground: 'grass', part: 'tent' })
    // まわりは うみべの まちの まわり（みなみは うみ）。
    expect(town.at(-1)).toEqual(createMapTown('seaside').at(-1))
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
