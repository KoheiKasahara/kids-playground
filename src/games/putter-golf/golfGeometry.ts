/**
 * ホールの形（床・壁・カップ）を三角形にする。
 *
 * 見た目（golfScene）と物理（golfWorld）は、ここで作った同じ頂点を使う。
 * 床は 0.25 のマス目で多角形を切り抜いて作るので、こぶや坂の高さがなめらかに付き、
 * カップのまわりだけは円い穴にぴったり合う専用の三角形でつなぐ。
 * DOM も Rapier も使わないので、形の正しさをそのままテストできる。
 */
import { ShapeUtils, Vector2 } from 'three'
import type { FloorPiece, HoleDefinition, SurfaceZone, Vec2, ZoneKind } from './golfCourses'
import { CUP_DEPTH, CUP_RADIUS, PLATFORM_DEPTH, WALL_HEIGHT, WALL_THICKNESS, type Surface, type Vec3 } from './golfPhysics'

export const CELL = 0.25
const ARC_STEP = Math.PI / 14
const RIM_SEGMENTS = 48

export type Outline = { points: Vec2[]; walled: boolean[]; base: number }
export type MeshBuffers = { positions: Float32Array; normals: Float32Array; indices: Uint32Array }
/** 壁1本ぶんの箱。yaw は y 軸まわりの回転で、箱のローカル x が壁の向き。 */
export type WallBox = { x: number; y: number; z: number; hx: number; hy: number; hz: number; yaw: number }
export type HoleGeometry = {
  floor: MeshBuffers
  wallBody: MeshBuffers
  wallCap: MeshBuffers
  skirt: MeshBuffers
  cupWall: MeshBuffers
  walls: WallBox[]
  outlines: Outline[]
  cup: Vec3 & { radius: number; depth: number }
  tee: Vec3
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
  heightAt: (x: number, z: number) => number | null
  surfaceAt: (x: number, z: number) => Surface | null
  /** みずの上か。margin だけ みずを ふくらませ、はしは margin だけ せまくして しらべる。 */
  waterAt: (x: number, z: number, margin?: number) => boolean
}

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function signedArea(points: readonly Vec2[]): number {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    area += a.x * b.z - b.x * a.z
  }
  return area / 2
}

/** 角 p を半径 r で丸めた点の列。丸めない角は p だけを返す。 */
function filletPoints(p: Vec2, a: Vec2, b: Vec2, r: number): Vec2[] {
  if (!(r > 0)) return [{ x: p.x, z: p.z }]
  const la = Math.hypot(a.x - p.x, a.z - p.z)
  const lb = Math.hypot(b.x - p.x, b.z - p.z)
  const u = { x: (a.x - p.x) / la, z: (a.z - p.z) / la }
  const v = { x: (b.x - p.x) / lb, z: (b.z - p.z) / lb }
  const phi = Math.acos(Math.min(1, Math.max(-1, u.x * v.x + u.z * v.z)))
  if (phi < 0.02 || phi > Math.PI - 0.02) return [{ x: p.x, z: p.z }]
  let t = r / Math.tan(phi / 2)
  let radius = r
  const maxT = 0.48 * Math.min(la, lb)
  if (t > maxT) { t = maxT; radius = t * Math.tan(phi / 2) }
  const bisector = Math.hypot(u.x + v.x, u.z + v.z)
  const reach = radius / Math.sin(phi / 2)
  const c = { x: p.x + ((u.x + v.x) / bisector) * reach, z: p.z + ((u.z + v.z) / bisector) * reach }
  const start = Math.atan2(p.z + u.z * t - c.z, p.x + u.x * t - c.x)
  let delta = Math.atan2(p.z + v.z * t - c.z, p.x + v.x * t - c.x) - start
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  const steps = Math.max(2, Math.ceil(Math.abs(delta) / ARC_STEP))
  return Array.from({ length: steps + 1 }, (_, k) => {
    const angle = start + (delta * k) / steps
    return { x: c.x + Math.cos(angle) * radius, z: c.z + Math.sin(angle) * radius }
  })
}

