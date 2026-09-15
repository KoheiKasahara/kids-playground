/**
 * パターゴルフの見た目（Three.js）。
 * 物理の結果（ボールの位置・ふうしゃの角度・できごと）を受け取って描くだけで、進行も物理も持たない。
 * コースの床・壁・カップは golfGeometry が作った物理と同じ三角形をそのまま使う。
 * くり返す景色は形ごとの InstancedMesh にまとめ、景色が増えても描画回数が増えないようにしている。
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { CAMERA_FOV, type CameraPose } from './golfCamera'
import { GOLF_BALLS, type CourseDefinition, type CritterLook, type GolfBallId, type HoleDefinition, type Vec2 } from './golfCourses'
import { insideOutline, type HoleGeometry, type MeshBuffers } from './golfGeometry'
import { BALL_RADIUS, BOOSTER, BUMPER_HEIGHT, CRITTER, GATE, PLATFORM_DEPTH, WARP, WINDMILL, type Vec3 } from './golfPhysics'
import type { GadgetMotion } from './golfWorld'

export type EffectKind = 'splash' | 'dust' | 'confetti' | 'fireworks' | 'sparkle' | 'ring'
export type AimView = { ball: Vec3; direction: Vec2; power: number; path: readonly Vec3[] }
type Quat = { x: number; y: number; z: number; w: number }
type Shape = 'box' | 'sphere' | 'cone' | 'pyramid' | 'cylinder' | 'rock' | 'torus'

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
const SEA_Y = -0.62

function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  root.traverse(child => {
    const mesh = child as Partial<THREE.Mesh>
    if (mesh.geometry) geometries.add(mesh.geometry)
    for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
      materials.add(material)
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value)
    }
    if (child instanceof THREE.InstancedMesh) child.dispose()
  })
  geometries.forEach(item => item.dispose())
  materials.forEach(item => item.dispose())
  textures.forEach(item => item.dispose())
}

function bufferGeometry(buffers: MeshBuffers): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(buffers.normals, 3))
  geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1))
  return geometry
}

/** 同じ形の飾りを色ちがいでまとめて1回で描く。 */
function createBatch() {
  const items = new Map<Shape, { matrices: THREE.Matrix4[]; colors: THREE.Color[] }>()
  const dummy = new THREE.Object3D()
  return {
    add(shape: Shape, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) {
      const item = items.get(shape) ?? { matrices: [], colors: [] }
      dummy.position.set(x, y, z)
      dummy.rotation.set(rx, ry, rz)
      dummy.scale.set(sx, sy, sz)
      dummy.updateMatrix()
      item.matrices.push(dummy.matrix.clone())
      item.colors.push(new THREE.Color(color))
      items.set(shape, item)
    },
    build(parent: THREE.Object3D, shadows: boolean) {
      const shapes: Record<Shape, () => THREE.BufferGeometry> = {
        box: () => new THREE.BoxGeometry(1, 1, 1),
        sphere: () => new THREE.IcosahedronGeometry(0.5, 1),
        cone: () => new THREE.ConeGeometry(0.5, 1, 8),
        pyramid: () => new THREE.ConeGeometry(0.5, 1, 4),
        cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
        rock: () => new THREE.DodecahedronGeometry(0.5, 0),
        torus: () => new THREE.TorusGeometry(0.5, 0.12, 6, 20),
      }
      const material = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true })
      for (const [shape, item] of items) {
        const mesh = new THREE.InstancedMesh(shapes[shape](), material, item.matrices.length)
        item.matrices.forEach((matrix, index) => { mesh.setMatrixAt(index, matrix); mesh.setColorAt(index, item.colors[index]!) })
        mesh.castShadow = shadows
        mesh.receiveShadow = true
        mesh.computeBoundingSphere()
        parent.add(mesh)
      }
    },
  }
}

function skyDome(top: string, horizon: string): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(170, 32, 16)
  const colors: number[] = []
  const a = new THREE.Color(horizon)
  const b = new THREE.Color(top)
  const color = new THREE.Color()
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const t = Math.pow(Math.min(1, Math.max(0, position.getY(i) / 170)), 0.55)
    color.copy(a).lerp(b, t)
    colors.push(color.r, color.g, color.b)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }))
  sky.renderOrder = -1
  return sky
}

function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) paint(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? radius * 0.45 : radius
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r)
  }
  ctx.closePath()
  ctx.fill()
}

/** ボールのもよう。ころがると顔と星が回るので、転がっているのが幼児にもわかる。 */
function paintBall(ctx: CanvasRenderingContext2D, id: GolfBallId) {
  const style = GOLF_BALLS.find(ball => ball.id === id) ?? GOLF_BALLS[0]
  ctx.fillStyle = style.color
  ctx.fillRect(0, 0, 256, 128)
  ctx.fillStyle = style.accent
  ctx.fillRect(0, 76, 256, 7)
  ctx.fillStyle = '#3b2a2a'
  for (const x of [56, 76]) { ctx.beginPath(); ctx.ellipse(x, 48, 4.5, 6.5, 0, 0, Math.PI * 2); ctx.fill() }
  ctx.strokeStyle = '#3b2a2a'
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(66, 54, 11, 0.2 * Math.PI, 0.8 * Math.PI)
  ctx.stroke()
  ctx.fillStyle = '#ff9a9a'
  for (const x of [46, 86]) { ctx.beginPath(); ctx.arc(x, 60, 4, 0, Math.PI * 2); ctx.fill() }
  ctx.fillStyle = style.accent
  star(ctx, 194, 50, 15)
}

function ballTexture(id: GolfBallId) {
  return canvasTexture(256, 128, ctx => paintBall(ctx, id))
}

/** 歩く どうぶつ。コースに合わせて見た目だけ変える（歩き方は同じ）。 */
function critterModel(look: CritterLook, accent: string): THREE.Group {
  const group = new THREE.Group()
  const skin = { duck: '#ffd94a', crab: '#ff6f5b', penguin: '#3c4560', alien: '#8ee6a8' }[look]
  const r = CRITTER.radius
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 }))
  body.scale.set(1, 0.92, 1.12)
  body.position.y = r * 0.95
  const head = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 14, 10), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 }))
  head.position.set(0, CRITTER.height * 0.82, r * 0.3)
  group.add(body, head)
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.09, 8, 6), new THREE.MeshStandardMaterial({ color: '#2f2a33' }))
    eye.position.set(side * r * 0.24, CRITTER.height * 0.9, r * 0.72)
    group.add(eye)
  }
  if (look === 'duck' || look === 'penguin') {
    const beak = new THREE.Mesh(new THREE.ConeGeometry(r * 0.17, r * 0.4, 10), new THREE.MeshStandardMaterial({ color: '#ff9a3d', roughness: 0.5 }))
    beak.rotation.x = Math.PI / 2
    beak.position.set(0, CRITTER.height * 0.8, r * 0.82)
    group.add(beak)
  }
  if (look === 'penguin') {
    const belly = new THREE.Mesh(new THREE.SphereGeometry(r * 0.72, 14, 10), new THREE.MeshStandardMaterial({ color: '#fdfdff', roughness: 0.7 }))
    belly.scale.set(0.9, 1, 0.6)
    belly.position.set(0, r * 0.95, r * 0.6)
    group.add(belly)
  }
  if (look === 'crab') {
    for (const side of [-1, 1]) {
      const claw = new THREE.Mesh(new THREE.SphereGeometry(r * 0.34, 10, 8), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }))
      claw.position.set(side * r * 1.05, r * 0.7, r * 0.5)
      group.add(claw)
    }
  }
  if (look === 'alien') {
    for (const side of [-1, 1]) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, r * 0.5, 6), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 }))
      stalk.position.set(side * r * 0.24, CRITTER.height * 1.05, r * 0.2)
      const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 8, 6), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.4, roughness: 0.3 }))
      tip.position.set(side * r * 0.24, CRITTER.height * 1.25, r * 0.2)
      group.add(stalk, tip)
    }
  }
  return group
}

