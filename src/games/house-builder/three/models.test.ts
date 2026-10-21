import { afterEach, describe, expect, test, vi } from 'vitest'
import * as THREE from 'three'
import { EXTRAS, ROOFS, ROOM_SIZES, ROOM_TYPES, SHAPES, type Exterior } from '../data'
import { CELL, ROOM_WALL_H, footprintRects } from '../layout3d'
import { addRoom, createDesign, floorCount, roomSize, type HouseDesign, type PlacedRoom, type RoomPick } from '../plan'
import { buildExterior } from './exterior'
import { buildRoom } from './rooms'

function place(design: HouseDesign, floor: number, pick: RoomPick, x: number, y: number) {
  const result = addRoom(design, floor, pick, { x, y })
  if (!result) throw new Error(`could not place ${pick.type} at ${x},${y}`)
  return result
}

function boxOf(obj: THREE.Object3D) {
  obj.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(obj)
}

const names = (root: THREE.Object3D) => {
  const list: string[] = []
  root.traverse((o) => { if (o.name) list.push(o.name) })
  return list
}

const spots = (root: THREE.Object3D) => {
  const list: string[] = []
  root.traverse((o) => { if (o.userData.spot) list.push(o.userData.spot as string) })
  return list
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('house-builder 3D rooms', () => {
  test('ぜんぶの へや・みため・おおきさ・むきで、へやの おおきさの ゆかに かぐが おさまる', () => {
    const design = createDesign('hiraya', 'wide') // 10×7
    for (const type of ROOM_TYPES) {
      for (const style of type.styles) {
        for (const size of ROOM_SIZES) {
          for (const turned of [false, true]) {
            const { design: next, room } = place(design, 0, { type: type.id, style: style.id, size: size.id, turned }, 4, 3)
            const built = buildRoom(next, room)
            const label = `${type.id}/${style.id}/${size.id}/${turned}`
            const { w, h } = roomSize(room)
            const floor = boxOf(built.root.getObjectByName('floor')!)
            expect(floor.max.x - floor.min.x, label).toBeCloseTo(w * CELL)
            expect(floor.max.z - floor.min.z, label).toBeCloseTo(h * CELL)
            const furniture = boxOf(built.root.getObjectByName('furniture')!)
            expect(furniture.isEmpty(), label).toBe(false)
            expect(furniture.min.x, label).toBeGreaterThanOrEqual(-w * CELL / 2 - .03)
            expect(furniture.max.x, label).toBeLessThanOrEqual(w * CELL / 2 + .03)
            expect(furniture.min.z, label).toBeGreaterThanOrEqual(-h * CELL / 2 - .03)
            expect(furniture.max.z, label).toBeLessThanOrEqual(h * CELL / 2 + .03)
            expect(furniture.min.y, label).toBeGreaterThanOrEqual(-.01)
            expect(furniture.max.y, label).toBeLessThanOrEqual(ROOM_WALL_H + .9)
            expect(built.cutaways, label).toHaveLength(4)
            expect(built.root.userData.spot).toBe('room')
            built.dispose()
          }
        }
      }
    }
  })

  test('おおきい へやほど かぐが ふえる・おおきく なる', () => {
    const design = createDesign('hiraya', 'wide')
    const count = (pick: RoomPick) => {
      const { design: next, room } = place(design, 0, pick, 4, 3)
      const built = buildRoom(next, room)
      let n = 0
      built.root.getObjectByName('furniture')!.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++ })
      const box = boxOf(built.root.getObjectByName('furniture')!)
      built.dispose()
      return { n, width: box.max.x - box.min.x }
    }
    for (const type of ['living', 'dining', 'kitchen', 'bedroom', 'kids', 'washroom'] as const) {
      const small = count({ type, style: ROOM_TYPES.find((t) => t.id === type)!.styles[0].id, size: 's', turned: false })
      const large = count({ type, style: ROOM_TYPES.find((t) => t.id === type)!.styles[0].id, size: 'l', turned: false })
      expect(large.n >= small.n && large.width > small.width, type).toBe(true)
    }
  })

  test('そとに めんした かべには まど、げんかんには おもての ドアが つき、まんなかの へやには まどが ない', () => {
    let design = createDesign('hiraya', 'square')
    const corner = place(design, 0, { type: 'living', style: 'natural', size: 'm', turned: false }, 0, 0)
    design = corner.design
    const middle = place(design, 0, { type: 'toilet', style: 'simple', size: 's', turned: false }, 3, 2)
    design = middle.design
    const entrance = place(design, 0, { type: 'entrance', style: 'stone', size: 's', turned: false }, 4, 5)
    design = entrance.design
    const panels = (room: PlacedRoom) => {
      const built = buildRoom(design, room)
      const per: Record<string, number> = {}
      for (const side of ['front', 'back', 'left', 'right']) per[side] = built.root.getObjectByName(`wall-${side}`)!.children[0].children.filter((c) => c.type === 'Group').length
      const yaw = built.yaw
      built.dispose()
      return { per, yaw }
    }
    const a = panels(corner.room)
    expect(a.per.back).toBeGreaterThanOrEqual(1)
    expect(a.per.left).toBeGreaterThanOrEqual(1)
    expect(a.yaw).toBeUndefined()
    // まんなかの トイレは まどが なく、となりへの ドアだけ。
    expect(Object.values(panels(middle.room).per).reduce((sum, n) => sum + n, 0)).toBeGreaterThan(0)
    const toilet = buildRoom(design, middle.room)
    let glass = 0
    toilet.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.type === 'PlaneGeometry') glass++ })
    toilet.dispose()
    expect(glass).toBe(0)
    // げんかんは おもての ドアが みえる むきから みる。
    expect(panels(entrance.room).yaw).toBeCloseTo(Math.PI - .62)
  })

  test('すてると つかった かたち・ざいりょうを ぜんぶ かいほうする', () => {
    const geo = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose')
    const mat = vi.spyOn(THREE.Material.prototype, 'dispose')
    const { design, room } = place(createDesign('hiraya', 'square'), 0, { type: 'bath', style: 'bubble', size: 'l', turned: false }, 2, 2)
    const built = buildRoom(design, room)
    const used = { geos: new Set<THREE.BufferGeometry>(), mats: new Set<THREE.Material>() }
    built.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) used.geos.add(m.geometry)
      if (m.material) used.mats.add(m.material as THREE.Material)
    })
    built.dispose()
    const disposedGeos = new Set(geo.mock.contexts)
    const disposedMats = new Set(mat.mock.contexts)
    for (const g of used.geos) expect(disposedGeos.has(g)).toBe(true)
    for (const m of used.mats) expect(disposedMats.has(m)).toBe(true)
  })
})

