import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { type JourneyCourse, type JourneyEdge, type JourneyRoute, type JourneySwitch, railOrientation, ROUTES, TRACK_Y } from './journeyModel'

export type Shape = 'box' | 'sphere' | 'cone' | 'cylinder' | 'roof'
type Batch = { matrices: THREE.Matrix4[]; colors: THREE.Color[] }

/** Repeated scenery costs five draws, regardless of tree / sleeper count. */
export function sceneryBatch(parent: THREE.Group) {
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

export function ribbon(curve: THREE.Curve<THREE.Vector3>, width: number, height: number, offset: number, segments: number) {
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

export type SceneryBatch = ReturnType<typeof sceneryBatch>
type AddMesh = (geometry: THREE.BufferGeometry, color: string) => THREE.Mesh

/** A bevelled toy board, with the sea visible around its edges. */
export function buildGround(mesh: AddMesh, land: string, water: string) {
  const shape = new THREE.Shape()
  shape.moveTo(-25, -28)
  shape.lineTo(25, -28); shape.quadraticCurveTo(29, -28, 29, -24)
  shape.lineTo(29, 26); shape.quadraticCurveTo(29, 30, 25, 30)
  shape.lineTo(-25, 30); shape.quadraticCurveTo(-29, 30, -29, 26)
  shape.lineTo(-29, -24); shape.quadraticCurveTo(-29, -28, -25, -28)
  const board = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.5, bevelThickness: 0.25, curveSegments: 6 })
  board.rotateX(-Math.PI / 2).translate(0, -1.85, 0)
  mesh(board, land)
  const sea = mesh(new THREE.PlaneGeometry(900, 900), water)
  sea.rotation.x = -Math.PI / 2
  sea.position.y = -2.4
  sea.castShadow = false
}
/** A stretch of rail the train disappears into, and what to say meanwhile. */
export type JourneyTunnel = { edge: JourneyEdge; start: number; end: number; caption: string }

/** Ballast beds, continuous rails and instanced sleepers for every edge. */
export function buildTrack(group: THREE.Group, mesh: AddMesh, course: JourneyCourse, sleeper: THREE.Object3D, trunkBed: string) {
  const beds: Record<JourneyEdge, THREE.MeshStandardMaterial> = {}
  let sleeperMesh: THREE.Mesh | undefined
  sleeper.traverse(child => { if (child instanceof THREE.Mesh) sleeperMesh = child })
  const sleeperMatrices: THREE.Matrix4[] = []
  const dummy = new THREE.Object3D()
  const up = new THREE.Vector3(0, 1, 0)
  const railGeometries: THREE.BufferGeometry[] = []
  Object.keys(course.curves).forEach((edge, index) => {
    const curve = course.curves[edge]
    const length = course.lengths[edge]
    // Branches fan into the same junction throats, so each bed rides a few
    // millimetres above the last and their overlaps never fight for depth.
    const bed = mesh(ribbon(curve, 1.85, 0.24, -0.04 + index * 0.0023, Math.ceil(length * 5)), ROUTES[edge]?.bed ?? trunkBed)
    bed.name = `track-${edge}`
    beds[edge] = bed.material as THREE.MeshStandardMaterial
    for (const side of [-1, 1]) {
      const points = curve.getSpacedPoints(Math.ceil(length * 5)).map((p, i, list) => {
        const t = curve.getTangentAt(i / (list.length - 1))
        return p.add(new THREE.Vector3(t.z, 0, -t.x).normalize().multiplyScalar(side * 0.46)).addScaledVector(up, 0.155)
      })
      railGeometries.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), points.length, 0.065, 5, false))
    }
    for (let d = 0.32; d < length; d += 0.58) {
      dummy.position.copy(curve.getPointAt(d / length))
      dummy.quaternion.copy(railOrientation(curve.getTangentAt(d / length)))
      dummy.scale.set(1.55, 1, 0.9)
      dummy.updateMatrix()
      sleeperMatrices.push(dummy.matrix.clone())
    }
  })
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
  return beds
}

