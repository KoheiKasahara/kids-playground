/**
 * クレーンゲーム機の見た目（Three.js）。
 * 物理の結果を受け取って描くだけで、ゲームの進行も物理も持たない。
 * 景品は種類ごとの InstancedMesh へまとめ、景品が増えても描画回数が増えないようにしている。
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { BIN, CHUTE, prizeReach, type CraneMachine, type PrizeLook, type PrizeSpecies } from './craneMachines'
import { CLAW } from './craneRig'
import type { FingerView, PrizeView } from './craneWorld'

export type CraneView = 'front' | 'side'
/** タップした場所を拾う高さ。景品の山のてっぺんあたり。 */
export const PICK_Y = 0.12
const GANTRY_Y = 0.88
const MARQUEE_Y = 1.0

type Part = { geometry: THREE.BufferGeometry; material: THREE.Material; local: THREE.Matrix4 }

function matrix(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, scale = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(scale, scale, scale),
  )
}

function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse(child => {
    const mesh = child as Partial<THREE.Mesh>
    if (mesh.geometry) geometries.add(mesh.geometry)
    for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) materials.add(material)
    if (child instanceof THREE.InstancedMesh) child.dispose()
  })
  geometries.forEach(geometry => geometry.dispose())
  materials.forEach(material => material.dispose())
}

/** 景品の見た目。胴体のほかに耳や顔などの部品を、景品のローカル座標で並べる。 */
function prizeParts(species: PrizeSpecies): Part[] {
  const body = new THREE.MeshStandardMaterial({ color: species.color, roughness: species.look === 'marble' || species.look === 'egg' ? 0.12 : 0.72, metalness: 0.02 })
  const accent = new THREE.MeshStandardMaterial({ color: species.accent, roughness: 0.5 })
  const eye = new THREE.MeshStandardMaterial({ color: '#3c2a24', roughness: 0.3 })
  const parts: Part[] = []
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, local: THREE.Matrix4) => parts.push({ geometry, material, local })
  const reach = prizeReach(species.body)
  switch (species.look as PrizeLook) {
    case 'bear': {
      const r = reach
      add(new THREE.SphereGeometry(r, 20, 14), body, matrix(0, 0, 0))
      for (const side of [-1, 1]) add(new THREE.SphereGeometry(r * 0.32, 12, 8), body, matrix(side * r * 0.66, r * 0.68, 0))
      add(new THREE.SphereGeometry(r * 0.42, 14, 10), accent, matrix(0, -r * 0.18, r * 0.76, 0, 0, 0, 1))
      for (const side of [-1, 1]) add(new THREE.SphereGeometry(r * 0.1, 8, 6), eye, matrix(side * r * 0.3, r * 0.24, r * 0.88))
      break
    }
    case 'bunny': {
      const r = species.body.form === 'capsule' ? species.body.radius : reach
      const half = species.body.form === 'capsule' ? species.body.half : r * 0.6
      add(new THREE.CapsuleGeometry(r, half * 2, 8, 18), body, matrix(0, 0, 0))
      for (const side of [-1, 1]) add(new THREE.CapsuleGeometry(r * 0.17, r * 0.8, 4, 10), body, matrix(side * r * 0.38, half + r * 0.82, 0, 0, 0, side * 0.26))
      add(new THREE.SphereGeometry(r * 0.3, 12, 8), accent, matrix(0, half * 0.45, r * 0.82))
      for (const side of [-1, 1]) add(new THREE.SphereGeometry(r * 0.09, 8, 6), eye, matrix(side * r * 0.3, half * 0.85, r * 0.9))
      break
    }
    case 'chick': {
      const r = reach
      add(new THREE.SphereGeometry(r, 18, 14), body, matrix(0, 0, 0))
      add(new THREE.ConeGeometry(r * 0.22, r * 0.42, 8), accent, matrix(0, 0, r * 0.95, Math.PI / 2, 0, 0))
      for (const side of [-1, 1]) add(new THREE.SphereGeometry(r * 0.1, 8, 6), eye, matrix(side * r * 0.32, r * 0.3, r * 0.84))
      for (const side of [-1, 1]) add(new THREE.SphereGeometry(r * 0.42, 10, 8), body, matrix(side * r * 0.86, -r * 0.1, 0, 0, 0, 0, 0.52))
      break
    }
    case 'egg': {
      const r = species.body.form === 'capsule' ? species.body.radius : reach
      const half = species.body.form === 'capsule' ? species.body.half : r * 0.4
      add(new THREE.CapsuleGeometry(r, half * 2, 10, 20), body, matrix(0, 0, 0))
      add(new THREE.TorusGeometry(r * 1.01, r * 0.12, 8, 22), accent, matrix(0, 0, 0, Math.PI / 2))
      break
    }
    case 'marble': {
      const r = reach
      add(new THREE.SphereGeometry(r, 22, 16), body, matrix(0, 0, 0))
      add(new THREE.SphereGeometry(r * 0.48, 14, 10), accent, matrix(0, 0, 0))
      break
    }
    case 'snack': {
      const half = species.body.form === 'box' ? species.body.half : { x: reach, y: reach, z: reach }
      add(new THREE.BoxGeometry(half.x * 2, half.y * 2, half.z * 2), body, matrix(0, 0, 0))
      add(new THREE.BoxGeometry(half.x * 1.35, half.y * 0.9, half.z * 2.04), accent, matrix(0, 0, 0))
      add(new THREE.CylinderGeometry(half.y * 0.66, half.y * 0.66, half.z * 0.4, 14), accent, matrix(0, half.y * 1.02, 0, Math.PI / 2))
      break
    }
    case 'drink': {
      const half = species.body.form === 'box' ? species.body.half : { x: reach, y: reach * 1.4, z: reach }
      add(new THREE.BoxGeometry(half.x * 2, half.y * 2, half.z * 2), body, matrix(0, 0, 0))
      add(new THREE.BoxGeometry(half.x * 2.04, half.y * 0.7, half.z * 2.04), accent, matrix(0, -half.y * 0.2, 0))
      add(new THREE.CylinderGeometry(half.x * 0.12, half.x * 0.12, half.y * 0.9, 8), accent, matrix(half.x * 0.45, half.y * 1.35, 0, 0, 0, 0.2))
      break
    }
  }
  return parts
}

