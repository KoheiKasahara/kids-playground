// かんせいした おうちを 3D で みせる がめん。1ほんゆびで まわし、2ほんゆびで そとを ずらす・ちかづく。
// タップした ものは spot で しらせる。うごかして いない ときは かかない（でんちを つかいすぎない）。

import * as THREE from 'three'
import type { HouseDesign } from '../plan'
import { buildExterior } from './exterior'
import { fitExterior } from './framing'
import type { Built } from './kit'
import { buildRoom } from './rooms'

export type HouseView = { kind: 'outside' } | { kind: 'room'; roomId: number }
export type SceneSpot = 'door' | 'dog' | 'car' | 'room'

export type HouseSceneCallbacks = {
  status: (status: 'ready' | 'error') => void
  spot: (spot: SceneSpot) => void
}

export type HouseSceneHandle = {
  show: (design: HouseDesign, view: HouseView) => void
  /** よこに まわす（1 で すこし みぎへ）。 */
  turn: (step: number) => void
  /** ちかづく（1）・はなれる（-1）。 */
  zoom: (step: number) => void
  dispose: () => void
}

type Orbit = { yaw: number; pitch: number; zoom: number }

const LIMITS = {
  outside: { pitch: [.06, 1.2], start: { yaw: .42, pitch: .3, zoom: 1 } },
  room: { pitch: [.42, 1.4], start: { yaw: .62, pitch: .86, zoom: 1.1 } },
} as const
const ZOOM: readonly [number, number] = [.55, 1.9]
const INTRO_MS = 900
/** さわって いない ときに うごく かざりを かきつづける じかん。 */
const AMBIENT_MS = 15000
const TAP_PX = 8
const SKY = { outside: '#bfe6ff', room: '#f7eedd' }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const ease = (t: number) => 1 - Math.pow(1 - t, 3)

function viewKey(view: HouseView) {
  return view.kind === 'outside' ? 'outside' : `room-${view.roomId}`
}

function build(design: HouseDesign, view: HouseView): Built | null {
  if (view.kind === 'outside') return buildExterior(design)
  const room = design.rooms.find((r) => r.id === view.roomId)
  return room ? buildRoom(design, room) : null
}

