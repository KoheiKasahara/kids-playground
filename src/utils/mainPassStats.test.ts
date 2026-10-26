import { Camera, Group, Mesh, Scene, type WebGLRenderer } from 'three'
import { expect, it, vi } from 'vitest'
import { createMainPassStats } from './mainPassStats'

it('separates shadow draws, preserves callbacks and tracks meshes added between frames', () => {
  const scene = new Scene()
  const camera = new Camera()
  let shadows = true
  const counters = { calls: 0, triangles: 0 }
  const renderer = {
    info: { render: counters },
    render() {
      counters.calls = counters.triangles = 0
      if (shadows) scene.traverse(object => {
        if (!(object instanceof Mesh)) return
        const args = [renderer, scene, camera, camera, object.geometry, object.material, new Group()] as const
        object.onBeforeShadow(...args)
        counters.calls += 3
        counters.triangles += 30
        object.onAfterShadow(...args)
      })
      counters.calls += 5
      counters.triangles += 50
    },
  } as unknown as WebGLRenderer
  const mesh = new Mesh()
  const before = vi.fn()
  const after = vi.fn()
  mesh.onBeforeShadow = before
  mesh.onAfterShadow = after
  scene.add(mesh)
  const stats = createMainPassStats(renderer)
  stats.render(scene, camera)
  expect(stats.stats()).toEqual({ calls: 5, triangles: 50, totalCalls: 8, totalTriangles: 80 })
  expect(counters).toEqual({ calls: 8, triangles: 80 })
  scene.add(new Mesh())
  stats.render(scene, camera)
  expect(stats.stats()).toEqual({ calls: 5, triangles: 50, totalCalls: 11, totalTriangles: 110 })
  expect(before).toHaveBeenCalledTimes(2)
  expect(after).toHaveBeenCalledTimes(2)
  shadows = false
  stats.render(scene, camera)
  expect(stats.stats()).toEqual({ calls: 5, triangles: 50, totalCalls: 5, totalTriangles: 50 })
})
