import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CAR_VEHICLES } from '../car-builder/carVehicles'
import { loadCarVehicleBody, type CarVehicleBody } from '../car-builder/vehicleBody'
import { RACE_CARS, type RaceCarId, type RaceSelection } from './raceConfig'
import { CIRCUIT, CIRCUIT_SCENERY, type CircuitDefinition } from './circuit'
import { createCircuitScenery } from './scenery'
import { createCircuitRoad, ROAD_Y } from './road'
import { createMotionProfile, sampleMotion, type MotionProfile } from './motion'

// Camera placement is independent of the motion table and React state.
import {
  chaseCameraPose,
  overviewCameraPose,
  tracksideCameraPose,
  type RaceCameraMode,
} from './raceCamera'

export type CircuitRacingEngineStatus = 'loading' | 'ready' | 'error'

export type CircuitRacingEngineOptions = {
  selections: readonly RaceSelection[]
  circuit?: CircuitDefinition
  running: boolean
  cameraMode: RaceCameraMode
  targetIndex: number
  onStatusChange?: (status: CircuitRacingEngineStatus, message?: string) => void
}

export type CircuitRacingEngineHandle = {
  registerContainer: (element: HTMLDivElement | null) => void
  retry: () => void
  adjustCamera: (action: 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'turnLeft' | 'turnRight' | 'overview') => void
}

type PlainVector = { x: number; y: number; z: number }

type WheelVisual = {
  group: THREE.Group
  radius: number
}

type CarVisual = {
  root: THREE.Group
  body: CarVehicleBody
  wheels: WheelVisual[]
  profile: MotionProfile
}

const CAMERA_FOV = 48
const CAMERA_NEAR = 0.1
const CAMERA_FAR = 900
const MAX_DEVICE_PIXEL_RATIO = 2

function plainVector(value: THREE.Vector3): PlainVector {
  return { x: value.x, y: value.y, z: value.z }
}

function raceCarDefinition(id: RaceCarId) {
  const car = RACE_CARS.find((candidate) => candidate.id === id)
  if (car === undefined) throw new Error(`レース車両がありません: ${id}`)
  return car
}

function own<T extends THREE.BufferGeometry | THREE.Material>(
  resource: T,
  list: Array<THREE.BufferGeometry | THREE.Material>,
): T {
  list.push(resource)
  return resource
}

function createWheelVisual(
  parent: THREE.Group,
  x: number,
  z: number,
  radius: number,
  width: number,
  resources: Array<THREE.BufferGeometry | THREE.Material>,
): WheelVisual {
  const group = new THREE.Group()
  group.position.set(x, radius, z)

  const wheelGeometry = own(new THREE.CylinderGeometry(radius, radius, width, 18), resources)
  wheelGeometry.rotateZ(Math.PI / 2)
  const tireMaterial = own(
    new THREE.MeshStandardMaterial({ color: '#20262b', roughness: 0.96, metalness: 0.02 }),
    resources,
  )
  const tire = new THREE.Mesh(wheelGeometry, tireMaterial)
  tire.castShadow = true
  tire.receiveShadow = true
  group.add(tire)

  const hubGeometry = own(new THREE.CylinderGeometry(radius * 0.32, radius * 0.32, width * 1.08, 16), resources)
  hubGeometry.rotateZ(Math.PI / 2)
  const hubMaterial = own(
    new THREE.MeshStandardMaterial({ color: '#dce4ea', roughness: 0.3, metalness: 0.65 }),
    resources,
  )
  const hub = new THREE.Mesh(hubGeometry, hubMaterial)
  hub.castShadow = true
  group.add(hub)

  const spokeGeometry = own(new THREE.BoxGeometry(width * 1.12, radius * 1.24, radius * 0.08), resources)
  const spokeMaterial = own(
    new THREE.MeshStandardMaterial({ color: '#9aa9b4', roughness: 0.35, metalness: 0.6 }),
    resources,
  )
  const outward = x < 0 ? -1 : 1
  for (const rotation of [0, Math.PI / 2]) {
    const spoke = new THREE.Mesh(spokeGeometry, spokeMaterial)
    spoke.position.x = outward * (width * 0.56)
    spoke.rotation.x = rotation
    spoke.castShadow = true
    group.add(spoke)
  }
  parent.add(group)
  return { group, radius }
}

