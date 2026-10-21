// つくりかけの おうちを ブラウザに ほぞんする。ほぞん できなくても（プライベートモードなど）その ばで あそべる。

import {
  DEFAULT_EXTERIOR, DOGHOUSES, DOORS, EXTRAS, GARDENS, HOUSE_TYPES, PARKINGS, ROOFS, ROOM_SIZES, ROOM_TYPES, SHAPES, WALLS, WINDOWS,
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

export function readDesign(): HouseDesign | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? parseDesign(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function writeDesign(design: HouseDesign | null): void {
  try {
    if (design) window.localStorage.setItem(KEY, JSON.stringify(design))
    else window.localStorage.removeItem(KEY)
  } catch {
    // ほぞん できなくても その ばで あそべる。
  }
}
