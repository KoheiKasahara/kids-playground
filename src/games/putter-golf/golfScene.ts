/**
 * パターゴルフの見た目（Three.js）。
 * 物理の結果（ボールの位置・ふうしゃの角度・できごと）を受け取って描くだけで、進行も物理も持たない。
 * コースの床・壁・カップは golfGeometry が作った物理と同じ三角形をそのまま使う。
 * くり返す景色は形ごとの InstancedMesh にまとめ、景色が増えても描画回数が増えないようにしている。
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { CAMERA_FOV, type CameraPose } from './golfCamera'
import { GOLF_BALLS, type CourseDefinition, type CourseId, type CritterLook, type GolfBallId, type HoleDefinition, type Vec2, type WaterHazard } from './golfCourses'
import { clipToCell, insideOutline, signedArea, type HoleGeometry, type MeshBuffers } from './golfGeometry'
import { BALL_RADIUS, BOOSTER, BRIDGE, BUMPER_HEIGHT, CRITTER, GATE, PLATFORM_DEPTH, REFLECTOR, TREE, WALL_HEIGHT, WARP, WINDMILL, type Vec3 } from './golfPhysics'
import { createTerrainHeight, createWaterDepth, layeredNoise, waterInside, type TerrainStyle } from './golfTerrain'
import { createGolfTextures, type GolfTextures } from './golfTextures'
import type { GadgetMotion } from './golfWorld'

export type EffectKind = 'splash' | 'dust' | 'confetti' | 'fireworks' | 'sparkle' | 'ring'
export type AimView = { ball: Vec3; direction: Vec2; power: number; path: readonly Vec3[] }
type Quat = { x: number; y: number; z: number; w: number }
type Shape = 'box' | 'sphere' | 'cone' | 'pyramid' | 'cylinder' | 'rock' | 'torus' | 'blob' | 'trunk' | 'blade'

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
const SEA_Y = -0.62
/** ボールより FADE_MARGIN 手前から 景色を消しはじめ、FADE_DEPTH 手前より カメラ側は すっかり消す。 */
const FADE_MARGIN = 0.8
const FADE_DEPTH = 2.6

/** keep に入れた もよう（ホールを こえて 使いまわす もの）は 捨てない。 */
function disposeTree(root: THREE.Object3D, keep?: ReadonlySet<THREE.Texture>) {
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
  textures.forEach(item => { if (!keep?.has(item)) item.dispose() })
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

/**
 * 形の下のほうを暗く、上を明るくする頂点の色を付ける。
 * 光の当たりにくい ねもとや 葉の うらがわが かげになり、景色が ぐっと立体的に見える。
 */
function shadeFromBelow(geometry: THREE.BufferGeometry, low = 0.66): THREE.BufferGeometry {
  const position = geometry.getAttribute('position')
  const colors = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i++) {
    const t = THREE.MathUtils.smoothstep(position.getY(i), -0.5, 0.5)
    colors.fill(low + (1 - low) * t, i * 3, i * 3 + 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

/** 球を でこぼこに ゆがめた 葉の かたまり。同じ点は 同じだけ ずらすので、面に すきまが できない。 */
function lumpy(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const k = 0.86 + hash(Math.round(x * 97) * 3.1 + Math.round(y * 89) * 7.7 + Math.round(z * 83) * 1.3) * 0.28
    // 葉の うらは すこし ひらたく。
    position.setXYZ(i, x * k, (y < 0 ? y * 0.78 : y) * k, z * k)
  }
  geometry.computeVertexNormals()
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
    build(parent: THREE.Object3D, shadows: boolean, fade: { value: number }) {
      const shapes: Record<Shape, () => THREE.BufferGeometry> = {
        box: () => new THREE.BoxGeometry(1, 1, 1),
        sphere: () => new THREE.IcosahedronGeometry(0.5, 1),
        cone: () => new THREE.ConeGeometry(0.5, 1, 8),
        pyramid: () => new THREE.ConeGeometry(0.5, 1, 4),
        cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
        rock: () => new THREE.DodecahedronGeometry(0.5, 0),
        torus: () => new THREE.TorusGeometry(0.5, 0.12, 6, 20),
        blob: () => lumpy(new THREE.IcosahedronGeometry(0.5, 1)),
        trunk: () => new THREE.CylinderGeometry(0.34, 0.5, 1, 7),
        blade: () => new THREE.ConeGeometry(0.5, 1, 3, 1, true),
      }
      // 景色は 数が 多いので、光の 計算が かるい Lambert で えがく。
      const material = new THREE.MeshLambertMaterial({ flatShading: true, vertexColors: true })
      fadeInFront(material, fade)
      for (const [shape, item] of items) {
        const mesh = new THREE.InstancedMesh(shadeFromBelow(shapes[shape](), shape === 'blade' ? 0.45 : 0.66), material, item.matrices.length)
        item.matrices.forEach((matrix, index) => { mesh.setMatrixAt(index, matrix); mesh.setColorAt(index, item.colors[index]!) })
        mesh.castShadow = shadows
        mesh.receiveShadow = true
        mesh.computeBoundingSphere()
        parent.add(mesh)
      }
    },
  }
}

type Batch = ReturnType<typeof createBatch>
const LEAVES = ['#3f8f4a', '#4f9f52', '#5caa55', '#6ab85e'] as const
const NEEDLES = ['#2b6e45', '#347c4c', '#3f8a52'] as const

/** まるい 葉の き。みきの 上に、でこぼこの 葉の かたまりを 4つ かさねる。 */
function broadleafTree(batch: Batch, x: number, y: number, z: number, size: number, seed: number, leaves: readonly string[] = LEAVES) {
  batch.add('trunk', '#7c5334', x, y + size * 0.6, z, size * 0.3, size * 1.2, size * 0.3, 0, hash(seed) * 3, 0)
  const turn = hash(seed + 1) * Math.PI * 2
  batch.add('blob', leaves[seed % leaves.length]!, x, y + size * 1.65, z, size * 1.9, size * 1.55, size * 1.9, 0, turn, 0)
  for (let k = 0; k < 3; k++) {
    const angle = turn + (k * Math.PI * 2) / 3
    const s = size * (0.95 + hash(seed + k * 5) * 0.3)
    batch.add('blob', leaves[(seed + k + 1) % leaves.length]!, x + Math.cos(angle) * size * 0.6, y + size * (1.45 + hash(seed + k * 7) * 0.45), z + Math.sin(angle) * size * 0.6, s, s * 0.88, s, 0, angle * 2, 0)
  }
}

/** とがった もみの木。上へ いくほど 小さくなる 4だんの 葉。snow なら てっぺんに ゆき。 */
function pineTree(batch: Batch, x: number, y: number, z: number, size: number, seed: number, snow = false) {
  batch.add('trunk', '#7a5234', x, y + size * 0.4, z, size * 0.24, size * 0.8, size * 0.24)
  for (let k = 0; k < 4; k++) {
    const width = size * (1.85 - k * 0.4)
    const color = snow && k === 3 ? '#eef6ff' : NEEDLES[(seed + k) % NEEDLES.length]!
    batch.add('cone', color, x, y + size * (0.95 + k * 0.52), z, width, size * 0.95, width, 0, hash(seed + k) * Math.PI, 0)
  }
}

/** 草の かぶ。ほそい はを 3まい、すこし かたむけて 立てる。 */
function grassTuft(batch: Batch, x: number, y: number, z: number, height: number, color: THREE.Color, seed: number) {
  for (let k = 0; k < 3; k++) {
    const angle = hash(seed + k * 3) * Math.PI * 2
    const lean = 0.15 + hash(seed + k * 5) * 0.3
    const h = height * (0.7 + hash(seed + k * 7) * 0.5)
    const tone = color.clone().offsetHSL(0, 0, (hash(seed + k * 11) - 0.5) * 0.12)
    batch.add('blade', tone.getStyle(), x + Math.cos(angle) * 0.03, y + h * 0.45, z + Math.sin(angle) * 0.03, 0.045, h, 0.045, Math.cos(angle) * lean, 0, Math.sin(angle) * lean)
  }
}

/** さざなみの ゆれる みず。うみ・いけ・かわで 同じ しくみを使い、time を進めると 波が動く。 */
function rippleMaterial(color: string, uniforms: { uTime: { value: number } }, vertexColors = false): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0.05, vertexColors })
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

function segmentGap(x: number, z: number, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)))
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t))
}

