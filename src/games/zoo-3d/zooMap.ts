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
const OUTER_RING = 27
/** 外側の輪のすきまの奥に、さらに並べる3つ目の輪（外側のエリアと交互）。 */
const THIRD_RING = 37.5
/** 3つ目の輪で使う方向（ここには、すきまの木を植えない）。 */
const THIRD_SLOTS = [-11.25, 11.25, -33.75, 33.75]
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

// 外側の輪は 22.5 度ずつ 16 か所。0 度が手前（俯瞰のカメラ側）
const RABBIT = outer(0, 26.4)
const PENGUIN = outer(22.5)
const TIGER = outer(-22.5)
const HIPPO = outer(45)
const ZEBRA = outer(-45)
const FLAMINGO = outer(67.5)
const KANGAROO = outer(-67.5)
const POLAR_BEAR = outer(90)
const CAMEL = outer(-90)
const CAPYBARA = outer(135)
const CROCODILE = outer(-135)
const MONKEY = outer(180)
const SHEEP = outer(112.5)
const GORILLA = outer(-112.5)
const RED_PANDA = outer(157.5)
const RHINO = outer(-157.5)
const DEER = outer(-11.25, THIRD_RING)

export const ZOO_MAP: ZooMap = {
  radius: 44,
  plaza: { x: 0, z: 0.4, r: 2.6 },
  ringRoad: 18.6,
  spokes: [[{ x: -2.4, z: 0.8 }, { x: -18.6, z: 0.8 }], [{ x: 2.4, z: 0.8 }, { x: 18.6, z: 0.8 }]],
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
      pond: { ...near(PENGUIN, 1.4, 1.6), r: 1.6 },
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
      pond: { ...near(HIPPO, 1.9, -1.4), r: 1.9 },
      trees: [
        { ...near(HIPPO, -2.7, 1.9), kind: 'palm', size: 0.8 },
        { ...near(HIPPO, -1.6, -3.4), kind: 'bush', size: 0.7 },
      ],
      rocks: [{ ...near(HIPPO, 2.9, 2.0), r: 0.45, h: 0.35 }],
      gate: facingCenter(HIPPO),
    },
    {
      id: 'rabbit',
      center: RABBIT,
      radius: 4.3,
      fence: '#c49a6c',
      ground: '#b9de86',
      trees: [
        { ...near(RABBIT, -2.3, 1.6), kind: 'bush', size: 0.7 },
        { ...near(RABBIT, 2.4, 1.2), kind: 'bush', size: 0.65 },
        { ...near(RABBIT, 0.6, 2.9), kind: 'round', size: 0.7 },
      ],
      rocks: [{ ...near(RABBIT, -1.5, -1.9), r: 0.35, h: 0.25 }],
      gate: facingCenter(RABBIT),
    },
    {
      id: 'kangaroo',
      center: KANGAROO,
      radius: 5.0,
      fence: '#b06e45',
      ground: '#e3b57c',
      trees: [
        { ...near(KANGAROO, -2.8, 1.9), kind: 'round', size: 0.85 },
        { ...near(KANGAROO, -1.2, -3.3), kind: 'bush', size: 0.7 },
      ],
      rocks: [
        { ...near(KANGAROO, 1.4, 2.8), r: 0.6, h: 0.45, color: '#c98f63' },
        { ...near(KANGAROO, -3.2, -1.2), r: 0.4, h: 0.3, color: '#d29a6c' },
      ],
      gate: facingCenter(KANGAROO),
    },
    {
      id: 'flamingo',
      center: FLAMINGO,
      radius: 4.8,
      fence: '#d08aa0',
      ground: '#cfe39a',
      pond: { ...near(FLAMINGO, 1.9, 1.3), r: 1.8 },
      trees: [
        { ...near(FLAMINGO, -2.4, 2.4), kind: 'palm', size: 0.8 },
        { ...near(FLAMINGO, -2.0, -2.6), kind: 'bush', size: 0.65 },
      ],
      rocks: [{ ...near(FLAMINGO, 3.1, -2.2), r: 0.35, h: 0.25 }],
      gate: facingCenter(FLAMINGO),
    },
    {
      id: 'polar_bear',
      center: POLAR_BEAR,
      radius: 5.1,
      fence: '#7d9bb0',
      ground: '#e6eef0',
      pond: { ...near(POLAR_BEAR, -1.4, 1.6), r: 1.7 },
      trees: [],
      rocks: [
        // 池のほとり（水浴びで立つ場所）をふさがないよう、池から離して置く
        { ...near(POLAR_BEAR, 2.6, -1.0), r: 0.8, h: 0.65, color: '#eef6fa' },
        { ...near(POLAR_BEAR, 1.3, -3.0), r: 0.5, h: 0.4, color: '#e2eff6' },
        { ...near(POLAR_BEAR, -3.0, -2.0), r: 0.45, h: 0.35, color: '#f2f8fb' },
      ],
      gate: facingCenter(POLAR_BEAR),
    },
    {
      id: 'camel',
      center: CAMEL,
      radius: 5.2,
      fence: '#c08b55',
      ground: '#ecd29a',
      trees: [
        { ...near(CAMEL, -2.6, -2.4), kind: 'palm', size: 0.95 },
        { ...near(CAMEL, 2.9, -1.6), kind: 'palm', size: 0.8 },
      ],
      rocks: [
        { ...near(CAMEL, -2.4, 2.4), r: 0.55, h: 0.4, color: '#d8b47c' },
        { ...near(CAMEL, 1.2, 3.0), r: 0.4, h: 0.3, color: '#dcbb86' },
      ],
      gate: facingCenter(CAMEL),
    },
    {
      id: 'monkey',
      center: MONKEY,
      radius: 5.0,
      fence: '#8a6a4c',
      ground: '#c3d08a',
      trees: [
        { ...near(MONKEY, -2.9, -1.4), kind: 'round', size: 0.95 },
        { ...near(MONKEY, 2.8, -1.8), kind: 'round', size: 0.85 },
      ],
      // サル山: 大きな岩を重ねる
      rocks: [
        { ...near(MONKEY, 0.4, -2.3), r: 1.15, h: 1.0, color: '#b9ab96' },
        { ...near(MONKEY, -1.4, -2.9), r: 0.6, h: 0.5 },
        { ...near(MONKEY, 2.4, 1.6), r: 0.45, h: 0.35 },
      ],
      gate: facingCenter(MONKEY),
    },
    {
      id: 'capybara',
      center: CAPYBARA,
      radius: 4.6,
      fence: '#a3794f',
      ground: '#c6db8f',
      // お風呂の池
      pond: { ...near(CAPYBARA, 1.0, -1.7), r: 1.5 },
      trees: [
        { ...near(CAPYBARA, -2.4, -1.5), kind: 'bush', size: 0.75 },
        { ...near(CAPYBARA, -1.4, 2.6), kind: 'round', size: 0.75 },
      ],
      rocks: [{ ...near(CAPYBARA, 2.7, 1.3), r: 0.4, h: 0.3 }],
      gate: facingCenter(CAPYBARA),
    },
    {
      id: 'crocodile',
      center: CROCODILE,
      radius: 5.2,
      fence: '#6f8a52',
      ground: '#d6cf8e',
      pond: { ...near(CROCODILE, 1.4, -1.9), r: 1.7 },
      trees: [
        { ...near(CROCODILE, -2.8, -1.8), kind: 'palm', size: 0.85 },
        { ...near(CROCODILE, -2.4, 2.6), kind: 'bush', size: 0.7 },
      ],
      rocks: [{ ...near(CROCODILE, 2.9, 1.6), r: 0.45, h: 0.3 }],
      gate: facingCenter(CROCODILE),
    },
    {
      id: 'sheep',
      center: SHEEP,
      radius: 4.8,
      fence: '#d2b48a',
      ground: '#b5dc7f',
      trees: [
        { ...near(SHEEP, -2.5, 2.0), kind: 'round', size: 0.8 },
        { ...near(SHEEP, 2.6, -1.8), kind: 'bush', size: 0.7 },
        { ...near(SHEEP, -1.0, -3.0), kind: 'bush', size: 0.6 },
      ],
      rocks: [],
      gate: facingCenter(SHEEP),
    },
    {
      id: 'gorilla',
      center: GORILLA,
      radius: 5.0,
      fence: '#7a5c41',
      ground: '#a9c97a',
      trees: [
        { ...near(GORILLA, -2.6, 2.0), kind: 'round', size: 1.0 },
        { ...near(GORILLA, 2.4, 2.4), kind: 'bamboo', size: 0.8 },
        { ...near(GORILLA, -1.8, -2.8), kind: 'bush', size: 0.75 },
      ],
      rocks: [{ ...near(GORILLA, 2.6, -1.6), r: 0.6, h: 0.5 }],
      gate: facingCenter(GORILLA),
    },
    {
      id: 'red_panda',
      center: RED_PANDA,
      radius: 4.6,
      fence: '#a0663f',
      ground: '#bcd88a',
      trees: [
        { ...near(RED_PANDA, -2.2, -1.8), kind: 'round', size: 0.9 },
        { ...near(RED_PANDA, 2.2, 1.9), kind: 'bamboo', size: 0.75 },
      ],
      rocks: [{ ...near(RED_PANDA, 1.6, -2.6), r: 0.45, h: 0.35 }],
      gate: facingCenter(RED_PANDA),
    },
    {
      id: 'rhino',
      center: RHINO,
      radius: 5.1,
      fence: '#9a7a55',
      ground: '#d9c98c',
      // どろあびの池
      pond: { ...near(RHINO, -1.6, -1.6), r: 1.6 },
      trees: [
        { ...near(RHINO, 2.5, -2.4), kind: 'acacia', size: 0.85 },
        { ...near(RHINO, 2.6, 2.2), kind: 'bush', size: 0.7 },
      ],
      rocks: [{ ...near(RHINO, -2.8, 2.0), r: 0.5, h: 0.4 }],
      gate: facingCenter(RHINO),
    },
    {
      id: 'deer',
      center: DEER,
      radius: 4.8,
      fence: '#9b7a4f',
      ground: '#c0d98a',
      trees: [
        { ...near(DEER, -2.4, 1.8), kind: 'round', size: 0.95 },
        { ...near(DEER, 2.5, 1.6), kind: 'round', size: 0.8 },
      ],
      rocks: [{ ...near(DEER, 1.8, -2.4), r: 0.4, h: 0.3 }],
      gate: facingCenter(DEER),
    },
  ],
  outerTrees: [
    // 環状の園路の内側（内側のエリアのすきま）
    { x: -0.2, z: -14.2, kind: 'round', size: 1.1 },
    { x: 0.1, z: 14.6, kind: 'bush', size: 0.9 },
    { x: -14.0, z: -1.9, kind: 'bush', size: 0.8 },
    { x: 14.2, z: -1.7, kind: 'bush', size: 0.8 },
    // 環状の園路と外側のエリアのあいだ
    ...Array.from({ length: 8 }, (_, i) => ({
      ...outer(11.25 + i * 45, 21.2), kind: (['bush', 'round'] as const)[i % 2], size: 0.8,
    })),
    // 外側のエリアのすきまの奥と、園の外周
    ...Array.from({ length: 16 }, (_, i) => 11.25 + i * 22.5 - (i >= 8 ? 360 : 0))
      .filter(deg => !THIRD_SLOTS.includes(deg))
      .map((deg, i) => ({ ...outer(deg, 31.2 + (i % 2) * 0.8), kind: (['round', 'palm', 'bush'] as const)[i % 3], size: 0.95 + (i % 3) * 0.1 })),
    ...Array.from({ length: 16 }, (_, i) => ({
      ...outer(i * 22.5, 36.5), kind: (['round', 'bush', 'palm'] as const)[i % 3], size: 1.15,
    })),
    ...Array.from({ length: 16 }, (_, i) => ({
      ...outer(11.25 + i * 22.5, 45), kind: (['bush', 'round', 'palm'] as const)[i % 3], size: 1.2,
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
