import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createTown } from '../maps'
import { applyTool, COLS, createEmptyTown, type Town } from '../town'
import { createTownScene, pixelRatioFor } from './townScene'
import { tileCenter } from './townLayout'

const mock = vi.hoisted(() => ({ render: vi.fn(), dispose: vi.fn(), disconnect: vi.fn(), fail: false, resize: null as (() => void) | null }))

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
let clock = 0

beforeEach(() => {
  vi.clearAllMocks()
  mock.fail = false
  mock.resize = null
  frames = new Map()
  clock = 1000
  vi.stubGlobal('requestAnimationFrame', vi.fn((fn: FrameRequestCallback) => { frames.set(++serial, fn); return serial }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { mock.resize = callback }
    observe() {}
    disconnect = mock.disconnect
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  // OrbitControls が ゆびを つかまえる。jsdom には ないので なにも しない ものを おく。
  Object.assign(HTMLElement.prototype, { setPointerCapture: () => {}, releasePointerCapture: () => {}, hasPointerCapture: () => false })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

/** time ミリ秒 すすめる（60コマ/びょう）。 */
function advance(milliseconds: number) {
  const end = clock + milliseconds
  while (clock < end && frames.size) {
    clock = Math.min(end, clock + 16)
    for (const [id, frame] of [...frames]) {
      frames.delete(id)
      frame(clock)
    }
  }
}

function setup(town: Town = createTown(), night = false) {
  const host = document.createElement('div')
  document.body.append(host)
  Object.defineProperties(host, { clientWidth: { get: () => 400 }, clientHeight: { get: () => 600 } })
  const callbacks = { ready: vi.fn(), error: vi.fn(), tour: vi.fn(), pick: vi.fn() }
  const scene = createTownScene(host, town, night, callbacks)
  const canvas = host.querySelector('canvas')
  if (canvas) {
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 600, x: 0, y: 0, right: 400, bottom: 600, toJSON() {} })
    Object.defineProperties(canvas, { clientWidth: { get: () => 400 }, clientHeight: { get: () => 600 } })
  }
  return { host, canvas, callbacks, scene }
}

const lastScene = () => mock.render.mock.calls.at(-1)![0] as THREE.Scene
const lastCamera = () => mock.render.mock.calls.at(-1)![1] as THREE.PerspectiveCamera

function pointer(target: HTMLElement, type: string, x: number, y: number, id = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { pointerId: id, clientX: x, clientY: y, button: 0, pointerType: 'mouse' })
  target.dispatchEvent(event)
}

function tap(target: HTMLElement, x: number, y: number) {
  pointer(target, 'pointerdown', x, y)
  pointer(target, 'pointerup', x, y)
}

function screenOf(point: THREE.Vector3) {
  lastCamera().updateMatrixWorld()
  const projected = point.clone().project(lastCamera())
  return { x: (projected.x + 1) * 200, y: (-projected.y + 1) * 300 }
}

function trainTown(): Town {
  let town = createTown()
  for (let col = 1; col < 9; col += 1) town = applyTool(town, 3 * COLS + col, 'rail')
  for (let row = 3; row < 12; row += 1) town = applyTool(town, row * COLS + 8, 'rail')
  return town
}

it('draws the town in a canvas, keeps animating, and leaves nothing behind after dispose', () => {
  const first = setup()
  expect(first.canvas).not.toBeNull()
  // はじめの まちには さいしょから せんろの わが あり、でんしゃも はしる。
  expect(first.callbacks.ready).toHaveBeenCalledWith({ car: expect.any(Number), train: expect.any(Number) })
  expect(first.callbacks.ready.mock.calls[0][0].car).toBeGreaterThan(0)
  expect(first.callbacks.ready.mock.calls[0][0].train).toBeGreaterThan(0)
  advance(500)
  expect(lastScene().getObjectByName('town-3d')).toBeDefined()
  expect(frames.size).toBe(1)

  first.scene.dispose()
  expect(first.host.querySelector('canvas')).toBeNull()
  expect(frames.size).toBe(0)
  expect(mock.disconnect).toHaveBeenCalledOnce()
  expect(mock.dispose).toHaveBeenCalledOnce()
  expect(lastScene().getObjectByName('town-3d')).toBeUndefined()

  // もういちど ひらいても ふつうに うごく。
  const second = setup()
  expect(second.callbacks.ready).toHaveBeenCalledOnce()
  second.scene.dispose()
  expect(mock.dispose).toHaveBeenCalledTimes(2)
})

it('reports when WebGL is missing or lost and stops drawing', () => {
  mock.fail = true
  const failed = setup()
  expect(failed.callbacks.error).toHaveBeenCalledOnce()
  expect(failed.canvas).toBeNull()
  expect(() => { failed.scene.turn(1); failed.scene.ride('car'); failed.scene.dispose() }).not.toThrow()

  mock.fail = false
  const active = setup()
  active.canvas!.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  expect(active.callbacks.error).toHaveBeenCalledOnce()
  expect(frames.size).toBe(0)
  active.scene.dispose()
})

it('drives the cars along the roads while the page is shown and pauses when it is hidden', () => {
  const { scene } = setup()
  advance(100)
  const vehicles = lastScene().getObjectByName('town-vehicles')!
  const before = vehicles.children.map((car) => car.position.clone())
  advance(1500)
  const after = vehicles.children.map((car) => car.position.clone())
  expect(after.some((position, index) => position.distanceTo(before[index]) > 0.3)).toBe(true)

  window.dispatchEvent(new Event('blur'))
  expect(frames.size).toBe(0)
  window.dispatchEvent(new Event('focus'))
  expect(frames.size).toBe(1)
  scene.dispose()
})

it('swoops in, circles slowly, and stops circling once a finger turns the town', () => {
  const { canvas, callbacks, scene } = setup()
  advance(100)
  const start = lastCamera().position.clone()
  advance(2500)
  const settled = lastCamera().position.clone()
  expect(settled.length()).toBeLessThan(start.length())
  advance(1000)
  expect(lastCamera().position.distanceTo(settled)).toBeGreaterThan(0.01)

  pointer(canvas!, 'pointerdown', 200, 300)
  pointer(canvas!, 'pointermove', 260, 300)
  pointer(canvas!, 'pointerup', 260, 300)
  expect(callbacks.tour).toHaveBeenLastCalledWith(false)
  advance(1500)
  const resting = lastCamera().position.clone()
  advance(1000)
  expect(lastCamera().position.distanceTo(resting)).toBeLessThan(0.05)

  scene.setTour(true)
  advance(1000)
  expect(lastCamera().position.distanceTo(resting)).toBeGreaterThan(0.01)
  scene.dispose()
})

it('turns and zooms with the buttons', () => {
  const { scene } = setup()
  scene.setTour(false)
  advance(2500)
  const target = new THREE.Vector3(0, 0.2, 0)
  const distance = lastCamera().position.distanceTo(target)
  scene.zoom(1)
  advance(1500)
  expect(lastCamera().position.distanceTo(target)).toBeLessThan(distance * 0.9)
  scene.zoom(-1)
  scene.zoom(-1)
  advance(1500)
  expect(lastCamera().position.distanceTo(target)).toBeGreaterThan(distance * 1.05)

  const before = lastCamera().position.clone()
  scene.turn(1)
  advance(1500)
  const after = lastCamera().position.clone()
  expect(Math.atan2(after.x, after.z)).not.toBeCloseTo(Math.atan2(before.x, before.z), 1)
  scene.dispose()
})

it('rides a car or a train and flies back up to the sky view', () => {
  const town = trainTown()
  const { callbacks, scene } = setup(town)
  expect(callbacks.ready.mock.calls[0][0].train).toBeGreaterThan(0)
  scene.setTour(false)
  advance(2500)
  const sky = lastCamera().position.clone()

  expect(scene.ride('car')).toBe(true)
  advance(2500)
  const vehicles = lastScene().getObjectByName('town-vehicles')!
  const nearest = Math.min(...vehicles.children.map((vehicle) => vehicle.position.distanceTo(lastCamera().position)))
  expect(nearest).toBeLessThan(1.2)
  expect(lastCamera().position.y).toBeLessThan(0.6)

  expect(scene.ride('train')).toBe(true)
  advance(2500)
  expect(lastCamera().position.y).toBeLessThan(1)
  // のって いる あいだは ボタンで まわらない。
  const riding = lastCamera().position.clone()
  scene.turn(1)
  scene.zoom(1)
  expect(lastCamera().position).toEqual(riding)

  scene.land()
  advance(4000)
  expect(lastCamera().position.distanceTo(sky)).toBeLessThan(0.3)
  scene.dispose()

  const empty = setup(createEmptyTown())
  expect(empty.callbacks.ready).toHaveBeenCalledWith({ car: 0, train: 0 })
  expect(empty.scene.ride('car')).toBe(false)
  empty.scene.dispose()
})

it('tells what was tapped, and ignores drags and taps on the sky', () => {
  const { canvas, callbacks, scene } = setup()
  scene.setTour(false)
  advance(2500)
  // はしって いる くるまに あたらない よう、のりものは とおくへ どける。
  lastScene().getObjectByName('town-vehicles')!.position.y = -100
  lastScene().updateMatrixWorld(true)

  // 5れつめ・10ぎょうめ（index 9*COLS+4）の あかい おうち。
  const house = tileCenter(9 * COLS + 4)
  const point = screenOf(new THREE.Vector3(house.x, 0.2, house.z))
  tap(canvas!, point.x, point.y)
  expect(callbacks.pick).toHaveBeenLastCalledWith({ kind: 'part', part: 'house', bridge: false })

  // はしの うえの みち。
  const bridge = tileCenter(7 * COLS + 9)
  const onBridge = screenOf(new THREE.Vector3(bridge.x, 0.03, bridge.z))
  tap(canvas!, onBridge.x, onBridge.y)
  expect(callbacks.pick).toHaveBeenLastCalledWith({ kind: 'part', part: 'road', bridge: true })

  callbacks.pick.mockClear()
  tap(canvas!, 200, 2)
  pointer(canvas!, 'pointerdown', point.x, point.y)
  pointer(canvas!, 'pointermove', point.x + 40, point.y)
  pointer(canvas!, 'pointerup', point.x + 40, point.y)
  expect(callbacks.pick).not.toHaveBeenCalled()
  scene.dispose()
})

it('fades into the night sky with stars and back to day', () => {
  const { scene } = setup(createTown(), false)
  advance(100)
  const day = (lastScene().background as THREE.Color).clone()
  scene.setNight(true)
  advance(1000)
  const night = lastScene().background as THREE.Color
  expect(night.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(day.getHSL({ h: 0, s: 0, l: 0 }).l - 0.3)
  const stars = lastScene().getObjectByName('town-stars') as THREE.Points
  expect((stars.material as THREE.PointsMaterial).opacity).toBe(1)
  scene.setNight(false)
  advance(1000)
  expect((lastScene().background as THREE.Color).equals(day)).toBe(true)
  scene.dispose()

  const late = setup(createTown(), true)
  advance(50)
  expect((lastScene().getObjectByName('town-stars') as THREE.Points).material).toHaveProperty('opacity', 1)
  late.scene.dispose()
})

it('limits how finely it draws on phones and very large screens', () => {
  expect(pixelRatioFor(390, 700, 3)).toBe(1.5)
  expect(pixelRatioFor(900, 600, 2)).toBe(2)
  const wide = pixelRatioFor(1280, 720, 2)
  expect(1280 * 720 * wide * wide).toBeLessThanOrEqual(2_500_001)
  expect(pixelRatioFor(1280, 720, 1)).toBe(1)
  expect(pixelRatioFor(2560, 1440, 2)).toBeLessThan(1.3)
  expect(pixelRatioFor(5000, 5000, 1)).toBe(1)
})
