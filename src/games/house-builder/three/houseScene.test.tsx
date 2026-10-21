import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as THREE from 'three'
import { addRoom, createDesign, type HouseDesign } from '../plan'
import { createHouseScene } from './houseScene'

const mock = vi.hoisted(() => ({ render: vi.fn(), dispose: vi.fn(), disconnect: vi.fn(), fail: false }))

vi.mock('three', async (importOriginal) => {
  const real = await importOriginal<typeof import('three')>()
  return {
    ...real,
    WebGLRenderer: class {
      domElement = document.createElement('canvas')
      shadowMap = { enabled: false, type: 0 }
      outputColorSpace = ''
      constructor() {
        if (mock.fail) throw new Error('no webgl')
      }
      setPixelRatio() {}
      setSize() {}
      render = mock.render
      dispose = mock.dispose
    },
  }
})

let frames: Map<number, FrameRequestCallback>
let serial = 0

beforeEach(() => {
  vi.clearAllMocks()
  mock.fail = false
  frames = new Map()
  vi.stubGlobal('requestAnimationFrame', vi.fn((fn: FrameRequestCallback) => { frames.set(++serial, fn); return serial }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = mock.disconnect })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

/** まっている コマを ぜんぶ すすめる。 */
function flush(time: number) {
  for (let i = 0; i < 5 && frames.size; i++) {
    for (const [id, frame] of [...frames]) {
      frames.delete(id)
      frame(time)
    }
  }
}

function setup(design: HouseDesign, view: Parameters<typeof createHouseScene>[2] = { kind: 'outside' }) {
  const host = document.createElement('div')
  document.body.append(host)
  Object.defineProperties(host, { clientWidth: { value: 400 }, clientHeight: { value: 500 } })
  host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 500, x: 0, y: 0, right: 400, bottom: 500, toJSON() {} })
  const callbacks = { status: vi.fn(), spot: vi.fn() }
  return { host, callbacks, scene: createHouseScene(host, design, view, callbacks) }
}

function pointer(host: HTMLElement, type: string, x: number, y: number, id = 1) {
  const event = new Event(type, { cancelable: true })
  Object.assign(event, { pointerId: id, clientX: x, clientY: y, button: 0 })
  host.dispatchEvent(event)
}

const lastScene = () => mock.render.mock.calls.at(-1)![0] as THREE.Scene
const lastCamera = () => mock.render.mock.calls.at(-1)![1] as THREE.PerspectiveCamera

function screenOf(obj: THREE.Object3D) {
  lastScene().updateMatrixWorld(true)
  const center = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3()).project(lastCamera())
  return { x: (center.x + 1) * 200, y: (-center.y + 1) * 250 }
}

function designWithRooms() {
  let design: HouseDesign = { ...createDesign('nikai', 'square'), exterior: { ...createDesign('nikai', 'square').exterior, doghouse: 'red' } }
  const living = addRoom(design, 0, { type: 'living', style: 'natural', size: 'm', turned: false }, { x: 0, y: 0 })!
  design = living.design
  const entrance = addRoom(design, 0, { type: 'entrance', style: 'stone', size: 's', turned: false }, { x: 4, y: 5 })!
  return { design: entrance.design, living: living.room, entrance: entrance.room }
}

test('canvasを つくって すぐ みせ、すてると canvas・observer・RAF・GPU資源が のこらない', () => {
  const { design } = designWithRooms()
  const first = setup(design)
  expect(first.host.querySelectorAll('canvas')).toHaveLength(1)
  expect(first.callbacks.status).toHaveBeenLastCalledWith('ready')
  flush(performance.now())
  expect(lastScene().getObjectByName('house-outside')).toBeDefined()
  first.scene.dispose()
  expect(first.host.querySelector('canvas')).toBeNull()
  expect(frames.size).toBe(0)
  expect(mock.disconnect).toHaveBeenCalledOnce()
  expect(mock.dispose).toHaveBeenCalledOnce()
  expect(lastScene().getObjectByName('house-outside')).toBeUndefined()
  // さいど はいっても ふつうに うごく。
  const second = setup(design)
  expect(second.callbacks.status).toHaveBeenLastCalledWith('ready')
  second.scene.dispose()
  expect(mock.dispose).toHaveBeenCalledTimes(2)
})

