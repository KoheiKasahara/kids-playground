import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { observeGameActivity } from '../../utils/gameActivity'
import { chooseAnimalStep, MAX_HERD, type Animal, type AnimalKind, type Cell, type Herd } from './animals'
import { BLOCK_WIDTH, hitBlock } from './raycast'
import { createTerrainMeshes, viewDepth, WALK_DRAW_DISTANCE } from './terrainMeshes'
import { blockPixels, TEXTURE_SIZE } from './textures'
import { materialCode, MATERIAL_DEFS, topBlock, type Dimensions, type Material, type Position, type WoolColor, type World } from './world'

type Pick = (position: Position, normal: Position) => void
export type Heading = { x: number; z: number }
export type SceneApi = {
  /** あるく ときに むいている ほうこう（まえ・うしろ・ひだり・みぎの どれか）。 */
  heading: () => Heading
  turn: (side: 'left' | 'right') => void
  /** がめんの まんなかの ブロックを おく・こわす（pick）か えらぶ（hold）。 */
  actAtCenter: (kind: 'pick' | 'hold') => void
  /** そらから ながめる カメラを、その ばしょの うえへ はこぶ（むきと きょりは そのまま）。 */
  focus: (x: number, z: number) => void
}
export type CraftSceneOptions = {
  world: World
  cursor: Position
  night?: boolean
  /** あるく モードの あしもと。null なら そらから ながめる。 */
  walker?: Position | null
  /** せかいに いる どうぶつ。 */
  herd?: Herd
  /** ひるの そらの いろ（ちけいごとに かわる）。 */
  sky?: string
  onPick: Pick
  onHold?: (position: Position) => void
  /** どうぶつを タッチした。cell は いま いる ばしょ。 */
  onAnimal?: (animal: Animal, cell: Cell) => void
}

const DAY = { sky: '#c6eafa', hemisphere: 2.4, sun: 2.5, sunColor: '#fff5db', glow: 0.35 }
const NIGHT = { sky: '#1a2246', hemisphere: 0.75, sun: 0.4, sunColor: '#9fb4ff', glow: 1 }
/** あしもとの ブロックの まんなかから めまでの たかさ。 */
const EYE = 1.1
/** あるく ときに てが とどく きょり。 */
const REACH = 7
/** ながおしで ブロックを えらぶまでの じかん [ms]。 */
export const HOLD_MS = 450
const DRAG_PX = 7

/** Keeps the two-finger panned view over the world: moves camera and target together so the angle never changes. */
export function clampTarget(target: THREE.Vector3, camera: THREE.Vector3, { size, height }: Dimensions) {
  const clamped = new THREE.Vector3(
    THREE.MathUtils.clamp(target.x, -1, size),
    THREE.MathUtils.clamp(target.y, 0, height - 2),
    THREE.MathUtils.clamp(target.z, -1, size),
  )
  const shift = clamped.clone().sub(target)
  if (shift.lengthSq() === 0) return false
  target.add(shift)
  camera.add(shift)
  return true
}

/** むいている かくどを、いちばん ちかい まえ・うしろ・ひだり・みぎ に そろえる。 */
export function headingFromYaw(yaw: number): Heading {
  const x = -Math.sin(yaw)
  const z = -Math.cos(yaw)
  return Math.abs(x) > Math.abs(z) ? { x: Math.sign(x), z: 0 } : { x: 0, z: Math.sign(z) || -1 }
}