/** 角を丸めた外周。向きは面積が正になるようにそろえ、壁を付ける線分に印を付ける。 */
export function roundOutline(piece: FloorPiece): Outline {
  const raw = piece.corners.map(corner => ({ x: corner.x, z: corner.z, r: corner.r ?? 0 }))
  const n = raw.length
  let corners = raw
  let open = new Set(piece.open ?? [])
  if (signedArea(raw) < 0) {
    corners = [...raw].reverse()
    // 逆向きにすると、辺 i（i→i+1）は辺 n-2-i になる。
    open = new Set([...open].map(index => (((n - 2 - index) % n) + n) % n))
  }
  const points: Vec2[] = []
  const walled: boolean[] = []
  corners.forEach((corner, index) => {
    const group = filletPoints(corner, corners[(index - 1 + n) % n]!, corners[(index + 1) % n]!, corner.r)
    group.forEach((point, k) => {
      points.push(point)
      // 丸めの弧には必ず壁を付ける。弧の最後の点からは、次の角までのまっすぐな辺になる。
      walled.push(k < group.length - 1 ? true : !open.has(index))
    })
  })
  return { points, walled, base: piece.y ?? 0 }
}

export function insideOutline(x: number, z: number, points: readonly Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!
    const b = points[j]!
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

function segmentDistance(x: number, z: number, from: Vec2, to: Vec2): number {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const t = Math.min(1, Math.max(0, ((x - from.x) * dx + (z - from.z) * dz) / (dx * dx + dz * dz || 1)))
  return Math.hypot(x - (from.x + dx * t), z - (from.z + dz * t))
}

/**
 * みず（いけ・かわ）の上かどうか。はしの上は みずに おちない。
 * 物理（おちたか）・おすすめ（みずを こえる線は えらばない）・見た目で 同じ形を使う。
 */
export function createWaterFunction(hole: HoleDefinition): (x: number, z: number, margin?: number) => boolean {
  const waters = hole.water ?? []
  const bridges = (hole.gadgets ?? []).flatMap(gadget => (gadget.kind === 'bridge' ? [gadget] : []))
  const onBridge = (x: number, z: number, margin: number) => bridges.some(bridge => {
    const length = Math.hypot(bridge.dir.x, bridge.dir.z) || 1
    const along = ((x - bridge.x) * bridge.dir.x + (z - bridge.z) * bridge.dir.z) / length
    const side = ((x - bridge.x) * bridge.dir.z - (z - bridge.z) * bridge.dir.x) / length
    return Math.abs(along) <= bridge.halfLength && Math.abs(side) <= bridge.halfWidth - margin
  })
  return (x, z, margin = 0) => {
    if (!waters.length) return false
    const wet = waters.some(water => {
      if (water.kind === 'pond') return Math.hypot(x - water.x, z - water.z) < water.radius + margin
      const dx = water.to.x - water.from.x
      const dz = water.to.z - water.from.z
      const length = Math.hypot(dx, dz) || 1
      const along = ((x - water.from.x) * dx + (z - water.from.z) * dz) / length
      const side = Math.abs((x - water.from.x) * dz - (z - water.from.z) * dx) / length
      return along > -margin && along < length + margin && side < water.halfWidth + margin
    })
    return wet && !onBridge(x, z, margin)
  }
}

/** こぶ・なみ・ジャンプ台を足し合わせた高さ。カップとティーのまわりは平らにならす。 */
export function createHeightFunction(hole: HoleDefinition, cupRadius = CUP_RADIUS): (x: number, z: number) => number {
  const features = hole.features ?? []
  const raw = (x: number, z: number) => {
    let height = 0
    for (const feature of features) {
      if (feature.kind === 'bump') {
        const d = Math.hypot(x - feature.x, z - feature.z)
        if (d < feature.radius) height += (feature.height * (1 + Math.cos((Math.PI * d) / feature.radius))) / 2
      } else if (feature.kind === 'ridge') {
        const d = segmentDistance(x, z, feature.from, feature.to)
        if (d < feature.radius) height += (feature.height * (1 + Math.cos((Math.PI * d) / feature.radius))) / 2
      } else if (feature.kind === 'slope') {
        const dx = feature.to.x - feature.from.x
        const dz = feature.to.z - feature.from.z
        const length = Math.hypot(dx, dz)
        const along = ((x - feature.from.x) * dx + (z - feature.from.z) * dz) / length
        // from の手前は0、to の先はずっと drop ぶん低いまま。
        // つなぎ目をなめらかにして、坂の上と下でボールがはねないようにする。
        height -= feature.drop * smoothstep(0, length, along)
      } else {
        const dx = feature.to.x - feature.from.x
        const dz = feature.to.z - feature.from.z
        const length = Math.hypot(dx, dz)
        const along = ((x - feature.from.x) * dx + (z - feature.from.z) * dz) / length
        const side = Math.abs((x - feature.from.x) * dz - (z - feature.from.z) * dx) / length
        // 台の先（切れ目の向こう）には効かせない。向こう側の床まで持ち上げないため。
        if (along > 0 && along <= length + 1e-6) height += feature.rise * (along / length) * (1 - smoothstep(feature.halfWidth, feature.halfWidth + 0.3, side))
      }
    }
    return height
  }
  const cupBase = raw(hole.cup.x, hole.cup.z)
  const teeBase = raw(hole.tee.x, hole.tee.z)
  return (x, z) => {
    let height = raw(x, z)
    const cupWeight = 1 - smoothstep(cupRadius + 0.35, cupRadius + 0.95, Math.hypot(x - hole.cup.x, z - hole.cup.z))
    height += (cupBase - height) * cupWeight
    const teeWeight = 1 - smoothstep(0.45, 0.95, Math.hypot(x - hole.tee.x, z - hole.tee.z))
    height += (teeBase - height) * teeWeight
    return height
  }
}

type Builder = { positions: number[]; normals: number[]; indices: number[] }
const builder = (): Builder => ({ positions: [], normals: [], indices: [] })
const finish = (b: Builder): MeshBuffers => ({ positions: new Float32Array(b.positions), normals: new Float32Array(b.normals), indices: new Uint32Array(b.indices) })

/** 四角形を1枚足す。向きは expected の側から見て表になるように自動でそろえる。 */
function quad(b: Builder, corners: readonly Vec3[], expected: Vec3) {
  const [p0, p1, p2] = corners as [Vec3, Vec3, Vec3]
  let nx = (p1.y - p0.y) * (p2.z - p0.z) - (p1.z - p0.z) * (p2.y - p0.y)
  let ny = (p1.z - p0.z) * (p2.x - p0.x) - (p1.x - p0.x) * (p2.z - p0.z)
  let nz = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x)
  let ordered = corners
  if (nx * expected.x + ny * expected.y + nz * expected.z < 0) { ordered = [...corners].reverse(); nx = -nx; ny = -ny; nz = -nz }
  const length = Math.hypot(nx, ny, nz) || 1
  const start = b.positions.length / 3
  for (const point of ordered) {
    b.positions.push(point.x, point.y, point.z)
    b.normals.push(nx / length, ny / length, nz / length)
  }
  b.indices.push(start, start + 1, start + 2)
  if (ordered.length === 4) b.indices.push(start, start + 2, start + 3)
}

