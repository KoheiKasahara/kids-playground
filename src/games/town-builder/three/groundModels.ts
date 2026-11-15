import * as THREE from 'three'
import { colOf, COLS, railMask, roadMask, rowOf, ROWS, type Ground, type Town } from '../town'
import { directions, segmentsOf } from '../trackGeometry'
import { Frame, matrixOf, type Mat, type TownKit } from './townKit'
import { tileCenter, tileNoise, type Point } from './townLayout'

// じめん・かわ・みち・せんろ。マスの うえの めんが y=0。
// みちと せんろの かたちは 2D と おなじ trackGeometry の せんから つくる。

const LAND: Record<Exclude<Ground, 'water'>, readonly [string, string]> = {
  grass: ['#9bd66f', '#92ce66'],
  sand: ['#f4dfa6', '#eed597'],
  snow: ['#fbfdff', '#edf3f9'],
}
const SOIL = '#b07a4a'
const WATER = '#5bbde8'
const BRIDGE = '#8d6e52'
const BRIDGE_RAIL = '#c8a27a'
const SIDEWALK = '#d9d4c7'
const BRIDGE_WALK = '#e8dcc8'
const ASPHALT = '#5d6470'
const LINE = '#ffffff'
const BALLAST = '#c2b59b'
const SLEEPER = '#8b5a2b'
const RAIL = '#5f6b78'

/** みちの はば など（1マス = 1）。 */
const ROAD = { walk: 0.62, asphalt: 0.48 }
const TRACK = { ballast: 0.42, sleeper: 0.34, gauge: 0.11, rail: 0.026 }

type Segment =
  | { kind: 'line'; ax: number; az: number; bx: number; bz: number }
  | { kind: 'arc'; cx: number; cz: number; a0: number; a1: number }

/** 2D の 0〜100 の せんを、マスの まんなかが 0 の 3D の せんへ。 */
function segmentsFor(mask: number): { segments: Segment[]; junction: boolean } {
  const { segments, junction } = segmentsOf(mask)
  const p = (point: readonly [number, number]) => [point[0] / 100 - 0.5, point[1] / 100 - 0.5] as const
  return {
    junction,
    segments: segments.map(({ from, to, center }) => {
      const [ax, az] = p(from)
      const [bx, bz] = p(to)
      if (!center) return { kind: 'line', ax, az, bx, bz }
      const [cx, cz] = p(center)
      const a0 = Math.atan2(az - cz, ax - cx)
      let a1 = Math.atan2(bz - cz, bx - cx)
      // 90ど だけ まわる ほうに そろえる。
      if (a1 - a0 > Math.PI) a1 -= Math.PI * 2
      if (a0 - a1 > Math.PI) a1 += Math.PI * 2
      return { kind: 'arc', cx, cz, a0, a1 }
    }),
  }
}

/** せんの うえの t（0〜1）の いちと、すすむ むきへ x じくを むける かいてん。 */
function sample(segment: Segment, t: number): { x: number; z: number; angle: number } {
  if (segment.kind === 'line') {
    const dx = segment.bx - segment.ax
    const dz = segment.bz - segment.az
    return { x: segment.ax + dx * t, z: segment.az + dz * t, angle: Math.atan2(-dz, dx) }
  }
  const angle = segment.a0 + (segment.a1 - segment.a0) * t
  const sign = Math.sign(segment.a1 - segment.a0)
  const tx = -Math.sin(angle) * sign
  const tz = Math.cos(angle) * sign
  return { x: segment.cx + Math.cos(angle) * 0.5, z: segment.cz + Math.sin(angle) * 0.5, angle: Math.atan2(-tz, tx) }
}

function lengthOf(segment: Segment): number {
  if (segment.kind === 'line') return Math.hypot(segment.bx - segment.ax, segment.bz - segment.az)
  return Math.abs(segment.a1 - segment.a0) * 0.5
}

/** せんに そった おびを おく。offset は せんから よこへの ずれ。 */
function strip(f: Frame, segment: Segment, material: Mat, width: number, y0: number, y1: number, offset = 0): void {
  if (segment.kind === 'arc') {
    const radius = 0.5 + offset
    f.put(f.kit.arc(segment.cx, segment.cz, radius - width / 2, radius + width / 2, segment.a0, segment.a1, y0, y1), material, [0, 0, 0], [1, 1, 1])
    return
  }
  const dx = segment.bx - segment.ax
  const dz = segment.bz - segment.az
  const length = Math.hypot(dx, dz)
  const nx = -dz / length
  const nz = dx / length
  f.box(material, [length, y1 - y0, width], [(segment.ax + segment.bx) / 2 + nx * offset, y0, (segment.az + segment.bz) / 2 + nz * offset], [0, Math.atan2(-dz, dx), 0])
}