const ANIMAL_COLORS = {
  wool: '#f4f1ea', face: '#4a4038', leg: '#5b4a3e', comb: '#e2463c', beak: '#f2b632', fur: '#c9a27e',
  pink: '#f5a8c8', yellow: '#f3d75e', blue: '#8fcdf2', skin: '#efcdb9', heart: '#ff4f7b',
} as const
type AnimalColor = keyof typeof ANIMAL_COLORS
const WOOL_PART: Record<WoolColor, AnimalColor> = { white: 'wool', pink: 'pink', yellow: 'yellow', blue: 'blue' }
/** なかよしの しるしの ハート（はこ 3つ）。 */
const HEART_PARTS: readonly (readonly [readonly [number, number, number], readonly [number, number, number], number])[] = [
  [[0.16, 0.16, 0.08], [-0.08, 0.06, 0], 0], [[0.16, 0.16, 0.08], [0.08, 0.06, 0], 0], [[0.18, 0.18, 0.08], [0, -0.04, 0], Math.PI / 4],
]
type Part = readonly [AnimalColor, readonly [number, number, number], readonly [number, number, number]]
/** はこを くみあわせた どうぶつ（まえが +z）。 */
const ANIMAL_PARTS: Record<AnimalKind, readonly Part[]> = {
  sheep: [
    ['wool', [0.7, 0.5, 0.9], [0, 0.55, 0]], ['face', [0.36, 0.36, 0.36], [0, 0.75, 0.5]],
    ['leg', [0.14, 0.3, 0.14], [0.22, 0.15, 0.3]], ['leg', [0.14, 0.3, 0.14], [-0.22, 0.15, 0.3]],
    ['leg', [0.14, 0.3, 0.14], [0.22, 0.15, -0.3]], ['leg', [0.14, 0.3, 0.14], [-0.22, 0.15, -0.3]],
  ],
  chicken: [
    ['wool', [0.36, 0.36, 0.44], [0, 0.35, 0]], ['wool', [0.24, 0.28, 0.24], [0, 0.62, 0.2]],
    ['comb', [0.06, 0.1, 0.14], [0, 0.8, 0.2]], ['beak', [0.1, 0.08, 0.1], [0, 0.6, 0.36]],
    ['beak', [0.05, 0.18, 0.05], [0.08, 0.09, 0]], ['beak', [0.05, 0.18, 0.05], [-0.08, 0.09, 0]],
  ],
  rabbit: [
    ['fur', [0.4, 0.36, 0.56], [0, 0.28, 0]], ['fur', [0.3, 0.3, 0.3], [0, 0.48, 0.3]],
    ['fur', [0.08, 0.3, 0.06], [0.08, 0.75, 0.28]], ['fur', [0.08, 0.3, 0.06], [-0.08, 0.75, 0.28]],
    ['wool', [0.14, 0.14, 0.1], [0, 0.34, -0.3]],
  ],
}
type AnimalState = {
  data: Animal; from: Cell; to: Cell; t: number; wait: number; hop: number
  fromY: number; toY: number; x: number; y: number; z: number; yaw: number; visible: boolean
  heartTime?: number
}
const ease = (t: number) => t * t * (3 - 2 * t)

/**
 * Renders on demand while the page is hidden; a RAF loop (animals, water, walking camera) runs
 * only while the game is active and stops on hidden page, blur, context loss or unmount.
 */
