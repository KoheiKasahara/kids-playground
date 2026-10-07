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
import { clampZoom, MAX_ZOOM } from './craneZoom'
import type { FingerView, PrizeView } from './craneWorld'

export type CraneView = 'front' | 'side'
/** タップした場所を拾う高さ。景品の山のてっぺんあたり。 */
export const PICK_Y = 0.12
const GANTRY_Y = 0.88
/** 寄ったときに見る高さ。景品の山とアームの両方が入る。 */
const ZOOM_FOCUS_Y = 0.4
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
  const plush = look === 'bear' || look === 'bunny' || look === 'chick' || look === 'penguin' || look === 'octopus' || look === 'puffer'
  const glossy = look === 'marble' || look === 'egg'
  /** うちゅうの おもちゃは、つやのある プラスチック。 */
  const toyPlastic = look === 'planet' || look === 'rocket' || look === 'ufo'
  const body = new THREE.MeshPhysicalMaterial({
    color: species.color,
    roughness: plush ? 0.92 : glossy ? 0.16 : toyPlastic ? 0.3 : look === 'fruit' ? 0.38 : look === 'snack' ? 0.62 : 0.5,
    metalness: look === 'ufo' ? 0.35 : 0,
    clearcoat: glossy ? 1 : toyPlastic ? 0.85 : look === 'fruit' ? 0.6 : look === 'drink' ? 0.45 : 0,
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
    case 'penguin': {
      // すわった まんまる ペンギン。紺の体に 白いおなか、オレンジの くちばしと あし、首に マフラー。
      const r = reach
      const beak = new THREE.MeshPhysicalMaterial({ color: '#ffa53a', roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color('#ffe2b8') })
      const scarf = new THREE.MeshPhysicalMaterial({ color: '#ff5f7e', roughness: 0.85, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffd0da') })
      add(ball(r * 0.94, 24, 16).scale(1, 1.04, 0.94), body, matrix(0, 0, -r * 0.02))
      // おなかと 顔の白い ところ。体から すこしだけ 前へ ふくらませる。
      add(ball(r * 0.78, 18, 12).scale(0.92, 1.0, 0.62), accent, matrix(0, -r * 0.14, r * 0.42))
      for (const side of [-1, 1]) add(blob(r * 0.3, 1, 1.05, 0.5), accent, matrix(side * r * 0.24, r * 0.4, r * 0.66))
      eyes(r * 0.085, r * 0.24, r * 0.44, r * 0.8)
      add(new THREE.ConeGeometry(r * 0.13, r * 0.26, 16, 1).scale(1.25, 1, 0.7), beak, matrix(0, r * 0.26, r * 0.92, Math.PI / 2, 0, 0))
      cheeks(r * 0.11, r * 0.46, r * 0.2, r * 0.74, 0.62)
      add(new THREE.TorusGeometry(r * 0.7, r * 0.11, 8, 28), scarf, matrix(0, r * 0.06, -r * 0.02, Math.PI / 2 + 0.1, 0, 0))
      add(blob(r * 0.16, 0.8, 1.5, 0.45), scarf, matrix(r * 0.42, -r * 0.18, r * 0.62, 0.15, 0.5, 0.3))
      for (const side of [-1, 1]) {
        // パタパタの ヒレ（つばさ）と、ちょこんと 前へ 出た あし。
        add(blob(r * 0.42, 0.28, 1, 0.62), body, matrix(side * r * 0.9, -r * 0.18, 0, 0, 0, side * 0.42))
        add(blob(r * 0.18, 1, 0.42, 1.5), beak, matrix(side * r * 0.3, -r * 0.88, r * 0.46, 0.15, side * 0.25, 0))
      }
      add(blob(r * 0.14, 0.5, 1.4, 0.5), body, matrix(r * 0.04, r * 1.0, -r * 0.05, 0, 0, -0.35))
      break
    }
    case 'octopus': {
      // はちまきの タコさん。丸い頭の下から 8本の あしが くるんと 出ている。
      const r = reach
      const band = new THREE.MeshPhysicalMaterial({ color: '#fffaf4', roughness: 0.82, sheen: 0.8, sheenColor: new THREE.Color('#ffffff') })
      const knot = new THREE.MeshPhysicalMaterial({ color: '#3d8fe0', roughness: 0.8, sheen: 0.6, sheenColor: new THREE.Color('#cfe6ff') })
      add(ball(r * 0.72, 24, 16).scale(1, 1.12, 1), body, matrix(0, r * 0.2, -r * 0.04))
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8
        const around = new THREE.Matrix4().makeRotationY(-a)
        const leg = around.clone().multiply(matrix(r * 0.48, -r * 0.6, 0, 0, 0, 1.0))
        add(new THREE.CapsuleGeometry(r * 0.14, r * 0.5, 4, 10), body, leg)
        // あしの さきは くるっと 上へ まく。うらの いぼいぼは 明るい色。
        add(ball(r * 0.12, 10, 6), body, around.clone().multiply(matrix(r * 0.82, -r * 0.7, 0)))
        // いぼは 小さいので 粗い球で じゅうぶん。数が多いぶん 三角形を へらす。
        add(ball(r * 0.06, 8, 5).scale(1, 0.5, 1), accent, around.clone().multiply(matrix(r * 0.6, -r * 0.83, 0)))
        add(ball(r * 0.055, 8, 5).scale(1, 0.5, 1), accent, around.clone().multiply(matrix(r * 0.74, -r * 0.82, 0)))
      }
      add(new THREE.TorusGeometry(r * 0.7, r * 0.075, 8, 32), band, matrix(0, r * 0.44, -r * 0.04, Math.PI / 2 + 0.08, 0, 0))
      for (const side of [-1, 1]) add(blob(r * 0.12, 1.4, 0.7, 0.5), knot, matrix(side * r * 0.12, r * 0.46, -r * 0.76, 0, 0, side * 0.5))
      add(ball(r * 0.07, 12, 8), knot, matrix(0, r * 0.46, -r * 0.78))
      eyes(r * 0.1, r * 0.25, r * 0.18, r * 0.6)
      // とがった くちもと。
      add(new THREE.CylinderGeometry(r * 0.09, r * 0.12, r * 0.2, 16).translate(0, r * 0.1, 0), accent, matrix(0, -r * 0.05, r * 0.6, Math.PI / 2, 0, 0))
      add(new THREE.TorusGeometry(r * 0.08, r * 0.025, 6, 16), body, matrix(0, -r * 0.05, r * 0.81))
      cheeks(r * 0.12, r * 0.44, r * 0.0, r * 0.54, 0.7)
      break
    }
    case 'puffer': {
      // ぷっくり フグ。とげとげの まるい体に、白い おなかと 小さな ヒレ。
      const r = reach
      const core = r * 0.9
      const spike = new THREE.MeshPhysicalMaterial({ color: shade(species.color, -0.2), roughness: 0.7, sheen: 0.5, sheenColor: new THREE.Color('#fff0c0') })
      const fin = new THREE.MeshPhysicalMaterial({ color: '#ff9b4a', roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color('#ffe0c0'), side: THREE.DoubleSide })
      const spot = new THREE.MeshStandardMaterial({ color: '#b07a2a', roughness: 0.9 })
      add(ball(core, 28, 18), body, matrix(0, 0, 0))
      add(new THREE.SphereGeometry(core * 1.012, 28, 8, 0, Math.PI * 2, Math.PI * 0.56, Math.PI * 0.44), accent, matrix(0, 0, 0))
      // とげは 球の上へ むらなく 並べる（黄金角）。顔のまわりと おなかの下は さける。
      const up = new THREE.Vector3(0, 1, 0)
      const count = 42
      for (let i = 0; i < count; i++) {
        const y = 1 - (2 * (i + 0.5)) / count
        const ring = Math.sqrt(1 - y * y)
        const a = i * 2.39996
        const normal = new THREE.Vector3(Math.cos(a) * ring, y, Math.sin(a) * ring)
        if (normal.z > 0.55 || normal.y < -0.6) continue
        const local = new THREE.Matrix4().compose(normal.clone().multiplyScalar(core + r * 0.05), new THREE.Quaternion().setFromUnitVectors(up, normal), new THREE.Vector3(1, 1, 1))
        add(new THREE.ConeGeometry(r * 0.06, r * 0.16, 6, 1), y < -0.1 ? accent : spike, local)
      }
      for (const [sx, sy, sz] of [[0.3, 0.75, -0.2], [-0.35, 0.7, -0.3], [0, 0.6, -0.65], [0.6, 0.45, -0.5], [-0.62, 0.4, -0.45]] as const) {
        const normal = new THREE.Vector3(sx, sy, sz).normalize()
        add(ball(r * 0.09, 10, 6).scale(1, 0.3, 1), spot, new THREE.Matrix4().compose(normal.clone().multiplyScalar(core * 0.99), new THREE.Quaternion().setFromUnitVectors(up, normal), new THREE.Vector3(1, 1, 1)))
      }
      for (const side of [-1, 1]) add(blob(r * 0.26, 0.15, 0.8, 1), fin, matrix(side * core * 0.98, -r * 0.08, r * 0.12, 0, side * 0.5, side * -0.3))
      add(blob(r * 0.3, 0.14, 1, 0.8), fin, matrix(0, r * 0.05, -core * 1.04))
      add(blob(r * 0.18, 0.12, 0.7, 1), fin, matrix(0, core * 0.98, -r * 0.3, -0.5, 0, 0))
      eyes(r * 0.13, r * 0.33, r * 0.26, core * 0.86)
      add(new THREE.TorusGeometry(r * 0.09, r * 0.04, 8, 20).scale(1, 0.8, 1), fin, matrix(0, -r * 0.14, core * 0.98))
      cheeks(r * 0.13, r * 0.56, -r * 0.04, core * 0.78, 0.66)
      break
    }
    case 'planet': {
      // わっかの ある わくせい。しまもようの 帯と、ななめの わっか、にっこり顔。
      const r = reach
      const stripe = new THREE.MeshPhysicalMaterial({ color: shade(species.color, 0.45), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15 })
      const ringInner = new THREE.MeshPhysicalMaterial({ color: '#fff1c4', roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.1 })
      add(ball(r, 30, 20), body, matrix(0, 0, 0))
      for (const lat of [-0.5, 0.42]) {
        const ry = Math.sin(lat) * r
        add(new THREE.TorusGeometry(Math.cos(lat) * r * 0.985, r * 0.075, 6, 36).scale(1, 1, 0.6), stripe, matrix(0, ry, 0, Math.PI / 2, 0, 0))
      }
      const tilt = matrix(0, 0, 0, 0, 0, 0.32).multiply(matrix(0, 0, 0, Math.PI / 2 - 0.14, 0, 0))
      add(new THREE.TorusGeometry(r * 1.42, r * 0.11, 6, 48).scale(1, 1, 0.18), accent, tilt)
      add(new THREE.TorusGeometry(r * 1.2, r * 0.07, 6, 48).scale(1, 1, 0.2), ringInner, tilt)
      eyes(r * 0.09, r * 0.28, r * 0.24, r * 0.88)
      add(new THREE.TorusGeometry(r * 0.12, r * 0.03, 6, 18, Math.PI), eye, matrix(0, r * 0.06, r * 0.96, 0, 0, Math.PI))
      cheeks(r * 0.13, r * 0.52, r * 0.04, r * 0.82, 0.62)
      // ちいさな おつきさま（えいせい）が わっかの そばに うかぶ。
      add(ball(r * 0.16, 14, 10), ringInner, matrix(-r * 0.92, r * 0.72, r * 0.3))
      break
    }
    case 'rocket': {
      // おもちゃの ロケット。白い胴に 赤い先っぽ、まるい まどから うちゅうひこうしが のぞく。
      const r = species.body.form === 'capsule' ? species.body.radius : reach
      const half = species.body.form === 'capsule' ? species.body.half : r
      const top = half + r * 1.05
      const bottom = -half - r * 0.85
      const noseFrom = half * 0.55
      const profile = (y: number) => {
        if (y <= noseFrom) return r * (0.84 + 0.14 * Math.sin(((y - bottom) / (noseFrom - bottom)) * Math.PI * 0.62))
        const t = (y - noseFrom) / (top - noseFrom)
        return r * 0.972 * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.15 * t)
      }
      const lathe = (from: number, to: number, steps: number, closeBottom: boolean) => {
        const points: THREE.Vector2[] = closeBottom ? [new THREE.Vector2(1e-4, from)] : []
        for (let i = 0; i <= steps; i++) {
          const y = from + ((to - from) * i) / steps
          points.push(new THREE.Vector2(Math.max(profile(y), 1e-4), y))
        }
        return smooth(new THREE.LatheGeometry(points, 28))
      }
      const red = new THREE.MeshPhysicalMaterial({ color: species.accent, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.12 })
      const blue = new THREE.MeshPhysicalMaterial({ color: '#3f7fe8', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 })
      const chrome = new THREE.MeshStandardMaterial({ color: '#c9d0da', roughness: 0.2, metalness: 0.9 })
      const porthole = new THREE.MeshPhysicalMaterial({ color: '#8fd6ff', roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, emissive: '#2a7fc0', emissiveIntensity: 0.35 })
      add(lathe(bottom, noseFrom, 20, true), body, matrix(0, 0, 0))
      add(lathe(noseFrom, top, 16, false), red, matrix(0, 0, 0))
      add(new THREE.TorusGeometry(profile(noseFrom) * 1.0, r * 0.06, 8, 36), chrome, matrix(0, noseFrom, 0, Math.PI / 2, 0, 0))
      add(new THREE.TorusGeometry(profile(-half * 0.5) * 1.0, r * 0.08, 8, 36), blue, matrix(0, -half * 0.5, 0, Math.PI / 2, 0, 0))
      // まどと、なかの かお。
      const windowY = half * 0.02
      const windowZ = profile(windowY)
      add(new THREE.CylinderGeometry(r * 0.4, r * 0.4, r * 0.1, 28), porthole, matrix(0, windowY, windowZ * 0.97, Math.PI / 2, 0, 0))
      add(new THREE.TorusGeometry(r * 0.41, r * 0.08, 10, 32), chrome, matrix(0, windowY, windowZ * 0.99))
      eyes(r * 0.075, r * 0.13, windowY + r * 0.04, windowZ * 1.03)
      // 3まいの はね。ねかせて 置いても 床に めりこみすぎない 大きさにする。
      const finShape = new THREE.Shape()
      finShape.moveTo(0, 0)
      finShape.lineTo(r * 0.42, -r * 0.42)
      finShape.quadraticCurveTo(r * 0.48, -r * 0.62, r * 0.36, -r * 0.66)
      finShape.lineTo(0, -r * 0.5)
      finShape.closePath()
      const finGeometry = new THREE.ExtrudeGeometry(finShape, { depth: r * 0.08, bevelEnabled: true, bevelSize: r * 0.03, bevelThickness: r * 0.03, bevelSegments: 2, curveSegments: 6 }).translate(0, 0, -r * 0.04)
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.PI / 2
        add(finGeometry.clone(), red, new THREE.Matrix4().makeRotationY(a).multiply(matrix(r * 0.72, bottom + r * 0.62, 0)))
      }
      finGeometry.dispose()
      add(new THREE.CylinderGeometry(r * 0.5, r * 0.62, r * 0.24, 24), chrome, matrix(0, bottom - r * 0.06, 0))
      add(new THREE.CylinderGeometry(r * 0.36, r * 0.36, r * 0.04, 20), blue, matrix(0, bottom - r * 0.19, 0))
      break
    }
    case 'ufo': {
      // ユーフォー。ひらたい円ばんに すきとおった ドーム、なかで みどりの うちゅうじんが にっこり。
      const half = species.body.form === 'box' ? species.body.half : { x: reach, y: reach * 0.4, z: reach }
      const round = species.body.form === 'box' ? species.body.round : 0
      const rx = Math.min(half.x, half.z) + round
      const hy = half.y + round
      const points: THREE.Vector2[] = [new THREE.Vector2(1e-4, -hy * 0.92)]
      for (let i = 0; i <= 16; i++) {
        const t = i / 16
        points.push(new THREE.Vector2(rx * 0.32 + rx * 0.68 * Math.sin(t * Math.PI / 2), -hy * 0.92 + hy * 0.92 * (1 - Math.cos(t * Math.PI / 2))))
      }
      for (let i = 1; i <= 12; i++) {
        const t = i / 12
        points.push(new THREE.Vector2(rx * (1 - 0.5 * t), hy * 0.42 * Math.sin(t * Math.PI / 2)))
      }
      points.push(new THREE.Vector2(1e-4, hy * 0.42))
      add(smooth(new THREE.LatheGeometry(points, 36)), body, matrix(0, 0, 0))
      const chrome = new THREE.MeshStandardMaterial({ color: '#d7dde6', roughness: 0.18, metalness: 0.9 })
      const lights = new THREE.MeshStandardMaterial({ color: '#fff3b0', emissive: '#ffc93d', emissiveIntensity: 1.4, roughness: 0.3 })
      const dome = new THREE.MeshPhysicalMaterial({ color: species.accent, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.38, depthWrite: false })
      const alien = new THREE.MeshPhysicalMaterial({ color: '#8fe36b', roughness: 0.4, clearcoat: 0.5 })
      add(new THREE.TorusGeometry(rx * 0.99, hy * 0.12, 8, 48), chrome, matrix(0, 0, 0, Math.PI / 2, 0, 0))
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        add(ball(hy * 0.16, 10, 8), lights, matrix(Math.cos(a) * rx * 0.86, -hy * 0.14, Math.sin(a) * rx * 0.86))
      }
      add(new THREE.CylinderGeometry(rx * 0.26, rx * 0.3, hy * 0.2, 24), lights, matrix(0, -hy * 0.94, 0))
      const domeR = rx * 0.5
      add(new THREE.SphereGeometry(domeR, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), dome, matrix(0, hy * 0.3, 0))
      add(new THREE.TorusGeometry(domeR, hy * 0.08, 8, 32), chrome, matrix(0, hy * 0.32, 0, Math.PI / 2, 0, 0))
      const head = domeR * 0.5
      add(ball(head, 22, 16).scale(1.1, 0.95, 1), alien, matrix(0, hy * 0.32 + head * 0.9, 0))
      for (const side of [-1, 1]) {
        add(new THREE.CylinderGeometry(head * 0.06, head * 0.06, head * 0.7, 6), alien, matrix(side * head * 0.42, hy * 0.32 + head * 2.0, 0, 0, 0, -side * 0.4))
        add(ball(head * 0.16, 10, 8), lights, matrix(side * head * 0.58, hy * 0.32 + head * 2.32, 0))
      }
      eyes(head * 0.22, head * 0.36, hy * 0.32 + head, head * 0.82)
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

/** 決まった形の乱数。テーマの絵を毎回 同じに描くために使う。 */
function hash(seed: number): number {
  const value = Math.sin(seed * 91.37 + 7.13) * 43758.5453
  return value - Math.floor(value)
}

function starPath(context: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number, points = 5) {
  context.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points
    const radius = i % 2 ? inner : outer
    context.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius)
  }
  context.closePath()
}

