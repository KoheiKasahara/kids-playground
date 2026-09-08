import * as THREE from 'three'
import { createBox, createFoodCup, disposeObjects, loadFoodTemplates } from './bentoModels'
import { bindBentoPointer } from './bentoPointer'
import { clampToBox, FLOOR_Y, foodDefinition, type BentoState, type FoodKind, type Point } from './bentoState'

export type SceneCallbacks = {
  select: (id: number | null) => void
  move: (id: number, point: Point) => void
  status: (status: 'loading' | 'ready' | 'error') => void
}
export function createBentoScene(host: HTMLDivElement, initial: BentoState, callbacks: SceneCallbacks) {
  let state = initial
  let disposed = false
  let failed = false
  let templates: Map<FoodKind, THREE.Group> | null = null
  let renderer: THREE.WebGLRenderer
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#fcf0d8')
  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 80)
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const nodes = new Map<number, THREE.Group>()
  const pops = new Map<number, number>()
  let box = createBox(state.box, state.color)
  scene.add(box)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#fcf0d8', roughness: 1 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.03
  ground.receiveShadow = true
  scene.add(ground, new THREE.HemisphereLight('#ffffff', '#eadcc6', 2.5))
  const light = new THREE.DirectionalLight('#ffffff', 2.0)
  light.position.set(-3, 9, 5)
  light.castShadow = true
  light.shadow.mapSize.set(1024, 1024)
  Object.assign(light.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 })
  light.shadow.normalBias = 0.025
  light.shadow.bias = -0.0002
  light.shadow.intensity = 0.3
  scene.add(light)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 40), new THREE.MeshBasicMaterial({ color: '#258aa2', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }))
  ring.rotation.x = -Math.PI / 2
  ring.visible = false
  scene.add(ring)
  let raf = 0
  let doneAt: number | null = null
  let aspect = 1
  let previousMode = state.mode

  function updateCamera(time: number) {
    const elapsed = doneAt === null ? 0 : Math.min(1, (time - doneAt) / 4000)
    const finished = state.mode === 'done'
    const zoomOut = finished ? (reducedMotion ? 1 : Math.min(1, (time - (doneAt ?? time)) / 500)) : 0
    const yaw = finished && !reducedMotion ? Math.sin(elapsed * Math.PI) * 0.12 : 0
    camera.position.set(Math.sin(yaw) * 10, 10, Math.cos(yaw) * 7)
    camera.lookAt(0, 0.15, 0)
    // Fit in both directions without making portrait boxes tiny.
    const halfHeight = Math.max(2.85, 3.65 / aspect) * (1 + zoomOut * 0.08)
    camera.left = -halfHeight * aspect
    camera.right = halfHeight * aspect
    camera.top = halfHeight
    camera.bottom = -halfHeight
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)
  }
  function requestRender() {
    if (!disposed && !failed && !raf) raf = requestAnimationFrame(render)
  }
  function render(time: number) {
    raf = 0
    if (disposed || failed) return
    updateCamera(time)
    for (const [id, started] of pops) {
      const node = nodes.get(id)
      const t = Math.min(1, (time - started) / 300)
      if (node) node.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.12)
      if (t === 1) pops.delete(id)
    }
    renderer.render(scene, camera)
    if (pops.size || (doneAt !== null && !reducedMotion && time - doneAt < 4000)) requestRender()
  }
  function resize() {
    const width = Math.max(1, host.clientWidth)
    const height = Math.max(1, host.clientHeight)
    aspect = width / height
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.setSize(width, height, false)
    updateCamera(performance.now())
    requestRender()
  }
  function syncFoodPositions() {
    for (const food of state.foods) {
      const node = nodes.get(food.id)
      if (!node) continue
      node.position.set(food.x, FLOOR_Y + 0.015, food.z)
      node.rotation.y = food.rotation
    }
    const selected = state.foods.find(food => food.id === state.selected)
    ring.visible = !!selected && state.mode === 'edit'
    if (selected) {
      ring.position.set(selected.x, FLOOR_Y + 0.018, selected.z)
      ring.scale.setScalar(foodDefinition(selected.kind).radius + 0.08)
    }
    requestRender()
  }
  function sync(next: BentoState) {
    if (disposed) return
    if (next.box !== state.box || next.color !== state.color) {
      scene.remove(box)
      disposeObjects([box])
      box = createBox(next.box, next.color)
      scene.add(box)
    }
    if (next.mode !== previousMode) {
      pointer.cancel()
      doneAt = next.mode === 'done' ? performance.now() : null
      previousMode = next.mode
    }
    state = next
    const ids = new Set(state.foods.map(food => food.id))
    for (const [id, node] of nodes) if (!ids.has(id)) {
      scene.remove(node)
      const cup = node.getObjectByName('food-cup')
      if (cup) disposeObjects([cup])
      nodes.delete(id)
      pops.delete(id)
    }
    if (templates) for (const food of state.foods) if (!nodes.has(food.id)) {
      const node = new THREE.Group()
      node.add(templates.get(food.kind)!.clone(true))
      node.userData.foodId = food.id
      nodes.set(food.id, node)
      scene.add(node)
      if (!reducedMotion) pops.set(food.id, performance.now())
    }
    for (const food of state.foods) {
      const node = nodes.get(food.id)
      if (!node || node.userData.cup === food.cup) continue
      const previousCup = node.getObjectByName('food-cup')
      if (previousCup) { node.remove(previousCup); disposeObjects([previousCup]) }
      if (food.cup) node.add(createFoodCup(foodDefinition(food.kind).radius, food.cup))
      // Keep food inside the cup's rim, with its bottom resting on the cup base.
      node.children[0]!.scale.setScalar(food.cup ? 0.84 : 1)
      node.children[0]!.position.y = food.cup ? 0.025 : 0
      node.userData.cup = food.cup
    }
    syncFoodPositions()
  }
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.setAttribute('aria-hidden', 'true')
    host.appendChild(renderer.domElement)
  } catch {
    disposeObjects([scene])
    light.shadow.dispose()
    callbacks.status('error')
    return { sync: () => {}, dispose: () => {} }
  }
  const raycaster = new THREE.Raycaster()
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_Y)
  function ray(event: PointerEvent) {
    const rect = host.getBoundingClientRect()
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / Math.max(1, rect.width) * 2 - 1, -(event.clientY - rect.top) / Math.max(1, rect.height) * 2 + 1), camera)
  }
  const pointer = bindBentoPointer(host, {
    enabled: () => state.mode === 'edit' && !!templates && !failed,
    hit(event) {
      ray(event)
      scene.updateMatrixWorld(true)
      // Include box walls as occluders; don't grab hidden food through a divider.
      const hits = raycaster.intersectObjects([...nodes.values(), box], true)
      let object: THREE.Object3D | null = hits[0]?.object ?? null
      while (object && object.userData.foodId === undefined) object = object.parent
      const food = state.foods.find(food => food.id === object?.userData.foodId)
      return food ? { id: food.id, position: food } : null
    },
    project(event) {
      ray(event)
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3())
      return hit ? { x: hit.x, z: hit.z } : null
    },
    select: callbacks.select,
    preview(id, point) {
      const food = state.foods.find(food => food.id === id)
      const node = nodes.get(id)
      if (!food || !node) return
      const bounded = clampToBox(state.box, point, foodDefinition(food.kind).radius)
      node.position.set(bounded.x, FLOOR_Y + 0.14, bounded.z)
      ring.position.set(bounded.x, FLOOR_Y + 0.018, bounded.z)
      requestRender()
    },
    drop: callbacks.move,
    cancel: syncFoodPositions,
  })
  function lost(event: Event) {
    event.preventDefault()
    failed = true
    pointer.cancel()
    cancelAnimationFrame(raf)
    raf = 0
    callbacks.status('error')
  }
  renderer.domElement.addEventListener('webglcontextlost', lost)
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()
  callbacks.status('loading')
  void loadFoodTemplates().then(loaded => {
    if (disposed) { disposeObjects([...loaded.values()]); return }
    templates = loaded
    if (failed) return
    sync(state)
    callbacks.status('ready')
  }).catch(() => { if (!disposed) callbacks.status('error') })
  return {
    sync,
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      pointer.dispose()
      observer.disconnect()
      renderer.domElement.removeEventListener('webglcontextlost', lost)
      // Clones share template resources. Dispose the union only once.
      disposeObjects([scene, ...templates?.values() ?? []])
      light.shadow.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      nodes.clear()
      templates?.clear()
    },
  }
}
