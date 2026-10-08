import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { createDecoration, DECORATION_RISE } from './decorations'
import { drawPaint, drawStrokeSegments, MAX_STROKE_POINTS, shownHex, type BrushId, type GlazeId, type PaintState, type PaintSurface, type Stroke, type StrokePoint } from './paint'
import { createPotGeometry, updatePotGeometry } from './potGeometry'
import { radiusAt, radiusAtWallFraction, sculptRadii, wallMetrics, type PotKind, type Profile } from './pottery'
import { playPaintSound, playSculptSound } from './sounds'

export type RokuroPhase = 'shape' | 'paint' | 'bake' | 'done'

/** React 側から 3D へ わたす 表示の じょうたい。 */
export type RokuroView = {
  phase: RokuroPhase
  profile: Profile
  paint: PaintState
  /** null の ときは ゆびで さわっても かかない（ぜんたいを ぬる モード）。 */
  brush: BrushId | null
  brushColor: GlazeId
  /** おだいの おてほん。じゆうの ときは null。 */
  target: Profile | null
  kind: PotKind
  /** キーボードで さわる たかさ（0〜1）。null なら 出さない。 */
  cursor: number | null
}

export type RokuroCallbacks = {
  status: (status: 'loading' | 'ready' | 'error') => void
  /** ゆびを はなした ときの かたち。 */
  profile: (profile: Profile) => void
  /** ゆびを はなした ときの ふでの せん。 */
  stroke: (stroke: Stroke) => void
}

export type RokuroSceneHandle = {
  sync: (view: RokuroView) => void
  /** やきあがりの 小さな しゃしん（data URL）。とれなければ null。 */
  capture: () => string | null
  dispose: () => void
}

/** かまに いれてから だすまで [ms]。React 側も この じかんで できあがりに すすむ。 */
export const BAKE_MS = 3000
const KILN_DROP = 0.6
const KILN_LIFT = 2.4
const TEXTURE_WIDTH = 1024
const TEXTURE_HEIGHT = 512
const MIN_HALF_WIDTH = 1.35
const FOV = 30
const SPIN: Record<RokuroPhase, number> = { shape: 2.6, paint: 3.6, bake: 0, done: 0.7 }

type Pointer = { id: number; x: number; y: number }

function copyProfile(profile: Profile): { height: number; radii: number[] } {
  return { height: profile.height, radii: [...profile.radii] }
}

function disposeTree(root: THREE.Object3D) {
  root.traverse(node => {
    const mesh = node as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose()
      material.dispose()
    }
  })
}

function createWheel(): THREE.Group {
  const wheel = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: '#9aa4ad', roughness: 0.45, metalness: 0.35 })
  const head = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.8, 0.18, 64), metal)
  head.position.y = -0.09
  head.receiveShadow = true
  wheel.add(head)
  // まわっているのが わかる めじるし。
  const marks = new THREE.Group()
  marks.name = 'wheel-marks'
  const markMaterial = new THREE.MeshStandardMaterial({ color: '#6c7780', roughness: 0.6 })
  for (let i = 0; i < 8; i++) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.3), markMaterial)
    const angle = (i / 8) * Math.PI * 2
    mark.position.set(Math.sin(angle) * 1.6, 0.005, Math.cos(angle) * 1.6)
    mark.rotation.y = angle
    marks.add(mark)
  }
  wheel.add(marks)
  const pan = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(0.9, -0.55), new THREE.Vector2(2.35, -0.55), new THREE.Vector2(2.4, -0.05), new THREE.Vector2(2.28, -0.05), new THREE.Vector2(2.22, -0.45), new THREE.Vector2(0.9, -0.45)], 64),
    new THREE.MeshStandardMaterial({ color: '#5d8fc4', roughness: 0.55, side: THREE.DoubleSide }),
  )
  pan.receiveShadow = true
  wheel.add(pan)
  return wheel
}

