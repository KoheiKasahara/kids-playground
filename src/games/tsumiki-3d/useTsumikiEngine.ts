import { useEffect, useRef, useState, type RefObject } from 'react'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { initializeRapier } from '../../physics/rapierLoader'
import { findColor, findShape, resolveColor, type BlockShapeId, type ColorChoice } from './blocks'
import { DROP_HEIGHT, GRID, goalsReached, HEIGHT_GOALS, MAT_RADIUS, MAX_BLOCKS, snapPlacement, type HeightGoal } from './placement'
import { createTsumikiVisuals, emojiTexture } from './visuals'
import { playClearSound, playFullSound, playGoalSound, playKnockSound, playPlaceSound, playPoofSound, playShakeSound } from './sounds'

export type EngineStatus = 'loading' | 'ready' | 'error'

export type TsumikiSnapshot = {
  count: number
  /** いちばん たかい ところ（つみき 1こ = 1）。うごいて いる つみきは かぞえない。 */
  height: number
  /** とどいた めあての かず。 */
  goals: number
  full: boolean
}

export const INITIAL_SNAPSHOT: TsumikiSnapshot = { count: 0, height: 0, goals: 0, full: false }

export type TsumikiSelection = { shape: BlockShapeId; color: ColorChoice; turns: number }

export type TsumikiCallbacks = {
  onSnapshot: (snapshot: TsumikiSnapshot) => void
  onGoal: (goal: HeightGoal, index: number) => void
  onFull: () => void
}

export type TsumikiControls = {
  undo: () => void
  clear: () => void
  shake: () => void
  /** カメラを まわす（ラジアン）。 */
  orbit: (yaw: number, pitch: number) => void
  zoom: (factor: number) => void
  /** キーボード用の カーソルを うごかす。カメラの むきに あわせて まえ・よこ を きめる。 */
  moveCursor: (right: number, forward: number) => void
  placeAtCursor: () => void
  hideCursor: () => void
}

const STEP = 1 / 60
const MAX_SUBSTEPS = 4
/** 1こ おいてから つぎを おけるまでの ま（れんだで いっきに ふえない ように）。 */
const PLACE_COOLDOWN_MS = 140
/** これいじょう うごいたら タップではなく カメラまわし。 */
const DRAG_THRESHOLD = 8
/** ゆびを これだけ とめて いたら「ねらう」モード。そのまま ずらすと みほんが ついてきて、はなすと おく。 */
const AIM_HOLD_MS = 250
const PITCH_MIN = 0.18
const PITCH_MAX = 1.35
const ZOOM_MIN = 0.55
const ZOOM_MAX = 1.8
const SHAKE_SECONDS = 0.9
const RULER_POSITION = new THREE.Vector3(MAT_RADIUS * 0.15, 0, -MAT_RADIUS - 0.5)
const RULER_HEIGHT = 14.5

type Block = {
  id: number
  shape: BlockShapeId
  body: RAPIER.RigidBody
  mesh: THREE.Mesh
  born: number
  lastSpeed: number
  lastKnock: number
  landed: boolean
  squash: number
}

type Fading = { mesh: THREE.Object3D; start: number; delay: number; scale: number }

type Placement = { x: number; y: number; z: number; shape: BlockShapeId; turns: number }

function easeOutBack(t: number) {
  const c = 1.9
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}

function createColliders(shape: BlockShapeId): RAPIER.ColliderDesc[] {
  const { size } = findShape(shape)
  const hx = size.x / 2
  const hy = size.y / 2
  const hz = size.z / 2
  switch (shape) {
    case 'cube':
    case 'plank':
      return [RAPIER.ColliderDesc.cuboid(hx, hy, hz)]
    case 'pillar':
      return [RAPIER.ColliderDesc.cylinder(hy, hx)]
    case 'cone':
      return [RAPIER.ColliderDesc.cone(hy, hx)]
    case 'roof': {
      const points = new Float32Array([-hx, -hy, -hz, hx, -hy, -hz, 0, hy, -hz, -hx, -hy, hz, hx, -hy, hz, 0, hy, hz])
      return [RAPIER.ColliderDesc.convexHull(points) ?? RAPIER.ColliderDesc.cuboid(hx, hy, hz)]
    }
    case 'arch': {
      const leg = (hx - 0.5) / 2
      return [
        RAPIER.ColliderDesc.cuboid(leg, hy, hz).setTranslation(-(0.5 + leg), 0, 0),
        RAPIER.ColliderDesc.cuboid(leg, hy, hz).setTranslation(0.5 + leg, 0, 0),
        RAPIER.ColliderDesc.cuboid(0.5, hy / 2, hz).setTranslation(0, hy / 2, 0),
      ]
    }
  }
}

