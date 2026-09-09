import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { type JourneyCourse, type JourneyEdge, type JourneyRoute, railOrientation, TRACK_Y } from './journeyModel'

type Shape = 'box' | 'sphere' | 'cone' | 'cylinder' | 'roof'
type Batch = { matrices: THREE.Matrix4[]; colors: THREE.Color[] }

/** Repeated scenery costs five draws, regardless of tree / sleeper count. */
function sceneryBatch(parent: THREE.Group) {
  const batches = new Map<Shape, Batch>()
  const dummy = new THREE.Object3D()
  function part(shape: Shape, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) {
    const batch = batches.get(shape) ?? { matrices: [], colors: [] }
    dummy.position.set(x, y, z)
    dummy.rotation.set(rx, ry, rz)
    dummy.scale.set(sx, sy, sz)
    dummy.updateMatrix()
    batch.matrices.push(dummy.matrix.clone())
    batch.colors.push(new THREE.Color(color))
    batches.set(shape, batch)
  }
  function beam(color: string, a: THREE.Vector3, b: THREE.Vector3, width: number) {
    const batch = batches.get('box') ?? { matrices: [], colors: [] }
    dummy.position.copy(a).lerp(b, 0.5)
    dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
    dummy.scale.set(width, a.distanceTo(b), width)
    dummy.updateMatrix()
    batch.matrices.push(dummy.matrix.clone())
    batch.colors.push(new THREE.Color(color))
    batches.set('box', batch)
  }
  function finish() {
    const material = new THREE.MeshStandardMaterial({ roughness: 0.84, flatShading: true })
    const shapes = {
      box: () => new THREE.BoxGeometry(1, 1, 1),
      sphere: () => new THREE.IcosahedronGeometry(0.5, 1),
      cone: () => new THREE.ConeGeometry(0.5, 1, 7),
      cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
      roof: () => {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, -.5, .5, -.5, -.5, 0, .5, -.5, -.5, -.5, .5, .5, -.5, .5, 0, .5, .5], 3))
        geometry.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3])
        const flat = geometry.toNonIndexed()
        geometry.dispose()
        flat.computeVertexNormals()
        return flat
      },
    }
    for (const [shape, batch] of batches) {
      const mesh = new THREE.InstancedMesh(shapes[shape](), material, batch.matrices.length)
      mesh.name = `journey-scenery-${shape}`
      batch.matrices.forEach((matrix, i) => { mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, batch.colors[i]) })
      mesh.castShadow = mesh.receiveShadow = true
      mesh.computeBoundingSphere()
      parent.add(mesh)
    }
  }
  return { part, beam, finish }
}

export function disposeJourneyObject(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  object.traverse(child => {
    if (child instanceof THREE.Mesh) geometries.add(child.geometry)
    if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        materials.add(material)
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value)
      }
    }
    if (child instanceof THREE.InstancedMesh) child.dispose()
  })
  geometries.forEach(resource => resource.dispose())
  materials.forEach(resource => resource.dispose())
  textures.forEach(resource => resource.dispose())
}

export function journeyLabel(text: string, color: string, width = 4.5) {
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 112
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fffdf2'
  ctx.beginPath()
  ctx.roundRect(4, 4, 376, 104, 24)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 8
  ctx.stroke()
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 46px "Yu Gothic", sans-serif'
  ctx.fillText(text, 192, 59)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }))
  sprite.scale.set(width, width * 112 / 384, 1)
  return sprite
}

