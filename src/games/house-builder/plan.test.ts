import { describe, expect, test } from 'vitest'
import { SHAPES } from './data'
import {
  addRoom, changeRoom, clearFloor, createDesign, facadeOpenings, findSpot, fits, frontEdge, moveRoom, removeRoom, reshape, roomAt, roomCounts, roomSize,
  type HouseDesign, type RoomPick,
} from './plan'

const living: RoomPick = { type: 'living', style: 'natural', size: 'l', turned: false } // 4×3
const toilet: RoomPick = { type: 'toilet', style: 'simple', size: 'm', turned: false } // 1×2

function place(design: HouseDesign, floor: number, pick: RoomPick, x: number, y: number) {
  const result = addRoom(design, floor, pick, { x, y })
  if (!result) throw new Error(`could not place ${pick.type} at ${x},${y}`)
  return result
}

describe('house-builder plan', () => {
  test('へやを ひっぱって うごかせる。はみだす・かさなる ところへは うごかせない', () => {
    let design = createDesign('hiraya', 'square') // 6×6
    design = place(design, 0, living, 0, 0).design
    design = place(design, 0, toilet, 5, 0).design // id 2: (5,0)〜(5,1)
    const moved = moveRoom(design, 1, { x: 1, y: 3 })
    expect(moved?.rooms.find((r) => r.id === 1)).toMatchObject({ x: 1, y: 3, floor: 0 })
    // じぶんと かさなる だけなら うごかせる。
    expect(moveRoom(design, 1, { x: 1, y: 0 })?.rooms[0]).toMatchObject({ x: 1, y: 0 })
    expect(moveRoom(design, 1, { x: 2, y: 0 })).toBeNull()
    expect(moveRoom(design, 1, { x: 3, y: 3 })).toBeNull()
    expect(moveRoom(design, 1, { x: -1, y: 0 })).toBeNull()
    expect(moveRoom(design, 99, { x: 0, y: 3 })).toBeNull()
  })

  test('へやの おおきさは しゅるい・おおきさ・むきで きまる', () => {
    expect(roomSize(living)).toEqual({ w: 4, h: 3 })
    expect(roomSize({ ...living, turned: true })).toEqual({ w: 3, h: 4 })
    expect(roomSize({ ...toilet, size: 's' })).toEqual({ w: 1, h: 1 })
  })

  test('タップした マスを ふくむように へやを おく。はしでは うちがわに よせる', () => {
    const design = createDesign('hiraya', 'square') // 6×6
    const { design: next, room } = place(design, 0, living, 0, 0)
    expect(room).toMatchObject({ x: 0, y: 0, floor: 0, id: 1 })
    // まんなかを タップすると まんなかに くる。
    expect(place(design, 0, living, 3, 3).room).toMatchObject({ x: 1, y: 2 })
    // みぎしたの すみ でも はみださない。
    expect(place(design, 0, living, 5, 5).room).toMatchObject({ x: 2, y: 3 })
    expect(roomAt(next, 0, 3, 2)?.id).toBe(1)
    expect(roomAt(next, 0, 4, 0)).toBeUndefined()
  })

  test('ほかの へやと かさなる・ゆかから はみだす ときは おけない', () => {
    let design = createDesign('hiraya', 'square')
    design = place(design, 0, living, 0, 0).design
    expect(addRoom(design, 0, toilet, { x: 1, y: 1 })).toBeNull()
    // となりの すきまには おける。
    expect(place(design, 0, toilet, 4, 0).room).toMatchObject({ x: 4, y: 0 })
    // L の かたちの にわ（みぎした）には おけない。
    const l = createDesign('hiraya', 'lshape')
    expect(addRoom(l, 0, toilet, { x: 6, y: 5 })).toBeNull()
    expect(fits(l, { floor: 0, ...toilet, x: 4, y: 5 })).toBe(true)
    // ない かいには おけない。
    expect(addRoom(createDesign('hiraya', 'square'), 1, toilet, { x: 0, y: 0 })).toBeNull()
  })

  test('せまい すきまでも、タップした マスを ふくむ おきかたを さがす', () => {
    let design = createDesign('hiraya', 'narrow') // 4×7
    design = place(design, 0, { ...toilet, size: 's' }, 0, 1).design
    // (0,0) を タップ → (0,1) は ふさがって いるので よこ むきの へやは うえの ぎょうに おさまる。
    const dining = { type: 'dining', style: 'wood', size: 'm', turned: false } as const // 3×2
    expect(findSpot(design, 0, dining, { x: 0, y: 0 })).toBeNull()
    expect(findSpot(design, 0, dining, { x: 2, y: 1 })).toEqual({ x: 1, y: 0 })
  })

  test('みため・おおきさ・むきを かえる。はいらない ときは かえない', () => {
    let design = createDesign('nikai', 'square')
    const first = place(design, 0, { ...living, size: 's' }, 0, 0) // 3×2
    design = place(first.design, 0, toilet, 3, 0).design
    const id = first.room.id
    const restyled = changeRoom(design, id, { style: 'log' })!
    expect(restyled.rooms.find((r) => r.id === id)).toMatchObject({ style: 'log', x: 0, y: 0 })
    const bigger = changeRoom(design, id, { size: 'm' })!
    expect(bigger.rooms.find((r) => r.id === id)).toMatchObject({ size: 'm', x: 0, y: 0 })
    // おおきい（4×3）は トイレに ぶつかるので かわらない。
    expect(changeRoom(design, id, { size: 'l' })).toBeNull()
    const turned = changeRoom(design, id, { turned: true })!
    expect(roomSize(turned.rooms.find((r) => r.id === id)!)).toEqual({ w: 2, h: 3 })
    expect(changeRoom(design, 999, { style: 'log' })).toBeNull()
  })

  test('けす・かいを からっぽに する・かずを かぞえる', () => {
    let design = createDesign('nikai', 'square')
    const a = place(design, 0, toilet, 0, 0)
    const b = place(a.design, 1, toilet, 0, 0)
    design = place(b.design, 1, toilet, 2, 0).design
    expect(roomCounts(design)).toEqual([1, 2])
    expect(roomCounts(removeRoom(design, a.room.id))).toEqual([0, 2])
    expect(roomCounts(clearFloor(design, 1))).toEqual([1, 0])
    // けしたあとも あたらしい へやの id は かぶらない。
    const again = place(removeRoom(design, a.room.id), 0, toilet, 3, 3)
    expect(design.rooms.map((r) => r.id)).not.toContain(again.room.id)
  })

  test('かたちや かいの かずを かえても、おさまる へやは のこす', () => {
    let design = createDesign('sangai', 'wide')
    design = place(design, 0, living, 0, 0).design
    design = place(design, 0, toilet, 9, 5).design
    design = place(design, 2, toilet, 0, 0).design
    const smaller = reshape(design, 'nikai', 'square')
    expect(smaller).toMatchObject({ houseType: 'nikai', shape: 'square' })
    expect(smaller.rooms.map((r) => r.type)).toEqual(['living'])
  })

  test('おもての れつは いちばん したの ゆかの つぎ', () => {
    const l = SHAPES.find((s) => s.id === 'lshape')!
    expect(frontEdge(l)).toEqual([7, 7, 7, 7, 7, 4, 4, 4])
    const u = SHAPES.find((s) => s.id === 'ushape')!
    expect(frontEdge(u)).toEqual([7, 7, 7, 3, 3, 3, 7, 7, 7])
  })

  test('おもてに めんした へやに あわせて まどと ドアを つける', () => {
    let design = createDesign('nikai', 'square')
    expect(facadeOpenings(design, 0).filter((o) => o.kind === 'door')).toHaveLength(1)
    expect(facadeOpenings(design, 1).every((o) => o.kind === 'window')).toBe(true)

    design = place(design, 0, { type: 'entrance', style: 'stone', size: 'm', turned: false }, 5, 5).design // 2×1 at (4,5)
    design = place(design, 0, { type: 'bath', style: 'tile', size: 's', turned: false }, 0, 5).design // 2×2 at (0,4)
    design = place(design, 0, living, 0, 0).design // おもてに めんしていない
    const openings = facadeOpenings(design, 0)
    expect(openings.map((o) => [o.kind, o.center])).toEqual([['small', 1], ['door', 5]])
    // 2かいの げんかんは ドアに しない。
    design = place(design, 1, { type: 'entrance', style: 'stone', size: 'm', turned: false }, 0, 5).design
    expect(facadeOpenings(design, 1).map((o) => o.kind)).toEqual(['window'])
  })

  test('げんかんが ないときの ドアは まどの ない ところ、なければ まんなかの まどと いれかえる', () => {
    let design = createDesign('hiraya', 'rect') // 8×5
    design = place(design, 0, { type: 'kids', style: 'space', size: 'l', turned: false }, 0, 4).design // 3×3 at (0,2)
    let openings = facadeOpenings(design, 0)
    const door = openings.find((o) => o.kind === 'door')!
    expect(door.center).toBe(3.5)
    expect(openings).toHaveLength(2)
    // おもてが ぜんぶ へやで うまっている。
    design = place(design, 0, { type: 'living', style: 'natural', size: 'l', turned: false }, 4, 4).design // 4×3 at (3,2)
    design = place(design, 0, { type: 'toilet', style: 'simple', size: 's', turned: false }, 7, 4).design
    openings = facadeOpenings(design, 0)
    expect(openings.filter((o) => o.kind === 'door')).toHaveLength(1)
    expect(openings.some((o) => o.kind === 'big')).toBe(false)
  })
})
