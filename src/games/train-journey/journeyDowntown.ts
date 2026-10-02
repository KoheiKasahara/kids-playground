import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { type JourneyCourse, type JourneyRoutes, MAPS } from './journeyModel'
import { buildGround, buildSwitchStand, buildTrack, buildTunnel, journeyLabel, sceneryBatch, type JourneyTunnel, type Shape } from './journeyParts'
import type { JourneyWorld } from './journeyScene'

export type DowntownScenery = {
  part: (shape: Shape, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx?: number, ry?: number, rz?: number) => void
  beam: (color: string, a: THREE.Vector3, b: THREE.Vector3, width: number) => void
  /** True when nothing of the given radius would sit on any branch of the railway. */
  clear: (x: number, z: number, radius: number) => boolean
}
type Footprint = { x: number; z: number; radius: number }

/** Where the tall things stand, so labels and tests can find them. */
export const TOWER_SPOT = { x: 12, z: -10 }
export const WHEEL_SPOT = { x: 32.8, y: 5.6, z: -11.5, radius: 4.3 }
export const SCREEN_SPOT = { x: 0, y: 4.8, z: 6.44 }
/** The subway line runs covered between these distances along its branch. */
export const SUBWAY_TUNNEL = { start: 9.5, end: 27 } as const
/** The avenue the traffic drives along, east–west through the scramble crossing. */
export const AVENUE = { z: 4, from: -15.5, to: 15.5 } as const
const CROSS_X = 4

/** Skyscrapers of the core, by centre, footprint, height and facade. */
export const SKYSCRAPERS: readonly (readonly [x: number, z: number, width: number, depth: number, height: number, style: number])[] = [
  [-6, -3, 3.4, 3.4, 9, 0],
  [-1, -5, 3.2, 3.2, 13, 1],
  [-3.5, -11, 3, 3, 10, 2],
  [0.5, -15, 3, 3, 7, 3],
  [-9.5, 0.2, 2.6, 2.6, 6, 3],
  [8, -1.5, 3.2, 3.2, 12, 0],
  [14, -1.5, 2.8, 2.8, 8, 2],
  [7.5, -8, 2.6, 3.4, 7, 3],
  [8, -16, 3, 3, 9, 1],
  [0, 8.2, 3.4, 3.4, 8, 3],
  [-5, 9, 3.4, 3.4, 14, 0],
  [-10.5, 8.5, 3, 3, 9, 1],
  [-2.5, 14, 4, 2.6, 5, 2],
  [-14, 12.5, 2.4, 2.4, 5, 2],
  [8.5, 8.5, 3.4, 3.4, 15, 1],
  [14, 9, 3, 3, 10, 0],
  [9, 14.5, 3.6, 2.4, 5, 3],
]
/** Lower blocks tucked between the branches west of the core. */
const MIDRISE: readonly (readonly [x: number, z: number, width: number, depth: number, height: number, style: number])[] = [
  [-15.3, -9.8, 2, 2, 3.4, 2],
  [-13, -14.6, 2, 2, 2.8, 3],
  [-9.6, -18.4, 2, 1.8, 2.6, 2],
  [6, -25.4, 3, 2.1, 2.2, 3],
  [9.4, -25.4, 2.6, 2.1, 1.8, 2],
  [22.2, -16.5, 2.1, 3.4, 1.8, 4],
  [22.3, -10.5, 2.1, 3.4, 1.9, 4],
  [22, -4.6, 2.1, 3.2, 1.7, 4],
]
// Glass towers in cool blues and greens, with warmer stone ones between.
const FACADES = [
  { body: '#6f9cc0', band: '#e2ecf0', roof: '#98a4ab' },
  { body: '#72adb0', band: '#eef4ef', roof: '#8c9e9e' },
  { body: '#e9dcc3', band: '#86aac0', roof: '#b8865a' },
  { body: '#dde3e5', band: '#7ea3bc', roof: '#c46a4d' },
  { body: '#c9744f', band: '#e8d9c0', roof: '#7d8a8f' },
]
const CAR_COLORS = ['#f2c230', '#f7f4ea', '#d9533f', '#4f86c6', '#f2c230', '#6fae7a', '#f7f4ea', '#f2c230']

