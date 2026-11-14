import type { BuildingId, Scale } from './parts'
import { applyTool, centerTown, COLS, createEmptyTown, GRASS, ROWS, type Ground, type Tile, type Town } from './town'
import { createWorld, STARTER_SEED, WORLDS, type WorldId } from './worlds'

// えらべる ちず（マスタデータ）。どの ちずも まっさらも ふくめ、さいしょから せんろの わと えきが あり でんしゃが はしる。
// - てがきの ちず: 14×14 の もじの ちずを ひろい ちずの まんなかに おき、まわりは ふちの かわ・うみ・みちを のばして しぜんを ちらす。
// - せかい: worlds.ts が たね（seed）から ひろい ちず ぜんぶを つくる。「さいしょから」の たびに かたちが かわる。

/** てがきの ちずの おおきさ（よこ・たて）。 */
export const STAMP_SIZE = 14

type StampId = 'starter' | 'seaside' | 'island' | 'lake' | 'city' | 'amusement' | 'empty'
export type MapId = StampId | `world-${WorldId}`

type MapBase = { readonly id: MapId; readonly name: string; readonly emoji: string }

export type StampMap = MapBase & {
  readonly kind: 'stamp'
  readonly rows: readonly string[]
  /** [よこ, たて, たてもの, おおきさ] の じゅん。ひだりうえの マスを さす（14×14 の なかの ばしょ）。 */
  readonly big?: readonly (readonly [col: number, row: number, part: BuildingId, scale?: Scale])[]
  /** まわりに きや はなを ちらさない（まっさら）。 */
  readonly plain?: boolean
}

export type WorldMap = MapBase & { readonly kind: 'world'; readonly world: WorldId }
export type MapDefinition = StampMap | WorldMap

const LEGEND: Record<string, Tile> = {
  '.': GRASS,
  '~': { ground: 'water', part: null },
  z: { ground: 'sand', part: null },
  '=': { ground: 'grass', part: 'road' },
  '#': { ground: 'grass', part: 'rail' },
  '+': { ground: 'grass', part: 'crossing' },
  b: { ground: 'water', part: 'road' },
  B: { ground: 'water', part: 'rail' },
  h: { ground: 'grass', part: 'house' },
  H: { ground: 'grass', part: 'house-blue' },
  a: { ground: 'grass', part: 'apartment' },
  T: { ground: 'grass', part: 'tower' },
  s: { ground: 'grass', part: 'shop' },
  c: { ground: 'grass', part: 'cake' },
  i: { ground: 'grass', part: 'icecream' },
  n: { ground: 'grass', part: 'bakery' },
  o: { ground: 'grass', part: 'office' },
  d: { ground: 'grass', part: 'depart' },
  S: { ground: 'grass', part: 'school' },
  P: { ground: 'grass', part: 'hospital' },
  f: { ground: 'grass', part: 'fire' },
  p: { ground: 'grass', part: 'police' },
  e: { ground: 'grass', part: 'station' },
  y: { ground: 'grass', part: 'heliport' },
  j: { ground: 'grass', part: 'shrine' },
  l: { ground: 'sand', part: 'lighthouse' },
  t: { ground: 'grass', part: 'tree' },
  k: { ground: 'grass', part: 'sakura' },
  w: { ground: 'grass', part: 'flowers' },
  m: { ground: 'grass', part: 'farm' },
  r: { ground: 'grass', part: 'park' },
  u: { ground: 'grass', part: 'fountain' },
  Y: { ground: 'sand', part: 'beach' },
  q: { ground: 'grass', part: 'tent' },
  x: { ground: 'grass', part: 'ferris' },
  g: { ground: 'grass', part: 'merry' },
  Z: { ground: 'grass', part: 'circus' },
  C: { ground: 'grass', part: 'castle' },
  v: { ground: 'grass', part: 'tv-tower' },
  W: { ground: 'grass', part: 'windmill' },
  R: { ground: 'grass', part: 'rocket' },
}

