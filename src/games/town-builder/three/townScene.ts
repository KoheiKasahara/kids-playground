import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { observeGameActivity } from '../../../utils/gameActivity'
import type { TilePart } from '../parts'
import { COLS, ROWS, type Ground, type Town } from '../town'
import type { VehicleKind } from '../vehicles'
import { buildTownModel, type TownModel } from './townModel'
import { farDistance, fitDistance, tileAt, tileCenter } from './townLayout'
import { advanceTracks, startTracks, trackPose, type Track } from './vehicleTracks'
import { RIDE_HEIGHT, vehicleModel } from './vehicleModels'

// できた まちを 3D で ながめる がめん。three.js の OrbitControls で 1ぽんゆびで まわし、2ほんゆびで ずらす・ちかづく。
// くるま・でんしゃは 2D と おなじ きまりで はしり、のって ながめる ことも できる。

export type TownPick =
  | { kind: 'part'; part: TilePart; bridge: boolean }
  | { kind: 'ground'; ground: Ground }
  | { kind: 'vehicle'; vehicle: VehicleKind }

export type VehicleCounts = Record<VehicleKind, number>

export type TownSceneCallbacks = {
  /** かけるように なった。はしって いる のりものの かずも しらせる。 */
  ready: (counts: VehicleCounts) => void
  /** WebGL が つかえない・とちゅうで きえた。 */
  error: () => void
  /** ゆびで さわって ぐるっと まわるのが とまった。 */
  tour: (on: boolean) => void
  pick: (pick: TownPick) => void
}

export type TownSceneHandle = {
  setNight: (night: boolean) => void
  setTour: (on: boolean) => void
  /** よこに まわす（1 で みぎへ）。 */
  turn: (step: number) => void
  /** ちかづく（1）・はなれる（-1）。 */
  zoom: (step: number) => void
  /** くるま・でんしゃに のる。のって いる ときは つぎの 1だいへ。のれなければ false。 */
  ride: (kind: VehicleKind) => boolean
  /** そらから ながめる みかたに もどる。 */
  land: () => void
  dispose: () => void
}

const FOV = 42
/** ほしと つきを おく そらの はんけい。ちず ぜんたいを はなれて みても そとがわに ある。 */
const SKY_RADIUS = 240
/** たいようの むき（かげの おちる ほう）。 */
const SUN_OFFSET = new THREE.Vector3(7, 14, 9)
const STEP_SECONDS = 1
const INTRO_SECONDS = 1.8
const NIGHT_SECONDS = 0.7
const TAP_PX = 8
const SKY = { day: new THREE.Color('#bfe6ff'), night: new THREE.Color('#141c3a') }
const HEMI = { day: new THREE.Color('#ffffff'), night: new THREE.Color('#8ea2ff'), groundDay: new THREE.Color('#9ccf73'), groundNight: new THREE.Color('#1d2540') }
const SUN = { day: new THREE.Color('#fff4e0'), night: new THREE.Color('#a9bcff') }
const CLOUD = { day: new THREE.Color('#ffffff'), night: new THREE.Color('#5b6488') }
/** のって いる ときの カメラ（のりものの うしろ・うえ と、みる さき）。 */
const RIDE_CAMERA: Record<VehicleKind, { back: number; up: number; ahead: number; look: number }> = {
  car: { back: 0.8, up: 0.36, ahead: 0.9, look: 0.08 },
  train: { back: 1.45, up: 0.72, ahead: 1.1, look: 0 },
}
const NOOP: TownSceneHandle = {
  setNight: () => {}, setTour: () => {}, turn: () => {}, zoom: () => {}, ride: () => false, land: () => {}, dispose: () => {},
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
const ease = (t: number) => 1 - Math.pow(1 - t, 3)

function skyDecor(): { group: THREE.Group; stars: THREE.PointsMaterial; moon: THREE.MeshBasicMaterial; cloud: THREE.MeshStandardMaterial; dispose: () => void } {
  const group = new THREE.Group()
  group.name = 'town-sky'
  const positions: number[] = []
  let seed = 7
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let n = 0; n < 260; n += 1) {
    const angle = random() * Math.PI * 2
    const height = 0.15 + random() * 0.85
    const flat = Math.sqrt(1 - height * height)
    positions.push(Math.cos(angle) * flat * SKY_RADIUS, height * SKY_RADIUS, Math.sin(angle) * flat * SKY_RADIUS)
  }
  const starGeometry = new THREE.BufferGeometry()
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const stars = new THREE.PointsMaterial({ color: '#fff8d6', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false })
  const points = new THREE.Points(starGeometry, stars)
  points.name = 'town-stars'
  group.add(points)

  const moonGeometry = new THREE.IcosahedronGeometry(SKY_RADIUS * 0.03, 2)
  const moon = new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0 })
  const moonMesh = new THREE.Mesh(moonGeometry, moon)
  moonMesh.position.set(-SKY_RADIUS * 0.375, SKY_RADIUS * 0.425, -SKY_RADIUS * 0.575)
  group.add(moonMesh)

  const puffGeometry = new THREE.IcosahedronGeometry(1, 1)
  const cloud = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 })
  const clouds = new THREE.Group()
  clouds.name = 'town-clouds'
  // くもは ちずより したに うかべる（そらに うかぶ しまの まち）。うえに おくと まちを かくして しまう。
  const edge = Math.max(COLS, ROWS) / 2
  const count = Math.round(edge * 1.3)
  for (let n = 0; n < count; n += 1) {
    const puffy = new THREE.Group()
    const angle = (n / count) * Math.PI * 2 + random() * 0.4
    const radius = edge + 2 + random() * 6
    puffy.position.set(Math.cos(angle) * radius, -2.6 + random() * 1.1, Math.sin(angle) * radius)
    for (let p = 0; p < 4; p += 1) {
      const puff = new THREE.Mesh(puffGeometry, cloud)
      const size = 0.55 + random() * 0.5
      puff.scale.set(size * 1.3, size, size)
      puff.position.set((p - 1.5) * 0.7, random() * 0.3, (random() - 0.5) * 0.6)
      puffy.add(puff)
    }
    clouds.add(puffy)
  }
  group.add(clouds)
  return {
    group, stars, moon, cloud,
    dispose() {
      starGeometry.dispose()
      stars.dispose()
      moonGeometry.dispose()
      moon.dispose()
      puffGeometry.dispose()
      cloud.dispose()
    },
  }
}

