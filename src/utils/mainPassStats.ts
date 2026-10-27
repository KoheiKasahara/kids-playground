import type { Camera, Object3D, Scene, WebGLRenderer } from 'three'

/** Keep pre-r185 main-pass budgets comparable. Three.js#33688 added shadow draws
 * to renderer.info; measure those via the public shadow callbacks and retain the
 * total separately. This never changes rendering or the renderer's counters. */
export function createMainPassStats(renderer: WebGLRenderer) {
  const tracked = new WeakSet<Object3D>()
  let shadowCalls = 0
  let shadowTriangles = 0
  let current = { calls: 0, triangles: 0, totalCalls: 0, totalTriangles: 0 }

  function track(object: Object3D) {
    if (tracked.has(object)) return
    tracked.add(object)
    const before = object.onBeforeShadow
    const after = object.onAfterShadow
    let calls = 0
    let triangles = 0
    object.onBeforeShadow = function (...args) {
      before.apply(this, args)
      calls = renderer.info.render.calls
      triangles = renderer.info.render.triangles
    }
    object.onAfterShadow = function (...args) {
      shadowCalls += renderer.info.render.calls - calls
      shadowTriangles += renderer.info.render.triangles - triangles
      after.apply(this, args)
    }
  }

  return {
    render(scene: Scene, camera: Camera) {
      shadowCalls = shadowTriangles = 0
      // A train or prize mesh can be added after the first frame.
      scene.traverse(track)
      renderer.render(scene, camera)
      const { calls, triangles } = renderer.info.render
      current = {
        calls: calls - shadowCalls, triangles: triangles - shadowTriangles,
        totalCalls: calls, totalTriangles: triangles,
      }
    },
    stats: () => current,
  }
}