const STAMPS: readonly StampMap[] = [
  {
    // かわが ながれ、はしと ふみきりの ある まち。せんろが まちを ぐるっと かこむ。
    kind: 'stamp',
    id: 'starter',
    name: 'はじめの まち',
    emoji: '🏡',
    rows: [
      't.k..=...~~.tt',
      '.####+###BB##.',
      '.#..h=H..~~.#.',
      '.#.tH=h..~~.#.',
      '.#..s=c..~~.#.',
      '.#.k.=.u.~~.#.',
      '.#.r.=.S.~~.#t',
      '=+=======bb=+=',
      '.#..a=.x.~~e#.',
      '.#..h=H..~~.#.',
      '.#...=...~~.#.',
      '.#...=...~~k#.',
      '.####+###BB##.',
      't....=t..~~.tt',
    ],
    big: [[6, 10, 'supermarket'], [2, 10, 'tree', 2]],
  },
  {
    // みなみに うみと すなはま。とうだいと さんばしが ある。
    kind: 'stamp',
    id: 'seaside',
    name: 'うみべの まち',
    emoji: '🏖️',
    rows: [
      'tt..k..=..t.tt',
      '.######+#####.',
      '.#.k..h=H..t#.',
      '.#hHh.s=i.n.#.',
      '=+==========+=',
      '.#e.a.o=.d.f#.',
      '.#.t..k=x...#.',
      '.######+#####.',
      '.r..w..=......',
      'zzYzzzz=zzYzzl',
      '~~~~~~~b~~~~~~',
      '~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~',
    ],
    big: [[8, 8, 'pool'], [11, 8, 'windmill']],
  },
  {
    // うみに うかぶ しま。ながい はしで ちずの はしまで つながる。
    kind: 'stamp',
    id: 'island',
    name: 'みなみの しま',
    emoji: '🌴',
    rows: [
      '~~~~~~~~~~~~~~',
      '~~~lzzzzzzz~~~',
      '~~zz.=..k.tzz~',
      '~z.##+#####.z~',
      '~z.#h=H..R#.z~',
      '~z.#t=k..t#.z~',
      '~z.#e=.u.j#.z~',
      '~z=+======+=bb',
      '~z.#H=h.x.#.z~',
      '~z.#w=..m.#.z~',
      '~z.##+#####.z~',
      '~zz..=..t..zz~',
      '~~~zzzzzzzz~~~',
      '~~~~~~~~~~~~~~',
    ],
  },
  {
    // きたに やまが ならび、まんなかに みずうみ。ぼくじょうと キャンプじょう。
    kind: 'stamp',
    id: 'lake',
    name: 'やまと みずうみ',
    emoji: '⛰️',
    rows: [
      '..............',
      '..............',
      't.k..q...t.k.t',
      '...########...',
      '...#.W..W.#...',
      '...#.~~~~.#...',
      '...#.~~~~.#...',
      '...#.~~~~.#...',
      '...#.~~~~.#...',
      '===+======+===',
      '...########.=.',
      '.hH.e.c.i.Hh=.',
      '==============',
      '.t.m......t.r.',
    ],
    big: [[0, 0, 'mountain'], [4, 0, 'mountain'], [8, 0, 'mountain'], [11, 0, 'mountain'], [5, 13, 'ranch'], [7, 13, 'ranch']],
  },
  {
    // ビルが たちならぶ とし。ちずの ふちを せんろが まわる。
    kind: 'stamp',
    id: 'city',
    name: 'ビルの とし',
    emoji: '🏢',
    rows: [
      '######+#######',
      '#TaoT.=.dTo.T#',
      '#============#',
      '#hHsc.=.ShP.e#',
      '#.....=..rkr.#',
      '#.....=......#',
      '#...s.=......#',
      '#============#',
      '#oTaf.=.pdTo.#',
      '#.....=..t.k.#',
      '#..hHa=......#',
      '#============#',
      '#ThaH.=.cnTh.#',
      '######+#######',
    ],
    big: [
      [1, 4, 'office', 3], [4, 4, 'big-apartment'], [4, 5, 'supermarket'], [7, 4, 'stadium'], [9, 5, 'depart', 2],
      [11, 6, 'fire'], [12, 6, 'police'], [1, 9, 'zoo'], [4, 9, 'pool'], [7, 9, 'airport'], [9, 10, 'big-apartment'],
    ],
  },
  {
    // かんらんしゃ・メリーゴーランド・ジェットコースターの ある ゆうえんち。えんの まわりを きしゃが はしる。
    kind: 'stamp',
    id: 'amusement',
    name: 'ゆうえんち',
    emoji: '🎡',
    rows: [
      '..t.k.=t..k.t.',
      '.#####+######.',
      '.#...i=e....#.',
      '.#...x=g....#.',
      '.#...Z=.....#.',
      '.#..k.=.....#.',
      '.#.u..=.w.k.#.',
      '.#==========#.',
      '.#.c.n=x.g.i#.',
      '.#....=.....#.',
      '.#.t..=...t.#.',
      '.#.k.W=.R..k#.',
      '.#####+######.',
      '.t..kh=H.t..t.',
    ],
    big: [[7, 4, 'coaster'], [4, 9, 'pool'], [7, 9, 'castle', 2]],
  },
  {
    // ひろい くさはら。まんなかに ちいさな せんろの わと えき だけ あり、のこりは じぶんで つくる。
    kind: 'stamp',
    id: 'empty',
    name: 'まっさら',
    emoji: '🌱',
    plain: true,
    rows: [
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '.........####.',
      '.......=e#..#.',
      '.........#..#.',
      '.........####.',
      '..............',
    ],
  },
]