function clipAxis(poly: Vec2[], axis: 'x' | 'z', limit: number, keepAbove: boolean): Vec2[] {
  const out: Vec2[] = []
  const keep = (p: Vec2) => (keepAbove ? p[axis] >= limit : p[axis] <= limit)
  const cross = (a: Vec2, b: Vec2): Vec2 => {
    const t = (limit - a[axis]) / (b[axis] - a[axis])
    return axis === 'x' ? { x: limit, z: a.z + (b.z - a.z) * t } : { x: a.x + (b.x - a.x) * t, z: limit }
  }
  for (let i = 0; i < poly.length; i++) {
    const current = poly[i]!
    const previous = poly[(i + poly.length - 1) % poly.length]!
    if (keep(current)) {
      if (!keep(previous)) out.push(cross(previous, current))
      out.push(current)
    } else if (keep(previous)) out.push(cross(previous, current))
  }
  return out
}

function clipToCell(poly: Vec2[], x0: number, z0: number, x1: number, z1: number): Vec2[] {
  let out = clipAxis(poly, 'x', x0, true)
  if (out.length) out = clipAxis(out, 'x', x1, false)
  if (out.length) out = clipAxis(out, 'z', z0, true)
  if (out.length) out = clipAxis(out, 'z', z1, false)
  return out.filter((point, index) => {
    const next = out[(index + 1) % out.length]!
    return Math.hypot(point.x - next.x, point.z - next.z) > 1e-7
  })
}

