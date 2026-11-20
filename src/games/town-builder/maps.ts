import { isLarge, scalesOf, spanOf, type BuildingId, type Scale } from './parts'
import { centerTown, COLS, createEmptyTown, GRASS, ROWS, type Ground, type Tile, type Town } from './town'
import { createWorld, STARTER_SEED, WORLDS, type WorldId } from './worlds'

// えらべる ちず（マスタデータ）。どの ちずも まっさらも ふくめ、さいしょから せんろの わと えきが あり でんしゃが はしる。
// - てがきの ちず: もじの ちずを ひろい ちずの まんなかに おき、まわりは ふちの かわ・うみ・みちを のばして しぜんを ちらす。
//   おおきさは ちずごとに ちがって よい（ひろい ちずより ちいさければ よい）。
// - せかい: worlds.ts が たね（seed）から ひろい ちず ぜんぶを つくる。「さいしょから」の たびに かたちが かわる。

type StampId = 'starter' | 'seaside' | 'island' | 'lake' | 'city' | 'amusement' | 'empty'
export type MapId = StampId | `world-${WorldId}`

type MapBase = { readonly id: MapId; readonly name: string; readonly emoji: string }

/** おおきな たてもの。[たてもの, おおきさ, じめん]。おおきさは ちいさい（1）、じめんは くさはらが きまり。 */
export type BigPart = readonly [part: BuildingId, scale?: Scale, ground?: Exclude<Ground, 'water'>]

