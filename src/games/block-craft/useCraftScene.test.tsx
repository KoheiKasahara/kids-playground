import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { clampTarget, useCraftScene } from './useCraftScene'
import { createWorld, MATERIALS, SIZE } from './world'

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
  update() {}
  addEventListener() {}
  removeEventListener() {}
  dispose = resources.controlsDispose
} }))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks() })

it('disposes GPU resources, observer and input handlers on exit and can enter again', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = resources.disconnect })
  const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose')
  const materialDispose = vi.spyOn(THREE.Material.prototype, 'dispose')
  const meshDispose = vi.spyOn(THREE.InstancedMesh.prototype, 'dispose')
  const world = createWorld()
  const cursor = { x: 5, y: 0, z: 5 }
  const pick = vi.fn()
  const container = document.createElement('div')
  for (let entry = 1; entry <= 2; entry++) {
    const view = renderHook(() => useCraftScene(world, cursor, pick))
    act(() => view.result.current.setContainer(container))
    const canvas = container.querySelector('canvas')!
    const removeListener = vi.spyOn(canvas, 'removeEventListener')
    expect(canvas).not.toBeNull()
    expect(view.result.current.api.current).not.toBeNull()
    view.unmount()
    expect(container.children).toHaveLength(0)
    expect(resources.rendererDispose).toHaveBeenCalledTimes(entry)
    expect(resources.controlsDispose).toHaveBeenCalledTimes(entry)
    expect(resources.disconnect).toHaveBeenCalledTimes(entry)
    expect(removeListener.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining(['pointerdown', 'pointerup', 'pointercancel', 'webglcontextlost']))
  }
  expect(geometryDispose).toHaveBeenCalledTimes(6)
  expect(materialDispose).toHaveBeenCalledTimes((MATERIALS.length + 1) * 2)
  expect(meshDispose).toHaveBeenCalledTimes(MATERIALS.length * 2)
})

it('reports WebGL context loss without scheduling a background rendering loop', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const world = createWorld()
  const cursor = { x: 5, y: 0, z: 5 }
  const pick = vi.fn()
  const container = document.createElement('div')
  const view = renderHook(() => useCraftScene(world, cursor, pick))
  act(() => view.result.current.setContainer(container))
  act(() => { container.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost')) })
  expect(view.result.current.failed).toBe(true)
  view.unmount()
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
