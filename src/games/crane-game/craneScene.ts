/**
 * クレーンゲーム機の見た目（Three.js）。
 * 物理の結果を受け取って描くだけで、ゲームの進行も物理も持たない。
 * 景品は種類ごと・材質ごとに1つの InstancedMesh へまとめ、景品が増えても描画回数が増えないようにしている。
 * 筐体の動かない部品も材質ごとに1つのメッシュへまとめる。
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BIN, CHUTE, prizeReach, type CraneMachine, type PrizeLook, type PrizeSpecies } from './craneMachines'
import { CLAW } from './craneRig'
import type { FingerView, PrizeView } from './craneWorld'

export type CraneView = 'front' | 'side'
/** タップした場所を拾う高さ。景品の山のてっぺんあたり。 */
export const PICK_Y = 0.12
const GANTRY_Y = 0.88
const MARQUEE_Y = 1.0
/** 看板の まんなかの高さ。天井の前へ 出して 文字が かくれないようにする。 */
const SIGN_Y = MARQUEE_Y + 0.07
/** 筐体を置いている部屋の床の高さ。 */
const GROUND_Y = CHUTE.floor - 0.42

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
  materials.forEach(material => {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose()
    material.dispose()
  })
}

/** 継ぎ目で分かれた頂点をまとめて法線を取りなおし、変形した形でもつるんと見えるようにする。 */
function smooth(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.deleteAttribute('normal')
  geometry.deleteAttribute('uv')
  const merged = mergeVertices(geometry, 1e-5)
  geometry.dispose()
  merged.computeVertexNormals()
  return merged
}

/** 形を1つにまとめられるよう、位置と法線だけのインデックスなしの形へそろえる。 */
function bake(geometry: THREE.BufferGeometry, local: THREE.Matrix4, keepUv = false): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  for (const name of Object.keys(flat.attributes)) {
    if (name !== 'position' && name !== 'normal' && !(keepUv && name === 'uv')) flat.deleteAttribute(name)
  }
  flat.clearGroups()
  flat.applyMatrix4(local)
  return flat
}

/** 同じ材質の部品を1つの形にまとめる。材質が同じなら描画1回で済む。 */
function mergeByMaterial(parts: readonly Part[]): Part[] {
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>()
  for (const part of parts) {
    const list = groups.get(part.material) ?? []
    list.push(bake(part.geometry, part.local))
    groups.set(part.material, list)
    part.geometry.dispose()
  }
  const identity = new THREE.Matrix4()
  return [...groups].map(([material, list]) => {
    const geometry = mergeGeometries(list)
    list.forEach(item => item.dispose())
    return { geometry, material, local: identity }
  })
}

const ball = (r: number, width = 28, height = 18) => new THREE.SphereGeometry(r, width, height)
/** 丸いものを ひらたく・ほそながくした形（ほっぺ、翼、葉っぱなど）。 */
const blob = (r: number, sx: number, sy: number, sz: number) => ball(r, 16, 12).scale(sx, sy, sz)

/** りんご。上下がすこしくぼんだ まるい形を、輪郭の回転で作る。 */
function appleGeometry(r: number) {
  const points: THREE.Vector2[] = []
  const steps = 32
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI
    const bulge = 1 + 0.07 * Math.sin(t) * Math.max(0, -Math.cos(t))
    let y = -Math.cos(t) * r * 0.94
    y -= r * 0.2 * Math.exp(-(((Math.PI - t) / 0.42) ** 2))
    y += r * 0.1 * Math.exp(-((t / 0.36) ** 2))
    points.push(new THREE.Vector2(Math.max(Math.sin(t) * r * bulge, 1e-4), y))
  }
  return smooth(new THREE.LatheGeometry(points, 44))
}

/**
 * バナナ。弓なりの芯にそって、りょうはしが細くなる五角ぎみの輪を並べて作る。
 * 物理のカプセル（y軸）より少し長く細くして、芯を z の＋側へ大きく曲げる。
 * カプセルは横にねかせて置くので、z へ曲げると 床の上で横向きの弓なりになる。y の＋側が へた。
 */
function bananaGeometry(r: number, half: number) {
  const length = half + r * 1.6
  const sag = r * 2.3
  const rings = 40
  const sides = 20
  const center = (u: number) => new THREE.Vector3(0, u * length, sag * (u * u - 0.36))
  const tangent = (u: number) => new THREE.Vector3(0, length, 2 * sag * u).normalize()
  const radius = (u: number) => r * 0.84 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 2.2)), 0.55)
  const positions: number[] = []
  const indices: number[] = []
  const side = new THREE.Vector3(1, 0, 0)
  for (let i = 1; i < rings; i++) {
    const u = -1 + (2 * i) / rings
    const c = center(u)
    const t = tangent(u)
    const n = new THREE.Vector3().crossVectors(t, side).normalize()
    const rad = radius(u)
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2
      // 五つの かどを うっすら出して、バナナらしい すじにする。
      const ridge = 1 + 0.06 * Math.cos(a * 5)
      const p = c.clone().addScaledVector(n, Math.cos(a) * rad * ridge).addScaledVector(side, Math.sin(a) * rad * ridge * 0.92)
      positions.push(p.x, p.y, p.z)
    }
  }
  const bottom = positions.length / 3
  const bottomTip = center(-1)
  positions.push(bottomTip.x, bottomTip.y, bottomTip.z)
  const top = bottom + 1
  const topTip = center(1)
  positions.push(topTip.x, topTip.y, topTip.z)
  const ringCount = rings - 1
  for (let i = 0; i < ringCount - 1; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j
      const b = i * sides + ((j + 1) % sides)
      const c = a + sides
      const d = b + sides
      indices.push(a, d, b, a, c, d)
    }
  }
  for (let j = 0; j < sides; j++) {
    indices.push(bottom, j, (j + 1) % sides)
    const last = (ringCount - 1) * sides
    indices.push(top, last + ((j + 1) % sides), last + j)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  // へたは さきっぽの向きのまま すこし のばす。
  const stemDirection = tangent(1)
  const stemLength = r * 0.75
  const stemAt = topTip.clone().addScaledVector(stemDirection, stemLength * 0.4)
  const stemTilt = Math.atan2(stemDirection.z, stemDirection.y)
  return {
    geometry,
    stem: matrix(stemAt.x, stemAt.y, stemAt.z, stemTilt, 0, 0),
    stemLength,
    tip: matrix(bottomTip.x, bottomTip.y, bottomTip.z),
  }
}

