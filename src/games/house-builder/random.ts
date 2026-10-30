// おまかせで おうちを つくる。いえの しゅるい・かたち・まどり・そとがわを ばらばらに きめる。
// rand を わたせば おなじ おうちを つくれるので、そのまま テストできる。

import {
  DOGHOUSES, DOORS, EXTERIOR_STYLES, EXTRAS, GARDENS, HOUSE_TYPES, PARKINGS, POOLS, ROOFS, ROOM_SIZES, SHAPES, WALLS, WINDOWS,
  findRoomType, findShape,
  type Exterior, type RoomSizeId, type RoomTypeId,
} from './data'
import { createDesign, fits, floorCount, frontEdge, roomSize, type HouseDesign, type PlacedRoom } from './plan'

export type Rand = () => number

const pickOne = <T>(rand: Rand, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rand() * list.length))]

function shuffle<T>(rand: Rand, list: readonly T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** かならず おきたい へや。おく じゅんばんが ゆうせんど。 */
const GROUND_ROOMS: readonly RoomTypeId[] = ['entrance', 'living', 'kitchen', 'bath', 'toilet', 'washroom', 'dining']
const UPPER_ROOMS: readonly RoomTypeId[] = ['bedroom', 'kids', 'toilet']
/** あいている ところに ふやす へや。 */
const EXTRA_ROOMS: readonly RoomTypeId[] = ['bedroom', 'kids', 'washitsu', 'hall', 'toilet', 'washroom', 'living',
  'library', 'music', 'art', 'playroom', 'pet', 'laundry', 'closet', 'plants']
const EXTRA_TRIES = 6

type Spot = Pick<PlacedRoom, 'size' | 'turned' | 'x' | 'y'>

/** その へやが おける ところを ぜんぶ さがし、ひとつ えらぶ。おおきさ・むきも ばらばらに ためす。 */
function randomSpot(design: HouseDesign, floors: readonly number[], type: RoomTypeId, rand: Rand, frontOnly = false): Spot | null {
  const shape = findShape(design.shape)
  const front = frontEdge(shape)
  for (const size of shuffle<RoomSizeId>(rand, ROOM_SIZES.map((s) => s.id))) {
    for (const turned of shuffle(rand, [false, true])) {
      const { w, h } = roomSize({ type, size, turned })
      if (turned && w === h) continue
      const spots: Spot[] = []
      for (let y = 0; y + h <= shape.height; y++) {
        for (let x = 0; x + w <= shape.width; x++) {
          if (frontOnly && !Array.from({ length: w }, (_, i) => front[x + i] === y + h).some(Boolean)) continue
          const room = { type, style: '', size, turned, x, y }
          if (floors.every((floor) => fits(design, { ...room, floor }))) spots.push({ size, turned, x, y })
        }
      }
      if (spots.length > 0) return pickOne(rand, spots)
    }
  }
  return null
}

/** へやを おく。おけなければ そのまま かえす。 */
function place(design: HouseDesign, floors: readonly number[], type: RoomTypeId, rand: Rand, frontOnly = false): HouseDesign {
  const spot = randomSpot(design, floors, type, rand, frontOnly)
  if (!spot) return design
  const style = pickOne(rand, findRoomType(type).styles).id
  let id = design.rooms.reduce((max, room) => Math.max(max, room.id), 0)
  const rooms = floors.map((floor): PlacedRoom => ({ id: ++id, floor, type, style, ...spot }))
  return { ...design, rooms: [...design.rooms, ...rooms] }
}

export function randomExterior(rand: Rand): Exterior {
  // はんぶんは おうちセットの くみあわせ、はんぶんは ぜんぶ ばらばら。
  const facade = rand() < 0.5
    ? pickOne(rand, EXTERIOR_STYLES).facade
    : { wall: pickOne(rand, WALLS).id, roof: pickOne(rand, ROOFS).id, window: pickOne(rand, WINDOWS).id, door: pickOne(rand, DOORS).id }
  return {
    ...facade,
    parking: pickOne(rand, PARKINGS).id,
    doghouse: pickOne(rand, DOGHOUSES).id,
    garden: pickOne(rand, GARDENS).id,
    pool: pickOne(rand, POOLS).id,
    extras: EXTRAS.filter(() => rand() < 0.3).map((e) => e.id),
  }
}

/** おまかせの おうち。かいだんは どの かいも おなじ ところに おき、げんかんは 1かいの おもてに おく。 */
export function randomDesign(rand: Rand = Math.random): HouseDesign {
  let design = createDesign(pickOne(rand, HOUSE_TYPES).id, pickOne(rand, SHAPES).id)
  const floors = Array.from({ length: floorCount(design) }, (_, i) => i)
  if (floors.length > 1) design = place(design, floors, 'stairs', rand)
  design = place(design, [0], 'entrance', rand, true)
  for (const floor of floors) {
    const must = floor === 0 ? GROUND_ROOMS.slice(1) : UPPER_ROOMS
    for (const type of must) design = place(design, [floor], type, rand)
    for (let i = 0; i < EXTRA_TRIES; i++) design = place(design, [floor], pickOne(rand, EXTRA_ROOMS), rand)
  }
  return { ...design, exterior: randomExterior(rand) }
}
