import { describe, expect, test } from 'vitest'
import { EXTRAS, OUTDOOR_EXTRAS, SHAPES, findShape, type ShapeId } from './data'
import { CELL, footprintRects, innerDoor, isOutsideEdge, roomOpenings, sideOpenings, wallRuns, yardLayout, type Box2 } from './layout3d'
import { addRoom, createDesign, facadeOpenings, type HouseDesign, type RoomPick } from './plan'

function place(design: HouseDesign, floor: number, pick: RoomPick, x: number, y: number) {
  const result = addRoom(design, floor, pick, { x, y })
  if (!result) throw new Error(`could not place ${pick.type} at ${x},${y}`)
  return result
}

const pick = (type: RoomPick['type'], size: RoomPick['size'] = 'm', turned = false): RoomPick => ({ type, style: 'x', size, turned })

/** そとに めんした マスの へりの かず（ちょくせつ かぞえる）。 */
function edgeCount(id: ShapeId) {
  const shape = findShape(id)
  let n = 0
  for (let y = 0; y < shape.height; y++) for (let x = 0; x < shape.width; x++) {
    for (const side of ['front', 'back', 'left', 'right'] as const) if (isOutsideEdge(shape, x, y, side)) n++
  }
  return n
}

const overlaps = (a: Box2, b: Box2) => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ
const around = (p: { x: number; z: number }, r: number): Box2 => ({ minX: p.x - r, maxX: p.x + r, minZ: p.z - r, maxZ: p.z + r })

