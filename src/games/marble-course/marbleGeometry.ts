import * as THREE from 'three'
import { FUNNEL_DROP, SPINNER_DROP, type PartKind, type Vec3 } from './marbleModel'

type PathPoint = Vec3 & { nx: number; nz: number; width?: number }

function geometry(vertices: number[]): THREE.BufferGeometry {
  const result = new THREE.BufferGeometry()
  result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  result.computeVertexNormals()
  return result
}

function quad(vertices: number[], a: Vec3, b: Vec3, c: Vec3, d: Vec3) {
  for (const p of [a, b, d, b, c, d]) vertices.push(p.x, p.y, p.z)
}

// A closed, bevelled U profile: a pale trough, substantial walls, rounded lips and a solid underside.
const PROFILE = [[-0.82, -0.18], [-0.82, 0.43], [-0.78, 0.49], [-0.75, 0.49], [-0.73, 0.43], [-0.72, 0.20], [-0.64, 0.015], [0, 0], [0.64, 0.015], [0.72, 0.20], [0.73, 0.43], [0.75, 0.49], [0.78, 0.49], [0.82, 0.43], [0.82, -0.18]]

function sweep(points: PathPoint[]): THREE.BufferGeometry {
  const vertices: number[] = []
  const at = (p: PathPoint, i: number): Vec3 => ({ x: p.x + PROFILE[i]![0]! * p.nx * (p.width ?? 1), y: p.y + PROFILE[i]![1]!, z: p.z + PROFILE[i]![0]! * p.nz * (p.width ?? 1) })
  for (let j = 0; j < points.length - 1; j++) {
    for (let i = 0; i < PROFILE.length; i++) quad(vertices, at(points[j]!, i), at(points[j + 1]!, i), at(points[j + 1]!, (i + 1) % PROFILE.length), at(points[j]!, (i + 1) % PROFILE.length))
  }
  const result = geometry(vertices)
  // The central trough is lighter, which keeps the usable groove legible even on small screens.
  for (let j = 0; j < points.length - 1; j++) {
    for (let i = 0; i < PROFILE.length; i++) result.addGroup((j * PROFILE.length + i) * 6, 6, i >= 4 && i <= 9 ? 1 : 0)
  }
  return result
}

export function trackGeometry(kind: 'straight' | 'slope' | 'curve'): THREE.BufferGeometry {
  const points: PathPoint[] = []
  const segments = kind === 'curve' ? 28 : 1
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const a = t * Math.PI / 2
    points.push(kind === 'curve'
      ? { x: -2 + 2 * Math.sin(a), y: 0, z: 2 - 2 * Math.cos(a), nx: -Math.sin(a), nz: Math.cos(a) }
      : { x: -2 + 4 * t, y: kind === 'slope' ? 1.6 * (1 - t) : 0, z: 0, nx: 0, nz: 1 })
  }
  return sweep(points)
}

