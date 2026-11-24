// 動物園のマップ（Three.js の座標: x 右, z 手前, y 上。単位はメートル）。
// 園はいくつかの「エリア」に分かれ、1度に1つのエリアだけを読み込んで描く（動物が増えても重くしない）。
// エリアの中は、園路の輪（ring）のまわりに展示場（円）を並べる。展示場には複数の種類をいっしょに入れられ、
// 柵の種類（堀・ガラス・おり・岩のかべ・木のさく）や獣舎を動物に合わせて変える。
// 描画（scenery.ts）・動物の行動（behavior.ts）・歩くモード（walk.ts）が、このデータを参照する。

import type { SpeciesId } from './species'

export type Vec2 = { x: number; z: number }
export type Circle = Vec2 & { r: number }

export type TreeKind = 'round' | 'acacia' | 'palm' | 'bush' | 'bamboo' | 'pine'
export type Tree = Vec2 & { kind: TreeKind; size: number }
export type Rock = Vec2 & { r: number; h: number; color?: string }

/**
 * 柵の種類（実際の動物園を参考に、動物に合わせて変える）。
 * - wood: 木のさく。草食の動物・ふれあい
 * - low: 低い木のさく（中が見やすい。ふれあい広場・フラミンゴ）
 * - moat: 堀（ほり）と低い石のかべ。ゾウ・サイ・サバンナ・サル山
 * - glass: ガラスのかべ。ペンギン・シロクマ・ワニ・カバ（水の中が見える）
 * - bars: 高いおり（もうじゅう）
 * - rock: 岩のかべ（ゴリラ）
 */
export type Barrier = 'wood' | 'low' | 'moat' | 'glass' | 'bars' | 'rock'

export type House = {
  /** 展示場の中心から見た向き（ラジアン、+z が 0）。ふつうは見る側の反対（奥）。 */
  angle: number
  width: number
  depth: number
  height: number
  wall: string
  roof: string
}

export type Enclosure = {
  id: string
  /** ここで暮らす動物の種類（サバンナのように、いっしょに入れてもよい）。 */
  species: SpeciesId[]
  center: Vec2
  radius: number
  barrier: Barrier
  /** 柵の色。 */
  fence: string
  ground: string
  pond?: Circle
  trees: Tree[]
  rocks: Rock[]
  /** 見る側（園路側）の向き（ラジアン、+z が 0）。看板と見学の場所はこちら。 */
  front: number
  /** 奥の獣舎（動物の家）。 */
  house?: House
  /** 中に入れる（ふれあい）。入口は front の向き。 */
  walkIn?: boolean
}

export type AreaId = 'savanna' | 'wild' | 'forest' | 'water' | 'farm'

export type AreaExit = {
  to: AreaId
  /** 出入口の門の位置（エリアのふち）。ここをくぐると隣のエリアへ行く。 */
  at: Vec2
  /** 外へ向かう向き（この向きへ歩いて出る）。 */
  heading: number
}

export type Area = {
  id: AreaId
  name: string
  emoji: string
  /** エリアを歩ける範囲の半径。 */
  radius: number
  /** 園路の輪の半径。展示場はこのまわりに並ぶ。 */
  ring: number
  /** ベンチと花だんのある広場。 */
  plaza: Circle
  grass: string
  sky: string
  /** 園路のそばに植える木の種類（エリアの雰囲気）。 */
  treeKinds: TreeKind[]
  enclosures: Enclosure[]
  /** 柵の外の木（園路・展示場・出入口をよけて置く）。 */
  trees: Tree[]
  exits: AreaExit[]
}

/** 園路の半分の幅（m）。 */
export const PATH_HALF = 1.3
const RING = 11.5
/** 外側の展示場の柵と、園路の輪のあいだのすきま。 */
const OUTER_GAP = 2.6

