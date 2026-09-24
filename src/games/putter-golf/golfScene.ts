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
import { BALL_RADIUS, BOOSTER, BRIDGE, BUMPER_HEIGHT, CRITTER, GATE, PLATFORM_DEPTH, REFLECTOR, TREE, WARP, WINDMILL, type Vec3 } from './golfPhysics'
import type { GadgetMotion } from './golfWorld'

export type EffectKind = 'splash' | 'dust' | 'confetti' | 'fireworks' | 'sparkle' | 'ring'
export type AimView = { ball: Vec3; direction: Vec2; power: number; path: readonly Vec3[] }
type Quat = { x: number; y: number; z: number; w: number }
type Shape = 'box' | 'sphere' | 'cone' | 'pyramid' | 'cylinder' | 'rock' | 'torus'

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
const SEA_Y = -0.62
/** ボールより FADE_MARGIN 手前から 景色を消しはじめ、FADE_DEPTH 手前より カメラ側は すっかり消す。 */
const FADE_MARGIN = 0.8
const FADE_DEPTH = 2.6

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

/**
 * カメラとボールのあいだに入った景色を、点々に くずして 消す。
 * うつときに 木が じゃまで ボールが見えなくなるのを ふせぐ。
 * すきとおらせる（transparent）と 前後の ならびが くずれるので、画素を まばらに 捨てる。
 * こうすると おくゆきの記録も そのままで、後ろの景色が 透けて見えることもない。
 * reach は「カメラからボールまでの距離」。0 なら どこも 消さない。
 */
function fadeInFront(material: THREE.Material, reach: { value: number }) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uReach = reach
    shader.vertexShader = `varying float vCameraDistance;\n${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n\tvCameraDistance = length(mvPosition.xyz);',
    )
    shader.fragmentShader = `varying float vCameraDistance;\nuniform float uReach;\n${shader.fragmentShader}`.replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
      float keep = smoothstep(uReach - ${FADE_DEPTH.toFixed(1)}, uReach - ${FADE_MARGIN.toFixed(1)}, vCameraDistance);
      if (keep < 1.0) {
        float speck = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (keep < speck) discard;
      }`,
    )
  }
  material.customProgramCacheKey = () => 'golf-fade-v1'
}

/**
 * しかけ全体を、点々に まびいて 透かす。keep は のこす画素の わりあい（1 で ふつう）。
 * ふうしゃの うしろに ボールが かくれたときに使う。
 */
function ditherOut(material: THREE.Material, keep: { value: number }) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uKeep = keep
    shader.fragmentShader = `uniform float uKeep;\n${shader.fragmentShader}`.replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
      if (uKeep < 1.0) {
        float speck = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (uKeep < speck) discard;
      }`,
    )
  }
  material.customProgramCacheKey = () => 'golf-dither-v1'
}

/** ふうしゃが ボールを かくしているとき、のこす画素の わりあい。 */
const SEE_THROUGH_KEEP = 0.28

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
    build(parent: THREE.Object3D, shadows: boolean, fade: { value: number }) {
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
      fadeInFront(material, fade)
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

/** さざなみの ゆれる みず。うみ・いけ・かわで 同じ しくみを使い、time を進めると 波が動く。 */
function rippleMaterial(color: string, uniforms: { uTime: { value: number } }): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.05 })
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = uniforms.uTime
    shader.vertexShader = 'varying vec2 vWave;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWave = (modelMatrix * vec4(transformed, 1.0)).xz;')
    shader.fragmentShader = 'varying vec2 vWave;\nuniform float uTime;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float wave = sin(vWave.x * 0.9 + uTime * 1.3) * sin(vWave.y * 0.7 - uTime * 0.9) + 0.4 * sin((vWave.x + vWave.y) * 2.1 + uTime * 2.0);
      diffuseColor.rgb += vec3(0.12, 0.16, 0.14) * smoothstep(0.6, 1.2, wave);`)
  }
  material.customProgramCacheKey = () => 'golf-sea-v1'
  return material
}