describe('house-builder 3D layout', () => {
  test('そとに めんした へりを つないで かべに する。なかにわの まわりにも かべが たつ', () => {
    for (const shape of SHAPES) {
      const total = wallRuns(shape).reduce((sum, run) => sum + run.to - run.from, 0)
      expect(total, shape.id).toBe(edgeCount(shape.id))
    }
    expect(wallRuns(findShape('square'))).toEqual([
      { side: 'front', line: 6, from: 0, to: 6 },
      { side: 'back', line: 0, from: 0, to: 6 },
      { side: 'left', line: 0, from: 0, to: 6 },
      { side: 'right', line: 6, from: 0, to: 6 },
    ])
    const courtyard = wallRuns(findShape('ushape'))
    expect(courtyard).toContainEqual({ side: 'front', line: 3, from: 3, to: 6 })
    expect(courtyard).toContainEqual({ side: 'right', line: 3, from: 3, to: 7 })
    expect(courtyard).toContainEqual({ side: 'left', line: 6, from: 3, to: 7 })
  })

  test('ゆかを かさならない しかくに わけて、ぜんぶの マスに やねを かける', () => {
    for (const shape of SHAPES) {
      const covered = new Map<string, number>()
      for (const r of footprintRects(shape)) {
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) covered.set(`${x},${y}`, (covered.get(`${x},${y}`) ?? 0) + 1)
      }
      for (let y = 0; y < shape.height; y++) for (let x = 0; x < shape.width; x++) {
        expect(covered.get(`${x},${y}`) ?? 0, `${shape.id} ${x},${y}`).toBe(shape.mask[y][x] ? 1 : 0)
      }
    }
    expect(footprintRects(findShape('square'))).toHaveLength(1)
    expect(footprintRects(findShape('lshape'))).toEqual([{ x: 0, y: 0, w: 8, h: 4 }, { x: 0, y: 4, w: 5, h: 3 }])
    expect(footprintRects(findShape('ushape'))).toHaveLength(3)
  })

  test('おもての まど・ドアは そとから みた え と おなじ。よこ と うらは めんした へやに あわせる', () => {
    let design = createDesign('nikai', 'square')
    const bath = place(design, 0, pick('bath', 's'), 0, 0) // 2×2 ひだりうえの すみ
    design = bath.design
    const entrance = place(design, 0, pick('entrance', 's'), 3, 5)
    design = entrance.design
    const opens = sideOpenings(design, 0)
    expect(opens.filter((o) => o.side === 'front').map(({ center, span, kind }) => ({ center, span, kind })))
      .toEqual(facadeOpenings(design, 0).map(({ center, span, kind }) => ({ center, span, kind })))
    expect(opens.filter((o) => o.kind === 'door')).toEqual([{ side: 'front', line: 6, center: 3.5, span: 1, kind: 'door', roomId: entrance.room.id }])
    // おふろは うら と ひだりに ちいさい まど。みぎには へやが ないので ふつうの まどを ならべる。
    expect(opens.filter((o) => o.roomId === bath.room.id)).toEqual([
      { side: 'back', line: 0, center: 1, span: 2, kind: 'small', roomId: bath.room.id },
      { side: 'left', line: 0, center: 1, span: 2, kind: 'small', roomId: bath.room.id },
    ])
    expect(opens.filter((o) => o.side === 'right')).toEqual([
      { side: 'right', line: 6, center: 1.5, span: 1, kind: 'window' },
      { side: 'right', line: 6, center: 4.5, span: 1, kind: 'window' },
    ])
    // 2かいには ドアが ない。
    expect(sideOpenings(design, 1).some((o) => o.kind === 'door')).toBe(false)
    expect(sideOpenings(design, 1).filter((o) => o.side !== 'front').length).toBeGreaterThan(0)
  })

  test('へやの なかから みえる まど・ドアと、となりへの ドア', () => {
    let design = createDesign('hiraya', 'narrow') // 4×7
    const top = place(design, 0, pick('bedroom', 'l', true), 0, 0) // 3×3
    design = top.design
    const hall = place(design, 0, pick('hall', 'l'), 3, 6) // 1×4 みぎの はし（3〜6ぎょう）
    design = hall.design
    const entrance = place(design, 0, pick('entrance', 'm'), 1, 6) // 2×1 おもて（0〜1れつ）
    design = entrance.design
    expect(roomOpenings(design, top.room).map((o) => o.side).sort()).toEqual(['back', 'left'])
    expect(roomOpenings(design, entrance.room)).toContainEqual(expect.objectContaining({ side: 'front', kind: 'door' }))
    // しんしつは みぎ と まえが いえの なか。ながい ほう（どちらも 3）の うち さきに みる みぎに ドア。
    expect(innerDoor(design, top.room)).toEqual({ side: 'right', center: 1.5 })
    expect(innerDoor(design, hall.room)).toEqual({ side: 'left', center: 5 })
  })

  test('にわの ものは いえ・こみち・ほかの もの と かさならず、しばふの なかに おさまる', () => {
    for (const shape of SHAPES) {
      for (const parking of ['none', 'red', 'two', 'garage'] as const) {
        const design: HouseDesign = {
          ...createDesign('nikai', shape.id),
          exterior: { wall: 'white', roof: 'red', window: 'square', door: 'wood', parking, doghouse: 'red', garden: parking === 'two' ? 'orchard' : 'strawberries', pool: parking === 'garage' ? 'round' : 'rectangle', extras: EXTRAS.map((item) => item.id) },
        }
        const yard = yardLayout(design)
        const boxes: [string, Box2][] = [['house', yard.house], ['path', { ...yard.path, minZ: yard.frontZ + .1 }]]
        if (yard.parking) boxes.push(['parking', yard.parking])
        if (yard.plot) boxes.push(['plot', yard.plot])
        if (yard.pool) boxes.push(['pool', yard.pool])
        if (yard.picnic) boxes.push(['picnic', yard.picnic])
        if (yard.fountain) boxes.push(['fountain', yard.fountain])
        for (const { id, box } of yard.outdoor) boxes.push([id, box])
        expect(yard.outdoor.map((item) => item.id)).toEqual(OUTDOOR_EXTRAS.map((item) => item.id))
        if (yard.bike) boxes.push(['bike', { minX: yard.bike.x - .8, maxX: yard.bike.x + .8, minZ: yard.bike.z - .2, maxZ: yard.bike.z + .2 }])
        if (yard.mailbox) boxes.push(['mailbox', around(yard.mailbox, .3)])
        if (yard.doghouse) boxes.push(['doghouse', { minX: yard.doghouse.x - .7, maxX: yard.doghouse.x + 1.6, minZ: yard.doghouse.z - .7, maxZ: yard.doghouse.z + .9 }])
        if (yard.koinobori) boxes.push(['koinobori', around(yard.koinobori, .3)])
        if (yard.swing) boxes.push(['swing', { minX: yard.swing.x - 1.2, maxX: yard.swing.x + 1.2, minZ: yard.swing.z - 1, maxZ: yard.swing.z + 1 }])
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i][1], boxes[j][1]), `${shape.id}/${parking}: ${boxes[i][0]} × ${boxes[j][0]}`).toBe(false)
          if (i > 0) {
            const b = boxes[i][1]
            expect(b.minX >= yard.yard.minX && b.maxX <= yard.yard.maxX && b.minZ >= yard.yard.minZ && b.maxZ <= yard.yard.maxZ, `${shape.id}/${parking}: ${boxes[i][0]}`).toBe(true)
          }
        }
        expect(yard.parking?.cars.length ?? 0).toBe(parking === 'none' ? 0 : parking === 'two' ? 2 : 1)
        expect(yard.plot).toBeDefined()
        expect(yard.pool).toBeDefined()
        expect(yard.picnic).toBeDefined()
        expect(yard.fountain).toBeDefined()
        expect(yard.door.z).toBeCloseTo(yard.path.minZ)
        expect(yard.house.maxX - yard.house.minX).toBeCloseTo(shape.width * CELL)
      }
    }
  })

  test('プールだけを はずしても はたけは のこる', () => {
    const base = createDesign('hiraya', 'square')
    const garden = { ...base.exterior, garden: 'veggies' as const }
    expect(yardLayout({ ...base, exterior: { ...garden, pool: 'round' } })).toMatchObject({ pool: expect.any(Object), plot: expect.any(Object) })
    const withoutPool = yardLayout({ ...base, exterior: { ...garden, pool: 'none' } })
    expect(withoutPool.plot).toBeDefined()
    expect(withoutPool.pool).toBeUndefined()
  })

  test('あそびばの くみあわせに あわせて にわを ひろげ、ぜんぶ はずすと もどる', () => {
    const base = createDesign('hiraya', 'narrow')
    const plain = yardLayout(base)
    // 2れつめの プールが ないときも、すべての くみあわせで おさめる。
    for (let mask = 0; mask < 2 ** OUTDOOR_EXTRAS.length; mask++) {
      const extras = OUTDOOR_EXTRAS.filter((_, i) => mask & (1 << i)).map((item) => item.id)
      const yard = yardLayout({ ...base, exterior: { ...base.exterior, extras } })
      expect(yard.outdoor.map((item) => item.id)).toEqual(extras)
      const boxes = [yard.house, yard.path, ...yard.outdoor.map((item) => item.box)]
      boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)))
      for (const { box } of yard.outdoor) {
        expect(box.minX).toBeGreaterThan(yard.yard.minX)
        expect(box.maxX).toBeLessThan(yard.yard.maxX)
        expect(box.maxZ).toBeLessThan(yard.yard.maxZ)
      }
      expect(yard.yard.maxZ > plain.yard.maxZ).toBe(extras.length > 0)
    }
  })
})