function round(v: number): number {
  return Math.round(v * 100) / 100
}
function polar(angleDeg: number, dist: number): Vec2 {
  const a = angleDeg * Math.PI / 180
  return { x: round(Math.sin(a) * dist), z: round(Math.cos(a) * dist) }
}
/** 園路の輪の外側に、半径 r の展示場を置くときの中心。 */
function outer(angleDeg: number, r: number): Vec2 {
  return polar(angleDeg, RING + OUTER_GAP + r)
}
/** エリアの中心（広場）へ向く向き。 */
function facingCenter(c: Vec2): number {
  return Math.atan2(-c.x, -c.z)
}
/**
 * 展示場の中の位置を「奥へ back・右へ side」で決める（見る側から見た左右）。
 * 展示場の向きが変わっても、池や木の配置が同じ見え方になる。
 */
function local(c: Vec2, front: number, back: number, side: number): Vec2 {
  const bx = -Math.sin(front)
  const bz = -Math.cos(front)
  // 見る側（front の外）から中を見たときの右
  const sx = -bz
  const sz = bx
  return { x: round(c.x + bx * back + sx * side), z: round(c.z + bz * back + sz * side) }
}

type EnclosureSpec = Omit<Enclosure, 'trees' | 'rocks' | 'pond' | 'house'> & {
  pond?: { back: number; side: number; r: number }
  trees?: { back: number; side: number; kind: TreeKind; size: number }[]
  rocks?: { back: number; side: number; r: number; h: number; color?: string }[]
  house?: Omit<House, 'angle'>
}

function enclosure(spec: EnclosureSpec): Enclosure {
  const { center: c, front } = spec
  return {
    ...spec,
    pond: spec.pond ? { ...local(c, front, spec.pond.back, spec.pond.side), r: spec.pond.r } : undefined,
    trees: (spec.trees ?? []).map(t => ({ ...local(c, front, t.back, t.side), kind: t.kind, size: t.size })),
    rocks: (spec.rocks ?? []).map(r => ({ ...local(c, front, r.back, r.side), r: r.r, h: r.h, color: r.color })),
    house: spec.house ? { ...spec.house, angle: front + Math.PI } : undefined,
  }
}

function outerEnclosure(angleDeg: number, spec: Omit<EnclosureSpec, 'center' | 'front'>): Enclosure {
  const center = outer(angleDeg, spec.radius)
  return enclosure({ ...spec, center, front: facingCenter(center) })
}

/** 真ん中の大きな展示場（見る側は手前 +z）。 */
function centerEnclosure(spec: Omit<EnclosureSpec, 'center' | 'front'>): Enclosure {
  return enclosure({ ...spec, center: { x: 0, z: 0 }, front: 0 })
}

// ---------------------------------------------------------------------------
// 柵の内側で動物が動ける広さ

/** 柵から内側へ、動物が入れない幅（堀・岩のかべの厚み）。 */
export function barrierInset(barrier: Barrier): number {
  if (barrier === 'moat') return 1.2
  if (barrier === 'rock') return 0.45
  return 0
}

/** 動物が動ける円の半径（柵の内側の堀などを除く）。 */
export function roamRadius(e: Enclosure): number {
  return e.radius - barrierInset(e.barrier)
}

// ---------------------------------------------------------------------------
// エリアの定義

