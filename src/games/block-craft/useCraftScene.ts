import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { observeGameActivity } from '../../utils/gameActivity'
import { nextCell, type Animal, type AnimalKind, type Cell, type Herd } from './animals'
import { blockPixels, TEXTURE_SIZE } from './textures'
import { HEIGHT, MATERIAL_DEFS, SIZE, surfaceOf, topBlock, type Material, type Position, type WoolColor, type World } from './world'

type Pick = (position: Position, normal: Position) => void
export type Heading = { x: number; z: number }
export type SceneApi = {
  /** あるく ときに むいている ほうこう（まえ・うしろ・ひだり・みぎの どれか）。 */
  heading: () => Heading
  turn: (side: 'left' | 'right') => void
  /** がめんの まんなかの ブロックを おく・こわす（pick）か えらぶ（hold）。 */
  actAtCenter: (kind: 'pick' | 'hold') => void
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
const CENTER = (SIZE - 1) / 2
/** あしもとの ブロックの まんなかから めまでの たかさ。 */
const EYE = 1.1
/** あるく ときに てが とどく きょり。 */
const REACH = 7
/** ながおしで ブロックを えらぶまでの じかん [ms]。 */
export const HOLD_MS = 450
const DRAG_PX = 7

/** Keeps the two-finger panned view over the world: moves camera and target together so the angle never changes. */
export function clampTarget(target: THREE.Vector3, camera: THREE.Vector3) {
  const clamped = new THREE.Vector3(
    THREE.MathUtils.clamp(target.x, -1, SIZE),
    THREE.MathUtils.clamp(target.y, 0, HEIGHT - 2),
    THREE.MathUtils.clamp(target.z, -1, SIZE),
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
  data: Animal; group: THREE.Group; body: THREE.Mesh; heart: THREE.Group
  from: Cell; to: Cell; t: number; wait: number; hop: number
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
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 160)
    camera.rotation.order = 'YXZ'
    camera.position.set(CENTER + 16, 22, CENTER + 18)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(CENTER, 2, CENTER)
    // ひとさしゆび1ぽんで まわす・2ほんで いどうと ちかづく（地面にそって うごく）
    controls.enablePan = true
    controls.screenSpacePanning = false
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
    controls.minDistance = 6
    controls.maxDistance = 48
    controls.minPolarAngle = 0.2
    controls.maxPolarAngle = Math.PI / 2.15
    controls.update()
    const hemisphere = new THREE.HemisphereLight('#ffffff', '#74705a', DAY.hemisphere)
    scene.add(hemisphere)
    const sun = new THREE.DirectionalLight(DAY.sunColor, DAY.sun)
    sun.position.set(6, 18, 12)
    scene.add(sun)

    const geometry = new THREE.BoxGeometry(0.97, 0.97, 0.97)
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
    const waterTexture = textures[MATERIAL_DEFS.findIndex(m => m.id === 'water')]
    const lavaTexture = textures[MATERIAL_DEFS.findIndex(m => m.id === 'lava')]
    const materials = MATERIAL_DEFS.map((m, i) => new THREE.MeshLambertMaterial({
      map: textures[i],
      transparent: m.opacity !== undefined,
      opacity: m.opacity ?? 1,
      depthWrite: m.opacity === undefined,
      emissive: m.glow ? m.color : '#000000',
      emissiveIntensity: m.glow ? DAY.glow : 0,
    }))
    const meshes = materials.map((material, index) => {
      const mesh = new THREE.InstancedMesh(geometry, material, SIZE * SIZE * HEIGHT)
      if (MATERIAL_DEFS[index].opacity !== undefined) mesh.renderOrder = 1
      mesh.count = 0
      scene.add(mesh)
      return mesh
    })
    const positions: Position[][] = materials.map(() => [])
    const outlineBox = new THREE.BoxGeometry(1.04, 1.04, 1.04)
    const outlineGeometry = new THREE.EdgesGeometry(outlineBox)
    outlineBox.dispose()
    const outlineMaterial = new THREE.LineBasicMaterial({ color: '#ffef56', depthTest: false })
    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial)
    outline.renderOrder = 2
    scene.add(outline)

    // どうぶつ
    const unit = new THREE.BoxGeometry(1, 1, 1)
    const animalMaterials = Object.fromEntries(Object.entries(ANIMAL_COLORS).map(([name, color]) => [name, new THREE.MeshLambertMaterial({ color })])) as Record<AnimalColor, THREE.MeshLambertMaterial>
    let surface = surfaceOf(latest.current.world)
    const groundTop = (cell: Cell) => (surface(cell.x, cell.z)?.y ?? 0) + 0.5
    const animals = new Map<number, AnimalState>()
    let animalGroups: THREE.Group[] = []
    const box = (color: AnimalColor, size: readonly [number, number, number], position: readonly [number, number, number]) => {
      const part = new THREE.Mesh(unit, animalMaterials[color])
      part.scale.set(...size)
      part.position.set(...position)
      return part
    }
    const createAnimal = (data: Animal): AnimalState => {
      const group = new THREE.Group()
      group.userData.animalId = data.id
      const parts = ANIMAL_PARTS[data.kind].map(([color, size, position]) => box(color, size, position))
      group.add(...parts)
      const heart = new THREE.Group()
      for (const [size, position, rotation] of HEART_PARTS) heart.add(box('heart', size, position).rotateZ(rotation))
      heart.position.y = 1.15
      group.add(heart)
      const cell = { x: data.x, z: data.z }
      group.position.set(cell.x, groundTop(cell), cell.z)
      scene.add(group)
      return { data, group, body: parts[0], heart, from: cell, to: cell, t: 1, wait: Math.random() * 2, hop: 0 }
    }
    /** ひつじの けの いろ・けを とった すがた・あかちゃんの おおきさ・なかよしの ハート。 */
    const dress = ({ data, body, group, heart }: AnimalState) => {
      if (data.kind === 'sheep') {
        body.material = animalMaterials[data.sheared ? 'skin' : WOOL_PART[data.wool ?? 'white']]
        if (data.sheared) body.scale.set(0.5, 0.38, 0.76)
        else body.scale.set(0.7, 0.5, 0.9)
      }
      group.scale.setScalar(data.baby ? 0.55 : 1)
      heart.visible = !!data.love
    }
    let shownHerd: Herd | null = null
    const syncHerd = (herd: Herd) => {
      if (herd === shownHerd) return
      shownHerd = herd
      const ids = new Set(herd.map(a => a.id))
      for (const [id, animal] of animals) {
        if (ids.has(id)) continue
        scene.remove(animal.group)
        animals.delete(id)
      }
      for (const data of herd) {
        const animal = animals.get(data.id) ?? createAnimal(data)
        animal.data = data
        animals.set(data.id, animal)
        dress(animal)
      }
      animalGroups = [...animals.values()].map(a => a.group)
    }
    syncHerd(latest.current.herd ?? [])

    // あるく モード
    let walking: Position | null = null
    let yaw = 0
    let yawTarget = 0
    let pitch = -0.15
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
          pitch = -0.15
          controls.enabled = false
          camera.fov = 70
          camera.position.set(next.x, next.y + EYE, next.z)
        } else {
          camera.position.copy(orbitPosition)
          controls.target.copy(orbitTarget)
          controls.enabled = true
          camera.fov = 40
          controls.update()
        }
        camera.updateProjectionMatrix()
        outline.visible = !next
      }
      walking = next
    }

    const render = () => renderer.render(scene, camera)
    const matrix = new THREE.Matrix4()
    let shownWorld: World | null = null
    const rebuild = (blocks: World) => {
      positions.forEach(list => { list.length = 0 })
      for (const block of blocks) {
        const index = MATERIAL_DEFS.findIndex(m => m.id === block.material)
        const list = positions[index]
        const { plant, height = 0.6 } = MATERIAL_DEFS[index]
        // くさばなは じめんに たつ ように、したを そろえて ちいさく する
        if (plant) matrix.makeScale(0.45, height, 0.45).setPosition(block.x, block.y - 0.485 * (1 - height), block.z)
        else matrix.makeTranslation(block.x, block.y, block.z)
        meshes[index].setMatrixAt(list.length, matrix)
        list.push(block)
      }
      meshes.forEach((mesh, i) => {
        mesh.count = positions[i].length
        mesh.instanceMatrix.needsUpdate = true
        mesh.computeBoundingSphere()
      })
      surface = surfaceOf(blocks)
      shownWorld = blocks
    }
    let frame = 0
    const update = () => {
      const { world, cursor, night = false, walker = null, herd = [], sky: daySky = DAY.sky } = latest.current
      const theme = night ? NIGHT : DAY
      sky.set(night ? NIGHT.sky : daySky)
      syncHerd(herd)
      hemisphere.intensity = theme.hemisphere
      sun.intensity = theme.sun
      sun.color.set(theme.sunColor)
      materials.forEach((material, i) => { if (MATERIAL_DEFS[i].glow) material.emissiveIntensity = theme.glow })
      if (world !== shownWorld) rebuild(world)
      const top = topBlock(world, cursor.x, cursor.z)
      outline.position.set(top.x, top.y, top.z)
      setWalking(walker)
      if (!frame) aimCamera(1)
      render()
    }

    const tick = (dt: number, time: number) => {
      for (const animal of animals.values()) {
        if (animal.heart.visible) {
          animal.heart.rotation.y = time / 450
          animal.heart.position.y = 1.15 + Math.sin(time / 260) * 0.08
        }
        if (animal.t < 1) animal.t = Math.min(1, animal.t + dt / 0.55)
        else if ((animal.wait -= dt) <= 0) {
          animal.from = animal.to
          const next = nextCell(surface, animal.from, Math.random)
          if (next !== animal.from) animal.group.rotation.y = Math.atan2(next.x - animal.from.x, next.z - animal.from.z)
          animal.to = next
          animal.t = next === animal.from ? 1 : 0
          animal.wait = 0.6 + Math.random() * 2.2
        }
        animal.hop = Math.max(0, animal.hop - dt * 2)
        const s = ease(animal.t)
        const bounce = Math.sin(Math.PI * animal.t) * 0.18 + Math.sin(Math.PI * animal.hop) * 0.7
        animal.group.position.set(
          animal.from.x + (animal.to.x - animal.from.x) * s,
          groundTop(animal.from) + (groundTop(animal.to) - groundTop(animal.from)) * s + bounce,
          animal.from.z + (animal.to.z - animal.from.z) * s,
        )
      }
      waterTexture.offset.y = (time / 5000) % 1
      lavaTexture.offset.x = (time / 9000) % 1
      if (latest.current.night) {
        const pulse = NIGHT.glow * (0.8 + 0.2 * Math.sin(time / 380))
        materials.forEach((material, i) => { if (MATERIAL_DEFS[i].glow) material.emissiveIntensity = pulse })
      }
      aimCamera(1 - Math.exp(-dt * 12))
    }
    let last = 0
    const loop = (time: number) => {
      const dt = last ? Math.min(0.05, (time - last) / 1000) : 0
      last = time
      tick(dt, time)
      render()
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
      clampTarget(controls.target, camera.position)
      render()
    }
    controls.addEventListener('change', changed)

    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    type Hit = { animal: AnimalState } | { position: Position; normal: Position }
    const hitAt = (x: number, y: number): Hit | null => {
      ndc.set(x, y)
      raycaster.setFromCamera(ndc, camera)
      raycaster.far = walking ? REACH : Infinity
      const hit = raycaster.intersectObjects([...meshes, ...animalGroups], true)[0]
      if (!hit) return null
      let owner: THREE.Object3D | null = hit.object
      while (owner && owner.userData.animalId === undefined) owner = owner.parent
      const animal = owner && animals.get(owner.userData.animalId as number)
      if (animal) return { animal }
      const index = meshes.findIndex(mesh => mesh === hit.object)
      if (index < 0 || hit.instanceId === undefined || !hit.face) return null
      const normal = { x: Math.round(hit.face.normal.x), y: Math.round(hit.face.normal.y), z: Math.round(hit.face.normal.z) }
      return { position: positions[index][hit.instanceId], normal }
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
        if (!frame) render()
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
      Object.values(animalMaterials).forEach(material => material.dispose())
      meshes.forEach(mesh => mesh.dispose())
      outlineGeometry.dispose()
      outlineMaterial.dispose()
      renderer.dispose()
      canvas.remove()
    }
  }, [container])
  return { setContainer, failed, api }
}
