import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { clampTarget, headingFromYaw, useCraftScene, type CraftSceneOptions } from './useCraftScene'
import { ANIMAL_SPAWNS, herdFrom } from './animals'
import { createWorld, DEFAULT_WORLD, editWorld, MATERIALS, startWalker } from './world'

const resources = vi.hoisted(() => ({
  render: vi.fn(), rendererDispose: vi.fn(), controlsDispose: vi.fn(), disconnect: vi.fn(),
  orbit: null as { target: THREE.Vector3; camera: THREE.Camera } | null,
}))
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
  constructor(public camera: THREE.Camera) { resources.orbit = this }
  update() { this.camera.lookAt(this.target) }
  addEventListener() {}
  removeEventListener() {}
  dispose = resources.controlsDispose
} }))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers() })

const SIZE = DEFAULT_WORLD.size
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
  let meshesCreated = 0
  for (let entry = 1; entry <= 2; entry++) {
    const view = renderHook(() => useCraftScene(props))
    act(() => view.result.current.setContainer(container))
    const canvas = container.querySelector('canvas')!
    const removeListener = vi.spyOn(canvas, 'removeEventListener')
    expect(canvas).not.toBeNull()
    expect(view.result.current.api.current).not.toBeNull()
    const [scene] = resources.render.mock.lastCall as [THREE.Scene]
    scene.traverse(object => { if (object instanceof THREE.InstancedMesh) meshesCreated++ })
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
  expect(materialDispose).toHaveBeenCalledTimes((MATERIALS.length + 2) * 2)
  expect(textureDispose).toHaveBeenCalledTimes(MATERIALS.length * 2)
  expect(meshesCreated).toBeGreaterThan(2)
  expect(meshDispose).toHaveBeenCalledTimes(meshesCreated)
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

it('draws slowly for visible water alone and redraws immediately after an edit', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const frames = stubFrames()
  const container = document.createElement('div')
  const props = options()
  const view = renderHook(next => useCraftScene(next), { initialProps: props })
  act(() => view.result.current.setContainer(container))
  resources.render.mockClear()
  for (let time = 16; time <= 160; time += 16) frames.run(time)
  expect(resources.render).toHaveBeenCalledTimes(2)
  const changes = editWorld(props.world, { x: 5, y: 3, z: 5 }, 'brick', 'place')
  expect(changes).toHaveLength(1)
  view.rerender({ ...props })
  expect(resources.render).toHaveBeenCalledTimes(3)
  view.unmount()
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

it('starts close to the cursor in a wide world, follows focus, and views the place walked to', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  stubFrames()
  const world = createWorld({ size: 96, height: 32 })
  const container = document.createElement('div')
  const cursor = { x: 48, y: 0, z: 48 }
  const view = renderHook(props => useCraftScene(props), { initialProps: options({ world, cursor }) })
  act(() => view.result.current.setContainer(container))
  const { target, camera } = resources.orbit!
  const ground = world.topY(48, 48, true)
  expect(target.toArray()).toEqual([48, ground, 48])
  // せかいの ひろさに かかわらず、ブロックが よく みえる きょりから はじまる
  const offset = camera.position.clone().sub(target)
  expect(offset.length()).toBeLessThan(40)
  const api = view.result.current.api.current!
  resources.render.mockClear()
  act(() => api.focus(80, 12))
  expect(target.toArray()).toEqual([80, world.topY(80, 12, true), 12])
  expect(camera.position.clone().sub(target).toArray()).toEqual(offset.toArray())
  expect(resources.render).toHaveBeenCalled()
  // あるいた さきで やめると、その ばしょを おなじ むきで ながめる
  view.rerender(options({ world, cursor, walker: startWalker(world, 80, 12) }))
  const far = startWalker(world, 20, 70)
  view.rerender(options({ world, cursor, walker: far }))
  act(() => api.focus(5, 5))
  expect(target.toArray()).toEqual([80, world.topY(80, 12, true), 12])
  view.rerender(options({ world, cursor, walker: null }))
  expect(target.toArray()).toEqual([far.x, far.y, far.z])
  const after = camera.position.clone().sub(target)
  expect(after.distanceTo(offset)).toBeLessThan(1e-9)
  view.unmount()
})

it('batches animals and preserves wool, shearing, babies and hearts', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const frames = stubFrames()
  vi.spyOn(Math, 'random').mockReturnValue(0.9)
  const herd = herdFrom(ANIMAL_SPAWNS)
  const container = document.createElement('div')
  const props = options({ herd, sky: '#f4dfae' })
  const view = renderHook(next => useCraftScene(next), { initialProps: props })
  act(() => view.result.current.setContainer(container))
  const [scene] = resources.render.mock.lastCall as [THREE.Scene]
  const [mesh] = scene.children.filter(o => o instanceof THREE.InstancedMesh)
  expect(mesh.count).toBe(23)
  const color = new THREE.Color()
  mesh.getColorAt(6, color)
  expect(color.getHexString()).toBe('f5a8c8')
  const changed = [...herd.slice(1).map(a => a.kind === 'sheep' ? { ...a, sheared: true, love: true } : a),
    { id: 9, kind: 'sheep' as const, x: 3, z: 3, wool: 'blue' as const, baby: true }]
  view.rerender({ ...props, herd: changed, night: true })
  expect(scene.children.filter(o => o instanceof THREE.InstancedMesh)).toEqual([mesh])
  expect(mesh.count).toBe(26)
  mesh.getColorAt(0, color)
  expect(color.getHexString()).toBe('efcdb9')
  mesh.getColorAt(6, color)
  expect(color.getHexString()).toBe('ff4f7b')
  mesh.getColorAt(20, color)
  expect(color.getHexString()).toBe('8fcdf2')
  const matrix = new THREE.Matrix4()
  mesh.getMatrixAt(0, matrix)
  expect(matrix.elements[0]).toBeCloseTo(0.5)
  mesh.getMatrixAt(20, matrix)
  expect(matrix.elements[0]).toBeCloseTo(0.7 * 0.55)
  const topY = vi.spyOn(props.world, 'topY')
  for (let time = 16; time <= 160; time += 16) frames.run(time)
  expect(topY).not.toHaveBeenCalled()
  editWorld(props.world, { x: changed[0].x, y: 3, z: changed[0].z }, 'brick', 'place')
  expect(topY.mock.calls).toEqual([[changed[0].x, changed[0].z, true], [changed[0].x, changed[0].z, true]])
  view.unmount()
})