const SAVANNA_ENCLOSURES: Enclosure[] = [
  centerEnclosure({
    id: 'savanna-plains',
    species: ['giraffe', 'zebra', 'ostrich'],
    radius: 8.4,
    barrier: 'moat',
    fence: '#b9946a',
    ground: '#dccf8e',
    pond: { back: 3.2, side: -2.6, r: 1.5 },
    trees: [
      { back: 3.6, side: 3.4, kind: 'acacia', size: 1.1 },
      { back: -2.8, side: -3.8, kind: 'acacia', size: 0.95 },
      { back: -2.4, side: 4.4, kind: 'bush', size: 0.8 },
    ],
    rocks: [{ back: -4.0, side: 1.2, r: 0.55, h: 0.45 }],
    // キリンの家は背が高い
    house: { width: 4.2, depth: 3.0, height: 4.4, wall: '#e8c98f', roof: '#a8643c' },
  }),
  outerEnclosure(-55, {
    id: 'elephant',
    species: ['elephant'],
    radius: 6.0,
    barrier: 'moat',
    fence: '#b98552',
    ground: '#c9d78a',
    pond: { back: 1.6, side: -1.5, r: 1.7 },
    trees: [{ back: 1.3, side: 2.6, kind: 'round', size: 1.0 }],
    rocks: [{ back: -1.6, side: 1.6, r: 0.5, h: 0.4 }],
    house: { width: 3.8, depth: 2.8, height: 3.4, wall: '#d9b98a', roof: '#8f5a3a' },
  }),
  outerEnclosure(55, {
    id: 'rhino',
    species: ['rhino'],
    radius: 5.4,
    barrier: 'moat',
    fence: '#9a7a55',
    ground: '#d9c98c',
    // どろあびの池
    pond: { back: 1.1, side: 1.5, r: 1.5 },
    trees: [{ back: 1.4, side: -2.3, kind: 'acacia', size: 0.85 }],
    rocks: [{ back: -1.5, side: -1.2, r: 0.45, h: 0.35 }],
  }),
  outerEnclosure(125, {
    id: 'hippo',
    species: ['hippo'],
    radius: 5.6,
    barrier: 'glass',
    fence: '#6d8597',
    ground: '#c7d68c',
    // 大きな池（ガラスごしに水の中が見える）
    pond: { back: 0.4, side: 0.4, r: 2.3 },
    trees: [{ back: 2.2, side: -3.0, kind: 'palm', size: 0.8 }],
    rocks: [{ back: -1.9, side: 2.8, r: 0.4, h: 0.3 }],
  }),
  outerEnclosure(-125, {
    id: 'meerkat',
    species: ['meerkat'],
    radius: 4.4,
    barrier: 'glass',
    fence: '#8a7a66',
    ground: '#e8d6a4',
    trees: [{ back: 2.2, side: 1.6, kind: 'bush', size: 0.6 }],
    // すあなのある砂の山と、見はり台の岩
    rocks: [
      { back: 1.0, side: -1.6, r: 0.75, h: 0.55, color: '#d9be86' },
      { back: -1.2, side: 1.2, r: 0.45, h: 0.5, color: '#c8b08a' },
    ],
  }),
]

