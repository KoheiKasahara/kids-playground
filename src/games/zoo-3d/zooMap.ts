// 動物園のマップ（Three.js の座標: x 右, z 手前, y 上。単位はメートル）。
// 動物ごとの生活エリアは円で表し、池・岩・木は避ける障害物（円）として持つ。
// 描画（scenery.ts）と行動（behavior.ts）の両方がこのデータを参照する。

export type Vec2 = { x: number; z: number }
export type Circle = Vec2 & { r: number }

export type TreeKind = 'round' | 'acacia' | 'palm' | 'bush' | 'bamboo'
export type Tree = Vec2 & { kind: TreeKind; size: number }
export type Rock = Vec2 & { r: number; h: number; color?: string }

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
  /**
   * 内側のエリアを囲む環状の園路の半径。外側のエリアの入口はこの園路へつながり、
   * 園路は spokes で広場とつながる。
   */
  ringRoad: number
  /** 広場と環状の園路を結ぶ道（内側のエリアのすきまを通す）。 */
  spokes: [Vec2, Vec2][]
  enclosures: Enclosure[]
  /** 柵の外（園路のまわり）に置く木。 */
  outerTrees: Tree[]
}

/** 外側の輪に並ぶエリアの中心（angle は度で、+z が 0・+x が 90）。 */
const OUTER_RING = 21.8
function outer(angleDeg: number, ring = OUTER_RING): Vec2 {
  const a = angleDeg * Math.PI / 180
  return { x: round(Math.sin(a) * ring), z: round(Math.cos(a) * ring) }
}
function round(v: number): number {
  return Math.round(v * 100) / 100
}
/** エリアの中心から dx, dz だけずらした位置。 */
function near(c: Vec2, dx: number, dz: number): Vec2 {
  return { x: round(c.x + dx), z: round(c.z + dz) }
}
/** 入口を広場（原点）へ向ける。 */
function facingCenter(c: Vec2): number {
  return Math.atan2(-c.x, -c.z)
}

const TIGER = outer(-36)
const PENGUIN = outer(36)
const ZEBRA = outer(-72)
const HIPPO = outer(72)