export function createGolfScene(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.setAttribute('aria-hidden', 'true')
  renderer.domElement.style.touchAction = 'none'
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04)
  scene.environment = environment.texture
  room.dispose()
  pmrem.dispose()
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.05, 400)
  const hemisphere = new THREE.HemisphereLight('#ffffff', '#88aa66', 1)
  const sun = new THREE.DirectionalLight('#fff3dc', 2.3)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.normalBias = 0.03
  sun.shadow.bias = -0.0004
  scene.add(hemisphere, sun, sun.target)

  // ボール・ねらいの矢印・点線・クラブは、ホールが変わっても作り直さない。
  let ballStyle: GolfBallId = 'white'
  const ballMaterial = new THREE.MeshStandardMaterial({ map: ballTexture(ballStyle), roughness: 0.32, metalness: 0.02 })
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 28, 20), ballMaterial)
  ball.castShadow = true
  scene.add(ball)

  const arrowShape = new THREE.Shape()
  arrowShape.moveTo(-0.12, 0)
  arrowShape.lineTo(0.12, 0)
  arrowShape.lineTo(0.12, 0.62)
  arrowShape.lineTo(0.3, 0.62)
  arrowShape.lineTo(0, 1)
  arrowShape.lineTo(-0.3, 0.62)
  arrowShape.lineTo(-0.12, 0.62)
  arrowShape.closePath()
  const arrowGeometry = new THREE.ShapeGeometry(arrowShape)
  // 形は +y 向きに作ったので、床に寝かせて +z 向きにする。
  arrowGeometry.rotateX(Math.PI / 2)
  const arrowMaterial = new THREE.MeshBasicMaterial({ color: '#ffd84d', transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false })
  const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial)
  arrow.renderOrder = 3
  arrow.visible = false
  scene.add(arrow)
  const DOTS = 36
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.042, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false }), DOTS)
  dots.frustumCulled = false
  dots.renderOrder = 3
  dots.count = 0
  scene.add(dots)
  const hintRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 36), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.95, depthWrite: false }))
  hintRing.rotation.x = -Math.PI / 2
  hintRing.visible = false
  scene.add(hintRing)
  // パター。うしろから見てボールや矢印をかくさないよう、柄は横へたおしておく。
  const club = new THREE.Group()
  const clubMaterial = new THREE.MeshStandardMaterial({ color: '#dfe6ee', roughness: 0.25, metalness: 0.7 })
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.1), clubMaterial)
  head.position.y = 0.05
  head.castShadow = true
  const handle = new THREE.Group()
  handle.position.set(-0.13, 0.08, -0.02)
  handle.rotation.set(-0.15, 0, 0.62)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.9, 8), clubMaterial)
  shaft.position.y = 0.45
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.26, 8), new THREE.MeshStandardMaterial({ color: '#e85d4f', roughness: 0.6 }))
  grip.position.y = 0.9
  handle.add(shaft, grip)
  club.add(head, handle)
  club.visible = false
  scene.add(club)

  type Particle = { life: number; span: number; position: THREE.Vector3; velocity: THREE.Vector3; gravity: number; size: number; color: THREE.Color; spin: number }
  const BITS = 90
  const PUFFS = 60
  const bits = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.07, 0.016), new THREE.MeshStandardMaterial({ roughness: 0.5, emissive: '#3a2a10', emissiveIntensity: 0.25 }), BITS)
  const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, transparent: true, opacity: 0.85, depthWrite: false }), PUFFS)
  for (const mesh of [bits, puffs]) { mesh.frustumCulled = false; mesh.count = 0; scene.add(mesh) }
  const bitList: Particle[] = []
  const puffList: Particle[] = []
  const rings = Array.from({ length: 6 }, () => {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 36), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }))
    mesh.rotation.x = -Math.PI / 2
    mesh.visible = false
    scene.add(mesh)
    return { mesh, life: 0, span: 1, size: 1 }
  })
  let ringCursor = 0

  type HoleContent = {
    root: THREE.Group
    heightAt: (x: number, z: number) => number | null
    cupY: number
    flag: THREE.Group
    flagBase: number
    cloth: THREE.Mesh
    blades: THREE.Group[]
    gates: THREE.Object3D[]
    critters: THREE.Object3D[]
    snow: { points: THREE.Points; base: number; height: number } | null
    bumpers: Map<string, THREE.Group>
    boosters: THREE.Texture[]
    water: { uniforms: { uTime: { value: number } } } | null
    spinners: THREE.Object3D[]
    floaters: { object: THREE.Object3D; base: number; phase: number }[]
  }
  let hole: HoleContent | null = null
  let flagLift = 0
  let flagLifted = false
  let clubPull = 0
  let swing = -1
  let clubDirection: Vec2 = { x: 0, z: -1 }
  let hintTarget: Vec2 | null = null
  let clock = 0
  const pulses = new Map<string, number>()
  const dummy = new THREE.Object3D()
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0)

  function buildHole(course: CourseDefinition, definition: HoleDefinition, geometry: HoleGeometry, number: number): HoleContent {
    const root = new THREE.Group()
    const { look } = course
    const solid = createBatch()
    const soft = createBatch()
    const { bounds, outlines } = geometry
    const cx = (bounds.minX + bounds.maxX) / 2
    const cz = (bounds.minZ + bounds.maxZ) / 2
    const clear = (x: number, z: number, margin: number) => !outlines.some(outline => insideOutline(x, z, outline.points))
      && outlines.every(outline => outline.points.every(point => (point.x - x) ** 2 + (point.z - z) ** 2 > margin * margin))

    // 床。芝をかった帯のもよう、すなば、ジャンプ台のしまを頂点の色で付ける。
    const felt = new THREE.Color(look.felt)
    const feltLight = felt.clone().offsetHSL(0, -0.02, 0.045)
    const kickers = (definition.features ?? []).filter(feature => feature.kind === 'kicker')
    const floorColors = new Float32Array(geometry.floor.positions.length)
    const color = new THREE.Color()
    for (let i = 0; i < geometry.floor.positions.length / 3; i++) {
      const x = geometry.floor.positions[i * 3]!
      const z = geometry.floor.positions[i * 3 + 2]!
      color.copy(Math.floor((z + 100) / 0.9) % 2 ? felt : feltLight)
      for (const kicker of kickers) {
        const dx = kicker.to.x - kicker.from.x
        const dz = kicker.to.z - kicker.from.z
        const length = Math.hypot(dx, dz)
        const along = ((x - kicker.from.x) * dx + (z - kicker.from.z) * dz) / length
        const side = Math.abs((x - kicker.from.x) * dz - (z - kicker.from.z) * dx) / length
        if (along > 0.02 && along <= length + 1e-6 && side < kicker.halfWidth) color.set(Math.floor(along / 0.26) % 2 ? '#ffb13b' : '#fff3cf')
      }
      // 高い所は明るく、低い所は暗く。こぶやクレーターの形が色でもわかる。
      color.offsetHSL(0, 0, THREE.MathUtils.clamp(geometry.floor.positions[i * 3 + 1]! * 0.2, -0.09, 0.09))
      floorColors.set([color.r, color.g, color.b], i * 3)
    }
    const floorGeometry = bufferGeometry(geometry.floor)
    floorGeometry.setAttribute('color', new THREE.BufferAttribute(floorColors, 3))
    const floor = new THREE.Mesh(floorGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }))
    floor.receiveShadow = true
    root.add(floor)
    // ゆかの ちがう ところ（すなば・こおり・ふかふか）は、床の色ではなく
    // ふちのくっきりした円い面で重ねる（マス目のぼやけを出さない）。
    for (const zone of definition.zones ?? []) {
      const zoneColor = new THREE.Color(zone.kind === 'sand' ? look.sand : zone.kind === 'ice' ? look.ice : look.rough)
      const disc = new THREE.CircleGeometry(zone.radius, 48, 0, Math.PI * 2)
      disc.rotateX(-Math.PI / 2)
      const position = disc.getAttribute('position')
      for (let i = 0; i < position.count; i++) {
        const x = zone.x + position.getX(i)
        const z = zone.z + position.getZ(i)
        position.setXYZ(i, x, (geometry.heightAt(x, z) ?? 0) + 0.006, z)
      }
      disc.computeVertexNormals()
      // こおりは つるつるに光らせ、ふかふかは ざらざらにする。見ただけで すべりそうか わかる。
      const zoneMesh = new THREE.Mesh(disc, new THREE.MeshStandardMaterial({
        color: zoneColor,
        roughness: zone.kind === 'ice' ? 0.06 : 1,
        metalness: zone.kind === 'ice' ? 0.2 : 0,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      }))
      zoneMesh.receiveShadow = true
      const rim = new THREE.Mesh(new THREE.RingGeometry(zone.radius - 0.07, zone.radius, 48), new THREE.MeshStandardMaterial({ color: zoneColor.clone().offsetHSL(0, 0, zone.kind === 'ice' ? 0.08 : -0.12), roughness: zone.kind === 'ice' ? 0.2 : 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
      rim.rotation.x = -Math.PI / 2
      rim.position.set(zone.x, (geometry.heightAt(zone.x, zone.z) ?? 0) + 0.008, zone.z)
      root.add(zoneMesh, rim)
      // ふかふかには 草の つぶを 置いて、ころがりにくそうに見せる。
      if (zone.kind === 'rough') {
        for (let i = 0; i < 16; i++) {
          const angle = hash(i + 17) * Math.PI * 2
          const distance = Math.sqrt(hash(i + 29)) * (zone.radius - 0.12)
          const x = zone.x + Math.cos(angle) * distance
          const z = zone.z + Math.sin(angle) * distance
          soft.add('cone', zoneColor.clone().offsetHSL(0, 0.04, 0.06).getStyle(), x, (geometry.heightAt(x, z) ?? 0) + 0.06, z, 0.13, 0.16, 0.13)
        }
      }
    }
    const part = (buffers: MeshBuffers, material: THREE.Material) => {
      const mesh = new THREE.Mesh(bufferGeometry(buffers), material)
      mesh.castShadow = mesh.receiveShadow = true
      root.add(mesh)
      return mesh
    }
    part(geometry.wallBody, new THREE.MeshStandardMaterial({ color: look.wall, roughness: 0.72 }))
    part(geometry.wallCap, new THREE.MeshStandardMaterial({ color: look.wallCap, roughness: 0.6 }))
    part(geometry.skirt, new THREE.MeshStandardMaterial({ color: look.skirt, roughness: 0.85 }))
    const cupInside = part(geometry.cupWall, new THREE.MeshStandardMaterial({ color: '#34403a', roughness: 0.9, side: THREE.DoubleSide }))
    cupInside.castShadow = false
    const { cup } = geometry
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(cup.radius, 40), new THREE.MeshStandardMaterial({ color: '#27302b', roughness: 1 }))
    bottom.rotation.x = -Math.PI / 2
    bottom.position.set(cup.x, cup.y - cup.depth + 0.002, cup.z)
    const rim = new THREE.Mesh(new THREE.RingGeometry(cup.radius, cup.radius + 0.04, 48), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }))
    rim.rotation.x = -Math.PI / 2
    rim.position.set(cup.x, cup.y + 0.004, cup.z)
    root.add(bottom, rim)

    // カップの旗。ボールが近づくと抜けて持ち上がる（ボールと重ならないように）。
    const flag = new THREE.Group()
    const flagBase = cup.y - cup.depth
    flag.position.set(cup.x, flagBase, cup.z)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 8), new THREE.MeshStandardMaterial({ color: '#fbfbfb', roughness: 0.4 }))
    pole.position.y = 0.9
    pole.castShadow = true
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.36, 8, 3), new THREE.MeshStandardMaterial({ color: course.id === 'moon' ? '#ffd23f' : '#ff4f5e', roughness: 0.7, side: THREE.DoubleSide }))
    cloth.geometry.translate(0.28, 0, 0)
    cloth.position.y = 1.6
    cloth.castShadow = true
    flag.add(pole, cloth)
    root.add(flag)

    // ティーのマットと、ホールの番号の立て札。
    const tee = geometry.tee
    const first = definition.route[1] ?? definition.cup
    const heading = Math.atan2(first.x - tee.x, first.z - tee.z)
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshStandardMaterial({ color: felt.clone().offsetHSL(0, 0.05, -0.08), roughness: 1 }))
    mat.rotation.set(-Math.PI / 2, 0, heading)
    mat.position.set(tee.x, tee.y + 0.004, tee.z)
    mat.receiveShadow = true
    root.add(mat)
    const side = { x: Math.cos(heading), z: -Math.sin(heading) }
    for (const s of [-1, 1]) solid.add('sphere', course.color, tee.x + side.x * 0.52 * s, tee.y + 0.05, tee.z + side.z * 0.52 * s, 0.12, 0.1, 0.12)
    let signDistance = 0.6
    while (signDistance < 6 && !clear(tee.x + side.x * signDistance, tee.z + side.z * signDistance, 0.55)) signDistance += 0.2
    const signAt = { x: tee.x + side.x * signDistance, z: tee.z + side.z * signDistance }
    const signTexture = canvasTexture(128, 128, ctx => {
      ctx.fillStyle = '#fff6e0'
      ctx.beginPath(); ctx.roundRect(6, 6, 116, 116, 22); ctx.fill()
      ctx.strokeStyle = course.color; ctx.lineWidth = 9; ctx.stroke()
      ctx.fillStyle = course.color
      ctx.font = 'bold 76px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(number), 64, 70)
    })
    const signBoard = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshStandardMaterial({ map: signTexture, roughness: 0.7, side: THREE.DoubleSide }))
    const signBase = geometry.heightAt(tee.x, tee.z) ?? 0
    signBoard.position.set(signAt.x, signBase + 1.0, signAt.z)
    signBoard.rotation.y = heading + Math.PI
    root.add(signBoard)
    solid.add('box', '#9a6b42', signAt.x, signBase + 0.3, signAt.z, 0.08, 1.1, 0.08)

    // しかけ。
    const blades: THREE.Group[] = []
    const gates: THREE.Object3D[] = []
    const critters: THREE.Object3D[] = []
    const bumpers = new Map<string, THREE.Group>()
    const boosters: THREE.Texture[] = []
    const groundOf = (x: number, z: number) => geometry.heightAt(x, z) ?? 0
    for (const gadget of definition.gadgets ?? []) {
      const ground = groundOf(gadget.x, gadget.z)
      if (gadget.kind === 'bumper') {
        const group = new THREE.Group()
        group.position.set(gadget.x, ground, gadget.z)
        const r = gadget.radius
        if (course.id === 'meadow') {
          // きのこ
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.72, r * 0.86, BUMPER_HEIGHT * 0.7, 16), new THREE.MeshStandardMaterial({ color: look.bumperCap, roughness: 0.6 }))
          stem.position.y = BUMPER_HEIGHT * 0.35
          const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 1.18, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: look.bumper, roughness: 0.4 }))
          cap.position.y = BUMPER_HEIGHT * 0.62
          cap.scale.y = 0.75
          group.add(stem, cap)
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2
            const dot = new THREE.Mesh(new THREE.SphereGeometry(r * 0.16, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }))
            dot.position.set(Math.cos(angle) * r * 0.78, BUMPER_HEIGHT * 0.62 + r * 0.55, Math.sin(angle) * r * 0.78)
            group.add(dot)
          }
        } else if (course.id === 'beach') {
          // くらげ
          const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 1.12, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: look.bumper, roughness: 0.25, transparent: true, opacity: 0.86, emissive: look.bumper, emissiveIntensity: 0.18 }))
          dome.scale.y = 1.05
          const skirt = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, r * 0.14, 8, 24), new THREE.MeshStandardMaterial({ color: look.bumperCap, roughness: 0.4 }))
          skirt.rotation.x = Math.PI / 2
          skirt.position.y = 0.05
          group.add(dome, skirt)
          for (const x of [-0.35, 0.35]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 8, 6), new THREE.MeshStandardMaterial({ color: '#3b2a3a' }))
            eye.position.set(x * r, r * 0.62, r * 0.93)
            group.add(eye)
          }
        } else if (course.id === 'snow') {
          // ゆきだるま
          const body = new THREE.Mesh(new THREE.SphereGeometry(r * 1.1, 18, 12), new THREE.MeshStandardMaterial({ color: look.bumperCap, roughness: 0.75 }))
          body.position.y = BUMPER_HEIGHT * 0.38
          const head = new THREE.Mesh(new THREE.SphereGeometry(r * 0.78, 16, 12), new THREE.MeshStandardMaterial({ color: look.bumperCap, roughness: 0.75 }))
          head.position.y = BUMPER_HEIGHT * 0.95
          const hat = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.44, r * 0.44, r * 0.5, 14), new THREE.MeshStandardMaterial({ color: look.bumper, roughness: 0.5 }))
          hat.position.y = BUMPER_HEIGHT * 1.22
          const brim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.72, r * 0.72, r * 0.1, 14), new THREE.MeshStandardMaterial({ color: look.bumper, roughness: 0.5 }))
          brim.position.y = BUMPER_HEIGHT * 1.02
          const nose = new THREE.Mesh(new THREE.ConeGeometry(r * 0.13, r * 0.42, 10), new THREE.MeshStandardMaterial({ color: '#ff9a3d', roughness: 0.6 }))
          nose.rotation.x = Math.PI / 2
          nose.position.set(0, BUMPER_HEIGHT * 0.95, r * 0.78)
          group.add(body, head, hat, brim, nose)
          for (const x of [-0.3, 0.3]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.09, 8, 6), new THREE.MeshStandardMaterial({ color: '#3b3340' }))
            eye.position.set(x * r, BUMPER_HEIGHT * 1.03, r * 0.62)
            group.add(eye)
          }
        } else {
          // ユーフォー
          const saucer = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 0.9, 0.12, 24), new THREE.MeshStandardMaterial({ color: '#d7dbe8', roughness: 0.3, metalness: 0.6 }))
          saucer.position.y = BUMPER_HEIGHT * 0.45
          const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: look.bumper, roughness: 0.1, transparent: true, opacity: 0.8, emissive: look.bumper, emissiveIntensity: 0.4 }))
          dome.position.y = BUMPER_HEIGHT * 0.5
          const stand = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.5, BUMPER_HEIGHT * 0.45, 12), new THREE.MeshStandardMaterial({ color: '#8f93a8', roughness: 0.5 }))
          stand.position.y = BUMPER_HEIGHT * 0.22
          group.add(saucer, dome, stand)
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2
            const light = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshBasicMaterial({ color: i % 2 ? '#fff27a' : '#ff8ad8' }))
            light.position.set(Math.cos(angle) * r * 1.2, BUMPER_HEIGHT * 0.45, Math.sin(angle) * r * 1.2)
            group.add(light)
          }
        }
        group.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true })
        root.add(group)
        bumpers.set(gadget.id, group)
      } else if (gadget.kind === 'rock') {
        solid.add('rock', look.rock, gadget.x, ground - 0.02, gadget.z, gadget.radius * 2.1, gadget.radius * 1.55, gadget.radius * 2.1, 0.2, 0.7, 0.1)
        solid.add('rock', look.rock, gadget.x + gadget.radius * 0.7, ground - 0.02, gadget.z - gadget.radius * 0.5, gadget.radius * 0.8, gadget.radius * 0.6, gadget.radius * 0.8, 0.5, 0.2, 0.3)
      } else if (gadget.kind === 'windmill') {
        const group = new THREE.Group()
        group.position.set(gadget.x, ground, gadget.z)
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#9b7250', roughness: 0.8 })
        const brick = new THREE.MeshStandardMaterial({ color: '#d9b48a', roughness: 0.85 })
        const roofMaterial = new THREE.MeshStandardMaterial({ color: '#d9573f', roughness: 0.6 })
        const pillarWidth = WINDMILL.outer - WINDMILL.tunnelHalf
        for (const s of [-1, 1]) {
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(pillarWidth, WINDMILL.pillarHeight, WINDMILL.halfDepth * 2), brick)
          pillar.position.set((s * (WINDMILL.outer + WINDMILL.tunnelHalf)) / 2, WINDMILL.pillarHeight / 2, 0)
          group.add(pillar)
        }
        // 塔は はねより奥に収め、はねが体に めりこまないようにする。茶色の塔に白い はねで見分けやすく。
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.08, 1.6, 4, 1), bodyMaterial)
        body.rotation.y = Math.PI / 4
        body.position.y = WINDMILL.pillarHeight + 0.8
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.02, 1.0, 4), roofMaterial)
        roof.rotation.y = Math.PI / 4
        roof.position.y = WINDMILL.pillarHeight + 1.6 + 0.5
        const lookout = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffcf6b', emissiveIntensity: 0.35 }))
        lookout.position.set(0, WINDMILL.pillarHeight + 1.32, 0.64)
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 12), roofMaterial)
        hub.rotation.x = Math.PI / 2
        hub.position.set(0, WINDMILL.hubHeight, WINDMILL.bladeFront - 0.08)
        group.add(body, roof, lookout, hub)
        const bladeGroup = new THREE.Group()
        bladeGroup.position.set(0, WINDMILL.hubHeight, WINDMILL.bladeFront)
        const wood = new THREE.MeshStandardMaterial({ color: '#5b3a26', roughness: 0.8 })
        const sail = new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.9, side: THREE.DoubleSide })
        for (let i = 0; i < WINDMILL.blades; i++) {
          const blade = new THREE.Group()
          blade.rotation.z = -(i / WINDMILL.blades) * Math.PI * 2
          const spar = new THREE.Mesh(new THREE.BoxGeometry(0.07, WINDMILL.bladeLength + 0.1, 0.06), wood)
          spar.position.y = 0.05 + WINDMILL.bladeLength / 2
          const panel = new THREE.Mesh(new THREE.PlaneGeometry(WINDMILL.bladeWidth, WINDMILL.bladeLength * 0.82), sail)
          panel.position.set(WINDMILL.bladeWidth / 2 - 0.02, 0.1 + WINDMILL.bladeLength * 0.55, 0.035)
          blade.add(spar, panel)
          for (let k = 1; k <= 3; k++) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(WINDMILL.bladeWidth, 0.03, 0.03), wood)
            bar.position.set(WINDMILL.bladeWidth / 2 - 0.02, 0.1 + (WINDMILL.bladeLength * k) / 3.6, 0.04)
            blade.add(bar)
          }
          bladeGroup.add(blade)
        }
        group.add(bladeGroup)
        group.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = child.receiveShadow = true })
        root.add(group)
        blades.push(bladeGroup)
      } else if (gadget.kind === 'gate') {
        // 行ったり来たりする うごくカベ。色のちがう上ぶたを付けて、動く物だと わかるようにする。
        const group = new THREE.Group()
        const length = Math.hypot(gadget.axis.x, gadget.axis.z) || 1
        group.rotation.y = Math.atan2(-gadget.axis.z / length, gadget.axis.x / length)
        const body = new THREE.Mesh(new THREE.BoxGeometry(gadget.halfWidth * 2, GATE.height, GATE.halfDepth * 2), new THREE.MeshStandardMaterial({ color: look.bumper, roughness: 0.5 }))
        body.position.y = GATE.height / 2
        const cap = new THREE.Mesh(new THREE.BoxGeometry(gadget.halfWidth * 2 + 0.06, 0.08, GATE.halfDepth * 2 + 0.06), new THREE.MeshStandardMaterial({ color: look.bumperCap, roughness: 0.4 }))
        cap.position.y = GATE.height + 0.02
        group.add(body, cap)
        for (const side of [-1, 1]) {
          const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: look.bumperCap, roughness: 0.4 }))
          knob.position.set(side * (gadget.halfWidth - 0.12), GATE.height * 0.55, GATE.halfDepth + 0.03)
          group.add(knob)
        }
        group.position.set(gadget.x, ground - 0.05, gadget.z)
        group.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true })
        root.add(group)
        gates.push(group)
      } else if (gadget.kind === 'critter') {
        const group = critterModel(gadget.look, look.bumper)
        group.position.set(gadget.x, ground, gadget.z)
        group.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true })
        root.add(group)
        critters.push(group)
      } else if (gadget.kind === 'warp') {
        // どかん。入口の わっかと、中の くらい あなで「すいこまれそう」に見せる。
        const group = new THREE.Group()
        group.position.set(gadget.x, ground, gadget.z)
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(gadget.radius, gadget.radius * 1.1, WARP.height, 22, 1, true), new THREE.MeshStandardMaterial({ color: look.bumper, roughness: 0.45, side: THREE.DoubleSide }))
        pipe.position.y = WARP.height / 2 - 0.16
        const lip = new THREE.Mesh(new THREE.TorusGeometry(gadget.radius, 0.06, 8, 24), new THREE.MeshStandardMaterial({ color: look.bumperCap, roughness: 0.3, emissive: look.bumperCap, emissiveIntensity: 0.25 }))
        lip.rotation.x = Math.PI / 2
        lip.position.y = WARP.height - 0.16
        const inside = new THREE.Mesh(new THREE.CircleGeometry(gadget.radius * 0.96, 24), new THREE.MeshStandardMaterial({ color: '#1e2340', roughness: 1 }))
        inside.rotation.x = -Math.PI / 2
        inside.position.y = 0.02
        group.add(pipe, lip, inside)
        group.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true })
        root.add(group)
      } else {
        const texture = canvasTexture(64, 128, ctx => {
          ctx.fillStyle = '#243a8c'
          ctx.fillRect(0, 0, 64, 128)
          for (let k = 0; k < 2; k++) {
            ctx.fillStyle = k ? '#ffd23f' : '#ff8a3d'
            ctx.beginPath()
            ctx.moveTo(8, 50 + k * 64)
            ctx.lineTo(32, 18 + k * 64)
            ctx.lineTo(56, 50 + k * 64)
            ctx.lineTo(56, 64 + k * 64)
            ctx.lineTo(32, 34 + k * 64)
            ctx.lineTo(8, 64 + k * 64)
            ctx.closePath()
            ctx.fill()
          }
        })
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping
        texture.repeat.set(1, 1.5)
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(BOOSTER.halfWidth * 2, BOOSTER.halfLength * 2), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }))
        pad.rotation.set(-Math.PI / 2, 0, Math.atan2(gadget.dir.x, -gadget.dir.z) + Math.PI)
        pad.position.set(gadget.x, ground + 0.006, gadget.z)
        root.add(pad)
        boosters.push(texture)
      }
    }

    // まわりの景色。
    const spinners: THREE.Object3D[] = []
    const floaters: { object: THREE.Object3D; base: number; phase: number }[] = []
    let water: HoleContent['water'] = null
    let snow: HoleContent['snow'] = null
    const baseY = Math.min(...outlines.map(outline => outline.base)) - PLATFORM_DEPTH
    if (course.id === 'moon') {
      // 宇宙にうかぶコース。まわりはぜんぶ星空で、落ちると宇宙へ ふわっと ただよう。
      scene.background = new THREE.Color('#070a24')
      scene.fog = null
      root.add(skyDome('#04061a', look.sky))
      const stars = new THREE.BufferGeometry()
      const points: number[] = []
      for (let i = 0; i < 900; i++) {
        const u = hash(i * 2.3) * Math.PI * 2
        const v = Math.acos(hash(i * 5.1 + 3) * 2 - 1)
        points.push(cx + Math.sin(v) * Math.cos(u) * 150, Math.cos(v) * 150, cz + Math.sin(v) * Math.sin(u) * 150)
      }
      stars.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
      root.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#fffbe8', size: 2, sizeAttenuation: false, fog: false })))
      const moonBall = new THREE.Mesh(new THREE.SphereGeometry(16, 48, 28), new THREE.MeshStandardMaterial({
        map: canvasTexture(256, 128, ctx => {
          ctx.fillStyle = '#cfcddc'
          ctx.fillRect(0, 0, 256, 128)
          for (let i = 0; i < 40; i++) {
            const x = hash(i + 11) * 256
            const y = 10 + hash(i + 23) * 108
            const r = 3 + hash(i + 37) * 11
            ctx.fillStyle = '#b3b1c4'
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
            ctx.fillStyle = '#e2e0ec'
            ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.55, 0, Math.PI * 2); ctx.fill()
          }
        }),
        roughness: 1, emissive: '#2a2840', emissiveIntensity: 0.4,
      }))
      moonBall.position.set(cx + 24, -15, cz - 20)
      root.add(moonBall)
      spinners.push(moonBall)
      const earth = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 20), new THREE.MeshStandardMaterial({
        map: canvasTexture(256, 128, ctx => {
          ctx.fillStyle = '#2f7fd8'
          ctx.fillRect(0, 0, 256, 128)
          ctx.fillStyle = '#58b368'
          for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.ellipse(hash(i + 1) * 256, 20 + hash(i + 50) * 88, 10 + hash(i + 9) * 22, 6 + hash(i + 19) * 14, hash(i) * 3, 0, Math.PI * 2); ctx.fill() }
          ctx.fillStyle = 'rgba(255,255,255,0.8)'
          for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.ellipse(hash(i + 71) * 256, hash(i + 33) * 128, 16, 4, 0, 0, Math.PI * 2); ctx.fill() }
        }),
        emissive: '#1b3f8a', emissiveIntensity: 0.35, roughness: 0.8,
      }))
      earth.position.set(cx - 38, 24, cz - 72)
      spinners.push(earth)
      const planet = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 16), new THREE.MeshStandardMaterial({ color: '#f2a65a', roughness: 0.7, emissive: '#6a3a10', emissiveIntensity: 0.3 }))
      planet.position.set(cx + 46, 20, cz - 66)
      const ring = new THREE.Mesh(new THREE.RingGeometry(5.4, 8, 48), new THREE.MeshStandardMaterial({ color: '#ffe2a8', side: THREE.DoubleSide, transparent: true, opacity: 0.8, emissive: '#6a5020', emissiveIntensity: 0.3 }))
      ring.position.copy(planet.position)
      ring.rotation.set(-1.2, 0.3, 0.2)
      root.add(earth, planet, ring)
      // 浮いた台の下で光る ジェット。
      for (const outline of outlines) {
        outline.points.forEach((point, index) => {
          if (index % 9) return
          soft.add('cylinder', '#7ef5ff', point.x, outline.base - PLATFORM_DEPTH - 0.06, point.z, 0.26, 0.08, 0.26)
        })
      }
      // コースのそばに うかぶロケットと、まわる人工衛星。
      const rocket = new THREE.Group()
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 2.6, 16), new THREE.MeshStandardMaterial({ color: '#f4f4ff', roughness: 0.4, metalness: 0.2 }))
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.56, 1.1, 16), new THREE.MeshStandardMaterial({ color: '#ff5a5f', roughness: 0.4 }))
      nose.position.y = 1.85
      const porthole = new THREE.Mesh(new THREE.CircleGeometry(0.24, 20), new THREE.MeshStandardMaterial({ color: '#7fd3ff', emissive: '#2f8fd6', emissiveIntensity: 0.6 }))
      porthole.position.set(0, 0.5, 0.56)
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.1, 12), new THREE.MeshBasicMaterial({ color: '#ffb13b', transparent: true, opacity: 0.9 }))
      flame.rotation.x = Math.PI
      flame.position.y = -1.85
      rocket.add(hull, nose, porthole, flame)
      for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.7), new THREE.MeshStandardMaterial({ color: '#ff5a5f', roughness: 0.5 }))
        fin.position.set(Math.sin((i * Math.PI * 2) / 3) * 0.62, -1.0, Math.cos((i * Math.PI * 2) / 3) * 0.62)
        fin.rotation.y = (i * Math.PI * 2) / 3
        rocket.add(fin)
      }
      rocket.position.set(bounds.maxX + 3.5, 2.5, cz - 1.5)
      rocket.rotation.set(0.25, 0, -0.35)
      root.add(rocket)
      floaters.push({ object: rocket, base: rocket.position.y, phase: 0 })
      const satellite = new THREE.Group()
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.9), new THREE.MeshStandardMaterial({ color: '#e8e4d8', metalness: 0.5, roughness: 0.4 }))
      const panels = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 0.7), new THREE.MeshStandardMaterial({ color: '#3c5bd8', metalness: 0.3, roughness: 0.3, emissive: '#1a2a6a', emissiveIntensity: 0.4 }))
      satellite.add(core, panels)
      satellite.position.set(bounds.minX - 4, 4, cz - 4)
      root.add(satellite)
      spinners.push(satellite)
      floaters.push({ object: satellite, base: satellite.position.y, phase: 2 })
    } else {
      scene.background = new THREE.Color(look.horizon)
      scene.fog = new THREE.Fog(look.horizon, 38, 140)
      root.add(skyDome(look.sky, look.horizon))
      for (let i = 0; i < 9; i++) {
        const angle = hash(i + 300) * Math.PI * 2
        const distance = 34 + hash(i + 310) * 30
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        const y = 14 + hash(i + 320) * 8
        for (let k = 0; k < 4; k++) soft.add('sphere', '#ffffff', x + (k - 1.5) * 1.6, y + (k % 2) * 0.5, z + hash(i * 4 + k) * 1.2, 2.6 + hash(k + i) * 1.6, 1.6, 2.2)
      }
    }
    if (course.id === 'meadow') {
      const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 48), new THREE.MeshStandardMaterial({ color: look.ground, roughness: 1 }))
      ground.rotation.x = -Math.PI / 2
      ground.position.y = baseY - 0.01
      ground.receiveShadow = true
      root.add(ground)
      const greens = ['#4f9d5b', '#62aa62', '#7cb867', '#3f8a5a', '#8fc26a']
      for (let i = 0; i < 90; i++) {
        const angle = hash(i + 1) * Math.PI * 2
        const distance = 3 + hash(i + 2) * 26
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        const size = 0.7 + hash(i + 3) * 0.8
        if (!clear(x, z, 1.6 + size * 0.6)) continue
        solid.add('cylinder', '#97714c', x, baseY + size * 0.45, z, 0.22 * size, size * 0.9, 0.22 * size)
        if (i % 3) solid.add('sphere', greens[i % greens.length]!, x, baseY + size * 1.35, z, size * 1.6, size * 1.5, size * 1.6)
        else solid.add('cone', greens[i % greens.length]!, x, baseY + size * 1.5, z, size * 1.3, size * 2, size * 1.3)
      }
      for (let i = 0; i < 120; i++) {
        const x = cx + (hash(i + 500) - 0.5) * 22
        const z = cz + (hash(i + 700) - 0.5) * 24
        if (!clear(x, z, 0.7)) continue
        solid.add('sphere', ['#ffe28a', '#ffffff', '#ff9eb5', '#c7a7ff'][i % 4]!, x, baseY + 0.12, z, 0.18, 0.16, 0.18)
        solid.add('sphere', '#6fb45a', x + 0.12, baseY + 0.06, z + 0.08, 0.26, 0.1, 0.22)
      }
      for (const [x, z, s] of [[-40, -30, 12], [-12, -58, 16], [30, -45, 13], [48, 10, 10]] as const) {
        soft.add('sphere', '#8fbf73', cx + x, baseY, cz + z, s * 2.4, s, s * 2)
      }
      // 小さな おうち。
      const hx = bounds.maxX + 3.2
      const hz = bounds.maxZ - 1.5
      solid.add('box', '#fff1d6', hx, baseY + 0.8, hz, 2.2, 1.6, 1.8)
      solid.add('pyramid', '#d9573f', hx, baseY + 2.1, hz, 2.9, 1.0, 2.7, 0, Math.PI / 4)
      solid.add('box', '#8a5a3c', hx - 1.11, baseY + 0.55, hz, 0.05, 1.0, 0.5)
    } else if (course.id === 'beach') {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(320, 320, 1, 1), new THREE.MeshStandardMaterial({ color: '#3cb7d4', roughness: 0.25, metalness: 0.05 }))
      sea.rotation.x = -Math.PI / 2
      sea.position.y = SEA_Y
      const uniforms = { uTime: { value: 0 } }
      const material = sea.material as THREE.MeshStandardMaterial
      material.onBeforeCompile = shader => {
        shader.uniforms.uTime = uniforms.uTime
        shader.vertexShader = 'varying vec2 vWave;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWave = (modelMatrix * vec4(transformed, 1.0)).xz;')
        shader.fragmentShader = 'varying vec2 vWave;\nuniform float uTime;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float wave = sin(vWave.x * 0.9 + uTime * 1.3) * sin(vWave.y * 0.7 - uTime * 0.9) + 0.4 * sin((vWave.x + vWave.y) * 2.1 + uTime * 2.0);
          diffuseColor.rgb += vec3(0.12, 0.16, 0.14) * smoothstep(0.6, 1.2, wave);`)
      }
      material.customProgramCacheKey = () => 'golf-sea-v1'
      root.add(sea)
      water = { uniforms }
      for (const outline of outlines) {
        outline.points.forEach((point, index) => {
          if (index % 7) return
          solid.add('cylinder', '#b18a5e', point.x, (outline.base - PLATFORM_DEPTH + SEA_Y - 0.8) / 2, point.z, 0.16, outline.base - PLATFORM_DEPTH - SEA_Y + 0.8, 0.16)
        })
      }
      for (const [x, z, s] of [[-24, -26, 7], [26, -34, 9], [-30, 14, 6], [30, 18, 5]] as const) {
        soft.add('sphere', look.ground, cx + x, SEA_Y - s * 0.3, cz + z, s * 2.4, s * 0.8, s * 1.8)
        for (let k = 0; k < 3; k++) {
          const px = cx + x + (k - 1) * s * 0.5
          const pz = cz + z + (k % 2) * s * 0.3
          for (let j = 0; j < 4; j++) solid.add('cylinder', '#a97c50', px + j * 0.12, SEA_Y + 0.3 + j * 0.7, pz, 0.28, 0.75, 0.28, 0, 0, 0.08)
          for (let j = 0; j < 5; j++) solid.add('cone', '#3fae6a', px + 0.45 + Math.cos(j * 1.26) * 0.8, SEA_Y + 3.1, pz + Math.sin(j * 1.26) * 0.8, 0.5, 1.9, 0.5, Math.PI / 2.3, j * 1.26, 0)
        }
      }
      const lx = bounds.minX - 3.5
      const lz = bounds.minZ + 2
      solid.add('cylinder', '#9f978d', lx, SEA_Y + 0.2, lz, 2.6, 1.2, 2.6)
      for (let k = 0; k < 5; k++) solid.add('cylinder', k % 2 ? '#ffffff' : '#ff5a5f', lx, SEA_Y + 1.1 + k * 0.8 + 0.4, lz, 1.2 - k * 0.1, 0.8, 1.2 - k * 0.1)
      solid.add('cylinder', '#fff4a8', lx, SEA_Y + 5.6, lz, 0.8, 0.6, 0.8)
      solid.add('cone', '#ff5a5f', lx, SEA_Y + 6.3, lz, 1.1, 0.8, 1.1)
      for (let i = 0; i < 8; i++) {
        const angle = hash(i + 900) * Math.PI * 2
        const distance = 4 + hash(i + 910) * 7
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        if (!clear(x, z, 1.2)) continue
        solid.add('sphere', i % 2 ? '#ff5a5f' : '#ffffff', x, SEA_Y + 0.08, z, 0.36, 0.36, 0.36)
      }
      const bx = bounds.maxX + 9
      const bz = cz - 6
      solid.add('box', '#ffffff', bx, SEA_Y + 0.15, bz, 1.2, 0.5, 3.2)
      solid.add('cone', '#ffe08a', bx, SEA_Y + 2, bz + 0.3, 0.2, 3, 1.8, 0, Math.PI / 2, 0)
    } else if (course.id === 'snow') {
      const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 48), new THREE.MeshStandardMaterial({ color: look.ground, roughness: 0.9 }))
      ground.rotation.x = -Math.PI / 2
      ground.position.y = baseY - 0.01
      ground.receiveShadow = true
      root.add(ground)
      // もみの木。雪をかぶった みどりの円すいを かさねる。
      for (let i = 0; i < 60; i++) {
        const angle = hash(i + 41) * Math.PI * 2
        const distance = 4 + hash(i + 43) * 24
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        const size = 0.9 + hash(i + 47) * 0.9
        if (!clear(x, z, 1.5 + size * 0.5)) continue
        solid.add('cylinder', '#8a6247', x, baseY + size * 0.3, z, 0.2 * size, size * 0.6, 0.2 * size)
        for (let k = 0; k < 3; k++) solid.add('cone', k === 2 ? '#e9f4ff' : '#2f7a55', x, baseY + size * (0.9 + k * 0.6), z, size * (1.5 - k * 0.38), size * 1.0, size * (1.5 - k * 0.38))
      }
      // ゆきの こぶ。
      for (let i = 0; i < 40; i++) {
        const x = cx + (hash(i + 601) - 0.5) * 26
        const z = cz + (hash(i + 701) - 0.5) * 28
        if (!clear(x, z, 1.1)) continue
        soft.add('sphere', '#f3f8ff', x, baseY + 0.02, z, 1.1 + hash(i) * 1.4, 0.4 + hash(i + 3) * 0.4, 1.1 + hash(i + 5) * 1.2)
      }
      for (const [x, z, size] of [[-34, -28, 11], [22, -46, 14], [40, 12, 9]] as const) {
        soft.add('sphere', '#e8f1ff', cx + x, baseY, cz + z, size * 2.4, size, size * 2)
      }
      // かまくらと、大きな ゆきだるま。
      const ix = bounds.maxX + 3.4
      const iz = bounds.maxZ - 1.2
      soft.add('sphere', '#f7fbff', ix, baseY, iz, 3.4, 2.6, 3.4)
      solid.add('box', '#cfe0f2', ix, baseY + 0.45, iz - 1.6, 0.9, 0.9, 0.5)
      const sx = bounds.minX - 3.2
      const sz = bounds.minZ + 2.4
      solid.add('sphere', '#fbfdff', sx, baseY + 0.7, sz, 1.5, 1.4, 1.5)
      solid.add('sphere', '#fbfdff', sx, baseY + 1.8, sz, 1.0, 1.0, 1.0)
      solid.add('cylinder', '#4a5570', sx, baseY + 2.45, sz, 0.7, 0.5, 0.7)
      solid.add('cylinder', '#4a5570', sx, baseY + 2.22, sz, 1.1, 0.1, 1.1)
      solid.add('cone', '#ff9a3d', sx, baseY + 1.85, sz + 0.55, 0.16, 0.5, 0.16, Math.PI / 2, 0, 0)
      // ちらちら ふる ゆき。動きを減らす設定では止まる。
      const flakes = new THREE.BufferGeometry()
      const points: number[] = []
      const snowHeight = 16
      for (let i = 0; i < 300; i++) {
        points.push(cx + (hash(i * 3.1 + 5) - 0.5) * 44, baseY + hash(i * 7.7 + 11) * snowHeight, cz + (hash(i * 5.3 + 19) - 0.5) * 44)
      }
      flakes.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
      const points3d = new THREE.Points(flakes, new THREE.PointsMaterial({ color: '#ffffff', size: 0.11, transparent: true, opacity: 0.9, depthWrite: false, fog: false }))
      root.add(points3d)
      snow = { points: points3d, base: baseY, height: snowHeight }
    }
    solid.build(root, true)
    soft.build(root, false)
    root.traverse(child => { if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial && !child.material.transparent) child.receiveShadow = true })

    // 影を落とす範囲をホールの大きさに合わせる。
    const extent = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 2.5
    sun.target.position.set(cx, 0, cz)
    sun.position.set(cx - 7, 14, cz + 6)
    Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 45 })
    sun.shadow.camera.updateProjectionMatrix()
    const moon = course.id === 'moon'
    hemisphere.color.set(moon ? '#b3b8ff' : '#eef8ff')
    hemisphere.groundColor.set(moon ? '#3a3552' : course.id === 'beach' ? '#d8c89a' : '#7fa35a')
    hemisphere.intensity = moon ? 0.9 : 1.05
    sun.color.set(moon ? '#f2f0ff' : '#fff1d6')
    sun.intensity = moon ? 2.1 : 2.4
    scene.environmentIntensity = moon ? 0.3 : 0.38
    scene.add(root)
    return { root, heightAt: geometry.heightAt, cupY: cup.y, flag, flagBase, cloth, blades, gates, critters, snow, bumpers, boosters, water, spinners, floaters }
  }

  function resize() {
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7))
    renderer.setSize(width, height, false)
  }
  resize()

  function floorY(x: number, z: number, fallback: number) {
    return hole?.heightAt(x, z) ?? fallback
  }

  function emit(list: Particle[], limit: number, particle: Particle) {
    if (list.length >= limit) list.shift()
    list.push(particle)
  }

  const palette = ['#ff6f91', '#ffd166', '#6fd3c7', '#8fa9ff', '#fff3d6', '#9be36d'].map(value => new THREE.Color(value))
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const picked = new THREE.Vector3()

  return {
    renderer,
    camera,
    get aspect() { return camera.aspect },
    /** 画面の点を、高さ y の水平な面の上の場所へ直す（タップした所をねらう）。 */
    pickGround(clientX: number, clientY: number, y: number): Vec2 | null {
      const rect = renderer.domElement.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null
      pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      pickPlane.constant = -y
      return raycaster.ray.intersectPlane(pickPlane, picked) ? { x: picked.x, z: picked.z } : null
    },
    setHole(course: CourseDefinition, definition: HoleDefinition, geometry: HoleGeometry, number: number) {
      if (hole) { scene.remove(hole.root); disposeTree(hole.root) }
      hole = buildHole(course, definition, geometry, number)
      flagLift = 0
      flagLifted = false
      hintTarget = null
      bitList.length = 0
      puffList.length = 0
      pulses.clear()
    },
    setBallStyle(id: GolfBallId) {
      if (id === ballStyle) return
      ballStyle = id
      ballMaterial.map?.dispose()
      ballMaterial.map = ballTexture(id)
      ballMaterial.needsUpdate = true
    },
    syncBall(position: Vec3, rotation: Quat, visible = true) {
      ball.position.set(position.x, position.y, position.z)
      ball.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      ball.visible = visible
    },
    /** 動くしかけ（ふうしゃ・うごくカベ・どうぶつ）を、物理と同じ場所へそろえる。 */
    syncGadgets(motion: GadgetMotion) {
      if (!hole) return
      hole.blades.forEach((group, index) => { group.rotation.z = motion.windmills[index] ?? 0 })
      hole.gates.forEach((group, index) => {
        const at = motion.gates[index]
        if (at) group.position.set(at.x, group.position.y, at.z)
      })
      hole.critters.forEach((group, index) => {
        const at = motion.critters[index]
        if (!at) return
        group.position.set(at.x, hole?.heightAt(at.x, at.z) ?? group.position.y, at.z)
        group.rotation.y = at.facing
      })
    },
    setFlagLifted(lifted: boolean) { flagLifted = lifted },
    /** ねらいの矢印・点線・クラブ。null で隠す。 */
    setAim(aim: AimView | null) {
      arrow.visible = aim !== null
      club.visible = aim !== null || swing >= 0
      if (!aim) { dots.count = 0; return }
      const { ball: at, direction, power } = aim
      const heading = Math.atan2(direction.x, direction.z)
      const ground = at.y - BALL_RADIUS
      arrow.position.set(at.x + direction.x * 0.22, ground + 0.025, at.z + direction.z * 0.22)
      arrow.rotation.set(0, heading, 0)
      arrow.scale.set(1 + power * 0.4, 1, 0.5 + power * 1.9)
      arrowMaterial.color.setHSL(0.33 - power * 0.33, 0.9, 0.55)
      clubPull = power
      clubDirection = direction
      swing = -1
      club.position.set(at.x - direction.x * (0.2 + power * 0.45), ground, at.z - direction.z * (0.2 + power * 0.45))
      club.rotation.set(0, heading, 0)
      // 点線は道すじに沿って等間隔に置く。
      let count = 0
      let carry = 0.35
      for (let i = 1; i < aim.path.length && count < DOTS; i++) {
        const a = aim.path[i - 1]!
        const b = aim.path[i]!
        const length = Math.hypot(b.x - a.x, b.z - a.z)
        while (carry <= length && count < DOTS) {
          const t = carry / length
          const x = a.x + (b.x - a.x) * t
          const z = a.z + (b.z - a.z) * t
          dummy.position.set(x, floorY(x, z, ground) + 0.05, z)
          dummy.scale.setScalar(1 - (count / DOTS) * 0.5)
          dummy.updateMatrix()
          dots.setMatrixAt(count++, dummy.matrix)
          carry += 0.26
        }
        carry -= length
      }
      dots.count = count
      dots.instanceMatrix.needsUpdate = true
    },
    /** うった瞬間に、クラブを前へふりぬく。 */
    swingClub() {
      swing = 0
      arrow.visible = false
      dots.count = 0
    },
    setHint(target: Vec2 | null) { hintTarget = target },
    pulseBumper(id: string) { pulses.set(id, 0) },
    effect(kind: EffectKind, position: Vec3, strength = 1) {
      const origin = new THREE.Vector3(position.x, position.y, position.z)
      if (kind === 'splash') {
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2
          emit(puffList, PUFFS, { life: 0, span: 0.9, position: origin.clone(), velocity: new THREE.Vector3(Math.cos(angle) * 1.1, 2.6 + hash(i) * 1.4, Math.sin(angle) * 1.1), gravity: 7, size: 0.09, color: new THREE.Color(i % 3 ? '#bfefff' : '#ffffff'), spin: 0 })
        }
      }
      if (kind === 'dust') {
        for (let i = 0; i < 6; i++) {
          const angle = hash(i + clock) * Math.PI * 2
          emit(puffList, PUFFS, { life: 0, span: 0.55, position: origin.clone(), velocity: new THREE.Vector3(Math.cos(angle) * 0.6 * strength, 0.5 * strength, Math.sin(angle) * 0.6 * strength), gravity: 1, size: 0.1 + 0.08 * strength, color: new THREE.Color(hole && hole.water ? '#f5e2b8' : '#e9dcc0'), spin: 0 })
        }
      }
      if (kind === 'confetti' || kind === 'fireworks') {
        const amount = kind === 'fireworks' ? 80 : 44
        for (let i = 0; i < amount; i++) {
          const angle = (i / amount) * Math.PI * 2 * 3
          const lift = kind === 'fireworks' ? 4.5 : 3.2
          emit(bitList, BITS, { life: 0, span: 1.6 + hash(i) * 0.6, position: origin.clone().add(new THREE.Vector3(0, 0.2, 0)), velocity: new THREE.Vector3(Math.cos(angle) * (0.8 + hash(i + 3) * 1.4), lift + hash(i + 9) * 2, Math.sin(angle) * (0.8 + hash(i + 5) * 1.4)), gravity: 3.2, size: 1, color: palette[i % palette.length]!.clone(), spin: 6 + hash(i) * 8 })
        }
      }
      if (kind === 'sparkle') {
        for (let i = 0; i < 10; i++) {
          const angle = (i / 10) * Math.PI * 2
          emit(bitList, BITS, { life: 0, span: 0.5, position: origin.clone(), velocity: new THREE.Vector3(Math.cos(angle) * 1.6, 1.2, Math.sin(angle) * 1.6), gravity: 2, size: 0.8, color: new THREE.Color('#ffe066'), spin: 10 })
        }
      }
      const ring = rings[ringCursor++ % rings.length]!
      if (kind === 'splash' || kind === 'ring' || kind === 'confetti' || kind === 'fireworks') {
        ring.life = 0
        ring.span = kind === 'splash' ? 0.8 : 0.6
        ring.size = kind === 'splash' ? 0.9 : kind === 'ring' ? 0.55 : 1.2
        ring.mesh.position.set(position.x, position.y + 0.03, position.z)
        ;(ring.mesh.material as THREE.MeshBasicMaterial).color.set(kind === 'splash' ? '#e8fbff' : kind === 'ring' ? '#fff4b0' : '#ffe066')
        ring.mesh.visible = true
      }
    },
    setCamera(pose: CameraPose) {
      camera.position.set(pose.position.x, pose.position.y, pose.position.z)
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z)
    },
    resize,
    render(dt: number, reducedMotion: boolean) {
      clock += dt
      if (hole) {
        flagLift += ((flagLifted ? 1 : 0) - flagLift) * Math.min(1, dt * 6)
        hole.flag.position.y = hole.flagBase + flagLift * 0.95
        if (!reducedMotion) {
          const position = hole.cloth.geometry.getAttribute('position')
          for (let i = 0; i < position.count; i++) {
            const x = position.getX(i)
            position.setZ(i, Math.sin(x * 9 - clock * 5) * 0.045 * (x / 0.56))
          }
          position.needsUpdate = true
          hole.boosters.forEach(texture => { texture.offset.y = (texture.offset.y - dt * 1.4) % 1 })
          if (hole.water) hole.water.uniforms.uTime.value = clock
          hole.spinners.forEach((object, index) => { object.rotation.y += dt * (index ? 0.3 : 0.05) })
          if (hole.snow) {
            const flakes = hole.snow.points.geometry.getAttribute('position')
            for (let i = 0; i < flakes.count; i++) {
              const fall = flakes.getY(i) - dt * (0.5 + (i % 4) * 0.18)
              flakes.setY(i, fall < hole.snow.base ? hole.snow.base + hole.snow.height : fall)
              flakes.setX(i, flakes.getX(i) + Math.sin(clock * 0.7 + i) * dt * 0.1)
            }
            flakes.needsUpdate = true
          }
          hole.floaters.forEach(item => { item.object.position.y = item.base + Math.sin(clock * 1.1 + item.phase) * 0.35 })
        }
        for (const [id, time] of pulses) {
          const group = hole.bumpers.get(id)
          const next = time + dt
          const k = next < 0.3 ? Math.sin((next / 0.3) * Math.PI) : 0
          group?.scale.set(1 + k * 0.22, 1 - k * 0.12, 1 + k * 0.22)
          if (next >= 0.3) pulses.delete(id)
          else pulses.set(id, next)
        }
      }
      if (swing >= 0) {
        swing += dt / 0.18
        const reach = 0.2 + clubPull * 0.45 - swing * (0.5 + clubPull * 0.5)
        const ground = ball.position.y - BALL_RADIUS
        club.position.set(ball.position.x - clubDirection.x * reach, ground, ball.position.z - clubDirection.z * reach)
        if (swing >= 1.6) { swing = -1; club.visible = false }
      }
      hintRing.visible = hintTarget !== null
      if (hintTarget) {
        hintRing.position.set(hintTarget.x, floorY(hintTarget.x, hintTarget.z, 0) + 0.04, hintTarget.z)
        hintRing.scale.setScalar(1 + Math.sin(clock * 5) * (reducedMotion ? 0 : 0.12))
      }
      const update = (list: Particle[], mesh: THREE.InstancedMesh, scale: (particle: Particle, fade: number) => number) => {
        for (let i = list.length - 1; i >= 0; i--) {
          const particle = list[i]!
          particle.life += dt
          if (particle.life > particle.span) { list.splice(i, 1); continue }
          particle.velocity.y -= particle.gravity * dt
          particle.position.addScaledVector(particle.velocity, dt)
        }
        mesh.count = list.length
        list.forEach((particle, index) => {
          const fade = 1 - particle.life / particle.span
          dummy.position.copy(particle.position)
          dummy.rotation.set(particle.life * particle.spin, particle.life * particle.spin * 0.6, 0)
          dummy.scale.setScalar(scale(particle, fade))
          dummy.updateMatrix()
          mesh.setMatrixAt(index, dummy.matrix)
          mesh.setColorAt(index, particle.color)
        })
        for (let rest = list.length; rest < Math.min(list.length + 1, mesh.instanceMatrix.count); rest++) mesh.setMatrixAt(rest, hidden)
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }
      update(bitList, bits, (particle, fade) => particle.size * (0.6 + fade * 0.6))
      update(puffList, puffs, (particle, fade) => particle.size * (0.5 + fade))
      for (const ring of rings) {
        if (!ring.mesh.visible) continue
        ring.life += dt
        const t = ring.life / ring.span
        if (t >= 1) { ring.mesh.visible = false; continue }
        ring.mesh.scale.setScalar(ring.size * (0.3 + t * 1.2))
        ;(ring.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t)
      }
      renderer.render(scene, camera)
    },
    stats() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles } },
    dispose() {
      if (hole) disposeTree(hole.root)
      hole = null
      disposeTree(scene)
      environment.dispose()
      sun.shadow.map?.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

export type GolfScene = ReturnType<typeof createGolfScene>