/** うみの なかまの かべ。光の さしこむ 海の中に、ゆれる海そう・さんご・あわ・小さな魚。 */
function drawOceanWall(context: CanvasRenderingContext2D, w: number, h: number) {
  const water = context.createLinearGradient(0, 0, 0, h)
  water.addColorStop(0, '#a8ecf7')
  water.addColorStop(0.45, '#4fbfe0')
  water.addColorStop(1, '#2179b5')
  context.fillStyle = water
  context.fillRect(0, 0, w, h)
  // 水面から さしこむ 光の すじ。
  context.save()
  context.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 6; i++) {
    const x = 40 + i * 92 + hash(i) * 30
    const ray = context.createLinearGradient(0, 0, 0, h * 0.9)
    ray.addColorStop(0, 'rgba(255, 255, 240, 0.22)')
    ray.addColorStop(1, 'rgba(255, 255, 240, 0)')
    context.fillStyle = ray
    context.beginPath()
    context.moveTo(x - 14, 0)
    context.lineTo(x + 18, 0)
    context.lineTo(x + 70 + hash(i + 9) * 40, h * 0.9)
    context.lineTo(x + 10, h * 0.9)
    context.closePath()
    context.fill()
  }
  context.restore()
  // 水面の きらきら。
  context.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  context.lineWidth = 3
  context.lineCap = 'round'
  for (let i = 0; i < 9; i++) {
    const x = hash(i + 30) * w
    const y = 10 + hash(i + 40) * 26
    context.beginPath()
    context.moveTo(x, y)
    context.quadraticCurveTo(x + 12, y - 6, x + 24, y)
    context.stroke()
  }
  // 遠くの 魚の むれ（うすい かげ）。
  context.fillStyle = 'rgba(30, 96, 150, 0.35)'
  for (let i = 0; i < 9; i++) {
    const x = 300 + (i % 3) * 26 + hash(i + 50) * 14
    const y = 110 + Math.floor(i / 3) * 18 + hash(i + 60) * 8
    context.beginPath()
    context.ellipse(x, y, 9, 4, 0, 0, Math.PI * 2)
    context.moveTo(x + 8, y)
    context.lineTo(x + 15, y - 5)
    context.lineTo(x + 15, y + 5)
    context.fill()
  }
  // すなの 海ぞこ。
  const sand = context.createLinearGradient(0, h - 70, 0, h)
  sand.addColorStop(0, '#f6e2ae')
  sand.addColorStop(1, '#e4c68a')
  context.fillStyle = sand
  context.beginPath()
  context.moveTo(0, h - 46)
  for (let x = 0; x <= w; x += 32) context.quadraticCurveTo(x + 16, h - 60 + Math.sin(x * 0.05) * 8, x + 32, h - 48 + Math.cos(x * 0.04) * 6)
  context.lineTo(w, h)
  context.lineTo(0, h)
  context.closePath()
  context.fill()
  // ゆらゆら 海そう。
  for (let i = 0; i < 7; i++) {
    const x = 18 + i * 78 + hash(i + 70) * 30
    const tall = 110 + hash(i + 80) * 120
    context.strokeStyle = i % 2 ? '#3aa86a' : '#5cc77f'
    context.lineWidth = 12 + hash(i + 90) * 6
    context.beginPath()
    context.moveTo(x, h - 30)
    for (let k = 1; k <= 6; k++) context.lineTo(x + Math.sin(k * 1.3 + i) * 12, h - 30 - (tall * k) / 6)
    context.stroke()
  }
  // さんごと 石。
  const coral = (x: number, y: number, size: number, color: string) => {
    context.strokeStyle = color
    context.lineWidth = size * 0.22
    const branch = (bx: number, by: number, angle: number, length: number, depth: number) => {
      const ex = bx + Math.cos(angle) * length
      const ey = by + Math.sin(angle) * length
      context.beginPath()
      context.moveTo(bx, by)
      context.lineTo(ex, ey)
      context.stroke()
      if (depth > 0) {
        branch(ex, ey, angle - 0.5, length * 0.72, depth - 1)
        branch(ex, ey, angle + 0.5, length * 0.72, depth - 1)
      }
    }
    branch(x, y, -Math.PI / 2, size, 3)
  }
  coral(118, h - 38, 34, '#ff7f9e')
  coral(420, h - 36, 40, '#ff9f6b')
  coral(480, h - 34, 26, '#ff7f9e')
  context.fillStyle = '#8a9bb0'
  for (const [x, rw] of [[200, 40], [250, 26], [330, 34]] as const) {
    context.beginPath()
    context.ellipse(x, h - 30, rw, rw * 0.55, 0, Math.PI, 0)
    context.fill()
  }
  // ヒトデと 貝がら。
  context.fillStyle = '#ffb347'
  starPath(context, 290, h - 22, 13, 5)
  context.fill()
  context.fillStyle = '#ffd6e0'
  context.beginPath()
  context.arc(60, h - 18, 10, Math.PI, 0)
  context.fill()
  // あわ。
  for (let i = 0; i < 22; i++) {
    const x = hash(i + 100) * w
    const y = 40 + hash(i + 120) * (h - 140)
    const radius = 3 + hash(i + 140) * 9
    context.strokeStyle = 'rgba(255, 255, 255, 0.7)'
    context.lineWidth = 2
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.stroke()
    context.fillStyle = 'rgba(255, 255, 255, 0.8)'
    context.beginPath()
    context.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.25, 0, Math.PI * 2)
    context.fill()
  }
}