export function buildHoleGeometry(hole: HoleDefinition, cupRadius = CUP_RADIUS): HoleGeometry {
  const height = createHeightFunction(hole, cupRadius)
  const outlines = hole.floors.map(roundOutline)
  const pieceAt = (x: number, z: number) => outlines.find(outline => insideOutline(x, z, outline.points))
  const heightAt = (x: number, z: number) => {
    const outline = pieceAt(x, z)
    return outline ? outline.base + height(x, z) : null
  }
  const zones = hole.zones ?? []
  const zoneWeight = (zone: SurfaceZone, x: number, z: number) => 1 - smoothstep(zone.radius - 0.08, zone.radius + 0.08, Math.hypot(x - zone.x, z - zone.z))
  // いちばん濃く重なっている ゆかの種類。どれにも入っていなければ null（＝芝）。
  const zoneAt = (x: number, z: number): ZoneKind | null => {
    let found: ZoneKind | null = null
    let weight = 0.5
    for (const zone of zones) {
      const value = zoneWeight(zone, x, z)
      if (value > weight) { weight = value; found = zone.kind }
    }
    return found
  }
  const cupPiece = pieceAt(hole.cup.x, hole.cup.z)
  const cupY = (cupPiece?.base ?? 0) + height(hole.cup.x, hole.cup.z)

  const floor = builder()
  let vertexKeys = new Map<string, number>()
  const addVertex = (x: number, z: number, base: number, fixedY?: number) => {
    const key = `${Math.round(x * 1e5)}:${Math.round(z * 1e5)}`
    const known = vertexKeys.get(key)
    if (known !== undefined) return known
    const index = floor.positions.length / 3
    const e = 0.02
    const nx = -(height(x + e, z) - height(x - e, z)) / (2 * e)
    const nz = -(height(x, z + e) - height(x, z - e)) / (2 * e)
    const length = Math.hypot(nx, 1, nz)
    floor.positions.push(x, fixedY ?? base + height(x, z), z)
    floor.normals.push(nx / length, 1 / length, nz / length)
    vertexKeys.set(key, index)
    return index
  }
  const addTriangle = (a: number, b: number, c: number) => {
    const p = floor.positions
    const ny = (p[b * 3 + 2]! - p[a * 3 + 2]!) * (p[c * 3]! - p[a * 3]!) - (p[b * 3]! - p[a * 3]!) * (p[c * 3 + 2]! - p[a * 3 + 2]!)
    if (Math.abs(ny) < 1e-12) return
    if (ny > 0) floor.indices.push(a, b, c)
    else floor.indices.push(a, c, b)
  }

  // 台の厚みは、その床のいちばん低いところから測る。坂で下がったぶんも台になる。
  const floorLow = new Map<Outline, number>()
  for (const outline of outlines) {
    vertexKeys = new Map()
    const firstVertex = floor.positions.length
    const xs = outline.points.map(point => point.x)
    const zs = outline.points.map(point => point.z)
    // カップのまわりの正方形はマス目から外し、円い穴に合う三角形でうめる。
    const square = outline === cupPiece ? {
      x0: Math.floor((hole.cup.x - cupRadius - 0.18) / CELL) * CELL,
      x1: Math.ceil((hole.cup.x + cupRadius + 0.18) / CELL) * CELL,
      z0: Math.floor((hole.cup.z - cupRadius - 0.18) / CELL) * CELL,
      z1: Math.ceil((hole.cup.z + cupRadius + 0.18) / CELL) * CELL,
    } : null
    for (let i = Math.floor(Math.min(...xs) / CELL); i < Math.ceil(Math.max(...xs) / CELL); i++) {
      for (let j = Math.floor(Math.min(...zs) / CELL); j < Math.ceil(Math.max(...zs) / CELL); j++) {
        const x0 = i * CELL
        const z0 = j * CELL
        if (square && x0 + CELL / 2 > square.x0 && x0 + CELL / 2 < square.x1 && z0 + CELL / 2 > square.z0 && z0 + CELL / 2 < square.z1) continue
        const poly = clipToCell(outline.points, x0, z0, x0 + CELL, z0 + CELL)
        if (poly.length < 3 || Math.abs(signedArea(poly)) < 1e-7) continue
        const ids = poly.map(point => addVertex(point.x, point.z, outline.base))
        const faces = poly.length === 3 ? [[0, 1, 2]] : ShapeUtils.triangulateShape(poly.map(point => new Vector2(point.x, point.z)), [])
        for (const [a, b, c] of faces) addTriangle(ids[a!]!, ids[b!]!, ids[c!]!)
      }
    }
    if (square) {
      const border: Vec2[] = []
      const nx = Math.round((square.x1 - square.x0) / CELL)
      const nz = Math.round((square.z1 - square.z0) / CELL)
      for (let k = 0; k < nx; k++) border.push({ x: square.x0 + k * CELL, z: square.z0 })
      for (let k = 0; k < nz; k++) border.push({ x: square.x1, z: square.z0 + k * CELL })
      for (let k = 0; k < nx; k++) border.push({ x: square.x1 - k * CELL, z: square.z1 })
      for (let k = 0; k < nz; k++) border.push({ x: square.x0, z: square.z1 - k * CELL })
      const rim = Array.from({ length: RIM_SEGMENTS }, (_, k) => {
        const angle = -Math.PI + ((k + 0.5) / RIM_SEGMENTS) * Math.PI * 2
        return { x: hole.cup.x + Math.cos(angle) * cupRadius, z: hole.cup.z + Math.sin(angle) * cupRadius }
      })
      const angleOf = (point: Vec2) => Math.atan2(point.z - hole.cup.z, point.x - hole.cup.x)
      const outer = border.map(point => ({ id: addVertex(point.x, point.z, outline.base), angle: angleOf(point) })).sort((a, b) => a.angle - b.angle)
      const inner = rim.map(point => ({ id: addVertex(point.x, point.z, outline.base, cupY), angle: angleOf(point) })).sort((a, b) => a.angle - b.angle)
      const at = (list: typeof outer, k: number) => list[k % list.length]!
      const unwrapped = (list: typeof outer, k: number) => at(list, k).angle + Math.PI * 2 * Math.floor(k / list.length)
      // 外の正方形と内の円を、角度の小さい順に交互につなぐ（ファスナーのように）。
      let o = 0
      let r = 0
      while (o < outer.length || r < inner.length) {
        const nextOuter = o < outer.length ? unwrapped(outer, o + 1) : Infinity
        const nextInner = r < inner.length ? unwrapped(inner, r + 1) : Infinity
        if (nextOuter <= nextInner) { addTriangle(at(outer, o).id, at(inner, r).id, at(outer, o + 1).id); o++ }
        else { addTriangle(at(outer, o).id, at(inner, r).id, at(inner, r + 1).id); r++ }
      }
    }
    let low = outline.base
    for (let i = firstVertex + 1; i < floor.positions.length; i += 3) low = Math.min(low, floor.positions[i]!)
    floorLow.set(outline, low)
  }

  // カップの内壁（上が開いた筒）。上の縁は床の穴の縁と同じ高さ・同じ分割にする。
  const cupWall = builder()
  for (let k = 0; k < RIM_SEGMENTS; k++) {
    const a0 = -Math.PI + ((k + 0.5) / RIM_SEGMENTS) * Math.PI * 2
    const a1 = -Math.PI + ((k + 1.5) / RIM_SEGMENTS) * Math.PI * 2
    const top0 = { x: hole.cup.x + Math.cos(a0) * cupRadius, y: cupY, z: hole.cup.z + Math.sin(a0) * cupRadius }
    const top1 = { x: hole.cup.x + Math.cos(a1) * cupRadius, y: cupY, z: hole.cup.z + Math.sin(a1) * cupRadius }
    const mid = (a0 + a1) / 2
    quad(cupWall, [top0, top1, { ...top1, y: cupY - CUP_DEPTH }, { ...top0, y: cupY - CUP_DEPTH }], { x: -Math.cos(mid), y: 0, z: -Math.sin(mid) })
  }

  const wallBody = builder()
  const wallCap = builder()
  const skirt = builder()
  const walls: WallBox[] = []
  for (const outline of outlines) {
    const { points, walled, base } = outline
    const n = points.length
    const h = (point: Vec2) => base + height(point.x, point.z)
    const normals = points.map((point, index) => {
      const next = points[(index + 1) % n]!
      const length = Math.hypot(next.x - point.x, next.z - point.z) || 1
      return { x: (next.z - point.z) / length, z: -(next.x - point.x) / length }
    })
    // 壁の外側の角は、となりの壁と重なるように斜めに切る（すき間を作らない）。
    const miter = points.map((_, index) => {
      const before = normals[(index - 1 + n) % n]!
      const after = normals[index]!
      const wallBefore = walled[(index - 1 + n) % n]!
      const wallAfter = walled[index]!
      if (wallBefore && wallAfter) {
        const dot = before.x * after.x + before.z * after.z
        const scale = 1 / Math.max(0.4, 1 + dot)
        return { x: (before.x + after.x) * scale, z: (before.z + after.z) * scale }
      }
      return wallAfter ? after : before
    })
    const bottom = (floorLow.get(outline) ?? base) - PLATFORM_DEPTH
    for (let index = 0; index < n; index++) {
      const a = points[index]!
      const b = points[(index + 1) % n]!
      const normal = normals[index]!
      const ha = h(a)
      const hb = h(b)
      if (!walled[index]) {
        quad(skirt, [{ x: a.x, y: ha, z: a.z }, { x: b.x, y: hb, z: b.z }, { x: b.x, y: bottom, z: b.z }, { x: a.x, y: bottom, z: a.z }], { x: normal.x, y: 0, z: normal.z })
        continue
      }
      const length = Math.hypot(b.x - a.x, b.z - a.z)
      const top = Math.max(ha, hb) + WALL_HEIGHT
      const low = Math.min(ha, hb) - 0.3
      walls.push({
        x: (a.x + b.x) / 2 + (normal.x * WALL_THICKNESS) / 2,
        y: (top + low) / 2,
        z: (a.z + b.z) / 2 + (normal.z * WALL_THICKNESS) / 2,
        hx: length / 2 + 0.01,
        hy: (top - low) / 2,
        hz: WALL_THICKNESS / 2,
        yaw: Math.atan2(-(b.z - a.z), b.x - a.x),
      })
      const ma = miter[index]!
      const mb = miter[(index + 1) % n]!
      const innerA = { x: a.x, z: a.z }
      const innerB = { x: b.x, z: b.z }
      const outerA = { x: a.x + ma.x * WALL_THICKNESS, z: a.z + ma.z * WALL_THICKNESS }
      const outerB = { x: b.x + mb.x * WALL_THICKNESS, z: b.z + mb.z * WALL_THICKNESS }
      quad(wallBody, [{ ...innerA, y: ha - 0.03 }, { ...innerB, y: hb - 0.03 }, { ...innerB, y: hb + WALL_HEIGHT }, { ...innerA, y: ha + WALL_HEIGHT }], { x: -normal.x, y: 0, z: -normal.z })
      quad(wallCap, [{ ...innerA, y: ha + WALL_HEIGHT }, { ...innerB, y: hb + WALL_HEIGHT }, { ...outerB, y: hb + WALL_HEIGHT }, { ...outerA, y: ha + WALL_HEIGHT }], { x: 0, y: 1, z: 0 })
      quad(wallBody, [{ ...outerA, y: ha + WALL_HEIGHT }, { ...outerB, y: hb + WALL_HEIGHT }, { ...outerB, y: bottom }, { ...outerA, y: bottom }], { x: normal.x, y: 0, z: normal.z })
      const direction = { x: (b.x - a.x) / length, y: 0, z: (b.z - a.z) / length }
      if (!walled[(index - 1 + n) % n]) quad(wallBody, [{ ...innerA, y: bottom }, { ...outerA, y: bottom }, { ...outerA, y: ha + WALL_HEIGHT }, { ...innerA, y: ha + WALL_HEIGHT }], { x: -direction.x, y: 0, z: -direction.z })
      if (!walled[(index + 1) % n]) quad(wallBody, [{ ...innerB, y: bottom }, { ...outerB, y: bottom }, { ...outerB, y: hb + WALL_HEIGHT }, { ...innerB, y: hb + WALL_HEIGHT }], direction)
    }
  }

  const all = [floor.positions, wallBody.positions]
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity }
  for (const list of all) {
    for (let i = 0; i < list.length; i += 3) {
      bounds.minX = Math.min(bounds.minX, list[i]!); bounds.maxX = Math.max(bounds.maxX, list[i]!)
      bounds.minY = Math.min(bounds.minY, list[i + 1]!); bounds.maxY = Math.max(bounds.maxY, list[i + 1]!)
      bounds.minZ = Math.min(bounds.minZ, list[i + 2]!); bounds.maxZ = Math.max(bounds.maxZ, list[i + 2]!)
    }
  }
  const teePiece = pieceAt(hole.tee.x, hole.tee.z)
  return {
    floor: finish(floor),
    wallBody: finish(wallBody),
    wallCap: finish(wallCap),
    skirt: finish(skirt),
    cupWall: finish(cupWall),
    walls,
    outlines,
    cup: { x: hole.cup.x, y: cupY, z: hole.cup.z, radius: cupRadius, depth: CUP_DEPTH },
    tee: { x: hole.tee.x, y: (teePiece?.base ?? 0) + height(hole.tee.x, hole.tee.z), z: hole.tee.z },
    bounds,
    heightAt,
    surfaceAt: (x, z) => (pieceAt(x, z) ? zoneAt(x, z) ?? 'green' : null),
    waterAt: createWaterFunction(hole),
  }
}