function stamp(id: StampId): StampMap {
  return STAMPS.find((map) => map.id === id)!
}

function world(id: WorldId): WorldMap {
  const item = WORLDS.find((entry) => entry.id === id)!
  return { kind: 'world', id: `world-${id}`, world: id, name: item.label, emoji: item.icon }
}

/** えらぶ がめんに ならべる じゅん。てがきの ちずと せかいを にた もの どうしで ならべ、まっさらは さいごに おく。 */
export const MAPS: readonly MapDefinition[] = [
  stamp('starter'), world('river'), stamp('seaside'), stamp('island'), world('island'), stamp('lake'), world('forest'),
  stamp('city'), world('city'), world('rail'), stamp('amusement'), world('castle'), world('snow'), world('desert'),
  stamp('empty'),
]

const MAP_BY_ID = new Map<string, MapDefinition>(MAPS.map((map) => [map.id, map]))

export function findMap(id: string): MapDefinition | undefined {
  return MAP_BY_ID.get(id)
}

/** ちずの もじが ただしく よめるか（テストで ぜんぶの ちずを しらべる）。 */
export function mapProblems(map: StampMap): string[] {
  const problems: string[] = []
  if (map.rows.length !== STAMP_SIZE) problems.push(`${map.id}: ${map.rows.length} rows`)
  map.rows.forEach((row, index) => {
    if (row.length !== STAMP_SIZE) problems.push(`${map.id}: row ${index} has ${row.length} cells`)
    for (const cell of row) if (!LEGEND[cell]) problems.push(`${map.id}: unknown cell "${cell}"`)
  })
  return problems
}

/** てがきの ちずを おく ひだりうえ（ひろい ちずの まんなか）。 */
export const STAMP_LEFT = Math.floor((COLS - STAMP_SIZE) / 2)
export const STAMP_TOP = Math.floor((ROWS - STAMP_SIZE) / 2)

/** まわりに ちらす しぜん。おなじ ちずなら いつも おなじ ばしょ に なる。 */
function scatterOf(id: string): (index: number, ground: Ground) => BuildingId | null {
  let salt = 0
  for (const char of id) salt = (Math.imul(salt, 31) + char.charCodeAt(0)) >>> 0
  return (index, ground) => {
    let h = Math.imul(index ^ salt, 2654435761) >>> 0
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
    const roll = ((h ^ (h >>> 13)) >>> 0) / 4294967296
    if (ground === 'sand') return roll < 0.05 ? 'palm' : null
    if (ground !== 'grass') return null
    if (roll < 0.07) return 'tree'
    if (roll < 0.085) return 'flowers'
    return roll < 0.095 ? 'sakura' : null
  }
}

/** てがきの ちずの まわり。ふちの かわ・うみ・すなはまは そのまま のび、みちは ちずの はしまで つづく。 */
function surroundings(map: StampMap, tiles: readonly Tile[]): Town {
  const scatter = scatterOf(map.id)
  return Array.from({ length: COLS * ROWS }, (_, index) => {
    const col = Math.max(0, Math.min(STAMP_SIZE - 1, (index % COLS) - STAMP_LEFT))
    const row = Math.max(0, Math.min(STAMP_SIZE - 1, Math.floor(index / COLS) - STAMP_TOP))
    const edge = tiles[row * STAMP_SIZE + col]
    const ground = edge.ground
    if (edge.part === 'road' || edge.part === 'crossing') return { ground, part: 'road' }
    const part = map.plain ? null : scatter(index, ground)
    if (part) return { ground, part }
    return ground === 'grass' ? GRASS : { ground, part: null }
  })
}

function createStampTown(map: StampMap): Town {
  const tiles: Town = map.rows.flatMap((row) => [...row].map((cell) => LEGEND[cell] ?? GRASS))
  let town = centerTown(surroundings(map, tiles), tiles, STAMP_SIZE, STAMP_SIZE)
  // おおきな たてものは まんなかへ おいた あとで、14×14 の なかの ばしょに おく。
  for (const [col, row, part, scale] of map.big ?? []) {
    town = applyTool(town, (STAMP_TOP + row) * COLS + STAMP_LEFT + col, part, scale ?? 1)
  }
  return town
}

/**
 * その ちずの さいしょの まち。せかいは seed で かたちが かわる（ない ときは みほんと おなじ かたち）。
 */
export function createMapTown(id: MapId, seed: number = STARTER_SEED): Town {
  const map = findMap(id)
  if (!map) return createEmptyTown()
  return map.kind === 'world' ? createWorld(map.world, seed) : createStampTown(map)
}

/** はじめの まち。 */
export function createTown(): Town {
  return createMapTown('starter')
}