/** コースの中の いけと かわの 色。 */
const POND_COLOR = '#3aa6d8'

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
  const skin = { duck: '#ffd94a', crab: '#ff6f5b', penguin: '#3c4560', alien: '#8ee6a8', dino: '#6fc07f', squirrel: '#c9743c', sheep: '#f7f2e6' }[look]
  // ひつじは かおだけ くろいので、かおと めの色は わけておく。
  const face = look === 'sheep' ? '#4b4453' : skin
  const r = CRITTER.radius
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color: skin, roughness: look === 'sheep' ? 1 : 0.6 }))
  body.scale.set(1, 0.92, 1.12)
  body.position.y = r * 0.95
  const head = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 14, 10), new THREE.MeshStandardMaterial({ color: face, roughness: 0.6 }))
  head.position.set(0, CRITTER.height * 0.82, r * 0.3)
  group.add(body, head)
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.09, 8, 6), new THREE.MeshStandardMaterial({ color: look === 'sheep' ? '#fdfdff' : '#2f2a33' }))
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
  if (look === 'squirrel') {
    // ふさふさの しっぽと とがった みみ。
    const tail = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 12, 10), new THREE.MeshStandardMaterial({ color: '#e0985c', roughness: 0.85 }))
    tail.scale.set(0.7, 1.6, 0.7)
    tail.position.set(0, CRITTER.height * 0.8, -r * 1.0)
    group.add(tail)
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(r * 0.16, r * 0.36, 8), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 }))
      ear.position.set(side * r * 0.3, CRITTER.height * 1.12, r * 0.18)
      group.add(ear)
    }
  }
  if (look === 'sheep') {
    // もこもこの け。
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2
      const wool = new THREE.Mesh(new THREE.SphereGeometry(r * 0.44, 10, 8), new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 1 }))
      wool.position.set(Math.cos(angle) * r * 0.66, r * (1.08 + 0.2 * (i % 2)), Math.sin(angle) * r * 0.66 - r * 0.2)
      group.add(wool)
    }
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(r * 0.14, 8, 6), new THREE.MeshStandardMaterial({ color: face, roughness: 0.7 }))
      ear.scale.set(1.7, 0.6, 1)
      ear.position.set(side * r * 0.46, CRITTER.height * 0.88, r * 0.18)
      group.add(ear)
    }
  }
  if (look === 'dino') {
    // しっぽと せなかの とげ。うしろから見ても きょうりゅうだと わかるようにする。
    const tail = new THREE.Mesh(new THREE.ConeGeometry(r * 0.34, r * 1.4, 10), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 }))
    tail.rotation.x = -Math.PI / 2.3
    tail.position.set(0, r * 0.8, -r * 1.1)
    group.add(tail)
    for (let i = 0; i < 3; i++) {
      const plate = new THREE.Mesh(new THREE.ConeGeometry(r * 0.17, r * 0.36, 4), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }))
      plate.position.set(0, r * (1.78 - i * 0.14), -r * (0.1 + i * 0.42))
      plate.rotation.y = Math.PI / 4
      group.add(plate)
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
    /** ボールを かくしたら 透かす しかけ（ふうしゃ）。box は あたり判定用の 外わく。 */
    seeThrough: { box: THREE.Box3; keep: { value: number }; goal: number }[]
    gates: THREE.Object3D[]
    critters: THREE.Object3D[]
    snow: { points: THREE.Points; base: number; height: number } | null
    bumpers: Map<string, THREE.Group>
    boosters: THREE.Texture[]
    water: { uniforms: { uTime: { value: number } } } | null
    spinners: THREE.Object3D[]
    /** すいしゃ。よこむきの じくで まわす。 */
    wheels: THREE.Object3D[]
    floaters: { object: THREE.Object3D; base: number; phase: number }[]
  }
  let hole: HoleContent | null = null
  // カメラとボールのあいだの景色を消すための距離。ホールが変わっても作り直さない。
  const fade = { value: 0 }
  const seeThroughHit = new THREE.Vector3()
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
    let low = Infinity
    let high = -Infinity
    for (let i = 1; i < geometry.floor.positions.length; i += 3) {
      low = Math.min(low, geometry.floor.positions[i]!)
      high = Math.max(high, geometry.floor.positions[i]!)
    }
    // 高さの差が大きいコースでも、いちばん高い所と低い所の明るさの差が同じになるようにする。
    const shadeMid = (low + high) / 2
    const shadeScale = 0.18 / Math.max(0.9, high - low)
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
      // 高い所は明るく、低い所は暗く。こぶやクレーター、さかの だんだんが色でもわかる。
      color.offsetHSL(0, 0, THREE.MathUtils.clamp((geometry.floor.positions[i * 3 + 1]! - shadeMid) * shadeScale, -0.09, 0.09))
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
    // いけと かわ。床の高さに そって はった 水面で、ふちには すなの きしを 付ける。
    const waves = { uniforms: { uTime: { value: 0 } } }
    let water: HoleContent['water'] = null
    const onFloor = (x: number, z: number) => (geometry.heightAt(x, z) ?? 0) + 0.016
    for (const [index, hazard] of (definition.water ?? []).entries()) {
      let surface: THREE.BufferGeometry
      if (hazard.kind === 'pond') {
        surface = new THREE.CircleGeometry(hazard.radius, 48)
        surface.rotateX(-Math.PI / 2)
        surface.translate(hazard.x, 0, hazard.z)
        const bank = new THREE.Mesh(new THREE.RingGeometry(hazard.radius - 0.02, hazard.radius + 0.14, 48), new THREE.MeshStandardMaterial({ color: '#d9c48f', roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
        bank.rotation.x = -Math.PI / 2
        bank.position.set(hazard.x, onFloor(hazard.x, hazard.z) - 0.002, hazard.z)
        root.add(bank)
        // はすの は と、ふちの あし。
        for (let k = 0; k < 4; k++) {
          const angle = hash(index * 7 + k) * Math.PI * 2
          const reach = hazard.radius * (0.35 + hash(index * 11 + k) * 0.45)
          const x = hazard.x + Math.cos(angle) * reach
          const z = hazard.z + Math.sin(angle) * reach
          solid.add('cylinder', k % 2 ? '#5fae4f' : '#72bd5a', x, onFloor(x, z) + 0.01, z, 0.42, 0.02, 0.42)
        }
        for (let k = 0; k < 7; k++) {
          const angle = hash(index * 13 + k + 40) * Math.PI * 2
          const x = hazard.x + Math.cos(angle) * (hazard.radius + 0.05)
          const z = hazard.z + Math.sin(angle) * (hazard.radius + 0.05)
          soft.add('cone', k % 2 ? '#4f8f3f' : '#6aa84a', x, onFloor(x, z) + 0.18, z, 0.07, 0.4, 0.07)
        }
      } else {
        const dx = hazard.to.x - hazard.from.x
        const dz = hazard.to.z - hazard.from.z
        const length = Math.hypot(dx, dz)
        surface = new THREE.PlaneGeometry(length, hazard.halfWidth * 2, Math.max(1, Math.ceil(length / 0.25)), Math.max(1, Math.ceil(hazard.halfWidth / 0.125)))
        surface.rotateX(-Math.PI / 2)
        surface.rotateY(Math.atan2(-dz, dx))
        surface.translate((hazard.from.x + hazard.to.x) / 2, 0, (hazard.from.z + hazard.to.z) / 2)
        // かわの きし。すなの ほそい おびを 両がわに。
        for (const side of [-1, 1]) {
          const x = (hazard.from.x + hazard.to.x) / 2 + (dz / length) * side * (hazard.halfWidth + 0.05)
          const z = (hazard.from.z + hazard.to.z) / 2 - (dx / length) * side * (hazard.halfWidth + 0.05)
          solid.add('box', '#d9c48f', x, onFloor(x, z) - 0.005, z, length, 0.02, 0.14, 0, Math.atan2(-dz, dx), 0)
        }
      }
      const position = surface.getAttribute('position')
      for (let i = 0; i < position.count; i++) position.setY(i, onFloor(position.getX(i), position.getZ(i)))
      surface.computeVertexNormals()
      // polygonOffset の かたむき項は、遠くで ななめに 見ると 大きく なりすぎ、はしの いたの 上に 水が かぶってしまう。
      // 水面は 床から すこし うかせてあるので、ずらすのは 一定の わずかな ぶんだけにする。
      const mesh = new THREE.Mesh(surface, rippleMaterial(POND_COLOR, waves.uniforms))
      mesh.material.polygonOffset = true
      mesh.material.polygonOffsetFactor = 0
      mesh.material.polygonOffsetUnits = -2
      mesh.receiveShadow = true
      root.add(mesh)
      water = waves
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
    const seeThrough: HoleContent['seeThrough'] = []
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
        } else if (course.id === 'candy') {
          // グミ。つやつやの やま形に、さとうの つぶを まぶす。
          const plate = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.2, r * 1.2, 0.05, 20), new THREE.MeshStandardMaterial({ color: look.bumperCap, roughness: 0.55 }))
          plate.position.y = 0.025
          const drop = new THREE.Mesh(new THREE.SphereGeometry(r * 1.12, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: look.bumper, roughness: 0.15, transparent: true, opacity: 0.92, emissive: look.bumper, emissiveIntensity: 0.14 }))
          drop.scale.y = 1.3
          drop.position.y = 0.04
          group.add(plate, drop)
          for (let i = 0; i < 7; i++) {
            const angle = (i / 7) * Math.PI * 2
            const sugar = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 6, 5), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }))
            sugar.position.set(Math.cos(angle) * r * 1.0, BUMPER_HEIGHT * (0.25 + 0.22 * (i % 3)), Math.sin(angle) * r * 1.0)
            group.add(sugar)
          }
        } else if (course.id === 'dino') {
          // きょうりゅうの たまご。くさの すに のっている。
          const nest = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, r * 0.26, 8, 18), new THREE.MeshStandardMaterial({ color: look.bumper, roughness: 0.9 }))
          nest.rotation.x = Math.PI / 2
          nest.position.y = r * 0.24
          const egg = new THREE.Mesh(new THREE.SphereGeometry(r * 1.0, 18, 12), new THREE.MeshStandardMaterial({ color: look.bumperCap, roughness: 0.6 }))
          egg.scale.set(1, 1.35, 1)
          egg.position.y = BUMPER_HEIGHT * 0.66
          group.add(nest, egg)
          for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 + 0.4
            const spot = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 8, 6), new THREE.MeshStandardMaterial({ color: look.bumper, roughness: 0.7 }))
            spot.position.set(Math.cos(angle) * r * 0.94, BUMPER_HEIGHT * (0.5 + 0.34 * (i % 2)), Math.sin(angle) * r * 0.94)
            group.add(spot)
          }
        } else if (course.id === 'forest') {
          // どんぐり。ぼうしを かぶった まるい み。
          const body = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 18, 12), new THREE.MeshStandardMaterial({ color: look.bumperCap, roughness: 0.45 }))
          body.scale.set(1, 1.25, 1)
          body.position.y = BUMPER_HEIGHT * 0.5
          const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 1.12, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: look.bumper, roughness: 0.8 }))
          cap.scale.y = 0.7
          cap.position.y = BUMPER_HEIGHT * 0.78
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.1, r * 0.12, r * 0.4, 8), new THREE.MeshStandardMaterial({ color: '#7c5334', roughness: 0.8 }))
          stem.position.y = BUMPER_HEIGHT * 1.05
          group.add(body, cap, stem)
        } else if (course.id === 'downhill') {
          // まきばの たる。わっかを まいた 木の たる。
          const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 0.92, BUMPER_HEIGHT, 16), new THREE.MeshStandardMaterial({ color: look.bumper, roughness: 0.65 }))
          body.position.y = BUMPER_HEIGHT / 2
          const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.0, r * 1.0, 0.05, 16), new THREE.MeshStandardMaterial({ color: look.bumperCap, roughness: 0.5 }))
          lid.position.y = BUMPER_HEIGHT + 0.02
          group.add(body, lid)
          for (const height of [0.3, 0.72]) {
            const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.06, r * 0.08, 8, 20), new THREE.MeshStandardMaterial({ color: '#8d6242', roughness: 0.6 }))
            band.rotation.x = Math.PI / 2
            band.position.y = BUMPER_HEIGHT * height
            group.add(band)
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
        const lookoutMaterial = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffcf6b', emissiveIntensity: 0.35 })
        const lookout = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), lookoutMaterial)
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
        // ボールが うしろや トンネルの中に かくれたら、ふうしゃごと 透かして 見えるようにする。
        const keep = { value: 1 }
        for (const material of [bodyMaterial, brick, roofMaterial, lookoutMaterial, wood, sail]) ditherOut(material, keep)
        const box = new THREE.Box3(
          new THREE.Vector3(gadget.x - WINDMILL.outer, ground, gadget.z - WINDMILL.halfDepth),
          new THREE.Vector3(gadget.x + WINDMILL.outer, ground + WINDMILL.pillarHeight + 2.6, gadget.z + WINDMILL.bladeFront + 0.1),
        )
        seeThrough.push({ box, keep, goal: 1 })
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
      } else if (gadget.kind === 'tree') {
        // コースに はえた き。みきの 太さは あたりと 同じで、葉は ぶつからない。
        const r = gadget.radius
        solid.add('cylinder', '#7c5334', gadget.x, ground + TREE.trunk / 2, gadget.z, r * 2, TREE.trunk, r * 2)
        if (gadget.look === 'pine') {
          for (let k = 0; k < 3; k++) {
            solid.add('cone', k % 2 ? '#2f7a4a' : '#3f9153', gadget.x, ground + TREE.trunk + 0.18 + k * 0.42, gadget.z, r * (4.4 - k * 1.1), 0.8, r * (4.4 - k * 1.1))
          }
        } else {
          solid.add('sphere', '#4f9f52', gadget.x, ground + TREE.trunk + 0.34, gadget.z, r * 4.2, r * 3.4, r * 4.2)
          solid.add('sphere', '#63b25c', gadget.x + r * 0.9, ground + TREE.trunk + 0.7, gadget.z - r * 0.7, r * 2.6, r * 2.2, r * 2.6)
        }
        // ねもとの くさ。
        solid.add('sphere', '#3f8a4a', gadget.x, ground + 0.04, gadget.z, r * 2.6, 0.16, r * 2.6)
      } else if (gadget.kind === 'bridge') {
        // まるたの はし。いたを ならべ、てすりの ある はしは さくを、つりばしは ロープを はる。
        const length = Math.hypot(gadget.dir.x, gadget.dir.z) || 1
        const along = { x: gadget.dir.x / length, z: gadget.dir.z / length }
        const turn = Math.atan2(along.x, along.z)
        const at = (a: number, side: number) => ({ x: gadget.x + along.x * a + along.z * side, z: gadget.z + along.z * a - along.x * side })
        const planks = Math.max(2, Math.round((gadget.halfLength * 2) / 0.27))
        for (let k = 0; k < planks; k++) {
          const p = at(-gadget.halfLength + ((k + 0.5) * gadget.halfLength * 2) / planks, 0)
          solid.add('box', k % 2 ? '#b98552' : '#a8743f', p.x, groundOf(p.x, p.z) + 0.024, p.z, gadget.halfWidth * 2 + 0.12, 0.032, (gadget.halfLength * 2) / planks - 0.035, 0, turn, 0)
        }
        for (const side of [-1, 1]) {
          const beam = at(0, side * (gadget.halfWidth - 0.05))
          solid.add('box', '#7c5334', beam.x, ground - 0.1, beam.z, 0.14, 0.18, gadget.halfLength * 2, 0, turn, 0)
          if (gadget.rails) {
            const rail = at(0, side * (gadget.halfWidth + BRIDGE.railHalf))
            solid.add('box', '#c08f5e', rail.x, ground + BRIDGE.railHeight, rail.z, 0.09, 0.07, gadget.halfLength * 2, 0, turn, 0)
            const posts = Math.max(2, Math.round((gadget.halfLength * 2) / 0.8) + 1)
            for (let k = 0; k < posts; k++) {
              const post = at(-gadget.halfLength + (k * gadget.halfLength * 2) / (posts - 1), side * (gadget.halfWidth + BRIDGE.railHalf))
              solid.add('cylinder', '#8d6242', post.x, groundOf(post.x, post.z) + BRIDGE.railHeight / 2, post.z, 0.1, BRIDGE.railHeight + 0.04, 0.1)
            }
          } else {
            // つりばしの はしらと ロープ。はしの 外がわに 立てて、ボールの じゃまに ならないようにする。
            for (const end of [-1, 1]) {
              const post = at(end * (gadget.halfLength - 0.15), side * (gadget.halfWidth + 0.14))
              solid.add('cylinder', '#7c5334', post.x, groundOf(post.x, post.z) + 0.45, post.z, 0.14, 0.9, 0.14)
            }
            const rope = at(0, side * (gadget.halfWidth + 0.14))
            solid.add('box', '#e8d3a0', rope.x, ground + 0.72, rope.z, 0.035, 0.035, gadget.halfLength * 2 - 0.3, 0, turn, 0)
          }
        }
      } else if (gadget.kind === 'reflector') {
        // はねかえし いた。ぴかぴかの いたに しまもようを 付けて、ふちと はしらは コースの色。
        const group = new THREE.Group()
        const length = Math.hypot(gadget.dir.x, gadget.dir.z) || 1
        group.rotation.y = Math.atan2(-gadget.dir.z / length, gadget.dir.x / length)
        group.position.set(gadget.x, ground - 0.05, gadget.z)
        const stripes = canvasTexture(256, 32, ctx => {
          ctx.fillStyle = '#e9f7ff'
          ctx.fillRect(0, 0, 256, 32)
          ctx.fillStyle = '#7fd8ff'
          for (let x = -32; x < 256; x += 32) {
            ctx.beginPath(); ctx.moveTo(x, 32); ctx.lineTo(x + 14, 32); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 16, 0); ctx.closePath(); ctx.fill()
          }
        })
        stripes.wrapS = THREE.RepeatWrapping
        stripes.repeat.set(Math.max(1, Math.round(gadget.halfLength)), 1)
        const panel = new THREE.Mesh(new THREE.BoxGeometry(gadget.halfLength * 2, REFLECTOR.height, REFLECTOR.halfDepth * 2), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.15, metalness: 0.35, emissive: '#bfefff', emissiveIntensity: 0.18 }))
        panel.position.y = REFLECTOR.height / 2
        const cap = new THREE.Mesh(new THREE.BoxGeometry(gadget.halfLength * 2 + 0.08, 0.07, REFLECTOR.halfDepth * 2 + 0.06), new THREE.MeshStandardMaterial({ color: look.bumper, roughness: 0.45 }))
        cap.position.y = REFLECTOR.height + 0.02
        group.add(panel, cap)
        for (const end of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, REFLECTOR.height + 0.14, 12), new THREE.MeshStandardMaterial({ color: look.bumperCap, roughness: 0.5 }))
          post.position.set(end * gadget.halfLength, (REFLECTOR.height + 0.14) / 2, 0)
          group.add(post)
        }
        group.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true })
        root.add(group)
        bumpers.set(gadget.id, group)
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
        // やじるし（テクスチャの上むき）を dir の向きに そろえる。
        pad.rotation.set(-Math.PI / 2, 0, Math.atan2(-gadget.dir.x, -gadget.dir.z))
        pad.position.set(gadget.x, ground + 0.006, gadget.z)
        root.add(pad)
        boosters.push(texture)
      }
    }

    // まわりの景色。
    const spinners: THREE.Object3D[] = []
    const wheels: THREE.Object3D[] = []
    const floaters: { object: THREE.Object3D; base: number; phase: number }[] = []
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
      // ひろい ホールでも おくが きりで かすまないように、ホールの 大きさに あわせて とおざける。
      const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ)
      scene.fog = new THREE.Fog(look.horizon, Math.max(38, span * 1.4), Math.max(140, span * 4))
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
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(320, 320, 1, 1), rippleMaterial('#3cb7d4', waves.uniforms))
      sea.rotation.x = -Math.PI / 2
      sea.position.y = SEA_Y
      root.add(sea)
      water = waves
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
    } else if (course.id === 'candy') {
      // クッキーの じめんに、ロリポップ・ドーナツ・カップケーキ。ぜんぶ おかしの 大きさにする。
      const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 48), new THREE.MeshStandardMaterial({ color: look.ground, roughness: 1 }))
      ground.rotation.x = -Math.PI / 2
      ground.position.y = baseY - 0.01
      ground.receiveShadow = true
      root.add(ground)
      const sweets = ['#ff7fb0', '#7fe3d0', '#ffd66b', '#c9a0ff', '#fffdf6']
      // チョコスプレー。
      for (let i = 0; i < 140; i++) {
        const x = cx + (hash(i + 210) - 0.5) * 26
        const z = cz + (hash(i + 410) - 0.5) * 28
        if (!clear(x, z, 0.7)) continue
        solid.add('box', sweets[i % sweets.length]!, x, baseY + 0.05, z, 0.32, 0.08, 0.12, 0, hash(i + 3) * Math.PI, 0)
      }
      // ロリポップ。
      for (let i = 0; i < 28; i++) {
        const angle = hash(i + 61) * Math.PI * 2
        const distance = 5 + hash(i + 67) * 21
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        const size = 0.8 + hash(i + 71) * 0.7
        if (!clear(x, z, 1.5 + size)) continue
        solid.add('cylinder', '#fffdf6', x, baseY + size * 0.95, z, 0.14, size * 1.9, 0.14)
        solid.add('cylinder', sweets[i % sweets.length]!, x, baseY + size * 2.1, z, size * 1.2, 0.18, size * 1.2, Math.PI / 2, 0, 0)
        solid.add('cylinder', '#fffdf6', x, baseY + size * 2.1, z, size * 0.5, 0.2, size * 0.5, Math.PI / 2, 0, 0)
      }
      // ドーナツ。ねかせて じめんに ならべる。
      for (let i = 0; i < 14; i++) {
        const angle = hash(i + 131) * Math.PI * 2
        const distance = 7 + hash(i + 137) * 17
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        if (!clear(x, z, 2.4)) continue
        solid.add('torus', i % 2 ? '#ff9ec4' : '#b5744a', x, baseY + 0.42, z, 1.8, 1.8, 1.8, -Math.PI / 2, 0, 0)
      }
      // カップケーキ。
      for (let i = 0; i < 12; i++) {
        const angle = hash(i + 181) * Math.PI * 2
        const distance = 6 + hash(i + 187) * 16
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        if (!clear(x, z, 2.0)) continue
        solid.add('cylinder', i % 2 ? '#f2b56b' : '#e08bb4', x, baseY + 0.55, z, 1.5, 1.1, 1.5)
        solid.add('sphere', '#fff6ea', x, baseY + 1.35, z, 1.6, 1.3, 1.6)
        solid.add('sphere', '#ff5f6d', x, baseY + 2.0, z, 0.4, 0.4, 0.4)
      }
      // コースの そばの 大きな ケーキと、キャンディの つえ。
      const kx = bounds.maxX + 4.2
      const kz = bounds.maxZ - 1.6
      solid.add('cylinder', '#fff1dc', kx, baseY + 0.9, kz, 5.0, 1.8, 5.0)
      solid.add('cylinder', '#ffc0d8', kx, baseY + 2.2, kz, 4.2, 1.0, 4.2)
      solid.add('cylinder', '#fff1dc', kx, baseY + 3.0, kz, 3.4, 0.8, 3.4)
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2
        solid.add('cylinder', '#ff5f9e', kx + Math.cos(angle) * 1.1, baseY + 3.8, kz + Math.sin(angle) * 1.1, 0.16, 0.9, 0.16)
        solid.add('sphere', '#ffd66b', kx + Math.cos(angle) * 1.1, baseY + 4.35, kz + Math.sin(angle) * 1.1, 0.24, 0.3, 0.24)
      }
      const sx = bounds.minX - 3.6
      const sz = bounds.minZ + 2.2
      for (let k = 0; k < 7; k++) solid.add('cylinder', k % 2 ? '#ffffff' : '#ff5f9e', sx, baseY + 0.4 + k * 0.8, sz, 0.55, 0.8, 0.55)
      for (let k = 0; k < 4; k++) solid.add('sphere', k % 2 ? '#ffffff' : '#ff5f9e', sx + 0.35 + k * 0.42, baseY + 6.1 + Math.cos(k * 0.7) * 0.35, sz, 0.55, 0.55, 0.55)
      // とおくの クリームの おか。
      for (const [x, z, size] of [[-36, -26, 11], [18, -44, 13], [42, 14, 9]] as const) {
        soft.add('sphere', '#fff0dd', cx + x, baseY, cz + z, size * 2.4, size, size * 2)
      }
    } else if (course.id === 'dino') {
      // あかつちの じめんに、しだの木・いわ・かざん。コースの そばに 大きな きょうりゅう。
      const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 48), new THREE.MeshStandardMaterial({ color: look.ground, roughness: 1 }))
      ground.rotation.x = -Math.PI / 2
      ground.position.y = baseY - 0.01
      ground.receiveShadow = true
      root.add(ground)
      // しだの木。ボールの うしろからの ながめを ふさがないよう、コースから はなして 立てる。
      for (let i = 0; i < 34; i++) {
        const angle = hash(i + 21) * Math.PI * 2
        const distance = 7 + hash(i + 23) * 21
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        const size = 0.8 + hash(i + 29) * 0.7
        if (!clear(x, z, 3.2 + size * 1.6)) continue
        for (let k = 0; k < 2; k++) solid.add('cylinder', '#8a6247', x, baseY + size * (0.45 + k * 0.85), z, 0.26 * size, size * 0.9, 0.26 * size)
        for (let k = 0; k < 5; k++) {
          const leaf = (k / 5) * Math.PI * 2
          solid.add('cone', k % 2 ? '#3f8a4a' : '#579f52', x + Math.cos(leaf) * size * 0.5, baseY + size * 2.0, z + Math.sin(leaf) * size * 0.5, size * 0.5, size * 1.3, size * 0.5, Math.PI / 5.1, leaf, 0)
        }
      }
      // 足もとの しだの かぶ。
      for (let i = 0; i < 36; i++) {
        const x = cx + (hash(i + 331) - 0.5) * 26
        const z = cz + (hash(i + 337) - 0.5) * 28
        if (!clear(x, z, 1.1)) continue
        soft.add('sphere', i % 2 ? '#4f9a58' : '#69ac5c', x, baseY + 0.06, z, 0.9 + hash(i) * 0.7, 0.5, 0.9 + hash(i + 7) * 0.6)
      }
      // ごろごろした いわと、すの たまご。
      for (let i = 0; i < 44; i++) {
        const x = cx + (hash(i + 511) - 0.5) * 28
        const z = cz + (hash(i + 713) - 0.5) * 30
        const size = 0.5 + hash(i + 17) * 1.3
        if (!clear(x, z, 1.0 + size * 0.6)) continue
        solid.add('rock', i % 3 ? look.rock : '#8d6a58', x, baseY + size * 0.25, z, size * 1.6, size * 1.2, size * 1.5, hash(i) * 0.6, hash(i + 5) * 3, hash(i + 9) * 0.5)
      }
      for (let i = 0; i < 5; i++) {
        const angle = hash(i + 301) * Math.PI * 2
        const distance = 7 + hash(i + 307) * 12
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        if (!clear(x, z, 2.2)) continue
        solid.add('torus', '#9a7a4a', x, baseY + 0.24, z, 2.2, 2.2, 2.2, -Math.PI / 2, 0, 0)
        for (let k = 0; k < 3; k++) solid.add('sphere', '#f2e3c4', x + Math.cos(k * 2.1) * 0.5, baseY + 0.45, z + Math.sin(k * 2.1) * 0.5, 0.7, 0.9, 0.7)
      }
      // とおくの かざん。てっぺんから けむりが 立ちのぼる。
      const vx = cx - 34
      const vz = cz - 38
      solid.add('cone', '#8a5a42', vx, baseY + 7, vz, 34, 14, 34)
      solid.add('cone', '#ff7a3d', vx, baseY + 14.4, vz, 5.4, 1.6, 5.4)
      for (let k = 0; k < 5; k++) soft.add('sphere', '#d8cec6', vx + k * 1.6, baseY + 16 + k * 3.2, vz + k * 1.2, 4 + k, 3 + k * 0.8, 4 + k)
      for (const [x, z, size] of [[30, -40, 12], [44, 10, 10], [-18, 34, 9]] as const) {
        soft.add('sphere', '#a9784f', cx + x, baseY, cz + z, size * 2.4, size, size * 2)
      }
      // くびの ながい きょうりゅう。コースの となりで こちらを 見ている。
      const dx = bounds.maxX + 5.4
      const dz = cz + 1.2
      const hide = '#6fb07f'
      solid.add('sphere', hide, dx, baseY + 2.3, dz, 3.6, 2.5, 2.4)
      for (let k = 0; k < 4; k++) solid.add('cylinder', hide, dx - 1.5 - k * 0.5, baseY + 3.4 + k * 0.9, dz, 0.78 - k * 0.09, 1.2, 0.78 - k * 0.09, 0, 0, 0.44)
      solid.add('sphere', hide, dx - 3.7, baseY + 6.7, dz, 1.0, 0.85, 0.95)
      for (const side of [-1, 1]) solid.add('sphere', '#2f2a33', dx - 4.0, baseY + 6.9, dz + side * 0.36, 0.14, 0.14, 0.14)
      solid.add('cone', hide, dx + 3.1, baseY + 2.6, dz, 1.0, 3.8, 1.0, 0, 0, -Math.PI / 2.4)
      for (const front of [-1, 1]) for (const side of [-1, 1]) solid.add('cylinder', hide, dx + front * 1.2, baseY + 0.9, dz + side * 0.9, 0.62, 1.9, 0.62)
    } else if (course.id === 'forest') {
      // ふかい もり。コースは ひろいので、まわりの きも コースの大きさに あわせて まく。
      const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 48), new THREE.MeshStandardMaterial({ color: look.ground, roughness: 1 }))
      ground.rotation.x = -Math.PI / 2
      ground.position.y = baseY - 0.01
      ground.receiveShadow = true
      root.add(ground)
      const width = bounds.maxX - bounds.minX
      const depth = bounds.maxZ - bounds.minZ
      const leaves = ['#2f7a4a', '#3f9153', '#4f9f52', '#63b25c', '#2b6b42']
      for (let i = 0; i < 170; i++) {
        const x = cx + (hash(i * 1.7 + 3) - 0.5) * (width + 44)
        const z = cz + (hash(i * 2.9 + 11) - 0.5) * (depth + 44)
        const size = 0.9 + hash(i + 13) * 1.2
        if (!clear(x, z, 1.6 + size)) continue
        solid.add('cylinder', '#7c5334', x, baseY + size * 0.55, z, 0.26 * size, size * 1.1, 0.26 * size)
        if (i % 3) {
          for (let k = 0; k < 3; k++) solid.add('cone', leaves[(i + k) % leaves.length]!, x, baseY + size * (1.25 + k * 0.6), z, size * (2.2 - k * 0.52), size * 1.2, size * (2.2 - k * 0.52))
        } else {
          solid.add('sphere', leaves[i % leaves.length]!, x, baseY + size * 1.6, z, size * 2.5, size * 2.1, size * 2.5)
          solid.add('sphere', leaves[(i + 2) % leaves.length]!, x + size * 0.5, baseY + size * 2.2, z - size * 0.4, size * 1.6, size * 1.4, size * 1.6)
        }
      }
      // したくさ と きのこ。
      for (let i = 0; i < 96; i++) {
        const x = cx + (hash(i * 3.3 + 21) - 0.5) * (width + 24)
        const z = cz + (hash(i * 4.1 + 31) - 0.5) * (depth + 24)
        if (!clear(x, z, 1.0)) continue
        if (i % 4) soft.add('sphere', i % 2 ? '#3f8a4a' : '#57a457', x, baseY + 0.06, z, 0.9 + hash(i) * 0.8, 0.45, 0.9 + hash(i + 5) * 0.7)
        else {
          solid.add('cylinder', '#fff3e0', x, baseY + 0.14, z, 0.14, 0.28, 0.14)
          solid.add('sphere', '#d9573f', x, baseY + 0.3, z, 0.42, 0.3, 0.42)
        }
      }
      // きりかぶ と たおれた まるた。
      for (let i = 0; i < 14; i++) {
        const x = cx + (hash(i * 5.7 + 41) - 0.5) * (width + 18)
        const z = cz + (hash(i * 6.3 + 53) - 0.5) * (depth + 18)
        if (!clear(x, z, 1.8)) continue
        if (i % 2) solid.add('cylinder', '#8a6247', x, baseY + 0.22, z, 0.9, 0.44, 0.9)
        else solid.add('cylinder', '#7c5334', x, baseY + 0.26, z, 0.5, 2.6, 0.5, Math.PI / 2, hash(i) * 3, 0)
      }
      // もりの おくの おか。
      for (const [x, z, size] of [[-38, -24, 12], [16, -46, 14], [42, 16, 10], [-30, 34, 11]] as const) {
        soft.add('sphere', '#3f7a4a', cx + x, baseY, cz + z, size * 2.4, size, size * 2)
      }
    } else if (course.id === 'downhill') {
      // 高台の コース。いちばん低い だんの下に じめんを 置いて、うしろは おかが つづいて見えるようにする。
      const groundY = Math.min(baseY, bounds.minY) - 0.01
      const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 48), new THREE.MeshStandardMaterial({ color: look.ground, roughness: 1 }))
      ground.rotation.x = -Math.PI / 2
      ground.position.y = groundY
      ground.receiveShadow = true
      root.add(ground)
      const width = bounds.maxX - bounds.minX
      const depth = bounds.maxZ - bounds.minZ
      // コースの うしろ（ティーがわ）に つづく おか。台が ういて見えないようにする。
      soft.add('sphere', '#79b56a', cx, groundY, cz + depth / 2 + 7, width + 24, (bounds.maxY - groundY) * 2.1, 18)
      for (const [x, z, size] of [[-26, 22, 11], [28, 26, 9], [34, -12, 8], [-34, -16, 9]] as const) {
        soft.add('sphere', '#82bf6d', cx + x, groundY, cz + z, size * 2.4, size, size * 2)
      }
      // とおくの ゆきの やま。
      for (const [x, z, size] of [[-30, 46, 17], [22, 54, 13]] as const) {
        solid.add('cone', '#8b9bb0', cx + x, groundY + size * 0.5, cz + z, size * 3, size, size * 3)
        solid.add('cone', '#ffffff', cx + x, groundY + size * 0.86, cz + z, size * 0.92, size * 0.3, size * 0.92)
      }
      // まきばの き と いわ、ほしくさの ロール。
      for (let i = 0; i < 70; i++) {
        const x = cx + (hash(i * 2.1 + 17) - 0.5) * (width + 40)
        const z = cz + (hash(i * 3.7 + 23) - 0.5) * (depth + 40)
        const size = 0.8 + hash(i + 29) * 1.0
        if (!clear(x, z, 1.6 + size)) continue
        if (i % 5 === 0) {
          solid.add('cylinder', '#e0c078', x, groundY + size * 0.6, z, size * 1.4, size * 1.5, size * 1.4, 0, 0, Math.PI / 2)
        } else if (i % 5 === 1) {
          solid.add('rock', look.rock, x, groundY + size * 0.2, z, size * 1.5, size * 1.1, size * 1.4, hash(i) * 0.5, hash(i + 3) * 3, hash(i + 7) * 0.4)
        } else {
          solid.add('cylinder', '#8a6247', x, groundY + size * 0.4, z, 0.24 * size, size * 0.8, 0.24 * size)
          for (let k = 0; k < 3; k++) solid.add('cone', k % 2 ? '#3f8a52' : '#57a45c', x, groundY + size * (1.0 + k * 0.55), z, size * (1.9 - k * 0.45), size * 1.1, size * (1.9 - k * 0.45))
        }
      }
      // ふもとの はらっぱの ちいさな おうち。
      const hx = bounds.maxX + 5.4
      const hz = bounds.minZ + 2.2
      solid.add('box', '#fff1d6', hx, groundY + 0.8, hz, 2.4, 1.6, 2.0)
      solid.add('pyramid', '#d9573f', hx, groundY + 2.1, hz, 3.1, 1.0, 2.9, 0, Math.PI / 4)
      solid.add('box', '#8a5a3c', hx - 1.21, groundY + 0.55, hz, 0.05, 1.0, 0.5)
    } else if (course.id === 'river') {
      // かわべの はらっぱ。コースの おくを 大きな かわが ながれ、きしに すいしゃごやが 立つ。
      const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 48), new THREE.MeshStandardMaterial({ color: look.ground, roughness: 1 }))
      ground.rotation.x = -Math.PI / 2
      ground.position.y = baseY - 0.01
      ground.receiveShadow = true
      root.add(ground)
      const width = bounds.maxX - bounds.minX
      const depth = bounds.maxZ - bounds.minZ
      const riverZ = bounds.minZ - 9
      const bigRiver = new THREE.Mesh(new THREE.PlaneGeometry(200, 9, 1, 1), rippleMaterial('#4ab4df', waves.uniforms))
      bigRiver.rotation.x = -Math.PI / 2
      bigRiver.position.set(cx, baseY, riverZ)
      root.add(bigRiver)
      water = waves
      for (const side of [-1, 1]) solid.add('box', '#d9c48f', cx, baseY - 0.004, riverZ + side * 4.7, 200, 0.02, 0.6)
      const greens = ['#4f9d5b', '#62aa62', '#7cb867', '#3f8a5a']
      for (let i = 0; i < 120; i++) {
        const x = cx + (hash(i * 1.9 + 7) - 0.5) * (width + 46)
        const z = cz + (hash(i * 2.7 + 13) - 0.5) * (depth + 40)
        const size = 0.8 + hash(i + 19) * 0.9
        if (!clear(x, z, 1.8 + size) || Math.abs(z - riverZ) < 6 + size) continue
        solid.add('cylinder', '#8a6247', x, baseY + size * 0.45, z, 0.22 * size, size * 0.9, 0.22 * size)
        if (i % 3) solid.add('sphere', greens[i % greens.length]!, x, baseY + size * 1.35, z, size * 1.6, size * 1.5, size * 1.6)
        else solid.add('cone', greens[i % greens.length]!, x, baseY + size * 1.5, z, size * 1.3, size * 2, size * 1.3)
      }
      // かわぞいの あしと、はなばたけ。
      for (let i = 0; i < 90; i++) {
        const x = cx + (hash(i + 1300) - 0.5) * (width + 30)
        const side = hash(i + 1400) < 0.5 ? -1 : 1
        const z = riverZ + side * (4.9 + hash(i + 1500) * 0.8)
        soft.add('cone', i % 2 ? '#4f8f3f' : '#6aa84a', x, baseY + 0.3, z, 0.12, 0.7, 0.12)
      }
      for (let i = 0; i < 110; i++) {
        const x = cx + (hash(i + 1600) - 0.5) * (width + 20)
        const z = cz + (hash(i + 1700) - 0.5) * (depth + 16)
        if (!clear(x, z, 0.7) || Math.abs(z - riverZ) < 5.6) continue
        solid.add('sphere', ['#ffe28a', '#ffffff', '#ff9eb5', '#9fd0ff'][i % 4]!, x, baseY + 0.12, z, 0.18, 0.16, 0.18)
      }
      // すいしゃごや。まわる すいしゃは、ほかの まわる けしきと いっしょに うごかす。
      const mx = bounds.maxX + 4.5
      const mz = riverZ + 5.6
      solid.add('box', '#fff1d6', mx, baseY + 1.0, mz, 2.6, 2.0, 2.2)
      solid.add('pyramid', '#b84a3a', mx, baseY + 2.6, mz, 3.4, 1.2, 3.0, 0, Math.PI / 4)
      const wheel = new THREE.Group()
      wheel.position.set(mx - 1.6, baseY + 0.9, mz - 1.3)
      const wood = new THREE.MeshStandardMaterial({ color: '#8d6242', roughness: 0.8 })
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.08, 8, 24), wood)
      rim.rotation.y = Math.PI / 2
      wheel.add(rim)
      for (let k = 0; k < 8; k++) {
        const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 1.1), wood)
        const angle = (k / 8) * Math.PI * 2
        paddle.position.set(0, Math.sin(angle) * 1.05, Math.cos(angle) * 1.05)
        paddle.rotation.x = -angle
        wheel.add(paddle)
      }
      root.add(wheel)
      wheels.push(wheel)
      for (const [x, z, size] of [[-40, 20, 12], [42, 16, 10], [-30, -50, 14], [30, -56, 12]] as const) {
        soft.add('sphere', '#86bf6c', cx + x, baseY, cz + z, size * 2.4, size, size * 2)
      }
    } else if (course.id === 'canyon') {
      // たにまの コース。コースは たかい いわの だいの上にあり、ふかい たにの そこを かわが ながれる。
      const groundY = baseY - 7
      const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 48), new THREE.MeshStandardMaterial({ color: look.ground, roughness: 1 }))
      ground.rotation.x = -Math.PI / 2
      ground.position.y = groundY
      ground.receiveShadow = true
      root.add(ground)
      // コースの ゆかを そのまま 下へ のばした いわの だい。しまもようは たかさで ぬりわける。
      const strata = ['#c07448', '#a95d38', '#d08a55', '#b8683f'].map(value => new THREE.Color(value))
      const ropeBridges = (definition.gadgets ?? []).flatMap(gadget => (gadget.kind === 'bridge' && !gadget.rails ? [gadget] : []))
      for (const outline of outlines) {
        // つりばしの ゆかは いわに しない（たにの 上に かかって見えるように）。
        const spansGap = ropeBridges.some(bridge => outline.points.every(point => Math.abs(point.x - bridge.x) <= bridge.halfWidth + 0.3 && Math.abs(point.z - bridge.z) <= bridge.halfLength + 0.3))
        if (spansGap) continue
        let low = outline.base
        for (const point of outline.points) low = Math.min(low, geometry.heightAt(point.x, point.z) ?? low)
        const top = low - PLATFORM_DEPTH + 0.02
        const shape = new THREE.Shape(outline.points.map(point => new THREE.Vector2(point.x, point.z)))
        const cliff = new THREE.ExtrudeGeometry(shape, { depth: top - groundY, bevelEnabled: false, curveSegments: 1, steps: 6 })
        cliff.rotateX(Math.PI / 2)
        cliff.translate(0, top, 0)
        const position = cliff.getAttribute('position')
        const colors = new Float32Array(position.count * 3)
        for (let i = 0; i < position.count; i++) {
          const band = strata[Math.floor((top - position.getY(i)) / 1.1 + hash(Math.round(position.getX(i) * 2)) * 0.6) % strata.length]!
          colors.set([band.r, band.g, band.b], i * 3)
        }
        cliff.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        const mesh = new THREE.Mesh(cliff, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }))
        mesh.castShadow = mesh.receiveShadow = true
        root.add(mesh)
      }
      // たにの そこの かわ。
      const width = bounds.maxX - bounds.minX
      const depth = bounds.maxZ - bounds.minZ
      const valley = new THREE.Mesh(new THREE.PlaneGeometry(7, 200, 1, 1), rippleMaterial('#3f9fcf', waves.uniforms))
      valley.rotation.x = -Math.PI / 2
      valley.position.set(cx + 1, groundY + 0.02, cz)
      root.add(valley)
      water = waves
      // とおくの テーブルの ような いわやま と、サボテン と いわ。
      for (let i = 0; i < 16; i++) {
        const angle = hash(i + 2100) * Math.PI * 2
        const distance = Math.max(width, depth) / 2 + 14 + hash(i + 2110) * 30
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        const size = 4 + hash(i + 2120) * 6
        const height = 5 + hash(i + 2130) * 9
        solid.add('cylinder', strata[i % strata.length]!.getStyle(), x, groundY + height / 2, z, size * 2, height, size * 1.6)
        solid.add('cylinder', '#e0a070', x, groundY + height + 0.2, z, size * 2.05, 0.4, size * 1.65)
      }
      for (let i = 0; i < 60; i++) {
        const x = cx + (hash(i * 2.3 + 2200) - 0.5) * (width + 40)
        const z = cz + (hash(i * 3.1 + 2300) - 0.5) * (depth + 40)
        if (!clear(x, z, 2.2) || Math.abs(x - cx - 1) < 4.5) continue
        if (i % 3) {
          solid.add('rock', i % 2 ? look.rock : '#9a6448', x, groundY + 0.3, z, 1.6, 1.0, 1.4, hash(i) * 0.6, hash(i + 5) * 3, 0)
        } else {
          solid.add('cylinder', '#4f9a58', x, groundY + 1.1, z, 0.5, 2.2, 0.5)
          solid.add('cylinder', '#4f9a58', x + 0.45, groundY + 1.3, z, 0.3, 0.9, 0.3)
          solid.add('cylinder', '#4f9a58', x - 0.4, groundY + 1.6, z, 0.28, 0.7, 0.28)
        }
      }
    }
    solid.build(root, true, fade)
    soft.build(root, false, fade)
    root.traverse(child => { if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial && !child.material.transparent) child.receiveShadow = true })

    // 影を落とす範囲をホールの大きさに合わせる。
    const extent = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 2.5
    sun.target.position.set(cx, 0, cz)
    sun.position.set(cx - 7, 14, cz + 6)
    Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: Math.max(45, extent * 2 + 20) })
    sun.shadow.camera.updateProjectionMatrix()
    const moon = course.id === 'moon'
    hemisphere.color.set(moon ? '#b3b8ff' : '#eef8ff')
    hemisphere.groundColor.set(moon ? '#3a3552' : course.id === 'beach' ? '#d8c89a' : course.id === 'candy' ? '#ffdcc0' : course.id === 'dino' ? '#c08a5e' : course.id === 'forest' ? '#4a7a46' : course.id === 'canyon' ? '#c9865a' : '#7fa35a')
    hemisphere.intensity = moon ? 0.9 : 1.05
    sun.color.set(moon ? '#f2f0ff' : '#fff1d6')
    sun.intensity = moon ? 2.1 : 2.4
    scene.environmentIntensity = moon ? 0.3 : 0.38
    scene.add(root)
    return { root, heightAt: geometry.heightAt, cupY: cup.y, flag, flagBase, cloth, blades, seeThrough, gates, critters, snow, bumpers, boosters, water, spinners, wheels, floaters }
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
    /** reach は「カメラからボールまでの距離」。0 にすると 景色を消さない（ぜんたい表示など）。 */
    setCamera(pose: CameraPose, reach = 0) {
      camera.position.set(pose.position.x, pose.position.y, pose.position.z)
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z)
      fade.value = reach
      if (!hole) return
      // カメラから ボールへの 見通しを さえぎる ふうしゃだけ 透かす。
      const eye = camera.position
      const toBall = ball.position.clone().sub(eye)
      const distance = toBall.length()
      const ray = new THREE.Ray(eye.clone(), toBall.normalize())
      for (const item of hole.seeThrough) {
        const hit = reach > 0 && distance > 1e-3 ? ray.intersectBox(item.box, seeThroughHit) : null
        item.goal = hit && hit.distanceTo(eye) < distance - BALL_RADIUS ? SEE_THROUGH_KEEP : 1
      }
    },
    resize,
    render(dt: number, reducedMotion: boolean) {
      clock += dt
      if (hole) {
        for (const item of hole.seeThrough) item.keep.value = Math.abs(item.goal - item.keep.value) < 0.01 ? item.goal : item.keep.value + (item.goal - item.keep.value) * Math.min(1, dt * 8)
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
          hole.wheels.forEach(object => { object.rotation.x -= dt * 0.8 })
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
