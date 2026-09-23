import { BoxGeometry, Color, Group, InstancedMesh, MeshStandardMaterial, Object3D, Vector3, type CurvePath } from 'three'
import type { Shape } from './journeyParts'

/** Where the town's road cuts across the rails, in metres along the city branch. */
export const CITY_CROSSING = 13.2
const PAVED_FROM = 11.5
const PAVED_TO = 23
const WIRED_FROM = 10.7
const WIRED_TO = 31.5

export type CityScenery = {
  /** `ry` turns a part's local +Z onto the given heading, and +X to its right. */
  part: (shape: Shape, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx?: number, ry?: number, rz?: number) => void
  beam: (color: string, a: Vector3, b: Vector3, width: number) => void
  /** True when nothing of the given radius would sit on any branch of the railway. */
  clear: (x: number, z: number, radius: number) => boolean
}
type Footprint = { x: number; z: number; radius: number }
/** Blocks that line the street, placed by distance along the branch they follow. */
export const BLOCKS: readonly (readonly [distance: number, offset: number, width: number, depth: number, height: number, palette: number])[] = [
  [12.4, 3.6, 2.4, 2.6, 4.4, 1],
  [15.6, 3.9, 2.6, 2.6, 3.3, 2],
  [18.6, 4.0, 2.6, 2.8, 5.0, 0],
  [21.6, 3.7, 2.4, 2.4, 3.6, 1],
  [24.3, 3.3, 2.2, 2.2, 4.2, 2],
  [27.2, 2.9, 1.6, 1.6, 2.4, 0],
]
// The skyline stands beyond the viaduct, where the chase camera never goes, so
// even the tallest tower cannot come between the player and the train.
export const SKYLINE: readonly (readonly [x: number, z: number, width: number, depth: number, height: number, palette: number])[] = [
  [-11, -7.5, 2.6, 2.6, 5, 0],
  [-12.5, -12, 2.8, 2.8, 6.4, 2],
  [-11.2, -16.5, 2.6, 2.6, 4.6, 1],
  [-13.5, -20, 2.4, 2.4, 3.8, 0],
]
// Walls stay pale so the windows read, with the island's own roof accents on
// the parapets and signs to keep the town part of the same toy world.
const WALLS = ['#f2e3c1', '#dce6ea', '#f0d9c5']
const ROOFS = ['#c87559', '#5f8fa3', '#c9a24e']
const SIGNS = ['#d9614a', '#3f8fa8', '#e3a63a']