/** まるいクッキー。ふちが ふっくら、上が すこし もりあがった輪郭を回して作る。 */
function cookieGeometry(r: number, h: number) {
  const points: THREE.Vector2[] = [new THREE.Vector2(1e-4, -h)]
  const steps = 14
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * Math.PI
    points.push(new THREE.Vector2(r - h * 0.55 + Math.cos(a) * h * 0.55, Math.sin(a) * h * 0.92))
  }
  points.push(new THREE.Vector2(r * 0.55, h * 1.0), new THREE.Vector2(1e-4, h * 1.04))
  return smooth(new THREE.LatheGeometry(points, 40))
}

/** 景品の見た目。胴体のほかに耳や顔などの部品を、景品のローカル座標で並べる。 */
function prizeParts(species: PrizeSpecies): Part[] {
  const look = species.look as PrizeLook
  const plush = look === 'bear' || look === 'bunny' || look === 'chick'
  const glossy = look === 'marble' || look === 'egg'
  const body = new THREE.MeshPhysicalMaterial({
    color: species.color,
    roughness: plush ? 0.92 : glossy ? 0.16 : look === 'fruit' ? 0.38 : look === 'snack' ? 0.62 : 0.5,
    metalness: 0,
    clearcoat: glossy ? 1 : look === 'fruit' ? 0.6 : look === 'drink' ? 0.45 : 0,
    clearcoatRoughness: 0.18,
    sheen: plush ? 1 : 0,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color(species.color).lerp(new THREE.Color('#ffffff'), 0.6),
    ...(look === 'marble' ? { transparent: true, opacity: 0.6 } : {}),
  })
  const accent = new THREE.MeshPhysicalMaterial({
    color: species.accent,
    roughness: plush ? 0.88 : 0.42,
    clearcoat: plush ? 0 : 0.4,
    clearcoatRoughness: 0.28,
    sheen: plush ? 0.8 : 0,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(species.accent).lerp(new THREE.Color('#ffffff'), 0.5),
  })
  const eye = new THREE.MeshPhysicalMaterial({ color: '#2a1c17', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04 })
  const sparkle = new THREE.MeshBasicMaterial({ color: '#ffffff' })
  const blush = new THREE.MeshStandardMaterial({ color: '#ff98ad', roughness: 0.9, transparent: true, opacity: 0.72 })
  const stem = new THREE.MeshStandardMaterial({ color: '#5e3f24', roughness: 0.75 })
  const parts: Part[] = []
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, local: THREE.Matrix4) => parts.push({ geometry, material, local })
  /** 目。くろめに白い光を入れて、いきいきさせる。 */
  const eyes = (size: number, x: number, y: number, z: number) => {
    for (const side of [-1, 1]) {
      add(ball(size, 14, 10), eye, matrix(side * x, y, z))
      add(ball(size * 0.34, 8, 6), sparkle, matrix(side * x + size * 0.3, y + size * 0.36, z + size * 0.72))
    }
  }
  const cheeks = (size: number, x: number, y: number, z: number, ry: number) => {
    for (const side of [-1, 1]) add(blob(size, 1, 0.62, 0.3), blush, matrix(side * x, y, z, 0, side * ry, 0))
  }
  const reach = prizeReach(species.body)
  switch (look) {
    case 'bear': {
      // すわった くま。頭・胴・手足を 物理の球の中へおさめる。
      const r = reach
      const ribbon = new THREE.MeshPhysicalMaterial({ color: '#e9476f', roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 })
      add(ball(r * 0.54).scale(1, 1.06, 0.9), body, matrix(0, -r * 0.4, -r * 0.02))
      add(blob(r * 0.34, 1, 1.12, 0.42), accent, matrix(0, -r * 0.44, r * 0.4))
      add(ball(r * 0.5).scale(1.1, 0.96, 1), body, matrix(0, r * 0.34, r * 0.04))
      for (const side of [-1, 1]) {
        add(ball(r * 0.18, 16, 12).scale(1, 1, 0.8), body, matrix(side * r * 0.4, r * 0.76, -r * 0.02))
        add(blob(r * 0.11, 1, 1, 0.45), accent, matrix(side * r * 0.41, r * 0.77, r * 0.1))
        // うでは前へ出して、おなかの横で だっこしているように。
        add(new THREE.CapsuleGeometry(r * 0.14, r * 0.26, 6, 14), body, matrix(side * r * 0.5, -r * 0.3, r * 0.14, -0.55, 0, side * 0.45))
        // あしは前へ のばして すわらせる。足のうらだけ 色をかえる。
        add(new THREE.CapsuleGeometry(r * 0.16, r * 0.22, 6, 14), body, matrix(side * r * 0.3, -r * 0.76, r * 0.28, Math.PI / 2, 0, 0))
        add(blob(r * 0.11, 1, 1.1, 0.3), accent, matrix(side * r * 0.3, -r * 0.76, r * 0.6))
      }
      add(blob(r * 0.22, 1.2, 0.86, 0.8), accent, matrix(0, r * 0.2, r * 0.46))
      add(blob(r * 0.075, 1.3, 0.9, 0.9), eye, matrix(0, r * 0.28, r * 0.63))
      eyes(r * 0.068, r * 0.2, r * 0.42, r * 0.48)
      cheeks(r * 0.1, r * 0.34, r * 0.18, r * 0.44, 0.7)
      // くびの リボン。
      for (const side of [-1, 1]) add(blob(r * 0.12, 1.2, 0.8, 0.5), ribbon, matrix(side * r * 0.12, -r * 0.06, r * 0.42, 0, 0, side * 0.35))
      add(ball(r * 0.06, 12, 8), ribbon, matrix(0, -r * 0.06, r * 0.47))
      break
    }
    case 'bunny': {
      const r = species.body.form === 'capsule' ? species.body.radius : reach
      const half = species.body.form === 'capsule' ? species.body.half : r * 0.6
      add(new THREE.CapsuleGeometry(r, half * 2, 10, 28), body, matrix(0, 0, 0))
      for (const side of [-1, 1]) {
        const ear = matrix(side * r * 0.38, half + r * 0.82, 0, 0, 0, side * 0.26)
        add(new THREE.CapsuleGeometry(r * 0.17, r * 0.8, 6, 14), body, ear)
        add(new THREE.CapsuleGeometry(r * 0.09, r * 0.62, 5, 10).scale(1, 1, 0.5), accent, ear.clone().multiply(matrix(0, 0, r * 0.1)))
      }
      add(blob(r * 0.13, 1.2, 0.85, 0.8), accent, matrix(0, half * 0.5, r * 0.96))
      eyes(r * 0.1, r * 0.34, half * 0.9, r * 0.9)
      cheeks(r * 0.15, r * 0.6, half * 0.35, r * 0.78, 0.66)
      add(ball(r * 0.22, 14, 10), accent, matrix(0, -half * 0.4, -r * 0.98))
      break
    }
    case 'chick': {
      const r = reach
      add(ball(r), body, matrix(0, 0, 0))
      add(new THREE.ConeGeometry(r * 0.2, r * 0.36, 20, 1).scale(1, 1, 0.7), accent, matrix(0, 0.02 * r, r * 1.02, Math.PI / 2, 0, 0))
      for (const side of [-1, 1]) add(blob(r * 0.42, 0.45, 1, 1), body, matrix(side * r * 0.9, -r * 0.12, 0, 0, 0, side * -0.3))
      for (const tilt of [-0.4, 0, 0.4]) add(blob(r * 0.12, 0.5, 1.6, 0.5), body, matrix(tilt * r * 0.3, r * 1.02, 0, 0, 0, -tilt))
      eyes(r * 0.1, r * 0.34, r * 0.3, r * 0.85)
      cheeks(r * 0.14, r * 0.58, r * 0.05, r * 0.78, 0.64)
      break
    }
    case 'egg': {
      const r = species.body.form === 'capsule' ? species.body.radius : reach
      const half = species.body.form === 'capsule' ? species.body.half : r * 0.4
      // 上半分は すけたカプセル、下半分は色つき。まんなかの帯で つなぐ。
      const clear = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.32, depthWrite: false })
      const toy = new THREE.MeshPhysicalMaterial({ color: '#ffd166', roughness: 0.35, clearcoat: 0.6 })
      add(new THREE.SphereGeometry(r, 32, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), body, matrix(0, -half, 0))
      add(new THREE.CylinderGeometry(r, r, half, 32, 1, true), body, matrix(0, -half / 2, 0))
      add(new THREE.CylinderGeometry(r * 0.99, r * 0.99, 0.002, 32), accent, matrix(0, 0, 0))
      add(new THREE.SphereGeometry(r, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), clear, matrix(0, half, 0))
      add(new THREE.CylinderGeometry(r, r, half, 32, 1, true), clear, matrix(0, half / 2, 0))
      add(new THREE.TorusGeometry(r * 1.0, r * 0.09, 10, 40), accent, matrix(0, 0, 0, Math.PI / 2))
      // なかの おもちゃ。すけた上半分から のぞく。
      add(ball(r * 0.4, 18, 12), toy, matrix(0, r * 0.42, 0))
      eyes(r * 0.06, r * 0.14, r * 0.5, r * 0.34)
      break
    }
    case 'marble': {
      const r = reach
      add(ball(r, 36, 24), body, matrix(0, 0, 0))
      add(ball(r * 0.5, 22, 14), accent, matrix(0, 0, 0))
      break
    }
    case 'snack': {
      const half = species.body.form === 'box' ? species.body.half : { x: reach, y: reach, z: reach }
      const round = species.body.form === 'box' ? species.body.round : 0
      const hx = half.x + round
      const hy = half.y + round
      const hz = half.z + round
      if (species.id === 'cookie') {
        // チョコチップ クッキー。ひらたい円に、こげ茶の つぶを のせる。
        const cr = Math.min(hx, hz) * 1.02
        add(cookieGeometry(cr, hy), body, matrix(0, 0, 0))
        const chips: [number, number][] = [[0, 0], [0.5, 0.3], [-0.45, 0.42], [0.1, -0.55], [-0.52, -0.3], [0.6, -0.4], [-0.05, 0.62]]
        for (const [cx, cz] of chips) add(blob(cr * 0.12, 1.1, 0.6, 1), accent, matrix(cx * cr * 0.78, hy * 0.98, cz * cr * 0.78, 0, cx * 3, 0))
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3
          add(blob(cr * 0.09, 0.5, 0.9, 1), accent, matrix(Math.cos(a) * cr * 0.99, hy * (i % 2 ? 0.2 : -0.25), Math.sin(a) * cr * 0.99, 0, -a, 0))
        }
        break
      }
      // 板チョコ。右がわは赤い つつみ紙、左がわは ブロックの もようが見えている。
      const wrapper = new THREE.MeshPhysicalMaterial({ color: species.accent, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25 })
      const gold = new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.3, metalness: 0.75 })
      const foil = new THREE.MeshStandardMaterial({ color: '#e4e8ee', roughness: 0.22, metalness: 0.9 })
      const base = hy * 0.6
      add(new RoundedBoxGeometry(hx * 2, base * 2, hz * 2, 3, base * 0.4), body, matrix(0, -hy + base, 0))
      const cols = 3
      const rows = 2
      const cellX = (hx * 1.08) / cols
      const cellZ = (hz * 2) / rows
      for (let cx = 0; cx < cols; cx++) {
        for (let cz = 0; cz < rows; cz++) {
          const x = -hx + cellX * (cx + 0.5)
          const z = -hz + cellZ * (cz + 0.5)
          add(new RoundedBoxGeometry(cellX * 0.84, hy * 0.8, cellZ * 0.84, 2, hy * 0.2), body, matrix(x, -hy + base * 2 + hy * 0.25, z))
        }
      }
      const wrapStart = -hx + hx * 1.08
      const wrapWidth = hx - wrapStart
      const wrapCenter = (wrapStart + hx) / 2 + 0.001
      add(new RoundedBoxGeometry(wrapWidth * 2 * 0.5 + 0.004, hy * 2.04, hz * 2.06, 3, hy * 0.3), wrapper, matrix(wrapCenter, 0, 0))
      add(new THREE.BoxGeometry(wrapWidth * 0.3, hy * 2.08, hz * 2.1), gold, matrix(wrapCenter, 0, 0))
      add(new THREE.BoxGeometry(0.006, hy * 2.0, hz * 2.02), foil, matrix(wrapStart - 0.002, 0, 0))
      break
    }
    case 'drink': {
      // ジュースの紙パック。前とうしろに くだものの絵、上に ストロー。
      const half = species.body.form === 'box' ? species.body.half : { x: reach, y: reach * 1.4, z: reach }
      const round = species.body.form === 'box' ? species.body.round : 0
      const hx = half.x + round
      const hy = half.y + round
      const hz = half.z + round
      const fruit = new THREE.MeshPhysicalMaterial({ color: '#ff8a1f', roughness: 0.35, clearcoat: 0.6 })
      const leaf = new THREE.MeshStandardMaterial({ color: '#4caf50', roughness: 0.5 })
      const straw = new THREE.MeshPhysicalMaterial({ color: '#ff6f91', roughness: 0.35, clearcoat: 0.5 })
      add(new RoundedBoxGeometry(hx * 2, hy * 2, hz * 2, 3, Math.min(hx, hz) * 0.25), body, matrix(0, 0, 0))
      for (const side of [-1, 1]) {
        const face = side * hz
        add(new RoundedBoxGeometry(hx * 1.7, hy * 1.1, 0.006, 2, 0.0028), accent, matrix(0, -hy * 0.1, face, 0, 0, 0))
        add(blob(hx * 0.5, 1, 1, 0.3), fruit, matrix(0, -hy * 0.14, face + side * 0.004))
        add(blob(hx * 0.2, 1.4, 0.55, 0.25), leaf, matrix(hx * 0.2, hy * 0.26, face + side * 0.004, 0, 0, 0.5))
      }
      add(new THREE.CylinderGeometry(hx * 0.2, hx * 0.2, 0.004, 16), accent, matrix(hx * 0.4, hy, -hz * 0.3))
      add(new THREE.CylinderGeometry(hx * 0.09, hx * 0.09, hy * 0.7, 10), straw, matrix(hx * 0.4, hy * 1.3, -hz * 0.3))
      add(new THREE.CylinderGeometry(hx * 0.09, hx * 0.09, hy * 0.4, 10), straw, matrix(hx * 0.22, hy * 1.72, -hz * 0.3, 0, 0, 1.0))
      break
    }
    case 'fruit': {
      if (species.body.form === 'capsule') {
        // バナナ。弓なりの胴に、へたと さきっぽを つける。
        const { radius: r, half } = species.body
        const banana = bananaGeometry(r, half)
        add(banana.geometry, body, matrix(0, 0, 0))
        add(new THREE.CylinderGeometry(r * 0.2, r * 0.3, banana.stemLength, 10), accent, banana.stem)
        add(ball(r * 0.18, 12, 8), stem, banana.tip)
        break
      }
      const r = reach
      if (species.id === 'apple') add(appleGeometry(r), body, matrix(0, 0, 0))
      else {
        // みかん。上下が ひらたく、てっぺんに へた。
        add(ball(r, 36, 24).scale(1, 0.86, 1), body, matrix(0, 0, 0))
        add(new THREE.CylinderGeometry(r * 0.16, r * 0.2, r * 0.06, 10), accent, matrix(0, r * 0.86, 0))
      }
      const top = species.id === 'apple' ? r * 0.76 : r * 0.86
      add(new THREE.CylinderGeometry(r * 0.05, r * 0.07, r * 0.42, 10), stem, matrix(0, top + r * 0.16, 0, 0, 0, 0.15))
      add(blob(r * 0.3, 1, 0.14, 0.5), accent, matrix(r * 0.24, top + r * 0.18, 0, 0, 0, -0.5))
      break
    }
  }
  return parts
}