function createKiln(): { group: THREE.Group; window: THREE.MeshBasicMaterial; flames: THREE.Mesh[]; glow: THREE.PointLight } {
  const group = new THREE.Group()
  group.name = 'kiln'
  const brick = new THREE.MeshStandardMaterial({ color: '#b9572f', roughness: 0.9, side: THREE.DoubleSide })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.98, 2.08, 3.5, 40, 1, true), brick)
  body.position.y = 1.75
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.98, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), brick)
  dome.scale.y = 0.55
  dome.position.y = 3.5
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.8, 16), new THREE.MeshStandardMaterial({ color: '#8d3f22', roughness: 0.9 }))
  chimney.position.set(0.7, 4.4, 0)
  const windowMaterial = new THREE.MeshBasicMaterial({ color: '#ffb347' })
  const window = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), windowMaterial)
  window.position.set(0, 1.0, 2.09)
  const bands = new THREE.Mesh(new THREE.TorusGeometry(2.04, 0.06, 8, 48), new THREE.MeshStandardMaterial({ color: '#7a3518', roughness: 0.8 }))
  bands.rotation.x = Math.PI / 2
  bands.position.y = 2.4
  const flames: THREE.Mesh[] = []
  for (let i = 0; i < 7; i++) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 10), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffd23f' : '#ff7a1a', transparent: true, opacity: 0.9 }))
    const angle = ((i - 3) / 7) * Math.PI * 0.9
    flame.position.set(Math.sin(angle) * 2.2, 0.15, Math.cos(angle) * 2.2)
    flames.push(flame)
    group.add(flame)
  }
  const glow = new THREE.PointLight('#ff8a3d', 0, 7)
  glow.position.set(0, 1.2, 3)
  group.add(body, dome, chimney, window, bands, glow)
  group.visible = false
  return { group, window: windowMaterial, flames, glow }
}

function createSparkles(): THREE.Group {
  const group = new THREE.Group()
  const geometry = new THREE.OctahedronGeometry(0.07)
  for (let i = 0; i < 16; i++) {
    const sparkle = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: i % 3 ? '#fff3a6' : '#ffffff', transparent: true }))
    sparkle.userData.seed = i * 1.37
    group.add(sparkle)
  }
  group.visible = false
  return group
}