const WILD_ENCLOSURES: Enclosure[] = [
  outerEnclosure(-45, {
    id: 'lion',
    species: ['lion'],
    radius: 6.0,
    barrier: 'bars',
    fence: '#4f5b4a',
    ground: '#e2c27f',
    trees: [{ back: 2.6, side: -2.4, kind: 'acacia', size: 0.9 }],
    // ライオンの見はらし岩
    rocks: [
      { back: 1.2, side: 1.8, r: 1.15, h: 0.9 },
      { back: -1.6, side: -1.8, r: 0.45, h: 0.35 },
    ],
    house: { width: 3.4, depth: 2.6, height: 2.6, wall: '#c9a777', roof: '#6b4a32' },
  }),
  outerEnclosure(45, {
    id: 'tiger',
    species: ['tiger'],
    radius: 5.8,
    barrier: 'bars',
    fence: '#4f5b4a',
    ground: '#c4d887',
    pond: { back: 1.4, side: -1.7, r: 1.4 },
    trees: [{ back: 1.6, side: 2.4, kind: 'round', size: 0.95 }],
    rocks: [{ back: -1.6, side: 1.7, r: 0.7, h: 0.55 }],
  }),
  outerEnclosure(-105, {
    id: 'cheetah',
    species: ['cheetah'],
    radius: 6.0,
    barrier: 'bars',
    fence: '#4f5b4a',
    ground: '#e3cb86',
    trees: [{ back: 2.6, side: 2.0, kind: 'acacia', size: 0.9 }],
    // 見はらしの丘（アリづかのような土の山）
    rocks: [
      { back: 0.8, side: -2.2, r: 0.8, h: 0.75, color: '#c9a77a' },
      { back: -2.2, side: 1.2, r: 0.4, h: 0.3 },
    ],
  }),
  outerEnclosure(105, {
    id: 'wolf',
    species: ['wolf'],
    radius: 5.6,
    barrier: 'bars',
    fence: '#4f5b4a',
    ground: '#b9cf86',
    trees: [
      { back: 2.0, side: -2.2, kind: 'pine', size: 1.0 },
      { back: 2.6, side: 1.6, kind: 'pine', size: 0.85 },
    ],
    // 見はらしの岩と、巣あなの丘
    rocks: [
      { back: 0.6, side: 2.4, r: 0.85, h: 0.7 },
      { back: -2.4, side: -0.8, r: 0.45, h: 0.35 },
    ],
  }),
  outerEnclosure(155, {
    id: 'fox',
    species: ['fox'],
    radius: 4.8,
    barrier: 'bars',
    fence: '#5a6650',
    ground: '#d3dc95',
    trees: [{ back: 1.8, side: 2.0, kind: 'pine', size: 0.85 }],
    // 巣あなのある丘
    rocks: [{ back: 1.8, side: -1.6, r: 0.7, h: 0.55, color: '#c9a77a' }],
  }),
]

const FOREST_ENCLOSURES: Enclosure[] = [
  centerEnclosure({
    id: 'monkey',
    species: ['monkey'],
    radius: 7.2,
    barrier: 'moat',
    fence: '#8a7a66',
    ground: '#c3d08a',
    // サル山: 真ん中に大きな岩を積む（サルはまわりを歩き回る）
    rocks: [
      { back: 0.0, side: 0.0, r: 1.7, h: 2.2, color: '#b9ab96' },
      { back: 1.2, side: -1.0, r: 1.0, h: 1.3, color: '#aa9d88' },
      { back: -0.9, side: 1.2, r: 0.8, h: 0.9 },
    ],
    trees: [{ back: 3.4, side: 3.2, kind: 'round', size: 0.9 }],
  }),
  outerEnclosure(-50, {
    id: 'panda',
    species: ['panda'],
    radius: 5.8,
    barrier: 'glass',
    fence: '#6f7d6a',
    ground: '#c9dd8e',
    trees: [
      { back: 2.2, side: 2.4, kind: 'bamboo', size: 1.0 },
      { back: 2.6, side: -1.8, kind: 'bamboo', size: 0.85 },
    ],
    rocks: [{ back: -1.6, side: -2.0, r: 0.45, h: 0.35 }],
    house: { width: 3.6, depth: 2.6, height: 2.8, wall: '#f2ede0', roof: '#4b7a3a' },
  }),
  outerEnclosure(50, {
    id: 'red_panda',
    species: ['red_panda'],
    radius: 5.0,
    barrier: 'low',
    fence: '#a0663f',
    ground: '#bcd88a',
    trees: [
      { back: 1.8, side: -2.0, kind: 'round', size: 0.9 },
      { back: 2.0, side: 2.0, kind: 'bamboo', size: 0.75 },
    ],
    rocks: [{ back: -1.8, side: 1.4, r: 0.45, h: 0.35 }],
  }),
  outerEnclosure(-125, {
    id: 'gorilla',
    species: ['gorilla'],
    radius: 5.8,
    barrier: 'rock',
    fence: '#9a8f80',
    ground: '#a9c97a',
    trees: [
      { back: 1.6, side: -2.3, kind: 'round', size: 1.0 },
      { back: 2.2, side: 2.0, kind: 'bamboo', size: 0.8 },
    ],
    rocks: [{ back: -1.5, side: 2.0, r: 0.6, h: 0.5 }],
  }),
  outerEnclosure(125, {
    id: 'bear',
    species: ['bear'],
    radius: 5.8,
    barrier: 'moat',
    fence: '#8a7a66',
    ground: '#b5cf86',
    // 水あそびの池と、大きな岩
    pond: { back: 1.2, side: 1.4, r: 1.4 },
    trees: [{ back: 1.0, side: -2.2, kind: 'pine', size: 1.0 }],
    rocks: [{ back: -1.4, side: -0.6, r: 0.75, h: 0.6 }],
  }),
]

