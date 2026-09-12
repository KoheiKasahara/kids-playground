import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { BUILD_HEIGHT, initialCourse } from './marbleModel'
import { owningPartId, useMarbleEngine } from './useMarbleEngine'

const mocks = vi.hoisted(() => ({ initialize: vi.fn<() => Promise<void>>(), createScene: vi.fn(), createWorld: vi.fn() }))
vi.mock('../../physics/rapierLoader', () => ({ initializeRapier: mocks.initialize }))
vi.mock('./marbleScene', () => ({ createMarbleScene: mocks.createScene }))
vi.mock('./marbleWorld', () => ({ createMarbleWorld: mocks.createWorld }))
let frame: FrameRequestCallback
beforeEach(() => {
  mocks.initialize.mockReset().mockResolvedValue()
  mocks.createScene.mockReset().mockImplementation((host: HTMLDivElement) => {
    const canvas = document.createElement('canvas')
    host.appendChild(canvas)
    return { renderer: { domElement: canvas }, camera: new THREE.OrthographicCamera(), root: new THREE.Group(), ball: new THREE.Mesh(), geometries: {}, update: vi.fn(), select: vi.fn(), render: vi.fn(), zoom: vi.fn(), zoomBy: vi.fn(), pan: vi.fn(), overview: vi.fn(), syncMechanisms: vi.fn(), effect: vi.fn(), dispose: vi.fn(() => canvas.remove()) }
  })
  mocks.createWorld.mockReset().mockImplementation(() => ({ step: vi.fn(() => 'rolling'), consumeEvents: () => [], mechanismPoses: () => [], ball: { translation: () => ({ x: 1, y: 3, z: 0 }), rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }) }, dispose: vi.fn() }))
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1 })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function setup() {
  let engine!: ReturnType<typeof useMarbleEngine>
  const onCommit = vi.fn(), onPhase = vi.fn(), onSelect = vi.fn()
  const course = initialCourse()
  function Harness() {
    engine = useMarbleEngine({ course, selectedId: 'part-0', onCommit, onPhase, onSelect, onSnap: vi.fn() })
    const { registerContainer } = engine
    return <div ref={registerContainer} />
  }
  const result = render(<Harness />)
  return { ...result, current: () => engine, onCommit, onPhase, onSelect }
}

it('owns one world per run and disposes worlds, scene and RAF on stop/exit', async () => {
  const app = setup()
  await waitFor(() => expect(app.current().status).toBe('ready'))
  act(() => app.current().roll())
  const first = mocks.createWorld.mock.results[0]!.value
  act(() => app.current().roll())
  expect(first.dispose).toHaveBeenCalledOnce()
  act(() => { frame(100); frame(150) })
  const second = mocks.createWorld.mock.results[1]!.value
  expect(second.step).toHaveBeenCalled()
  expect(mocks.createScene.mock.results[0]!.value.syncMechanisms).toHaveBeenCalled()
  act(() => app.current().stop())
  expect(second.dispose).toHaveBeenCalledOnce()
  const scene = mocks.createScene.mock.results[0]!.value
  app.unmount()
  expect(scene.dispose).toHaveBeenCalledOnce()
  expect(window.cancelAnimationFrame).toHaveBeenCalled()
  expect(document.querySelectorAll('canvas')).toHaveLength(0)
})

it('resolves child meshes such as spinner tips to the owning part', () => {
  const root = new THREE.Group(), part = new THREE.Mesh(), bar = new THREE.Mesh(), tip = new THREE.Mesh()
  part.userData.partId = 'spinner'
  root.add(part); part.add(bar); bar.add(tip)
  expect(owningPartId(tip)).toBe('spinner')
  expect(owningPartId(root)).toBeUndefined()
})

it('ignores late initialization after exit, and starts fresh on re-entry', async () => {
  let resolve!: () => void
  mocks.initialize.mockImplementationOnce(() => new Promise<void>(done => { resolve = done }))
  const first = setup()
  first.unmount()
  await act(async () => { resolve(); await Promise.resolve() })
  expect(mocks.createWorld).not.toHaveBeenCalled()
  const second = setup()
  await waitFor(() => expect(second.current().status).toBe('ready'))
  expect(mocks.createScene).toHaveBeenCalledTimes(2)
  expect(document.querySelectorAll('canvas')).toHaveLength(1)
})