it('selects the animal when it is in front of terrain and shows its tap hop', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const frames = stubFrames()
  vi.spyOn(Math, 'random').mockReturnValue(0.9)
  const herd = herdFrom([ANIMAL_SPAWNS[0]])
  const onAnimal = vi.fn()
  const props = options({ herd, onAnimal })
  const view = renderHook(next => useCraftScene(next), { initialProps: props })
  act(() => view.result.current.setContainer(document.createElement('div')))
  const [scene, camera] = resources.render.mock.lastCall as [THREE.Scene, THREE.PerspectiveCamera]
  const [mesh] = scene.children.filter(o => o instanceof THREE.InstancedMesh)
  const matrix = new THREE.Matrix4()
  mesh.getMatrixAt(0, matrix)
  const target = new THREE.Vector3().setFromMatrixPosition(matrix)
  // The legacy raycaster tested the hidden heart parts as well.
  camera.position.set(herd[0].x - 0.08, target.y + 0.66, herd[0].z + 2)
  camera.lookAt(herd[0].x - 0.08, target.y + 0.66, herd[0].z)
  act(() => view.result.current.api.current?.actAtCenter('pick'))
  expect(onAnimal).toHaveBeenCalledOnce()
  onAnimal.mockClear()
  camera.position.copy(target).add(new THREE.Vector3(0, 5, 0))
  camera.lookAt(target)
  act(() => view.result.current.api.current?.actAtCenter('pick'))
  expect(onAnimal).toHaveBeenCalledWith(herd[0], { x: herd[0].x, z: herd[0].z })
  expect(props.onPick).not.toHaveBeenCalled()
  for (let time = 16; time <= 160; time += 16) frames.run(time)
  mesh.getMatrixAt(0, matrix)
  expect(matrix.elements[13]).toBeGreaterThan(target.y + 0.3)
  onAnimal.mockClear()
  for (let y = 3; y <= 6; y++) editWorld(props.world, { x: herd[0].x, y, z: herd[0].z }, 'brick', 'place')
  act(() => view.result.current.api.current?.actAtCenter('pick'))
  expect(onAnimal).not.toHaveBeenCalled()
  expect(props.onPick).toHaveBeenCalledWith({ x: herd[0].x, y: 6, z: herd[0].z }, { x: 0, y: 1, z: 0 })
  view.unmount()
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
  expect(clampTarget(target, camera, DEFAULT_WORLD)).toBe(true)
  expect(target.x).toBeLessThanOrEqual(SIZE)
  expect(target.z).toBeGreaterThanOrEqual(-1)
  expect(target.y).toBeLessThan(SIZE)
  expect(camera.clone().sub(target)).toEqual(offset)
  expect(clampTarget(new THREE.Vector3(SIZE / 2, 2, SIZE / 2), new THREE.Vector3(), DEFAULT_WORLD)).toBe(false)
})