test('WebGL が つかえない・とちゅうで きえた ときは error を しらせて かくのを やめる', () => {
  const { design } = designWithRooms()
  mock.fail = true
  const failed = setup(design)
  expect(failed.callbacks.status).toHaveBeenLastCalledWith('error')
  expect(failed.host.querySelector('canvas')).toBeNull()
  expect(() => { failed.scene.turn(1); failed.scene.dispose() }).not.toThrow()

  mock.fail = false
  const active = setup(design)
  active.host.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  expect(active.callbacks.status).toHaveBeenLastCalledWith('error')
  expect(frames.size).toBe(0)
  active.scene.turn(1)
  expect(frames.size).toBe(0)
  active.scene.dispose()
})

test('はじめの うごきと かざりの アニメーションが おわると かきつづけない', () => {
  const { design } = designWithRooms()
  const active = setup(design)
  const start = performance.now()
  flush(start + 500)
  expect(frames.size).toBe(1)
  flush(start + 60000)
  expect(frames.size).toBe(0)
  const renders = mock.render.mock.calls.length
  active.scene.zoom(1)
  expect(frames.size).toBe(1)
  flush(performance.now() + 60000)
  expect(mock.render.mock.calls.length).toBeGreaterThan(renders)
  expect(frames.size).toBe(0)
  active.scene.dispose()
})

test('うごきを へらす せっていでは はじめから とまった え に する', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  const { design } = designWithRooms()
  const active = setup(design)
  flush(performance.now())
  expect(mock.render).toHaveBeenCalledOnce()
  expect(frames.size).toBe(0)
  active.scene.dispose()
})

test('ドア・いぬを タップすると しらせ、ドラッグは まわすだけ', () => {
  const { design } = designWithRooms()
  const { host, callbacks, scene } = setup(design)
  flush(performance.now() + 60000)
  const door = screenOf(lastScene().getObjectByName('door')!.children[0])
  pointer(host, 'pointerdown', door.x, door.y)
  pointer(host, 'pointerup', door.x, door.y)
  expect(callbacks.spot).toHaveBeenLastCalledWith('door')
  const dog = screenOf(lastScene().getObjectByName('doghouse')!)
  pointer(host, 'pointerdown', dog.x, dog.y)
  pointer(host, 'pointerup', dog.x, dog.y)
  expect(callbacks.spot).toHaveBeenLastCalledWith('dog')
  expect(callbacks.spot).toHaveBeenCalledTimes(2)

  const before = lastCamera().position.clone()
  pointer(host, 'pointerdown', 200, 250)
  pointer(host, 'pointermove', 260, 270)
  pointer(host, 'pointerup', 260, 270)
  flush(performance.now() + 60000)
  expect(lastCamera().position.distanceTo(before)).toBeGreaterThan(1)
  expect(callbacks.spot).toHaveBeenCalledTimes(2)
  scene.dispose()
})

test('へやに きりかえると まえの いえを すて、カメラに ちかい かべを ひくく する', () => {
  const { design, living, entrance } = designWithRooms()
  const { host, callbacks, scene } = setup(design)
  flush(performance.now())
  const geo = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose')
  scene.show(design, { kind: 'room', roomId: living.id })
  expect(geo).toHaveBeenCalled()
  flush(performance.now() + 60000)
  const room = lastScene()
  expect(room.getObjectByName('house-outside')).toBeUndefined()
  expect(room.getObjectByName(`room-${living.id}`)).toBeDefined()
  const isLow = (side: string) => room.getObjectByName(`wall-${side}`)!.children[1].visible
  // さいしょは みぎまえ から みる。
  expect(['front', 'right', 'back', 'left'].map(isLow)).toEqual([true, true, false, false])
  scene.turn(1)
  scene.turn(1)
  scene.turn(1)
  flush(performance.now() + 60000)
  expect(['front', 'right', 'back', 'left'].map(isLow)).toEqual([false, true, true, false])
  // へやを タップすると room。
  pointer(host, 'pointerdown', 200, 250)
  pointer(host, 'pointerup', 200, 250)
  expect(callbacks.spot).toHaveBeenLastCalledWith('room')

  // げんかんは おもての ドアが みえる うしろがわ から みる。
  scene.show(design, { kind: 'room', roomId: entrance.id })
  flush(performance.now() + 60000)
  const hall = lastScene()
  expect(hall.getObjectByName(`room-${living.id}`)).toBeUndefined()
  expect(hall.getObjectByName('wall-front')!.children[0].visible).toBe(true)
  expect(hall.getObjectByName('wall-back')!.children[1].visible).toBe(true)
  // おなじ ものを もういちど みせても つくりなおさない。
  const count = geo.mock.calls.length
  scene.show(design, { kind: 'room', roomId: entrance.id })
  expect(geo.mock.calls.length).toBe(count)
  scene.dispose()
})
