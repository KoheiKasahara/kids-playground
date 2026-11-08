import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { clampTarget, headingFromYaw, useCraftScene, type CraftSceneOptions } from './useCraftScene'
import { ANIMAL_SPAWNS, herdFrom } from './animals'
import { createWorld, MATERIALS, SIZE, startWalker } from './world'

const resources = vi.hoisted(() => ({ render: vi.fn(), rendererDispose: vi.fn(), controlsDispose: vi.fn(), disconnect: vi.fn() }))
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof THREE>()
  return { ...actual, WebGLRenderer: class {
    domElement = document.createElement('canvas')
    setPixelRatio() {}
    setSize() {}
    render = resources.render
    dispose = resources.rendererDispose
  } }
})
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({ OrbitControls: class {
  target = new THREE.Vector3()
  touches = {}
  enabled = true
  update() {}
  addEventListener() {}
  removeEventListener() {}
  dispose = resources.controlsDispose
} }))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers() })

const ANIMAL_MATERIALS = 11
function options(overrides: Partial<CraftSceneOptions> = {}): CraftSceneOptions {
  return { world: createWorld(), cursor: { x: 5, y: 0, z: 5 }, onPick: vi.fn(), ...overrides }
}
function stubFrames() {
  const callbacks = new Map<number, FrameRequestCallback>()
  let next = 1
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.set(next, callback); return next++ })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { callbacks.delete(id) })
  /** まっている コールバックを 1かい うごかす。 */
  const run = (time: number) => { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback(time)) }
  return { run, pending: () => callbacks.size }
}