function ribbon(curve: THREE.Curve<THREE.Vector3>, width: number, height: number, offset: number, segments: number) {
  const vertices: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= segments; i++) {
    const p = curve.getPointAt(i / segments)
    const t = curve.getTangentAt(i / segments)
    const side = new THREE.Vector3(t.z, 0, -t.x).normalize()
    for (const [w, h] of [[-width / 2, 0], [width / 2, 0], [-width / 2, -height], [width / 2, -height]]) {
      vertices.push(p.x + side.x * w, p.y + offset + h, p.z + side.z * w)
    }
    if (i < segments) {
      const a = i * 4
      for (const [u, v] of [[0, 1], [2, 0], [1, 3], [3, 2]]) indices.push(a + u, a + u + 4, a + v, a + v, a + u + 4, a + v + 4)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createJourneyScene(course: JourneyCourse, sleeper: THREE.Object3D) {
  const group = new THREE.Group()
  const batch = sceneryBatch(group)
  const { part, beam } = batch
  const mesh = (geometry: THREE.BufferGeometry, color: string) => {
    const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }))
    object.receiveShadow = object.castShadow = true
    group.add(object)
    return object
  }
  // A bevelled toy island, with the sea visible around its edges.
  const islandShape = new THREE.Shape()
  islandShape.moveTo(-25, -28)
  islandShape.lineTo(25, -28); islandShape.quadraticCurveTo(29, -28, 29, -24)
  islandShape.lineTo(29, 26); islandShape.quadraticCurveTo(29, 30, 25, 30)
  islandShape.lineTo(-25, 30); islandShape.quadraticCurveTo(-29, 30, -29, 26)
  islandShape.lineTo(-29, -24); islandShape.quadraticCurveTo(-29, -28, -25, -28)
  const island = new THREE.ExtrudeGeometry(islandShape, { depth: 1.6, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.5, bevelThickness: 0.25, curveSegments: 6 })
  island.rotateX(-Math.PI / 2).translate(0, -1.85, 0)
  mesh(island, '#91bd70')
  const sea = mesh(new THREE.PlaneGeometry(900, 900), '#87cfd9')
  sea.rotation.x = -Math.PI / 2
  sea.position.y = -2.4
  sea.castShadow = false

  const trackSamples = Object.values(course.curves).flatMap(c => c.getSpacedPoints(350))
  const clear = (x: number, z: number, r: number) => !trackSamples.some(p => Math.hypot(p.x - x, p.z - z) < r)
  const trackMaterials: Partial<Record<JourneyEdge, THREE.MeshStandardMaterial>> = {}
  let sleeperMesh: THREE.Mesh | undefined
  sleeper.traverse(child => { if (child instanceof THREE.Mesh) sleeperMesh = child })
  const sleeperMatrices: THREE.Matrix4[] = []
  const dummy = new THREE.Object3D()
  const up = new THREE.Vector3(0, 1, 0)
  const railGeometries: THREE.BufferGeometry[] = []
  for (const edge of ['common', 'bridge', 'forest'] as const) {
    const curve = course.curves[edge]
    const length = course.lengths[edge]
    const bed = mesh(ribbon(curve, 1.85, 0.24, -0.04, Math.ceil(length * 5)), edge === 'bridge' ? '#4b98c6' : edge === 'forest' ? '#73a389' : '#dab779')
    bed.name = `track-${edge}`
    trackMaterials[edge] = bed.material as THREE.MeshStandardMaterial
    for (const side of [-1, 1]) {
      const points = curve.getSpacedPoints(Math.ceil(length * 5)).map((p, i, list) => {
        const t = curve.getTangentAt(i / (list.length - 1))
        return p.add(new THREE.Vector3(t.z, 0, -t.x).normalize().multiplyScalar(side * 0.46)).addScaledVector(up, 0.155)
      })
      railGeometries.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), points.length, 0.065, 5, false))
    }
    for (let d = 0.32; d < length; d += 0.58) {
      const p = curve.getPointAt(d / length)
      const t = curve.getTangentAt(d / length)
      dummy.position.copy(p)
      dummy.quaternion.copy(railOrientation(t))
      dummy.scale.set(1.55, 1, 0.9)
      dummy.updateMatrix()
      sleeperMatrices.push(dummy.matrix.clone())
    }
    if (edge === 'bridge') {
      for (let d = 2; d < length - 2; d += 3.3) {
        const p = curve.getPointAt(d / length)
        if (p.y < 0.9) continue
        const tangent = curve.getTangentAt(d / length)
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
        const lowerTrack = trackSamples.some(q => q.y < p.y - 2 && Math.hypot(q.x - p.x, q.z - p.z) < 1.7)
        if (!lowerTrack) {
          part('box', '#e7d8b7', p.x, (p.y - 0.25) / 2, p.z, 0.85, p.y - 0.25, 0.85)
          part('box', '#c6b394', p.x, 0.12, p.z, 1.4, 0.3, 1.4)
          part('box', '#f0e2c5', p.x, p.y - 0.45, p.z, 1.75, 0.35, 1, 0, Math.atan2(tangent.x, tangent.z))
        }
        const next = curve.getPointAt(Math.min(1, (d + 3.3) / length))
        const nextT = curve.getTangentAt(Math.min(1, (d + 3.3) / length))
        const nextRight = new THREE.Vector3(nextT.z, 0, -nextT.x).normalize()
        const bridge = p.y > 5 && p.x < -3 && p.z > -9 && p.z < 6
        for (const side of [-1, 1]) {
          const a = p.clone().addScaledVector(right, side * 1.04).addScaledVector(up, 0.55)
          const b = next.clone().addScaledVector(nextRight, side * 1.04).addScaledVector(up, 0.55)
          const color = bridge ? '#db6550' : '#bce1ed'
          beam(color, a, b, 0.14)
          beam(color, a.clone().addScaledVector(up, -0.5), a.clone().addScaledVector(up, 0.2), 0.16)
          if (bridge) {
            beam('#cd5947', a.clone().addScaledVector(up, 1.8), b.clone().addScaledVector(up, 1.8), 0.22)
            beam('#db6550', a.clone().addScaledVector(up, -0.4), b.clone().addScaledVector(up, 1.8), 0.18)
            beam('#db6550', a.clone().addScaledVector(up, 1.8), b.clone().addScaledVector(up, -0.4), 0.18)
          }
        }
      }
    }
  }
  const rails = mesh(mergeGeometries(railGeometries), '#dddfe4')
  rails.name = 'continuous-rails'
  ;(rails.material as THREE.MeshStandardMaterial).metalness = 0.38
  ;(rails.material as THREE.MeshStandardMaterial).roughness = 0.38
  railGeometries.forEach(g => g.dispose())
  if (sleeperMesh) {
    const ties = new THREE.InstancedMesh(sleeperMesh.geometry.clone(), Array.isArray(sleeperMesh.material) ? sleeperMesh.material.map(m => m.clone()) : sleeperMesh.material.clone(), sleeperMatrices.length)
    ties.name = 'kenney-sleepers'
    sleeperMatrices.forEach((matrix, i) => ties.setMatrixAt(i, matrix))
    ties.receiveShadow = true
    ties.computeBoundingSphere()
    group.add(ties)
  }

  // A real open-ended arched shell follows the forest rail, with visible portals.
  const tunnelStart = 17
  const tunnelEnd = 23
  const shell: number[] = []
  const shellIndices: number[] = []
  const forest = course.curves.forest
  for (let i = 0; i <= 20; i++) {
    const u = (tunnelStart + (tunnelEnd - tunnelStart) * i / 20) / course.lengths.forest
    const p = forest.getPointAt(u)
    const tangent = forest.getTangentAt(u)
    const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
    for (let j = 0; j <= 16; j++) {
      const angle = j / 16 * Math.PI
      shell.push(p.x + side.x * Math.cos(angle) * 1.65, p.y + 1.1 + Math.sin(angle) * 1.7, p.z + side.z * Math.cos(angle) * 1.65)
      if (i < 20 && j < 16) {
        const k = i * 17 + j
        shellIndices.push(k, k + 1, k + 17, k + 1, k + 18, k + 17)
      }
    }
    for (const s of [-1, 1]) {
      const wall = p.clone().addScaledVector(side, s * 1.8)
      part('box', '#769077', wall.x, p.y + 0.5, wall.z, 0.4, 1.4, 0.42, 0, Math.atan2(tangent.x, tangent.z))
    }
  }
  const shellGeometry = new THREE.BufferGeometry()
  shellGeometry.setAttribute('position', new THREE.Float32BufferAttribute(shell, 3))
  shellGeometry.setIndex(shellIndices)
  shellGeometry.computeVertexNormals()
  const tunnel = mesh(shellGeometry, '#6c8966')
  ;(tunnel.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
  tunnel.name = 'forest-tunnel'
  for (const d of [tunnelStart, tunnelEnd]) {
    const p = forest.getPointAt(d / course.lengths.forest)
    const t = forest.getTangentAt(d / course.lengths.forest)
    const side = new THREE.Vector3(t.z, 0, -t.x).normalize()
    for (let j = 0; j < 13; j++) {
      const angle = (j + 0.5) / 13 * Math.PI
      const q = p.clone().addScaledVector(side, Math.cos(angle) * 1.73)
      part('box', j % 2 ? '#d4cbb2' : '#e2dbc7', q.x, p.y + 1.1 + Math.sin(angle) * 1.77, q.z, 0.48, 0.4, 0.65, 0, Math.atan2(t.x, t.z), angle - Math.PI / 2)
    }
    for (const s of [-1, 1]) {
      const q = p.clone().addScaledVector(side, s * 1.76)
      part('box', '#d4cbb2', q.x, p.y + 0.55, q.z, 0.45, 1.25, 0.7, 0, Math.atan2(t.x, t.z))
    }
  }
  const tunnelLabel = journeyLabel('もりの トンネル', '#3f7751', 5)
  const tunnelPoint = forest.getPointAt(tunnelStart / course.lengths.forest)
  tunnelLabel.position.copy(tunnelPoint).add(new THREE.Vector3(0, 3.6, 0))
  group.add(tunnelLabel)

  // Pond, little islets, reeds and a boat below the elevated loop.
  part('cylinder', '#cbdab0', 3, 0.005, 7.5, 14, 0.1, 12)
  const pond = mesh(new THREE.CircleGeometry(1, 48), '#58bbcf')
  pond.rotation.x = -Math.PI / 2
  pond.position.set(3, 0.075, 7.5)
  pond.scale.set(6.4, 5.4, 1)
  pond.castShadow = false
  for (let i = 0; i < 18; i++) {
    const angle = i * 2.4
    const x = 3 + Math.cos(angle) * 6.7
    const z = 7.5 + Math.sin(angle) * 5.7
    if (clear(x, z, 1.1)) {
      part('sphere', '#b2b6a1', x, 0.18, z, 0.8, 0.55, 0.7)
      part('cone', '#609363', x + 0.3, 0.55, z + 0.2, 0.25, 1.1, 0.25)
    }
  }
  part('box', '#edc477', 4.3, 0.26, 8.5, 0.75, 0.35, 1.65, 0, -0.4)
  part('cylinder', '#f5e8c5', 4.3, 1, 8.5, 0.07, 1.7, 0.07)
  part('cone', '#fcf4da', 4.4, 1.4, 8.5, 1, 1.1, 0.05, 0, -0.4)

  // Station sits beside the long foreground straight. Roof leaves the train visible.
  part('box', '#d5c6a5', -3, 0.25, 21, 15, 0.5, 3.7)
  part('box', '#fff0af', -3, 0.54, 19.3, 15, 0.09, 0.25)
  part('box', '#f3e4bc', 1, 1.9, 23.7, 5.4, 3.8, 3.4)
  part('box', '#d67753', 1, 3.85, 23.7, 6.1, 0.4, 4.1)
  part('roof', '#ce664b', 1, 4.55, 23.7, 6.2, 1.45, 4.2)
  for (const x of [-0.7, 2.7]) {
    part('box', '#477b8b', x, 2.05, 21.96, 1.15, 1.6, 0.07)
    part('box', '#fff1cd', x, 2.05, 21.9, 0.1, 1.6, 0.05)
  }
  part('box', '#8b7058', 1, 1.2, 21.96, 1, 2.1, 0.08)
  for (const x of [-9, -5]) {
    part('box', '#788c8c', x, 1.75, 22, 0.16, 3.1, 0.16)
    part('box', '#c38457', x, 1.02, 21, 2, 0.16, 0.65)
    part('box', '#c38457', x, 1.45, 21.25, 2, 0.6, 0.12)
    part('box', '#726c60', x, 0.75, 21, 1.6, 0.5, 0.12)
  }
  part('box', '#61a5a1', -7, 3.38, 21.3, 7, 0.3, 3.9)
  const stationLabel = journeyLabel('にじいろえき', '#ae6244', 6)
  stationLabel.position.set(1, 5.7, 23.7)
  group.add(stationLabel)
  const clock = mesh(new THREE.CircleGeometry(0.58, 24), '#fff6d8')
  clock.rotation.y = Math.PI
  clock.position.set(1, 4.1, 21.55)
  part('box', '#52666a', 1, 4.24, 21.5, 0.055, 0.32, 0.08)
  part('box', '#52666a', 1.14, 4.1, 21.5, 0.32, 0.055, 0.08)

  // Deterministic placement keeps all scenery clear of every route.
  const noise = (n: number) => { const s = Math.sin(n * 127.1 + 31.7) * 43758.5453; return s - Math.floor(s) }
  function tree(x: number, z: number, size: number, pine: boolean, seed: number) {
    part('cylinder', '#9c7952', x, size * 0.4, z, 0.28 * size, size * 0.8, 0.28 * size)
    const greens = ['#4b9069', '#69a474', '#7ca86b', '#3c8167', '#98ba75']
    if (pine) {
      part('cone', greens[seed % greens.length], x, size * 1.05, z, size * 1.4, size * 1.8, size * 1.4)
      part('cone', '#79a876', x, size * 1.5, z, size, size * 1.4, size)
    } else part('sphere', greens[seed % greens.length], x, size * 1.3, z, size * 1.65, size * 1.65, size * 1.65)
  }
  for (let i = 0; i < 200; i++) {
    const x = noise(i * 3 + 1) * 54 - 27
    const z = noise(i * 3 + 2) * 53 - 27
    const size = 0.85 + noise(i * 3 + 3) * 0.9
    if (z > 18 || (x > -5 && x < 11 && z > 1 && z < 15) || (x > 21 && z > -20)) continue
    if (clear(x, z, 2.15 + size * 0.3)) tree(x, z, size, z < -6, i)
  }
  // Soft low-poly hills on the northwestern coast, away from both tracks.
  for (const [x, z, s] of [[-21, -22, 7], [-16, -25, 5], [-23, -14, 5]]) {
    part('sphere', '#81a58a', x, 0.1, z, s * 1.7, s, s * 1.5)
    part('sphere', '#a1bb8d', x - 0.7, 1.1, z, s * 1.35, s * 0.85, s * 1.1)
  }
  // A row of houses, a footpath, gardens and fences adds a lived-in scale.
  part('box', '#d8cca6', 24.6, 0.01, -1, 2, 0.09, 38)
  for (let i = 0; i < 6; i++) {
    const x = 27
    const z = -17 + i * 6
    const wall = ['#f4d399', '#edd5bf', '#e8d7b5'][i % 3]
    const roof = ['#c87559', '#608f9c', '#c8a34e'][i % 3]
    part('box', wall, x, 1.3, z, 3.1, 2.6, 3.3)
    part('roof', roof, x, 3.2, z, 3.8, 1.5, 3.9, 0, Math.PI / 2)
    part('box', '#578193', x - 1.57, 1.6, z - 0.8, 0.08, 0.85, 0.8)
    part('box', '#977559', x - 1.57, 0.8, z + 0.75, 0.08, 1.6, 0.8)
    part('box', '#f4edcf', x - 0.7, 3.5, z + 0.6, 0.48, 1.7, 0.48)
    for (let j = 0; j < 4; j++) {
      part('box', '#ede2be', 25.7 + j * 0.7, 0.6, z + 2.45, 0.12, 1.2, 0.12)
      part('sphere', ['#edba63', '#e58e95'][j % 2], 25.5 + j * 0.7, 0.4, z - 2.3, 0.4, 0.5, 0.4)
    }
    part('box', '#ede2be', 26.7, 0.8, z + 2.45, 2.8, 0.13, 0.12)
  }
  // Passengers are just a few shared primitive instances.
  for (let i = 0; i < 9; i++) {
    const x = -9 + i * 1.55
    const z = 20 + (i % 2) * 0.45
    part('sphere', ['#ed9760', '#6c94bd', '#dfbd54', '#a885b0'][i % 4], x, 1.06, z, 0.45, 0.75, 0.4)
    part('sphere', '#ecc49b', x, 1.65, z, 0.42, 0.45, 0.42)
    part('sphere', '#795d4e', x, 1.84, z, 0.45, 0.16, 0.45)
    for (const s of [-1, 1]) part('box', '#637b85', x + s * 0.12, 0.71, z, 0.13, 0.36, 0.17)
  }
  // Flowers along the foreground and little patches throughout the island.
  for (let i = 0; i < 100; i++) {
    const x = noise(i + 600) * 50 - 25
    const z = noise(i + 800) * 49 - 23
    if (!clear(x, z, 2) || (x > -5 && x < 11 && z > 1 && z < 15) || z > 19) continue
    part('sphere', '#86ae65', x, 0.05, z, 1.2, 0.16, 0.8)
    for (let j = 0; j < 3; j++) part('sphere', ['#ffe5a1', '#fff5d7', '#e99c9e'][i % 3], x + j * 0.2, 0.18, z + (j % 2) * 0.22, 0.18, 0.18, 0.18)
  }
  // Turnout lever has the same blue / green destination colors as the UI.
  part('cylinder', '#f7e9b9', -12, 0.12, -0.7, 2.1, 0.24, 2.1)
  part('cylinder', '#546e79', -12, 0.65, -0.7, 0.18, 1, 0.18)
  const lever = new THREE.Group()
  lever.position.set(-12, 1.1, -0.7)
  const leverMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1, 0.18), new THREE.MeshStandardMaterial({ color: '#f4f0d3' }))
  leverMesh.position.y = 0.35
  lever.add(leverMesh)
  const leverKnob = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshStandardMaterial({ color: '#287fca' }))
  leverKnob.position.y = 0.95
  lever.add(leverKnob)
  group.add(lever)
  const marker = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.09, 6, 32), new THREE.MeshBasicMaterial({ color: '#ffed8e' }))
  marker.rotation.x = -Math.PI / 2
  marker.position.set(-12, TRACK_Y + 0.06, -3)
  group.add(marker)
  // A short sequence of arrows makes the turnout's selected exit unmistakable.
  const routeArrows = { bridge: new THREE.Group(), forest: new THREE.Group() }
  const arrowGeometry = new THREE.BufferGeometry()
  arrowGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .42, -.3, 0, -.2, .3, 0, -.2], 3))
  arrowGeometry.computeVertexNormals()
  for (const edge of ['bridge', 'forest'] as const) {
    const material = new THREE.MeshBasicMaterial({ color: edge === 'bridge' ? '#147dd5' : '#147e43', side: THREE.DoubleSide })
    for (let d = 2; d < 13; d += 2) {
      const arrow = new THREE.Mesh(arrowGeometry, material)
      arrow.position.copy(course.curves[edge].getPointAt(d / course.lengths[edge])).addScaledVector(up, 0.245)
      arrow.quaternion.copy(railOrientation(course.curves[edge].getTangentAt(d / course.lengths[edge])))
      routeArrows[edge].add(arrow)
    }
    group.add(routeArrows[edge])
  }

  // A small windmill and ripples add quiet movement to the scenery.
  part('cone', '#f4e1bc', 15, 1.5, 5, 2.1, 3.1, 2.1)
  part('cone', '#c87355', 15, 3.35, 5, 2.4, 1.2, 2.4)
  const sails = new THREE.Group()
  sails.position.set(15, 3, 6)
  const sailMaterial = new THREE.MeshStandardMaterial({ color: '#fff6d7', roughness: 0.85 })
  const sailGeometry = new THREE.BoxGeometry(0.35, 2.1, 0.09)
  for (let i = 0; i < 4; i++) {
    const sail = new THREE.Mesh(sailGeometry, sailMaterial)
    const angle = i * Math.PI / 2
    sail.position.set(Math.sin(angle) * 1.05, Math.cos(angle) * 1.05, 0)
    sail.rotation.z = -angle
    sail.castShadow = true
    sails.add(sail)
  }
  group.add(sails)
  const ripples = new THREE.Group()
  const rippleGeometry = new THREE.RingGeometry(0.91, 1, 28)
  const rippleMaterial = new THREE.MeshBasicMaterial({ color: '#c5e7d6', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
  for (let i = 0; i < 4; i++) {
    const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial)
    ripple.rotation.x = -Math.PI / 2
    ripple.position.set(1 + (i % 2) * 4, 0.09, 6 + Math.floor(i / 2) * 3)
    ripples.add(ripple)
  }
  group.add(ripples)
  batch.finish()
  return {
    group, tunnelStart, tunnelEnd,
    setOverview(overview: boolean) {
      stationLabel.visible = overview
      tunnelLabel.visible = overview
    },
    update(seconds: number, reducedMotion: boolean) {
      if (reducedMotion) return
      sails.rotation.z = seconds * 0.23
      ripples.children.forEach((ripple, i) => {
        const scale = 0.3 + ((seconds * 0.18 + i * 0.25) % 1) * 0.55
        ripple.scale.set(scale, scale * 0.7, 1)
      })
    },
    setRoute(route: JourneyRoute) {
      routeArrows.bridge.visible = route === 'bridge'
      routeArrows.forest.visible = route === 'forest'
      lever.rotation.z = route === 'bridge' ? -0.6 : 0.6
      ;(leverKnob.material as THREE.MeshStandardMaterial).color.set(route === 'bridge' ? '#287fca' : '#328555')
      for (const edge of ['bridge', 'forest'] as const) {
        const material = trackMaterials[edge]!
        material.emissive.set(edge === route ? (edge === 'bridge' ? '#318dc9' : '#519456') : '#000000')
        material.emissiveIntensity = edge === route ? 0.19 : 0
      }
    },
  }
}