export function useCraftScene(options: CraftSceneOptions) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [failed, setFailed] = useState(false)
  const api = useRef<SceneApi | null>(null)
  const sync = useRef<(() => void) | null>(null)
  const latest = useRef(options)
  useEffect(() => { latest.current = options; sync.current?.() })

  useEffect(() => {
    if (!container) return
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true }) } catch {
      let cancelled = false
      queueMicrotask(() => { if (!cancelled) setFailed(true) })
      return () => { cancelled = true }
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const sky = new THREE.Color(DAY.sky)
    scene.background = sky
    const dimensions = latest.current.world
    const center = (dimensions.size - 1) / 2
    // はじめは カーソルの まわりを ちかくで ながめる。ひろい せかいは ひいて みわたせる。
    const start = latest.current.cursor
    const startY = Math.max(2, dimensions.topY(start.x, start.z, true))
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, Math.max(160, dimensions.size * 4))
    camera.rotation.order = 'YXZ'
    camera.position.set(start.x + 16, startY + 20, start.z + 18)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(start.x, startY, start.z)
    // ひとさしゆび1ぽんで まわす・2ほんで いどうと ちかづく（地面にそって うごく）
    controls.enablePan = true
    controls.screenSpacePanning = false
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
    controls.minDistance = 6
    controls.maxDistance = Math.max(48, dimensions.size * 1.3)
    controls.minPolarAngle = 0.2
    controls.maxPolarAngle = Math.PI / 2.15
    controls.update()
    const hemisphere = new THREE.HemisphereLight('#ffffff', '#74705a', DAY.hemisphere)
    scene.add(hemisphere)
    const sun = new THREE.DirectionalLight(DAY.sunColor, DAY.sun)
    sun.position.set(6, 18, 12)
    scene.add(sun)

    const geometry = new THREE.BoxGeometry(BLOCK_WIDTH, BLOCK_WIDTH, BLOCK_WIDTH)
    const textures = MATERIAL_DEFS.map(m => {
      const texture = new THREE.DataTexture(blockPixels(m.id as Material), TEXTURE_SIZE, TEXTURE_SIZE)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.magFilter = THREE.NearestFilter
      texture.minFilter = THREE.NearestFilter
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.needsUpdate = true
      return texture
    })
    const waterTexture = textures[materialCode('water') - 1]
    const lavaTexture = textures[materialCode('lava') - 1]
    const materials = MATERIAL_DEFS.map((m, i) => new THREE.MeshLambertMaterial({
      map: textures[i],
      transparent: m.opacity !== undefined,
      opacity: m.opacity ?? 1,
      depthWrite: m.opacity === undefined,
      emissive: m.glow ? m.color : '#000000',
      emissiveIntensity: m.glow ? DAY.glow : 0,
    }))
    const glowing = materials.filter((_, i) => MATERIAL_DEFS[i].glow)
    const terrain = createTerrainMeshes(scene, geometry, materials)
    const fog = new THREE.Fog(sky, WALK_DRAW_DISTANCE * 0.55, WALK_DRAW_DISTANCE)
    const outlineBox = new THREE.BoxGeometry(1.04, 1.04, 1.04)
    const outlineGeometry = new THREE.EdgesGeometry(outlineBox)
    outlineBox.dispose()
    const outlineMaterial = new THREE.LineBasicMaterial({ color: '#ffef56', depthTest: false })
    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial)
    outline.renderOrder = 2
    scene.add(outline)

    // どうぶつ
    const unit = new THREE.BoxGeometry(1, 1, 1)
    const animalMaterial = new THREE.MeshLambertMaterial()
    const animalColors = Object.fromEntries(Object.entries(ANIMAL_COLORS).map(([name, color]) => [name, new THREE.Color(color)])) as Record<AnimalColor, THREE.Color>
    const animalMesh = new THREE.InstancedMesh(unit, animalMaterial, MAX_HERD * 9)
    animalMesh.count = 0
    animalMesh.frustumCulled = false // Individual animals are culled before filling the batch.
    animalMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    animalMesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(center, dimensions.height / 2, center), Math.hypot(dimensions.size, dimensions.height) + 3)
    scene.add(animalMesh)
    const animalOwners: AnimalState[] = []
    const animals = new Map<number, AnimalState>()
    const groundTop = (cell: Cell) => Math.max(0, latest.current.world.topY(cell.x, cell.z, true)) + 0.5
    const stepOptions = new Int8Array(4)
    const updateHeight = (animal: AnimalState) => {
      animal.fromY = groundTop(animal.from)
      animal.toY = groundTop(animal.to)
    }
    let animalWorld: World | undefined
    let unwatchGround: (() => void) | undefined
    const watchGround = (world: World) => {
      if (world === animalWorld) return
      animalWorld = world
      unwatchGround?.()
      for (const animal of animals.values()) updateHeight(animal)
      unwatchGround = world.subscribe(changes => {
        for (const animal of animals.values()) {
          if (changes.some(({ x, z }) => (x === animal.from.x && z === animal.from.z) || (x === animal.to.x && z === animal.to.z))) updateHeight(animal)
        }
      })
    }
    const createAnimal = (data: Animal): AnimalState => {
      const from = { x: data.x, z: data.z }
      const y = groundTop(from)
      return { data, from, to: { ...from }, t: 1, wait: Math.random() * 2, hop: 0,
        fromY: y, toY: y, x: from.x, y, z: from.z, yaw: 0, visible: false }
    }
    const noAnimals: Herd = []
    let shownHerd: Herd | undefined
    const syncHerd = (herd: Herd) => {
      if (herd === shownHerd) return false
      shownHerd = herd
      const ids = new Set(herd.map(a => a.id))
      for (const id of animals.keys()) if (!ids.has(id)) animals.delete(id)
      for (const data of herd) {
        const animal = animals.get(data.id) ?? createAnimal(data)
        animal.data = data
        animals.set(data.id, animal)
      }
      return true
    }

    const root = new THREE.Object3D()
    const heart = new THREE.Object3D()
    const part = new THREE.Object3D()
    const pose = new THREE.Matrix4()
    const sphere = new THREE.Sphere(new THREE.Vector3(), 2)
    const projection = new THREE.Matrix4()
    const frustum = new THREE.Frustum()
    const putPart = (animal: AnimalState, parent: THREE.Matrix4, color: AnimalColor) => {
      const index = animalMesh.count++
      part.updateMatrix()
      animalMesh.setMatrixAt(index, pose.multiplyMatrices(parent, part.matrix))
      animalMesh.setColorAt(index, animalColors[color])
      animalOwners[index] = animal
    }
    const placeAnimal = (animal: AnimalState) => {
      const s = ease(animal.t)
      const bounce = Math.sin(Math.PI * animal.t) * 0.18 + Math.sin(Math.PI * animal.hop) * 0.7
      animal.x = animal.from.x + (animal.to.x - animal.from.x) * s
      animal.y = animal.fromY + (animal.toY - animal.fromY) * s + bounce
      animal.z = animal.from.z + (animal.to.z - animal.from.z) * s
    }
    const setAnimalPose = (animal: AnimalState) => {
      root.position.set(animal.x, animal.y, animal.z)
      root.rotation.y = animal.yaw
      root.scale.setScalar(animal.data.baby ? 0.55 : 1)
      root.updateMatrix()
    }
    const putHeart = (animal: AnimalState) => {
      const time = animal.heartTime ?? 0
      heart.rotation.y = time / 450
      heart.position.y = 1.15 + Math.sin(time / 260) * 0.08
      heart.updateMatrix()
      heart.matrix.premultiply(root.matrix)
      for (const [size, position, rotation] of HEART_PARTS) {
        part.scale.set(...size)
        part.position.set(...position)
        part.rotation.z = rotation
        putPart(animal, heart.matrix, 'heart')
      }
    }
    const batchAnimals = (time: number, walking: boolean) => {
      animalMesh.count = 0
      for (const animal of animals.values()) {
        placeAnimal(animal)
        sphere.center.set(animal.x, animal.y + 0.6, animal.z)
        animal.visible = (!walking || viewDepth(camera, sphere.center.x, sphere.center.y, sphere.center.z) - sphere.radius <= WALK_DRAW_DISTANCE)
          && frustum.intersectsSphere(sphere)
        if (!animal.visible) continue
        const { data } = animal
        setAnimalPose(animal)
        const parts = ANIMAL_PARTS[data.kind]
        part.rotation.z = 0
        for (let i = 0; i < parts.length; i++) {
          const [color, size, position] = parts[i]
          part.scale.set(...size)
          part.position.set(...position)
          if (i === 0 && data.kind === 'sheep') {
            if (data.sheared) part.scale.set(0.5, 0.38, 0.76)
            putPart(animal, root.matrix, data.sheared ? 'skin' : WOOL_PART[data.wool ?? 'white'])
          } else putPart(animal, root.matrix, color)
        }
        if (data.love) {
          animal.heartTime = time
          putHeart(animal)
        }
      }
      animalOwners.length = animalMesh.count
      if (animalMesh.count) {
        animalMesh.instanceMatrix.needsUpdate = true
        animalMesh.instanceColor!.needsUpdate = true
      }
    }

    // あるく モード
    let walking: Position | null = null
    let yaw = 0
    let yawTarget = 0
    let pitch = -0.1
    const orbitPosition = new THREE.Vector3()
    const orbitTarget = new THREE.Vector3()
    const eye = new THREE.Vector3()
    const aimCamera = (blend: number) => {
      if (!walking) return
      eye.set(walking.x, walking.y + EYE, walking.z)
      camera.position.lerp(eye, blend)
      yaw += (yawTarget - yaw) * blend
      camera.rotation.set(pitch, yaw, 0)
    }
    const setWalking = (next: Position | null) => {
      if (!next !== !walking) {
        if (next) {
          orbitPosition.copy(camera.position)
          orbitTarget.copy(controls.target)
          const look = controls.target.clone().sub(camera.position)
          yaw = yawTarget = Math.atan2(-look.x, -look.z)
          pitch = -0.1
          controls.enabled = false
          camera.fov = 70
          camera.position.set(next.x, next.y + EYE, next.z)
        } else {
          // あるいて きた ばしょを、まえと おなじ むき・きょりで ながめる
          eye.set(walking!.x - orbitTarget.x, walking!.y - orbitTarget.y, walking!.z - orbitTarget.z)
          camera.position.copy(orbitPosition).add(eye)
          controls.target.copy(orbitTarget).add(eye)
          controls.enabled = true
          camera.fov = 40
          controls.update()
        }
        camera.updateProjectionMatrix()
        outline.visible = !next
      }
      walking = next
    }

    let animatedTerrain = false
    let lastDraw = 0
    let time = 0
    let isNight = false
    const render = () => {
      camera.updateMatrixWorld()
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      frustum.setFromProjectionMatrix(projection)
      scene.fog = walking ? fog : null
      fog.color.copy(sky)
      animatedTerrain = terrain.setVisibility(camera, frustum, !!walking, isNight)
      batchAnimals(time, !!walking)
      waterTexture.offset.y = (time / 5000) % 1
      lavaTexture.offset.x = (time / 9000) % 1
      const pulse = isNight ? NIGHT.glow * (0.8 + 0.2 * Math.sin(time / 380)) : DAY.glow
      for (const material of glowing) material.emissiveIntensity = pulse
      renderer.render(scene, camera)
      lastDraw = time
    }

    let frame = 0
    const update = () => {
      const { world, cursor, night = false, walker = null, herd = noAnimals, sky: daySky = DAY.sky } = latest.current
      const theme = night ? NIGHT : DAY
      const skyColor = night ? NIGHT.sky : daySky
      const nightChanged = night !== isNight || shownSky !== skyColor
      isNight = night
      shownSky = skyColor
      sky.set(skyColor)
      watchGround(world)
      const herdChanged = syncHerd(herd)
      hemisphere.intensity = theme.hemisphere
      sun.intensity = theme.sun
      sun.color.set(theme.sunColor)
      const terrainChanged = terrain.update(world)
      const top = topBlock(world, cursor.x, cursor.z)
      const cursorChanged = !walker && (outline.position.x !== top.x || outline.position.y !== top.y || outline.position.z !== top.z)
      outline.position.set(top.x, top.y, top.z)
      const walkChanged = walker !== walking
      setWalking(walker)
      if (!frame) aimCamera(1)
      if (terrainChanged || herdChanged || nightChanged || walkChanged || cursorChanged) render()
    }
    let shownSky: string | undefined

    const tick = (dt: number) => {
      let moving = false
      for (const animal of animals.values()) {
        if (!animal.visible) continue
        if (animal.t < 1) {
          animal.t = Math.min(1, animal.t + dt / 0.55)
          moving = true
        } else if ((animal.wait -= dt) <= 0) {
          const { from, to } = animal
          from.x = to.x
          from.z = to.z
          if (chooseAnimalStep(latest.current.world, from, to, stepOptions, Math.random)) {
            animal.yaw = Math.atan2(to.x - from.x, to.z - from.z)
            animal.t = 0
            updateHeight(animal)
            moving = true
          }
          animal.wait = 0.6 + Math.random() * 2.2
        }
        if (animal.hop > 0) {
          animal.hop = Math.max(0, animal.hop - dt * 2)
          moving = true
        }
        if (animal.data.love) moving = true
      }
      if (walking) {
        eye.set(walking.x, walking.y + EYE, walking.z)
        if (camera.position.distanceToSquared(eye) > 1e-6 || Math.abs(yawTarget - yaw) > 1e-4) {
          aimCamera(1 - Math.exp(-dt * 12))
          moving = true
        }
      }
      return moving
    }
    let last = 0
    const loop = (now: number) => {
      time = now
      const dt = last ? Math.min(0.05, (time - last) / 1000) : 0
      last = time
      if (tick(dt) || (animatedTerrain && time - lastDraw >= 80)) render()
      frame = requestAnimationFrame(loop)
    }
    let lost = false
    const stop = () => { cancelAnimationFrame(frame); frame = 0 }
    const stopActivity = observeGameActivity(active => {
      if (active && !lost && !frame) { last = 0; frame = requestAnimationFrame(loop) }
      else if (!active) stop()
    })

    const resize = () => {
      const width = container.clientWidth || 320
      const height = container.clientHeight || 360
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      render()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    const changed = () => {
      clampTarget(controls.target, camera.position, latest.current.world)
      render()
    }
    controls.addEventListener('change', changed)

    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    type Hit = { animal: AnimalState } | { position: Position; normal: Position }
    const animalHits: THREE.Intersection[] = []
    const hitAt = (x: number, y: number): Hit | null => {
      ndc.set(x, y)
      camera.updateMatrixWorld()
      raycaster.setFromCamera(ndc, camera)
      raycaster.far = walking ? REACH : Infinity
      const { origin, direction } = raycaster.ray
      const block = hitBlock(latest.current.world, origin, direction, raycaster.far)
      animalHits.length = 0
      const drawn = animalMesh.count
      try {
        // Three's old group raycast also tested hidden hearts. Add those parts only for picking.
        for (const animal of animals.values()) {
          if (!animal.visible || animal.data.love) continue
          setAnimalPose(animal)
          putHeart(animal)
        }
        raycaster.intersectObject(animalMesh, false, animalHits)
      } finally { animalMesh.count = drawn }
      const hit = animalHits[0]
      if (hit?.instanceId !== undefined && (!block || hit.distance < block.distance)) {
        return { animal: animalOwners[hit.instanceId] }
      }
      return block
    }
    const hitAtClient = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect()
      return hitAt((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1)
    }
    const act = (hit: Hit | null, kind: 'pick' | 'hold') => {
      if (!hit) return
      if ('animal' in hit) {
        if (kind === 'hold') return
        hit.animal.hop = 1
        latest.current.onAnimal?.(hit.animal.data, hit.animal.to)
        if (!frame) render()
        return
      }
      if (kind === 'hold') latest.current.onHold?.(hit.position)
      else latest.current.onPick(hit.position, hit.normal)
    }

    let down: { x: number; y: number; lastX: number; lastY: number; id: number } | null = null
    let dragged = false
    let held = false
    let holdTimer: ReturnType<typeof setTimeout> | undefined
    const clearHold = () => { clearTimeout(holdTimer); holdTimer = undefined }
    const pointerDown = (event: PointerEvent) => {
      if (down || !event.isPrimary || event.button !== 0) { dragged = true; clearHold(); return }
      down = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, id: event.pointerId }
      dragged = false
      held = false
      clearHold()
      // ながおしで その ブロックを えらぶ（スポイト）
      holdTimer = setTimeout(() => {
        holdTimer = undefined
        if (!down || dragged) return
        const hit = hitAtClient(down.x, down.y)
        if (!hit || 'animal' in hit) return
        held = true
        act(hit, 'hold')
      }, HOLD_MS)
    }
    const pointerMove = (event: PointerEvent) => {
      if (!down || down.id !== event.pointerId) return
      if (walking) {
        yaw -= (event.clientX - down.lastX) * 0.008
        yawTarget = yaw
        pitch = THREE.MathUtils.clamp(pitch - (event.clientY - down.lastY) * 0.008, -1.2, 1)
        camera.rotation.set(pitch, yaw, 0)
        render()
      }
      down.lastX = event.clientX
      down.lastY = event.clientY
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > DRAG_PX) { dragged = true; clearHold() }
    }
    const cancel = () => { down = null; clearHold() }
    const pointerUp = (event: PointerEvent) => {
      if (!down || down.id !== event.pointerId) return
      clearHold()
      const skip = dragged || held
      down = null
      if (skip) return
      act(hitAtClient(event.clientX, event.clientY), 'pick')
    }
    const canvas = renderer.domElement
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointermove', pointerMove)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('pointercancel', cancel)
    canvas.addEventListener('lostpointercapture', cancel)
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; stop(); setFailed(true) }
    canvas.addEventListener('webglcontextlost', contextLost)

    api.current = {
      heading: () => headingFromYaw(yawTarget),
      turn: side => {
        yawTarget += side === 'left' ? Math.PI / 2 : -Math.PI / 2
        if (!frame) { aimCamera(1); render() }
      },
      actAtCenter: kind => act(hitAt(0, 0), kind),
      focus: (x, z) => {
        if (walking) return
        const world = latest.current.world
        eye.set(x, Math.max(0, world.topY(x, z, true)), z).sub(controls.target)
        controls.target.add(eye)
        camera.position.add(eye)
        clampTarget(controls.target, camera.position, world)
        controls.update()
        render()
      },
    }
    sync.current = update
    resize()
    update()
    return () => {
      api.current = null
      sync.current = null
      stop()
      stopActivity()
      clearHold()
      observer.disconnect()
      controls.removeEventListener('change', changed)
      controls.dispose()
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', cancel)
      canvas.removeEventListener('lostpointercapture', cancel)
      canvas.removeEventListener('webglcontextlost', contextLost)
      geometry.dispose()
      unit.dispose()
      textures.forEach(texture => texture.dispose())
      materials.forEach(material => material.dispose())
      animalMesh.dispose()
      animalMaterial.dispose()
      terrain.dispose()
      unwatchGround?.()
      outlineGeometry.dispose()
      outlineMaterial.dispose()
      renderer.dispose()
      canvas.remove()
    }
  }, [container])
  return { setContainer, failed, api }
}