it('rolls back interrupted palette drags and removes its window listeners', async () => {
  const app = setup()
  await waitFor(() => expect(app.current().status).toBe('ready'))
  const event = Object.assign(new Event('pointerdown'), { pointerId: 1, clientX: 100, clientY: 500, button: 0 }) as PointerEvent
  act(() => app.current().palette('curve', event))
  act(() => window.dispatchEvent(new Event('blur')))
  act(() => window.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 1 })))
  expect(app.onCommit).not.toHaveBeenCalled()
  app.unmount()
  act(() => window.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 1 })))
  expect(app.onCommit).not.toHaveBeenCalled()
})

it('cancels an unfinished palette gesture when rolling starts, so its release cannot edit the running course', async () => {
  const app = setup()
  await waitFor(() => expect(app.current().status).toBe('ready'))
  const pointer = (type: string) => Object.assign(new Event(type), { pointerId: 8, clientX: 100, clientY: 500, button: 0 }) as PointerEvent
  act(() => app.current().palette('spinner', pointer('pointerdown')))
  act(() => app.current().roll())
  act(() => window.dispatchEvent(pointer('pointerup')))
  expect(app.onCommit).not.toHaveBeenCalled()
  expect(app.onPhase).toHaveBeenLastCalledWith('rolling')
})

it('retries rejected initialization, preserving its course', async () => {
  mocks.initialize.mockRejectedValueOnce(new Error('unavailable'))
  const app = setup()
  await waitFor(() => expect(app.current().status).toBe('error'))
  act(() => app.current().retry())
  await waitFor(() => expect(app.current().status).toBe('ready'))
  expect(mocks.createScene.mock.results[0]!.value.dispose).toHaveBeenCalledOnce()
})

it('projects a palette drag onto the board and commits its snapped height once', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400, toJSON: () => ({}) })
  const app = setup()
  await waitFor(() => expect(app.current().status).toBe('ready'))
  const scene = mocks.createScene.mock.results[0]!.value
  const camera = scene.camera as THREE.OrthographicCamera
  Object.assign(camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.1, far: 100 })
  camera.position.set(0, 20, 0)
  camera.up.set(0, 0, -1)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  const pointer = (type: string, x: number, y: number) => Object.assign(new Event(type), { pointerId: 3, clientX: x, clientY: y, button: 0 }) as PointerEvent
  act(() => app.current().palette('straight', pointer('pointerdown', 200, 450)))
  act(() => window.dispatchEvent(pointer('pointermove', 290, 200)))
  expect(app.onCommit).not.toHaveBeenCalled()
  act(() => window.dispatchEvent(pointer('pointerup', 290, 200)))
  expect(app.onCommit).toHaveBeenCalledOnce()
  expect(app.onCommit.mock.calls[0]![0].parts[1].position).toEqual({ x: 4, y: BUILD_HEIGHT, z: 0 })
})

it('drags the camera on empty board and pinches to zoom, without touching the course', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400, toJSON: () => ({}) })
  const app = setup()
  await waitFor(() => expect(app.current().status).toBe('ready'))
  const scene = mocks.createScene.mock.results[0]!.value
  const canvas = document.querySelector('canvas')!
  const pointer = (type: string, id: number, x: number, y: number) => Object.assign(new Event(type, { bubbles: true }), { pointerId: id, clientX: x, clientY: y, button: 0, isPrimary: id === 1 }) as PointerEvent
  // Nothing is under the first finger, so dragging moves the view and clears the selection.
  act(() => canvas.dispatchEvent(pointer('pointerdown', 1, 100, 100)))
  expect(app.onSelect).toHaveBeenLastCalledWith(null)
  act(() => window.dispatchEvent(pointer('pointermove', 1, 130, 160)))
  expect(scene.pan).toHaveBeenCalledWith(30, 60)
  // A second finger takes over as a pinch: the spread doubles, and its middle keeps panning.
  act(() => canvas.dispatchEvent(pointer('pointerdown', 2, 130, 260)))
  act(() => window.dispatchEvent(pointer('pointermove', 2, 130, 360)))
  expect(scene.zoomBy).toHaveBeenCalledWith(2)
  expect(scene.pan).toHaveBeenLastCalledWith(0, 50)
  act(() => window.dispatchEvent(pointer('pointerup', 1, 130, 160)))
  act(() => window.dispatchEvent(pointer('pointerup', 2, 130, 360)))
  expect(app.onCommit).not.toHaveBeenCalled()
})