/** おちる ばしょを さがす ための かたち。したむきに うごかすので、そこの かたち だけ あえば よい。 */
function castShapeOf(shape: BlockShapeId): RAPIER.Shape {
  const { size } = findShape(shape)
  if (shape === 'pillar' || shape === 'cone') return new RAPIER.Cylinder(size.y / 2, size.x / 2)
  return new RAPIER.Cuboid(size.x / 2 - 0.01, size.y / 2, size.z / 2 - 0.01)
}

function yawQuaternion(turns: number) {
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (turns % 4) * Math.PI / 2)
}

function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useTsumikiEngine(selectionRef: RefObject<TsumikiSelection>, callbacksRef: RefObject<TsumikiCallbacks>) {
  const [container, registerContainer] = useState<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<EngineStatus>('loading')
  const [attempt, setAttempt] = useState(0)
  const noop = () => {}
  const controlsRef = useRef<TsumikiControls>({
    undo: noop, clear: noop, shake: noop, orbit: noop, zoom: noop, moveCursor: noop, placeAtCursor: noop, hideCursor: noop,
  })

  useEffect(() => {
    if (!container) return
    let disposed = false
    let cleanup: (() => void) | undefined
    initializeRapier()
      .then(() => {
        if (disposed) return
        cleanup = startEngine(container, selectionRef, callbacksRef, controlsRef.current, () => { if (!disposed) setStatus('ready') }, () => { if (!disposed) setStatus('error') })
      })
      .catch(() => { if (!disposed) setStatus('error') })
    return () => {
      disposed = true
      cleanup?.()
    }
  }, [container, selectionRef, callbacksRef, attempt])

  return { registerContainer, status, controls: controlsRef, retry: () => { setStatus('loading'); setAttempt(value => value + 1) } }
}