/** 上を向いた面に、世界の x,z から もようの 座標を付ける。tile m ごとに もようが くりかえす。 */
function groundUv(geometry: THREE.BufferGeometry, tile: number) {
  const position = geometry.getAttribute('position')
  const uv = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = position.getX(i) / tile
    uv[i * 2 + 1] = position.getZ(i) / tile
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

/**
 * かべ・台の よこの 四角（4点ずつ）に、もようの 座標と ねもとの かげを付ける。
 * u は かべに そった長さ、v は その四角の 上の はしから 下への 長さなので、いたの すじが かべの 上に そろう。
 * たての 面は 下の点ほど shadow ぶん暗くして、床や じめんとの さかいに かげを 落とす。
 */
function sideFaces(geometry: THREE.BufferGeometry, tile: { u: number; v: number }, shadow: number) {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const uv = new Float32Array(position.count * 2)
  const colors = new Float32Array(position.count * 3).fill(1)
  for (let start = 0; start + 3 < position.count; start += 4) {
    const corners = [0, 1, 2, 3].map(k => ({ x: position.getX(start + k), y: position.getY(start + k), z: position.getZ(start + k) }))
    // golfGeometry の 四角は、はじめの 2点が いつも よこに ならぶ。その向きを かべの 向きにする。
    const [first, second] = corners as [Vec3, Vec3]
    const span = Math.hypot(second.x - first.x, second.z - first.z) || 1
    const along = { x: (second.x - first.x) / span, z: (second.z - first.z) / span }
    const flat = Math.abs(normal.getY(start)) > 0.5
    corners.forEach((point, k) => {
      const i = start + k
      uv[i * 2] = (point.x * along.x + point.z * along.z) / tile.u
      if (flat) { uv[i * 2 + 1] = (point.z * along.x - point.x * along.z) / tile.v; return }
      const top = Math.max(...corners.filter(other => Math.abs(other.x - point.x) + Math.abs(other.z - point.z) < 1e-4).map(other => other.y))
      uv[i * 2 + 1] = (top - point.y) / tile.v
      if (top - point.y > 1e-4) colors.fill(1 - shadow, i * 3, i * 3 + 3)
    })
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

/** 床を くりぬける みずの数（いけ・かわ それぞれ）。 */
const WATER_SLOTS = 8

/**
 * 床の みずの ところを くりぬく。物理の床は そのままで、見た目だけ 下の くぼみと 水面が 見えるようにする。
 * みずの形は golfGeometry の waterAt と同じ（まるい いけと、まっすぐな かわ）。
 */
function cutOutWater(material: THREE.Material, water: readonly WaterHazard[]) {
  const ponds = water.flatMap(item => (item.kind === 'pond' ? [new THREE.Vector3(item.x, item.z, item.radius * item.radius)] : [])).slice(0, WATER_SLOTS)
  // かわは 中心・向き（長さ1）と、半分の長さ・半分の はば で わたす。1がそ ごとの 計算を へらすため。
  const rivers = water.flatMap(item => {
    if (item.kind !== 'river') return []
    const dx = item.to.x - item.from.x
    const dz = item.to.z - item.from.z
    const length = Math.hypot(dx, dz) || 1
    return [{ frame: new THREE.Vector4((item.from.x + item.to.x) / 2, (item.from.z + item.to.z) / 2, dx / length, dz / length), size: new THREE.Vector2(length / 2, item.halfWidth) }]
  }).slice(0, WATER_SLOTS)
  const pad = <T>(list: T[], make: () => T) => [...list, ...Array.from({ length: WATER_SLOTS - list.length }, make)]
  material.onBeforeCompile = shader => {
    shader.uniforms.uPonds = { value: pad(ponds, () => new THREE.Vector3()) }
    shader.uniforms.uPondCount = { value: ponds.length }
    shader.uniforms.uRiverFrame = { value: pad(rivers.map(river => river.frame), () => new THREE.Vector4()) }
    shader.uniforms.uRiverSize = { value: pad(rivers.map(river => river.size), () => new THREE.Vector2()) }
    shader.uniforms.uRiverCount = { value: rivers.length }
    shader.vertexShader = `varying vec2 vGround;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvGround = transformed.xz;')
    shader.fragmentShader = `varying vec2 vGround;
uniform vec3 uPonds[${WATER_SLOTS}];
uniform int uPondCount;
uniform vec4 uRiverFrame[${WATER_SLOTS}];
uniform vec2 uRiverSize[${WATER_SLOTS}];
uniform int uRiverCount;
${shader.fragmentShader}`.replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
      for (int i = 0; i < ${WATER_SLOTS}; i++) {
        if (i >= uPondCount) break;
        vec2 rel = vGround - uPonds[i].xy;
        if (dot(rel, rel) < uPonds[i].z) discard;
      }
      for (int i = 0; i < ${WATER_SLOTS}; i++) {
        if (i >= uRiverCount) break;
        vec2 rel = vGround - uRiverFrame[i].xy;
        vec2 dir = uRiverFrame[i].zw;
        if (abs(dot(rel, dir)) < uRiverSize[i].x && abs(rel.x * dir.y - rel.y * dir.x) < uRiverSize[i].y) discard;
      }`,
    )
  }
  material.customProgramCacheKey = () => 'golf-floor-water-v2'
}

/** 水面は 床より これだけ ひくい。ボールが しずむ ふかさ（usePutterGolfEngine の SINK_DEPTH）より じゅうぶん あさくする。 */
const WATER_DROP = 0.07
/** みずの くぼみの いちばん ふかい ところと、ふちから そこまでの なだらかな はば。 */
const BASIN = { depth: 0.24, bank: 0.42, cell: 0.2 }

/**
 * いけ・かわの くぼみ（そこ）と 水面。床と同じように 外周で マス目を 切りぬくので、
 * くりぬいた床の あなを すきまなく うめ、コースの 外へは はみださない。
 */
function waterBasin(water: readonly WaterHazard[], geometry: HoleGeometry) {
  const outlines = geometry.outlines.map(outline => outline.points)
  const depthAt = createWaterDepth(water, outlines, BASIN.depth, BASIN.bank)
  const lowest = Math.min(...geometry.outlines.map(outline => outline.base))
  // 外周の ちょうど上の点は どの床にも 入らないことがあるので、すこし ずらして さがす。
  const floorAt = (x: number, z: number) => {
    for (const [dx, dz] of [[0, 0], [0.04, 0], [-0.04, 0], [0, 0.04], [0, -0.04], [0.04, 0.04], [-0.04, -0.04], [0.04, -0.04], [-0.04, 0.04]] as const) {
      const height = geometry.heightAt(x + dx, z + dz)
      if (height !== null) return height
    }
    return lowest
  }
  const { cell } = BASIN
  const cells = new Set<string>()
  for (const item of water) {
    const reach = (item.kind === 'pond' ? item.radius : item.halfWidth) + cell * 2
    const xs = item.kind === 'pond' ? [item.x] : [item.from.x, item.to.x]
    const zs = item.kind === 'pond' ? [item.z] : [item.from.z, item.to.z]
    for (let i = Math.floor((Math.min(...xs) - reach) / cell); i <= Math.ceil((Math.max(...xs) + reach) / cell); i++) {
      for (let j = Math.floor((Math.min(...zs) - reach) / cell); j <= Math.ceil((Math.max(...zs) + reach) / cell); j++) {
        if (waterInside(water, (i + 0.5) * cell, (j + 0.5) * cell) > -cell * 1.2) cells.add(`${i}:${j}`)
      }
    }
  }
  const bed = { positions: [] as number[], colors: [] as number[], indices: [] as number[] }
  const surface = { positions: [] as number[], colors: [] as number[] }
  const keys = new Map<string, number>()
  const mud = [new THREE.Color('#a8905e'), new THREE.Color('#6f6546'), new THREE.Color('#3b4a3a')]
  const shallow = new THREE.Color('#7fd8df')
  const deep = new THREE.Color('#2a84c2')
  const color = new THREE.Color()
  const vertex = (x: number, z: number) => {
    const key = `${Math.round(x * 1e4)}:${Math.round(z * 1e4)}`
    const known = keys.get(key)
    if (known !== undefined) return known
    const index = bed.positions.length / 3
    const floor = floorAt(x, z)
    const depth = depthAt(x, z)
    bed.positions.push(x, floor - depth - 0.004, z)
    if (depth < 0.07) color.copy(mud[0]!).lerp(mud[1]!, depth / 0.07)
    else color.copy(mud[1]!).lerp(mud[2]!, THREE.MathUtils.smoothstep(depth, 0.07, BASIN.depth))
    bed.colors.push(color.r, color.g, color.b)
    surface.positions.push(x, floor - WATER_DROP, z)
    color.copy(shallow).lerp(deep, THREE.MathUtils.smoothstep(depth, WATER_DROP, BASIN.depth * 0.95))
    surface.colors.push(color.r, color.g, color.b)
    keys.set(key, index)
    return index
  }
  for (const key of cells) {
    const [i, j] = key.split(':').map(Number) as [number, number]
    for (const points of outlines) {
      const poly = clipToCell(points, i * cell, j * cell, (i + 1) * cell, (j + 1) * cell)
      if (poly.length < 3 || Math.abs(signedArea(poly)) < 1e-7) continue
      const ids = poly.map(point => vertex(point.x, point.z))
      const faces = poly.length === 3 ? [[0, 1, 2]] : THREE.ShapeUtils.triangulateShape(poly.map(point => new THREE.Vector2(point.x, point.z)), [])
      for (const [a, b, c] of faces) {
        const [pa, pb, pc] = [poly[a!]!, poly[b!]!, poly[c!]!]
        // 上から見て 表になる向きにそろえる。
        const up = (pc.x - pa.x) * (pb.z - pa.z) - (pb.x - pa.x) * (pc.z - pa.z)
        if (Math.abs(up) < 1e-12) continue
        if (up > 0) bed.indices.push(ids[a!]!, ids[b!]!, ids[c!]!)
        else bed.indices.push(ids[a!]!, ids[c!]!, ids[b!]!)
      }
    }
  }
  const build = (positions: number[], colors: number[]) => {
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    result.setIndex(bed.indices)
    result.computeVertexNormals()
    return result
  }
  return { bed: build(bed.positions, bed.colors), surface: build(surface.positions, surface.colors), floorAt }
}

/** まわりの じめんの あみ。コースの まわりほど こまかく、とおくほど あらくする。 */
function terrainMesh(center: Vec2, baseY: number, lift: (x: number, z: number) => number, tint: (x: number, z: number, height: number) => THREE.Color, texture: THREE.Texture, detail = 34, flat = false): THREE.Mesh {
  const RADIUS = 150
  const offsets = Array.from({ length: detail + 1 }, (_, k) => RADIUS * Math.pow(k / detail, 1.55))
  const line = [...offsets.slice(1).reverse().map(value => -value), ...offsets]
  const positions: number[] = []
  const colors: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (const dz of line) {
    for (const dx of line) {
      const x = center.x + dx
      const z = center.z + dz
      const height = lift(x, z)
      positions.push(x, baseY + height, z)
      const color = tint(x, z, height)
      colors.push(color.r, color.g, color.b)
      uvs.push(x / 4, z / 4)
    }
  }
  const n = line.length
  for (let row = 0; row < n - 1; row++) {
    for (let column = 0; column < n - 1; column++) {
      const a = row * n + column
      indices.push(a, a + n, a + 1, a + 1, a + n, a + n + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  // とおくまで 広がるので、光の 計算が かるい Lambert で えがく。
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, map: texture, flatShading: flat }))
  mesh.receiveShadow = true
  return mesh
}

/**
 * たにまの がけ。床の 外周から まっすぐ 下へ おろし、下へ いくほど でこぼこに ふくらませる。
 * 上の はしは 外周に ぴったり そろえ、台の 下に かくす。いわの しまと、ふかい ところほど 暗い かげを 付ける。
 */
function cliff(points: readonly Vec2[], top: number, bottom: number, strata: readonly THREE.Color[], texture: THREE.Texture): THREE.Mesh {
  // 外周を 0.6m くらいずつに 切って、なめらかに ふくらませられる 点の 列にする。
  const ring: { x: number; z: number; nx: number; nz: number; s: number }[] = []
  let travelled = 0
  points.forEach((a, index) => {
    const b = points[(index + 1) % points.length]!
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    if (length < 1e-6) return
    const steps = Math.max(1, Math.ceil(length / 0.6))
    for (let k = 0; k < steps; k++) {
      const t = k / steps
      ring.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, nx: (b.z - a.z) / length, nz: -(b.x - a.x) / length, s: travelled + length * t })
    }
    travelled += length
  })
  // 角の点は、となりの辺の 外向きと ならして ななめ外へ むける。
  const normals = ring.map((point, index) => {
    const before = ring[(index - 1 + ring.length) % ring.length]!
    const nx = point.nx + before.nx
    const nz = point.nz + before.nz
    const length = Math.hypot(nx, nz) || 1
    return { x: nx / length, z: nz / length }
  })
  const rows = Math.max(2, Math.ceil((top - bottom) / 0.7))
  const positions: number[] = []
  const colors: number[] = []
  const uvs: number[] = []
  const color = new THREE.Color()
  for (let row = 0; row <= rows; row++) {
    const y = top - ((top - bottom) * row) / rows
    const down = top - y
    ring.forEach((point, index) => {
      const bulge = THREE.MathUtils.smoothstep(down, 0, 1.2) * (0.12 + 0.6 * layeredNoise(point.s * 0.55, y * 0.5)) + THREE.MathUtils.smoothstep(down, 3, 7) * 0.5
      const normal = normals[index]!
      positions.push(point.x + normal.x * bulge, y, point.z + normal.z * bulge)
      color.copy(strata[Math.floor(down / 1.1 + layeredNoise(point.s * 0.3, 5.1) * 0.8) % strata.length]!)
      color.multiplyScalar(1 - 0.38 * THREE.MathUtils.smoothstep(down, 0.5, top - bottom))
      colors.push(color.r, color.g, color.b)
      uvs.push(point.s / 2.5, y / 2.5)
    })
  }
  const n = ring.length
  const indices: number[] = []
  for (let row = 0; row < rows; row++) {
    for (let k = 0; k < n; k++) {
      const a = row * n + k
      const b = row * n + ((k + 1) % n)
      indices.push(a, b, a + n, b, b + n, a + n)
    }
  }
  // 外周の むき（golfGeometry で 面積が 正になる むき）に あわせ、外から 見て 表になるように そろえる。
  const [p0, p1, p2] = [0, 1, n].map(i => ({ x: positions[i * 3]!, y: positions[i * 3 + 1]!, z: positions[i * 3 + 2]! })) as [Vec3, Vec3, Vec3]
  const face = { x: (p1.y - p0.y) * (p2.z - p0.z) - (p1.z - p0.z) * (p2.y - p0.y), z: (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x) }
  if (face.x * normals[0]!.x + face.z * normals[0]!.z < 0) {
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2]!, indices[i + 1]!]
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, map: texture, bumpMap: texture, bumpScale: 2, roughness: 0.95, flatShading: true }))
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}