const WATER_ENCLOSURES: Enclosure[] = [
  centerEnclosure({
    id: 'capybara',
    species: ['capybara'],
    radius: 5.6,
    barrier: 'low',
    fence: '#a3794f',
    ground: '#c6db8f',
    // カピバラの おふろ
    pond: { back: 1.5, side: -0.6, r: 1.6 },
    trees: [{ back: 1.8, side: 2.8, kind: 'round', size: 0.8 }],
    rocks: [{ back: -1.6, side: 2.2, r: 0.4, h: 0.3 }],
  }),
  outerEnclosure(-50, {
    id: 'penguin',
    species: ['penguin'],
    radius: 6.0,
    barrier: 'glass',
    fence: '#6f93ab',
    ground: '#e4eef0',
    pond: { back: 1.2, side: 0.6, r: 2.2 },
    rocks: [
      { back: -1.0, side: -2.6, r: 0.7, h: 0.55, color: '#e8f3f8' },
      { back: 2.8, side: -2.2, r: 0.5, h: 0.4, color: '#dcebf3' },
      { back: -2.2, side: 2.4, r: 0.4, h: 0.3, color: '#eef7fb' },
    ],
  }),
  outerEnclosure(50, {
    id: 'polar_bear',
    species: ['polar_bear'],
    radius: 6.0,
    barrier: 'glass',
    fence: '#6f93ab',
    ground: '#e6eef0',
    pond: { back: 0.9, side: -1.2, r: 2.0 },
    // 池のほとり（水浴びで立つ場所）をふさがないよう、池から離して置く
    rocks: [
      { back: 2.4, side: 2.4, r: 0.8, h: 0.65, color: '#eef6fa' },
      { back: -2.2, side: 2.4, r: 0.5, h: 0.4, color: '#e2eff6' },
    ],
  }),
  outerEnclosure(-125, {
    id: 'crocodile',
    species: ['crocodile'],
    radius: 5.6,
    barrier: 'glass',
    fence: '#5f7a52',
    ground: '#d6cf8e',
    pond: { back: 1.0, side: 1.0, r: 1.9 },
    trees: [{ back: 1.6, side: -2.9, kind: 'palm', size: 0.85 }],
    rocks: [{ back: -2.0, side: -1.6, r: 0.45, h: 0.3 }],
  }),
  outerEnclosure(125, {
    id: 'flamingo',
    species: ['flamingo'],
    radius: 5.4,
    barrier: 'low',
    fence: '#d08aa0',
    ground: '#cfe39a',
    pond: { back: 0.9, side: 0.9, r: 1.9 },
    trees: [{ back: 2.2, side: -2.6, kind: 'palm', size: 0.8 }],
    rocks: [{ back: -2.4, side: -1.6, r: 0.35, h: 0.25 }],
  }),
]