/** focus は はじめに ながめる マス（2D で みて いた ばしょ）。 */
export function createTownScene(host: HTMLDivElement, town: Town, night: boolean, callbacks: TownSceneCallbacks, focus?: number): TownSceneHandle {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true })
  } catch {
    callbacks.error()
    return NOOP
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.domElement.setAttribute('aria-hidden', 'true')
  renderer.domElement.style.touchAction = 'none'
  renderer.domElement.style.display = 'block'
  host.appendChild(renderer.domElement)

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const scene = new THREE.Scene()
  scene.background = SKY.day.clone()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 700)
  const hemi = new THREE.HemisphereLight(HEMI.day, HEMI.groundDay, 1.7)
  const sun = new THREE.DirectionalLight(SUN.day, 2.4)
  sun.position.copy(SUN_OFFSET)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  let shadowSpan = 0
  scene.add(hemi, sun, sun.target)

  const model: TownModel = buildTownModel(town)
  scene.add(model.root)
  const sky = skyDecor()
  scene.add(sky.group)

  // くるま・でんしゃ。
  const random = Math.random
  let tracks: Track[] = startTracks(town, random)
  const vehicles = new Map<number, THREE.Group>()
  const vehicleRoot = new THREE.Group()
  vehicleRoot.name = 'town-vehicles'
  for (const track of tracks) {
    const group = vehicleModel(model.kit, track.lead.kind, track.lead.variant)
    group.userData.vehicleId = track.lead.id
    vehicles.set(track.lead.id, group)
    vehicleRoot.add(group)
  }
  scene.add(vehicleRoot)
  let progress = 0

  // タップした ところの しるし。
  const markerGeometry = new THREE.RingGeometry(0.42, 0.5, 32).rotateX(-Math.PI / 2)
  const markerMaterial = new THREE.MeshBasicMaterial({ color: '#ffd43b', transparent: true, opacity: 0, depthWrite: false })
  const marker = new THREE.Mesh(markerGeometry, markerMaterial)
  marker.visible = false
  scene.add(marker)
  let markerStart = -1

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.rotateSpeed = 0.7
  controls.panSpeed = 0.9
  controls.screenSpacePanning = false
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
  controls.minDistance = 2.2
  controls.minPolarAngle = 0.12
  controls.maxPolarAngle = 1.38
  controls.autoRotateSpeed = 0.6
  controls.autoRotate = false
  const home = focus === undefined ? { x: 0, z: 0 } : tileCenter(focus)
  controls.target.set(home.x, 0.2, home.z)

  let disposed = false
  let failed = false
  let raf = 0
  let last: number | null = null
  let seconds = 0
  let fit = 24
  let nightness = night ? 1 : 0
  let nightTarget = nightness
  let tourWanted = !reducedMotion
  let intro: { start: number } | null = reducedMotion ? null : { start: 0 }
  type Mode = { kind: 'sky' } | { kind: 'ride'; id: number } | { kind: 'return' }
  let mode: Mode = { kind: 'sky' }
  const skyView = { position: new THREE.Vector3(), target: new THREE.Vector3() }
  const look = new THREE.Vector3()

  /** はじめの みかた（みなみ がわ から ななめに みおろす）。 */
  function homeSpherical(distance: number) {
    return new THREE.Spherical(distance, 0.98, 0.42)
  }

  function placeOnSphere(spherical: THREE.Spherical) {
    camera.position.setFromSpherical(spherical).add(controls.target)
    camera.lookAt(controls.target)
  }

  function applyNight(amount: number) {
    ;(scene.background as THREE.Color).copy(SKY.day).lerp(SKY.night, amount)
    hemi.color.copy(HEMI.day).lerp(HEMI.night, amount)
    hemi.groundColor.copy(HEMI.groundDay).lerp(HEMI.groundNight, amount)
    hemi.intensity = 1.7 + (0.4 - 1.7) * amount
    sun.color.copy(SUN.day).lerp(SUN.night, amount)
    sun.intensity = 2.4 + (0.5 - 2.4) * amount
    sky.stars.opacity = amount
    sky.moon.opacity = amount
    sky.cloud.color.copy(CLOUD.day).lerp(CLOUD.night, amount)
    model.setNight(amount)
  }

  /** 2ほんゆびで ずらしても ちずの うえから はなれない（カメラも おなじ だけ うごかす）。 */
  function clampTarget() {
    const target = controls.target
    const limitX = COLS / 2
    const limitZ = ROWS / 2
    const clamped = new THREE.Vector3(clamp(target.x, -limitX, limitX), clamp(target.y, 0, 1.5), clamp(target.z, -limitZ, limitZ))
    const shift = clamped.sub(target)
    if (shift.lengthSq() === 0) return
    target.add(shift)
    camera.position.add(shift)
  }

  /** ひろい ちずでも かげが くっきり するよう、みて いる あたり だけに かげを おとす。 */
  function updateShadow() {
    const center = mode.kind === 'sky' ? controls.target : look
    const span = clamp(camera.position.distanceTo(center) * 0.55, 9, 30)
    if (Math.abs(span - shadowSpan) > shadowSpan * 0.15) {
      shadowSpan = span
      Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 60 })
      sun.shadow.camera.updateProjectionMatrix()
    }
    // かげが ちらつかない よう、マスの はんぶんの きざみで うごかす。
    sun.target.position.set(Math.round(center.x * 2) / 2, 0, Math.round(center.z * 2) / 2)
    sun.position.copy(sun.target.position).add(SUN_OFFSET)
  }

  function trackOf(id: number): Track | undefined {
    return tracks.find((track) => track.lead.id === id)
  }

  function updateVehicles() {
    for (const track of tracks) {
      const group = vehicles.get(track.lead.id)
      if (!group) continue
      const pose = trackPose(track, progress)
      group.position.set(pose.x, RIDE_HEIGHT[track.lead.kind], pose.z)
      group.rotation.y = pose.heading
    }
  }

  function updateCrossings() {
    const trains = tracks.filter((track) => track.lead.kind === 'train').map((track) => vehicles.get(track.lead.id)!.position)
    const blink = Math.floor(seconds * 2.5) % 2
    for (const crossing of model.crossings) {
      const near = trains.some((position) => Math.hypot(position.x - crossing.center.x, position.z - crossing.center.z) < 1.4)
      crossing.lamps.forEach((lamp, index) => {
        lamp.material = model.kit.resolve(near && index % 2 === blink ? model.kit.glow('red') : '#5a1d1d')
      })
    }
  }

  function updateMarker() {
    if (markerStart < 0) return
    const t = (seconds - markerStart) / 0.7
    if (t >= 1) {
      marker.visible = false
      markerStart = -1
      return
    }
    marker.visible = true
    marker.scale.setScalar(0.7 + t * 0.5)
    markerMaterial.opacity = 1 - t
  }

  function updateCamera(dt: number) {
    if (mode.kind === 'ride') {
      const track = trackOf(mode.id)
      const group = vehicles.get(mode.id)
      if (!track || !group) {
        land()
        return
      }
      const setting = RIDE_CAMERA[track.lead.kind]
      const forward = new THREE.Vector3(-Math.sin(group.rotation.y), 0, -Math.cos(group.rotation.y))
      const eye = group.position.clone().addScaledVector(forward, -setting.back).setY(group.position.y + setting.up)
      const ahead = group.position.clone().addScaledVector(forward, setting.ahead).setY(group.position.y + setting.look)
      const k = 1 - Math.exp(-dt * 5)
      camera.position.lerp(eye, k)
      look.lerp(ahead, k)
      camera.lookAt(look)
      return
    }
    if (mode.kind === 'return') {
      const k = 1 - Math.exp(-dt * 4)
      camera.position.lerp(skyView.position, k)
      look.lerp(skyView.target, k)
      camera.lookAt(look)
      if (camera.position.distanceTo(skyView.position) < 0.05) {
        mode = { kind: 'sky' }
        camera.position.copy(skyView.position)
        controls.target.copy(skyView.target)
        controls.enabled = true
        controls.autoRotate = tourWanted
      }
      return
    }
    if (intro) {
      const t = clamp((seconds - intro.start) / INTRO_SECONDS, 0, 1)
      const e = ease(t)
      const home = homeSpherical(fit)
      placeOnSphere(new THREE.Spherical(fit * (1.7 - 0.7 * e), 0.35 + (home.phi - 0.35) * e, home.theta + 1.4 * (1 - e)))
      if (t >= 1) {
        intro = null
        controls.autoRotate = tourWanted
      }
    }
    controls.update(dt)
    clampTarget()
  }

  function render(time: number) {
    raf = 0
    if (disposed || failed) return
    const dt = last === null ? 0 : Math.min(0.1, (time - last) / 1000)
    last = time
    seconds += dt
    progress += dt / STEP_SECONDS
    for (let guard = 0; progress >= 1 && guard < 3; guard += 1) {
      tracks = advanceTracks(town, tracks, random)
      progress -= 1
    }
    progress = Math.min(progress, 0.999)
    updateVehicles()
    updateCrossings()
    if (nightness !== nightTarget) {
      const step = dt / NIGHT_SECONDS
      nightness = nightTarget > nightness ? Math.min(nightTarget, nightness + step) : Math.max(nightTarget, nightness - step)
      applyNight(nightness)
    }
    for (const tick of model.ticks) tick(reducedMotion ? 0 : seconds)
    sky.group.rotation.y = reducedMotion ? 0 : seconds * 0.01
    updateMarker()
    updateCamera(dt)
    updateShadow()
    renderer.render(scene, camera)
    raf = requestAnimationFrame(render)
  }

  function start() {
    if (disposed || failed || raf) return
    last = null
    raf = requestAnimationFrame(render)
  }

  function stop() {
    cancelAnimationFrame(raf)
    raf = 0
  }

  function resize() {
    const width = Math.max(1, host.clientWidth)
    const height = Math.max(1, host.clientHeight)
    const aspect = width / height
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    const previous = fit
    fit = fitDistance(aspect, FOV)
    controls.maxDistance = farDistance(aspect, FOV)
    if (mode.kind === 'sky' && !intro && previous !== fit) {
      // がめんの むきが かわったら、おなじ わりあいの きょりに する。
      const offset = camera.position.clone().sub(controls.target)
      offset.setLength(clamp(offset.length() * (fit / previous), controls.minDistance, controls.maxDistance))
      camera.position.copy(controls.target).add(offset)
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height, false)
  }

  function stopTour() {
    intro = null
    if (controls.autoRotate || tourWanted) {
      tourWanted = false
      controls.autoRotate = false
      callbacks.tour(false)
    }
  }

  function turn(step: number) {
    if (mode.kind !== 'sky') return
    stopTour()
    controls.rotateLeft(-step * (Math.PI / 6))
  }

  function zoom(step: number) {
    if (mode.kind !== 'sky') return
    stopTour()
    // OrbitControls の dollyIn は 1より ちいさい わりあいで ちかづく。
    if (step > 0) controls.dollyIn(1 / 1.3)
    else controls.dollyOut(1 / 1.3)
  }

  function ride(kind: VehicleKind): boolean {
    const candidates = tracks.filter((track) => track.lead.kind === kind).map((track) => track.lead.id).sort((a, b) => a - b)
    if (!candidates.length) return false
    const current = mode.kind === 'ride' ? mode.id : null
    const index = current === null ? -1 : candidates.indexOf(current)
    const next = candidates[(index + 1) % candidates.length]
    if (mode.kind === 'sky') {
      intro = null
      skyView.position.copy(camera.position)
      skyView.target.copy(controls.target)
      look.copy(controls.target)
    }
    controls.enabled = false
    controls.autoRotate = false
    mode = { kind: 'ride', id: next }
    return true
  }

  function land() {
    if (mode.kind !== 'ride') return
    mode = { kind: 'return' }
  }

  // ---------------- タップで なまえを みる ----------------

  const raycaster = new THREE.Raycaster()
  let press: { id: number; x: number; y: number; moved: boolean } | null = null
  let fingers = 0

  function pick(clientX: number, clientY: number) {
    const rect = renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1, -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1)
    scene.updateMatrixWorld(true)
    camera.updateMatrixWorld()
    raycaster.setFromCamera(ndc, camera)
    // ひるの あかりの わ など、みえない ものには あたらない。
    const hit = raycaster.intersectObjects([vehicleRoot, model.root], true).find(({ object }) => {
      const material = (object as THREE.Mesh).material
      return object.visible && !(material instanceof THREE.Material && (!material.visible || material.opacity < 0.05))
    })
    if (!hit) return
    let object: THREE.Object3D | null = hit.object
    while (object && object.userData.vehicle === undefined) object = object.parent
    if (object) {
      callbacks.pick({ kind: 'vehicle', vehicle: object.userData.vehicle as VehicleKind })
      return
    }
    const point = hit.point.clone().addScaledVector(raycaster.ray.direction, 0.01)
    const index = tileAt(point.x, point.z)
    if (index === null) return
    const tile = town[index]
    const center = tileCenter(index)
    marker.position.set(center.x, 0.06, center.z)
    markerStart = seconds
    callbacks.pick(tile.part ? { kind: 'part', part: tile.part, bridge: tile.ground === 'water' } : { kind: 'ground', ground: tile.ground })
  }

  function down(event: PointerEvent) {
    fingers += 1
    press = fingers === 1 && (event.button ?? 0) === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false } : null
  }

  function move(event: PointerEvent) {
    if (press && press.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_PX) press.moved = true
  }

  function up(event: PointerEvent) {
    fingers = Math.max(0, fingers - 1)
    if (press && press.id === event.pointerId && !press.moved) pick(event.clientX, event.clientY)
    press = null
  }

  function cancel() {
    fingers = Math.max(0, fingers - 1)
    press = null
  }

  function lost(event: Event) {
    event.preventDefault()
    failed = true
    stop()
    callbacks.error()
  }

  controls.addEventListener('start', stopTour)
  const canvas = renderer.domElement
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', cancel)
  canvas.addEventListener('webglcontextlost', lost)
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
  observer?.observe(host)
  resize()
  applyNight(nightness)
  placeOnSphere(intro ? new THREE.Spherical(fit * 1.7, 0.35, homeSpherical(fit).theta + 1.4) : homeSpherical(fit))
  controls.autoRotate = !intro && tourWanted
  controls.update()
  updateVehicles()
  updateShadow()
  const stopObserving = observeGameActivity((active) => {
    if (active) start()
    else stop()
  })
  const count = (kind: VehicleKind) => tracks.filter((track) => track.lead.kind === kind).length
  callbacks.ready({ car: count('car'), train: count('train') })

  return {
    setNight(next) {
      nightTarget = next ? 1 : 0
      if (reducedMotion) {
        nightness = nightTarget
        applyNight(nightness)
      }
    },
    setTour(on) {
      tourWanted = on
      if (on) intro = null
      controls.autoRotate = on && mode.kind === 'sky'
    },
    turn,
    zoom,
    ride,
    land,
    dispose() {
      disposed = true
      stop()
      stopObserving()
      observer?.disconnect()
      controls.removeEventListener('start', stopTour)
      controls.dispose()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', cancel)
      canvas.removeEventListener('webglcontextlost', lost)
      scene.remove(vehicleRoot, sky.group, marker)
      vehicleRoot.clear()
      model.dispose()
      sky.dispose()
      markerGeometry.dispose()
      markerMaterial.dispose()
      sun.shadow.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