/** かべの もよう。木の いたの コースと、いわ・こおり・クッキーの コースがある。 */
const WALL_PATTERN: Record<CourseId, keyof GolfTextures> = {
  meadow: 'wood', beach: 'wood', moon: 'rock', snow: 'ice', candy: 'sand', dino: 'rock', forest: 'wood', downhill: 'wood', river: 'wood', canyon: 'rock',
}

/** コースの 床の もよう。芝の コースは 芝、ゆきと 月は こなの ような じめん。 */
const FLOOR_PATTERN: Record<CourseId, keyof GolfTextures> = {
  meadow: 'grass', beach: 'grass', moon: 'powder', snow: 'powder', candy: 'grass', dino: 'grass', forest: 'grass', downhill: 'grass', river: 'grass', canyon: 'grass',
}

/** まわりの じめんの もようと もりあがり。うみべと おつきさまは じめんが ない。 */
const TERRAIN: Partial<Record<CourseId, { pattern: keyof GolfTextures; hills: number }>> = {
  meadow: { pattern: 'grass', hills: 1.3 },
  snow: { pattern: 'powder', hills: 1.2 },
  candy: { pattern: 'powder', hills: 1.0 },
  dino: { pattern: 'sand', hills: 1.5 },
  forest: { pattern: 'grass', hills: 1.0 },
  downhill: { pattern: 'grass', hills: 1.3 },
  river: { pattern: 'grass', hills: 1.1 },
  canyon: { pattern: 'rock', hills: 9 },
}

/**
 * GPU を つかわず ソフトウェアで えがいている かんきょうか（古い たんまつや、GPU が つかえない ブラウザ）。
 * そこでは ななめから 見た もようを くっきりさせる 異方性フィルタが とても おもいので つかわない。
 */
function softwareRenderer(renderer: THREE.WebGLRenderer): boolean {
  const software = /swiftshader|llvmpipe|softpipe|software/i
  const gl = renderer.getContext()
  const name = String(gl.getParameter(gl.RENDERER) ?? '')
  if (software.test(name)) return true
  // 名前を かくす ブラウザ（Chrome など）だけ、くわしい名前を たずねる。
  if (!/webkit webgl/i.test(name)) return false
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  return info ? software.test(String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '')) : false
}