export type StampMap = MapBase & {
  readonly kind: 'stamp'
  /** 1もじ 1マスの ちず。どの ぎょうも おなじ ながさ。 */
  readonly rows: readonly string[]
  /**
   * LEGEND に ない もじ（すうじ など）で かいた しかくに おく おおきな たてもの。
   * おなじ もじの しかく 1つ（たてものの マスかず × おおきさ）が たてもの 1つ に なる。
   */
  readonly big?: Readonly<Record<string, BigPart>>
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
  ':': { ground: 'sand', part: 'road' },
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
    // おおきな がっこう・かんらんしゃ・き と、ながい スーパー。
    kind: 'stamp',
    id: 'starter',
    name: 'はじめの まち',
    emoji: '🏡',
    rows: [
      't..k...=.....~~..t.t',
      '..t....=..k..~~.....',
      '..#####+#####BB###..',
      '..#.k.h=H.t..~~..#..',
      '..#...H=s....~~44#..',
      '..#r..h=c..t.~~44#..',
      '..#==========~~..#..',
      '..#hH.k=n11u.~~.j#..',
      '..#tk.H=i11r.~~.t#..',
      '..#...P=p....~~.e#..',
      '==+==========bb==+==',
      '..#22.h=f.hH.~~55#..',
      '..#.t.k=c.t..~~55#..',
      '..#...H=h..k.~~.k#..',
      '..#==========~~..#..',
      '..#33.h=s.mmW~~.t#..',
      '..#33.k=H.mm.~~k.#..',
      '..#####+#####BB###..',
      '.t.....=..t..~~.k..t',
      't..k...=.....~~....t',
    ],
    big: { 1: ['school', 2], 2: ['supermarket'], 3: ['tree', 2], 4: ['sakura', 2], 5: ['ferris', 2] },
  },
  {
    // みなみに うみと すなはま。おおきな とうだい・かんらんしゃ・プールと、うみへ のびる さんばし。
    kind: 'stamp',
    id: 'seaside',
    name: 'うみべの まち',
    emoji: '🏖️',
    rows: [
      't.k..t...=...t..k.tt',
      '.########+#########.',
      '.#.k...t.=..55.k..#.',
      '.#.t....k=..55..t.#.',
      '.#ehH.s.H=i.nHh..k#.',
      '=+================+=',
      '.#h.a.H.o=d.f.H.h.#.',
      '.#.t.k..t=r..t...k#.',
      '.#================#.',
      '.#.hH.r.u=..c.w.k.#.',
      '.########+#########.',
      '====================',
      'z44zz33zY:Y2222z11zz',
      'z44zY33zz:z2222Y11zz',
      '~~~~~~~~~b~~~~~~~~~~',
      '~~~~~~~~~b~~~~~~~~~~',
      '~~~~~~~~bbb~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
    ],
    big: {
      1: ['lighthouse', 2, 'sand'], 2: ['pool', 2, 'sand'], 3: ['ferris', 2, 'sand'], 4: ['palm', 2, 'sand'], 5: ['tree', 2],
    },
  },
  {
    // うみに うかぶ しま。おおきな ロケットと とうだいと じんじゃ。ながい はしで ちずの はしまで つながる。
    kind: 'stamp',
    id: 'island',
    name: 'みなみの しま',
    emoji: '🌴',
    rows: [
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~11zzzzzzzzz~~~~~~',
      '~~z11zzz:zzzzzzz~~~~',
      '~zz.t.k.=.....t.zz~~',
      '~z..####+#######.z~~',
      '~z..#.kh=H.222.#.z~~',
      '~zz.#.tH=s.222.#.z~~',
      '~z..#..h=i.222.#..z~',
      '~z..#e.k=..u...#.zz~',
      '~zz=+==========+=:bb',
      '~z..#..H=h.y...#.zz~',
      '~z..#44.=x...w.#..z~',
      '~zz.#44.=.mm.t.#.zz~',
      '~z..#.k.=Hw.mm.#.z~~',
      '~z..####+#######.z~~',
      '~zz.t...=..k..t.33z~',
      '~~zz.k..:zzzzzzz33~~',
      '~~~zzzzzzzzzzzzz~~~~',
      '~~~~~~zzzzzzz~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
    ],
    big: { 1: ['lighthouse', 2, 'sand'], 2: ['rocket', 3], 3: ['palm', 2, 'sand'], 4: ['shrine', 2] },
  },
  {
    // きたに おおきな やまが ならび、まんなかの みずうみを はしが わたる。もりと ぼくじょうと ふうしゃ。
    kind: 'stamp',
    id: 'lake',
    name: 'やまと みずうみ',
    emoji: '⛰️',
    rows: [
      '1111..t...1111...k..1111',
      '1111.1111.1111.1111.1111',
      '1111.1111.1111.1111.1111',
      '1111.1111.1111.1111.1111',
      '.t...1111.k....1111...t.',
      '.q.t..k...q.t...w..q.t..',
      '...##################...',
      '...#.t..k.....t...k.#...',
      '...#...~~~~~~~~~~44.#...',
      '...#.k.~~~~~~~~~~44.#...',
      '...#.t.~~~~~~~~~~.w.#...',
      '...#e..~~~~~~~~~~..k#...',
      '===+===bbbbbbbbbb===+===',
      '...#22.~~~~~b~~~~...#...',
      '...#22.~~~~~b~~~~.q.#...',
      '...#.k..t...=..u...k#...',
      '...#########+########...',
      '..t.hH.c.n.H=h.s..Hh..t.',
      '========================',
      '.k.H.t..33333333..h..r..',
      '.t.mm.t.33333333.mm.t.k.',
      '..t.77...k....t...77..t.',
      '.k..77..t...w....t77....',
      't...k...t...t...k...t..t',
    ],
    big: { 1: ['mountain', 2], 2: ['forest'], 3: ['ranch', 2], 4: ['windmill', 2], 7: ['sakura', 2] },
  },
  {
    // ビルが たちならぶ とし。まんなかに とくだいの タワー、まわりに スタジアム・くうこう・どうぶつえん。
    // ちずの ふちを せんろが まわり、おおきな えきが ある。
    kind: 'stamp',
    id: 'city',
    name: 'ビルの とし',
    emoji: '🏢',
    rows: [
      '##########+###+#########',
      '#1111=5566=99o=oto=2222#',
      '#1111=5566=99T=77a=2222#',
      '#1111=otko=nri=77o=2222#',
      '#1111=hHsc=huH=csn=2222#',
      '#======================#',
      '#3333=88hH=66o=77o=00pf#',
      '#3333=88kh=66o=77T=00wt#',
      '#3333=Hrwh=ato=oko=hrkt#',
      '#3333=hHos=dks=cin=Hshh#',
      '+======================+',
      '#hHoH=oo77=444=oTo=!!!!#',
      '#tuko=ot77=444=auo=!!!!#',
      '#Hhsc=hHcn=444=sic=hHhH#',
      '+======================+',
      '#@@@@=66oo=odo=66a=odoT#',
      '#@@@@=66ka=oko=66o=arkt#',
      '#hHhn=Hhcs=sic=hHn=hHch#',
      '#======================#',
      '#$$$$=hHhH=cin=odo=hHhH#',
      '#$$$$=H&&h=cun=srk=H^^t#',
      '#trkH=h&&H=tww=kwt=h^^w#',
      '#wuwh=HtkH=kuk=tkt=Hktw#',
      '##########+###+#########',
    ],
    big: {
      1: ['stadium', 2], 2: ['airport', 2], 3: ['zoo', 2], 4: ['tv-tower', 3], 5: ['tower', 2], 6: ['office', 2], 7: ['depart', 2],
      8: ['school', 2], 9: ['station', 2], 0: ['hospital', 2], '!': ['big-apartment', 2], '@': ['supermarket', 2],
      $: ['pool', 2], '&': ['park', 2], '^': ['sakura', 2],
    },
  },
  {
    // まんなかに とくだいの おしろ。ジェットコースター・かんらんしゃ・メリーゴーランドが かこむ ゆうえんち。
    // えんの まわりを でんしゃが はしり、みなみの いりぐちに えきが ある。
    kind: 'stamp',
    id: 'amusement',
    name: 'ゆうえんち',
    emoji: '🎡',
    rows: [
      't..k..t.....=...t..k..t.',
      '.###########+##########.',
      '.#.00..k....=99..t.77.#.',
      '.#.00.t..k..=99.w..77.#.',
      '.#.t..k..w..=..k..w..t#.',
      '.#.k..6666.i=n..55.t..#.',
      '.#.t..6666.c=s..55..k.#.',
      '.#...==============...#.',
      '.#.k.=333.w.k.2222=.k.#.',
      '.#t..=333.k.w.2222=..t#.',
      '.#..k=333.w.k.2222=.w.#.',
      '.#.t.=.k.w.1112222=..k#.',
      '=+====w.k.w111w.k.====+=',
      '.#.k.=44.w.111.w44=.t.#.',
      '.#t..=44..kw.wk.44=..k#.',
      '.#..k=g.k.w.u.w.kx=.w.#.',
      '.#.t.=Z.w.kw.wk.wi=..t#.',
      '.#...==============...#.',
      '.#.k..cn.hH.=.Hh..t.k.#.',
      '.#.00..t...h=H..t..00.#.',
      '.#.00.k..w.s=c.w..k00.#.',
      '.#.t...k...e=u..k...t.#.',
      '.###########+##########.',
      't..k..t.....=...t..k..t.',
    ],
    big: {
      0: ['sakura', 2], 1: ['castle', 3], 2: ['coaster', 2], 3: ['ferris', 3], 4: ['merry', 2], 5: ['circus', 2], 6: ['pool', 2],
      7: ['rocket', 2], 9: ['tv-tower', 2],
    },
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

/** てがきの ちずの おおきさと、ひろい ちずの なかで おく ばしょ（ひだりうえ。まんなかに おく）。 */
export function stampFrame(map: StampMap): { cols: number; rows: number; left: number; top: number } {
  const cols = map.rows[0]?.length ?? 0
  const rows = map.rows.length
  return { cols, rows, left: Math.floor((COLS - cols) / 2), top: Math.floor((ROWS - rows) / 2) }
}

/** よみとった てがきの ちず。anchor は その ちずの なかの ばんごう。 */
type ReadStamp = { readonly tiles: readonly Tile[]; readonly problems: readonly string[] }

function readStamp(map: StampMap): ReadStamp {
  const { cols, rows } = stampFrame(map)
  const problems: string[] = []
  if (!cols || !rows || cols > COLS || rows > ROWS) problems.push(`${map.id}: size ${cols}×${rows}`)
  map.rows.forEach((row, index) => { if (row.length !== cols) problems.push(`${map.id}: row ${index} has ${row.length} cells`) })
  const big = map.big ?? {}
  for (const [key, [part, scale = 1]] of Object.entries(big)) {
    if (key.length !== 1 || LEGEND[key]) problems.push(`${map.id}: big key "${key}" must be one letter that is not in the legend`)
    if (!scalesOf(part).includes(scale)) problems.push(`${map.id}: ${part} cannot be ×${scale}`)
    if (!map.rows.some((row) => row.includes(key))) problems.push(`${map.id}: "${key}" is never drawn`)
  }
  const cell = (col: number, row: number) => map.rows[row]?.[col] ?? '.'
  const tiles: Tile[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const char = cell(col, row)
      const entry = big[char]
      if (entry) tiles.push({ ground: entry[2] ?? 'grass', part: null })
      else if (LEGEND[char]) tiles.push(LEGEND[char])
      else {
        problems.push(`${map.id}: unknown cell "${char}" at ${col}-${row}`)
        tiles.push(GRASS)
      }
    }
  }
  // おなじ もじの しかくを ひだりうえから じゅんに たてものに する。
  const used = new Set<number>()
  for (let index = 0; index < tiles.length; index += 1) {
    const col = index % cols
    const row = Math.floor(index / cols)
    const char = cell(col, row)
    const entry = big[char]
    if (!entry || used.has(index)) continue
    const [part, scale = 1, ground = 'grass'] = entry
    const [width, height] = spanOf(part, scale)
    const cells: number[] = []
    for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) cells.push((row + dy) * cols + col + dx)
    const fits = col + width <= cols && row + height <= rows
      && cells.every((other) => !used.has(other) && cell(other % cols, Math.floor(other / cols)) === char)
    if (!fits) {
      problems.push(`${map.id}: "${char}" at ${col}-${row} is not a ${width}×${height} block`)
      continue
    }
    for (const other of cells) {
      used.add(other)
      if (!isLarge(part, scale)) tiles[other] = { ground, part }
      else tiles[other] = scale > 1 ? { ground, part, anchor: index, scale } : { ground, part, anchor: index }
    }
  }
  return { tiles, problems }
}

/** ちずの もじが ただしく よめるか（テストで ぜんぶの ちずを しらべる）。 */
export function mapProblems(map: StampMap): string[] {
  return [...readStamp(map).problems]
}

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
  const { cols, rows, left, top } = stampFrame(map)
  const scatter = scatterOf(map.id)
  return Array.from({ length: COLS * ROWS }, (_, index) => {
    const col = Math.max(0, Math.min(cols - 1, (index % COLS) - left))
    const row = Math.max(0, Math.min(rows - 1, Math.floor(index / COLS) - top))
    const edge = tiles[row * cols + col]
    const ground = edge.ground
    if (edge.part === 'road' || edge.part === 'crossing') return { ground, part: 'road' }
    const part = map.plain ? null : scatter(index, ground)
    if (part) return { ground, part }
    return ground === 'grass' ? GRASS : { ground, part: null }
  })
}

function createStampTown(map: StampMap): Town {
  const { cols, rows } = stampFrame(map)
  const { tiles } = readStamp(map)
  return centerTown(surroundings(map, tiles), tiles, cols, rows)
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