export function createHouseScene(host: HTMLDivElement, design: HouseDesign, view: HouseView, callbacks: HouseSceneCallbacks): HouseSceneHandle {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true })
  } catch {
    callbacks.status('error')
    return { show: () => {}, turn: () => {}, zoom: () => {}, dispose: () => {} }
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.setAttribute('aria-hidden', 'true')
  renderer.domElement.style.touchAction = 'none'
  host.appendChild(renderer.domElement)

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 400)
  const hemi = new THREE.HemisphereLight('#ffffff', '#cdbb9b', 1.9)
  const sun = new THREE.DirectionalLight('#fff4e0', 2.3)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.bias = -.0004
  sun.shadow.normalBias = .03
  scene.add(hemi, sun, sun.target)

  let disposed = false
  let failed = false
  let built: Built | null = null
  let shown = ''
  let shownDesign: HouseDesign | null = null
  let kind: keyof typeof LIMITS = 'outside'
  let orbit: Orbit = { ...LIMITS.outside.start }
  const panOffset = new THREE.Vector3()
  let viewDistance = 1
  let intro: { from: Orbit; start: number } | null = null
  let ambientUntil = 0
  let raf = 0
  let aspect = 1

  function current(time: number): Orbit {
    if (!intro) return orbit
    const t = clamp((time - intro.start) / INTRO_MS, 0, 1)
    if (t >= 1) {
      intro = null
      return orbit
    }
    const e = ease(t)
    return {
      yaw: intro.from.yaw + (orbit.yaw - intro.from.yaw) * e,
      pitch: intro.from.pitch + (orbit.pitch - intro.from.pitch) * e,
      zoom: intro.from.zoom + (orbit.zoom - intro.from.zoom) * e,
    }
  }

  function place(time: number) {
    if (!built) return
    const o = current(time)
    const vfov = THREE.MathUtils.degToRad(camera.fov)
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect)
    const framing = built.framing ? fitExterior(built.framing, o.yaw, o.pitch, vfov, hfov) : null
    const fit = framing?.distance ?? built.radius / Math.sin(Math.min(vfov, hfov) / 2)
    const dist = fit / o.zoom
    viewDistance = dist
    const t = new THREE.Vector3().copy(framing?.target ?? built.target).add(panOffset)
    camera.position.set(
      t.x + Math.sin(o.yaw) * Math.cos(o.pitch) * dist,
      t.y + Math.sin(o.pitch) * dist,
      t.z + Math.cos(o.yaw) * Math.cos(o.pitch) * dist,
    )
    camera.lookAt(t)
    camera.near = Math.max(.1, dist - built.radius * 4)
    camera.far = dist + built.radius * 8 + 120
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)
    // カメラに ちかい かべは ひくく して なかを みせる。
    const toCam = new THREE.Vector3(Math.sin(o.yaw), 0, Math.cos(o.yaw))
    for (const wall of built.cutaways) {
      const near = wall.normal.dot(toCam) > .2
      wall.full.visible = !near
      wall.low.visible = near
    }
  }

  function requestRender() {
    if (!disposed && !failed && !raf) raf = requestAnimationFrame(render)
  }

  function render(time: number) {
    raf = 0
    if (disposed || failed || !built) return
    place(time)
    const lively = !reducedMotion && time < ambientUntil && built.ticks.length > 0
    if (lively) built.ticks.forEach((tick) => tick(time))
    renderer.render(scene, camera)
    if (intro || lively) requestRender()
  }

  function wake() {
    ambientUntil = performance.now() + AMBIENT_MS
    requestRender()
  }

  function show(next: HouseDesign, nextView: HouseView) {
    if (disposed) return
    const key = viewKey(nextView)
    if (key === shown && next === shownDesign) return
    const sameView = key === shown
    const made = build(next, nextView)
    if (built) {
      scene.remove(built.root)
      built.dispose()
    }
    built = made
    shown = key
    shownDesign = next
    if (!built) {
      renderer.render(scene, camera)
      return
    }
    scene.add(built.root)
    kind = nextView.kind === 'outside' ? 'outside' : 'room'
    scene.background = new THREE.Color(SKY[kind])
    scene.fog = kind === 'outside' ? new THREE.Fog(SKY.outside, built.radius * 5, built.radius * 12) : null
    // ひかり と かげの はんいを みる ものに あわせる。
    const r = built.radius
    sun.position.copy(built.target).add(new THREE.Vector3(r * .9, r * 1.8, r * 1.3))
    sun.target.position.copy(built.target)
    Object.assign(sun.shadow.camera, { left: -r * 1.6, right: r * 1.6, top: r * 1.6, bottom: -r * 1.6, near: .5, far: r * 6 })
    sun.shadow.camera.updateProjectionMatrix()
    if (!sameView) {
      panOffset.set(0, 0, 0)
      const start = { ...LIMITS[kind].start, yaw: built.yaw ?? LIMITS[kind].start.yaw }
      intro = reducedMotion ? null : { from: { yaw: start.yaw + .9, pitch: start.pitch + .12, zoom: start.zoom * .75 }, start: performance.now() }
      orbit = start
    }
    wake()
  }

  function resize() {
    const width = Math.max(1, host.clientWidth)
    const height = Math.max(1, host.clientHeight)
    aspect = width / height
    camera.aspect = aspect
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height, false)
    requestRender()
  }

  function turn(step: number) {
    intro = null
    orbit = { ...orbit, yaw: orbit.yaw + step * .5 }
    wake()
  }

  function zoom(step: number) {
    intro = null
    orbit = { ...orbit, zoom: clamp(orbit.zoom * (step > 0 ? 1.2 : 1 / 1.2), ZOOM[0], ZOOM[1]) }
    wake()
  }

  // ---------------- ゆび と マウス ----------------

  const pointers = new Map<number, { x: number; y: number }>()
  let press: { id: number; x: number; y: number; moved: boolean } | null = null
  let pinch = 0
  const raycaster = new THREE.Raycaster()

  function tap(x: number, y: number) {
    if (!built) return
    const rect = host.getBoundingClientRect()
    const ndc = new THREE.Vector2(((x - rect.left) / Math.max(1, rect.width)) * 2 - 1, -((y - rect.top) / Math.max(1, rect.height)) * 2 + 1)
    place(performance.now())
    scene.updateMatrixWorld(true)
    raycaster.setFromCamera(ndc, camera)
    const hits = raycaster.intersectObject(built.root, true)
    for (const hit of hits) {
      if (!hit.object.visible) continue
      let obj: THREE.Object3D | null = hit.object
      while (obj && obj.userData.spot === undefined) obj = obj.parent
      if (obj) {
        callbacks.spot(obj.userData.spot as SceneSpot)
        wake()
      }
      return
    }
  }

  function down(e: PointerEvent) {
    if (e.button !== undefined && e.button > 0) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try {
      host.setPointerCapture?.(e.pointerId)
    } catch {
      // うごかない ゆびの ときは つかまえなくても よい。
    }
    if (pointers.size === 1) press = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
    else {
      press = null
      const [a, b] = [...pointers.values()]
      pinch = Math.hypot(a.x - b.x, a.y - b.y)
    }
    intro = null
    wake()
  }

  function move(e: PointerEvent) {
    const last = pointers.get(e.pointerId)
    if (!last) return
    const dx = e.clientX - last.x
    const dy = e.clientY - last.y
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (kind === 'outside') {
        // がめんの よこ・たてに そって、2ほんの ゆびの まんなかに あわせて ずらす。
        place(performance.now())
        const scale = 2 * viewDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.max(1, host.clientHeight)
        panOffset.addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), -dx * scale / 2)
        panOffset.addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1), dy * scale / 2)
      }
      if (pinch > 0 && d > 0) orbit = { ...orbit, zoom: clamp(orbit.zoom * (d / pinch), ZOOM[0], ZOOM[1]) }
      pinch = d
      wake()
      return
    }
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_PX) press.moved = true
    if (press?.moved !== false) {
      const [lo, hi] = LIMITS[kind].pitch
      orbit = { ...orbit, yaw: orbit.yaw - dx * .009, pitch: clamp(orbit.pitch + dy * .006, lo, hi) }
      wake()
    }
  }

  function up(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return
    pointers.delete(e.pointerId)
    try {
      host.releasePointerCapture?.(e.pointerId)
    } catch {
      // つかまえて いなければ なにも しない。
    }
    if (press && press.id === e.pointerId && !press.moved) tap(e.clientX, e.clientY)
    press = null
    if (pointers.size < 2) pinch = 0
  }

  function cancel(e: PointerEvent) {
    pointers.delete(e.pointerId)
    press = null
    pinch = 0
  }

  function wheel(e: WheelEvent) {
    e.preventDefault()
    zoom(e.deltaY < 0 ? 1 : -1)
  }

  function lost(event: Event) {
    event.preventDefault()
    failed = true
    cancelAnimationFrame(raf)
    raf = 0
    callbacks.status('error')
  }

  host.addEventListener('pointerdown', down)
  host.addEventListener('pointermove', move)
  host.addEventListener('pointerup', up)
  host.addEventListener('pointercancel', cancel)
  host.addEventListener('wheel', wheel, { passive: false })
  renderer.domElement.addEventListener('webglcontextlost', lost)
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()
  show(design, view)
  callbacks.status('ready')

  return {
    show,
    turn,
    zoom,
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      raf = 0
      observer.disconnect()
      host.removeEventListener('pointerdown', down)
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerup', up)
      host.removeEventListener('pointercancel', cancel)
      host.removeEventListener('wheel', wheel)
      renderer.domElement.removeEventListener('webglcontextlost', lost)
      if (built) {
        scene.remove(built.root)
        built.dispose()
        built = null
      }
      sun.shadow.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