/** Everything that stands still downtown, as shared primitive instances. */
export function createDowntownDistrict(scenery: DowntownScenery) {
  const { part, beam, clear } = scenery
  const footprints: Footprint[] = []
  const free = (x: number, z: number, radius: number) => clear(x, z, radius) && !footprints.some(spot => Math.hypot(spot.x - x, spot.z - z) < spot.radius + radius - 1.2)

  function building(x: number, z: number, width: number, depth: number, height: number, style: number, tall: boolean) {
    const span = Math.hypot(width, depth) / 2
    if (!clear(x, z, span + 1.3)) return
    footprints.push({ x, z, radius: span + 0.6 })
    const facade = FACADES[style]
    part('box', facade.body, x, height / 2, z, width, height, depth)
    // Ribbon windows: one light band per floor wraps all four faces.
    for (let y = 0.95; y < height - 0.35; y += tall ? 0.9 : 1.05) part('box', facade.band, x, y, z, width + 0.06, tall ? 0.28 : 0.42, depth + 0.06)
    part('box', '#4f6570', x, 0.36, z, width + 0.08, 0.6, depth + 0.08)
    part('box', facade.roof, x, height + 0.1, z, width + 0.2, 0.2, depth + 0.2)
    if (!tall) return
    if (height >= 12) {
      // The tallest step in at the top and carry an antenna with a red light.
      part('box', facade.body, x, height + 1.1, z, width * 0.62, 2, depth * 0.62)
      part('box', facade.band, x, height + 1.1, z, width * 0.62 + 0.05, 0.3, depth * 0.62 + 0.05)
      part('cylinder', '#9aa3a8', x, height + 3, z, 0.08, 1.8, 0.08)
      part('sphere', '#e34b3c', x, height + 3.95, z, 0.24, 0.24, 0.24)
    } else {
      part('box', '#b9bfc2', x + width * 0.18, height + 0.45, z - depth * 0.15, width * 0.36, 0.5, depth * 0.3)
      part('cylinder', '#e0c35a', x - width * 0.2, height + 0.22, z + depth * 0.2, width * 0.34, 0.04, width * 0.34)
    }
  }
  for (const [x, z, width, depth, height, style] of SKYSCRAPERS) building(x, z, width, depth, height, style, true)
  for (const [x, z, width, depth, height, style] of MIDRISE) building(x, z, width, depth, height, style, false)

  // The river runs the length of the west shore, behind a stone embankment.
  part('box', '#4ea6c8', -27.05, 0.03, 1, 2.5, 0.06, 57)
  part('box', '#d8d3c6', -25.65, 0.2, 1, 0.3, 0.4, 57)
  for (const [z, color] of [[-9, '#3f8fb3'], [13, '#e07a4f']] as const) {
    part('box', '#f4f0e4', -27, 0.24, z, 0.95, 0.36, 2.3)
    part('box', color, -27, 0.56, z + 0.2, 0.7, 0.34, 1.1)
  }

  // Avenues cross at a scramble crossing in the middle of the core.
  part('box', '#d8d3c6', 0, 0.02, AVENUE.z, 32, 0.04, 4.6)
  part('box', '#d8d3c6', CROSS_X, 0.025, -0.5, 4.6, 0.04, 33)
  part('box', '#6b7075', 0, 0.04, AVENUE.z, 32, 0.08, 2.8)
  part('box', '#6b7075', CROSS_X, 0.045, -0.5, 2.8, 0.08, 33)
  for (let x = -15; x < 16; x += 2) if (Math.abs(x - CROSS_X) > 3) part('box', '#f4f1e4', x, 0.1, AVENUE.z, 0.9, 0.03, 0.12)
  for (let z = -16.5; z < 16; z += 2) if (Math.abs(z - AVENUE.z) > 3) part('box', '#f4f1e4', CROSS_X, 0.105, z, 0.12, 0.03, 0.9)
  for (let i = -3; i <= 3; i++) {
    for (const s of [-1, 1]) {
      part('box', '#f7f5ec', CROSS_X + i * 0.38, 0.11, AVENUE.z + s * 2.05, 0.2, 0.02, 1)
      part('box', '#f7f5ec', CROSS_X + s * 2.05, 0.11, AVENUE.z + i * 0.38, 1, 0.02, 0.2)
      // The diagonals are what make it a scramble: walkers cross every way at once.
      part('box', '#f7f5ec', CROSS_X + i * 0.4, 0.115, AVENUE.z + s * i * 0.4, 0.2, 0.02, 0.9, 0, s * Math.PI / 4)
    }
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const cx = CROSS_X + sx * 2.35
    const cz = AVENUE.z + sz * 2.35
    part('cylinder', '#59636a', cx + sx * 0.3, 1.2, cz + sz * 0.3, 0.12, 2.4, 0.12)
    part('box', '#3d464c', cx + sx * 0.3, 2.3, cz + sz * 0.3, 0.3, 0.7, 0.3)
    part('sphere', sx === sz ? '#5fc56b' : '#e2574a', cx + sx * 0.3, 2.45, cz + sz * 0.1, 0.18, 0.18, 0.1)
    for (let k = 0; k < 3; k++) {
      const px = cx - sx * k * 0.45
      const pz = cz + sz * (k % 2) * 0.4
      part('sphere', ['#dd8a5e', '#6f97c2', '#c8749a', '#e0c05c', '#79b28a'][(k + sx + 2 * sz + 4) % 5], px, 0.72, pz, 0.36, 0.6, 0.32)
      part('sphere', '#efc79d', px, 1.17, pz, 0.32, 0.34, 0.32)
    }
  }
  // Taxis wait in a rank by the station end of the avenue.
  for (let i = 0; i < 3; i++) {
    const z = 10.5 + i * 1.9
    part('box', '#f2c230', CROSS_X + 0.7, 0.36, z, 0.8, 0.46, 1.6)
    part('box', '#f7f1d8', CROSS_X + 0.7, 0.74, z + 0.05, 0.72, 0.34, 0.95)
    part('box', '#8fb7c9', CROSS_X + 0.7, 0.76, z + 0.05, 0.76, 0.2, 0.9)
    part('box', '#fff6c8', CROSS_X + 0.7, 0.98, z + 0.05, 0.3, 0.1, 0.16)
  }

  // A red and white lattice tower, the landmark of the city.
  const { x: tx, z: tz } = TOWER_SPOT
  footprints.push({ x: tx, z: tz, radius: 3.6 })
  const corner = (height: number): number => height < 9 ? 2.4 - height / 9 * 1.5 : 0.9 - (height - 9) / 5 * 0.55
  const levels = [0, 1.5, 3, 4.5, 6, 7.5, 9, 10.7, 12.4, 14]
  for (let i = 0; i < levels.length - 1; i++) {
    const color = i % 2 ? '#f3efe6' : '#e0502f'
    const lo = levels[i]
    const hi = levels[i + 1]
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const a = new THREE.Vector3(tx + sx * corner(lo), lo, tz + sz * corner(lo))
      const b = new THREE.Vector3(tx + sx * corner(hi), hi, tz + sz * corner(hi))
      beam(color, a, b, 0.24)
    }
    for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]] as const) {
      beam(color, new THREE.Vector3(tx + ax * corner(lo), lo, tz + az * corner(lo)), new THREE.Vector3(tx + bx * corner(hi), hi, tz + bz * corner(hi)), 0.09)
      beam(color, new THREE.Vector3(tx + bx * corner(lo), lo, tz + bz * corner(lo)), new THREE.Vector3(tx + ax * corner(hi), hi, tz + az * corner(hi)), 0.09)
    }
  }
  part('box', '#f5f1e6', tx, 6.2, tz, 2.9, 0.9, 2.9)
  part('box', '#7fb2cc', tx, 6.25, tz, 3, 0.4, 3)
  part('box', '#f5f1e6', tx, 11.2, tz, 1.6, 0.6, 1.6)
  part('box', '#7fb2cc', tx, 11.2, tz, 1.66, 0.26, 1.66)
  part('cylinder', '#e0502f', tx, 15.6, tz, 0.16, 3.2, 0.16)
  part('cylinder', '#f3efe6', tx, 16.2, tz, 0.17, 0.5, 0.17)
  part('sphere', '#ffde70', tx, 17.3, tz, 0.3, 0.3, 0.3)

  // The station: a long platform under a canopy, and a brick hall with domes.
  part('box', '#d3cbb8', -1, 0.25, 22.5, 14, 0.5, 3.4)
  part('box', '#fff0af', -1, 0.54, 21.15, 14, 0.09, 0.25)
  for (const x of [-7, -3, 1, 5]) part('cylinder', '#7c8a90', x, 1.8, 23.4, 0.16, 2.6, 0.16)
  part('box', '#ece7da', -1, 3.15, 23.2, 14, 0.2, 1.8)
  part('box', '#c9553f', -1, 3.15, 22.28, 14, 0.3, 0.1)
  part('box', '#c4623f', -1, 1.8, 26.6, 18, 3.6, 3.2)
  for (const y of [1.25, 2.65]) part('box', '#f3ead8', -1, y, 26.6, 18.1, 0.16, 3.3)
  part('box', '#5d6b70', -1, 3.75, 26.6, 18.4, 0.3, 3.5)
  part('box', '#c4623f', -1, 2.5, 26.6, 4, 5, 3.6)
  part('roof', '#5d6b70', -1, 5.45, 26.6, 4.3, 0.9, 3.8)
  part('box', '#8b6b53', -1, 1, 24.85, 1.4, 2, 0.12)
  for (const x of [-8, 6]) {
    part('cylinder', '#c4623f', x, 2.7, 26.6, 3, 5.4, 3)
    part('cylinder', '#f3ead8', x, 4.1, 26.6, 3.05, 0.2, 3.05)
    part('sphere', '#56666b', x, 5.4, 26.6, 3.1, 2.4, 3.1)
    part('sphere', '#e7c566', x, 6.7, 26.6, 0.3, 0.4, 0.3)
  }
  for (let x = -9.5; x <= 7.5; x += 1.3) {
    if (Math.abs(x + 1) < 2.3) continue
    for (const y of [1.9, 3.2]) part('box', '#f5efdf', x, y, 24.97, 0.46, 0.6, 0.06)
  }
  for (let i = 0; i < 8; i++) {
    const x = -7.5 + i * 1.8
    const z = 21.9 + (i % 2) * 0.45
    part('sphere', ['#ed9760', '#6c94bd', '#dfbd54', '#a885b0'][i % 4], x, 1.06, z, 0.45, 0.75, 0.4)
    part('sphere', '#ecc49b', x, 1.65, z, 0.42, 0.45, 0.42)
  }

  // The harbour: a pier with a lighthouse and containers, and ships in the bay.
  part('box', '#cfc6b0', 31.75, -0.9, -11.5, 7.5, 1.8, 15)
  part('box', '#a39a86', 31.75, 0.03, -11.5, 7.3, 0.06, 14.8)
  for (let z = -18.4; z <= -4.6; z += 2.3) part('cylinder', '#4c565c', 35.3, 0.25, z, 0.25, 0.5, 0.25)
  for (let i = 0; i < 6; i++) {
    part('box', ['#d9543f', '#3f7fb8', '#e1a93a', '#5f9d6a', '#8a5cb0', '#d9543f'][i], 29.3 + (i % 3) * 1.25, 0.5 + Math.floor(i / 3) * 1.02, -17.6, 1.1, 1, 2.4)
  }
  for (let i = 0; i < 5; i++) part('cylinder', i % 2 ? '#f5f0e4' : '#d9473a', 34.6, 0.35 + i * 0.7, -4.8, 0.9 - i * 0.07, 0.7, 0.9 - i * 0.07)
  part('cylinder', '#fff1a8', 34.6, 3.85, -4.8, 0.5, 0.6, 0.5)
  part('cone', '#d9473a', 34.6, 4.45, -4.8, 0.75, 0.6, 0.75)
  // Wheel supports: an A-frame each side of the hub.
  const { x: wx, y: wy, z: wz } = WHEEL_SPOT
  for (const side of [-1, 1]) {
    const hub = new THREE.Vector3(wx + side * 0.6, wy, wz)
    for (const dz of [-2.6, 2.6]) beam('#e6e1d4', new THREE.Vector3(wx + side * 1, 0.1, wz + dz), hub, 0.22)
  }
  part('box', '#e38e5a', wx - 1.9, 0.6, wz, 1.4, 1.2, 1.8)
  part('box', '#fbe7b5', wx - 1.9, 1.3, wz, 1.6, 0.2, 2)
  const ship = (x: number, z: number, length: number, hull: string, cargo: boolean) => {
    part('box', hull, x, -1.95, z, length * 0.3, 1.3, length)
    part('box', '#f2eee4', x, -1.25, z, length * 0.3 + 0.05, 0.12, length + 0.05)
    part('box', '#f5f3ec', x, -0.6, z + length * 0.36, length * 0.26, 1.4, length * 0.16)
    part('box', '#6fa2c0', x, -0.35, z + length * 0.28, length * 0.27, 0.3, 0.05)
    if (cargo) {
      for (let i = 0; i < 8; i++) part('box', ['#d9543f', '#3f7fb8', '#e1a93a', '#5f9d6a'][i % 4], x + (i % 2 - 0.5) * 1.3, -0.72 + Math.floor(i / 4) * 0.9, z - length * 0.3 + (Math.floor(i / 2) % 2) * 2.7, 1.2, 0.85, 2.5)
    } else part('box', '#f5f3ec', x, -0.75, z - length * 0.05, length * 0.26, 0.9, length * 0.5)
  }
  ship(39.5, -23, 11, '#2f4f7a', true)
  ship(39, 5, 6.5, '#e7e3d9', false)

  // Street trees and pocket parks fill what the rails and blocks leave free.
  const noise = (n: number) => { const s = Math.sin(n * 127.1 + 31.7) * 43758.5453; return s - Math.floor(s) }
  const onRoad = (x: number, z: number) => Math.abs(z - AVENUE.z) < 2.6 || (Math.abs(x - CROSS_X) < 2.6 && z > -17.5 && z < 16.5)
  const tree = (x: number, z: number, size: number) => {
    part('cylinder', '#8f7254', x, size * 0.45, z, 0.22 * size, size * 0.9, 0.22 * size)
    part('sphere', ['#5f9a63', '#78ad6c', '#4f8a67'][Math.floor(noise(x * 7 + z) * 3)], x, size * 1.25, z, size * 1.3, size * 1.2, size * 1.3)
  }
  for (let x = -14; x <= 15; x += 2.9) {
    for (const z of [AVENUE.z - 2.7, AVENUE.z + 2.7]) if (Math.abs(x - CROSS_X) > 3.2 && free(x, z, 1.9)) tree(x, z, 0.75)
  }
  for (let i = 0; i < 140; i++) {
    const x = noise(i * 3 + 1) * 54 - 27
    const z = noise(i * 3 + 2) * 55 - 27
    // Keep the river, station forecourt and harbour clear of woods.
    if (x < -25 || (z > 20 && x > -12 && x < 10) || x > 26.5 || onRoad(x, z)) continue
    if (free(x, z, 2.1)) tree(x, z, 0.7 + noise(i * 3 + 3) * 0.35)
  }
  return { footprints }
}