export function createGolfScene(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 0.95
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
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.normalBias = 0.03
  sun.shadow.bias = -0.0004
  scene.add(hemisphere, sun, sun.target)
  // 芝・すな・木の いたなどの もよう。ホールが かわっても 作りなおさない。
  const textures = createGolfTextures(softwareRenderer(renderer) ? 1 : Math.min(8, renderer.capabilities.getMaxAnisotropy()))
  const sharedTextures = new Set<THREE.Texture>(Object.values(textures))

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
    const feltLight = felt.clone().offsetHSL(0, -0.02, 0.05)
    const kickers = (definition.features ?? []).filter(feature => feature.kind === 'kicker')
    const floorColors = new Float32Array(geometry.floor.positions.length)
    const color = new THREE.Color()
    let low = Infinity
    let high = -Infinity
    for (let i = 1; i < geometry.floor.positions.length; i += 3) {
      low = Math.min(low, geometry.floor.positions[i]!)
      high = Math.max(high, geometry.floor.positions[i]!)
    }
    // かべの ねもとと、しかけの まわりは 光が とどきにくい。床を すこし暗くして、かべや しかけが 床から 立っているように見せる。
    const walls = outlines.flatMap(outline => outline.points.flatMap((point, index) => (outline.walled[index] ? [[point, outline.points[(index + 1) % outline.points.length]!] as const] : [])))
    for (const gadget of definition.gadgets ?? []) {
      if (gadget.kind !== 'reflector') continue
      const length = Math.hypot(gadget.dir.x, gadget.dir.z) || 1
      const reach = { x: (gadget.dir.x / length) * gadget.halfLength, z: (gadget.dir.z / length) * gadget.halfLength }
      walls.push([{ x: gadget.x - reach.x, z: gadget.z - reach.z }, { x: gadget.x + reach.x, z: gadget.z + reach.z }] as const)
    }
    const footprints = (definition.gadgets ?? []).flatMap(gadget => {
      if (gadget.kind === 'bumper' || gadget.kind === 'rock' || gadget.kind === 'warp') return [{ x: gadget.x, z: gadget.z, r: gadget.radius * 1.1 }]
      if (gadget.kind === 'tree') return [{ x: gadget.x, z: gadget.z, r: gadget.radius }]
      if (gadget.kind === 'windmill') return [-1, 1].map(side => ({ x: gadget.x + (side * (WINDMILL.outer + WINDMILL.tunnelHalf)) / 2, z: gadget.z, r: WINDMILL.halfDepth * 0.85 }))
      return []
    })
    const occlusion = (x: number, z: number) => {
      let wall = Infinity
      for (const [a, b] of walls) {
        if (x < Math.min(a.x, b.x) - 0.6 || x > Math.max(a.x, b.x) + 0.6 || z < Math.min(a.z, b.z) - 0.6 || z > Math.max(a.z, b.z) + 0.6) continue
        wall = Math.min(wall, segmentGap(x, z, a, b))
      }
      let near = Infinity
      for (const item of footprints) near = Math.min(near, Math.hypot(x - item.x, z - item.z) - item.r)
      return Math.max(0.55, 1 - 0.3 * (1 - THREE.MathUtils.smoothstep(wall, 0, 0.55)) - 0.32 * (1 - THREE.MathUtils.smoothstep(near, 0, 0.4)))
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
      // 芝の ところどころに こい・うすいの むらを 付けて、1まいの 板に 見えないようにする。
      color.offsetHSL(0, 0, THREE.MathUtils.clamp((geometry.floor.positions[i * 3 + 1]! - shadeMid) * shadeScale, -0.09, 0.09) + (layeredNoise(x * 0.45, z * 0.45) - 0.5) * 0.06)
      color.multiplyScalar(occlusion(x, z))
      floorColors.set([color.r, color.g, color.b], i * 3)
    }
    const floorGeometry = bufferGeometry(geometry.floor)
    floorGeometry.setAttribute('color', new THREE.BufferAttribute(floorColors, 3))
    groundUv(floorGeometry, 1.8)
    // 芝の もようを 色と でこぼこの 両方に 使い、ななめから 見ても 芝の すじが 光って見えるようにする。
    const floorPattern = textures[FLOOR_PATTERN[course.id]]
    const floorMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, map: floorPattern, bumpMap: floorPattern, bumpScale: 1.4, roughness: 0.88 })
    if (definition.water?.length) cutOutWater(floorMaterial, definition.water)
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.receiveShadow = true
    // 画面の 多くを しめる 床を さきに かき、うしろに かくれる じめんや 水の そこの 計算を はぶく。
    floor.renderOrder = -2
    root.add(floor)
    // ゆかの ちがう ところ（すなば・こおり・ふかふか）は、床の色ではなく
    // ふちのくっきりした円い面で重ねる（マス目のぼやけを出さない）。
    for (const [zoneIndex, zone] of (definition.zones ?? []).entries()) {
      const zoneColor = new THREE.Color(zone.kind === 'sand' ? look.sand : zone.kind === 'ice' ? look.ice : look.rough)
      // 床の そとに はみだした ところは、まん中へ むかって さいしょに 床が ある 高さに そろえる（かべの 下に かくれる）。
      const zoneHeight = (x: number, z: number) => {
        for (let t = 0; t <= 1; t += 0.125) {
          const height = geometry.heightAt(x + (zone.x - x) * t, z + (zone.z - z) * t)
          if (height !== null) return height
        }
        return 0
      }
      const disc = new THREE.CircleGeometry(zone.radius, 48, 0, Math.PI * 2)
      disc.rotateX(-Math.PI / 2)
      const position = disc.getAttribute('position')
      for (let i = 0; i < position.count; i++) {
        const x = zone.x + position.getX(i)
        const z = zone.z + position.getZ(i)
        position.setXYZ(i, x, zoneHeight(x, z) + 0.006, z)
      }
      disc.computeVertexNormals()
      groundUv(disc, zone.kind === 'rough' ? 1.1 : 1.4)
      const pattern = zone.kind === 'sand' ? textures.sand : zone.kind === 'ice' ? textures.ice : textures.rough
      // こおりは つるつるに光らせ、ふかふかは ざらざらにする。見ただけで すべりそうか わかる。
      const zoneMesh = new THREE.Mesh(disc, new THREE.MeshStandardMaterial({
        color: zoneColor,
        map: pattern,
        bumpMap: zone.kind === 'ice' ? null : pattern,
        bumpScale: zone.kind === 'rough' ? 3 : 1.2,
        roughness: zone.kind === 'ice' ? 0.06 : 1,
        metalness: zone.kind === 'ice' ? 0.2 : 0,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      }))
      zoneMesh.receiveShadow = true
      const rim = new THREE.Mesh(new THREE.RingGeometry(zone.radius - 0.07, zone.radius, 48), new THREE.MeshStandardMaterial({ color: zoneColor.clone().offsetHSL(0, 0, zone.kind === 'ice' ? 0.08 : -0.12), roughness: zone.kind === 'ice' ? 0.2 : 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
      rim.rotation.x = -Math.PI / 2
      rim.position.set(zone.x, zoneHeight(zone.x, zone.z) + 0.008, zone.z)
      root.add(zoneMesh, rim)
      // ふかふかには のびた 草の かぶを びっしり 立てて、ころがりにくそうに見せる。ボールは 草を かきわけて すすむ。
      if (zone.kind === 'rough') {
        const tufts = Math.round(zone.radius * zone.radius * 26)
        const blade = zoneColor.clone().offsetHSL(0, 0.05, 0.05)
        for (let i = 0; i < tufts; i++) {
          const angle = hash(i * 1.7 + zoneIndex * 31 + 17) * Math.PI * 2
          const distance = Math.sqrt(hash(i * 2.3 + zoneIndex * 37 + 29)) * (zone.radius - 0.05)
          const x = zone.x + Math.cos(angle) * distance
          const z = zone.z + Math.sin(angle) * distance
          const ground = geometry.heightAt(x, z)
          if (ground !== null) grassTuft(soft, x, ground, z, 0.13 + hash(i + zoneIndex * 7) * 0.08, blade, i * 13 + zoneIndex * 101)
        }
      }
      // すなばの ふちには、はみだした すなの つぶを すこし。
      if (zone.kind === 'sand') {
        for (let i = 0; i < Math.round(zone.radius * 14); i++) {
          const angle = hash(i * 3.1 + zoneIndex * 19) * Math.PI * 2
          const distance = zone.radius + 0.02 + hash(i * 5.3 + zoneIndex) * 0.08
          const x = zone.x + Math.cos(angle) * distance
          const z = zone.z + Math.sin(angle) * distance
          const ground = geometry.heightAt(x, z)
          if (ground !== null) solid.add('sphere', zoneColor.getStyle(), x, ground + 0.004, z, 0.05, 0.018, 0.05)
        }
      }
    }
    // いけと かわ。床を みずの形に くりぬき、なだらかな くぼみの 中に 床より ひくい 水面を はる。
    // 物理の床は そのままなので、ころがり方は かわらない。ふちには すなと こいしの きしを 付ける。
    const waves = { uniforms: { uTime: { value: 0 } } }
    let water: HoleContent['water'] = null
    const hazards = definition.water ?? []
    if (hazards.length) {
      const basin = waterBasin(hazards, geometry)
      const bed = new THREE.Mesh(basin.bed, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
      bed.receiveShadow = true
      const surface = new THREE.Mesh(basin.surface, rippleMaterial('#ffffff', waves.uniforms, true))
      surface.receiveShadow = true
      surface.renderOrder = -1
      root.add(bed, surface)
      water = waves
      const onFloor = (x: number, z: number) => (geometry.heightAt(x, z) ?? basin.floorAt(x, z)) + 0.004
      const onWater = (x: number, z: number) => basin.floorAt(x, z) - WATER_DROP + 0.006
      const bridges = (definition.gadgets ?? []).flatMap(gadget => (gadget.kind === 'bridge' ? [gadget] : []))
      const pebble = (x: number, z: number, seed: number) => {
        // はしの いたから つきでないよう、はしの 下には 置かない。
        if (bridges.some(bridge => {
          const length = Math.hypot(bridge.dir.x, bridge.dir.z) || 1
          const along = ((x - bridge.x) * bridge.dir.x + (z - bridge.z) * bridge.dir.z) / length
          const side = ((x - bridge.x) * bridge.dir.z - (z - bridge.z) * bridge.dir.x) / length
          return Math.abs(along) <= bridge.halfLength + 0.1 && Math.abs(side) <= bridge.halfWidth + 0.2
        })) return
        const size = 0.1 + hash(seed) * 0.1
        solid.add('rock', ['#b8b2a6', '#9d978b', '#c9c1b0', '#8c8a80'][seed % 4]!, x, onFloor(x, z) + 0.004, z, size, 0.04 + hash(seed + 3) * 0.03, size * (0.7 + hash(seed + 5) * 0.4), 0, hash(seed + 7) * 3, 0)
      }
      for (const [index, hazard] of hazards.entries()) {
        if (hazard.kind === 'pond') {
          const y = onFloor(hazard.x, hazard.z)
          const bank = new THREE.Mesh(new THREE.RingGeometry(hazard.radius, hazard.radius + 0.16, 64), new THREE.MeshStandardMaterial({ color: '#d9c48f', map: textures.sand, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
          bank.rotation.x = -Math.PI / 2
          bank.position.set(hazard.x, y - 0.002, hazard.z)
          groundUv(bank.geometry, 1.4)
          root.add(bank)
          // ふちの こいし。
          const stones = Math.round((hazard.radius * Math.PI * 2) / 0.32)
          for (let k = 0; k < stones; k++) {
            const angle = ((k + hash(index * 17 + k) * 0.6) / stones) * Math.PI * 2
            const reach = hazard.radius + 0.07 + hash(index * 23 + k) * 0.05
            pebble(hazard.x + Math.cos(angle) * reach, hazard.z + Math.sin(angle) * reach, index * 41 + k)
          }
          // はすの は と はな。
          for (let k = 0; k < 5; k++) {
            const angle = hash(index * 7 + k) * Math.PI * 2
            const reach = hazard.radius * (0.3 + hash(index * 11 + k) * 0.4)
            const x = hazard.x + Math.cos(angle) * reach
            const z = hazard.z + Math.sin(angle) * reach
            const size = 0.34 + hash(index * 5 + k) * 0.16
            solid.add('cylinder', k % 2 ? '#4f9f45' : '#62b252', x, onWater(x, z), z, size, 0.015, size)
            if (k % 2 === 0) {
              solid.add('sphere', '#ffb3cf', x + 0.05, onWater(x, z) + 0.04, z, 0.12, 0.08, 0.12)
              solid.add('sphere', '#fff1a8', x + 0.05, onWater(x, z) + 0.07, z, 0.04, 0.04, 0.04)
            }
          }
          // ふちの あしと がま。
          for (let k = 0; k < 9; k++) {
            const angle = hash(index * 13 + k + 40) * Math.PI * 2
            const x = hazard.x + Math.cos(angle) * (hazard.radius + 0.1)
            const z = hazard.z + Math.sin(angle) * (hazard.radius + 0.1)
            const height = 0.4 + hash(index * 3 + k) * 0.25
            soft.add('cone', k % 2 ? '#4f8f3f' : '#6aa84a', x, onFloor(x, z) + height / 2, z, 0.06, height, 0.06)
            if (k % 3 === 0) solid.add('sphere', '#7a4f2c', x, onFloor(x, z) + height * 0.85, z, 0.05, 0.14, 0.05)
          }
        } else {
          const dx = hazard.to.x - hazard.from.x
          const dz = hazard.to.z - hazard.from.z
          const length = Math.hypot(dx, dz)
          // かわの きし。すなの ほそい おびと こいしを 両がわに。
          for (const side of [-1, 1]) {
            const x = (hazard.from.x + hazard.to.x) / 2 + (dz / length) * side * (hazard.halfWidth + 0.07)
            const z = (hazard.from.z + hazard.to.z) / 2 - (dx / length) * side * (hazard.halfWidth + 0.07)
            solid.add('box', '#d9c48f', x, onFloor(x, z) - 0.009, z, length, 0.02, 0.14, 0, Math.atan2(-dz, dx), 0)
            const stones = Math.round(length / 0.34)
            for (let k = 0; k < stones; k++) {
              const t = (k + 0.5 + (hash(index * 29 + k * (side + 3)) - 0.5) * 0.5) / stones
              const reach = hazard.halfWidth + 0.08 + hash(index * 31 + k * (side + 5)) * 0.06
              const px = hazard.from.x + dx * t + (dz / length) * side * reach
              const pz = hazard.from.z + dz * t - (dx / length) * side * reach
              if (geometry.heightAt(px, pz) !== null) pebble(px, pz, index * 53 + k * 2 + (side + 1) / 2)
            }
          }
        }
      }
    }

    const part = (buffers: MeshBuffers, material: THREE.Material) => {
      const mesh = new THREE.Mesh(bufferGeometry(buffers), material)
      mesh.castShadow = mesh.receiveShadow = true
      root.add(mesh)
      return mesh
    }
    // かべは 木の いたや いわの もよう。内がわの ねもとと 台の ねもとを 暗くして、床や じめんから 立ち上がって見せる。
    const pattern = textures[WALL_PATTERN[course.id]]
    const wallBody = part(geometry.wallBody, new THREE.MeshStandardMaterial({ color: look.wall, map: pattern, bumpMap: pattern, bumpScale: 1.5, vertexColors: true, roughness: 0.72 }))
    sideFaces(wallBody.geometry, { u: 1.6, v: WALL_HEIGHT + 0.06 }, 0.34)
    const wallCap = part(geometry.wallCap, new THREE.MeshStandardMaterial({ color: look.wallCap, map: pattern, vertexColors: true, roughness: 0.6 }))
    sideFaces(wallCap.geometry, { u: 1.6, v: WALL_HEIGHT + 0.06 }, 0)
    const skirt = part(geometry.skirt, new THREE.MeshStandardMaterial({ color: look.skirt, map: textures.rock, bumpMap: textures.rock, bumpScale: 2, vertexColors: true, roughness: 0.95 }))
    sideFaces(skirt.geometry, { u: 1.2, v: 1.2 }, 0.4)
    // カップの 中。上の ふちだけ 白く ぬった つつで、下へ いくほど 暗い。上から のぞくと ふかい あなに 見える。
    // 床の あなの ふち（golfGeometry の 48かく）と 同じ 角度に 点を ならべ、すきまを 作らない。
    const { cup } = geometry
    const rimStep = (Math.PI * 2) / 48
    const liner = new THREE.LatheGeometry([new THREE.Vector2(cup.radius, -cup.depth), new THREE.Vector2(cup.radius, -0.085), new THREE.Vector2(cup.radius, -0.08), new THREE.Vector2(cup.radius, 0)], 48, Math.PI * 1.5 - rimStep / 2)
    const linerPosition = liner.getAttribute('position')
    const linerColors = new Float32Array(linerPosition.count * 3)
    const paint = new THREE.Color()
    for (let i = 0; i < linerPosition.count; i++) {
      const y = linerPosition.getY(i)
      if (y > -0.082) paint.set('#f4f4ef')
      else paint.set('#3d4a43').lerp(new THREE.Color('#121714'), THREE.MathUtils.smoothstep(-y, 0.085, cup.depth))
      linerColors.set([paint.r, paint.g, paint.b], i * 3)
    }
    liner.setAttribute('color', new THREE.BufferAttribute(linerColors, 3))
    const cupInside = new THREE.Mesh(liner, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }))
    cupInside.position.set(cup.x, cup.y, cup.z)
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(cup.radius, 40), new THREE.MeshStandardMaterial({ color: '#141a17', roughness: 1 }))
    bottom.rotation.x = -Math.PI / 2
    bottom.position.set(cup.x, cup.y - cup.depth + 0.002, cup.z)
    const rim = new THREE.Mesh(new THREE.RingGeometry(cup.radius, cup.radius + 0.04, 48), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }))
    rim.rotation.x = -Math.PI / 2
    rim.position.set(cup.x, cup.y + 0.004, cup.z)
    root.add(cupInside, bottom, rim)

    // カップの旗。ボールが近づくと抜けて持ち上がる（ボールと重ならないように）。
    // ぼうは 紅白の しま、てっぺんに 金の たま、はたには 星。
    const flagColor = course.id === 'moon' ? '#ffd23f' : '#ff4f5e'
    const flag = new THREE.Group()
    const flagBase = cup.y - cup.depth
    flag.position.set(cup.x, flagBase, cup.z)
    const stripes = canvasTexture(8, 128, ctx => {
      for (let k = 0; k < 9; k++) { ctx.fillStyle = k % 2 ? '#ffffff' : flagColor; ctx.fillRect(0, k * 16 - 8, 8, 16) }
    })
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.8, 10), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.35 }))
    pole.position.y = 0.9
    pole.castShadow = true
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshStandardMaterial({ color: '#ffd24a', roughness: 0.25, metalness: 0.6 }))
    knob.position.y = 1.82
    const banner = canvasTexture(128, 82, ctx => {
      ctx.fillStyle = flagColor
      ctx.fillRect(0, 0, 128, 82)
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.fillRect(0, 70, 128, 12)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(62, 38, 25, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = flagColor
      star(ctx, 62, 40, 19)
    })
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.36, 8, 3), new THREE.MeshStandardMaterial({ map: banner, roughness: 0.7, side: THREE.DoubleSide }))
    cloth.geometry.translate(0.28, 0, 0)
    cloth.position.y = 1.6
    cloth.castShadow = true
    flag.add(pole, knob, cloth)
    root.add(flag)

    // ティーのマットと、ホールの番号の立て札。
    const tee = geometry.tee
    const first = definition.route[1] ?? definition.cup
    const heading = Math.atan2(first.x - tee.x, first.z - tee.z)
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshStandardMaterial({ color: felt.clone().offsetHSL(0, 0.05, -0.08), map: textures.rough, roughness: 1 }))
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
        // コースに はえた き。みきの ねもとの 太さは あたりと 同じで、葉は ぶつからない。
        const r = gadget.radius
        const seed = Math.abs(Math.round(gadget.x * 73 + gadget.z * 31))
        solid.add('trunk', '#7c5334', gadget.x, ground + (TREE.trunk + 0.3) / 2, gadget.z, r * 2, TREE.trunk + 0.3, r * 2, 0, hash(seed) * 3, 0)
        if (gadget.look === 'pine') {
          for (let k = 0; k < 4; k++) {
            const width = r * (4.6 - k * 0.95)
            solid.add('cone', NEEDLES[(seed + k) % NEEDLES.length]!, gadget.x, ground + TREE.trunk + 0.12 + k * 0.36, gadget.z, width, 0.78, width, 0, hash(seed + k) * Math.PI, 0)
          }
        } else {
          // でこぼこの 葉の かたまりを かさねて、こんもり しげった 葉に する。
          const turn = hash(seed + 1) * Math.PI * 2
          solid.add('blob', LEAVES[seed % LEAVES.length]!, gadget.x, ground + TREE.trunk + 0.42, gadget.z, r * 4.3, r * 3.3, r * 4.3, 0, turn, 0)
          for (let k = 0; k < 3; k++) {
            const angle = turn + (k * Math.PI * 2) / 3
            solid.add('blob', LEAVES[(seed + k + 1) % LEAVES.length]!, gadget.x + Math.cos(angle) * r * 1.5, ground + TREE.trunk + 0.3 + hash(seed + k) * 0.45, gadget.z + Math.sin(angle) * r * 1.5, r * 2.6, r * 2.3, r * 2.6, 0, angle, 0)
          }
          solid.add('blob', '#74c268', gadget.x - r * 0.3, ground + TREE.trunk + 0.95, gadget.z + r * 0.2, r * 2.2, r * 1.8, r * 2.2)
        }
        // ねもとの 草。
        const tuft = new THREE.Color(look.felt).offsetHSL(0, 0.05, -0.1)
        for (let k = 0; k < 8; k++) {
          const angle = ((k + hash(seed + k)) / 8) * Math.PI * 2
          grassTuft(soft, gadget.x + Math.cos(angle) * r * 1.12, ground, gadget.z + Math.sin(angle) * r * 1.12, 0.12, tuft, seed + k * 11)
        }
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
    // まわりの じめん。コースの そばは たいらで、はなれるほど なだらかな おかに なる。
    // 景色は groundAt で じめんの 上に 立てるので、おかの 上でも うかず、うまらない。
    const landscape = TERRAIN[course.id]
    const groundY = course.id === 'downhill' ? Math.min(baseY, bounds.minY) - 0.01 : course.id === 'canyon' ? baseY - 7 : baseY - 0.01
    const riverZ = bounds.minZ - 9
    const style: TerrainStyle = course.id === 'canyon'
      ? { kind: 'canyon', wall: landscape?.hills ?? 0 }
      : { kind: 'rolling', hills: landscape?.hills ?? 0, channel: course.id === 'river' ? { z: riverZ, halfWidth: 5.5 } : undefined }
    const lift = landscape ? createTerrainHeight({ minX: bounds.minX, maxX: bounds.maxX, minZ: bounds.minZ, maxZ: bounds.maxZ }, style) : () => 0
    const groundAt = (x: number, z: number) => groundY + lift(x, z)
    if (landscape) {
      const groundColor = new THREE.Color(look.ground)
      const strata = ['#c07448', '#a95d38', '#d08a55', '#b8683f'].map(value => new THREE.Color(value))
      const plateau = new THREE.Color('#dca46a')
      const tint = new THREE.Color()
      // コースの 台の ねもとの じめんは かげで 暗く。
      const courseGap = (x: number, z: number) => {
        if (x < bounds.minX - 1.6 || x > bounds.maxX + 1.6 || z < bounds.minZ - 1.6 || z > bounds.maxZ + 1.6) return Infinity
        if (outlines.some(outline => insideOutline(x, z, outline.points))) return 0
        let best = Infinity
        for (const { points } of outlines) points.forEach((point, index) => { best = Math.min(best, segmentGap(x, z, point, points[(index + 1) % points.length]!)) })
        return best
      }
      const paint = (x: number, z: number, height: number) => {
        if (course.id === 'canyon' && height > 0.4) {
          // がけは たかさで しまもように ぬりわけ、いちばん上の だいちは すなの色。
          tint.copy(strata[Math.floor(height / 1.3 + layeredNoise(x * 0.2, z * 0.2) * 0.9) % strata.length]!)
          if (height > (landscape?.hills ?? 0) * 0.93) tint.copy(plateau)
        } else tint.copy(groundColor)
        tint.offsetHSL(0, 0, (layeredNoise(x * 0.16, z * 0.16) - 0.5) * 0.09 + Math.min(0.04, height * 0.01))
        const gap = courseGap(x, z)
        if (gap < 1.4) tint.multiplyScalar(0.62 + 0.38 * THREE.MathUtils.smoothstep(gap, 0, 1.4))
        return tint
      }
      root.add(terrainMesh({ x: cx, z: cz }, groundY, lift, paint, textures[landscape.pattern], course.id === 'canyon' ? 60 : 34, course.id === 'canyon'))
    }
    // 草の ある コースは、じめんに 草の かぶを ちらして、たいらな 色の 板に 見えないようにする。
    const scatterTufts = (count: number, spread: number, color: string) => {
      const blade = new THREE.Color(color)
      for (let i = 0; i < count; i++) {
        const x = cx + (hash(i * 4.7 + 900) - 0.5) * (bounds.maxX - bounds.minX + spread)
        const z = cz + (hash(i * 6.1 + 950) - 0.5) * (bounds.maxZ - bounds.minZ + spread)
        if (!clear(x, z, 0.6) || (course.id === 'river' && Math.abs(z - riverZ) < 5.2)) continue
        grassTuft(soft, x, groundAt(x, z), z, 0.22 + hash(i + 17) * 0.16, blade, i * 7 + 3)
      }
    }
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
      const greens = ['#4f9d5b', '#62aa62', '#7cb867', '#3f8a5a', '#8fc26a']
      for (let i = 0; i < 90; i++) {
        const angle = hash(i + 1) * Math.PI * 2
        const distance = 3 + hash(i + 2) * 26
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        const size = 0.7 + hash(i + 3) * 0.8
        if (!clear(x, z, 1.6 + size * 0.6)) continue
        if (i % 3) broadleafTree(solid, x, groundAt(x, z), z, size * 0.85, i, greens)
        else pineTree(solid, x, groundAt(x, z), z, size * 0.85, i)
      }
      for (let i = 0; i < 120; i++) {
        const x = cx + (hash(i + 500) - 0.5) * 22
        const z = cz + (hash(i + 700) - 0.5) * 24
        if (!clear(x, z, 0.7)) continue
        const y = groundAt(x, z)
        solid.add('sphere', ['#ffe28a', '#ffffff', '#ff9eb5', '#c7a7ff'][i % 4]!, x, y + 0.12, z, 0.18, 0.16, 0.18)
        solid.add('sphere', '#6fb45a', x + 0.12, y + 0.06, z + 0.08, 0.26, 0.1, 0.22)
      }
      scatterTufts(160, 20, '#6cae55')
      for (const [x, z, s] of [[-40, -30, 12], [-12, -58, 16], [30, -45, 13], [48, 10, 10]] as const) {
        soft.add('sphere', '#8fbf73', cx + x, groundAt(cx + x, cz + z) - s * 0.2, cz + z, s * 2.4, s, s * 2)
      }
      // 小さな おうち。
      const hx = bounds.maxX + 3.2
      const hz = bounds.maxZ - 1.5
      const hy = groundAt(hx, hz)
      solid.add('box', '#fff1d6', hx, hy + 0.8, hz, 2.2, 1.6, 1.8)
      solid.add('pyramid', '#d9573f', hx, hy + 2.1, hz, 2.9, 1.0, 2.7, 0, Math.PI / 4)
      solid.add('box', '#8a5a3c', hx - 1.11, hy + 0.55, hz, 0.05, 1.0, 0.5)
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
      // もみの木。雪をかぶった みどりの円すいを かさねる。
      for (let i = 0; i < 60; i++) {
        const angle = hash(i + 41) * Math.PI * 2
        const distance = 4 + hash(i + 43) * 24
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        const size = 0.9 + hash(i + 47) * 0.9
        if (!clear(x, z, 1.5 + size * 0.5)) continue
        pineTree(solid, x, groundAt(x, z), z, size * 0.8, i, true)
      }
      // ゆきの こぶ。
      for (let i = 0; i < 40; i++) {
        const x = cx + (hash(i + 601) - 0.5) * 26
        const z = cz + (hash(i + 701) - 0.5) * 28
        if (!clear(x, z, 1.1)) continue
        soft.add('sphere', '#f3f8ff', x, groundAt(x, z) + 0.02, z, 1.1 + hash(i) * 1.4, 0.4 + hash(i + 3) * 0.4, 1.1 + hash(i + 5) * 1.2)
      }
      for (const [x, z, size] of [[-34, -28, 11], [22, -46, 14], [40, 12, 9]] as const) {
        soft.add('sphere', '#e8f1ff', cx + x, groundAt(cx + x, cz + z) - size * 0.2, cz + z, size * 2.4, size, size * 2)
      }
      // かまくらと、大きな ゆきだるま。
      const ix = bounds.maxX + 3.4
      const iz = bounds.maxZ - 1.2
      const iy = groundAt(ix, iz)
      soft.add('sphere', '#f7fbff', ix, iy, iz, 3.4, 2.6, 3.4)
      solid.add('box', '#cfe0f2', ix, iy + 0.45, iz - 1.6, 0.9, 0.9, 0.5)
      const sx = bounds.minX - 3.2
      const sz = bounds.minZ + 2.4
      const sy = groundAt(sx, sz)
      solid.add('sphere', '#fbfdff', sx, sy + 0.7, sz, 1.5, 1.4, 1.5)
      solid.add('sphere', '#fbfdff', sx, sy + 1.8, sz, 1.0, 1.0, 1.0)
      solid.add('cylinder', '#4a5570', sx, sy + 2.45, sz, 0.7, 0.5, 0.7)
      solid.add('cylinder', '#4a5570', sx, sy + 2.22, sz, 1.1, 0.1, 1.1)
      solid.add('cone', '#ff9a3d', sx, sy + 1.85, sz + 0.55, 0.16, 0.5, 0.16, Math.PI / 2, 0, 0)
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
      const sweets = ['#ff7fb0', '#7fe3d0', '#ffd66b', '#c9a0ff', '#fffdf6']
      // チョコスプレー。
      for (let i = 0; i < 140; i++) {
        const x = cx + (hash(i + 210) - 0.5) * 26
        const z = cz + (hash(i + 410) - 0.5) * 28
        if (!clear(x, z, 0.7)) continue
        solid.add('box', sweets[i % sweets.length]!, x, groundAt(x, z) + 0.05, z, 0.32, 0.08, 0.12, 0, hash(i + 3) * Math.PI, 0)
      }
      // ロリポップ。
      for (let i = 0; i < 28; i++) {
        const angle = hash(i + 61) * Math.PI * 2
        const distance = 5 + hash(i + 67) * 21
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        const size = 0.8 + hash(i + 71) * 0.7
        if (!clear(x, z, 1.5 + size)) continue
        const y = groundAt(x, z)
        solid.add('cylinder', '#fffdf6', x, y + size * 0.95, z, 0.14, size * 1.9, 0.14)
        solid.add('cylinder', sweets[i % sweets.length]!, x, y + size * 2.1, z, size * 1.2, 0.18, size * 1.2, Math.PI / 2, 0, 0)
        solid.add('cylinder', '#fffdf6', x, y + size * 2.1, z, size * 0.5, 0.2, size * 0.5, Math.PI / 2, 0, 0)
      }
      // ドーナツ。ねかせて じめんに ならべる。
      for (let i = 0; i < 14; i++) {
        const angle = hash(i + 131) * Math.PI * 2
        const distance = 7 + hash(i + 137) * 17
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        if (!clear(x, z, 2.4)) continue
        solid.add('torus', i % 2 ? '#ff9ec4' : '#b5744a', x, groundAt(x, z) + 0.42, z, 1.8, 1.8, 1.8, -Math.PI / 2, 0, 0)
      }
      // カップケーキ。
      for (let i = 0; i < 12; i++) {
        const angle = hash(i + 181) * Math.PI * 2
        const distance = 6 + hash(i + 187) * 16
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        if (!clear(x, z, 2.0)) continue
        const y = groundAt(x, z)
        solid.add('cylinder', i % 2 ? '#f2b56b' : '#e08bb4', x, y + 0.55, z, 1.5, 1.1, 1.5)
        solid.add('sphere', '#fff6ea', x, y + 1.35, z, 1.6, 1.3, 1.6)
        solid.add('sphere', '#ff5f6d', x, y + 2.0, z, 0.4, 0.4, 0.4)
      }
      // コースの そばの 大きな ケーキと、キャンディの つえ。
      const kx = bounds.maxX + 4.2
      const kz = bounds.maxZ - 1.6
      const ky = groundAt(kx, kz)
      solid.add('cylinder', '#fff1dc', kx, ky + 0.9, kz, 5.0, 1.8, 5.0)
      solid.add('cylinder', '#ffc0d8', kx, ky + 2.2, kz, 4.2, 1.0, 4.2)
      solid.add('cylinder', '#fff1dc', kx, ky + 3.0, kz, 3.4, 0.8, 3.4)
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2
        solid.add('cylinder', '#ff5f9e', kx + Math.cos(angle) * 1.1, ky + 3.8, kz + Math.sin(angle) * 1.1, 0.16, 0.9, 0.16)
        solid.add('sphere', '#ffd66b', kx + Math.cos(angle) * 1.1, ky + 4.35, kz + Math.sin(angle) * 1.1, 0.24, 0.3, 0.24)
      }
      const sx = bounds.minX - 3.6
      const sz = bounds.minZ + 2.2
      const sy = groundAt(sx, sz)
      for (let k = 0; k < 7; k++) solid.add('cylinder', k % 2 ? '#ffffff' : '#ff5f9e', sx, sy + 0.4 + k * 0.8, sz, 0.55, 0.8, 0.55)
      for (let k = 0; k < 4; k++) solid.add('sphere', k % 2 ? '#ffffff' : '#ff5f9e', sx + 0.35 + k * 0.42, sy + 6.1 + Math.cos(k * 0.7) * 0.35, sz, 0.55, 0.55, 0.55)
      // とおくの クリームの おか。
      for (const [x, z, size] of [[-36, -26, 11], [18, -44, 13], [42, 14, 9]] as const) {
        soft.add('sphere', '#fff0dd', cx + x, groundAt(cx + x, cz + z) - size * 0.2, cz + z, size * 2.4, size, size * 2)
      }
    } else if (course.id === 'dino') {
      // あかつちの じめんに、しだの木・いわ・かざん。コースの そばに 大きな きょうりゅう。
      // しだの木。ボールの うしろからの ながめを ふさがないよう、コースから はなして 立てる。
      for (let i = 0; i < 34; i++) {
        const angle = hash(i + 21) * Math.PI * 2
        const distance = 7 + hash(i + 23) * 21
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        const size = 0.8 + hash(i + 29) * 0.7
        if (!clear(x, z, 3.2 + size * 1.6)) continue
        const y = groundAt(x, z)
        for (let k = 0; k < 2; k++) solid.add('trunk', '#8a6247', x, y + size * (0.45 + k * 0.85), z, 0.26 * size, size * 0.9, 0.26 * size, 0, k, 0)
        for (let k = 0; k < 5; k++) {
          const leaf = (k / 5) * Math.PI * 2
          solid.add('cone', k % 2 ? '#3f8a4a' : '#579f52', x + Math.cos(leaf) * size * 0.5, y + size * 2.0, z + Math.sin(leaf) * size * 0.5, size * 0.5, size * 1.3, size * 0.5, Math.PI / 5.1, leaf, 0)
        }
      }
      // 足もとの しだの かぶ。
      for (let i = 0; i < 36; i++) {
        const x = cx + (hash(i + 331) - 0.5) * 26
        const z = cz + (hash(i + 337) - 0.5) * 28
        if (!clear(x, z, 1.1)) continue
        soft.add('blob', i % 2 ? '#4f9a58' : '#69ac5c', x, groundAt(x, z) + 0.06, z, 0.9 + hash(i) * 0.7, 0.5, 0.9 + hash(i + 7) * 0.6)
      }
      // ごろごろした いわと、すの たまご。
      for (let i = 0; i < 44; i++) {
        const x = cx + (hash(i + 511) - 0.5) * 28
        const z = cz + (hash(i + 713) - 0.5) * 30
        const size = 0.5 + hash(i + 17) * 1.3
        if (!clear(x, z, 1.0 + size * 0.6)) continue
        solid.add('rock', i % 3 ? look.rock : '#8d6a58', x, groundAt(x, z) + size * 0.25, z, size * 1.6, size * 1.2, size * 1.5, hash(i) * 0.6, hash(i + 5) * 3, hash(i + 9) * 0.5)
      }
      for (let i = 0; i < 5; i++) {
        const angle = hash(i + 301) * Math.PI * 2
        const distance = 7 + hash(i + 307) * 12
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        if (!clear(x, z, 2.2)) continue
        const y = groundAt(x, z)
        solid.add('torus', '#9a7a4a', x, y + 0.24, z, 2.2, 2.2, 2.2, -Math.PI / 2, 0, 0)
        for (let k = 0; k < 3; k++) solid.add('sphere', '#f2e3c4', x + Math.cos(k * 2.1) * 0.5, y + 0.45, z + Math.sin(k * 2.1) * 0.5, 0.7, 0.9, 0.7)
      }
      // とおくの かざん。てっぺんから けむりが 立ちのぼる。
      const vx = cx - 34
      const vz = cz - 38
      const vy = groundAt(vx, vz)
      solid.add('cone', '#8a5a42', vx, vy + 7, vz, 34, 14, 34)
      solid.add('cone', '#ff7a3d', vx, vy + 14.4, vz, 5.4, 1.6, 5.4)
      for (let k = 0; k < 5; k++) soft.add('sphere', '#d8cec6', vx + k * 1.6, vy + 16 + k * 3.2, vz + k * 1.2, 4 + k, 3 + k * 0.8, 4 + k)
      for (const [x, z, size] of [[30, -40, 12], [44, 10, 10], [-18, 34, 9]] as const) {
        soft.add('sphere', '#a9784f', cx + x, groundAt(cx + x, cz + z) - size * 0.2, cz + z, size * 2.4, size, size * 2)
      }
      // くびの ながい きょうりゅう。コースの となりで こちらを 見ている。
      const dx = bounds.maxX + 5.4
      const dz = cz + 1.2
      const dy = groundAt(dx, dz)
      const hide = '#6fb07f'
      solid.add('sphere', hide, dx, dy + 2.3, dz, 3.6, 2.5, 2.4)
      for (let k = 0; k < 4; k++) solid.add('cylinder', hide, dx - 1.5 - k * 0.5, dy + 3.4 + k * 0.9, dz, 0.78 - k * 0.09, 1.2, 0.78 - k * 0.09, 0, 0, 0.44)
      solid.add('sphere', hide, dx - 3.7, dy + 6.7, dz, 1.0, 0.85, 0.95)
      for (const side of [-1, 1]) solid.add('sphere', '#2f2a33', dx - 4.0, dy + 6.9, dz + side * 0.36, 0.14, 0.14, 0.14)
      solid.add('cone', hide, dx + 3.1, dy + 2.6, dz, 1.0, 3.8, 1.0, 0, 0, -Math.PI / 2.4)
      for (const front of [-1, 1]) for (const side of [-1, 1]) solid.add('cylinder', hide, dx + front * 1.2, dy + 0.9, dz + side * 0.9, 0.62, 1.9, 0.62)
    } else if (course.id === 'forest') {
      // ふかい もり。コースは ひろいので、まわりの きも コースの大きさに あわせて まく。
      const width = bounds.maxX - bounds.minX
      const depth = bounds.maxZ - bounds.minZ
      const leaves = ['#2f7a4a', '#3f9153', '#4f9f52', '#63b25c', '#2b6b42']
      for (let i = 0; i < 170; i++) {
        const x = cx + (hash(i * 1.7 + 3) - 0.5) * (width + 44)
        const z = cz + (hash(i * 2.9 + 11) - 0.5) * (depth + 44)
        const size = 0.9 + hash(i + 13) * 1.2
        if (!clear(x, z, 1.6 + size)) continue
        if (i % 3) pineTree(solid, x, groundAt(x, z), z, size * 0.95, i)
        else broadleafTree(solid, x, groundAt(x, z), z, size, i, leaves)
      }
      // したくさ と きのこ。
      for (let i = 0; i < 96; i++) {
        const x = cx + (hash(i * 3.3 + 21) - 0.5) * (width + 24)
        const z = cz + (hash(i * 4.1 + 31) - 0.5) * (depth + 24)
        if (!clear(x, z, 1.0)) continue
        const y = groundAt(x, z)
        if (i % 4) soft.add('blob', i % 2 ? '#3f8a4a' : '#57a457', x, y + 0.06, z, 0.9 + hash(i) * 0.8, 0.45, 0.9 + hash(i + 5) * 0.7)
        else {
          solid.add('cylinder', '#fff3e0', x, y + 0.14, z, 0.14, 0.28, 0.14)
          solid.add('sphere', '#d9573f', x, y + 0.3, z, 0.42, 0.3, 0.42)
        }
      }
      scatterTufts(140, 18, '#4f9a4f')
      // きりかぶ と たおれた まるた。
      for (let i = 0; i < 14; i++) {
        const x = cx + (hash(i * 5.7 + 41) - 0.5) * (width + 18)
        const z = cz + (hash(i * 6.3 + 53) - 0.5) * (depth + 18)
        if (!clear(x, z, 1.8)) continue
        const y = groundAt(x, z)
        if (i % 2) solid.add('cylinder', '#8a6247', x, y + 0.22, z, 0.9, 0.44, 0.9)
        else solid.add('cylinder', '#7c5334', x, y + 0.26, z, 0.5, 2.6, 0.5, Math.PI / 2, hash(i) * 3, 0)
      }
      // もりの おくの おか。
      for (const [x, z, size] of [[-38, -24, 12], [16, -46, 14], [42, 16, 10], [-30, 34, 11]] as const) {
        soft.add('sphere', '#3f7a4a', cx + x, groundAt(cx + x, cz + z) - size * 0.2, cz + z, size * 2.4, size, size * 2)
      }
    } else if (course.id === 'downhill') {
      // 高台の コース。いちばん低い だんの下に じめんを 置いて、うしろは おかが つづいて見えるようにする。
      const width = bounds.maxX - bounds.minX
      const depth = bounds.maxZ - bounds.minZ
      // コースの うしろ（ティーがわ）に つづく おか。台が ういて見えないようにする。
      soft.add('sphere', '#79b56a', cx, groundY, cz + depth / 2 + 7, width + 24, (bounds.maxY - groundY) * 2.1, 18)
      for (const [x, z, size] of [[-26, 22, 11], [28, 26, 9], [34, -12, 8], [-34, -16, 9]] as const) {
        soft.add('sphere', '#82bf6d', cx + x, groundAt(cx + x, cz + z) - size * 0.2, cz + z, size * 2.4, size, size * 2)
      }
      // とおくの ゆきの やま。
      for (const [x, z, size] of [[-30, 46, 17], [22, 54, 13]] as const) {
        const y = groundAt(cx + x, cz + z)
        solid.add('cone', '#8b9bb0', cx + x, y + size * 0.5, cz + z, size * 3, size, size * 3)
        solid.add('cone', '#ffffff', cx + x, y + size * 0.86, cz + z, size * 0.92, size * 0.3, size * 0.92)
      }
      // まきばの き と いわ、ほしくさの ロール。
      for (let i = 0; i < 70; i++) {
        const x = cx + (hash(i * 2.1 + 17) - 0.5) * (width + 40)
        const z = cz + (hash(i * 3.7 + 23) - 0.5) * (depth + 40)
        const size = 0.8 + hash(i + 29) * 1.0
        if (!clear(x, z, 1.6 + size)) continue
        const y = groundAt(x, z)
        if (i % 5 === 0) {
          solid.add('cylinder', '#e0c078', x, y + size * 0.6, z, size * 1.4, size * 1.5, size * 1.4, 0, 0, Math.PI / 2)
        } else if (i % 5 === 1) {
          solid.add('rock', look.rock, x, y + size * 0.2, z, size * 1.5, size * 1.1, size * 1.4, hash(i) * 0.5, hash(i + 3) * 3, hash(i + 7) * 0.4)
        } else {
          pineTree(solid, x, y, z, size * 0.8, i)
        }
      }
      scatterTufts(120, 22, '#6cae55')
      // ふもとの はらっぱの ちいさな おうち。
      const hx = bounds.maxX + 5.4
      const hz = bounds.minZ + 2.2
      const hy = groundAt(hx, hz)
      solid.add('box', '#fff1d6', hx, hy + 0.8, hz, 2.4, 1.6, 2.0)
      solid.add('pyramid', '#d9573f', hx, hy + 2.1, hz, 3.1, 1.0, 2.9, 0, Math.PI / 4)
      solid.add('box', '#8a5a3c', hx - 1.21, hy + 0.55, hz, 0.05, 1.0, 0.5)
    } else if (course.id === 'river') {
      // かわべの はらっぱ。コースの おくを 大きな かわが ながれ、きしに すいしゃごやが 立つ。
      const width = bounds.maxX - bounds.minX
      const depth = bounds.maxZ - bounds.minZ
      const bigRiver = new THREE.Mesh(new THREE.PlaneGeometry(200, 9, 1, 1), rippleMaterial('#3aa6d6', waves.uniforms))
      bigRiver.rotation.x = -Math.PI / 2
      bigRiver.position.set(cx, groundY + 0.01, riverZ)
      root.add(bigRiver)
      water = waves
      for (const side of [-1, 1]) solid.add('box', '#d9c48f', cx, groundY + 0.006, riverZ + side * 4.7, 200, 0.02, 0.6)
      const greens = ['#4f9d5b', '#62aa62', '#7cb867', '#3f8a5a']
      for (let i = 0; i < 120; i++) {
        const x = cx + (hash(i * 1.9 + 7) - 0.5) * (width + 46)
        const z = cz + (hash(i * 2.7 + 13) - 0.5) * (depth + 40)
        const size = 0.8 + hash(i + 19) * 0.9
        if (!clear(x, z, 1.8 + size) || Math.abs(z - riverZ) < 6 + size) continue
        if (i % 3) broadleafTree(solid, x, groundAt(x, z), z, size * 0.85, i, greens)
        else pineTree(solid, x, groundAt(x, z), z, size * 0.85, i)
      }
      // かわぞいの あしと、はなばたけ。
      for (let i = 0; i < 90; i++) {
        const x = cx + (hash(i + 1300) - 0.5) * (width + 30)
        const side = hash(i + 1400) < 0.5 ? -1 : 1
        const z = riverZ + side * (4.9 + hash(i + 1500) * 0.8)
        soft.add('cone', i % 2 ? '#4f8f3f' : '#6aa84a', x, groundAt(x, z) + 0.3, z, 0.12, 0.7, 0.12)
      }
      for (let i = 0; i < 110; i++) {
        const x = cx + (hash(i + 1600) - 0.5) * (width + 20)
        const z = cz + (hash(i + 1700) - 0.5) * (depth + 16)
        if (!clear(x, z, 0.7) || Math.abs(z - riverZ) < 5.6) continue
        solid.add('sphere', ['#ffe28a', '#ffffff', '#ff9eb5', '#9fd0ff'][i % 4]!, x, groundAt(x, z) + 0.12, z, 0.18, 0.16, 0.18)
      }
      scatterTufts(150, 22, '#6cae55')
      // すいしゃごや。まわる すいしゃは、ほかの まわる けしきと いっしょに うごかす。
      const mx = bounds.maxX + 4.5
      const mz = riverZ + 5.6
      const my = groundAt(mx, mz)
      solid.add('box', '#fff1d6', mx, my + 1.0, mz, 2.6, 2.0, 2.2)
      solid.add('pyramid', '#b84a3a', mx, my + 2.6, mz, 3.4, 1.2, 3.0, 0, Math.PI / 4)
      const wheel = new THREE.Group()
      wheel.position.set(mx - 1.6, my + 0.9, mz - 1.3)
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
        soft.add('sphere', '#86bf6c', cx + x, groundAt(cx + x, cz + z) - size * 0.2, cz + z, size * 2.4, size, size * 2)
      }
    } else if (course.id === 'canyon') {
      // たにまの コース。コースは たかい いわの だいの上にあり、ふかい たにの そこを かわが ながれる。
      // たにの よこには だんだんの がけが そびえ、上の だいちまで つづく。
      const strata = ['#c07448', '#a95d38', '#d08a55', '#b8683f'].map(value => new THREE.Color(value))
      const ropeBridges = (definition.gadgets ?? []).flatMap(gadget => (gadget.kind === 'bridge' && !gadget.rails ? [gadget] : []))
      for (const outline of outlines) {
        // つりばしの ゆかは いわに しない（たにの 上に かかって見えるように）。
        const spansGap = ropeBridges.some(bridge => outline.points.every(point => Math.abs(point.x - bridge.x) <= bridge.halfWidth + 0.3 && Math.abs(point.z - bridge.z) <= bridge.halfLength + 0.3))
        if (spansGap) continue
        let low = outline.base
        for (const point of outline.points) low = Math.min(low, geometry.heightAt(point.x, point.z) ?? low)
        root.add(cliff(outline.points, low - PLATFORM_DEPTH + 0.02, groundY - 0.3, strata, textures.rock))
      }
      // たにの そこの かわと、かわらの いし。
      const width = bounds.maxX - bounds.minX
      const depth = bounds.maxZ - bounds.minZ
      const valley = new THREE.Mesh(new THREE.PlaneGeometry(7, 200, 1, 1), rippleMaterial('#3f9fcf', waves.uniforms))
      valley.rotation.x = -Math.PI / 2
      valley.position.set(cx + 1, groundY + 0.02, cz)
      root.add(valley)
      water = waves
      for (let i = 0; i < 70; i++) {
        const z = cz + (hash(i * 3.3 + 2400) - 0.5) * (depth + 50)
        const side = i % 2 ? -1 : 1
        const x = cx + 1 + side * (3.4 + hash(i * 2.9 + 2410) * 1.2)
        const size = 0.4 + hash(i + 2420) * 0.7
        solid.add('rock', i % 3 ? '#b8a08a' : look.rock, x, groundAt(x, z) + size * 0.15, z, size * 1.4, size * 0.8, size * 1.2, hash(i) * 0.5, hash(i + 3) * 3, 0)
      }
      // だいちの 上の テーブルの ような いわやま と、サボテン と いわ。
      for (let i = 0; i < 16; i++) {
        const angle = hash(i + 2100) * Math.PI * 2
        const distance = Math.max(width, depth) / 2 + 14 + hash(i + 2110) * 30
        const x = cx + Math.cos(angle) * distance
        const z = cz + Math.sin(angle) * distance
        const size = 4 + hash(i + 2120) * 6
        const height = 5 + hash(i + 2130) * 9
        const y = groundAt(x, z)
        solid.add('cylinder', strata[i % strata.length]!.getStyle(), x, y + height / 2 - 0.5, z, size * 2, height, size * 1.6)
        solid.add('cylinder', '#e0a070', x, y + height - 0.3, z, size * 2.05, 0.4, size * 1.65)
      }
      for (let i = 0; i < 60; i++) {
        const x = cx + (hash(i * 2.3 + 2200) - 0.5) * (width + 40)
        const z = cz + (hash(i * 3.1 + 2300) - 0.5) * (depth + 40)
        if (!clear(x, z, 2.2) || Math.abs(x - cx - 1) < 4.5) continue
        const y = groundAt(x, z)
        if (i % 3) {
          solid.add('rock', i % 2 ? look.rock : '#9a6448', x, y + 0.3, z, 1.6, 1.0, 1.4, hash(i) * 0.6, hash(i + 5) * 3, 0)
        } else {
          solid.add('cylinder', '#4f9a58', x, y + 1.1, z, 0.5, 2.2, 0.5)
          solid.add('cylinder', '#4f9a58', x + 0.45, y + 1.3, z, 0.3, 0.9, 0.3)
          solid.add('cylinder', '#4f9a58', x - 0.4, y + 1.6, z, 0.28, 0.7, 0.28)
        }
      }
    }
    solid.build(root, true, fade)
    soft.build(root, false, fade)
    root.traverse(child => { if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial && !child.material.transparent) child.receiveShadow = true })

    // 影を落とす範囲をホールの大きさに合わせる。
    const extent = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 2.5
    // 日は ななめ よこから。かげが 長めに のびて、こぶや かべの 高さが わかりやすい。
    sun.target.position.set(cx, 0, cz)
    sun.position.set(cx - 10, 11.5, cz + 4)
    Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: Math.max(45, extent * 2 + 20) })
    sun.shadow.camera.updateProjectionMatrix()
    const moon = course.id === 'moon'
    hemisphere.color.set(moon ? '#b3b8ff' : '#eef8ff')
    hemisphere.groundColor.set(moon ? '#3a3552' : course.id === 'beach' ? '#d8c89a' : course.id === 'candy' ? '#ffdcc0' : course.id === 'dino' ? '#c08a5e' : course.id === 'forest' ? '#4a7a46' : course.id === 'canyon' ? '#c9865a' : '#7fa35a')
    // まわりからの 明かりを ひかえめにして、日なたと かげの 差で 立体感を 出す。
    hemisphere.intensity = moon ? 0.8 : 0.75
    sun.color.set(moon ? '#f2f0ff' : '#fff1d6')
    sun.intensity = moon ? 2.2 : 2.75
    scene.environmentIntensity = moon ? 0.28 : 0.3
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
      if (hole) { scene.remove(hole.root); disposeTree(hole.root, sharedTextures) }
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
      sharedTextures.forEach(texture => texture.dispose())
      environment.dispose()
      sun.shadow.map?.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

export type GolfScene = ReturnType<typeof createGolfScene>