const FARM_ENCLOSURES: Enclosure[] = [
  centerEnclosure({
    id: 'fureai',
    species: ['rabbit', 'sheep', 'goat'],
    radius: 7.0,
    barrier: 'low',
    fence: '#c49a6c',
    ground: '#b9de86',
    walkIn: true,
    trees: [
      { back: 3.6, side: -3.2, kind: 'round', size: 0.9 },
      { back: 1.0, side: 4.4, kind: 'bush', size: 0.7 },
    ],
    rocks: [{ back: -1.8, side: -3.6, r: 0.35, h: 0.25 }],
    // 赤い屋根の小屋
    house: { width: 4.0, depth: 2.6, height: 2.6, wall: '#f4e6cc', roof: '#c8553d' },
  }),
  outerEnclosure(-50, {
    id: 'alpaca',
    species: ['alpaca'],
    radius: 5.4,
    barrier: 'wood',
    fence: '#b98a5a',
    ground: '#d7d89a',
    trees: [{ back: 2.4, side: 2.2, kind: 'round', size: 0.85 }],
    // すなあびの くぼみ
    rocks: [{ back: 1.4, side: -2.2, r: 0.5, h: 0.3, color: '#d8c08e' }],
    house: { width: 3.2, depth: 2.4, height: 2.3, wall: '#f1e2c4', roof: '#b4743f' },
  }),
  outerEnclosure(50, {
    id: 'deer',
    species: ['deer'],
    radius: 5.4,
    barrier: 'wood',
    fence: '#9b7a4f',
    ground: '#c0d98a',
    trees: [
      { back: 1.8, side: -2.4, kind: 'round', size: 0.95 },
      { back: 2.4, side: 2.0, kind: 'pine', size: 0.8 },
    ],
    rocks: [{ back: -1.8, side: 1.8, r: 0.4, h: 0.3 }],
  }),
  outerEnclosure(-125, {
    id: 'kangaroo',
    species: ['kangaroo'],
    radius: 5.6,
    barrier: 'wood',
    fence: '#b06e45',
    ground: '#e3b57c',
    trees: [
      { back: 1.8, side: -2.6, kind: 'round', size: 0.85 },
      { back: 2.6, side: 1.6, kind: 'bush', size: 0.7 },
    ],
    rocks: [{ back: -1.6, side: 2.2, r: 0.6, h: 0.45, color: '#c98f63' }],
  }),
  outerEnclosure(125, {
    id: 'camel',
    species: ['camel'],
    radius: 5.8,
    barrier: 'wood',
    fence: '#c08b55',
    ground: '#ecd29a',
    trees: [
      { back: 2.0, side: -2.4, kind: 'palm', size: 0.95 },
      { back: 2.4, side: 2.4, kind: 'palm', size: 0.8 },
    ],
    rocks: [{ back: -1.8, side: -1.6, r: 0.55, h: 0.4, color: '#d8b47c' }],
  }),
]

type AreaSpec = Omit<Area, 'trees' | 'exits' | 'radius' | 'ring' | 'plaza'> & { plaza?: Circle }

/** 回る順（サバンナ → もうじゅう → … → ふれあい → サバンナ）。出入口はこの順につながる。 */
const AREA_SPECS: AreaSpec[] = [
  { id: 'savanna', name: 'サバンナ', emoji: '🦒', grass: '#b8cf6a', sky: '#bfe7fb', treeKinds: ['acacia', 'bush', 'round'], enclosures: SAVANNA_ENCLOSURES },
  { id: 'wild', name: 'もうじゅうの もり', emoji: '🦁', grass: '#8fc062', sky: '#c4e6f5', treeKinds: ['round', 'pine', 'bush'], enclosures: WILD_ENCLOSURES, plaza: { x: 0, z: 0, r: 2.8 } },
  { id: 'forest', name: 'パンダの もり', emoji: '🐼', grass: '#94c866', sky: '#c8ecf3', treeKinds: ['bamboo', 'round', 'bush'], enclosures: FOREST_ENCLOSURES },
  { id: 'water', name: 'こおりと みずべ', emoji: '🐧', grass: '#a6d07a', sky: '#cfeefc', treeKinds: ['palm', 'round', 'bush'], enclosures: WATER_ENCLOSURES },
  { id: 'farm', name: 'ふれあい ひろば', emoji: '🐰', grass: '#a3d66f', sky: '#c6ecfb', treeKinds: ['round', 'bush', 'pine'], enclosures: FARM_ENCLOSURES },
]