describe('house-builder 3D outside', () => {
  const exterior = (patch: Partial<Exterior>): Exterior => ({
    wall: 'white', roof: 'red', window: 'square', door: 'wood', parking: 'none', doghouse: 'none', garden: 'none', extras: [], ...patch,
  })

  test('かたち・かいすう・やねに あわせて かべと やねを たて、ドアに こえの めじるしを つける', () => {
    for (const shape of SHAPES) {
      for (const roof of ROOFS) {
        const design: HouseDesign = { ...createDesign('sangai', shape.id), exterior: exterior({ roof: roof.id }) }
        const built = buildExterior(design)
        const label = `${shape.id}/${roof.id}`
        const list = names(built.root)
        for (let f = 0; f < floorCount(design); f++) expect(list, label).toContain(`floor-${f}`)
        expect(list.filter((n) => n === 'roof' || n === 'roof-main'), label).toHaveLength(footprintRects(shape).length)
        expect(list.filter((n) => n === 'roof-main'), label).toHaveLength(1)
        expect(spots(built.root), label).toEqual(['door'])
        const house = boxOf(built.root.getObjectByName('house')!)
        expect(house.max.x - house.min.x, label).toBeGreaterThanOrEqual(shape.width * CELL + .2)
        expect(house.max.x - house.min.x, label).toBeLessThanOrEqual(shape.width * CELL + .8)
        expect(built.ticks.length, label).toBeGreaterThan(0)
        built.dispose()
      }
    }
  })

  test('えらんだ そとがわの ものが にわや やねに ならぶ', () => {
    const design: HouseDesign = {
      ...createDesign('nikai', 'lshape'),
      exterior: exterior({ parking: 'two', doghouse: 'log', garden: 'pond', extras: EXTRAS.map((e) => e.id) }),
    }
    const built = buildExterior(design)
    const list = names(built.root)
    for (const name of ['car-1', 'car-2', 'doghouse', 'pond', 'chimney', 'solar', 'koinobori', 'swing', 'bike', 'mailbox', 'fence', 'balcony']) {
      expect(list, name).toContain(name)
    }
    expect(spots(built.root).sort()).toEqual(['car', 'car', 'dog', 'door'])
    built.dispose()

    const plain = buildExterior({ ...createDesign('hiraya', 'square'), exterior: exterior({ parking: 'garage', garden: 'veggies', extras: ['balcony'] }) })
    const plainNames = names(plain.root)
    expect(plainNames).toEqual(expect.arrayContaining(['car', 'garage', 'veggies', 'balcony']))
    expect(plainNames).not.toContain('doghouse')
    expect(plainNames).not.toContain('chimney')
    plain.dispose()

    const flowers = buildExterior({ ...createDesign('hiraya', 'rect'), exterior: exterior({ garden: 'flowers', roof: 'flat', extras: ['solar'] }) })
    expect(names(flowers.root)).toEqual(expect.arrayContaining(['flowers', 'solar']))
    flowers.dispose()
  })
})