export function createCityDistrict(scenery: CityScenery, curve: CurvePath<Vector3>, length: number) {
  const { part, beam, clear } = scenery
  const at = (distance: number) => {
    const u = Math.max(0, Math.min(1, distance / length))
    const point = curve.getPointAt(u)
    const tangent = curve.getTangentAt(u)
    return { point, tangent, right: new Vector3(tangent.z, 0, -tangent.x).normalize(), heading: Math.atan2(tangent.x, tangent.z) }
  }
  /** A spot beside the rails: `side` 1 is left of travel, -1 the open right. */
  const beside = (distance: number, side: number, offset: number) => {
    const here = at(distance)
    return { position: here.point.clone().addScaledVector(here.right, side * offset), heading: here.heading }
  }
  const face = (x: number, z: number, heading: number, lx: number, lz: number): [number, number] =>
    [x + lx * Math.cos(heading) + lz * Math.sin(heading), z - lx * Math.sin(heading) + lz * Math.cos(heading)]
  const footprints: Footprint[] = []

  /** One block: walls, a parapet, a roof tank, lit windows and a hanging sign. */
  function block(x: number, z: number, front: number, width: number, depth: number, height: number, palette: number) {
    const span = Math.hypot(width, depth) / 2
    if (!clear(x, z, span + 1.3)) return
    footprints.push({ x, z, radius: span + 1.1 })
    part('box', WALLS[palette], x, height / 2, z, width, height, depth, 0, front)
    part('box', ROOFS[palette], x, height + 0.11, z, width + 0.26, 0.22, depth + 0.26, 0, front)
    const [tankX, tankZ] = face(x, z, front, width * 0.24, -depth * 0.2)
    part('cylinder', '#b6bcb9', tankX, height + 0.62, tankZ, 0.5, 0.76, 0.5)
    const floors = Math.max(2, Math.round((height - 0.5) / 1.15))
    const columns = Math.max(2, Math.round(width / 0.95))
    for (let floor = 0; floor < floors; floor++) {
      for (let column = 0; column < columns; column++) {
        const lx = (column - (columns - 1) / 2) * (width / columns)
        const lit = (floor * 3 + column * 5 + palette) % 4 === 0
        for (const outward of [depth / 2 + 0.04, -depth / 2 - 0.04]) {
          const [wx, wz] = face(x, z, front, lx, outward)
          part('box', lit ? '#ffe8a6' : '#96b7c4', wx, 0.85 + floor * 1.15, wz, width / columns * 0.6, 0.6, 0.06, 0, front)
        }
      }
    }
    const [signX, signZ] = face(x, z, front, width / 2 + 0.1, depth / 2 - 0.35)
    part('box', SIGNS[palette], signX, height * 0.6, signZ, 0.1, height * 0.46, 0.4, 0, front)
  }

  // Paving reads as a street from the cab and from the overview alike. Slabs
  // alternate height by millimetres so their overlaps never fight for depth.
  for (let i = 0; PAVED_FROM + i * 3 < PAVED_TO; i++) {
    const { position, heading } = beside(PAVED_FROM + i * 3, -1, 1.2)
    part('box', i % 2 ? '#c9c8bd' : '#c4c3b7', position.x, 0.032 + (i % 2) * 0.006, position.z, 7.4, 0.06, 3.3, 0, heading)
  }
  // Street blocks turn their windows to the rails; the skyline faces the town.
  for (const [distance, offset, width, depth, height, palette] of BLOCKS) {
    const { position, heading } = beside(distance, -1, offset)
    block(position.x, position.z, heading - Math.PI / 2, width, depth, height, palette)
  }
  for (const [x, z, width, depth, height, palette] of SKYLINE) block(x, z, Math.PI / 2, width, depth, height, palette)

  // Road, crossing gates, stripes and traffic share one distance along the
  // rails, so the whole crossing stays together however the branch is reshaped.
  const crossing = at(CITY_CROSSING)
  const across = crossing.right
  const roadHeading = crossing.heading + Math.PI / 2
  // West the road runs on under the viaduct; east it stops short of the woods.
  for (const [side, reach] of [[-1, 3.8], [1, 5.8]] as const) {
    const middle = crossing.point.clone().addScaledVector(across, side * (reach / 2 + 1.6))
    part('box', '#74787c', middle.x, 0.07, middle.z, 2.7, 0.1, reach, 0, roadHeading)
    for (let i = 0; i < Math.floor((reach - 0.8) / 1.7); i++) {
      const dash = crossing.point.clone().addScaledVector(across, side * (2.5 + i * 1.7))
      part('box', '#f2efe2', dash.x, 0.125, dash.z, 0.14, 0.03, 0.8, 0, roadHeading)
    }
  }
  for (let i = -3; i <= 3; i++) {
    const stripe = crossing.point.clone().addScaledVector(across, -3.4 + i * 0.42)
    part('box', '#f5f2e4', stripe.x, 0.125, stripe.z, 2.5, 0.03, 0.26, 0, roadHeading)
  }
  // The deck between the gates lets the road meet the rails at the same level.
  for (const rail of [-1, 1]) {
    const deck = crossing.point.clone().addScaledVector(crossing.tangent, rail * 1.35)
    part('box', '#b9b3a3', deck.x, 0.16, deck.z, 4.4, 0.24, 0.9, 0, roadHeading)
  }
  // Barriers are the one piece of the town that moves, so their arms are real
  // meshes on a pivot. One instanced draw per gate keeps that to two calls.
  const armGeometry = new BoxGeometry(0.34, 0.18, 0.72)
  const armMaterial = new MeshStandardMaterial({ roughness: 0.7, flatShading: true })
  const gates: Group[] = []
  for (const side of [-1, 1] as const) {
    const post = crossing.point.clone().addScaledVector(across, side * 2.1)
    part('box', '#f0ead2', post.x, 0.3, post.z, 0.36, 0.6, 0.36)
    part('cylinder', '#54595c', post.x, 1.05, post.z, 0.18, 1.5, 0.18)
    part('box', '#3d4448', post.x, 2.42, post.z, 0.66, 0.32, 0.16, 0, crossing.heading)
    for (const lamp of [-0.26, 0.26]) {
      const light = post.clone().addScaledVector(crossing.tangent, lamp)
      part('sphere', '#e35a44', light.x, 2.42, light.z, 0.26, 0.26, 0.2)
    }
    // Arms hang from diagonally opposite posts, one per side of the road.
    const gate = new Group()
    gate.name = `crossing-gate-${side < 0 ? 'near' : 'far'}`
    gate.position.set(post.x, 1.78, post.z)
    gate.rotation.order = 'YXZ'
    gate.rotation.y = crossing.heading + (side < 0 ? Math.PI : 0)
    const arms = new InstancedMesh(armGeometry, armMaterial, 3)
    const piece = new Object3D()
    for (let i = 0; i < 3; i++) {
      piece.position.set(0, 0, 0.42 + i * 0.76)
      piece.updateMatrix()
      arms.setMatrixAt(i, piece.matrix)
      arms.setColorAt(i, new Color(i % 2 ? '#fbf6e4' : '#d9543f'))
    }
    arms.castShadow = true
    arms.computeBoundingSphere()
    gate.add(arms)
    gates.push(gate)
  }

  // Masts take whichever shoulder has room, so the wire can run the whole town.
  const stations: Vector3[] = []
  for (let d = WIRED_FROM; d < WIRED_TO; d += 4) {
    const here = at(d)
    stations.push(here.point.clone().setY(here.point.y + 3.45))
    const mast = [1, -1].map(side => here.point.clone().addScaledVector(here.right, side * 1.8)).find(spot => clear(spot.x, spot.z, 1.55))
    if (!mast) continue
    part('cylinder', '#7c848a', mast.x, 1.85, mast.z, 0.16, 3.7, 0.16)
    const arm = mast.clone().lerp(here.point, 0.5)
    part('box', '#7c848a', arm.x, 3.52, arm.z, 0.1, 0.1, 1.9, 0, here.heading + Math.PI / 2)
  }
  for (let i = 1; i < stations.length; i++) beam('#626b6f', stations[i - 1], stations[i], 0.05)

  // Cars, a bus and a few people at the crossing give the blocks their scale.
  const traffic: readonly (readonly [side: -1 | 1, distance: number, color: string, bus: boolean])[] =
    [[-1, 2.9, '#e0b84f', false], [-1, 4.5, '#5e93c0', false], [1, 3.3, '#e07d5c', false], [1, 5.6, '#8bb573', true]]
  for (const [side, distance, color, bus] of traffic) {
    const spot = crossing.point.clone().addScaledVector(across, side * distance).addScaledVector(crossing.tangent, side * 0.62)
    const body = bus ? 2.7 : 1.7
    part('box', color, spot.x, 0.42, spot.z, 0.86, 0.52, body, 0, roadHeading)
    part('box', bus ? '#f6f2e0' : color, spot.x, 0.86, spot.z, 0.8, 0.42, body * 0.64, 0, roadHeading)
    part('box', '#9ec6d6', spot.x, 0.9, spot.z, 0.84, 0.26, body * 0.62, 0, roadHeading)
    for (const wheel of [-1, 1]) {
      const axle = spot.clone().addScaledVector(across, wheel * body * 0.32)
      part('box', '#41464a', axle.x, 0.19, axle.z, 0.9, 0.3, 0.32, 0, roadHeading)
    }
  }
  for (let i = 0; i < 4; i++) {
    const walk = crossing.point.clone().addScaledVector(across, -3.1 - i * 0.62).addScaledVector(crossing.tangent, 1.85 + (i % 2) * 0.4)
    part('sphere', ['#dd8a5e', '#6f97c2', '#c8749a', '#e0c05c'][i], walk.x, 0.98, walk.z, 0.42, 0.7, 0.38)
    part('sphere', '#efc79d', walk.x, 1.5, walk.z, 0.38, 0.4, 0.38)
  }
  for (const [distance, lamp] of [[11.4, true], [14.6, false], [17.4, true], [20.4, false], [23.2, true], [26.2, false], [29, true]] as const) {
    const { position } = beside(distance, -1, 2.7)
    if (!clear(position.x, position.z, 1.6)) continue
    if (lamp) {
      part('cylinder', '#7f8a90', position.x, 1.3, position.z, 0.14, 2.6, 0.14)
      part('sphere', '#fff2c4', position.x, 2.66, position.z, 0.42, 0.32, 0.42)
    } else {
      part('cylinder', '#8d7355', position.x, 0.5, position.z, 0.22, 1, 0.22)
      part('sphere', '#5f9a63', position.x, 1.42, position.z, 1.4, 1.3, 1.4)
    }
  }

  return { gates, footprints }
}