export const AREA_ORDER: AreaId[] = AREA_SPECS.map(a => a.id)

function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

/** 園路（輪・出入口へのまっすぐな道・展示場の前へのびる道）の線分。 */
const pathCache = new WeakMap<object, [Vec2, Vec2][]>()

export function pathSegments(area: Pick<Area, 'ring' | 'radius' | 'enclosures'>): [Vec2, Vec2][] {
  const cached = pathCache.get(area)
  if (cached) return cached
  const segments: [Vec2, Vec2][] = []
  pathCache.set(area, segments)
  const center = area.enclosures.find(e => Math.hypot(e.center.x, e.center.z) < 0.5)
  if (center) {
    segments.push([{ x: 0, z: area.ring }, { x: 0, z: area.radius }], [{ x: 0, z: -area.ring }, { x: 0, z: -area.radius }])
  } else {
    segments.push([{ x: 0, z: -area.radius }, { x: 0, z: area.radius }])
  }
  for (const e of area.enclosures) {
    if (e === center) continue
    // 見る側の柵から、園路の輪までまっすぐのばす
    const fx = e.center.x + Math.sin(e.front) * e.radius
    const fz = e.center.z + Math.cos(e.front) * e.radius
    const r = Math.hypot(fx, fz)
    const k = area.ring / Math.max(r, 1e-6)
    segments.push([{ x: fx, z: fz }, { x: fx * k, z: fz * k }])
  }
  return segments
}

function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len2 = dx * dx + dz * dz
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2)) : 0
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t)
}

/** 点が園路の上か（輪・まっすぐな道・広場）。 */
export function onPath(area: Pick<Area, 'ring' | 'radius' | 'enclosures' | 'plaza'>, p: Vec2, margin = 0): boolean {
  if (Math.abs(Math.hypot(p.x, p.z) - area.ring) < PATH_HALF + margin) return true
  if (distance(p, area.plaza) < area.plaza.r + margin) return true
  return pathSegments(area).some(([a, b]) => segmentDistance(p, a, b) < PATH_HALF + margin)
}

function buildArea(spec: AreaSpec, index: number): Area {
  const reach = Math.max(...spec.enclosures.map(e => Math.hypot(e.center.x, e.center.z) + e.radius))
  const radius = round(reach + 3)
  // 広場は入口からの道の横に置く（入ってすぐの道をふさがない）
  const plaza = spec.plaza ?? { x: PATH_HALF + 2.6, z: RING + 4.2, r: 2.2 }
  const n = AREA_SPECS.length
  const prev = AREA_SPECS[(index + n - 1) % n].id
  const next = AREA_SPECS[(index + 1) % n].id
  const exits: AreaExit[] = [
    // 手前（俯瞰のカメラ側）は前のエリアから来る入口、奥は次のエリアへの出口
    { to: prev, at: { x: 0, z: radius - 0.6 }, heading: 0 },
    { to: next, at: { x: 0, z: -(radius - 0.6) }, heading: Math.PI },
  ]
  const base = { ring: RING, radius, enclosures: spec.enclosures, plaza }
  // 柵の外の木: 園路・展示場・出入口・広場をよけて、輪のすきまとエリアのふちに植える
  const trees: Tree[] = []
  const candidates: Vec2[] = []
  for (let i = 0; i < 36; i++) candidates.push(polar(i * 10 + 5, RING + 2.3))
  for (let i = 0; i < 44; i++) candidates.push(polar(i * (360 / 44), radius - 1.2 - (i % 2) * 0.9))
  for (let i = 0; i < 12; i++) candidates.push(polar(i * 30 + 15, RING - 2.4))
  candidates.forEach((p, i) => {
    if (spec.enclosures.some(e => distance(p, e.center) < e.radius + 1.6)) return
    if (onPath(base, p, 1.0)) return
    if (exits.some(x => distance(p, x.at) < 3.2)) return
    if (trees.some(t => distance(p, t) < 2.6)) return
    const kind = spec.treeKinds[Math.floor(hash(i * 7.7 + index) * spec.treeKinds.length)]
    trees.push({ ...p, kind, size: round(0.8 + hash(i * 3.3 + index) * 0.4) })
  })
  return { ...spec, ...base, trees, exits }
}

