// まどりの ロジック。へやを おく・うごかす・けす、はみだし や かさなりの チェック、
// そとから みた ときの まどと ドアの いち を きめる。画面を もたないので そのまま テストできる。

import {
  DEFAULT_EXTERIOR, findHouseType, findRoomType, findShape,
  type Exterior, type HouseTypeId, type RoomSizeId, type RoomTypeId, type Shape, type ShapeId,
} from './data'

export type PlacedRoom = {
  id: number
  /** 0 が 1かい。 */
  floor: number
  type: RoomTypeId
  style: string
  size: RoomSizeId
  /** たて よこを いれかえた か。 */
  turned: boolean
  x: number
  y: number
}

/** へやの しゅるい・みため・おおきさ・むき（おく まえの えらんだ もの）。 */
export type RoomPick = Pick<PlacedRoom, 'type' | 'style' | 'size' | 'turned'>

export type HouseDesign = {
  houseType: HouseTypeId
  shape: ShapeId
  rooms: readonly PlacedRoom[]
  exterior: Exterior
}

export type Cell = { x: number; y: number }

export function createDesign(houseType: HouseTypeId, shape: ShapeId): HouseDesign {
  return { houseType, shape, rooms: [], exterior: DEFAULT_EXTERIOR }
}

export const floorCount = (design: Pick<HouseDesign, 'houseType'>) => findHouseType(design.houseType).floors

export function roomSize(pick: Pick<PlacedRoom, 'type' | 'size' | 'turned'>): { w: number; h: number } {
  const [w, h] = findRoomType(pick.type).sizes[pick.size]
  return pick.turned ? { w: h, h: w } : { w, h }
}

export const isFloorCell = (shape: Shape, x: number, y: number) => shape.mask[y]?.[x] === true

export const roomsOn = (design: HouseDesign, floor: number) => design.rooms.filter((room) => room.floor === floor)

export function roomAt(design: HouseDesign, floor: number, x: number, y: number): PlacedRoom | undefined {
  return design.rooms.find((room) => {
    if (room.floor !== floor) return false
    const { w, h } = roomSize(room)
    return x >= room.x && x < room.x + w && y >= room.y && y < room.y + h
  })
}

/** ゆかの うえに おさまって、ほかの へやと かさならない か。 */
export function fits(design: HouseDesign, room: Omit<PlacedRoom, 'id'> & { id?: number }): boolean {
  const shape = findShape(design.shape)
  if (room.floor < 0 || room.floor >= floorCount(design)) return false
  const { w, h } = roomSize(room)
  for (let y = room.y; y < room.y + h; y++) {
    for (let x = room.x; x < room.x + w; x++) {
      if (!isFloorCell(shape, x, y)) return false
      const other = roomAt(design, room.floor, x, y)
      if (other && other.id !== room.id) return false
    }
  }
  return true
}

/**
 * タップした マスを ふくむ おきばしょの うち、へやの まんなかが いちばん ちかい ところ。
 * はみだす・かさなる ときは その マスを ふくむ ほかの おきかたを さがし、どこにも はいらなければ null。
 */
export function findSpot(design: HouseDesign, floor: number, pick: RoomPick, at: Cell, ignoreId?: number): Cell | null {
  const { w, h } = roomSize(pick)
  let best: Cell | null = null
  let bestScore = Infinity
  for (let y = at.y - h + 1; y <= at.y; y++) {
    for (let x = at.x - w + 1; x <= at.x; x++) {
      if (!fits(design, { ...pick, id: ignoreId, floor, x, y })) continue
      const score = Math.hypot(x + w / 2 - (at.x + 0.5), y + h / 2 - (at.y + 0.5))
      if (score < bestScore - 1e-9) {
        best = { x, y }
        bestScore = score
      }
    }
  }
  return best
}

const nextId = (design: HouseDesign) => design.rooms.reduce((max, room) => Math.max(max, room.id), 0) + 1

export function addRoom(design: HouseDesign, floor: number, pick: RoomPick, at: Cell): { design: HouseDesign; room: PlacedRoom } | null {
  const spot = findSpot(design, floor, pick, at)
  if (!spot) return null
  const room: PlacedRoom = { id: nextId(design), floor, ...pick, ...spot }
  return { design: { ...design, rooms: [...design.rooms, room] }, room }
}

/** へやの なかで まんなかに いちばん ちかい マス。おおきさを かえるときは ここを ふくむように おきなおす。 */
export function roomCenterCell(room: PlacedRoom): Cell {
  const { w, h } = roomSize(room)
  return { x: room.x + Math.floor((w - 1) / 2), y: room.y + Math.floor((h - 1) / 2) }
}

/** みため・おおきさ・むきを かえる。はいらない ときは null。 */
export function changeRoom(design: HouseDesign, id: number, patch: Partial<RoomPick>): HouseDesign | null {
  const room = design.rooms.find((r) => r.id === id)
  if (!room) return null
  const next = { ...room, ...patch }
  if (patch.type && patch.type !== room.type && !patch.style) next.style = findRoomType(patch.type).styles[0].id
  const same = roomSize(next)
  const before = roomSize(room)
  let spot: Cell | null = { x: room.x, y: room.y }
  if (same.w !== before.w || same.h !== before.h) spot = findSpot(design, room.floor, next, roomCenterCell(room), id)
  if (!spot) return null
  const placed = { ...next, ...spot }
  return { ...design, rooms: design.rooms.map((r) => (r.id === id ? placed : r)) }
}