/** A Y tray with a gently rising splitter. Its sloping sides turn contact into a physical left/right roll. */
export function branchGeometry(): THREE.BufferGeometry {
  const outline = [new THREE.Vector2(-2, -0.74), new THREE.Vector2(-0.8, -0.74)]
  // Smooth, parallel entrances/exits.
  const path = (sign: number) => {
    const points: THREE.Vector2[] = []
    for (let i = 0; i <= 20; i++) {
      const t = i / 20
      const x = -0.8 + 2.8 * t
      const z = sign * 2 * (t * t * (3 - 2 * t))
      const dz = sign * 12 * t * (1 - t) / 2.8
      const width = 0.74 * sign
      points.push(new THREE.Vector2(x - width * dz / Math.hypot(1, dz), z + width / Math.hypot(1, dz)))
    }
    return points
  }
  outline.push(...path(-1).slice(1), ...path(1).reverse(), new THREE.Vector2(-2, 0.74))
  const vertices: number[] = []
  const triangles = THREE.ShapeUtils.triangulateShape(outline, [])
  for (const triangle of triangles) for (const i of [...triangle].reverse()) vertices.push(outline[i]!.x, 0, outline[i]!.y)
  const floorCount = vertices.length / 3
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!, b = outline[(i + 1) % outline.length]!
    // Leave all three connector mouths unobstructed.
    if ((a.x === -2 && b.x === -2) || (Math.abs(a.x - 2) < 0.001 && Math.abs(b.x - 2) < 0.001)) continue
    const dx = b.x - a.x, dz = b.y - a.y, length = Math.hypot(dx, dz)
    const nx = -dz / length, nz = dx / length
    const p = (v: THREE.Vector2, w: number, y: number) => ({ x: v.x + nx * w, y, z: v.y + nz * w })
    quad(vertices, p(a, 0, 0), p(b, 0, 0), p(b, 0.02, 0.43), p(a, 0.02, 0.43))
    quad(vertices, p(a, 0.02, 0.43), p(b, 0.02, 0.43), p(b, -0.14, 0.43), p(a, -0.14, 0.43))
    quad(vertices, p(a, -0.14, 0.43), p(b, -0.14, 0.43), p(b, -0.14, -0.18), p(a, -0.14, -0.18))
  }
  for (const sign of [-1, 1]) {
    const nose = { x: -0.8, y: 0, z: 0 }
    const ridge = { x: 2, y: 1.15, z: 0 }
    const edge = { x: 2, y: 0, z: sign * 1.26 }
    for (const p of sign < 0 ? [nose, ridge, edge] : [nose, edge, ridge]) vertices.push(p.x, p.y, p.z)
  }
  // The back of the splitter closes the gap between outlets, including a ball arriving fast along its ridge.
  const cap = [[-1.26, 0.43], [-1.1, 0.7], [-0.6, 1.22], [-0.2, 1.43], [0.2, 1.43], [0.6, 1.22], [1.1, 0.7], [1.26, 0.43]]
  for (let i = 0; i < cap.length - 1; i++) {
    const a = cap[i]!, b = cap[i + 1]!
    quad(vertices, { x: 1.94, y: 0, z: a[0]! }, { x: 1.94, y: 0, z: b[0]! }, { x: 1.94, y: b[1]!, z: b[0]! }, { x: 1.94, y: a[1]!, z: a[0]! })
    quad(vertices, { x: 2.06, y: 0, z: b[0]! }, { x: 2.06, y: 0, z: a[0]! }, { x: 2.06, y: a[1]!, z: a[0]! }, { x: 2.06, y: b[1]!, z: b[0]! })
    quad(vertices, { x: 1.94, y: a[1]!, z: a[0]! }, { x: 1.94, y: b[1]!, z: b[0]! }, { x: 2.06, y: b[1]!, z: b[0]! }, { x: 2.06, y: a[1]!, z: a[0]! })
  }
  const result = geometry(vertices)
  result.addGroup(0, floorCount, 1)
  result.addGroup(floorCount, vertices.length / 3 - floorCount, 0)
  return result
}

export function goalGeometry(): THREE.BufferGeometry {
  const inlet = sweep([{ x: -2, y: 0, z: 0, nx: 0, nz: 1 }, { x: -0.55, y: 0, z: 0, nx: 0, nz: 1 }])
  const vertices = Array.from(inlet.getAttribute('position').array)
  const inletCount = vertices.length / 3
  const rings = [[0, -0.48], [0.6, -0.48], [0.96, -0.28], [1.22, 0.16], [1.30, 0.48], [1.40, 0.51], [1.46, 0.43], [1.46, -0.55]]
  const point = (r: number[], angle: number): Vec3 => ({ x: 0.55 + r[0]! * Math.cos(angle), y: r[1]!, z: r[0]! * Math.sin(angle) })
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI / 24, b = (i + 1) * Math.PI / 24
    for (let j = 0; j < rings.length - 1; j++) {
      if (j >= 2 && Math.cos((a + b) / 2) < -0.82) continue
      quad(vertices, point(rings[j]!, a), point(rings[j]!, b), point(rings[j + 1]!, b), point(rings[j + 1]!, a))
    }
  }
  const result = geometry(vertices)
  for (const group of inlet.groups) result.addGroup(group.start, group.count, group.materialIndex)
  result.addGroup(inletCount, vertices.length / 3 - inletCount, 1)
  inlet.dispose()
  return result
}

/** Coalesce groups by material to keep a curve to two draw calls, not one per face. */
export function compactGroups(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const vertices: number[] = []
  const positions = source.getAttribute('position')
  const result = new THREE.BufferGeometry()
  for (const material of [0, 1]) {
    const start = vertices.length / 3
    for (const group of source.groups) {
      if (group.materialIndex !== material) continue
      for (let i = group.start; i < group.start + group.count; i++) vertices.push(positions.getX(i), positions.getY(i), positions.getZ(i))
    }
    result.addGroup(start, vertices.length / 3 - start, material)
  }
  result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  result.computeVertexNormals()
  source.dispose()
  return result
}

