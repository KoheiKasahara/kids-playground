import type { BuildingId, Scale } from './parts'
import { applyTool, COLS, createEmptyTown, GRASS, ROWS, type Tile, type Town } from './town'

// えらべる ちず（マスタデータ）。どの ちずも 14×14 で、まっさらも ふくめ さいしょから せんろの わと えきが あり でんしゃが はしる。
// もじの ちずで じめん・みち・せんろ・1マスの ものを おき、おおきな ものは big で あとから おく。

export type MapId = 'starter' | 'seaside' | 'island' | 'lake' | 'city' | 'amusement' | 'empty'

export type MapDefinition = {
  readonly id: MapId
  readonly name: string
  readonly emoji: string
  readonly rows: readonly string[]
  /** [よこ, たて, たてもの, おおきさ] の じゅん。ひだりうえの マスを さす。 */
  readonly big?: readonly (readonly [col: number, row: number, part: BuildingId, scale?: Scale])[]
}

const LEGEND: Record<string, Tile> = {
  '.': GRASS,
  '~': { ground: 'water', part: null },
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
  l: { ground: 'grass', part: 'lighthouse' },
  t: { ground: 'grass', part: 'tree' },
  k: { ground: 'grass', part: 'sakura' },
  w: { ground: 'grass', part: 'flowers' },
  m: { ground: 'grass', part: 'farm' },
  r: { ground: 'grass', part: 'park' },
  u: { ground: 'grass', part: 'fountain' },
  z: { ground: 'grass', part: 'beach' },
  q: { ground: 'grass', part: 'camp' },
  x: { ground: 'grass', part: 'ferris' },
  g: { ground: 'grass', part: 'merry' },
  Z: { ground: 'grass', part: 'circus' },
  C: { ground: 'grass', part: 'castle' },
  v: { ground: 'grass', part: 'tv-tower' },
  W: { ground: 'grass', part: 'windmill' },
  R: { ground: 'grass', part: 'rocket' },
}

export const MAPS: readonly MapDefinition[] = [
  {
    // かわが ながれ、はしと ふみきりの ある まち。せんろが まちを ぐるっと かこむ。
    id: 'starter',
    name: 'はじめの まち',
    emoji: '🏞️',
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
      'zzzzzzz=zzzzzl',
      '~~~~~~~b~~~~~~',
      '~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~',
    ],
    big: [[8, 8, 'pool'], [11, 8, 'windmill']],
  },
  {
    // うみに うかぶ しま。ながい はしで ちずの そとへ つながる。
    id: 'island',
    name: 'みなみの しま',
    emoji: '🏝️',
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
    id: 'city',
    name: 'おおきな とし',
    emoji: '🏙️',
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
    // ひろい くさはら。すみに ちいさな せんろの わと えき だけ あり、のこりは じぶんで つくる。
    id: 'empty',
    name: 'まっさら',
    emoji: '🌱',
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

const MAP_BY_ID = new Map<string, MapDefinition>(MAPS.map((map) => [map.id, map]))

export function findMap(id: string): MapDefinition | undefined {
  return MAP_BY_ID.get(id)
}

/** ちずの もじが ただしく よめるか（テストで ぜんぶの ちずを しらべる）。 */
export function mapProblems(map: MapDefinition): string[] {
  const problems: string[] = []
  if (map.rows.length !== ROWS) problems.push(`${map.id}: ${map.rows.length} rows`)
  map.rows.forEach((row, index) => {
    if (row.length !== COLS) problems.push(`${map.id}: row ${index} has ${row.length} cells`)
    for (const cell of row) if (!LEGEND[cell]) problems.push(`${map.id}: unknown cell "${cell}"`)
  })
  return problems
}

/** その ちずの さいしょの まち。 */
export function createMapTown(id: MapId): Town {
  const map = findMap(id)
  if (!map) return createEmptyTown()
  let town: Town = map.rows.flatMap((row) => [...row].map((cell) => LEGEND[cell] ?? GRASS))
  for (const [col, row, part, scale] of map.big ?? []) town = applyTool(town, row * COLS + col, part, scale ?? 1)
  return town
}

/** はじめの まち。 */
export function createTown(): Town {
  return createMapTown('starter')
}
