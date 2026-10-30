import { afterEach, describe, expect, test, vi } from 'vitest'
import * as THREE from 'three'
import { DOORS, EXTRAS, ROOFS, ROOM_SIZES, ROOM_TYPES, SHAPES, WALLS, type Exterior } from '../data'
import { CELL, ROOM_WALL_H, footprintRects, yardLayout, type Box2 } from '../layout3d'
import { addRoom, createDesign, floorCount, roomSize, type HouseDesign, type PlacedRoom, type RoomPick } from '../plan'
import { buildExterior } from './exterior'
import { buildRoom } from './rooms'
import { Kit, disposeObject } from './kit'
import { openingPanel } from './openings'

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
  test('趣味と くらしの へやは 色だけでなく かぐの かたちも かわる', () => {
    for (const id of ['library', 'music', 'art', 'playroom', 'pet', 'laundry', 'closet', 'plants'] as const) {
      const type = ROOM_TYPES.find((t) => t.id === id)!
      const models = new Set<string>()
      for (const style of type.styles) {
        const { design, room } = place(createDesign('hiraya', 'wide'), 0, { type: id, style: style.id, size: 'm', turned: false }, 0, 0)
        const built = buildRoom(design, room)
        const parts: object[] = []
        built.root.getObjectByName('furniture')!.traverse((o) => {
          if (o instanceof THREE.Mesh) parts.push({ geometry: o.geometry.type, count: o.geometry.getAttribute('position').count, position: o.position.toArray(), scale: o.scale.toArray(), rotation: o.rotation.toArray() })
        })
        models.add(JSON.stringify(parts))
        built.dispose()
      }
      expect(models.size, type.name).toBe(type.styles.length)
    }
  })
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
    wall: 'white', roof: 'red', window: 'square', door: 'wood', parking: 'none', doghouse: 'none', garden: 'none', pool: 'none', extras: [], ...patch,
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
    for (const name of ['car-1', 'car-2', 'doghouse', 'pond', 'chimney', 'solar', 'koinobori', 'swing', 'bike', 'mailbox', 'fence', 'balcony', 'picnic', 'fountain']) {
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

  test('かたながれの やねは まんなかに むねが なく、はしから はしまで かたむく', () => {
    const built = buildExterior({ ...createDesign('hiraya', 'square'), exterior: exterior({ roof: 'shed' }) })
    built.root.updateMatrixWorld(true)
    const roof = built.root.getObjectByName('roof-main')!
    const heights = [-3, 0, 3].map((z) => {
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 30, z), new THREE.Vector3(0, -1, 0))
      const hit = ray.intersectObject(roof, true)[0]
      expect(hit).toBeDefined()
      return hit.point.y
    })
    expect(Math.abs(heights[0] - heights[2])).toBeGreaterThan(1)
    expect(heights[1]).toBeCloseTo((heights[0] + heights[2]) / 2)
    built.dispose()
  })

  test('プールと はたけ・くだもの・おまけを いっしょに つくり、よやくした ばしょに おさめる', () => {
    for (const [pool, garden] of [['round', 'strawberries'], ['rectangle', 'orchard']] as const) {
      const design: HouseDesign = {
        ...createDesign('hiraya', 'narrow'),
        exterior: exterior({ pool, garden, parking: 'two', doghouse: 'log', extras: EXTRAS.map((item) => item.id) }),
      }
      const yard = yardLayout(design)
      const built = buildExterior(design)
      const items: [string, Box2][] = [[`pool-${pool}`, yard.pool!], [garden, yard.plot!], ['picnic', yard.picnic!], ['fountain', yard.fountain!]]
      for (const { id, box } of yard.outdoor) items.push([id, box])
      for (const [name, space] of items) {
        const item = built.root.getObjectByName(name)
        expect(item, name).toBeDefined()
        const box = boxOf(item!)
        expect(box.isEmpty(), name).toBe(false)
        expect(box.max.y - box.min.y, name).toBeGreaterThan(.1)
        expect(box.min.x, name).toBeGreaterThanOrEqual(space.minX - .03)
        expect(box.max.x, name).toBeLessThanOrEqual(space.maxX + .03)
        expect(box.min.z, name).toBeGreaterThanOrEqual(space.minZ - .03)
        expect(box.max.z, name).toBeLessThanOrEqual(space.maxZ + .03)
      }
      built.dispose()
    }
    const plain = buildExterior(createDesign('hiraya', 'square'))
    expect(names(plain.root)).not.toContain('pool-round')
    expect(names(plain.root)).not.toContain('pool-rectangle')
    expect(names(plain.root)).not.toContain('picnic')
    expect(names(plain.root)).not.toContain('fountain')
    plain.dispose()
  })

  test('ふえた かべの いろが 3D の かべにも つく', () => {
    for (const wall of WALLS.filter((option) => ['mint', 'cream', 'navy', 'lavender', 'whitebrick', 'terracotta', 'sage'].includes(option.id))) {
      const built = buildExterior({ ...createDesign('hiraya', 'square'), exterior: exterior({ wall: wall.id }) })
      const colors: string[] = []
      built.root.getObjectByName('house')!.traverse((obj) => {
        const material = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
        if (material?.color) colors.push(`#${material.color.getHexString()}`)
      })
      expect(colors, wall.id).toContain(wall.base)
      built.dispose()
    }
  })

  test('プールの みずは ほんたいに かくれず、うえから みえる', () => {
    for (const pool of ['round', 'rectangle'] as const) {
      const built = buildExterior({ ...createDesign('hiraya', 'square'), exterior: exterior({ pool }) })
      built.root.updateMatrixWorld(true)
      const model = built.root.getObjectByName(`pool-${pool}`)!
      const center = model.getWorldPosition(new THREE.Vector3())
      // 浮き輪・波紋・はしごから離れた水面を上から見る。
      const ray = new THREE.Raycaster(new THREE.Vector3(center.x + .8, 10, center.z - .6), new THREE.Vector3(0, -1, 0))
      const hit = ray.intersectObject(model, true)[0]
      expect(hit?.object.name, pool).toBe('pool-water')
      built.dispose()
    }
  })

  test('リビングの おおきい まどにも えらんだ よろいどが つく', () => {
    const kit = new Kit()
    const shutters = openingPanel(kit, 'big', 3, { window: 'shutters', door: 'wood', inside: false })
    const plain = openingPanel(kit, 'big', 3, { window: 'square', door: 'wood', inside: false })
    const panels: THREE.Object3D[] = []
    shutters.traverse((obj) => { if (obj.name === 'shutter') panels.push(obj) })
    expect(panels).toHaveLength(2)
    for (const panel of panels) expect(boxOf(panel).isEmpty()).toBe(false)
    expect(names(plain)).not.toContain('shutter')
    disposeObject(shutters)
    disposeObject(plain)
    kit.dispose()
  })

  test('あたらしい まどと ドアにも それぞれ ちがう かたちや いろが ある', () => {
    const signature = (window: Exterior['window'], door: Exterior['door'], kind: 'window' | 'door') => {
      const kit = new Kit()
      const panel = openingPanel(kit, kind, 1, { window, door, inside: false })
      const parts: object[] = []
      panel.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return
        const color = (obj.material as THREE.MeshStandardMaterial).color.getHexString()
        const bounds = boxOf(obj)
        parts.push({ geometry: obj.geometry.type, count: obj.geometry.getAttribute('position').count, position: obj.position.toArray(), scale: obj.scale.toArray(), min: bounds.min.toArray(), max: bounds.max.toArray(), color })
      })
      expect(parts.length).toBeGreaterThan(0)
      disposeObject(panel)
      kit.dispose()
      return JSON.stringify(parts)
    }
    const windows = ['square', 'shutters', 'wide'] as const
    expect(new Set(windows.map((window) => signature(window, 'wood', 'window'))).size).toBe(windows.length)
    const doors = ['wood', 'blue', 'double'] as const
    expect(new Set(doors.map((door) => signature('square', door, 'door'))).size).toBe(doors.length)
    for (const door of DOORS.filter((option) => doors.includes(option.id as typeof doors[number]))) {
      expect(signature('square', door.id, 'door'), door.id).toContain(door.color.slice(1))
    }
  })
})