export function createCraneScene(container: HTMLDivElement, machine: CraneMachine) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.04
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.setAttribute('aria-hidden', 'true')
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#f4e7ef')
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04)
  scene.environment = environment.texture
  scene.environmentIntensity = 0.55
  room.dispose()
  pmrem.dispose()

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 40)
  const target = new THREE.Vector3(0, 0.36, 0)
  const sun = new THREE.DirectionalLight('#fff4e2', 2.1)
  sun.position.set(-1.3, 3.2, 2.1)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, { left: -1.1, right: 1.1, top: 1.3, bottom: -1.1, near: 0.6, far: 6 })
  sun.shadow.camera.updateProjectionMatrix()
  sun.shadow.normalBias = 0.02
  sun.shadow.bias = -0.0004
  scene.add(sun, new THREE.HemisphereLight('#ffeef6', '#c9bfae', 0.9))
  // 筐体の中を照らす電球。影は落とさないので負荷は小さい。
  const lamp = new THREE.PointLight('#ffe6b4', 1.4, 3, 1.6)
  lamp.position.set(0, MARQUEE_Y - 0.2, 0.1)
  scene.add(lamp)

  const cabinet = new THREE.Group()
  scene.add(cabinet)
  const metal = new THREE.MeshStandardMaterial({ color: '#d8dde4', roughness: 0.34, metalness: 0.72 })
  const frame = new THREE.MeshStandardMaterial({ color: machine.color, roughness: 0.42 })
  const frameDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(machine.color).multiplyScalar(0.72), roughness: 0.5 })
  const glass = new THREE.MeshPhysicalMaterial({ color: '#eaf6ff', roughness: 0.06, metalness: 0, transparent: true, opacity: 0.17, depthWrite: false, side: THREE.DoubleSide })
  const mat = new THREE.MeshStandardMaterial({ color: '#fdf3df', roughness: 0.9 })
  const bulb = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd978', emissiveIntensity: 1.2, roughness: 0.3 })

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, shadow = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = shadow
    mesh.receiveShadow = shadow
    cabinet.add(mesh)
    return mesh
  }
  // 景品を並べる床。穴の部分だけ抜いた2枚。
  box(BIN.x - CHUTE.maxX, 0.04, BIN.z * 2, (CHUTE.maxX + BIN.x) / 2, -0.02, 0, mat)
  box(CHUTE.maxX - CHUTE.minX, 0.04, BIN.z + CHUTE.minZ, (CHUTE.minX + CHUTE.maxX) / 2, -0.02, (CHUTE.minZ - BIN.z) / 2, mat)
  // 穴のまわりのふち。落ちる場所がひと目でわかるようにする。
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.014, 8, 28), new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#a86a12', emissiveIntensity: 0.3, roughness: 0.35 }))
  rim.position.set((CHUTE.minX + CHUTE.maxX) / 2, 0.005, (CHUTE.minZ + CHUTE.maxZ) / 2)
  rim.rotation.x = -Math.PI / 2
  rim.scale.set(1.05, 1.05, 1)
  cabinet.add(rim)
  // 景品の床の下をふさぐ本体。穴の下だけは空けて、受け皿が手前から見えるようにする。
  box(BIN.x - CHUTE.maxX, 0.35, BIN.z * 2, (CHUTE.maxX + BIN.x) / 2, -0.215, 0, frame)
  box(CHUTE.maxX - CHUTE.minX, 0.35, BIN.z + CHUTE.minZ, (CHUTE.minX + CHUTE.maxX) / 2, -0.215, (CHUTE.minZ - BIN.z) / 2, frame)
  // 受け皿と、その下の台。
  box(CHUTE.maxX - CHUTE.minX + 0.02, 0.03, CHUTE.maxZ - CHUTE.minZ + 0.02, (CHUTE.minX + CHUTE.maxX) / 2, CHUTE.floor - 0.015, (CHUTE.minZ + CHUTE.maxZ) / 2, frameDark)
  box(BIN.x * 2 + 0.08, 0.06, BIN.z * 2 + 0.08, 0, CHUTE.floor - 0.05, 0, frame)
  box(BIN.x * 2 - 0.02, 0.28, BIN.z * 2 - 0.02, 0, CHUTE.floor - 0.22, 0, frameDark)
  box(BIN.x * 2 + 0.12, 0.06, BIN.z * 2 + 0.12, 0, CHUTE.floor - 0.39, 0, frame)
  // 下の箱の内側（穴の下）が見えるように、手前の面だけガラスにする。
  box(CHUTE.maxX - CHUTE.minX, 0.34, 0.01, (CHUTE.minX + CHUTE.maxX) / 2, CHUTE.floor / 2 - 0.02, BIN.z + 0.01, glass, false)
  // 景品窓の4面。
  box(0.012, BIN.height, BIN.z * 2, -BIN.x - 0.006, BIN.height / 2, 0, glass, false)
  box(0.012, BIN.height, BIN.z * 2, BIN.x + 0.006, BIN.height / 2, 0, glass, false)
  box(BIN.x * 2, BIN.height, 0.012, 0, BIN.height / 2, BIN.z + 0.006, glass, false)
  const backPanel = box(BIN.x * 2, BIN.height, 0.016, 0, BIN.height / 2, -BIN.z - 0.008, frame, false)
  backPanel.receiveShadow = true
  for (const y of [0.12, 0.38, 0.64]) box(BIN.x * 2 - 0.02, 0.05, 0.01, 0, y, -BIN.z + 0.006, mat, false)
  // 四隅の柱と天井。
  for (const x of [-BIN.x, BIN.x]) for (const z of [-BIN.z, BIN.z]) box(0.05, BIN.height + 0.12, 0.05, x, BIN.height / 2, z, metal)
  box(BIN.x * 2 + 0.1, 0.05, BIN.z * 2 + 0.1, 0, BIN.height + 0.04, 0, frame)
  // 看板と電球。遊ぶ人の側を向ける。
  box(BIN.x * 2 - 0.04, 0.2, 0.06, 0, MARQUEE_Y, BIN.z - 0.06, frame)
  box(BIN.x * 1.5, 0.12, 0.02, 0, MARQUEE_Y, BIN.z - 0.02, mat, false)
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 10, 8), bulb, 10)
  for (let i = 0; i < 10; i++) bulbs.setMatrixAt(i, matrix(-BIN.x + 0.1 + i * ((BIN.x * 2 - 0.2) / 9), MARQUEE_Y + 0.088, BIN.z - 0.03))
  cabinet.add(bulbs)
  // 操作ボタンのついた前板。遊ぶのは画面のボタンだが、機械らしさのために置く。
  box(0.52, 0.12, 0.1, 0.2, CHUTE.floor - 0.12, BIN.z + 0.02, frame)
  for (const [index, color] of ['#f05b5b', '#4fa3f0'].entries()) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 14), new THREE.MeshStandardMaterial({ color, roughness: 0.35 }))
    knob.position.set(0.08 + index * 0.24, CHUTE.floor - 0.1, BIN.z + 0.06)
    knob.rotation.x = Math.PI / 2
    knob.castShadow = true
    cabinet.add(knob)
  }

  // アーム。ガントリー（横棒）と台車、ケーブル、爪。
  const gantry = new THREE.Group()
  scene.add(gantry)
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, BIN.x * 2 - 0.04, 10), metal)
  bar.rotation.z = Math.PI / 2
  bar.position.y = GANTRY_Y
  bar.castShadow = true
  gantry.add(bar)
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.09), metal)
  trolley.position.y = GANTRY_Y - 0.04
  trolley.castShadow = true
  gantry.add(trolley)
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 6), new THREE.MeshStandardMaterial({ color: '#8d949c', roughness: 0.5, metalness: 0.4 }))
  gantry.add(cable)

  const claw = new THREE.Group()
  scene.add(claw)
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(CLAW.hubRadius, CLAW.hubRadius * 0.86, CLAW.hubHalf * 2, 18), metal)
  hub.castShadow = true
  claw.add(hub)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(CLAW.hubRadius * 0.6, 14, 8), new THREE.MeshStandardMaterial({ color: '#f5b02e', roughness: 0.35, metalness: 0.2 }))
  cap.position.y = CLAW.hubHalf + 0.01
  claw.add(cap)
  const armMaterial = new THREE.MeshStandardMaterial({ color: '#e2e7ee', roughness: 0.3, metalness: 0.66 })
  const fingerGroups = [0, 1, 2].map(() => {
    const group = new THREE.Group()
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(CLAW.armRadius, CLAW.arm, 5, 10), armMaterial)
    arm.position.y = -CLAW.arm / 2
    arm.castShadow = true
    const tip = new THREE.Mesh(new THREE.CapsuleGeometry(CLAW.tipRadius, CLAW.tip, 5, 10), armMaterial)
    tip.position.set(-Math.sin(CLAW.tipBend) * CLAW.tip / 2, -CLAW.arm - Math.cos(CLAW.tipBend) * CLAW.tip / 2, 0)
    tip.rotation.z = -CLAW.tipBend
    tip.castShadow = true
    group.add(arm, tip)
    claw.add(group)
    return group
  })
  // 落とす位置の目印。アームの真下へのばした光の柱と、床の輪。
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 8), new THREE.MeshBasicMaterial({ color: '#ffd86b', transparent: true, opacity: 0.3, depthWrite: false }))
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.008, 6, 26), new THREE.MeshBasicMaterial({ color: '#ff9f43', transparent: true, opacity: 0.85, depthWrite: false }))
  ring.rotation.x = -Math.PI / 2
  scene.add(beam, ring)

  // 景品。種類ごとに部品を InstancedMesh へまとめる。
  const counts = new Map<string, number>()
  for (const slot of machine.slots) counts.set(slot.species, (counts.get(slot.species) ?? 0) + 1)
  const prizeGroup = new THREE.Group()
  scene.add(prizeGroup)
  const prizeMeshes = new Map<string, { parts: Part[]; meshes: THREE.InstancedMesh[] }>()
  for (const species of machine.species) {
    const capacity = Math.max(1, counts.get(species.id) ?? 0)
    const parts = prizeParts(species)
    const meshes = parts.map(part => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      prizeGroup.add(mesh)
      return mesh
    })
    prizeMeshes.set(species.id, { parts, meshes })
  }

  // 取れたときの紙ふぶきと、ぶつかったときのほこり。どちらも1つのInstancedMeshで描く。
  type Particle = { life: number; span: number; position: THREE.Vector3; velocity: THREE.Vector3; spin: number; scale: number }
  const confetti = new THREE.InstancedMesh(new THREE.BoxGeometry(0.016, 0.016, 0.004), new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.5, emissive: '#4a3a1a', emissiveIntensity: 0.25 }), 48)
  confetti.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(48 * 3).fill(1), 3)
  confetti.frustumCulled = false
  scene.add(confetti)
  const particles: Particle[] = []
  const palette = ['#ff6f91', '#ffd166', '#6fd3c7', '#8fa9ff', '#fff3d6']

  const dummy = new THREE.Object3D()
  const scratch = new THREE.Matrix4()
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
  const paletteColors = palette.map(color => new THREE.Color(color))
  let aspect = 1
  let view: CraneView = 'front'
  let twinkle = 0

  // 見せたい範囲（筐体ぜんたい）と、視点ごとの向き。
  const FIT: Record<CraneView, { direction: THREE.Vector3; target: THREE.Vector3 }> = {
    front: { direction: new THREE.Vector3(0.07, 0.36, 1).normalize(), target: new THREE.Vector3(0, 0.22, 0) },
    side: { direction: new THREE.Vector3(1, 0.34, 0.34).normalize(), target: new THREE.Vector3(-0.02, 0.22, 0.04) },
  }
  const machineBounds = new THREE.Box3(new THREE.Vector3(-0.7, -0.78, -0.52), new THREE.Vector3(0.7, 1.13, 0.52))
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(index => new THREE.Vector3(
    index & 1 ? machineBounds.max.x : machineBounds.min.x,
    index & 2 ? machineBounds.max.y : machineBounds.min.y,
    index & 4 ? machineBounds.max.z : machineBounds.min.z,
  ))
  const projected = new THREE.Vector3()

  /**
   * 画面の形がどうであれ機械が丸ごと入る位置までカメラを下げる。
   * 縦横比ごとの式を書き分けず、筐体の8隅が画面に収まるまで距離を広げて決める。
   */
  function applyCamera() {
    const fit = FIT[view]
    target.copy(fit.target)
    for (let distance = 1.8; distance <= 6; distance += 0.06) {
      camera.position.copy(fit.target).addScaledVector(fit.direction, distance)
      camera.lookAt(target)
      camera.updateMatrixWorld()
      if (corners.every(corner => {
        projected.copy(corner).project(camera)
        return Math.abs(projected.x) < 0.98 && Math.abs(projected.y) < 0.98 && projected.z < 1
      })) return
    }
  }

  function resize() {
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    aspect = width / height
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7))
    renderer.setSize(width, height, false)
    applyCamera()
  }
  resize()

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PICK_Y)
  const hitPoint = new THREE.Vector3()

  return {
    renderer,
    camera,
    get view() { return view },
    setView(next: CraneView) {
      view = next
      applyCamera()
    },
    resize,
    /** 画面をタップした場所を、ケースの中の座標へ変換する。 */
    pick(clientX: number, clientY: number): { x: number; z: number } | null {
      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null
      pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      if (!raycaster.ray.intersectPlane(pickPlane, hitPoint)) return null
      return { x: hitPoint.x, z: hitPoint.z }
    },
    syncClaw(position: { x: number; y: number; z: number }, fingers: readonly FingerView[], aiming = true) {
      claw.position.set(position.x, position.y, position.z)
      fingerGroups.forEach((group, index) => {
        const finger = fingers[index]
        if (!finger) return
        group.position.set(finger.position.x - position.x, finger.position.y - position.y, finger.position.z - position.z)
        group.quaternion.set(finger.rotation.x, finger.rotation.y, finger.rotation.z, finger.rotation.w)
      })
      bar.position.z = position.z
      trolley.position.set(position.x, GANTRY_Y - 0.04, position.z)
      const length = Math.max(0.02, GANTRY_Y - 0.06 - position.y)
      cable.position.set(position.x, position.y + length / 2, position.z)
      cable.scale.y = length
      // ねらいの目印は、動かしているあいだだけ出す。
      beam.visible = aiming
      ring.visible = aiming
      const drop = Math.max(0.01, position.y - PICK_Y)
      beam.position.set(position.x, PICK_Y + drop / 2, position.z)
      beam.scale.y = drop
      ring.position.set(position.x, 0.012, position.z)
    },
    syncPrizes(prizes: readonly PrizeView[]) {
      for (const [id, entry] of prizeMeshes) {
        let index = 0
        for (const prize of prizes) {
          if (prize.species !== id) continue
          dummy.position.set(prize.position.x, prize.position.y, prize.position.z)
          dummy.quaternion.set(prize.rotation.x, prize.rotation.y, prize.rotation.z, prize.rotation.w)
          dummy.scale.setScalar(1)
          dummy.updateMatrix()
          entry.meshes.forEach((mesh, part) => {
            if (index >= mesh.count) return
            mesh.setMatrixAt(index, scratch.multiplyMatrices(dummy.matrix, entry.parts[part]!.local))
          })
          index++
        }
        for (const mesh of entry.meshes) {
          for (let rest = index; rest < mesh.count; rest++) mesh.setMatrixAt(rest, hidden)
          mesh.instanceMatrix.needsUpdate = true
        }
      }
    },
    /** 取れたときの紙ふぶき。 */
    burst(position: { x: number; y: number; z: number }, amount = 20) {
      for (let i = 0; i < amount && particles.length < 48; i++) {
        const angle = (i / amount) * Math.PI * 2
        particles.push({
          life: 0,
          span: 1 + (i % 5) * 0.12,
          position: new THREE.Vector3(position.x, position.y + 0.05, position.z),
          velocity: new THREE.Vector3(Math.cos(angle) * 0.5, 0.9 + (i % 3) * 0.25, Math.sin(angle) * 0.5),
          spin: (i % 2 ? 1 : -1) * 7,
          scale: 1,
        })
      }
    },
    /** ぶつかったときの小さなほこり。 */
    dust(position: { x: number; y: number; z: number }, strength: number) {
      for (let i = 0; i < 3 && particles.length < 48; i++) {
        const angle = Math.random() * Math.PI * 2
        particles.push({
          life: 0,
          span: 0.34,
          position: new THREE.Vector3(position.x, position.y, position.z),
          velocity: new THREE.Vector3(Math.cos(angle) * 0.3 * strength, 0.3 * strength, Math.sin(angle) * 0.3 * strength),
          spin: 3,
          scale: 0.7,
        })
      }
    },
    render(dt: number, reducedMotion: boolean) {
      if (particles.length) {
        for (let i = particles.length - 1; i >= 0; i--) {
          const particle = particles[i]!
          particle.life += dt
          if (particle.life > particle.span) { particles.splice(i, 1); continue }
          particle.velocity.y -= 3.4 * dt
          particle.position.addScaledVector(particle.velocity, dt)
        }
        particles.forEach((particle, index) => {
          const fade = 1 - particle.life / particle.span
          dummy.position.copy(particle.position)
          dummy.rotation.set(particle.life * particle.spin, particle.life * particle.spin * 0.7, 0)
          dummy.scale.setScalar(particle.scale * (0.5 + fade * 0.8))
          dummy.updateMatrix()
          confetti.setMatrixAt(index, dummy.matrix)
          confetti.setColorAt(index, paletteColors[index % paletteColors.length]!)
        })
        for (let rest = particles.length; rest < confetti.count; rest++) confetti.setMatrixAt(rest, hidden)
        confetti.instanceMatrix.needsUpdate = true
        if (confetti.instanceColor) confetti.instanceColor.needsUpdate = true
      }
      if (!reducedMotion) {
        twinkle += dt
        bulb.emissiveIntensity = 1 + Math.sin(twinkle * 3.4) * 0.5
        lamp.intensity = 1.35 + Math.sin(twinkle * 2) * 0.12
      }
      renderer.render(scene, camera)
    },
    stats() {
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }
    },
    dispose() {
      disposeObject(scene)
      environment.dispose()
      sun.shadow.map?.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

export type CraneScene = ReturnType<typeof createCraneScene>