/** へやを ひっぱって うごかす。to は へやの ひだりうえの マス。はみだす・かさなる ときは null。 */
export function moveRoom(design: HouseDesign, id: number, to: Cell): HouseDesign | null {
  const room = design.rooms.find((r) => r.id === id)
  if (!room) return null
  const moved = { ...room, ...to }
  if (!fits(design, moved)) return null
  return { ...design, rooms: design.rooms.map((r) => (r.id === id ? moved : r)) }
}

export function removeRoom(design: HouseDesign, id: number): HouseDesign {
  return { ...design, rooms: design.rooms.filter((room) => room.id !== id) }
}

export function clearFloor(design: HouseDesign, floor: number): HouseDesign {
  return { ...design, rooms: design.rooms.filter((room) => room.floor !== floor) }
}

/** いえの しゅるい や かたちを かえる。そのまま おける へやは のこし、はいらない へやは かたづける。 */
export function reshape(design: HouseDesign, houseType: HouseTypeId, shape: ShapeId): HouseDesign {
  let next: HouseDesign = { ...design, houseType, shape, rooms: [] }
  for (const room of design.rooms) {
    if (fits(next, room)) next = { ...next, rooms: [...next.rooms, room] }
  }
  return next
}

/** その かいに おいた へやの かず。 */
export const roomCounts = (design: HouseDesign) =>
  Array.from({ length: floorCount(design) }, (_, floor) => roomsOn(design, floor).length)

// ---------------- そとから みた まど と ドア ----------------

/** れつ ごとの いちばん おもて（した）の ゆかの つぎの ぎょう。ゆかが ない れつは 0。 */
export function frontEdge(shape: Shape): number[] {
  return Array.from({ length: shape.width }, (_, x) => {
    for (let y = shape.height - 1; y >= 0; y--) if (shape.mask[y][x]) return y + 1
    return 0
  })
}

export type OpeningKind = 'door' | 'big' | 'window' | 'small' | 'slim'

/** おもての かべに あける まど・ドア。center と span は れつ（マス）の たんい。 */
export type Opening = { kind: OpeningKind; center: number; span: number; roomId?: number }

export const OPENING_BY_ROOM: Readonly<Record<RoomTypeId, OpeningKind>> = {
  living: 'big', dining: 'big', kitchen: 'window', bath: 'small', toilet: 'small', washroom: 'small',
  bedroom: 'window', kids: 'window', washitsu: 'big', entrance: 'door', stairs: 'slim', hall: 'slim',
}

/**
 * おもてに めんした へやに あわせて まどを あける（おふろ・トイレは ちいさい まど、リビングは おおきな まど）。
 * 1かいの げんかんは ドアに なる。げんかんが なければ まんなかに ドアを つける。
 */
export function facadeOpenings(design: HouseDesign, floor: number): Opening[] {
  const shape = findShape(design.shape)
  const front = frontEdge(shape)
  const openings: Opening[] = []
  for (const room of roomsOn(design, floor)) {
    const { w, h } = roomSize(room)
    const touching: number[] = []
    for (let x = room.x; x < room.x + w; x++) if (room.y + h === front[x]) touching.push(x)
    if (touching.length === 0) continue
    const from = touching[0]
    const to = touching[touching.length - 1] + 1
    let kind = OPENING_BY_ROOM[room.type]
    if (kind === 'door' && floor > 0) kind = 'window'
    if (kind === 'big' && to - from < 2) kind = 'window'
    openings.push({ kind, center: (from + to) / 2, span: to - from, roomId: room.id })
  }
  if (openings.length === 0) {
    const n = Math.max(1, Math.floor(shape.width / 3))
    for (let i = 0; i < n; i++) openings.push({ kind: 'window', center: ((i + 0.5) * shape.width) / n, span: 1 })
  }
  if (floor === 0 && !openings.some((o) => o.kind === 'door')) {
    // まどの ない れつの うち まんなかに ちかい ところ。どこも まどなら まんなかの まどと いれかえる。
    const overlaps = (o: Opening, center: number) => Math.abs(o.center - center) < (o.span + 1) / 2 - 1e-9
    const columns = Array.from({ length: shape.width }, (_, x) => x + 0.5)
      .filter((center) => front[Math.floor(center)] > 0)
      .sort((a, b) => Math.abs(a - shape.width / 2) - Math.abs(b - shape.width / 2) || a - b)
    const center = columns.find((c) => !openings.some((o) => overlaps(o, c))) ?? columns[0] ?? shape.width / 2
    const door: Opening = { kind: 'door', center, span: 1 }
    return [...openings.filter((o) => !overlaps(o, center)), door].sort((a, b) => a.center - b.center)
  }
  return openings.sort((a, b) => a.center - b.center)
}