function startEngine(
  container: HTMLDivElement,
  selectionRef: RefObject<TsumikiSelection>,
  callbacksRef: RefObject<TsumikiCallbacks>,
  controls: TsumikiControls,
  onReady: () => void,
  onError: () => void,
): () => void {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch {
    queueMicrotask(onError)
    return () => {}
  }
  const motion = !reducedMotion()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.92
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.setClearColor(0x000000, 0)
  const canvas = renderer.domElement
  canvas.style.touchAction = 'none'
  container.appendChild(canvas)

  // ---------- シーン ----------
  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04).texture
  room.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()
      ;(object.material as THREE.Material).dispose()
    }
  })
  scene.environment = environment
  scene.environmentIntensity = 0.32
  const visuals = createTsumikiVisuals()
  const roomGroup = visuals.createRoom()
  scene.add(roomGroup)
  const matGroup = roomGroup.children[1]

  const hemisphere = new THREE.HemisphereLight('#fff4e2', '#b98a5c', 0.55)
  const sun = new THREE.DirectionalLight('#ffeccf', 2.5)
  sun.position.set(7, 15, 9)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -11
  sun.shadow.camera.right = 11
  sun.shadow.camera.top = 13
  sun.shadow.camera.bottom = -11
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 50
  sun.shadow.bias = -0.0005
  sun.shadow.normalBias = 0.025
  const rim = new THREE.DirectionalLight('#cfe4ff', 0.7)
  rim.position.set(-8, 6, -10)
  scene.add(hemisphere, sun, sun.target, rim)

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200)

  // ---------- たかさの ものさし ----------
  const ruler = new THREE.Group()
  ruler.position.copy(RULER_POSITION)
  const poleGeometry = visuals.track(new THREE.CylinderGeometry(0.09, 0.11, RULER_HEIGHT, 16))
  const poleMaterial = visuals.track(new THREE.MeshStandardMaterial({ color: '#fbf3e3', roughness: 0.5 }))
  const pole = new THREE.Mesh(poleGeometry, poleMaterial)
  pole.position.y = RULER_HEIGHT / 2
  pole.castShadow = true
  ruler.add(pole)
  const tickGeometry = visuals.track(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 16))
  const tickMaterials = [
    visuals.track(new THREE.MeshStandardMaterial({ color: '#f4a261', roughness: 0.5 })),
    visuals.track(new THREE.MeshStandardMaterial({ color: '#7cc6c9', roughness: 0.5 })),
  ]
  for (let h = 1; h < RULER_HEIGHT; h++) {
    const tick = new THREE.Mesh(tickGeometry, tickMaterials[h % 2])
    tick.position.y = h
    ruler.add(tick)
  }
  const goalSprites = HEIGHT_GOALS.map(goal => {
    const texture = visuals.track(emojiTexture(goal.emoji))
    const material = visuals.track(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
    const sprite = new THREE.Sprite(material)
    sprite.position.set(0.6, goal.height, 0)
    sprite.scale.setScalar(0.85)
    ruler.add(sprite)
    return sprite
  })
  const markerGeometry = visuals.track(new THREE.ConeGeometry(0.2, 0.42, 20))
  const markerMaterial = visuals.track(new THREE.MeshStandardMaterial({ color: '#e2483d', roughness: 0.35, emissive: '#5a0c06', emissiveIntensity: 0.4 }))
  const marker = new THREE.Mesh(markerGeometry, markerMaterial)
  marker.rotation.z = Math.PI / 2
  marker.position.set(-0.36, 0, 0)
  marker.castShadow = true
  ruler.add(marker)
  scene.add(ruler)

  // ---------- おく まえの すけた つみき ----------
  const ghost = new THREE.Mesh(visuals.geometry('cube'), visuals.ghostMaterial)
  ghost.visible = false
  ghost.renderOrder = 2
  const arrowGeometry = visuals.track(new THREE.ConeGeometry(0.18, 0.36, 20))
  const arrowMaterial = visuals.track(new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.5, transparent: true, opacity: 0.9 }))
  const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial)
  arrow.rotation.x = Math.PI
  arrow.visible = false
  const targetRingGeometry = visuals.track(new THREE.RingGeometry(0.42, 0.55, 40))
  const targetRingMaterial = visuals.track(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }))
  const targetRing = new THREE.Mesh(targetRingGeometry, targetRingMaterial)
  targetRing.rotation.x = -Math.PI / 2
  targetRing.visible = false
  scene.add(ghost, arrow, targetRing)

  // ---------- えんしゅつ ----------
  const puffs = Array.from({ length: 28 }, () => {
    const material = visuals.track(new THREE.SpriteMaterial({ map: visuals.dotTexture, color: '#fff6e6', transparent: true, depthWrite: false, opacity: 0 }))
    const sprite = new THREE.Sprite(material)
    sprite.visible = false
    scene.add(sprite)
    return { sprite, material, life: 0, max: 1, velocity: new THREE.Vector3(), grow: 1 }
  })
  let puffCursor = 0
  function spawnPuff(position: THREE.Vector3, count: number, spread: number, color = '#fff6e6') {
    if (!motion) return
    for (let i = 0; i < count; i++) {
      const puff = puffs[puffCursor++ % puffs.length]
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
      puff.sprite.visible = true
      puff.sprite.position.copy(position)
      puff.velocity.set(Math.cos(angle) * spread, 0.35 + Math.random() * 0.4, Math.sin(angle) * spread)
      puff.life = 0
      puff.max = 0.45 + Math.random() * 0.25
      puff.grow = 0.35 + Math.random() * 0.25
      puff.material.color.set(color)
    }
  }

  const ringPool = Array.from({ length: 6 }, () => {
    const material = visuals.track(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }))
    const mesh = new THREE.Mesh(targetRingGeometry, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.visible = false
    scene.add(mesh)
    return { mesh, material, life: 1 }
  })
  let ringCursor = 0
  function spawnRing(position: THREE.Vector3, color: string) {
    const ring = ringPool[ringCursor++ % ringPool.length]
    ring.mesh.position.copy(position)
    ring.material.color.set(color)
    ring.life = 0
    ring.mesh.visible = true
  }

  const CONFETTI = 140
  const confettiGeometry = visuals.track(new THREE.PlaneGeometry(0.13, 0.22))
  const confettiMaterial = visuals.track(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }))
  const confetti = new THREE.InstancedMesh(confettiGeometry, confettiMaterial, CONFETTI)
  confetti.frustumCulled = false
  const confettiState = Array.from({ length: CONFETTI }, () => ({
    position: new THREE.Vector3(), velocity: new THREE.Vector3(), spin: new THREE.Vector3(), rotation: new THREE.Euler(), life: 1, max: 1,
  }))
  const confettiColors = ['#e2483d', '#f3922c', '#f5c535', '#43b36a', '#3a7fd8', '#8a5ccf', '#f07fae', '#ffffff']
  const tempColor = new THREE.Color()
  const tempMatrix = new THREE.Matrix4()
  const tempQuaternion = new THREE.Quaternion()
  const tempScale = new THREE.Vector3()
  confettiState.forEach((_, index) => {
    confetti.setColorAt(index, tempColor.set(confettiColors[index % confettiColors.length]))
    confetti.setMatrixAt(index, tempMatrix.makeScale(0, 0, 0))
  })
  scene.add(confetti)
  function burstConfetti(center: THREE.Vector3) {
    if (!motion) return
    confettiState.forEach(piece => {
      piece.position.copy(center)
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 3.5
      piece.velocity.set(Math.cos(angle) * speed, 4 + Math.random() * 4, Math.sin(angle) * speed)
      piece.spin.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5)
      piece.life = 0
      piece.max = 2 + Math.random() * 1.2
    })
  }

  // ---------- 物理 ----------
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = STEP
  world.numSolverIterations = 8
  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0, 0))
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0).setFriction(0.95), groundBody)
  const castShapes = new Map<BlockShapeId, RAPIER.Shape>()
  const blocks: Block[] = []
  const fading: Fading[] = []
  let nextId = 1
  let lastPlaced = 0
  let shakeTime = 0
  let cameraShake = 0

  function castShape(shape: BlockShapeId) {
    let value = castShapes.get(shape)
    if (!value) castShapes.set(shape, value = castShapeOf(shape))
    return value
  }

  // ---------- カメラ ----------
  const view = { yaw: 0.65, pitch: 0.6, zoom: 1, targetY: 1, height: 0, intro: motion ? 1 : 0 }
  const lookTarget = new THREE.Vector3()
  function updateCamera(dt: number) {
    view.intro = Math.max(0, view.intro - dt / 1.4)
    const introEase = view.intro ** 2
    const wantedY = THREE.MathUtils.clamp(view.height * 0.52, 0.8, 8)
    view.targetY += (wantedY - view.targetY) * Math.min(1, dt * 2)
    const aspectBoost = Math.max(1, 0.95 / Math.max(0.3, camera.aspect))
    const distance = (12 + view.height * 0.75) * view.zoom * aspectBoost * (1 + introEase * 0.8)
    const yaw = view.yaw + introEase * 1.2
    const pitch = view.pitch + introEase * 0.25
    lookTarget.set(0, view.targetY, 0)
    camera.position.set(
      Math.sin(yaw) * Math.cos(pitch) * distance,
      view.targetY + Math.sin(pitch) * distance,
      Math.cos(yaw) * Math.cos(pitch) * distance,
    )
    if (cameraShake > 0) {
      const amount = cameraShake * 0.12
      camera.position.x += (Math.random() - 0.5) * amount
      camera.position.y += (Math.random() - 0.5) * amount
    }
    camera.lookAt(lookTarget)
    sun.target.position.set(0, view.targetY * 0.4, 0)
    sun.position.set(7, 15 + view.targetY * 0.4, 9)
  }

  // ---------- おく ----------
  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hitPoint = new THREE.Vector3()
  const hitNormal = new THREE.Vector3()

  function landingFor(x: number, z: number, shape: BlockShapeId, turns: number): Placement {
    const snapped = snapPlacement(x, z, shape, turns)
    return landingAt(snapped.x, snapped.z, shape, turns)
  }

  /** こうしに そろえずに、その ばしょの まうえから おとす（つみきの うえに ぴったり のせる とき）。 */
  function landingAt(x: number, z: number, shape: BlockShapeId, turns: number): Placement {
    const snapped = { x, z }
    const q = yawQuaternion(turns)
    const start = 40
    const hit = world.castShape({ x: snapped.x, y: start, z: snapped.z }, { x: q.x, y: q.y, z: q.z, w: q.w }, { x: 0, y: -1, z: 0 }, castShape(shape), 0, start + 5, true)
    const y = hit ? start - hit.time_of_impact : findShape(shape).size.y / 2
    return { x: snapped.x, y, z: snapped.z, shape, turns }
  }

  function placementAtScreen(clientX: number, clientY: number): Placement | null {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointerNdc, camera)
    const selection = selectionRef.current
    const hits = raycaster.intersectObjects(blocks.map(block => block.mesh), false)
    const hit = hits[0]
    if (hit && hit.face) {
      hitNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld)
      const center = hit.object.position
      // よこの めんを さわっても、うえの めんの まんなか ちかくを さわっても、その つみきの まうえに のせる。
      // うえの めんの はしの ほうを さわった ときだけ、ずらして のせられる（はしを かける あそび）。
      const onTop = hitNormal.y > 0.55
      const nearCenter = Math.abs(hit.point.x - center.x) < 0.3 && Math.abs(hit.point.z - center.z) < 0.3
      if (!onTop || nearCenter) return landingAt(center.x, center.z, selection.shape, selection.turns)
      hitPoint.copy(hit.point)
    } else if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
      return null
    }
    if (Math.hypot(hitPoint.x, hitPoint.z) > MAT_RADIUS + 2.5) return null
    return landingFor(hitPoint.x, hitPoint.z, selection.shape, selection.turns)
  }

  let ghostShape: BlockShapeId | null = null
  let ghostPlacement: Placement | null = null
  function showGhost(placement: Placement | null) {
    ghostPlacement = placement
    const visible = !!placement && blocks.length < MAX_BLOCKS
    ghost.visible = arrow.visible = targetRing.visible = visible
    if (!placement || !visible) return
    if (ghostShape !== placement.shape) {
      ghost.geometry = visuals.geometry(placement.shape)
      ghostShape = placement.shape
    }
    const selection = selectionRef.current
    const color = findColor(resolveColor(placement.shape, selection.color)).hex
    visuals.ghostMaterial.color.set(color)
    visuals.ghostMaterial.emissive.set(color)
    ghost.position.set(placement.x, placement.y, placement.z)
    ghost.quaternion.copy(yawQuaternion(placement.turns))
    const size = findShape(placement.shape).size
    arrow.position.set(placement.x, placement.y + size.y / 2 + 0.55, placement.z)
    const bottom = placement.y - size.y / 2
    targetRing.position.set(placement.x, bottom + 0.012, placement.z)
    targetRing.scale.setScalar(Math.max(size.x, size.z) * 0.95)
  }

  function place(placement: Placement): boolean {
    const now = performance.now()
    if (now - lastPlaced < PLACE_COOLDOWN_MS) return false
    if (blocks.length >= MAX_BLOCKS) {
      playFullSound()
      callbacksRef.current.onFull()
      return false
    }
    lastPlaced = now
    const selection = selectionRef.current
    const shapeInfo = findShape(placement.shape)
    const colorId = resolveColor(placement.shape, selection.color)
    const q = yawQuaternion(placement.turns)
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(placement.x, placement.y + DROP_HEIGHT, placement.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinvel(0, -0.3, 0)
        .setLinearDamping(0.05)
        .setAngularDamping(0.6)
        .setCcdEnabled(true),
    )
    for (const desc of createColliders(placement.shape)) {
      world.createCollider(desc.setFriction(0.9).setRestitution(0).setDensity(0.6), body)
    }
    const mesh = new THREE.Mesh(visuals.geometry(placement.shape), visuals.material(colorId))
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.position.set(placement.x, placement.y + DROP_HEIGHT, placement.z)
    mesh.quaternion.copy(q)
    mesh.scale.setScalar(motion ? 0.4 : 1)
    scene.add(mesh)
    blocks.push({ id: nextId++, shape: placement.shape, body, mesh, born: now, lastSpeed: 0.6, lastKnock: 0, landed: false, squash: 0 })
    playPlaceSound(shapeInfo.pitch)
    spawnRing(new THREE.Vector3(placement.x, placement.y - shapeInfo.size.y / 2 + 0.015, placement.z), findColor(colorId).hex)
    snapshotDirty = true
    return true
  }

  function removeBlock(block: Block, delay = 0) {
    world.removeRigidBody(block.body)
    const index = blocks.indexOf(block)
    if (index >= 0) blocks.splice(index, 1)
    fading.push({ mesh: block.mesh, start: performance.now(), delay, scale: block.mesh.scale.x })
    snapshotDirty = true
  }

  // ---------- そうさ ----------
  const cursor = { x: 0, z: 0, active: false }
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  controls.undo = () => {
    const last = blocks[blocks.length - 1]
    if (!last) return
    spawnPuff(last.mesh.position, 8, 0.9)
    removeBlock(last)
    playPoofSound()
  }
  controls.clear = () => {
    if (!blocks.length) return
    playClearSound(blocks.length)
    const ordered = [...blocks].sort((a, b) => b.mesh.position.y - a.mesh.position.y)
    ordered.forEach((block, index) => {
      if (index % 3 === 0) spawnPuff(block.mesh.position, 3, 0.6)
      removeBlock(block, Math.min(0.7, index * 0.018))
    })
    sessionGoals = 0
  }
  controls.shake = () => {
    shakeTime = SHAKE_SECONDS
    cameraShake = motion ? 1 : 0
    blocks.forEach(block => block.body.wakeUp())
    playShakeSound()
  }
  controls.orbit = (yaw, pitch) => {
    view.yaw += yaw
    view.pitch = THREE.MathUtils.clamp(view.pitch + pitch, PITCH_MIN, PITCH_MAX)
  }
  controls.zoom = factor => {
    view.zoom = THREE.MathUtils.clamp(view.zoom * factor, ZOOM_MIN, ZOOM_MAX)
  }
  controls.moveCursor = (dx, dz) => {
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    right.crossVectors(forward, camera.up).normalize()
    // カメラから 見た むきに いちばん ちかい じくへ そろえる。
    const step = GRID * 2
    const move = right.clone().multiplyScalar(dx).addScaledVector(forward, dz)
    if (Math.abs(move.x) > Math.abs(move.z)) cursor.x += Math.sign(move.x) * step
    else if (move.z !== 0) cursor.z += Math.sign(move.z) * step
    const limit = MAT_RADIUS - 1
    const distance = Math.hypot(cursor.x, cursor.z)
    if (distance > limit) {
      cursor.x = Math.round(cursor.x * limit / distance)
      cursor.z = Math.round(cursor.z * limit / distance)
    }
    cursor.active = true
  }
  controls.placeAtCursor = () => {
    const selection = selectionRef.current
    cursor.active = true
    place(landingFor(cursor.x, cursor.z, selection.shape, selection.turns))
  }
  controls.hideCursor = () => { cursor.active = false }

  // ---------- ゆび・マウス ----------
  const pointers = new Map<number, { x: number; y: number; startX: number; startY: number; type: string; downAt: number; aiming: boolean }>()
  let dragging = false
  let tapPointer: number | null = null
  let pinchDistance = 0
  let hoverPoint: { x: number; y: number } | null = null

  function pinchSpan() {
    const [a, b] = [...pointers.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }
  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    canvas.setPointerCapture?.(event.pointerId)
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, type: event.pointerType, downAt: event.timeStamp, aiming: false })
    cursor.active = false
    if (pointers.size === 1) {
      tapPointer = event.pointerId
      dragging = false
      hoverPoint = { x: event.clientX, y: event.clientY }
    } else {
      tapPointer = null
      dragging = true
      hoverPoint = null
      pinchDistance = pinchSpan()
    }
  }
  function onPointerMove(event: PointerEvent) {
    const pointer = pointers.get(event.pointerId)
    if (!pointer) {
      if (event.pointerType === 'mouse') hoverPoint = { x: event.clientX, y: event.clientY }
      return
    }
    const dx = event.clientX - pointer.x
    const dy = event.clientY - pointer.y
    pointer.x = event.clientX
    pointer.y = event.clientY
    if (pointers.size >= 2) {
      const span = pinchSpan()
      if (pinchDistance > 0 && span > 0) controls.zoom(pinchDistance / span)
      pinchDistance = span
      controls.orbit(-dx * 0.004, dy * 0.003)
      return
    }
    // マウスは ホバーで みほんが でるので、ずらしたら いつも カメラまわし。
    // じかんは イベントの おきた とき で くらべる（おもい がめんで とどくのが おくれても まちがえない）。
    if (!pointer.aiming && pointer.type !== 'mouse' && tapPointer === event.pointerId && event.timeStamp - pointer.downAt >= AIM_HOLD_MS) {
      pointer.aiming = true
    }
    if (!dragging && !pointer.aiming && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > DRAG_THRESHOLD) {
      dragging = true
      tapPointer = null
      hoverPoint = null
    }
    if (dragging) controls.orbit(-dx * 0.008, dy * 0.006)
    else hoverPoint = { x: event.clientX, y: event.clientY }
  }
  function onPointerUp(event: PointerEvent) {
    const pointer = pointers.get(event.pointerId)
    if (!pointer) return
    pointers.delete(event.pointerId)
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (event.type === 'pointerup' && tapPointer === event.pointerId && !dragging && insideCanvas(event.clientX, event.clientY)) {
      const placement = placementAtScreen(event.clientX, event.clientY)
      if (placement) place(placement)
    }
    if (tapPointer === event.pointerId) tapPointer = null
    if (pointers.size === 0) {
      dragging = false
      hoverPoint = pointer.type === 'mouse' ? { x: event.clientX, y: event.clientY } : null
    }
    pinchDistance = pinchSpan()
  }
  /** ねらって いる ゆびを がめんの そとで はなしたら、おかずに やめる。 */
  function insideCanvas(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect()
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  }
  /** ゆびを とめて ねらって いる さいちゅう か（みほんを こく する）。 */
  function isAiming() {
    const pointer = tapPointer === null ? undefined : pointers.get(tapPointer)
    return !!pointer && !dragging && pointer.type !== 'mouse' && (pointer.aiming || performance.now() - pointer.downAt >= AIM_HOLD_MS)
  }
  function onPointerLeave(event: PointerEvent) {
    if (event.pointerType === 'mouse' && !pointers.size) hoverPoint = null
  }
  function onWheel(event: WheelEvent) {
    event.preventDefault()
    controls.zoom(Math.exp(event.deltaY * 0.0012))
  }
  const clearPointers = () => {
    pointers.clear()
    dragging = false
    tapPointer = null
    hoverPoint = null
  }
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('blur', clearPointers)

  // ---------- おおきさ ----------
  function resize() {
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    camera.aspect = width / height
    camera.fov = camera.aspect < 0.8 ? 46 : 40
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    canvas.style.width = '100%'
    canvas.style.height = '100%'
  }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
  observer?.observe(container)
  resize()

  let stopped = false
  const onContextLost = (event: Event) => {
    event.preventDefault()
    stopped = true
    onError()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  // ---------- まいフレーム ----------
  let frame = 0
  let previous = 0
  let accumulator = 0
  let elapsed = 0
  let snapshotDirty = true
  let heightTimer = 0
  let sessionGoals = 0
  let lastSnapshot = INITIAL_SNAPSHOT
  let readySent = false
  const box = new THREE.Box3()
  const groundOffset = new THREE.Vector3()

  function stepPhysics(now: number) {
    if (shakeTime > 0) {
      shakeTime = Math.max(0, shakeTime - STEP)
      const strength = Math.min(1, shakeTime / 0.25) * 0.14
      const t = (SHAKE_SECONDS - shakeTime) * Math.PI * 2
      groundOffset.set(Math.sin(t * 5.2) * strength, 0, Math.cos(t * 4.1) * strength * 0.8)
      groundBody.setNextKinematicTranslation({ x: groundOffset.x, y: 0, z: groundOffset.z })
    } else if (groundOffset.lengthSq() > 0) {
      // ゆれが おわったら 1かいだけ もとに もどす。うごかさない あいだは つみきが ねむれる（でんちを まもる）。
      groundOffset.set(0, 0, 0)
      groundBody.setNextKinematicTranslation({ x: 0, y: 0, z: 0 })
    }
    world.step()
    let knocks = 0
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i]
      const position = block.body.translation()
      if (position.y < -4 || Math.abs(position.x) > 36 || Math.abs(position.z) > 36) {
        removeBlock(block)
        continue
      }
      const velocity = block.body.linvel()
      const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
      const change = block.lastSpeed - speed
      block.lastSpeed = speed
      if (change > 0.7 && now - block.lastKnock > 90 && knocks < 3) {
        knocks++
        block.lastKnock = now
        const strength = Math.min(1, change / 4)
        playKnockSound(findShape(block.shape).pitch, strength)
        if (!block.landed || change > 2.2) {
          const bottom = new THREE.Vector3(position.x, position.y - findShape(block.shape).size.y / 2 + 0.05, position.z)
          spawnPuff(bottom, block.landed ? 5 : 7, 0.7 + strength)
          block.squash = motion ? 0.1 + strength * 0.1 : 0
        }
        block.landed = true
      }
    }
  }

  function measureHeight(now: number) {
    let height = 0
    let top: Block | null = null
    for (const block of blocks) {
      if (now - block.born < 450 || block.lastSpeed > 0.25) continue
      box.setFromObject(block.mesh)
      if (box.max.y > height) {
        height = box.max.y
        top = block
      }
    }
    view.height = height
    const reached = goalsReached(height)
    // すこし くずれて また つんだら、もういちど おいわい できる（ぎりぎりで ゆれても なんども ならない）。
    sessionGoals = Math.min(sessionGoals, goalsReached(height + 1))
    if (reached > sessionGoals) {
      sessionGoals = reached
      const goal = HEIGHT_GOALS[reached - 1]
      callbacksRef.current.onGoal(goal, reached - 1)
      playGoalSound(reached)
      if (top) burstConfetti(new THREE.Vector3(top.mesh.position.x, height + 0.3, top.mesh.position.z))
    }
    const snapshot: TsumikiSnapshot = { count: blocks.length, height: Math.round(height * 10) / 10, goals: reached, full: blocks.length >= MAX_BLOCKS }
    if (snapshotDirty || snapshot.height !== lastSnapshot.height || snapshot.goals !== lastSnapshot.goals || snapshot.count !== lastSnapshot.count) {
      snapshotDirty = false
      lastSnapshot = snapshot
      callbacksRef.current.onSnapshot(snapshot)
    }
  }

  function animate(now: number, dt: number) {
    elapsed += dt
    // つみきを 物理に あわせる + でてくる ときの ぽよん
    for (const block of blocks) {
      const position = block.body.translation()
      const rotation = block.body.rotation()
      block.mesh.position.set(position.x, position.y, position.z)
      block.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      const age = (now - block.born) / 220
      const pop = age >= 1 || !motion ? 1 : Math.max(0.4, easeOutBack(Math.min(1, age)))
      block.squash = Math.max(0, block.squash - dt * 0.9)
      const squash = Math.sin(Math.min(1, block.squash * 8) * Math.PI) * block.squash
      block.mesh.scale.set(pop * (1 + squash * 0.5), pop * (1 - squash), pop * (1 + squash * 0.5))
    }
    for (let i = fading.length - 1; i >= 0; i--) {
      const item = fading[i]
      const t = (now - item.start) / 1000 - item.delay
      if (t < 0) continue
      const k = Math.min(1, t / 0.22)
      item.mesh.scale.setScalar(item.scale * (1 - k) * (1 + Math.sin(k * Math.PI) * 0.25))
      if (k >= 1) {
        scene.remove(item.mesh)
        fading.splice(i, 1)
      }
    }
    matGroup.position.set(groundOffset.x, matGroup.position.y, groundOffset.z)
    cameraShake = Math.max(0, cameraShake - dt * 1.4)

    // おく まえの みほん
    if (cursor.active) {
      const selection = selectionRef.current
      showGhost(landingFor(cursor.x, cursor.z, selection.shape, selection.turns))
    } else if (hoverPoint && !dragging) {
      showGhost(placementAtScreen(hoverPoint.x, hoverPoint.y))
    } else {
      showGhost(null)
    }
    if (ghost.visible && ghostPlacement) {
      const aiming = isAiming()
      const pulse = aiming ? 0.72 + Math.sin(elapsed * 9) * 0.06 : 0.5 + Math.sin(elapsed * 5) * 0.12
      visuals.ghostMaterial.opacity = pulse
      arrow.position.y += Math.abs(Math.sin(elapsed * (aiming ? 8 : 4))) * 0.18
      targetRingMaterial.opacity = 0.45 + Math.sin(elapsed * 5) * 0.2
    }

    // えんしゅつ
    for (const puff of puffs) {
      if (!puff.sprite.visible) continue
      puff.life += dt
      const k = puff.life / puff.max
      if (k >= 1) { puff.sprite.visible = false; continue }
      puff.sprite.position.addScaledVector(puff.velocity, dt)
      puff.velocity.multiplyScalar(1 - dt * 3)
      puff.sprite.scale.setScalar(0.25 + k * puff.grow * 2)
      puff.material.opacity = (1 - k) * 0.75
    }
    for (const ring of ringPool) {
      if (!ring.mesh.visible) continue
      ring.life += dt / 0.45
      if (ring.life >= 1) { ring.mesh.visible = false; continue }
      ring.mesh.scale.setScalar(1 + ring.life * 1.8)
      ring.material.opacity = (1 - ring.life) * 0.8
    }
    let confettiAlive = false
    confettiState.forEach((piece, index) => {
      if (piece.life >= piece.max) return
      confettiAlive = true
      piece.life += dt
      piece.velocity.y -= 7 * dt
      piece.velocity.multiplyScalar(1 - dt * 1.2)
      piece.position.addScaledVector(piece.velocity, dt)
      piece.rotation.x += piece.spin.x * dt
      piece.rotation.y += piece.spin.y * dt
      piece.rotation.z += piece.spin.z * dt
      const alive = piece.life < piece.max && piece.position.y > -0.2
      if (!alive) piece.life = piece.max
      tempQuaternion.setFromEuler(piece.rotation)
      tempScale.setScalar(alive ? 1 : 0)
      confetti.setMatrixAt(index, tempMatrix.compose(piece.position, tempQuaternion, tempScale))
    })
    if (confettiAlive) confetti.instanceMatrix.needsUpdate = true

    // ものさし
    const shownGoals = goalsReached(view.height)
    goalSprites.forEach((sprite, index) => {
      const material = sprite.material
      const done = index < shownGoals
      material.opacity = done ? 1 : index === shownGoals ? 0.85 : 0.45
      material.color.set(done ? '#ffffff' : '#c9c2b8')
      const bob = index === shownGoals && motion ? 1 + Math.sin(elapsed * 4) * 0.08 : 1
      sprite.scale.setScalar((done ? 1 : 0.8) * bob)
    })
    marker.position.y += (Math.max(0.2, view.height) - marker.position.y) * Math.min(1, dt * 6)
    // ものさしは いつも カメラの ほうを むく
    ruler.rotation.y = Math.atan2(camera.position.x - ruler.position.x, camera.position.z - ruler.position.z) - Math.PI / 2
  }

  function tick(now: number) {
    if (stopped) return
    frame = requestAnimationFrame(tick)
    if (document.hidden) { previous = 0; return }
    const dt = previous ? Math.min(0.1, (now - previous) / 1000) : STEP
    previous = now
    accumulator += dt
    let steps = 0
    while (accumulator >= STEP && steps < MAX_SUBSTEPS) {
      stepPhysics(now)
      accumulator -= STEP
      steps++
    }
    if (steps === MAX_SUBSTEPS) accumulator = 0
    heightTimer += dt
    if (heightTimer > 0.1 || snapshotDirty) {
      heightTimer = 0
      measureHeight(now)
    }
    animate(now, dt)
    updateCamera(dt)
    renderer.render(scene, camera)
    if (!readySent) {
      readySent = true
      onReady()
    }
  }
  frame = requestAnimationFrame(tick)

  return () => {
    stopped = true
    cancelAnimationFrame(frame)
    observer?.disconnect()
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerUp)
    canvas.removeEventListener('pointerleave', onPointerLeave)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('webglcontextlost', onContextLost)
    window.removeEventListener('blur', clearPointers)
    const noop = () => {}
    Object.assign(controls, { undo: noop, clear: noop, shake: noop, orbit: noop, zoom: noop, moveCursor: noop, placeAtCursor: noop, hideCursor: noop })
    world.free()
    castShapes.clear()
    visuals.dispose()
    environment.dispose()
    pmrem.dispose()
    hemisphere.dispose()
    sun.dispose()
    rim.dispose()
    confetti.dispose()
    scene.clear()
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }
}
