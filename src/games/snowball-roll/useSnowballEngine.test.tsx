import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as THREE from 'three'
import { useSnowballEngine } from './useSnowballEngine'

const gpu = vi.hoisted(() => ({
  fail: false,
  instances: [] as { domElement: HTMLCanvasElement; dispose: ReturnType<typeof vi.fn>; forceContextLoss: ReturnType<typeof vi.fn>; render: ReturnType<typeof vi.fn> }[],
}))
vi.mock('three', async importOriginal => {
  const original = await importOriginal<typeof THREE>()
  return {
    ...original,
    WebGLRenderer: class {
      domElement = document.createElement('canvas')
      dispose = vi.fn()
      forceContextLoss = vi.fn()
      render = vi.fn()
      setPixelRatio = vi.fn()
      setSize = vi.fn()
      constructor() {
        if (gpu.fail) throw new Error('WebGL unavailable')
        gpu.instances.push(this)
      }
    },
  }
})
const frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0
const disconnect = vi.fn()
beforeEach(() => {
  gpu.fail = false
  gpu.instances.length = 0
  frames.clear()
  disconnect.mockClear()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function tick(now: number) {
  act(() => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach(callback => callback(now))
  })
}
function mount() {
  const update = vi.fn()
  const hook = renderHook(() => useSnowballEngine(update))
  const container = document.createElement('div')
  act(() => hook.result.current.registerContainer(container))
  return { ...hook, container, update }
}

test('first frame makes the scene ready; exit disposes RAF, canvas, geometries and materials; re-entry creates one scene', () => {
  const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose')
  const materialDispose = vi.spyOn(THREE.Material.prototype, 'dispose')
  const first = mount()
  expect(first.result.current.status).toBe('loading')
  tick(1000)
  expect(first.result.current.status).toBe('ready')
  expect(gpu.instances[0]!.render).toHaveBeenCalledOnce()
  expect(first.container.querySelectorAll('canvas')).toHaveLength(1)
  first.result.current.directionRef.current = { x: 1, z: 0 }
  tick(1016)
  first.unmount()
  expect(frames.size).toBe(0)
  expect(first.container.children).toHaveLength(0)
  expect(disconnect).toHaveBeenCalledOnce()
  expect(gpu.instances[0]!.dispose).toHaveBeenCalledOnce()
  expect(gpu.instances[0]!.forceContextLoss).toHaveBeenCalledOnce()
  expect(geometryDispose).toHaveBeenCalledTimes(5)
  expect(materialDispose).toHaveBeenCalled()
  const second = mount()
  tick(2000)
  expect(second.result.current.status).toBe('ready')
  expect(second.result.current.directionRef.current).toEqual({ x: 0, z: 0 })
  expect(frames.size).toBe(1)
  expect(gpu.instances).toHaveLength(2)
  second.unmount()
  expect(frames.size).toBe(0)
})

test('context loss stops simulation and exposes retry status; window blur clears motion', () => {
  const hook = mount()
  tick(1000)
  hook.result.current.directionRef.current = { x: 1, z: 1 }
  act(() => window.dispatchEvent(new Event('blur')))
  expect(hook.result.current.directionRef.current).toEqual({ x: 0, z: 0 })
  act(() => gpu.instances[0]!.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
  expect(hook.result.current.status).toBe('error')
  expect(frames.size).toBe(0)
  hook.unmount()
  expect(gpu.instances[0]!.dispose).toHaveBeenCalledOnce()
})

test('failed initialization reports an error and still releases owned geometry on exit', async () => {
  gpu.fail = true
  const dispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose')
  const hook = mount()
  await act(async () => { await Promise.resolve() })
  expect(hook.result.current.status).toBe('error')
  expect(frames.size).toBe(0)
  hook.unmount()
  expect(dispose).toHaveBeenCalledTimes(5)
})