/** 絵を描いたキャンバスをテクスチャにする。 */
function canvasTexture(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context) draw(context)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  context.beginPath()
  context.moveTo(x + r, y)
  context.arcTo(x + w, y, x + w, y + h, r)
  context.arcTo(x + w, y + h, x, y + h, r)
  context.arcTo(x, y + h, x, y, r)
  context.arcTo(x, y, x + w, y, r)
  context.closePath()
}

function shade(color: string, amount: number): string {
  const base = new THREE.Color(color)
  return `#${(amount >= 0 ? base.lerp(new THREE.Color('#ffffff'), amount) : base.multiplyScalar(1 + amount)).getHexString()}`
}

export function createCraneScene(container: HTMLDivElement, machine: CraneMachine) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.setAttribute('aria-hidden', 'true')
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  // ゲームセンターの かべ。上は あわいピンク、下へいくほど あたたかい色。
  const backdrop = canvasTexture(8, 256, context => {
    const gradient = context.createLinearGradient(0, 0, 0, 256)
    gradient.addColorStop(0, '#fbe3ee')
    gradient.addColorStop(0.55, '#f7e6f0')
    gradient.addColorStop(1, '#f1d7c6')
    context.fillStyle = gradient
    context.fillRect(0, 0, 8, 256)
  })
  scene.background = backdrop
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04)
  scene.environment = environment.texture
  scene.environmentIntensity = 0.5
  room.dispose()
  pmrem.dispose()

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 40)
  const target = new THREE.Vector3(0, 0.36, 0)
  const sun = new THREE.DirectionalLight('#fff4e2', 2.2)
  sun.position.set(-1.3, 3.2, 2.1)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -1.2, right: 1.2, top: 1.4, bottom: -1.2, near: 0.6, far: 6.5 })
  sun.shadow.camera.updateProjectionMatrix()
  sun.shadow.normalBias = 0.015
  sun.shadow.bias = -0.0003
  sun.shadow.radius = 3
  // うしろから あてる光で、景品や筐体のふちを きわだたせる。
  const rim = new THREE.DirectionalLight('#dfe9ff', 0.6)
  rim.position.set(1.6, 1.8, -2.4)
  scene.add(sun, rim, new THREE.HemisphereLight('#fff0f6', '#cdbba6', 0.7))
  // 筐体の中を照らす電球。影は落とさないので負荷は小さい。
  const lamp = new THREE.PointLight('#ffe6b4', 1.6, 3, 1.6)
  lamp.position.set(0, MARQUEE_Y - 0.2, 0.1)
  scene.add(lamp)

  const cabinet = new THREE.Group()
  scene.add(cabinet)
  const metal = new THREE.MeshStandardMaterial({ color: '#dfe4ea', roughness: 0.26, metalness: 0.85 })
  const frame = new THREE.MeshPhysicalMaterial({ color: machine.color, roughness: 0.36, clearcoat: 0.7, clearcoatRoughness: 0.2 })
  const frameDark = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(machine.color).multiplyScalar(0.72), roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3 })
  const trim = new THREE.MeshStandardMaterial({ color: '#fff6e4', roughness: 0.4 })
  const glass = new THREE.MeshPhysicalMaterial({ color: '#eef8ff', roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide })
  const bulbOn = new THREE.MeshStandardMaterial({ color: '#fff6d4', emissive: '#ffd36b', emissiveIntensity: 1.3, roughness: 0.25 })
  const bulbOff = new THREE.MeshStandardMaterial({ color: '#fff0f4', emissive: '#ff8fb1', emissiveIntensity: 0.6, roughness: 0.25 })
  const hole = new THREE.MeshStandardMaterial({ color: '#3a2e38', roughness: 0.6, metalness: 0.3 })

  // 動かない部品は材質ごとにためて、最後に1つずつのメッシュへまとめる。
  const statics = new Map<THREE.Material, { geometries: THREE.BufferGeometry[]; cast: boolean }>()
  const place = (geometry: THREE.BufferGeometry, material: THREE.Material, local: THREE.Matrix4, cast = true) => {
    const entry = statics.get(material) ?? { geometries: [], cast }
    entry.geometries.push(bake(geometry, local))
    statics.set(material, entry)
    geometry.dispose()
  }
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, cast = true, round = 0) => {
    const geometry = round > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(round, w / 2, h / 2, d / 2) * 0.999) : new THREE.BoxGeometry(w, h, d)
    place(geometry, material, matrix(x, y, z), cast)
  }
  /** 絵を貼った板。テクスチャが違うので まとめずに置く。 */
  const panel = (w: number, h: number, texture: THREE.Texture, local: THREE.Matrix4, emissive = 0) => {
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, ...(emissive ? { emissive: '#ffffff', emissiveMap: texture, emissiveIntensity: emissive } : {}) })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
    mesh.applyMatrix4(local)
    mesh.receiveShadow = true
    cabinet.add(mesh)
    return mesh
  }

  // 部屋の床。筐体の影を受けて、宙に浮いて見えないようにする。
  const floorTexture = canvasTexture(256, 256, context => {
    const gradient = context.createRadialGradient(128, 128, 10, 128, 128, 128)
    gradient.addColorStop(0, '#f6e4da')
    gradient.addColorStop(0.7, '#f1dcd2')
    gradient.addColorStop(1, 'rgba(241, 215, 198, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 256, 256)
  })
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), new THREE.MeshStandardMaterial({ map: floorTexture, transparent: true, roughness: 0.85, depthWrite: false }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = GROUND_Y
  floor.receiveShadow = true
  scene.add(floor)

  // 景品を並べる床。穴の部分だけ抜いた2枚に、やわらかい もようを描く。
  const matTexture = canvasTexture(256, 256, context => {
    context.fillStyle = '#fff4e2'
    context.fillRect(0, 0, 256, 256)
    context.fillStyle = shade(machine.color, 0.5)
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      context.beginPath()
      context.arc(x * 32 + (y % 2 ? 16 : 0) + 8, y * 32 + 16, 6, 0, Math.PI * 2)
      context.fill()
    }
  })
  matTexture.wrapS = matTexture.wrapT = THREE.RepeatWrapping
  const matMaterial = new THREE.MeshStandardMaterial({ map: matTexture, roughness: 0.92 })
  const matSlab = (w: number, d: number, x: number, z: number) => {
    const texture = matTexture.clone()
    texture.repeat.set(w * 4, d * 4)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), [matMaterial, matMaterial, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92 }), matMaterial, matMaterial, matMaterial])
    mesh.position.set(x, -0.02, z)
    mesh.receiveShadow = true
    cabinet.add(mesh)
  }
  matSlab(BIN.x - CHUTE.maxX, BIN.z * 2, (CHUTE.maxX + BIN.x) / 2, 0)
  matSlab(CHUTE.maxX - CHUTE.minX, BIN.z + CHUTE.minZ, (CHUTE.minX + CHUTE.maxX) / 2, (CHUTE.minZ - BIN.z) / 2)
  // 穴のまわりの ふちと、ななめの しきり。落ちる場所がひと目でわかるようにする。
  const chuteX = (CHUTE.minX + CHUTE.maxX) / 2
  const chuteZ = (CHUTE.minZ + CHUTE.maxZ) / 2
  const chuteW = CHUTE.maxX - CHUTE.minX
  const chuteD = CHUTE.maxZ - CHUTE.minZ
  const rimMaterial = new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#b8741a', emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.2 })
  box(chuteW + 0.018, 0.02, 0.018, chuteX + 0.009, 0.01, CHUTE.minZ - 0.009, rimMaterial, true, 0.006)
  box(chuteW + 0.018, 0.02, 0.018, chuteX + 0.009, 0.01, CHUTE.maxZ - 0.009, rimMaterial, true, 0.006)
  box(0.018, 0.02, chuteD, CHUTE.maxX + 0.009, 0.01, chuteZ, rimMaterial, true, 0.006)
  box(0.018, 0.02, chuteD, CHUTE.minX + 0.009, 0.01, chuteZ, rimMaterial, true, 0.006)
  // 穴の まわりの ガードの すきとおった板。
  box(0.008, 0.07, chuteD, CHUTE.maxX + 0.02, 0.035, chuteZ, glass, false)
  box(chuteW, 0.07, 0.008, chuteX, 0.035, CHUTE.minZ - 0.02, glass, false)

  // 景品の床の下をふさぐ本体。穴の下だけは空けて、受け皿が手前から見えるようにする。
  box(BIN.x - CHUTE.maxX, 0.35, BIN.z * 2, (CHUTE.maxX + BIN.x) / 2, -0.215, 0, frame)
  box(chuteW, 0.35, BIN.z + CHUTE.minZ, chuteX, -0.215, (CHUTE.minZ - BIN.z) / 2, frame)
  // 受け皿と、その下の台。
  box(chuteW + 0.02, 0.03, chuteD + 0.02, chuteX, CHUTE.floor - 0.015, chuteZ, frameDark)
  box(BIN.x * 2 + 0.08, 0.06, BIN.z * 2 + 0.08, 0, CHUTE.floor - 0.05, 0, frame, true, 0.02)
  box(BIN.x * 2 - 0.02, 0.28, BIN.z * 2 - 0.02, 0, CHUTE.floor - 0.22, 0, frameDark)
  box(BIN.x * 2 + 0.12, 0.06, BIN.z * 2 + 0.12, 0, CHUTE.floor - 0.39, 0, frame, true, 0.02)
  // 下の台の前に ひかえめな ライン飾り。
  box(BIN.x * 2 - 0.1, 0.014, 0.006, 0, CHUTE.floor - 0.16, BIN.z - 0.008, trim, false, 0.003)
  box(BIN.x * 2 - 0.1, 0.014, 0.006, 0, CHUTE.floor - 0.28, BIN.z - 0.008, trim, false, 0.003)
  // 取り出し口のまわりの わく。下の箱の内側（穴の下）が見えるように、手前の面だけガラスにする。
  box(chuteW, 0.34, 0.01, chuteX, CHUTE.floor / 2 - 0.02, BIN.z + 0.01, glass, false)
  box(chuteW + 0.03, 0.02, 0.03, chuteX, CHUTE.floor + 0.005, BIN.z + 0.01, trim, true, 0.008)
  box(0.02, 0.36, 0.03, CHUTE.maxX + 0.005, CHUTE.floor / 2 - 0.02, BIN.z + 0.01, trim, true, 0.008)
  // 景品窓の4面と、ガラスのふち。
  box(0.012, BIN.height, BIN.z * 2, -BIN.x - 0.006, BIN.height / 2, 0, glass, false)
  box(0.012, BIN.height, BIN.z * 2, BIN.x + 0.006, BIN.height / 2, 0, glass, false)
  box(BIN.x * 2, BIN.height, 0.012, 0, BIN.height / 2, BIN.z + 0.006, glass, false)
  box(BIN.x * 2, 0.022, 0.024, 0, 0.011, BIN.z + 0.006, metal, true, 0.006)
  box(0.024, 0.022, BIN.z * 2, -BIN.x - 0.006, 0.011, 0, metal, true, 0.006)
  box(0.024, 0.022, BIN.z * 2, BIN.x + 0.006, 0.011, 0, metal, true, 0.006)
  // うしろの かべは、きかいの色に 水玉と ほしの もよう。
  const backTexture = canvasTexture(512, 384, context => {
    const gradient = context.createLinearGradient(0, 0, 0, 384)
    gradient.addColorStop(0, shade(machine.color, 0.35))
    gradient.addColorStop(1, shade(machine.color, 0.05))
    context.fillStyle = gradient
    context.fillRect(0, 0, 512, 384)
    context.fillStyle = 'rgba(255, 255, 255, 0.28)'
    for (let y = 0; y < 8; y++) for (let x = 0; x < 11; x++) {
      context.beginPath()
      context.arc(x * 48 + (y % 2 ? 24 : 0), y * 48 + 24, 9, 0, Math.PI * 2)
      context.fill()
    }
    context.fillStyle = 'rgba(255, 246, 200, 0.85)'
    for (const [sx, sy, size] of [[90, 90, 26], [410, 120, 20], [260, 250, 30], [120, 300, 16], [430, 310, 22]] as const) {
      context.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const radius = i % 2 ? size * 0.45 : size
        context.lineTo(sx + Math.cos(a) * radius, sy + Math.sin(a) * radius)
      }
      context.closePath()
      context.fill()
    }
  })
  box(BIN.x * 2, BIN.height, 0.016, 0, BIN.height / 2, -BIN.z - 0.016, frameDark, false)
  panel(BIN.x * 2, BIN.height, backTexture, matrix(0, BIN.height / 2, -BIN.z - 0.007))
  // 四隅の柱と天井。
  for (const x of [-BIN.x, BIN.x]) for (const z of [-BIN.z, BIN.z]) {
    place(new THREE.CylinderGeometry(0.026, 0.026, BIN.height + 0.12, 16), metal, matrix(x, BIN.height / 2, z))
  }
  box(BIN.x * 2 + 0.1, 0.05, BIN.z * 2 + 0.1, 0, BIN.height + 0.04, 0, frame, true, 0.018)
  // ガントリーが走る左右のレール。
  for (const x of [-BIN.x + 0.03, BIN.x - 0.03]) box(0.024, 0.024, BIN.z * 2 - 0.02, x, GANTRY_Y, 0, metal, true, 0.008)
  // 看板。遊ぶ人の側を向け、きかいの名前を書く。
  box(BIN.x * 2 + 0.02, 0.24, 0.08, 0, SIGN_Y, BIN.z - 0.01, frame, true, 0.03)
  const signTexture = canvasTexture(512, 128, context => {
    context.fillStyle = machine.color
    context.fillRect(0, 0, 512, 128)
    const gradient = context.createLinearGradient(0, 0, 0, 128)
    gradient.addColorStop(0, '#fffaf0')
    gradient.addColorStop(1, '#ffe9c9')
    roundRect(context, 4, 4, 504, 120, 40)
    context.fillStyle = gradient
    context.fill()
    context.lineWidth = 6
    context.strokeStyle = shade(machine.color, -0.1)
    context.stroke()
    context.font = '900 72px "Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", "Rounded Mplus 1c", "Noto Sans JP", sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineJoin = 'round'
    context.lineWidth = 12
    context.strokeStyle = '#ffffff'
    context.strokeText(machine.label, 256, 68)
    context.fillStyle = shade(machine.color, -0.3)
    context.fillText(machine.label, 256, 68)
    context.fillStyle = '#ffc43d'
    for (const sx of [44, 468]) {
      context.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const radius = i % 2 ? 9 : 20
        context.lineTo(sx + Math.cos(a) * radius, 64 + Math.sin(a) * radius)
      }
      context.closePath()
      context.fill()
    }
  })
  panel(BIN.x * 1.6, 0.14, signTexture, matrix(0, SIGN_Y - 0.01, BIN.z + 0.032), 0.35)
  // 看板のまわりの電球。2組を たがいちがいに点滅させる。
  const bulbSpots: THREE.Matrix4[] = []
  const span = BIN.x * 2 - 0.06
  for (let i = 0; i < 14; i++) bulbSpots.push(matrix(-span / 2 + (i * span) / 13, SIGN_Y + 0.1, BIN.z + 0.035))
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) bulbSpots.push(matrix(side * (BIN.x * 0.8 + 0.035), SIGN_Y + 0.04 - i * 0.05, BIN.z + 0.035))
  for (const [group, material] of [bulbOn, bulbOff].entries()) {
    const spots = bulbSpots.filter((_, index) => index % 2 === group)
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.016, 12, 8), material, spots.length)
    spots.forEach((spot, index) => mesh.setMatrixAt(index, spot))
    cabinet.add(mesh)
  }
  // 操作台。遊ぶのは画面のボタンだが、機械らしさのために レバーと ボタンを置く。
  const panelTop = CHUTE.floor - 0.06
  box(0.64, 0.1, 0.16, 0.16, panelTop - 0.05, BIN.z + 0.06, frame, true, 0.03)
  box(0.6, 0.012, 0.13, 0.16, panelTop + 0.002, BIN.z + 0.065, trim, true, 0.005)
  place(new THREE.CylinderGeometry(0.03, 0.036, 0.012, 20), metal, matrix(-0.02, panelTop + 0.012, BIN.z + 0.07))
  place(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 10), metal, matrix(-0.02, panelTop + 0.05, BIN.z + 0.07))
  place(new THREE.SphereGeometry(0.024, 18, 12), new THREE.MeshPhysicalMaterial({ color: '#f05b5b', roughness: 0.2, clearcoat: 1 }), matrix(-0.02, panelTop + 0.09, BIN.z + 0.07))
  for (const [index, color] of ['#4fa3f0', '#ffc93d'].entries()) {
    const buttonMaterial = new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, clearcoat: 1, emissive: color, emissiveIntensity: 0.15 })
    place(new THREE.CylinderGeometry(0.034, 0.034, 0.014, 20), metal, matrix(0.18 + index * 0.14, panelTop + 0.012, BIN.z + 0.07))
    place(new THREE.SphereGeometry(0.03, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1), buttonMaterial, matrix(0.18 + index * 0.14, panelTop + 0.018, BIN.z + 0.07))
  }
  // コインの いれぐち。
  box(0.08, 0.1, 0.012, 0.3, CHUTE.floor - 0.2, BIN.z - 0.002, metal, false, 0.01)
  box(0.008, 0.05, 0.004, 0.3, CHUTE.floor - 0.2, BIN.z + 0.005, hole, false)

  for (const [material, entry] of statics) {
    const geometry = mergeGeometries(entry.geometries)
    entry.geometries.forEach(item => item.dispose())
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = entry.cast
    mesh.receiveShadow = true
    cabinet.add(mesh)
  }

  // アーム。ガントリー（横棒）と台車、ケーブル、爪。
  const gantry = new THREE.Group()
  scene.add(gantry)
  const bar = new THREE.Mesh(new RoundedBoxGeometry(BIN.x * 2 - 0.04, 0.03, 0.04, 3, 0.012), metal)
  bar.position.y = GANTRY_Y
  bar.castShadow = true
  gantry.add(bar)
  const trolley = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.06, 0.1, 3, 0.02), frame)
  trolley.position.y = GANTRY_Y - 0.04
  trolley.castShadow = true
  gantry.add(trolley)
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1, 8), new THREE.MeshStandardMaterial({ color: '#7d848c', roughness: 0.45, metalness: 0.6 }))
  gantry.add(cable)

  const claw = new THREE.Group()
  scene.add(claw)
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(CLAW.hubRadius, CLAW.hubRadius * 0.82, CLAW.hubHalf * 2, 24), metal)
  hub.castShadow = true
  claw.add(hub)
  const collar = new THREE.Mesh(new THREE.TorusGeometry(CLAW.hubRadius * 0.98, CLAW.hubRadius * 0.12, 8, 28), frame)
  collar.rotation.x = Math.PI / 2
  collar.position.y = -CLAW.hubHalf * 0.2
  claw.add(collar)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(CLAW.hubRadius * 0.62, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#f5b02e', roughness: 0.3, metalness: 0.35, clearcoat: 0.8 }))
  cap.position.y = CLAW.hubHalf
  claw.add(cap)
  const armMaterial = new THREE.MeshStandardMaterial({ color: '#eef1f5', roughness: 0.22, metalness: 0.8 })
  const padMaterial = new THREE.MeshStandardMaterial({ color: '#ff8fab', roughness: 0.7 })
  const fingerGroups = [0, 1, 2].map(() => {
    const group = new THREE.Group()
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(CLAW.armRadius, CLAW.arm, 5, 12), armMaterial)
    arm.position.y = -CLAW.arm / 2
    arm.castShadow = true
    const joint = new THREE.Mesh(new THREE.SphereGeometry(CLAW.armRadius * 1.5, 12, 8), metal)
    joint.position.y = -CLAW.arm
    const tip = new THREE.Mesh(new THREE.CapsuleGeometry(CLAW.tipRadius, CLAW.tip, 5, 12), armMaterial)
    tip.position.set(-Math.sin(CLAW.tipBend) * CLAW.tip / 2, -CLAW.arm - Math.cos(CLAW.tipBend) * CLAW.tip / 2, 0)
    tip.rotation.z = -CLAW.tipBend
    tip.castShadow = true
    // つめの さきの ゴム。
    const pad = new THREE.Mesh(new THREE.SphereGeometry(CLAW.tipRadius * 1.25, 10, 8), padMaterial)
    pad.position.set(-Math.sin(CLAW.tipBend) * CLAW.tip, -CLAW.arm - Math.cos(CLAW.tipBend) * CLAW.tip, 0)
    group.add(arm, joint, tip, pad)
    claw.add(group)
    return group
  })
  // 落とす位置の目印。アームの真下へのばした光の柱と、床の輪。
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd86b', transparent: true, opacity: 0.3, depthWrite: false }))
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.008, 6, 32), new THREE.MeshBasicMaterial({ color: '#ff9f43', transparent: true, opacity: 0.85, depthWrite: false }))
  ring.rotation.x = -Math.PI / 2
  scene.add(beam, ring)

  // 景品。種類ごとに、同じ材質の部品を1つの InstancedMesh へまとめる。
  const counts = new Map<string, number>()
  for (const slot of machine.slots) counts.set(slot.species, (counts.get(slot.species) ?? 0) + 1)
  const prizeGroup = new THREE.Group()
  scene.add(prizeGroup)
  const prizeMeshes = new Map<string, { parts: Part[]; meshes: THREE.InstancedMesh[] }>()
  for (const species of machine.species) {
    const capacity = Math.max(1, counts.get(species.id) ?? 0)
    const parts = mergeByMaterial(prizeParts(species))
    const meshes = parts.map(part => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity)
      const see = part.material.transparent && part.material.opacity < 0.5
      mesh.castShadow = !see
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      if (see) mesh.renderOrder = 1
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
  const machineBounds = new THREE.Box3(new THREE.Vector3(-0.7, -0.78, -0.52), new THREE.Vector3(0.7, 1.2, 0.52))
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
        const wave = Math.sin(twinkle * 3.4)
        bulbOn.emissiveIntensity = 1 + wave * 0.6
        bulbOff.emissiveIntensity = 1 - wave * 0.6
        lamp.intensity = 1.55 + Math.sin(twinkle * 2) * 0.12
      }
      renderer.render(scene, camera)
    },
    stats() {
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }
    },
    dispose() {
      disposeObject(scene)
      backdrop.dispose()
      environment.dispose()
      sun.shadow.map?.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

export type CraneScene = ReturnType<typeof createCraneScene>