/** せんに そって ならべる こまかい もの（はくせん・まくらぎ）。 */
function along(f: Frame, segment: Segment, material: Mat, size: readonly [number, number, number], y: number, ts: readonly number[]): void {
  for (const t of ts) {
    const point = sample(segment, t)
    f.box(material, size, [point.x, y, point.z], [0, point.angle, 0])
  }
}

/** まんなかの いた（こうさてん・いきどまり）。 */
function hub(f: Frame, material: Mat, width: number, y0: number, y1: number, round: boolean): void {
  if (round) f.cyl(material, width / 2, y1 - y0, [0, y0, 0], 16)
  else f.box(material, [width, y1 - y0, width], [0, y0, 0])
}

function steps(count: number, until = 1): number[] {
  return Array.from({ length: count }, (_, index) => ((index + 0.5) / count) * until)
}

function road(f: Frame, mask: number, bridge: boolean): void {
  const walk = bridge ? BRIDGE_WALK : SIDEWALK
  if (mask === 0) {
    // つながって いない みちは まるい ひろば。
    if (bridge) f.cyl(BRIDGE, 0.36, 0.07, [0, -0.07, 0], 18)
    f.cyl(walk, 0.33, 0.02, [0, 0, 0], 18)
    f.cyl(ASPHALT, 0.26, 0.012, [0, 0.02, 0], 18)
    f.cyl(LINE, 0.08, 0.004, [0, 0.032, 0], 12)
    return
  }
  const { segments, junction } = segmentsFor(mask)
  const dead = directions(mask).length === 1
  if (bridge) {
    for (const segment of segments) strip(f, segment, BRIDGE, 0.72, -0.07, 0)
    if (junction || dead) hub(f, BRIDGE, 0.72, -0.07, 0, dead)
    if (!junction) for (const side of [-0.37, 0.37]) for (const segment of segments) strip(f, segment, BRIDGE_RAIL, 0.035, 0, 0.1, side)
  }
  for (const segment of segments) strip(f, segment, walk, ROAD.walk, 0, 0.02)
  if (junction || dead) hub(f, walk, ROAD.walk, 0, 0.02, dead)
  for (const segment of segments) strip(f, segment, ASPHALT, ROAD.asphalt, 0.02, 0.03)
  if (junction || dead) hub(f, ASPHALT, ROAD.asphalt, 0.02, 0.03, dead)
  for (const segment of segments) {
    const count = segment.kind === 'arc' ? 3 : junction ? 1 : dead ? 2 : 4
    along(f, segment, LINE, [0.09, 0.004, 0.022], 0.03, steps(count, junction ? 0.5 : 1))
  }
}

function rail(f: Frame, mask: number, bridge: boolean, overRoad: boolean): void {
  const { segments, junction } = segmentsFor(mask)
  if (bridge && !overRoad) {
    for (const segment of segments) strip(f, segment, BRIDGE, 0.56, -0.07, 0)
    if (junction) hub(f, BRIDGE, 0.56, -0.07, 0, false)
    if (!junction) for (const side of [-0.29, 0.29]) for (const segment of segments) strip(f, segment, BRIDGE_RAIL, 0.03, 0, 0.09, side)
  }
  const base = overRoad ? 0.03 : 0.04
  if (!overRoad) {
    for (const segment of segments) strip(f, segment, BALLAST, TRACK.ballast, 0, 0.025)
    if (junction) hub(f, BALLAST, TRACK.ballast, 0, 0.025, false)
    for (const segment of segments) {
      const count = Math.max(2, Math.round(lengthOf(segment) * 8))
      along(f, segment, SLEEPER, [0.055, 0.015, TRACK.sleeper], 0.025, steps(count))
    }
  }
  for (const segment of segments) {
    for (const side of [-TRACK.gauge, TRACK.gauge]) strip(f, segment, RAIL, TRACK.rail, base, base + 0.022, side)
  }
}

export type Crossing = { index: number; center: Point; lamps: THREE.Mesh[] }

/**
 * ふみきりの けいほうき。でんしゃが ちかい ときに あかい ランプが こうごに ひかる。
 * はしらや ばってんは うごかないので まちと いっしょに まとめ、ランプは ひだり・みぎ の くみごとに 1つの Mesh に する。
 */