function createLoadedCarVisual(
  selection: RaceSelection,
  body: CarVehicleBody,
  profile: MotionProfile,
): CarVisual {
  const vehicle = CAR_VEHICLES[selection.carId]
  const root = new THREE.Group()
  root.name = `race-car-${selection.carId}`
  body.setBodyColor(selection.color)
  root.add(body.object)

  const generatedResources: Array<THREE.BufferGeometry | THREE.Material> = []
  const wheels: WheelVisual[] = []
  for (const axle of [vehicle.wheels.front, vehicle.wheels.rear]) {
    for (const side of [-1, 1]) {
      wheels.push(
        createWheelVisual(root, side * axle.halfTrack, axle.z, axle.radius, axle.width, generatedResources),
      )
    }
  }
  // `root.traverse` during disposal sees every wheel resource.  Keeping this
  // list local avoids a second ownership system and protects StrictMode's
  // mount/unmount cycle from disposing a shared wheel accidentally.
  return {
    root,
    body,
    wheels,
    profile,
  }
}

function disposeCarVisual(car: CarVisual): void {
  car.body.dispose()
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  car.root.traverse((child) => {
    const mesh = child as Partial<THREE.Mesh>
    if (mesh.geometry !== undefined) geometries.add(mesh.geometry)
    if (Array.isArray(mesh.material)) mesh.material.forEach((material) => materials.add(material))
    else if (mesh.material !== undefined) materials.add(mesh.material)
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  car.root.removeFromParent()
}

export function useCircuitRacingEngine(options: CircuitRacingEngineOptions): CircuitRacingEngineHandle {
  const circuit = options.circuit ?? CIRCUIT
  const containerRef = useRef<HTMLDivElement | null>(null)
  const optionsRef = useRef(options)
  const syncSelectionsRef = useRef<((selections: readonly RaceSelection[]) => void) | null>(null)
  const [generation, setGeneration] = useState(0)
  const cameraAdjustmentRef = useRef<CircuitRacingEngineHandle['adjustCamera'] | null>(null)
  const requestRenderRef = useRef<(() => void) | null>(null)
  const selectionKey = options.selections.map((selection) => `${selection.carId}:${selection.color}`).join('|')

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const registerContainer = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element
  }, [])

  const handle = useMemo<CircuitRacingEngineHandle>(
    () => ({
      registerContainer,
      retry: () => setGeneration((value) => value + 1),
      adjustCamera: (action) => cameraAdjustmentRef.current?.(action),
    }),
    [registerContainer],
  )

  useEffect(() => {
    requestRenderRef.current?.()
    syncSelectionsRef.current?.(options.selections)
  }, [options.selections, selectionKey])

  useEffect(() => {
    const host = containerRef.current
    if (host === null || typeof window === 'undefined') return undefined
    const palette = CIRCUIT_SCENERY[circuit.scenery]
    const curve = circuit.curve.clone()
    const roadEdge = circuit.width / 2
    const sceneHost = host
    let renderer: THREE.WebGLRenderer | null = null
    let controls: OrbitControls | null = null
    let resizeObserver: ResizeObserver | null = null
    let rafId: number | null = null
    let released = false
    let loadingToken = 0
    let elapsedSeconds = 0
    let previousTime = 0
    let wasRunning = false
    let contextLost = false
    let previousCameraMode: RaceCameraMode | null = null
    let lastCameraKey = ''
    let overviewActive = false
    const circuitBounds = new THREE.Box3().setFromPoints(curve.getPoints(1024)).expandByScalar(roadEdge + 1)
    let dirty = true
    let currentKey = ''
    let cars: CarVisual[] = []
    const staticResources: Array<THREE.BufferGeometry | THREE.Material> = []

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(palette.sky)
    const raceFog = new THREE.Fog(palette.sky, 150, 520)
    scene.fog = raceFog
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR)
    camera.position.set(0, 10, 18)

    const markDirty = () => {
      dirty = true
    }
    requestRenderRef.current = markDirty
    const notify = (status: CircuitRacingEngineStatus, message?: string) => {
      if (!released) optionsRef.current.onStatusChange?.(status, message)
    }
    notify('loading')

    const hemisphere = new THREE.HemisphereLight('#f8fcff', palette.ground, 1.45)
    const sun = new THREE.DirectionalLight('#fff5db', 1.65)
    sun.position.set(-35, 55, 25)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -80
    sun.shadow.camera.right = 80
    sun.shadow.camera.top = 80
    sun.shadow.camera.bottom = -80
    sun.shadow.camera.far = 220
    const fill = new THREE.DirectionalLight('#d6e8ff', 0.38)
    fill.position.set(35, 16, -45)
    scene.add(hemisphere, sun, fill)

    const groundGeometry = own(new THREE.PlaneGeometry(700, 700), staticResources)
    const groundMaterial = own(new THREE.MeshStandardMaterial({ color: palette.ground, roughness: 0.96 }), staticResources)
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.2
    ground.receiveShadow = true
    scene.add(ground)

    let scenery: ReturnType<typeof createCircuitScenery> | undefined
    let road: ReturnType<typeof createCircuitRoad> | undefined
    let tracksideAnchor: PlainVector
    try {
      curve.arcLengthDivisions = 4096
      curve.updateArcLengths()
      const referencePoints = Array.from({ length: 192 }, (_, index) => {
        const point = curve.getPointAt(index / 192)
        point.y = ROAD_Y
        return point
      })
      const anchorIndex = Math.floor(referencePoints.length * 0.28)
      const anchor = referencePoints[anchorIndex] ?? { x: 0, y: 0, z: 0 }
      const previous = referencePoints[(anchorIndex + referencePoints.length - 1) % referencePoints.length] ?? anchor
      const next = referencePoints[(anchorIndex + 1) % referencePoints.length] ?? anchor
      const dx = next.x - previous.x
      const dz = next.z - previous.z
      const tangentLength = Math.hypot(dx, dz) || 1
      tracksideAnchor = {
        x: anchor.x + (-dz / tangentLength) * (roadEdge + 8),
        y: 8,
        z: anchor.z + (dx / tangentLength) * (roadEdge + 8),
      }
      road = createCircuitRoad(circuit)
      scenery = createCircuitScenery(circuit)
      scene.add(road.group, scenery.group)
    } catch (error) {
      // A malformed circuit is recoverable from the UI and should not strand
      // the player on a blank page.
      notify('error', error instanceof Error ? error.message : 'コースを つくれません')
      tracksideAnchor = { x: 10, y: 0, z: 8 }
    }

    function resize(): void {
      if (renderer === null) return
      const width = Math.max(1, sceneHost.clientWidth)
      const height = Math.max(1, sceneHost.clientHeight)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO))
      renderer.setSize(width, height, false)
      if (overviewActive && optionsRef.current.cameraMode === 'free') showOverview()
      markDirty()
    }

    function applyCarFrame(car: CarVisual, elapsed: number): { position: PlainVector; tangent: PlainVector } {
      const duration = Math.max(0.001, car.profile.duration)
      const sample = sampleMotion(car.profile, elapsed % duration)
      const position = plainVector(sample.position)
      position.y = ROAD_Y
      const tangent = plainVector(sample.tangent)
      const angle = Math.atan2(tangent.x, tangent.z)
      car.root.position.set(position.x, position.y, position.z)
      car.root.rotation.y = angle
      const laps = Math.floor(elapsed / duration)
      const unwrappedDistance = laps * car.profile.length + sample.distance
      for (const wheel of car.wheels) wheel.group.rotation.x = -unwrappedDistance / wheel.radius
      return { position, tangent }
    }

    function showOverview(): void {
      if (controls === null) return
      const pose = overviewCameraPose(circuitBounds, camera.aspect, CAMERA_FOV)
      controls.target.set(pose.target.x, pose.target.y, pose.target.z)
      camera.position.set(pose.position.x, pose.position.y, pose.position.z)
      camera.fov = CAMERA_FOV
      const distance = camera.position.distanceTo(controls.target)
      controls.maxDistance = Math.max(500, distance * 1.3)
      camera.far = Math.max(CAMERA_FAR, controls.maxDistance + 700)
      camera.updateProjectionMatrix()
      // Discard residual drag damping before applying the preset.
      const damping = controls.enableDamping
      controls.enableDamping = false
      controls.update()
      controls.target.set(pose.target.x, pose.target.y, pose.target.z)
      camera.position.set(pose.position.x, pose.position.y, pose.position.z)
      controls.update()
      controls.enableDamping = damping
      overviewActive = true
      markDirty()
    }

    function updateCamera(): void {
      const currentCars = cars
      const target = currentCars[Math.min(currentCars.length - 1, Math.max(0, optionsRef.current.targetIndex))]
      if (target === undefined) {
        camera.lookAt(0, 0, 0)
        return
      }
      const frame = applyCarFrame(target, elapsedSeconds)
      const mode = optionsRef.current.cameraMode
      // Free views must remain clear at the full circuit distance.
      scene.fog = mode === 'free' ? null : raceFog
      camera.near = mode === 'free' ? 2 : CAMERA_NEAR
      camera.updateProjectionMatrix()
      if (mode === 'free') {
        if (controls !== null) {
          controls.enabled = true
          if (previousCameraMode !== 'free') {
            showOverview()
          }
        }
        previousCameraMode = mode
        return
      }
      const pose = mode === 'trackside'
        ? tracksideCameraPose(tracksideAnchor, frame.position)
        : chaseCameraPose(frame.position, frame.tangent)
      if (controls !== null) {
        controls.enabled = false
        controls.target.set(pose.target.x, pose.target.y, pose.target.z)
      }
      camera.position.set(pose.position.x, pose.position.y, pose.position.z)
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z)
      // Optical zoom keeps the watched car readable from a fixed location.
      // Framing depends on distance, not driving speed.
      camera.fov = mode === 'trackside'
        ? THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(12 / (camera.position.distanceTo(target.root.position) * Math.min(1, camera.aspect)))), 3, CAMERA_FOV)
        : CAMERA_FOV
      camera.updateProjectionMatrix()
      previousCameraMode = mode
    }

    function render(): void {
      if (renderer === null || released || contextLost) return
      if (dirty) {
        renderer.render(scene, camera)
        dirty = false
      }
    }

    function disposeCars(): void {
      for (const car of cars) disposeCarVisual(car)
      cars = []
    }

    const reloadCars = async (selections: readonly RaceSelection[], force = false): Promise<void> => {
      const nextKey = selections.map((selection) => `${selection.carId}:${selection.color}`).join('|')
      if (!force && nextKey === currentKey) return
      currentKey = nextKey
      const token = ++loadingToken
      disposeCars()
      notify('loading')
      const loaded: Array<{ selection: RaceSelection; profile: MotionProfile; body: CarVehicleBody }> = []
      const nextCars: CarVisual[] = []
      try {
        for (let index = 0; index < selections.length; index += 1) {
          const selection = selections[index]
          if (selection === undefined) continue
          const lane = selections.length === 2 ? [-3, 3][index] : [-3, 0, 3][index]
          const profile = createMotionProfile(raceCarDefinition(selection.carId), curve, lane)
          const body = await loadCarVehicleBody(selection.carId)
          loaded.push({ selection, profile, body })
          if (released || token !== loadingToken) {
            loaded.forEach(({ body: staleBody }) => staleBody.dispose())
            return
          }
        }
        if (released || token !== loadingToken) {
          loaded.forEach(({ body }) => body.dispose())
          return
        }
        for (const { selection, profile, body } of loaded) {
          nextCars.push(createLoadedCarVisual(selection, body, profile))
        }
        elapsedSeconds = 0
        nextCars.forEach((car) => { scene.add(car.root); applyCarFrame(car, 0) })
        cars = nextCars
        notify('ready')
      } catch (error) {
        // Dispose every model that did arrive when one of the other models
        // failed, leaving a clean retry path and no half-loaded grid.
        nextCars.forEach(disposeCarVisual)
        const ownedBodies = new Set(nextCars.map((car) => car.body))
        loaded.forEach(({ body }) => { if (!ownedBodies.has(body)) body.dispose() })
        if (!released && token === loadingToken) {
          notify('error', error instanceof Error ? error.message : 'くるまを よみこめません')
        }
        return
      }
      updateCamera()
      markDirty()
    }

    function handleContextLost(event: Event): void {
      event.preventDefault()
      contextLost = true
      notify('error', '3Dを ひょうじできません。もういちど ためしてね')
    }

    function handleContextRestored(): void {
      contextLost = false
      if (!released) void reloadCars(optionsRef.current.selections, true)
    }

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.domElement.setAttribute('aria-hidden', 'true')
      renderer.domElement.style.display = 'block'
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false)
      renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false)
      sceneHost.appendChild(renderer.domElement)
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.enablePan = true
      controls.screenSpacePanning = true
      controls.maxPolarAngle = Math.PI / 2 - 0.04
      controls.minDistance = 4
      controls.maxDistance = 500
      controls.addEventListener('change', markDirty)
      controls.addEventListener('start', () => { overviewActive = false })
      resize()
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(sceneHost)
      } else {
        window.addEventListener('resize', resize)
      }

      syncSelectionsRef.current = (selections) => {
        void reloadCars(selections)
      }
      cameraAdjustmentRef.current = (action) => {
        if (controls === null) return
        controls.enabled = true
        if (action === 'overview') {
          showOverview()
          return
        }
        overviewActive = false
        const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
        const target = controls.target.clone()
        if (action === 'turnLeft') spherical.theta += 0.24
        if (action === 'turnRight') spherical.theta -= 0.24
        if (action === 'in') spherical.radius = Math.max(4, spherical.radius / 1.16)
        if (action === 'out') spherical.radius = Math.min(controls.maxDistance, spherical.radius * 1.16)
        const direction = new THREE.Vector3()
        if (action === 'left' || action === 'right') {
          camera.getWorldDirection(direction)
          const right = new THREE.Vector3().crossVectors(direction, camera.up).normalize()
          target.addScaledVector(right, action === 'left' ? -1.2 : 1.2)
        }
        if (action === 'up' || action === 'down') {
          target.y = Math.max(0, target.y + (action === 'up' ? 0.7 : -0.7))
        }
        controls.target.copy(target)
        camera.position.setFromSpherical(spherical).add(target)
        controls.update()
        markDirty()
      }

      requestRenderRef.current = markDirty

      const tick = (time: number) => {
        if (released || renderer === null) return
        if (previousTime === 0) previousTime = time
        const delta = Math.min(0.08, Math.max(0, (time - previousTime) / 1000))
        previousTime = time
        const running = optionsRef.current.running && !contextLost && !document.hidden && cars.length > 0
        const cameraKey = `${optionsRef.current.cameraMode}:${optionsRef.current.targetIndex}`
        const cameraChanged = cameraKey !== lastCameraKey
        if (running) {
          elapsedSeconds += delta
          for (const car of cars) applyCarFrame(car, elapsedSeconds)
          updateCamera()
          dirty = true
        } else if (wasRunning || cameraChanged) {
          updateCamera()
          dirty = true
        }
        lastCameraKey = cameraKey
        wasRunning = running
        if (controls?.enabled === true) controls.update()
        render()
        rafId = window.requestAnimationFrame(tick)
      }
      rafId = window.requestAnimationFrame(tick)
      void reloadCars(optionsRef.current.selections, true)
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '3Dを ひょうじできません')
      if (renderer !== null) {
        try {
          renderer.dispose()
        } catch {
          // Initialisation can fail before Three.js has a live context.
        }
        renderer = null
      }
    }

    return () => {
      released = true
      loadingToken += 1
      syncSelectionsRef.current = null
      cameraAdjustmentRef.current = null
      requestRenderRef.current = null
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      resizeObserver?.disconnect()
      if (resizeObserver === null) window.removeEventListener('resize', resize)
      controls?.removeEventListener('change', markDirty)
      controls?.dispose()
      if (renderer !== null) {
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost)
        renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored)
      }
      disposeCars()
      scenery?.dispose()
      road?.dispose()
      staticResources.forEach((resource) => resource.dispose())
      hemisphere.dispose()
      sun.dispose()
      fill.dispose()
      const canvas = renderer?.domElement ?? sceneHost.querySelector('canvas')
      if (renderer !== null) {
        try {
          renderer.dispose()
          renderer.forceContextLoss()
        } catch {
          // WebGL mocks and already lost contexts may reject cleanup methods.
        }
      }
      if (canvas !== null && canvas.parentNode === sceneHost) sceneHost.removeChild(canvas)
    }
    // Rebuild and dispose the scene when the course changes. Car/camera changes travel
    // through refs so StrictMode does not create duplicate renderers.
  }, [generation, circuit])

  return handle
}