export function createPartGeometries(): Record<PartKind, THREE.BufferGeometry> {
  return {
    straight: compactGroups(trackGeometry('straight')), slope: compactGroups(trackGeometry('slope')), curve: compactGroups(trackGeometry('curve')), branch: compactGroups(branchGeometry()), goal: compactGroups(goalGeometry()),
    jump: compactGroups(jumpGeometry()), spinner: compactGroups(trayGeometry()), funnel: compactGroups(funnelGeometry()), booster: compactGroups(trackGeometry('straight')), seesaw: compactGroups(seesawGeometry()),
  }
}

const pathPoint = (x: number, y = 0, width = 1, z = 0): PathPoint => ({ x, y, z, nx: 0, nz: 1, width })

function combine(sources: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const vertices: number[] = []
  const result = new THREE.BufferGeometry()
  for (const source of sources) {
    const offset = vertices.length / 3
    vertices.push(...Array.from(source.getAttribute('position').array))
    for (const group of source.groups) result.addGroup(offset + group.start, group.count, group.materialIndex)
    source.dispose()
  }
  result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  result.computeVertexNormals()
  return result
}

/** Two genuinely disconnected surfaces. The widened landing tapers back to the standard mouth. */
function jumpGeometry(): THREE.BufferGeometry {
  const ramp = [pathPoint(-3), pathPoint(-1.55)]
  for (let i = 1; i <= 10; i++) {
    const t = i / 10
    ramp.push(pathPoint(-1.55 + 1.1 * t, 0.18 * t * t))
  }
  return combine([sweep(ramp), sweep([pathPoint(0.2, -0.1, 1.6), pathPoint(1.8, -0.06, 1.6), pathPoint(3)])])
}

function trayGeometry(): THREE.BufferGeometry {
  return sweep([pathPoint(-3), pathPoint(-1.7, -SPINNER_DROP * 1.3 / 6, 2.8), pathPoint(1.7, -SPINNER_DROP * 4.7 / 6, 2.8), pathPoint(3, -SPINNER_DROP)])
}

/** The hole is left open; the receiving trough below slopes toward its lower connector. */
function funnelGeometry(): THREE.BufferGeometry {
  const inlet = sweep([pathPoint(-3, 0, 1, -1.4), pathPoint(-1.15, 0, 1, -1.4)])
  const receiver = sweep([pathPoint(-0.95, -1.12, 1.45), pathPoint(0.9, -1.35, 1.45), pathPoint(3, -FUNNEL_DROP)])
  const vertices: number[] = []
  const groups: { start: number; count: number; material: number }[] = []
  const rings = [[0.48, -0.6], [0.75, -0.55], [1.1, -0.44], [1.5, -0.25], [1.95, -0.035], [2.25, 0.12], [2.3, 0.55], [2.43, 0.58], [2.48, 0.48], [2.48, -0.1]]
  const point = (ring: number[], a: number): Vec3 => ({ x: ring[0]! * Math.cos(a), y: ring[1]!, z: ring[0]! * Math.sin(a) })
  for (let i = 0; i < 40; i++) {
    const a = i * Math.PI / 20, b = (i + 1) * Math.PI / 20
    for (let j = 0; j < rings.length - 1; j++) {
      // Open the upper rim only at the tangent inlet.
      if (j >= 4 && Math.cos((a + b) / 2) < -0.35 && Math.sin((a + b) / 2) < -0.35) continue
      groups.push({ start: vertices.length / 3, count: 6, material: j >= 5 ? 0 : 1 })
      quad(vertices, point(rings[j]!, a), point(rings[j]!, b), point(rings[j + 1]!, b), point(rings[j + 1]!, a))
    }
  }
  const bowl = geometry(vertices)
  for (const group of groups) bowl.addGroup(group.start, group.count, group.material)
  return combine([inlet, bowl, receiver])
}

function seesawGeometry(): THREE.BufferGeometry {
  return combine([
    sweep([pathPoint(-3), pathPoint(-1.6, -0.15)]),
    sweep([pathPoint(1.6, -0.15), pathPoint(3)]),
  ])
}

/** Shared visible/physical moving board, in the joint's local coordinate frame. */
export function seesawBoardGeometry(): THREE.BufferGeometry {
  return compactGroups(sweep([pathPoint(-1.95), pathPoint(1.95)]))
}