export const ZOO_MAP: ZooMap = {
  radius: 28,
  plaza: { x: 0, z: 0.4, r: 2.6 },
  ringRoad: 15.7,
  spokes: [[{ x: -2.4, z: 0.8 }, { x: -15.7, z: 0.8 }], [{ x: 2.4, z: 0.8 }, { x: 15.7, z: 0.8 }]],
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
      center: { x: -5.6, z: 7.2 },
      radius: 5.4,
      fence: '#a4744a',
      ground: '#e2c27f',
      trees: [
        { x: -9.1, z: 10.0, kind: 'acacia', size: 0.85 },
        { x: -1.8, z: 10.1, kind: 'bush', size: 0.8 },
      ],
      rocks: [
        { x: -3.7, z: 8.8, r: 1.15, h: 0.85 },
        { x: -7.9, z: 5.3, r: 0.55, h: 0.45 },
        { x: -2.8, z: 5.0, r: 0.42, h: 0.35 },
      ],
      gate: Math.atan2(5.6, -6.8),
    },
    {
      id: 'panda',
      center: { x: 5.6, z: 7.2 },
      radius: 5.2,
      fence: '#9c7b55',
      ground: '#c9dd8e',
      trees: [
        { x: 8.7, z: 9.3, kind: 'bamboo', size: 1.0 },
        { x: 2.9, z: 10.2, kind: 'bamboo', size: 0.85 },
        { x: 9.6, z: 5.4, kind: 'bush', size: 0.75 },
      ],
      rocks: [{ x: 3.6, z: 5.0, r: 0.45, h: 0.35 }],
      gate: Math.atan2(-5.6, -6.8),
    },
    {
      id: 'tiger',
      center: TIGER,
      radius: 4.9,
      fence: '#8f6a45',
      ground: '#c4d887',
      pond: { ...near(TIGER, -1.9, 1.2), r: 1.3 },
      trees: [
        { ...near(TIGER, 2.4, 1.6), kind: 'round', size: 0.9 },
        { ...near(TIGER, 1.2, -3.2), kind: 'bush', size: 0.8 },
      ],
      rocks: [{ ...near(TIGER, -2.0, -2.2), r: 0.75, h: 0.6 }],
      gate: facingCenter(TIGER),
    },
    {
      id: 'penguin',
      center: PENGUIN,
      radius: 4.6,
      fence: '#7f9fb5',
      ground: '#e4eef0',
      pond: { ...near(PENGUIN, 1.2, 1.4), r: 1.6 },
      trees: [],
      rocks: [
        { ...near(PENGUIN, -2.1, -1.6), r: 0.7, h: 0.55, color: '#e8f3f8' },
        { ...near(PENGUIN, 2.4, -1.9), r: 0.5, h: 0.4, color: '#dcebf3' },
        { ...near(PENGUIN, -2.6, 1.2), r: 0.4, h: 0.3, color: '#eef7fb' },
      ],
      gate: facingCenter(PENGUIN),
    },
    {
      id: 'zebra',
      center: ZEBRA,
      radius: 5.0,
      fence: '#b48a5a',
      ground: '#dccf8e',
      trees: [
        { ...near(ZEBRA, -2.6, 2.0), kind: 'acacia', size: 0.9 },
        { ...near(ZEBRA, 2.4, -2.6), kind: 'bush', size: 0.75 },
      ],
      rocks: [{ ...near(ZEBRA, -2.3, -2.3), r: 0.45, h: 0.35 }],
      gate: facingCenter(ZEBRA),
    },
    {
      id: 'hippo',
      center: HIPPO,
      radius: 5.0,
      fence: '#9b7d62',
      ground: '#c7d68c',
      pond: { ...near(HIPPO, 1.6, -1.3), r: 2.0 },
      trees: [
        { ...near(HIPPO, -2.7, 1.9), kind: 'palm', size: 0.8 },
        { ...near(HIPPO, -1.6, -3.4), kind: 'bush', size: 0.7 },
      ],
      rocks: [{ ...near(HIPPO, 2.9, 2.0), r: 0.45, h: 0.35 }],
      gate: facingCenter(HIPPO),
    },
  ],
  outerTrees: [
    // 環状の園路の内側（内側のエリアのすきま）
    { x: -0.2, z: -14.2, kind: 'round', size: 1.1 },
    { x: 0.1, z: 14.6, kind: 'bush', size: 0.9 },
    { x: -14.0, z: -1.9, kind: 'bush', size: 0.8 },
    { x: 14.2, z: -1.7, kind: 'bush', size: 0.8 },
    // 外側のエリアのすきま（18度ずつずらした方向）と、園の外周
    ...[18, 54, 90, 126, 162, 198, 234, 270, 306, 342].map((deg, i) => ({
      ...outer(deg, 21.4 + (i % 2) * 1.2), kind: (['round', 'palm', 'bush'] as const)[i % 3], size: 1.0 + (i % 3) * 0.1,
    })),
    ...[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((deg, i) => ({
      ...outer(deg + 9, 29.5), kind: (['round', 'bush', 'palm'] as const)[i % 3], size: 1.2,
    })),
  ],
}

export function enclosureById(id: string, map: ZooMap = ZOO_MAP): Enclosure {
  const found = map.enclosures.find(e => e.id === id)
  if (!found) throw new Error(`unknown enclosure: ${id}`)
  return found
}

/** 木の幹・岩・池を、動物がよける円として返す。 */
export function obstaclesOf(enclosure: Enclosure): Circle[] {
  const trees = enclosure.trees.map(t => ({ x: t.x, z: t.z, r: t.kind === 'bush' ? 0.75 * t.size : t.kind === 'bamboo' ? 0.55 * t.size : 0.45 * t.size }))
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
