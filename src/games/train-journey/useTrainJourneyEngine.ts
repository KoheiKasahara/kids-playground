import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { chaseCameraPose, overviewCameraPose } from '../circuit-racing/raceCamera'
import { createRaceEnvironment } from '../circuit-racing/carAppearance'
import { advanceJourney, boostJourney, CAR_SPACING, createJourneyMotion, railOrientation, sampleJourney, TRAINS, type JourneyCourse, type JourneyRoute, type TrainId } from './journeyModel'
import { createJourneyScene, disposeJourneyObject } from './journeyScene'
import { journeySound } from './journeySound'

export type JourneyCamera = 'follow' | 'overview'
export type JourneyStatus = 'loading' | 'ready' | 'error'
export type JourneyFeedback = { location: string; boosting: boolean; atStation: boolean }
type Options = {
  course: JourneyCourse
  train: TrainId
  route: JourneyRoute
  running: boolean
  camera: JourneyCamera
  sound: boolean
  reducedMotion: boolean
  onStatus: (status: JourneyStatus) => void
  onFeedback: (feedback: JourneyFeedback) => void
}
type Commands = { boost: () => void; overview: () => void }
const ASSET_PATH = `${import.meta.env.BASE_URL}models/train-journey/`

export function useTrainJourneyEngine(options: Options) {
  const [container, registerContainer] = useState<HTMLDivElement | null>(null)
  const [generation, setGeneration] = useState(0)
  const optionsRef = useRef(options)
  const commands = useRef<Commands | null>(null)
  const mapMarker = useRef<SVGCircleElement | null>(null)
  const switchMarker = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { optionsRef.current = options }, [options])
  const retry = useCallback(() => setGeneration(g => g + 1), [])
  const boost = useCallback(() => commands.current?.boost(), [])
  const overview = useCallback(() => commands.current?.overview(), [])
  const registerMapMarker = useCallback((element: SVGCircleElement | null) => { mapMarker.current = element }, [])
  const registerSwitchMarker = useCallback((element: HTMLButtonElement | null) => { switchMarker.current = element }, [])

  useEffect(() => {
    if (!container) return
    const host = container
    const course = optionsRef.current.course
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#c3e5e9')
    scene.fog = new THREE.Fog('#c3e5e9', 95, 230)
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400)
    const environment = createRaceEnvironment()
    scene.environment = environment
    scene.environmentIntensity = 0.35
    const sun = new THREE.DirectionalLight('#fff0cf', 2.4)
    sun.position.set(-25, 48, 28)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -37, right: 37, top: 37, bottom: -37, near: 1, far: 120 })
    sun.shadow.normalBias = 0.045
    sun.shadow.bias = -0.0001
    scene.add(sun, new THREE.HemisphereLight('#e5f7ff', '#899863', 1.0))
    const motion = createJourneyMotion(course)
    let renderer: THREE.WebGLRenderer | undefined
    let controls: OrbitControls | undefined
    let world: ReturnType<typeof createJourneyScene> | undefined
    let released = false
    let lost = false
    let ready = false
    let raf = 0
    let last = 0
    let lastDraw = 0
    let feedbackClock = 0
    let feedbackKey = ''
    let lastTrain: TrainId | undefined
    let lastRoute: JourneyRoute | undefined
    let lastCamera: JourneyCamera | undefined
    let dirty = true
    let railSoundDistance = 0
    let totalTime = 0
    const templates = new Map<string, THREE.Group>()
    const assetRoot = new THREE.Group()
    assetRoot.visible = false
    scene.add(assetRoot)
    const cars: THREE.Group[] = []
    const lookTarget = new THREE.Vector3()
    const desiredPosition = new THREE.Vector3()
    const desiredTarget = new THREE.Vector3()
    const projected = new THREE.Vector3()
    const localUp = new THREE.Vector3(0, 1, 0)
    const smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#fff6df', transparent: true, opacity: 0.62, depthWrite: false }), 10)
    smoke.name = 'steam-puffs'
    smoke.frustumCulled = false
    scene.add(smoke)
    const boostEffect = new THREE.Group()
    boostEffect.name = 'train-boost-effect'
    const streakGeometry = new THREE.BoxGeometry(0.055, 0.055, 1.35)
    const streakMaterial = new THREE.MeshBasicMaterial({ color: '#fff3a2' })
    for (let i = 0; i < 10; i++) {
      const streak = new THREE.Mesh(streakGeometry, streakMaterial)
      streak.position.set((i % 2 ? -1 : 1) * (0.9 + (i % 3) * 0.13), 0.6 + (i % 3) * 0.4, -1.3 - Math.floor(i / 2) * 0.55)
      boostEffect.add(streak)
    }
    scene.add(boostEffect)
    const dummy = new THREE.Object3D()

    function showOverview() {
      if (!controls) return
      const pose = overviewCameraPose({ min: { x: -29, z: -29 }, max: { x: 29, z: 29 } }, camera.aspect, 45)
      camera.position.set(pose.position.x, pose.position.y, pose.position.z)
      controls.target.set(0, 0, 0)
      const damping = controls.enableDamping
      controls.enableDamping = false
      controls.update()
      controls.enableDamping = damping
      lookTarget.copy(controls.target)
      dirty = true
    }
    function resize() {
      if (!renderer) return
      camera.aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight)
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7))
      renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false)
      if (optionsRef.current.camera === 'overview') showOverview()
      dirty = true
    }
    function selectTrain(id: TrainId) {
      cars.forEach(car => scene.remove(car))
      cars.length = 0
      const definition = TRAINS.find(t => t.id === id)!
      definition.models.forEach((name, index) => {
        const car = new THREE.Group()
        const model = templates.get(name)!.clone(true)
        // Bullet sets have a cab at both ends; reverse only the rear model.
        if (id === 'bullet' && index === 2) model.rotation.y = Math.PI
        car.add(model)
        cars.push(car)
        scene.add(car)
      })
      lastTrain = id
      host.dataset.train = id
      dirty = true
    }
    function updateTrain() {
      const current = optionsRef.current
      cars.forEach((car, index) => {
        // Bogie samples align long bodies to the chord on bends and gradients.
        const front = sampleJourney(motion, course, index * CAR_SPACING - 0.52, current.route)
        const back = sampleJourney(motion, course, index * CAR_SPACING + 0.52)
        car.position.copy(front.position).lerp(back.position, 0.5).addScaledVector(localUp, 0.22)
        car.quaternion.copy(railOrientation(front.position.sub(back.position).normalize()))
        car.traverse(child => {
          if (/^wheel(?:_\d+)?$/.test(child.name)) child.rotation.x = motion.totalDistance / 0.27
        })
      })
      const lead = cars[0]
      if (!lead) return
      boostEffect.position.copy(lead.position)
      boostEffect.quaternion.copy(lead.quaternion)
      boostEffect.visible = current.running && motion.boostRemaining > 0 && !current.reducedMotion
      boostEffect.children.forEach((streak, i) => { streak.scale.z = 0.6 + ((totalTime * 3 + i * 0.17) % 1) })
      const inTunnel = motion.edge === 'forest' && motion.distance >= (world?.tunnelStart ?? Infinity) && motion.distance <= (world?.tunnelEnd ?? -Infinity)
      smoke.visible = current.train === 'steam' && current.running && motion.speed > 0.2 && !current.reducedMotion && !inTunnel
      if (smoke.visible) {
        for (let i = 0; i < 10; i++) {
          const age = (totalTime * 0.6 + i / 10) % 1
          const behind = sampleJourney(motion, course, age * motion.speed * 1.6)
          dummy.position.copy(behind.position).add(new THREE.Vector3(Math.sin(i * 2) * age * 0.45, 2 + age * 2, 0))
          dummy.rotation.set(age, i, age * 0.5)
          dummy.scale.setScalar(0.08 + age * 0.42)
          dummy.updateMatrix()
          smoke.setMatrixAt(i, dummy.matrix)
        }
        smoke.instanceMatrix.needsUpdate = true
      }
    }
    function updateCamera(dt: number) {
      const current = optionsRef.current
      if (!controls || !cars[0]) return
      const changed = lastCamera !== current.camera
      if (changed) {
        scene.fog = current.camera === 'overview' ? null : new THREE.Fog('#c3e5e9', 95, 230)
        world?.setOverview(current.camera === 'overview')
      }
      controls.enabled = current.camera === 'overview'
      if (current.camera === 'overview') {
        if (changed) showOverview()
        controls.update()
      } else {
        const sample = sampleJourney(motion, course, 1.8)
        const factor = Math.max(1, 0.78 / camera.aspect)
        const pose = chaseCameraPose(sample.position, sample.tangent, { distance: 10.5 * factor, height: 8.5 * factor, lookAhead: 0.6, targetHeight: 0.6 })
        // Side offset shows the shape of the whole train, including the last car.
        desiredPosition.set(pose.position.x - sample.tangent.z * 5, pose.position.y, pose.position.z + sample.tangent.x * 5)
        // On the lower forest line, stay east of the elevated crossing. A
        // trailing camera on its west side would look through the red truss.
        const forestView = motion.edge === 'forest' || (motion.edge === 'common' && current.route === 'forest' && course.lengths.common - motion.distance < 8)
        if (forestView) desiredPosition.set(sample.position.x + 12 * factor, sample.position.y + 9 * factor, sample.position.z + 7 * factor)
        desiredTarget.set(pose.target.x, pose.target.y, pose.target.z)
        const blend = changed || current.reducedMotion ? 1 : 1 - Math.exp(-dt * 3)
        camera.position.lerp(desiredPosition, blend)
        lookTarget.lerp(desiredTarget, blend)
        camera.lookAt(lookTarget)
      }
      lastCamera = current.camera
    }
    function updateMarkers() {
      const point = sampleJourney(motion, course).position
      mapMarker.current?.setAttribute('cx', point.x.toFixed(2))
      mapMarker.current?.setAttribute('cy', point.z.toFixed(2))
      if (switchMarker.current) {
        projected.set(-12, 2.6, -0.7).project(camera)
        const visible = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 0.88 && Math.abs(projected.y) < 0.86
        switchMarker.current.hidden = !visible
        switchMarker.current.style.left = `${(projected.x + 1) * 50}%`
        switchMarker.current.style.top = `${(1 - projected.y) * 50}%`
      }
    }
    function publish() {
      const atStation = motion.dwell > 0
      const inTunnel = motion.edge === 'forest' && motion.distance > (world?.tunnelStart ?? 0) && motion.distance < (world?.tunnelEnd ?? 0) + 4
      const location = atStation ? 'にじいろえきで ひとやすみ' : inTunnel ? 'トンネルを くぐるよ！' : motion.edge === 'bridge' ? 'おそらの はしへ！' : motion.edge === 'forest' ? 'もりを はしるよ！' : 'しゅっぱつ しんこう！'
      const next = { location, atStation, boosting: motion.boostRemaining > 0 }
      const key = JSON.stringify(next)
      if (key !== feedbackKey) { feedbackKey = key; optionsRef.current.onFeedback(next) }
      // Compact observable state for browser regression checks and diagnostics.
      host.dataset.edge = motion.edge
      host.dataset.distance = motion.distance.toFixed(3)
      host.dataset.speed = motion.speed.toFixed(2)
      host.dataset.boost = motion.boostRemaining.toFixed(2)
      host.dataset.drawCalls = String(renderer?.info.render.calls ?? 0)
      host.dataset.triangles = String(renderer?.info.render.triangles ?? 0)
    }
    function frame(now: number) {
      if (released || lost || document.hidden) return
      raf = requestAnimationFrame(frame)
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      if (!ready || !renderer || !world) return
      const current = optionsRef.current
      if (lastTrain !== current.train) selectTrain(current.train)
      if (lastRoute !== current.route) { world.setRoute(current.route); lastRoute = current.route; dirty = true }
      if (current.running) {
        const visits = motion.visits
        advanceJourney(motion, course, dt, current.route, current.train)
        totalTime += dt
        if (current.sound && motion.visits > visits) journeySound('station')
        if (current.sound && motion.totalDistance - railSoundDistance > 1.5) {
          journeySound('rail')
          railSoundDistance = motion.totalDistance
        }
        dirty = true
      }
      updateTrain()
      world.update(totalTime, current.reducedMotion)
      updateCamera(dt)
      updateMarkers()
      if ((dirty || current.camera === 'follow') && now - lastDraw >= 1000 / 40) {
        renderer.render(scene, camera)
        lastDraw = now
        dirty = false
      }
      feedbackClock += dt
      if (feedbackClock > 0.12) { publish(); feedbackClock = 0 }
    }
    function visibility() {
      cancelAnimationFrame(raf)
      last = 0
      if (!document.hidden && !lost && !released) { dirty = true; raf = requestAnimationFrame(frame) }
    }
    function contextLost(event: Event) {
      event.preventDefault()
      lost = true
      cancelAnimationFrame(raf)
      optionsRef.current.onStatus('error')
    }
    function contextRestored() { if (!released) setGeneration(g => g + 1) }
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize)
    optionsRef.current.onStatus('loading')
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.08
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.domElement.setAttribute('aria-hidden', 'true')
      host.appendChild(renderer.domElement)
      renderer.domElement.addEventListener('webglcontextlost', contextLost)
      renderer.domElement.addEventListener('webglcontextrestored', contextRestored)
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = !optionsRef.current.reducedMotion
      controls.enablePan = false
      controls.minDistance = 22
      controls.maxDistance = 180
      controls.maxPolarAngle = Math.PI * 0.43
      controls.minPolarAngle = 0.16
      controls.addEventListener('change', () => { dirty = true })
      resize()
      observer?.observe(host)
      document.addEventListener('visibilitychange', visibility)
      raf = requestAnimationFrame(frame)
      const loader = new GLTFLoader()
      const names = [...new Set([...TRAINS.flatMap(t => [...t.models]), 'spline-segment'])]
      void Promise.allSettled(names.map(async name => ({ name, model: (await loader.loadAsync(`${ASSET_PATH}${name}.glb`)).scene }))).then(results => {
        const loaded = new THREE.Group()
        for (const result of results) if (result.status === 'fulfilled') loaded.add(result.value.model)
        if (released || results.some(result => result.status === 'rejected')) {
          disposeJourneyObject(loaded)
          if (!released) optionsRef.current.onStatus('error')
          return
        }
        try {
          let sharedPalette: THREE.Texture | null = null
          for (const result of results) {
            if (result.status !== 'fulfilled') continue
            const { name, model } = result.value
            model.traverse(child => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = child.receiveShadow = true
                for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
                  if (material instanceof THREE.MeshStandardMaterial) {
                    material.roughness = 0.62
                    material.envMapIntensity = 0.5
                    if (material.map) {
                      if (!sharedPalette) sharedPalette = material.map
                      else if (material.map !== sharedPalette) {
                        material.map.dispose()
                        material.map = sharedPalette
                      }
                    }
                  }
                }
              }
            })
            templates.set(name, model)
            assetRoot.add(model)
          }
          world = createJourneyScene(course, templates.get('spline-segment')!)
          scene.add(world.group)
          selectTrain(optionsRef.current.train)
          world.setRoute(optionsRef.current.route)
          updateTrain()
          updateCamera(1)
          ready = true
          dirty = true
          publish()
          optionsRef.current.onStatus(lost ? 'error' : 'ready')
        } catch {
          optionsRef.current.onStatus('error')
        }
      })
    } catch {
      optionsRef.current.onStatus('error')
    }
    commands.current = {
      boost() { if (ready && !lost) { boostJourney(motion); publish(); dirty = true } },
      overview: showOverview,
    }
    return () => {
      released = true
      commands.current = null
      cancelAnimationFrame(raf)
      observer?.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      controls?.dispose()
      renderer?.domElement.removeEventListener('webglcontextlost', contextLost)
      renderer?.domElement.removeEventListener('webglcontextrestored', contextRestored)
      disposeJourneyObject(scene)
      environment.dispose()
      sun.shadow.map?.dispose()
      renderer?.dispose()
      renderer?.domElement.remove()
    }
  }, [container, generation])
  return { registerContainer, registerMapMarker, registerSwitchMarker, retry, boost, overview }
}
