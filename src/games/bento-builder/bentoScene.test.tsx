import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as THREE from 'three'
import { createBentoScene } from './bentoScene'
import { initialBentoState } from './bentoState'
const mock = vi.hoisted(() => ({
  load: vi.fn(), disposeObjects: vi.fn(), render: vi.fn(), dispose: vi.fn(), disconnect: vi.fn(),
}))
vi.mock('three', async importOriginal => {
  const real = await importOriginal<typeof import('three')>()
  return { ...real, WebGLRenderer: class {
    domElement = document.createElement('canvas')
    shadowMap = { enabled: false, type: 0 }
    setPixelRatio() {}
    setSize() {}
    render = mock.render
    dispose = mock.dispose
  } }
})
vi.mock('./bentoModels', async importOriginal => {
  const real = await importOriginal<typeof import('./bentoModels')>()
  return { ...real, loadFoodTemplates: mock.load, disposeObjects: mock.disposeObjects }
})
let pendingFrames: Map<number, FrameRequestCallback>
let serial = 0
beforeEach(() => {
  vi.clearAllMocks()
  pendingFrames = new Map()
  vi.stubGlobal('requestAnimationFrame', vi.fn((fn: FrameRequestCallback) => { pendingFrames.set(++serial, fn); return serial }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => pendingFrames.delete(id)))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = mock.disconnect })
})
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = '' })
function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  const callbacks = { select: vi.fn(), move: vi.fn(), status: vi.fn() }
  return { host, callbacks, scene: createBentoScene(host, initialBentoState, callbacks) }
}
const tick = async () => { await Promise.resolve(); await Promise.resolve() }
test('退出後に届くモデルを解放し、再入場でcanvas・observer・RAFが残らない', async () => {
  const templates = new Map([['egg', new THREE.Group()]] as const)
  let resolve!: (value: typeof templates) => void
  mock.load.mockReturnValueOnce(new Promise(done => { resolve = done }))
  const first = setup()
  expect(first.host.querySelectorAll('canvas')).toHaveLength(1)
  first.scene.dispose()
  expect(first.host.querySelector('canvas')).toBeNull()
  expect(pendingFrames.size).toBe(0)
  expect(mock.disconnect).toHaveBeenCalledOnce()
  expect(mock.dispose).toHaveBeenCalledOnce()
  resolve(templates)
  await tick()
  expect(mock.disposeObjects).toHaveBeenLastCalledWith([...templates.values()])
  expect(first.callbacks.status).not.toHaveBeenCalledWith('ready')
  mock.load.mockResolvedValueOnce(new Map())
  const second = setup()
  await tick()
  expect(second.callbacks.status).toHaveBeenLastCalledWith('ready')
  second.scene.dispose()
  expect(mock.dispose).toHaveBeenCalledTimes(2)
  expect(pendingFrames.size).toBe(0)
})
test('ロード失敗を通知し、WebGLコンテキスト消失後は描画を止める', async () => {
  mock.load.mockRejectedValueOnce(new Error('network'))
  const failed = setup()
  await tick()
  expect(failed.callbacks.status).toHaveBeenLastCalledWith('error')
  failed.scene.dispose()
  mock.load.mockResolvedValueOnce(new Map())
  const active = setup()
  await tick()
  active.host.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  expect(active.callbacks.status).toHaveBeenLastCalledWith('error')
  expect(pendingFrames.size).toBe(0)
  active.scene.dispose()
})
test('静止後の常時描画をせず、完成演出も4秒で終了する', async () => {
  mock.load.mockResolvedValueOnce(new Map())
  const active = setup()
  await tick()
  for (const [id, frame] of [...pendingFrames]) { pendingFrames.delete(id); frame(performance.now()) }
  expect(mock.render).toHaveBeenCalledOnce()
  expect(pendingFrames.size).toBe(0)
  active.scene.sync({ ...initialBentoState, mode: 'done' })
  expect(pendingFrames.size).toBe(1)
  for (const [id, frame] of [...pendingFrames]) { pendingFrames.delete(id); frame(performance.now() + 5000) }
  expect(pendingFrames.size).toBe(0)
  active.scene.dispose()
})
test('実Raycasterで食材をつかみ、底面への投影でドラッグ位置が確定する', async () => {
  const template = new THREE.Group()
  template.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), new THREE.MeshBasicMaterial()))
  template.children[0]!.position.y = 0.3
  mock.load.mockResolvedValueOnce(new Map([['egg', template]]))
  const host = document.createElement('div')
  document.body.append(host)
  Object.defineProperties(host, { clientWidth: { value: 400 }, clientHeight: { value: 400 } })
  host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400, x: 0, y: 0, right: 400, bottom: 400, toJSON() {} })
  const state = { ...initialBentoState, mode: 'edit' as const, foods: [{ id: 1, kind: 'egg' as const, x: 0, z: 0, rotation: 0 }] }
  const callbacks = { select: vi.fn(), move: vi.fn(), status: vi.fn() }
  const handle = createBentoScene(host, state, callbacks)
  await tick()
  for (const [id, frame] of [...pendingFrames]) { pendingFrames.delete(id); frame(performance.now() + 400) }
  const camera = mock.render.mock.calls.at(-1)![1] as THREE.Camera
  const projected = new THREE.Vector3(0, 0.515, 0).project(camera)
  const x = (projected.x + 1) * 200
  const y = (-projected.y + 1) * 200
  function pointer(type: string, clientX: number) {
    const event = new Event(type, { cancelable: true })
    Object.assign(event, { pointerId: 1, clientX, clientY: y, button: 0, isPrimary: true })
    host.dispatchEvent(event)
  }
  pointer('pointerdown', x)
  expect(callbacks.select).toHaveBeenCalledWith(1)
  pointer('pointermove', x + 40)
  pointer('pointerup', x + 40)
  expect(callbacks.move).toHaveBeenCalledOnce()
  expect(callbacks.move.mock.calls[0]![0]).toBe(1)
  expect(callbacks.move.mock.calls[0]![1].x).toBeCloseTo(0.73)
  expect(callbacks.move.mock.calls[0]![1].z).toBeCloseTo(0)
  handle.dispose()
})
