// 動物園のマップ（Three.js の座標: x 右, z 手前, y 上。単位はメートル）。
// 動物ごとの生活エリアは円で表し、池・岩・木は避ける障害物（円）として持つ。
// 描画（scenery.ts）と行動（behavior.ts）の両方がこのデータを参照する。

export type Vec2 = { x: number; z: number }
export type Circle = Vec2 & { r: number }

export type TreeKind = 'round' | 'acacia' | 'palm' | 'bush'
export type Tree = Vec2 & { kind: TreeKind; size: number }
export type Rock = Vec2 & { r: number; h: number }

export type Enclosure = {
  id: string
  center: Vec2
  radius: number
  /** 柵の色。エリアの見分けに使う。 */
  fence: string
  ground: string
  pond?: Circle
  trees: Tree[]
  rocks: Rock[]
  /** 柵の切れ目（入口）の向き（ラジアン、+z が 0）。 */
  gate: number
}

export type ZooMap = {
  radius: number
  plaza: Circle
  enclosures: Enclosure[]
  /** 柵の外（園路のまわり）に置く木。 */
  outerTrees: Tree[]
}

export const ZOO_MAP: ZooMap = {
  radius: 17,
  plaza: { x: 0, z: 0.4, r: 2.6 },
  enclosures: [
    {
      id: 'elephant',
      center: { x: -6.0, z: -6.3 },
      radius: 5.9,
      fence: '#b98552',
      ground: '#bfd77a',
      pond: { x: -7.9, z: -8.6, r: 1.9 },
      trees: [
        { x: -9.6, z: -4.6, kind: 'round', size: 1.0 },
        { x: -3.2, z: -10.5, kind: 'bush', size: 0.9 },
      ],
      rocks: [{ x: -1.3, z: -6.9, r: 0.55, h: 0.45 }],
      gate: Math.atan2(6.0, 6.7),
    },
    {
      id: 'giraffe',
      center: { x: 6.1, z: -6.1 },
      radius: 5.9,
      fence: '#c99a5b',
      ground: '#d8d38a',
      trees: [
        { x: 8.3, z: -9.3, kind: 'acacia', size: 1.15 },
        { x: 2.8, z: -9.6, kind: 'acacia', size: 0.95 },
        { x: 10.1, z: -4.4, kind: 'bush', size: 0.8 },
      ],
      rocks: [{ x: 3.0, z: -3.4, r: 0.42, h: 0.35 }],
      gate: Math.atan2(-6.1, 6.5),
    },
    {
      id: 'lion',
      center: { x: 0, z: 7.9 },
      radius: 5.4,
      fence: '#a4744a',
      ground: '#e2c27f',
      trees: [
        { x: -3.5, z: 10.7, kind: 'acacia', size: 0.85 },
        { x: 3.8, z: 10.8, kind: 'bush', size: 0.8 },
      ],
      rocks: [
        { x: 1.9, z: 9.5, r: 1.15, h: 0.85 },
        { x: -2.3, z: 6.0, r: 0.55, h: 0.45 },
        { x: 2.8, z: 5.7, r: 0.42, h: 0.35 },
      ],
      gate: Math.PI,
    },
  ],
  outerTrees: [
    { x: -13.4, z: 2.4, kind: 'round', size: 1.2 },
    { x: -11.5, z: 8.5, kind: 'round', size: 1.05 },
    { x: 13.2, z: 2.6, kind: 'round', size: 1.15 },
    { x: 11.4, z: 9.2, kind: 'palm', size: 1.05 },
    { x: -14.2, z: -9.5, kind: 'palm', size: 1.1 },
    { x: 14.5, z: -10.5, kind: 'round', size: 1.1 },
    { x: 0, z: -13.4, kind: 'round', size: 1.25 },
    { x: -5.5, z: -14.4, kind: 'bush', size: 1 },
    { x: 6, z: -14.2, kind: 'bush', size: 1 },
    { x: -7.2, z: 13.6, kind: 'bush', size: 0.95 },
    { x: 7.4, z: 13.8, kind: 'round', size: 1.0 },
    { x: -15.5, z: -2.4, kind: 'bush', size: 1.1 },
    { x: 15.8, z: -2.8, kind: 'bush', size: 1.1 },
  ],
}

export function enclosureById(id: string, map: ZooMap = ZOO_MAP): Enclosure {
  const found = map.enclosures.find(e => e.id === id)
  if (!found) throw new Error(`unknown enclosure: ${id}`)
  return found
}

/** 木の幹・岩・池を、動物がよける円として返す。 */
export function obstaclesOf(enclosure: Enclosure): Circle[] {
  const trees = enclosure.trees.map(t => ({ x: t.x, z: t.z, r: t.kind === 'bush' ? 0.75 * t.size : 0.45 * t.size }))
  const rocks = enclosure.rocks.map(r => ({ x: r.x, z: r.z, r: r.r }))
  return enclosure.pond ? [...trees, ...rocks, enclosure.pond] : [...trees, ...rocks]
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** 線分 a→b が円（半径 + margin）を横切るか。 */
export function segmentHitsCircle(a: Vec2, b: Vec2, c: Circle, margin = 0): boolean {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len2 = dx * dx + dz * dz
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.z - a.z) * dz) / len2)) : 0
  const px = a.x + dx * t
  const pz = a.z + dz * t
  return Math.hypot(c.x - px, c.z - pz) < c.r + margin
}

/** エリアの内側（縁から margin 内側）に収まるように点を引き戻す。 */
export function clampToEnclosure(p: Vec2, enclosure: Enclosure, margin: number): Vec2 {
  const dx = p.x - enclosure.center.x
  const dz = p.z - enclosure.center.z
  const d = Math.hypot(dx, dz)
  const limit = Math.max(0.1, enclosure.radius - margin)
  if (d <= limit) return p
  return { x: enclosure.center.x + dx / d * limit, z: enclosure.center.z + dz / d * limit }
}

/** 障害物の中にいたら、円の外側へ押し出す。 */
export function pushOutOfObstacles(p: Vec2, obstacles: readonly Circle[], margin: number): Vec2 {
  let { x, z } = p
  for (const o of obstacles) {
    const dx = x - o.x
    const dz = z - o.z
    const d = Math.hypot(dx, dz)
    const min = o.r + margin
    if (d < min) {
      const nx = d > 1e-6 ? dx / d : 1
      const nz = d > 1e-6 ? dz / d : 0
      x = o.x + nx * min
      z = o.z + nz * min
    }
  }
  return { x, z }
}

/** 池のほとりの、from に近い位置（水浴びの立ち位置）。 */
export function pondShore(enclosure: Enclosure, from: Vec2, gap: number): Vec2 | undefined {
  const pond = enclosure.pond
  if (!pond) return undefined
  const dx = from.x - pond.x
  const dz = from.z - pond.z
  const d = Math.hypot(dx, dz) || 1
  return clampToEnclosure({ x: pond.x + dx / d * (pond.r + gap), z: pond.z + dz / d * (pond.r + gap) }, enclosure, gap)
}