it('disposes GPU resources, observer, timers and input handlers on exit and can enter again', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = resources.disconnect })
  stubFrames()
  const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose')
  const materialDispose = vi.spyOn(THREE.Material.prototype, 'dispose')
  const textureDispose = vi.spyOn(THREE.Texture.prototype, 'dispose')
  const meshDispose = vi.spyOn(THREE.InstancedMesh.prototype, 'dispose')
  const props = options()
  const container = document.createElement('div')
  for (let entry = 1; entry <= 2; entry++) {
    const view = renderHook(() => useCraftScene(props))
    act(() => view.result.current.setContainer(container))
    const canvas = container.querySelector('canvas')!
    const removeListener = vi.spyOn(canvas, 'removeEventListener')
    expect(canvas).not.toBeNull()
    expect(view.result.current.api.current).not.toBeNull()
    view.unmount()
    expect(view.result.current.api.current).toBeNull()
    expect(container.children).toHaveLength(0)
    expect(resources.rendererDispose).toHaveBeenCalledTimes(entry)
    expect(resources.controlsDispose).toHaveBeenCalledTimes(entry)
    expect(resources.disconnect).toHaveBeenCalledTimes(entry)
    expect(removeListener.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining(['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'webglcontextlost']))
  }
  // ブロック・どうぶつ・わく（わくの もとの はこは つくる ときに すてる）
  expect(geometryDispose).toHaveBeenCalledTimes(4 * 2)
  expect(materialDispose).toHaveBeenCalledTimes((MATERIALS.length + ANIMAL_MATERIALS + 1) * 2)
  expect(textureDispose).toHaveBeenCalledTimes(MATERIALS.length * 2)
  expect(meshDispose).toHaveBeenCalledTimes(MATERIALS.length * 2)
})

it('animates only while the game is visible and stops the loop on blur, context loss and exit', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const frames = stubFrames()
  const container = document.createElement('div')
  const view = renderHook(props => useCraftScene(props), { initialProps: options() })
  act(() => view.result.current.setContainer(container))
  expect(frames.pending()).toBe(1)
  act(() => { frames.run(16); frames.run(32) })
  expect(frames.pending()).toBe(1)
  act(() => { window.dispatchEvent(new Event('blur')) })
  expect(frames.pending()).toBe(0)
  act(() => { window.dispatchEvent(new Event('focus')) })
  expect(frames.pending()).toBe(1)
  act(() => { container.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost')) })
  expect(view.result.current.failed).toBe(true)
  expect(frames.pending()).toBe(0)
  act(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')) })
  expect(frames.pending()).toBe(0)
  view.unmount()
  expect(frames.pending()).toBe(0)
})

it('switches to walking, turns, and keeps animating animals without errors', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const frames = stubFrames()
  const world = createWorld()
  const container = document.createElement('div')
  const view = renderHook(props => useCraftScene(props), { initialProps: options({ world }) })
  act(() => view.result.current.setContainer(container))
  view.rerender(options({ world, walker: startWalker(world, 8, 8), night: true }))
  const api = view.result.current.api.current!
  const facing = api.heading()
  expect(Math.abs(facing.x) + Math.abs(facing.z)).toBe(1)
  act(() => { api.turn('left'); api.turn('left') })
  expect(api.heading()).toEqual({ x: -facing.x || 0, z: -facing.z || 0 })
  for (let time = 16; time < 5000; time += 16) frames.run(time)
  view.rerender(options({ world, walker: null }))
  expect(resources.render).toHaveBeenCalled()
  view.unmount()
})

it('adds, dresses and removes animals as the herd changes, sharing their materials', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const frames = stubFrames()
  const materialDispose = vi.spyOn(THREE.Material.prototype, 'dispose')
  const add = vi.spyOn(THREE.Scene.prototype, 'add')
  const remove = vi.spyOn(THREE.Scene.prototype, 'remove')
  const herd = herdFrom(ANIMAL_SPAWNS)
  const container = document.createElement('div')
  const view = renderHook(props => useCraftScene(props), { initialProps: options({ herd, sky: '#f4dfae' }) })
  act(() => view.result.current.setContainer(container))
  const animalsAdded = () => add.mock.calls.filter(([object]) => object.userData.animalId !== undefined).length
  expect(animalsAdded()).toBe(ANIMAL_SPAWNS.length)
  const changed = [...herd.slice(1).map(a => a.kind === 'sheep' ? { ...a, sheared: true, love: true } : a), { id: 9, kind: 'sheep' as const, x: 3, z: 3, wool: 'blue' as const, baby: true }]
  view.rerender(options({ herd: changed, night: true }))
  expect(animalsAdded()).toBe(ANIMAL_SPAWNS.length + 1)
  expect(remove).toHaveBeenCalledTimes(1)
  for (let time = 16; time < 2000; time += 16) frames.run(time)
  view.unmount()
  expect(materialDispose).toHaveBeenCalledTimes(MATERIALS.length + ANIMAL_MATERIALS + 1)
})

it('treats a long press as choosing a block, never as placing one', () => {
  vi.useFakeTimers()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  stubFrames()
  const onPick = vi.fn()
  const onHold = vi.fn()
  const container = document.createElement('div')
  const view = renderHook(props => useCraftScene(props), { initialProps: options({ onPick, onHold }) })
  act(() => view.result.current.setContainer(container))
  const canvas = container.querySelector('canvas')!
  const pointer = (type: string) => canvas.dispatchEvent(Object.assign(new Event(type), { clientX: 10, clientY: 10, pointerId: 1, isPrimary: true, button: 0 }))
  pointer('pointerdown')
  vi.advanceTimersByTime(1000)
  pointer('pointerup')
  expect(onPick).not.toHaveBeenCalled()
  pointer('pointerdown')
  view.unmount()
  vi.advanceTimersByTime(1000)
  expect(onHold).not.toHaveBeenCalled()
})

it('turns a camera angle into one of four walking directions', () => {
  expect(headingFromYaw(0)).toEqual({ x: 0, z: -1 })
  expect(headingFromYaw(Math.PI / 2)).toEqual({ x: -1, z: 0 })
  expect(headingFromYaw(Math.PI)).toEqual({ x: 0, z: 1 })
  expect(headingFromYaw(-Math.PI / 2 + 0.3)).toEqual({ x: 1, z: 0 })
})

it('keeps two-finger panning over the world without changing the viewing angle', () => {
  const target = new THREE.Vector3(SIZE + 20, 30, -50)
  const camera = new THREE.Vector3(SIZE + 30, 50, -40)
  const offset = camera.clone().sub(target)
  expect(clampTarget(target, camera)).toBe(true)
  expect(target.x).toBeLessThanOrEqual(SIZE)
  expect(target.z).toBeGreaterThanOrEqual(-1)
  expect(target.y).toBeLessThan(SIZE)
  expect(camera.clone().sub(target)).toEqual(offset)
  expect(clampTarget(new THREE.Vector3(SIZE / 2, 2, SIZE / 2), new THREE.Vector3())).toBe(false)
})