/** An open-ended arched shell over one edge, with stone portals at both ends. */
export function buildTunnel(mesh: AddMesh, part: SceneryBatch['part'], curve: THREE.Curve<THREE.Vector3>, length: number, start: number, end: number, colors: { shell: string; wall: string; stone: readonly [string, string] }) {
  const shell: number[] = []
  const shellIndices: number[] = []
  const steps = Math.max(8, Math.round((end - start) * 3.4))
  for (let i = 0; i <= steps; i++) {
    const u = (start + (end - start) * i / steps) / length
    const p = curve.getPointAt(u)
    const tangent = curve.getTangentAt(u)
    const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
    for (let j = 0; j <= 16; j++) {
      const angle = j / 16 * Math.PI
      shell.push(p.x + side.x * Math.cos(angle) * 1.65, p.y + 1.1 + Math.sin(angle) * 1.7, p.z + side.z * Math.cos(angle) * 1.65)
      if (i < steps && j < 16) {
        const k = i * 17 + j
        shellIndices.push(k, k + 1, k + 17, k + 1, k + 18, k + 17)
      }
    }
    for (const s of [-1, 1]) {
      const wall = p.clone().addScaledVector(side, s * 1.8)
      part('box', colors.wall, wall.x, p.y + 0.5, wall.z, 0.4, 1.4, 0.42, 0, Math.atan2(tangent.x, tangent.z))
    }
  }
  const shellGeometry = new THREE.BufferGeometry()
  shellGeometry.setAttribute('position', new THREE.Float32BufferAttribute(shell, 3))
  shellGeometry.setIndex(shellIndices)
  shellGeometry.computeVertexNormals()
  const tunnel = mesh(shellGeometry, colors.shell)
  ;(tunnel.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
  for (const d of [start, end]) {
    const p = curve.getPointAt(d / length)
    const t = curve.getTangentAt(d / length)
    const side = new THREE.Vector3(t.z, 0, -t.x).normalize()
    for (let j = 0; j < 13; j++) {
      const angle = (j + 0.5) / 13 * Math.PI
      const q = p.clone().addScaledVector(side, Math.cos(angle) * 1.73)
      part('box', colors.stone[j % 2], q.x, p.y + 1.1 + Math.sin(angle) * 1.77, q.z, 0.48, 0.4, 0.65, 0, Math.atan2(t.x, t.z), angle - Math.PI / 2)
    }
    for (const s of [-1, 1]) {
      const q = p.clone().addScaledVector(side, s * 1.76)
      part('box', colors.stone[1], q.x, p.y + 0.55, q.z, 0.45, 1.25, 0.7, 0, Math.atan2(t.x, t.z))
    }
  }
  return tunnel
}

/**
 * A point's lever, a ring on the junction and a trail of arrows down each
 * branch, all in the branch colours the controls use. Arrows for one branch
 * share a single merged mesh, so a point costs one draw per branch.
 */
export function buildSwitchStand(group: THREE.Group, part: SceneryBatch['part'], course: JourneyCourse, point: JourneySwitch) {
  const [x, z] = point.lever
  part('cylinder', '#f7e9b9', x, 0.12, z, 2.1, 0.24, 2.1)
  part('cylinder', '#546e79', x, 0.65, z, 0.18, 1, 0.18)
  const lever = new THREE.Group()
  lever.position.set(x, 1.1, z)
  const junction = course.curves[point.trunk].getPointAt(1)
  const heading = course.curves[point.trunk].getTangentAt(1)
  // The lever swings along the line, like the blades it throws.
  lever.rotation.y = Math.atan2(-heading.z, heading.x)
  const leverMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1, 0.18), new THREE.MeshStandardMaterial({ color: '#f4f0d3' }))
  leverMesh.position.y = 0.35
  lever.add(leverMesh)
  const knobMaterial = new THREE.MeshStandardMaterial({ color: ROUTES[point.branches[0]].color })
  const leverKnob = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), knobMaterial)
  leverKnob.position.y = 0.95
  lever.add(leverKnob)
  group.add(lever)
  const marker = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.09, 6, 32), new THREE.MeshBasicMaterial({ color: '#ffed8e' }))
  marker.rotation.x = -Math.PI / 2
  marker.position.set(junction.x, TRACK_Y + 0.06, junction.z)
  group.add(marker)
  const up = new THREE.Vector3(0, 1, 0)
  const dummy = new THREE.Object3D()
  const arrows: Record<JourneyRoute, THREE.Mesh> = {}
  for (const edge of point.branches) {
    const pieces: THREE.BufferGeometry[] = []
    for (let d = 2; d < 13; d += 2) {
      const arrow = new THREE.BufferGeometry()
      arrow.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .42, -.3, 0, -.2, .3, 0, -.2], 3))
      dummy.position.copy(course.curves[edge].getPointAt(d / course.lengths[edge])).addScaledVector(up, 0.245)
      dummy.quaternion.copy(railOrientation(course.curves[edge].getTangentAt(d / course.lengths[edge])))
      dummy.updateMatrix()
      arrow.applyMatrix4(dummy.matrix)
      pieces.push(arrow)
    }
    const trail = new THREE.Mesh(mergeGeometries(pieces), new THREE.MeshBasicMaterial({ color: ROUTES[edge].arrow, side: THREE.DoubleSide }))
    pieces.forEach(piece => piece.dispose())
    trail.name = `route-arrows-${edge}`
    arrows[edge] = trail
    group.add(trail)
  }
  return {
    setRoute(route: JourneyRoute, beds: Record<JourneyEdge, THREE.MeshStandardMaterial>) {
      const index = Math.max(0, point.branches.indexOf(route))
      lever.rotation.z = point.branches.length < 2 ? 0 : -0.6 + 1.2 * index / (point.branches.length - 1)
      knobMaterial.color.set(ROUTES[route].color)
      for (const edge of point.branches) {
        arrows[edge].visible = edge === route
        beds[edge].emissive.set(edge === route ? ROUTES[edge].glow : '#000000')
        beds[edge].emissiveIntensity = edge === route ? 0.19 : 0
      }
    },
  }
}