/** The downtown map: towers, a lattice tower, subway, river and harbour. */
export function createDowntownScene(course: JourneyCourse, sleeper: THREE.Object3D): JourneyWorld {
  const group = new THREE.Group()
  const batch = sceneryBatch(group)
  const { part, beam } = batch
  const mesh = (geometry: THREE.BufferGeometry, color: string) => {
    const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }))
    object.receiveShadow = object.castShadow = true
    group.add(object)
    return object
  }
  buildGround(mesh, '#c9c6b9', '#7cc0d8')
  const trackSamples = Object.values(course.curves).flatMap(c => c.getSpacedPoints(350))
  const clear = (x: number, z: number, r: number) => !trackSamples.some(p => Math.hypot(p.x - x, p.z - z) < r)
  const beds = buildTrack(group, mesh, course, sleeper, '#bdb6a5')
  const up = new THREE.Vector3(0, 1, 0)

  // Concrete piers and purple parapets carry the skyway between the towers.
  const skyway = course.curves.skyway
  const skywayLength = course.lengths.skyway
  for (let d = 1.5; d < skywayLength - 1; d += 2.6) {
    const p = skyway.getPointAt(d / skywayLength)
    if (p.y < 0.9) continue
    const tangent = skyway.getTangentAt(d / skywayLength)
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
    const heading = Math.atan2(tangent.x, tangent.z)
    part('box', '#d8d4ca', p.x, (p.y - 0.25) / 2, p.z, 0.8, p.y - 0.25, 0.8)
    part('box', '#c3beb2', p.x, p.y - 0.45, p.z, 2.1, 0.4, 1.1, 0, heading)
    const nextU = Math.min(1, (d + 2.6) / skywayLength)
    const next = skyway.getPointAt(nextU)
    const nextT = skyway.getTangentAt(nextU)
    const nextRight = new THREE.Vector3(nextT.z, 0, -nextT.x).normalize()
    for (const side of [-1, 1]) {
      const a = p.clone().addScaledVector(right, side * 1.04).addScaledVector(up, 0.45)
      const b = next.clone().addScaledVector(nextRight, side * 1.04).addScaledVector(up, 0.45)
      beam('#b79fe0', a, b, 0.16)
      beam('#e9e4f3', a.clone().addScaledVector(up, -0.55), b.clone().addScaledVector(up, -0.55), 0.26)
    }
  }

  // The subway dives under a grassy park; the train reappears at the far portal.
  const subway = course.curves.subway
  const tunnel = buildTunnel(mesh, part, subway, course.lengths.subway, SUBWAY_TUNNEL.start, SUBWAY_TUNNEL.end, { shell: '#93bb82', wall: '#b9b6ad', stone: ['#dcd8cf', '#c6c1b6'] })
  tunnel.name = 'subway-tunnel'
  for (let d = SUBWAY_TUNNEL.start + 2; d < SUBWAY_TUNNEL.end - 1; d += 3) {
    const p = subway.getPointAt(d / course.lengths.subway)
    part('cylinder', '#8f7254', p.x, p.y + 3.1, p.z, 0.14, 0.6, 0.14)
    part('sphere', d % 2 > 1 ? '#6aa56c' : '#88b86f', p.x, p.y + 3.6, p.z, 0.9, 0.8, 0.9)
  }
  const portal = subway.getPointAt(SUBWAY_TUNNEL.start / course.lengths.subway)
  const subwayLabel = journeyLabel('ちかてつ', '#c0392f', 4.2)
  subwayLabel.position.copy(portal).add(new THREE.Vector3(0, 4, 0))
  group.add(subwayLabel)

  createDowntownDistrict({ part, beam, clear })
  const stationLabel = journeyLabel(MAPS.downtown.station, '#b0523a', 6)
  stationLabel.position.set(-1, 8, 26.6)
  group.add(stationLabel)
  const towerLabel = journeyLabel('タワー', '#d0512c', 4)
  towerLabel.position.set(TOWER_SPOT.x, 19, TOWER_SPOT.z)
  group.add(towerLabel)
  const wheelLabel = journeyLabel('かんらんしゃ', '#2f63c4', 5)
  wheelLabel.position.set(WHEEL_SPOT.x, WHEEL_SPOT.y + WHEEL_SPOT.radius + 2, WHEEL_SPOT.z)
  group.add(wheelLabel)
  const stands = course.switches.map(point => buildSwitchStand(group, part, course, point))

  // The big wheel turns slowly; its cabins hang level whatever the angle.
  const wheel = new THREE.Group()
  wheel.position.set(WHEEL_SPOT.x, WHEEL_SPOT.y, WHEEL_SPOT.z)
  const wheelParts: THREE.BufferGeometry[] = [new THREE.TorusGeometry(WHEEL_SPOT.radius, 0.13, 6, 40).rotateY(Math.PI / 2), new THREE.CylinderGeometry(0.4, 0.4, 1.5, 12).rotateZ(Math.PI / 2)]
  for (let i = 0; i < 12; i++) wheelParts.push(new THREE.BoxGeometry(0.07, WHEEL_SPOT.radius, 0.07).translate(0, WHEEL_SPOT.radius / 2, 0).rotateX(i * Math.PI / 6))
  const wheelGeometry = mergeGeometries(wheelParts)
  wheelParts.forEach(piece => piece.dispose())
  const rim = new THREE.Mesh(wheelGeometry, new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.6 }))
  rim.castShadow = true
  wheel.add(rim)
  group.add(wheel)
  const cabins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.65, 0.7), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 12)
  cabins.name = 'wheel-cabins'
  const cabinColors = ['#e4574a', '#f0a23b', '#f3d34a', '#6cbf6a', '#4aa8d8', '#8a6cd0']
  for (let i = 0; i < 12; i++) cabins.setColorAt(i, new THREE.Color(cabinColors[i % cabinColors.length]))
  cabins.castShadow = true
  cabins.frustumCulled = false
  group.add(cabins)

  // Traffic runs both ways along the avenue and through the scramble crossing.
  const carCount = CAR_COLORS.length
  const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.46, 1.6), new THREE.MeshStandardMaterial({ roughness: 0.55 }), carCount)
  const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.72, 0.36, 0.95), new THREE.MeshStandardMaterial({ color: '#8fb7c9', roughness: 0.4 }), carCount)
  bodies.name = 'avenue-traffic'
  CAR_COLORS.forEach((color, i) => bodies.setColorAt(i, new THREE.Color(color)))
  for (const traffic of [bodies, roofs]) { traffic.castShadow = true; traffic.frustumCulled = false; group.add(traffic) }

  // A street screen by the crossing flashes through the colours of the lines.
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), new THREE.MeshBasicMaterial({ color: '#8a55c2' }))
  screen.position.set(SCREEN_SPOT.x, SCREEN_SPOT.y, SCREEN_SPOT.z)
  screen.rotation.y = Math.PI
  group.add(screen)
  const screenColors = ['#8a55c2', '#d0453a', '#1f8fb0', '#dd6a1f', '#2f63c4', '#f2c230']
  batch.finish()

  const dummy = new THREE.Object3D()
  const avenueSpan = AVENUE.to - AVENUE.from
  function place(seconds: number) {
    const turn = seconds * 0.12
    wheel.rotation.x = turn
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6 + turn
      dummy.position.set(WHEEL_SPOT.x, WHEEL_SPOT.y + Math.cos(angle) * WHEEL_SPOT.radius - 0.45, WHEEL_SPOT.z + Math.sin(angle) * WHEEL_SPOT.radius)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      cabins.setMatrixAt(i, dummy.matrix)
    }
    cabins.instanceMatrix.needsUpdate = true
    for (let i = 0; i < carCount; i++) {
      const eastbound = i % 2 === 0
      const travel = (seconds * (2.2 + (i % 3) * 0.25) + i * avenueSpan / carCount * 2) % avenueSpan
      const x = eastbound ? AVENUE.from + travel : AVENUE.to - travel
      dummy.position.set(x, 0.36, AVENUE.z + (eastbound ? 0.65 : -0.65))
      dummy.rotation.set(0, Math.PI / 2, 0)
      dummy.updateMatrix()
      bodies.setMatrixAt(i, dummy.matrix)
      dummy.position.y = 0.76
      dummy.updateMatrix()
      roofs.setMatrixAt(i, dummy.matrix)
    }
    bodies.instanceMatrix.needsUpdate = true
    roofs.instanceMatrix.needsUpdate = true
  }
  place(0)
  const tunnels: JourneyTunnel[] = [{ edge: 'subway', start: SUBWAY_TUNNEL.start, end: SUBWAY_TUNNEL.end, caption: 'ちかてつの トンネル！' }]
  return {
    group,
    tunnels,
    setOverview(overview: boolean) {
      for (const label of [stationLabel, towerLabel, wheelLabel, subwayLabel]) label.visible = overview
    },
    update(seconds: number, reducedMotion: boolean) {
      if (reducedMotion) return
      place(seconds)
      ;(screen.material as THREE.MeshBasicMaterial).color.set(screenColors[Math.floor(seconds / 1.4) % screenColors.length])
    },
    setRoutes(routes: JourneyRoutes) {
      stands.forEach((stand, i) => stand.setRoute(routes[i], beds))
    },
  }
}
