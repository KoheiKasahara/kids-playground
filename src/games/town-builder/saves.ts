import { MAPS, type MapId } from './maps'
import { decodeTown, encodeTown, type Town } from './town'

// ちずごとの ほぞん。ブラウザの localStorage に ちず 1つ ぶんずつ いれる。
// まえの 1つ だけの ほぞん（v1）は「はじめの まち」の つづきとして うけつぐ。

export type SaveStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** まえの ほぞん（ちずを えらべなかった ころ）。 */
export const LEGACY_SAVE_KEY = 'kids-playground:town-builder:v1'
const SLOT_PREFIX = 'kids-playground:town-builder:v2:'

export function slotKey(id: MapId): string {
  return `${SLOT_PREFIX}${id}`
}

function storage(): SaveStore | null {
  try { return window.localStorage } catch { return null }
}

/** まえの ほぞんが あり、はじめの まちの つづきが まだ なければ うつす。うつせたら まえの ほぞんは けす。 */
export function migrateLegacySave(store: SaveStore | null = storage()): void {
  if (!store) return
  try {
    const legacy = store.getItem(LEGACY_SAVE_KEY)
    if (legacy === null) return
    const town = decodeTown(legacy)
    if (town && store.getItem(slotKey('starter')) === null) store.setItem(slotKey('starter'), encodeTown(town))
    store.removeItem(LEGACY_SAVE_KEY)
  } catch {
    // ほぞん できない ときは つぎに ひらいた とき もういちど ためす。
  }
}

/** ほぞんした つづき。ない・こわれて いる ときは null。 */
export function readSlot(id: MapId, store: SaveStore | null = storage()): Town | null {
  try { return decodeTown(store?.getItem(slotKey(id)) ?? null) } catch { return null }
}

/** ほぞん できたら true。 */
export function writeSlot(id: MapId, town: Town, store: SaveStore | null = storage()): boolean {
  if (!store) return false
  try { store.setItem(slotKey(id), encodeTown(town)); return true } catch { return false }
}

/** さいしょから やりなおす ときに つづきを けす。 */
export function clearSlot(id: MapId, store: SaveStore | null = storage()): boolean {
  if (!store) return false
  try { store.removeItem(slotKey(id)); return true } catch { return false }
}

/** ぜんぶの ちずの つづき（ない ちずは null）。 */
export function readAllSlots(store: SaveStore | null = storage()): Record<MapId, Town | null> {
  return Object.fromEntries(MAPS.map((map) => [map.id, readSlot(map.id, store)])) as Record<MapId, Town | null>
}