export const AREAS: Area[] = AREA_SPECS.map(buildArea)

export function areaById(id: AreaId): Area {
  const found = AREAS.find(a => a.id === id)
  if (!found) throw new Error(`unknown area: ${id}`)
  return found
}

export function isAreaId(value: unknown): value is AreaId {
  return typeof value === 'string' && (AREA_ORDER as string[]).includes(value)
}

/** その種類の動物がいるエリアと展示場。 */
export function homeOf(species: SpeciesId): { area: Area; enclosure: Enclosure } {
  for (const area of AREAS) {
    const enclosure = area.enclosures.find(e => e.species.includes(species))
    if (enclosure) return { area, enclosure }
  }
  throw new Error(`no enclosure for ${species}`)
}

/** エリアにいる動物の種類（展示場の並び順）。 */
export function speciesOfArea(area: Area): SpeciesId[] {
  return area.enclosures.flatMap(e => e.species)
}

export function enclosureById(area: Area, id: string): Enclosure {
  const found = area.enclosures.find(e => e.id === id)
  if (!found) throw new Error(`unknown enclosure: ${id}`)
  return found
}

/** 獣舎の、展示場の内側にはみ出す部分を、動物がよける円で近似する。 */
export function houseCircle(e: Enclosure): Circle | undefined {
  const h = e.house
  if (!h) return undefined
  const d = e.radius - 0.2
  return { x: e.center.x + Math.sin(h.angle) * d, z: e.center.z + Math.cos(h.angle) * d, r: Math.max(h.width, h.depth) * 0.5 }
}

/** 木の幹・岩・池・獣舎を、動物がよける円として返す。 */
export function obstaclesOf(enclosure: Enclosure): Circle[] {
  const trees = enclosure.trees.map(t => ({ x: t.x, z: t.z, r: t.kind === 'bush' ? 0.75 * t.size : t.kind === 'bamboo' ? 0.55 * t.size : 0.45 * t.size }))
  const rocks = enclosure.rocks.map(r => ({ x: r.x, z: r.z, r: r.r }))
  const house = houseCircle(enclosure)
  return [...trees, ...rocks, ...(enclosure.pond ? [enclosure.pond] : []), ...(house ? [house] : [])]
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** 線分 a→b が円（半径 + margin）を横切るか。 */
export function segmentHitsCircle(a: Vec2, b: Vec2, c: Circle, margin = 0): boolean {
  return segmentDistance(c, a, b) < c.r + margin
}

/** 動物が動ける範囲（堀などの内側、縁から margin 内側）に収まるように点を引き戻す。 */
export function clampToEnclosure(p: Vec2, enclosure: Enclosure, margin: number): Vec2 {
  const dx = p.x - enclosure.center.x
  const dz = p.z - enclosure.center.z
  const d = Math.hypot(dx, dz)
  const limit = Math.max(0.1, roamRadius(enclosure) - margin)
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

/** 看板の位置（見る側の柵の外、入口の道の少し横）。 */
export function signPosition(e: Enclosure): Vec2 & { angle: number } {
  const angle = e.front + (e.walkIn ? 0.36 : 0.3) * Math.min(1, 6 / e.radius)
  return { x: e.center.x + Math.sin(angle) * (e.radius + 0.9), z: e.center.z + Math.cos(angle) * (e.radius + 0.9), angle }
}