export function createRokuroScene(host: HTMLDivElement, initial: RokuroView, callbacks: RokuroCallbacks): RokuroSceneHandle {
  let view = initial
  let disposed = false
  let failed = false
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.setAttribute('aria-hidden', 'true')
    host.appendChild(renderer.domElement)
  } catch {
    callbacks.status('error')
    return { sync: () => {}, capture: () => null, dispose: () => {} }
  }
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  const scene = new THREE.Scene()
  let environment: THREE.WebGLRenderTarget | null = null
  const room = new RoomEnvironment()
  let pmrem: THREE.PMREMGenerator | null = null
  try {
    pmrem = new THREE.PMREMGenerator(renderer)
    environment = pmrem.fromScene(room, 0.04)
    scene.environment = environment.texture
    scene.environmentIntensity = 0.45
  } catch {
    // つやの うつりこみが なくても あそべる。
  } finally {
    room.dispose()
    pmrem?.dispose()
  }
  scene.add(new THREE.HemisphereLight('#fffaf0', '#d6bfa4', 1.5))
  const sun = new THREE.DirectionalLight('#fff4e2', 2.1)
  sun.position.set(3, 7, 5)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 5, bottom: -2, near: 1, far: 20 })
  sun.shadow.normalBias = 0.02
  sun.shadow.intensity = 0.4
  scene.add(sun)
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60)

  const wheel = createWheel()
  scene.add(wheel)
  const wheelMarks = wheel.getObjectByName('wheel-marks')!

  // ねんど（もようの テクスチャ）。
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_WIDTH
  canvas.height = TEXTURE_HEIGHT
  let paintContext: CanvasRenderingContext2D | null = null
  try {
    paintContext = canvas.getContext('2d')
  } catch {
    paintContext = null
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.anisotropy = 4
  const outer = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 })
  const inner = new THREE.MeshStandardMaterial({ roughness: 0.95 })
  let shown = copyProfile(view.profile)
  let committed = view.profile
  const geometry = createPotGeometry(shown)
  const pot = new THREE.Mesh(geometry, [outer, inner])
  pot.castShadow = true
  pot.receiveShadow = true
  const spinner = new THREE.Group()
  spinner.add(pot)
  scene.add(spinner)

  let ghost: THREE.Mesh | null = null
  const ghostMaterial = new THREE.MeshBasicMaterial({ color: '#7fd3ff', transparent: true, opacity: 0.25, depthWrite: false })
  let ghostProfile: Profile | null = null

  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 8, 72), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthTest: false }))
  ring.rotation.x = Math.PI / 2
  ring.renderOrder = 3
  ring.visible = false
  scene.add(ring)
  const tipMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' })
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), tipMaterial)
  tip.visible = false
  scene.add(tip)

  const kiln = createKiln()
  scene.add(kiln.group)
  const sparkles = createSparkles()
  scene.add(sparkles)
  let decoration: THREE.Group | null = null
  let decorationKey = ''

  let baked = false
  let bakeStartedAt: number | null = null
  let doneAt: number | null = null
  let spin = 0
  let spinSpeed = SPIN[view.phase]
  let tween: { from: { height: number; radii: number[] }; to: Profile; start: number } | null = null
  let pointer: Pointer | null = null
  let sculpted = false
  let stroke: { color: GlazeId; brush: BrushId; points: StrokePoint[] } | null = null
  let lastSoundAt = 0
  let lastTime = performance.now()
  let raf = 0
  let aspect = 1
  let cameraDistance = 9
  let cameraCenter = 1
  let cameraElevation = 0.16
  let paintKey: PaintState | null = null
  let paintBaked = false

  const surface = (): PaintSurface => {
    const { fractions, length } = wallMetrics(shown)
    return { width: TEXTURE_WIDTH, height: TEXTURE_HEIGHT, wallLength: length, radiusAtV: v => radiusAtWallFraction(shown, v, fractions) }
  }

  function redrawPaint() {
    paintKey = view.paint
    paintBaked = baked
    if (!paintContext) return
    drawPaint(paintContext, surface(), view.paint, baked)
    texture.needsUpdate = true
  }

  function applyMaterials() {
    const glazed = view.paint.base !== null
    const roughness = baked ? (glazed ? 0.16 : 0.75) : 0.95
    outer.roughness = roughness
    inner.roughness = roughness
    outer.envMapIntensity = baked ? 1.1 : 0.25
    inner.envMapIntensity = outer.envMapIntensity
    inner.color.set(shownHex(view.paint.base, baked))
    if (view.paint.base === null && !baked) inner.color.set('#b57f55')
  }

  function setBaked(next: boolean) {
    if (baked === next) return
    baked = next
    applyMaterials()
    redrawPaint()
  }

  function updateGhost() {
    const target = view.phase === 'shape' || view.phase === 'paint' ? view.target : null
    if (target === ghostProfile) return
    if (ghost) {
      scene.remove(ghost)
      ghost.geometry.dispose()
      ghost = null
    }
    ghostProfile = target
    if (!target) return
    ghost = new THREE.Mesh(createPotGeometry(target), ghostMaterial)
    ghost.renderOrder = 2
    scene.add(ghost)
  }

  function updateDecoration() {
    const key = view.phase === 'done' ? `${view.kind}:${view.profile.height}:${view.profile.radii.join(',')}` : ''
    if (key === decorationKey) return
    decorationKey = key
    if (decoration) {
      spinner.remove(decoration)
      disposeTree(decoration)
      decoration = null
    }
    if (!key) return
    decoration = createDecoration(view.kind, view.profile)
    spinner.add(decoration)
  }

  function showProfile(profile: { height: number; radii: readonly number[] }) {
    shown = { height: profile.height, radii: [...profile.radii] }
    updatePotGeometry(geometry, shown)
  }

  function sync(next: RokuroView) {
    if (disposed) return
    const previousPhase = view.phase
    view = next
    if (next.profile !== committed) {
      committed = next.profile
      if (pointer && next.phase === 'shape') pointer = null
      if (reducedMotion) showProfile(next.profile)
      else tween = { from: copyProfile(shown), to: next.profile, start: performance.now() }
    }
    if (next.phase !== previousPhase) {
      finishStroke()
      pointer = null
      bakeStartedAt = next.phase === 'bake' ? performance.now() : null
      doneAt = next.phase === 'done' ? performance.now() : null
      if (next.phase === 'bake') {
        kiln.group.visible = true
        kiln.group.position.y = reducedMotion ? 0 : 7
      } else kiln.group.visible = false
    }
    if (next.phase === 'shape' || next.phase === 'paint') setBaked(false)
    if (next.phase === 'done') setBaked(true)
    if (next.phase === 'bake' && reducedMotion) setBaked(true)
    applyMaterials()
    if (next.paint !== paintKey || paintBaked !== baked) redrawPaint()
    tipMaterial.color.set(shownHex(next.brushColor, true))
    updateGhost()
    updateDecoration()
    requestRender()
  }

  // ---- ゆびの そうさ ----
  const raycaster = new THREE.Raycaster()
  const axisPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  function setRay(point: Pointer) {
    const rect = host.getBoundingClientRect()
    raycaster.setFromCamera(new THREE.Vector2(((point.x - rect.left) / Math.max(1, rect.width)) * 2 - 1, -((point.y - rect.top) / Math.max(1, rect.height)) * 2 + 1), camera)
  }

  function finishStroke() {
    const current = stroke
    stroke = null
    tip.visible = false
    if (current && current.points.length) callbacks.stroke({ color: current.color, brush: current.brush, points: current.points })
  }

  function finishPointer() {
    const wasSculpting = sculpted
    pointer = null
    sculpted = false
    finishStroke()
    if (wasSculpting) {
      const profile = { height: shown.height, radii: [...shown.radii] }
      committed = profile
      callbacks.profile(profile)
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (failed || pointer || event.button > 0 || event.isPrimary === false) return
    if (view.phase !== 'shape' && !(view.phase === 'paint' && view.brush)) return
    event.preventDefault()
    tween = null
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
    try {
      host.setPointerCapture?.(event.pointerId)
    } catch {
      // キャプチャできなくても うごかせる。
    }
    if (view.phase === 'paint' && view.brush) stroke = { color: view.brushColor, brush: view.brush, points: [] }
    requestRender()
  }
  function onPointerMove(event: PointerEvent) {
    if (!pointer || event.pointerId !== pointer.id) return
    event.preventDefault()
    pointer.x = event.clientX
    pointer.y = event.clientY
  }
  function onPointerUp(event: PointerEvent) {
    if (!pointer || event.pointerId !== pointer.id) return
    try {
      if (host.hasPointerCapture?.(event.pointerId)) host.releasePointerCapture(event.pointerId)
    } catch {
      // すでに はなれていても よい。
    }
    finishPointer()
  }
  host.addEventListener('pointerdown', onPointerDown)
  host.addEventListener('pointermove', onPointerMove)
  host.addEventListener('pointerup', onPointerUp)
  host.addEventListener('pointercancel', onPointerUp)
  host.addEventListener('lostpointercapture', onPointerUp)

  /** ゆびの たかさ（わを 出す ところ）を かえす。 */
  function sculptStep(dt: number, time: number): number | null {
    if (!pointer) return null
    setRay(pointer)
    const hit = raycaster.ray.intersectPlane(axisPlane, new THREE.Vector3())
    if (!hit) return null
    const before = radiusAt(shown, hit.y)
    if (sculptRadii(shown.radii, shown.height, { y: hit.y, radius: Math.abs(hit.x) }, dt)) {
      sculpted = true
      updatePotGeometry(geometry, shown)
      if (time - lastSoundAt > 150) {
        lastSoundAt = time
        playSculptSound(Math.abs(hit.x) > before)
      }
    }
    return Math.min(shown.height, Math.max(0, hit.y))
  }

  function paintStep(time: number) {
    if (!pointer || !stroke) return
    setRay(pointer)
    spinner.updateMatrixWorld(true)
    // いちばん てまえで あたった ところが そとがわの かべの ときだけ かく。
    const hit = raycaster.intersectObject(pot, false)[0]
    if (!hit?.uv || hit.face?.materialIndex !== 0) {
      tip.visible = false
      return
    }
    tip.visible = true
    tip.position.copy(hit.point)
    const u = ((hit.uv.x % 1) + 1) % 1
    const v = Math.min(1, Math.max(0, hit.uv.y))
    const last = stroke.points[stroke.points.length - 1]
    if (last) {
      let du = Math.abs(u - last[0])
      if (du > 0.5) du = 1 - du
      if (du < 0.004 && Math.abs(v - last[1]) < 0.004) return
    }
    stroke.points.push([Math.round(u * 1000) / 1000, Math.round(v * 1000) / 1000])
    if (paintContext) {
      drawStrokeSegments(paintContext, surface(), stroke, stroke.points.length - 1, baked)
      texture.needsUpdate = true
    }
    if (time - lastSoundAt > 180) {
      lastSoundAt = time
      playPaintSound()
    }
    if (stroke.points.length >= MAX_STROKE_POINTS) {
      const { color, brush } = stroke
      finishStroke()
      stroke = { color, brush, points: [] }
    }
  }

  function updateKiln(time: number) {
    if (view.phase !== 'bake' || bakeStartedAt === null) return
    const t = (time - bakeStartedAt) / 1000
    if (reducedMotion) {
      kiln.group.position.y = 0
    } else if (t < KILN_DROP) {
      const k = t / KILN_DROP
      kiln.group.position.y = 7 * (1 - k) ** 2
    } else if (t < KILN_LIFT) {
      kiln.group.position.y = 0
      setBaked(true)
    } else {
      const k = Math.min(1, (t - KILN_LIFT) / (BAKE_MS / 1000 - KILN_LIFT))
      kiln.group.position.y = 7 * k * k
    }
    const heat = t > KILN_DROP * 0.8 && t < KILN_LIFT + 0.2 ? 1 : 0
    const flicker = reducedMotion ? 0.8 : 0.75 + Math.sin(time * 0.025) * 0.15 + Math.sin(time * 0.061) * 0.1
    kiln.window.color.setRGB(1, 0.45 + flicker * 0.35 * heat, 0.15)
    kiln.glow.intensity = heat * flicker * 6
    kiln.flames.forEach((flame, index) => {
      flame.visible = heat > 0
      flame.scale.y = reducedMotion ? 1 : 0.7 + Math.abs(Math.sin(time * 0.012 + index * 1.7)) * 0.6
    })
  }

  function updateSparkles(time: number) {
    const active = view.phase === 'done' && doneAt !== null && !reducedMotion && time - doneAt < 3600
    sparkles.visible = active
    if (!active) return
    const t = (time - doneAt!) / 1000
    const top = shown.height + DECORATION_RISE[view.kind] * 0.6
    sparkles.children.forEach(child => {
      const seed = child.userData.seed as number
      const angle = seed * 2.3 + t * 0.6
      const radius = Math.max(...shown.radii) + 0.3 + (seed % 0.5)
      child.position.set(Math.sin(angle) * radius, ((seed * 0.73 + t * 0.35) % 1) * top, Math.cos(angle) * radius)
      const twinkle = Math.max(0, Math.sin(t * 5 + seed * 3))
      child.scale.setScalar(0.4 + twinkle)
      child.rotation.y = t * 3 + seed
    })
  }

  let frame = { distance: cameraDistance, center: cameraCenter }
  function cameraFrame() {
    const decorationRise = view.phase === 'done' ? DECORATION_RISE[view.kind] : 0.35
    // できあがりでは うえに「できた！」の ふだが でるので、そのぶん あたまの うえを あける。
    const headroom = view.phase === 'done' ? 0.9 : 0
    const top = Math.max(shown.height + decorationRise, ghostProfile ? ghostProfile.height + 0.35 : 0, 1.5) + headroom
    const bottom = -0.45
    // うつわの はばに あわせて よる。ゆびで そとへ ひっぱれる よゆうを のこす。
    const halfWidth = Math.max(MIN_HALF_WIDTH, Math.max(...shown.radii, ...(ghostProfile?.radii ?? [])) + 0.6)
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    return { distance: Math.max((top - bottom) / 2 / tan, halfWidth / (tan * aspect)) * 1.1, center: (top + bottom) / 2 }
  }

  function updateCamera(dt: number, immediate: boolean) {
    // ゆびで かたちを かえている あいだは わくを うごかさない（ゆびの いちと ねんどが ずれないように）。
    if (immediate || !(pointer && view.phase === 'shape')) frame = cameraFrame()
    const { distance, center } = frame
    const elevation = view.phase === 'shape' ? 0.16 : 0.32
    const k = immediate ? 1 : 1 - Math.exp(-dt * 5)
    cameraDistance += (distance - cameraDistance) * k
    cameraCenter += (center - cameraCenter) * k
    cameraElevation += (elevation - cameraElevation) * k
    camera.position.set(0, cameraCenter + Math.sin(cameraElevation) * cameraDistance, Math.cos(cameraElevation) * cameraDistance)
    camera.lookAt(0, cameraCenter, 0)
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)
  }

  function requestRender() {
    if (!disposed && !failed && !raf) raf = requestAnimationFrame(render)
  }

  function render(time: number) {
    raf = 0
    if (disposed || failed) return
    const dt = Math.min(0.05, Math.max(0, (time - lastTime) / 1000))
    lastTime = time
    spinSpeed += (SPIN[view.phase] - spinSpeed) * (1 - Math.exp(-dt * 4))
    spin = (spin + spinSpeed * dt) % (Math.PI * 2)
    spinner.rotation.y = spin
    wheelMarks.rotation.y = spin
    if (tween) {
      const k = Math.min(1, (time - tween.start) / 220)
      const eased = 1 - (1 - k) ** 3
      showProfile({
        height: tween.from.height + (tween.to.height - tween.from.height) * eased,
        radii: tween.from.radii.map((radius, index) => radius + (tween!.to.radii[index]! - radius) * eased),
      })
      if (k >= 1) tween = null
    }
    updateCamera(dt, false)
    let ringY: number | null = null
    if (view.phase === 'shape') ringY = sculptStep(dt, time)
    if (view.phase === 'paint') paintStep(time)
    if (ringY === null && !pointer && view.cursor !== null && (view.phase === 'shape' || view.phase === 'paint')) ringY = view.cursor * shown.height
    ring.visible = ringY !== null
    if (ringY !== null) {
      ring.position.y = ringY
      ring.scale.setScalar(radiusAt(shown, ringY) + 0.04)
    }
    updateKiln(time)
    updateSparkles(time)
    renderer.render(scene, camera)
    // ろくろは いつも まわっているので、うごいている あいだは かきつづける。
    requestRender()
  }

  function resize() {
    const width = Math.max(1, host.clientWidth)
    const height = Math.max(1, host.clientHeight)
    aspect = width / height
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.setSize(width, height, false)
    updateCamera(0, true)
    requestRender()
  }

  function capture(): string | null {
    if (disposed || failed) return null
    const hidden = [wheel, ring, tip, sparkles, kiln.group].filter(node => node.visible)
    hidden.forEach(node => { node.visible = false })
    try {
      updateCamera(0, true)
      renderer.render(scene, camera)
      const source = renderer.domElement
      const box = new THREE.Box3().setFromObject(spinner)
      const corners = [box.min.x, box.max.x].flatMap(x => [box.min.y, box.max.y].flatMap(y => [box.min.z, box.max.z].map(z => new THREE.Vector3(x, y, z).project(camera))))
      const xs = corners.map(point => ((point.x + 1) / 2) * source.width)
      const ys = corners.map(point => ((1 - point.y) / 2) * source.height)
      const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 1.12
      const centerX = (Math.max(...xs) + Math.min(...xs)) / 2
      const centerY = (Math.max(...ys) + Math.min(...ys)) / 2
      const output = document.createElement('canvas')
      output.width = 192
      output.height = 192
      const context = output.getContext('2d')
      if (!context || !Number.isFinite(side) || side <= 0) return null
      context.drawImage(source, centerX - side / 2, centerY - side / 2, side, side, 0, 0, 192, 192)
      const url = output.toDataURL('image/webp', 0.85)
      return url.startsWith('data:image/') && url.length < 150_000 ? url : null
    } catch {
      return null
    } finally {
      hidden.forEach(node => { node.visible = true })
      requestRender()
    }
  }

  function lost(event: Event) {
    event.preventDefault()
    failed = true
    pointer = null
    stroke = null
    cancelAnimationFrame(raf)
    raf = 0
    callbacks.status('error')
  }
  renderer.domElement.addEventListener('webglcontextlost', lost)
  const observer = new ResizeObserver(resize)
  observer.observe(host)

  applyMaterials()
  redrawPaint()
  updateGhost()
  updateDecoration()
  resize()
  callbacks.status('ready')

  return {
    sync,
    capture,
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      raf = 0
      observer.disconnect()
      host.removeEventListener('pointerdown', onPointerDown)
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerup', onPointerUp)
      host.removeEventListener('pointercancel', onPointerUp)
      host.removeEventListener('lostpointercapture', onPointerUp)
      renderer.domElement.removeEventListener('webglcontextlost', lost)
      disposeTree(scene)
      ghostMaterial.dispose()
      sun.shadow.dispose()
      environment?.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