/** うちゅうの かべ。星雲の かかった 夜空に、わっかの わくせい・三日月・ながれ星。 */
function drawSpaceWall(context: CanvasRenderingContext2D, w: number, h: number) {
  const sky = context.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#191846')
  sky.addColorStop(0.55, '#33297a')
  sky.addColorStop(1, '#5b3b93')
  context.fillStyle = sky
  context.fillRect(0, 0, w, h)
  context.save()
  context.globalCompositeOperation = 'lighter'
  for (const [x, y, radius, color] of [[140, 170, 170, 'rgba(255, 110, 190, 0.28)'], [380, 90, 150, 'rgba(90, 200, 255, 0.22)'], [300, 300, 140, 'rgba(160, 120, 255, 0.25)']] as const) {
    const nebula = context.createRadialGradient(x, y, 0, x, y, radius)
    nebula.addColorStop(0, color)
    nebula.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = nebula
    context.fillRect(0, 0, w, h)
  }
  context.restore()
  // 小さな 星を たくさん。
  for (let i = 0; i < 170; i++) {
    const x = hash(i + 200) * w
    const y = hash(i + 400) * h
    const size = 0.5 + hash(i + 600) ** 3 * 2.2
    context.fillStyle = `rgba(255, ${235 + Math.floor(hash(i + 700) * 20)}, ${210 + Math.floor(hash(i + 800) * 45)}, ${0.55 + hash(i + 900) * 0.45})`
    context.beginPath()
    context.arc(x, y, size, 0, Math.PI * 2)
    context.fill()
  }
  // きらっと 光る 十字の星。
  context.fillStyle = '#fff8d8'
  for (const [x, y, size] of [[70, 60, 10], [230, 40, 8], [470, 200, 9], [180, 280, 7], [350, 330, 8]] as const) {
    starPath(context, x, y, size, size * 0.18, 4)
    context.fill()
  }
  // ながれ星。
  const trail = context.createLinearGradient(260, 140, 360, 90)
  trail.addColorStop(0, 'rgba(255, 255, 255, 0)')
  trail.addColorStop(1, 'rgba(255, 250, 220, 0.9)')
  context.strokeStyle = trail
  context.lineWidth = 4
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(260, 140)
  context.lineTo(360, 90)
  context.stroke()
  context.fillStyle = '#fffbe6'
  starPath(context, 362, 89, 9, 4)
  context.fill()
  // わっかの ある 大きな わくせい（右上）。
  const planet = context.createRadialGradient(410, 80, 6, 430, 100, 54)
  planet.addColorStop(0, '#ffd9a0')
  planet.addColorStop(1, '#f08a5d')
  context.save()
  context.translate(430, 100)
  context.rotate(-0.3)
  context.strokeStyle = 'rgba(255, 230, 170, 0.9)'
  context.lineWidth = 7
  context.beginPath()
  context.ellipse(0, 0, 84, 20, 0, Math.PI, Math.PI * 2)
  context.stroke()
  context.fillStyle = planet
  context.beginPath()
  context.arc(0, 0, 46, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = 'rgba(200, 90, 70, 0.35)'
  context.fillRect(-46, -8, 92, 8)
  context.fillRect(-42, 14, 84, 6)
  context.beginPath()
  context.ellipse(0, 0, 84, 20, 0, 0, Math.PI)
  context.stroke()
  context.restore()
  // 三日月（左上）。
  context.fillStyle = '#fff3b8'
  context.beginPath()
  context.arc(78, 140, 30, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#26205e'
  context.beginPath()
  context.arc(92, 130, 27, 0, Math.PI * 2)
  context.fill()
  // ちいさな 青い わくせいと、地平線の 月の地面。
  const small = context.createRadialGradient(150, 255, 2, 155, 260, 22)
  small.addColorStop(0, '#bdf3ff')
  small.addColorStop(1, '#3d8be0')
  context.fillStyle = small
  context.beginPath()
  context.arc(155, 260, 20, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#4b3f86'
  context.beginPath()
  context.moveTo(0, h - 40)
  context.quadraticCurveTo(w * 0.3, h - 72, w * 0.6, h - 46)
  context.quadraticCurveTo(w * 0.85, h - 28, w, h - 52)
  context.lineTo(w, h)
  context.lineTo(0, h)
  context.closePath()
  context.fill()
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
  const lamp = new THREE.PointLight(machine.theme === 'ocean' ? '#d8f4ff' : machine.theme === 'space' ? '#e6dcff' : '#ffe6b4', 1.6, 3, 1.6)
  lamp.position.set(0, MARQUEE_Y - 0.2, 0.1)
  scene.add(lamp)

  const cabinet = new THREE.Group()
  scene.add(cabinet)
  const metal = new THREE.MeshStandardMaterial({ color: '#dfe4ea', roughness: 0.26, metalness: 0.85 })
  const frame = new THREE.MeshPhysicalMaterial({ color: machine.color, roughness: 0.36, clearcoat: 0.7, clearcoatRoughness: 0.2 })
  const frameDark = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(machine.color).multiplyScalar(0.72), roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3 })
  const trim = new THREE.MeshStandardMaterial({ color: '#fff6e4', roughness: 0.4 })
  const glass = new THREE.MeshPhysicalMaterial({ color: machine.theme === 'ocean' ? '#d6f4ff' : '#eef8ff', roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide })
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
    if (machine.theme === 'ocean') {
      // すなはま。つぶつぶの すなに、ヒトデと 貝がらが ちらばる。
      context.fillStyle = '#f7e6bd'
      context.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 260; i++) {
        context.fillStyle = hash(i + 1000) > 0.5 ? 'rgba(196, 160, 96, 0.4)' : 'rgba(255, 255, 255, 0.6)'
        context.fillRect(hash(i + 1300) * 256, hash(i + 1600) * 256, 2, 2)
      }
      context.fillStyle = '#ffab5e'
      starPath(context, 64, 70, 16, 6)
      context.fill()
      starPath(context, 196, 200, 12, 5)
      context.fill()
      context.fillStyle = '#ffc8d6'
      for (const [x, y] of [[190, 60], [60, 196]] as const) {
        context.beginPath()
        context.arc(x, y, 12, Math.PI, 0)
        context.closePath()
        context.fill()
      }
      return
    }
    if (machine.theme === 'space') {
      // 月の地面。でこぼこの クレーターを ちらす。
      context.fillStyle = '#dcd8ec'
      context.fillRect(0, 0, 256, 256)
      for (const [x, y, radius] of [[50, 60, 22], [170, 40, 14], [200, 160, 28], [80, 190, 16], [130, 120, 10], [230, 240, 12], [20, 250, 10]] as const) {
        context.fillStyle = '#c3bdd9'
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#f3f0fb'
        context.beginPath()
        context.arc(x + radius * 0.15, y + radius * 0.15, radius * 0.82, Math.PI * 0.1, Math.PI * 0.9)
        context.fill()
        context.fillStyle = '#b2abcd'
        context.beginPath()
        context.arc(x - radius * 0.05, y - radius * 0.05, radius * 0.7, 0, Math.PI * 2)
        context.fill()
      }
      context.fillStyle = '#ffffff'
      for (let i = 0; i < 40; i++) context.fillRect(hash(i + 1900) * 256, hash(i + 2100) * 256, 1.5, 1.5)
      return
    }
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
    if (machine.theme === 'ocean') return drawOceanWall(context, 512, 384)
    if (machine.theme === 'space') return drawSpaceWall(context, 512, 384)
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
  // うちゅうの夜空は すこし 自分で 光らせて、星が しずまないようにする。
  panel(BIN.x * 2, BIN.height, backTexture, matrix(0, BIN.height / 2, -BIN.z - 0.007), machine.theme === 'space' ? 0.45 : machine.theme === 'ocean' ? 0.15 : 0)
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
    // 長い名前でも 星かざりの内がわへ おさまるよう、文字の大きさを しぼる。
    const fit = Math.min(1, 380 / Math.max(1, context.measureText(machine.label).width))
    context.save()
    context.translate(256, 68)
    context.scale(fit, 1)
    context.strokeText(machine.label, 0, 0)
    context.fillStyle = shade(machine.color, -0.3)
    context.fillText(machine.label, 0, 0)
    context.restore()
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

  // テーマの うごく かざり。海は うしろの かべぞいに のぼる あわ、うちゅうは かべで またたく 星。
  // 景品と アームの じゃまを しないよう、奥の かべと 左右の ガラスの そばだけに 置く。
  type Ambient = { x: number; z: number; size: number; speed: number; phase: number }
  const ambientSpots: Ambient[] = []
  let ambient: THREE.InstancedMesh | null = null
  if (machine.theme === 'ocean') {
    for (let i = 0; i < 18; i++) {
      const onSide = i % 3 === 2
      ambientSpots.push({
        x: onSide ? (i % 2 ? 1 : -1) * (BIN.x - 0.03) : -BIN.x + 0.06 + hash(i + 3000) * (BIN.x * 2 - 0.12),
        z: onSide ? -BIN.z * 0.5 + hash(i + 3100) * BIN.z * 0.6 : -BIN.z + 0.025 + hash(i + 3200) * 0.03,
        size: 0.006 + hash(i + 3300) * 0.01,
        speed: 0.07 + hash(i + 3400) * 0.07,
        phase: hash(i + 3500),
      })
    }
    ambient = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 14, 10),
      new THREE.MeshPhysicalMaterial({ color: '#f4fdff', roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.42, depthWrite: false, emissive: '#bfefff', emissiveIntensity: 0.25 }),
      ambientSpots.length,
    )
  } else if (machine.theme === 'space') {
    for (let i = 0; i < 16; i++) {
      ambientSpots.push({
        x: -BIN.x + 0.05 + hash(i + 4000) * (BIN.x * 2 - 0.1),
        z: -BIN.z - 0.002,
        size: 0.008 + hash(i + 4100) * 0.009,
        speed: 1.5 + hash(i + 4200) * 2.2,
        phase: hash(i + 4300) * Math.PI * 2,
      })
    }
    const sparkleShape = new THREE.Shape()
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4
      const radius = i % 2 ? 0.26 : 1
      if (i === 0) sparkleShape.moveTo(Math.sin(a) * radius, Math.cos(a) * radius)
      else sparkleShape.lineTo(Math.sin(a) * radius, Math.cos(a) * radius)
    }
    sparkleShape.closePath()
    ambient = new THREE.InstancedMesh(new THREE.ShapeGeometry(sparkleShape), new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.95, depthWrite: false }), ambientSpots.length)
  }
  if (ambient) {
    ambient.frustumCulled = false
    ambient.renderOrder = 2
    ambient.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scene.add(ambient)
  }
  const ambientDummy = new THREE.Object3D()
  function updateAmbient(time: number) {
    if (!ambient) return
    ambientSpots.forEach((spot, index) => {
      if (machine.theme === 'ocean') {
        // 下から上へ のぼって、てっぺんで また 下から。のぼりながら すこし ゆれる。
        const travel = (spot.phase + time * spot.speed) % 1
        ambientDummy.position.set(spot.x + Math.sin(time * 2.2 + spot.phase * 9) * 0.008, 0.04 + travel * (GANTRY_Y - 0.1), spot.z)
        ambientDummy.scale.setScalar(spot.size * (0.7 + travel * 0.5))
        ambientDummy.rotation.set(0, 0, 0)
      } else {
        // 星の高さは 奥のかべの 上のほう。またたきに あわせて 大きさを かえる。
        const pulse = 0.55 + 0.45 * Math.sin(time * spot.speed + spot.phase)
        ambientDummy.position.set(spot.x, 0.36 + hash(index + 4400) * 0.5, spot.z + 0.004)
        ambientDummy.scale.setScalar(spot.size * (0.4 + pulse))
        ambientDummy.rotation.set(0, 0, time * 0.4 + spot.phase)
      }
      ambientDummy.updateMatrix()
      ambient!.setMatrixAt(index, ambientDummy.matrix)
    })
    ambient.instanceMatrix.needsUpdate = true
  }
  updateAmbient(0)

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

  /** カメラが筐体ぜんたいを収めるために下がった距離。ズームはここから寄せる。 */
  let fitDistance = 3
  let zoom = 1
  const aim = new THREE.Vector3()
  const follow = new THREE.Vector3(0, ZOOM_FOCUS_Y, 0)

  /**
   * 画面の形がどうであれ機械が丸ごと入る位置までカメラを下げる。
   * 縦横比ごとの式を書き分けず、筐体の8隅が画面に収まるまで距離を広げて決める。
   */
  function fitCamera() {
    const fit = FIT[view]
    for (fitDistance = 1.8; fitDistance <= 6; fitDistance += 0.06) {
      camera.position.copy(fit.target).addScaledVector(fit.direction, fitDistance)
      camera.lookAt(fit.target)
      camera.updateMatrixWorld()
      if (corners.every(corner => {
        projected.copy(corner).project(camera)
        return Math.abs(projected.x) < 0.98 && Math.abs(projected.y) < 0.98 && projected.z < 1
      })) break
    }
    placeCamera(1)
  }

  /**
   * ズームに合わせてカメラを置く。寄るほど、見る先を筐体の中心からアームのほうへずらす。
   * blend は今の見る先から目標へ近づける割合（1で即座に合わせる）。
   */
  function placeCamera(blend: number) {
    const fit = FIT[view]
    const closeness = (zoom - 1) / (MAX_ZOOM - 1)
    aim.copy(fit.target).lerp(follow, closeness)
    target.lerp(aim, blend)
    camera.position.copy(target).addScaledVector(fit.direction, fitDistance / zoom)
    camera.lookAt(target)
    camera.updateMatrixWorld()
  }

  function resize() {
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    aspect = width / height
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7))
    renderer.setSize(width, height, false)
    fitCamera()
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
      fitCamera()
    },
    get zoom() { return zoom },
    /** 1でぜんたい、MAX_ZOOMまで寄る。 */
    setZoom(next: number) {
      zoom = clampZoom(next)
      placeCamera(1)
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
      // 寄っているときに見る先。左右と奥はアームについていき、高さはケースの中ほどに保つ。
      follow.set(position.x * 0.75, ZOOM_FOCUS_Y, position.z * 0.5)
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
        updateAmbient(twinkle)
      }
      if (zoom > 1) placeCamera(reducedMotion ? 1 : 1 - Math.exp(-dt * 6))
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
