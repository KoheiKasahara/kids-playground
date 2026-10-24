// つくりかけの おうちを ブラウザに ほぞんする。ほぞん できなくても（プライベートモードなど）その ばで あそべる。

import {
  DEFAULT_EXTERIOR, DOGHOUSES, DOORS, EXTRAS, GARDENS, HOUSE_TYPES, PARKINGS, POOLS, ROOFS, ROOM_SIZES, ROOM_TYPES, SHAPES, WALLS, WINDOWS,
  type Exterior, type ExteriorOption,
} from './data'
import { createDesign, fits, type HouseDesign, type PlacedRoom } from './plan'

const KEY = 'house-builder-v1'

const pickId = <Id extends string>(options: readonly ExteriorOption<Id>[], value: unknown, fallback: Id): Id =>
  options.find((o) => o.id === value)?.id ?? fallback

function parseExterior(data: unknown): Exterior {
  if (!data || typeof data !== 'object') return DEFAULT_EXTERIOR
  const v = data as Record<string, unknown>
  const d = DEFAULT_EXTERIOR
  return {
    wall: pickId(WALLS, v.wall, d.wall),
    roof: pickId(ROOFS, v.roof, d.roof),
    window: pickId(WINDOWS, v.window, d.window),
    door: pickId(DOORS, v.door, d.door),
    parking: pickId(PARKINGS, v.parking, d.parking),
    doghouse: pickId(DOGHOUSES, v.doghouse, d.doghouse),
    garden: pickId(GARDENS, v.garden, d.garden),
    pool: pickId(POOLS, v.pool, d.pool),
    extras: Array.isArray(v.extras) ? EXTRAS.filter((e) => v.extras && (v.extras as unknown[]).includes(e.id)).map((e) => e.id) : [],
  }
}

const isInt = (v: unknown): v is number => Number.isInteger(v)

function parseRoom(data: unknown): PlacedRoom | null {
  if (!data || typeof data !== 'object') return null
  const v = data as Record<string, unknown>
  const type = ROOM_TYPES.find((t) => t.id === v.type)
  if (!type || !isInt(v.id) || !isInt(v.floor) || !isInt(v.x) || !isInt(v.y)) return null
  const style = type.styles.find((s) => s.id === v.style) ?? type.styles[0]
  const size = ROOM_SIZES.find((s) => s.id === v.size)?.id ?? 'm'
  return { id: v.id, floor: v.floor, type: type.id, style: style.id, size, turned: v.turned === true, x: v.x, y: v.y }
}

/** ほぞんした ものを もどす。おかしな ところは すてて、つかえる ものだけ のこす。 */
export function parseDesign(data: unknown): HouseDesign | null {
  if (!data || typeof data !== 'object') return null
  const v = data as Record<string, unknown>
  const houseType = HOUSE_TYPES.find((t) => t.id === v.houseType)?.id
  const shape = SHAPES.find((s) => s.id === v.shape)?.id
  if (!houseType || !shape) return null
  let design: HouseDesign = { ...createDesign(houseType, shape), exterior: parseExterior(v.exterior) }
  const seen = new Set<number>()
  for (const raw of Array.isArray(v.rooms) ? v.rooms : []) {
    const room = parseRoom(raw)
    if (!room || seen.has(room.id) || !fits(design, room)) continue
    seen.add(room.id)
    design = { ...design, rooms: [...design.rooms, room] }
  }
  return design
}

/** つくりかけの おうちと、それが どの ほぞんした おうちから きたか。 */
export type Draft = { design: HouseDesign; savedId: number | null }

export function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const data: unknown = JSON.parse(raw)
    const design = parseDesign(data)
    if (!design) return null
    const savedId = (data as Record<string, unknown>).savedId
    return { design, savedId: isInt(savedId) ? savedId : null }
  } catch {
    return null
  }
}

/** ほぞん できたら true。できない ブラウザでも その ばで あそべる ように、なげずに false を かえす。 */
export function writeDraft(draft: Draft | null): boolean {
  try {
    if (draft) window.localStorage.setItem(KEY, JSON.stringify({ ...draft.design, savedId: draft.savedId }))
    else window.localStorage.removeItem(KEY)
    return true
  } catch {
    return false
  }
}

// ---------------- ほぞんした おうち ----------------

const ALBUM_KEY = 'house-builder-album-v1'

/** ほぞん できる おうちの かず。 */
export const ALBUM_LIMIT = 6

export type SavedHouse = { id: number; savedAt: number; design: HouseDesign }

/** ほぞんした おうちの いちらんを もどす。こわれた ものや かぶった ものは すてる。 */
export function parseAlbum(data: unknown): SavedHouse[] {
  if (!Array.isArray(data)) return []
  const album: SavedHouse[] = []
  for (const raw of data) {
    if (album.length >= ALBUM_LIMIT) break
    if (!raw || typeof raw !== 'object') continue
    const v = raw as Record<string, unknown>
    const design = parseDesign(v.design)
    if (!design || !isInt(v.id) || album.some((h) => h.id === v.id)) continue
    album.push({ id: v.id, savedAt: typeof v.savedAt === 'number' && Number.isFinite(v.savedAt) ? v.savedAt : 0, design })
  }
  return album
}

export function readAlbum(): SavedHouse[] {
  try {
    const raw = window.localStorage.getItem(ALBUM_KEY)
    return raw ? parseAlbum(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

/** ほぞん できたら true。できない ブラウザでは false を かえす。 */
export function writeAlbum(album: readonly SavedHouse[]): boolean {
  try {
    window.localStorage.setItem(ALBUM_KEY, JSON.stringify(album))
    return true
  } catch {
    return false
  }
}

/**
 * おうちを いちらんに いれる。id の おうちが あれば そこを うわがきし、なければ あたらしく ふやす。
 * いっぱいで ふやせない ときは null。
 */
export function putHouse(album: readonly SavedHouse[], design: HouseDesign, id: number | null, savedAt: number): { album: SavedHouse[]; id: number } | null {
  if (id !== null && album.some((h) => h.id === id)) {
    return { album: album.map((h) => (h.id === id ? { id, savedAt, design } : h)), id }
  }
  if (album.length >= ALBUM_LIMIT) return null
  const next = Math.max(0, ...album.map((h) => h.id)) + 1
  return { album: [...album, { id: next, savedAt, design }], id: next }
}

export function removeHouse(album: readonly SavedHouse[], id: number): SavedHouse[] {
  return album.filter((h) => h.id !== id)
}

/** ならびじゅんの ちがいに まどわされない ように、もどす ときと おなじ かたちに そろえて くらべる。 */
const canonical = (design: HouseDesign) => JSON.stringify(parseDesign(JSON.parse(JSON.stringify(design))))

/** ほぞんした ときから かわって いないか。 */
export function sameDesign(a: HouseDesign, b: HouseDesign): boolean {
  return canonical(a) === canonical(b)
}