function crossingSignals(kit: TownKit, index: number, root: THREE.Group): Crossing {
  const center = tileCenter(index)
  const sides: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[][] = [[], []]
  // かどは みち・せんろが とおらない（カーブも かどから 0.19 より うちがわ）。
  for (const [cx, cz] of [[0.4, -0.4], [-0.4, 0.4]] as const) {
    const base = matrixOf([center.x + cx, 0, center.z + cz], [0, Math.atan2(-cx, -cz), 0])
    const signal = new Frame(kit, base)
    signal.cyl('#3d3d3d', 0.018, 0.44, [0, 0, 0], 8)
    signal.box('#ffd43b', [0.17, 0.035, 0.012], [0, 0.38, 0.02], [0, 0, Math.PI / 4])
    signal.box('#ffd43b', [0.17, 0.035, 0.012], [0, 0.38, 0.02], [0, 0, -Math.PI / 4])
    signal.box('#3d3d3d', [0.14, 0.03, 0.02], [0, 0.27, 0.01])
    ;[-0.05, 0.05].forEach((side, n) => {
      sides[n].push({ geometry: kit.ball(1), matrix: base.clone().multiply(matrixOf([side, 0.3, 0.03], [0, 0, 0], [0.03, 0.03, 0.03])) })
    })
  }
  const lamps = sides.map((parts) => kit.joined(parts, '#5a1d1d'))
  root.add(...lamps)
  return { index, center, lamps }
}

/** よるの がいとうの あかりの わ（ひるは みえない）。 */
export function createPoolMaterial(kit: TownKit): THREE.MeshBasicMaterial {
  return kit.own(new THREE.MeshBasicMaterial({
    color: '#ffe680',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }))
}

function lamp(f: Frame, pool: THREE.Material): void {
  f.cyl('#7b8794', 0.016, 0.36, [-0.41, 0, -0.41], 8)
  f.box('#7b8794', [0.12, 0.016, 0.016], [-0.36, 0.35, -0.41])
  f.ball(f.kit.glow('bulb'), 0.035, [-0.31, 0.34, -0.41], 1)
  f.kit.place(f.kit.cyl(20), pool, f.base.clone().multiply(matrixOf([-0.31, 0.034, -0.41], [0, 0, 0], [0.34, 0.002, 0.34])), false)
}

function tufts(f: Frame, index: number): void {
  const count = Math.floor(tileNoise(index, 7) * 3)
  for (let n = 0; n < count; n += 1) {
    const x = (tileNoise(index, 10 + n) - 0.5) * 0.7
    const z = (tileNoise(index, 20 + n) - 0.5) * 0.7
    f.ball('#6fbf4a', 0.05 + tileNoise(index, 30 + n) * 0.03, [x, 0, z], 0, 0.6)
  }
}

export type GroundResult = { crossings: Crossing[]; pool: THREE.MeshBasicMaterial }

/** じめん・かわ・みち・せんろを kit に おき、ふみきりの けいほうきを root に たす。 */
export function buildGround(kit: TownKit, town: Town, root: THREE.Group): GroundResult {
  const pool = createPoolMaterial(kit)
  const crossings: Crossing[] = []
  // ちずの したの つち。
  new Frame(kit, new THREE.Matrix4(), false).box(SOIL, [COLS, 0.55, ROWS], [0, -0.65, 0])
  new Frame(kit, new THREE.Matrix4(), false).box('#8a5a32', [COLS - 0.6, 0.25, ROWS - 0.6], [0, -0.9, 0])
  town.forEach((tile, index) => {
    const center = tileCenter(index)
    const base = matrixOf([center.x, 0, center.z])
    const flat = new Frame(kit, base, false)
    const ground = tile.ground
    const water = ground === 'water'
    if (ground === 'water') {
      // かわは くさはらより すこし ひくく して、きしを みせる。
      flat.box(kit.mat(WATER, { rough: 0.18, metal: 0.05 }), [1, 0.06, 1], [0, -0.1, 0])
    } else {
      flat.box(LAND[ground][(colOf(index) + rowOf(index)) % 2], [1, 0.1, 1], [0, -0.1, 0])
    }
    const part = tile.part
    if (part === 'road' || part === 'crossing') road(flat, roadMask(town, index), water)
    if (part === 'rail' || part === 'crossing') rail(flat, railMask(town, index), water, part === 'crossing')
    if (part === 'crossing') crossings.push(crossingSignals(kit, index, root))
    const standing = new Frame(kit, base)
    if (part === 'road' && !water && (colOf(index) + rowOf(index)) % 2 === 0) lamp(standing, pool)
    if (!part && ground === 'grass') tufts(flat, index)
  })
  return { crossings, pool }
}
