// おうちづくりの マスタデータ。いえの しゅるい・かたち・へや（しゅるい・みため・おおきさ）・
// そとがわの えらべる もの を ここに まとめる。あそびかたの ロジックは plan.ts に わける。

// ---------------- いえの しゅるい ----------------

export type HouseTypeId = 'hiraya' | 'nikai' | 'sangai' | 'yonkai'

export type HouseType = { id: HouseTypeId; name: string; floors: number; lead: string }

export const HOUSE_TYPES: readonly HouseType[] = [
  { id: 'hiraya', name: 'ひらや', floors: 1, lead: '1かいだけの おうち' },
  { id: 'nikai', name: '2かいだて', floors: 2, lead: 'かいだんで 2かいへ' },
  { id: 'sangai', name: '3かいだて', floors: 3, lead: 'たかい おうち' },
  { id: 'yonkai', name: '4かいだて', floors: 4, lead: 'のっぽの おうち' },
]

// ---------------- かたち ----------------

export type ShapeId = 'square' | 'rect' | 'narrow' | 'wide' | 'lshape' | 'ushape'

export type Shape = {
  id: ShapeId
  name: string
  lead: string
  width: number
  height: number
  /** mask[y][x] が true の マスが へやを おける ゆか。false は にわ。下が おもて（げんかんがわ）。 */
  mask: readonly (readonly boolean[])[]
}

function shape(id: ShapeId, name: string, lead: string, rows: readonly string[]): Shape {
  return { id, name, lead, width: rows[0].length, height: rows.length, mask: rows.map((row) => [...row].map((c) => c === '#')) }
}

const filled = (w: number, h: number) => Array.from({ length: h }, () => '#'.repeat(w))

export const SHAPES: readonly Shape[] = [
  shape('square', 'しかく', 'たても よこも おなじ', filled(6, 6)),
  shape('rect', 'ながしかく', 'よこに ながい', filled(8, 5)),
  shape('narrow', 'せまい', 'ほそくて こぢんまり', filled(4, 7)),
  shape('wide', 'ひろい', 'とっても ひろびろ', filled(10, 7)),
  shape('lshape', 'L の かたち', 'かどに おにわ', [
    '########',
    '########',
    '########',
    '########',
    '#####...',
    '#####...',
    '#####...',
  ]),
  shape('ushape', 'なかにわつき', 'まんなかに おにわ', [
    '#########',
    '#########',
    '#########',
    '###...###',
    '###...###',
    '###...###',
    '###...###',
  ]),
]

// ---------------- へや ----------------

export type RoomTypeId =
  | 'living' | 'dining' | 'kitchen' | 'bath' | 'toilet' | 'washroom'
  | 'bedroom' | 'kids' | 'washitsu' | 'entrance' | 'stairs' | 'hall'

export type RoomSizeId = 's' | 'm' | 'l'

export const ROOM_SIZES: readonly { id: RoomSizeId; name: string }[] = [
  { id: 's', name: 'ちいさい' },
  { id: 'm', name: 'ふつう' },
  { id: 'l', name: 'おおきい' },
]

/** ゆかの もよう。 */
export type FloorKind = 'wood' | 'tile' | 'tatami' | 'carpet' | 'checker' | 'stone' | 'marble'

export type RoomStyle = {
  id: string
  /** 「ひのきの おふろ」のような みための なまえ。 */
  name: string
  floor: FloorKind
  /** ゆかの いろ と もようの せんの いろ。 */
  base: string
  line: string
  /** かぐの おもな いろ と さしいろ。 */
  main: string
  accent: string
  /** かぐの おきかたや かざりの ちがい。 */
  variant?: string
}

export type RoomType = {
  id: RoomTypeId
  name: string
  /** せまい へやでも はいる みじかい なまえ。 */
  short: string
  sizes: Readonly<Record<RoomSizeId, readonly [w: number, h: number]>>
  styles: readonly RoomStyle[]
}

export const ROOM_TYPES: readonly RoomType[] = [
  {
    id: 'living', name: 'リビング', short: 'リビング',
    sizes: { s: [3, 2], m: [3, 3], l: [4, 3] },
    styles: [
      { id: 'natural', name: 'ぽかぽか ナチュラルな リビング', floor: 'wood', base: '#ecd0a2', line: '#caa676', main: '#7fb069', accent: '#f4d35e' },
      { id: 'modern', name: 'しろくて モダンな リビング', floor: 'tile', base: '#f3f3f1', line: '#d9d9d5', main: '#4a4e69', accent: '#22a6b3' },
      { id: 'pop', name: 'カラフル ポップな リビング', floor: 'carpet', base: '#ffe3ec', line: '#ffc2d4', main: '#ff6b9a', accent: '#4dc9ff', variant: 'pop' },
      { id: 'log', name: 'だんろの ある ログハウス リビング', floor: 'wood', base: '#c08a57', line: '#8e5f36', main: '#c0392b', accent: '#f39c12', variant: 'fireplace' },
    ],
  },
  {
    id: 'dining', name: 'ダイニング', short: 'ダイニング',
    sizes: { s: [2, 2], m: [3, 2], l: [3, 3] },
    styles: [
      { id: 'wood', name: 'もくめの ダイニング', floor: 'wood', base: '#f0d6aa', line: '#cfa874', main: '#a0673a', accent: '#f6e7c8' },
      { id: 'round', name: 'まるい テーブルの ダイニング', floor: 'tile', base: '#fdf6e3', line: '#e6dcc0', main: '#ffffff', accent: '#e07a5f', variant: 'round' },
      { id: 'cafe', name: 'カフェみたいな ダイニング', floor: 'checker', base: '#f5f5f5', line: '#3a3a3a', main: '#6f4e37', accent: '#e9c46a', variant: 'cafe' },
    ],
  },
  {
    id: 'kitchen', name: 'キッチン', short: 'キッチン',
    sizes: { s: [2, 2], m: [3, 2], l: [4, 2] },
    styles: [
      { id: 'cafe', name: 'カフェふうの キッチン', floor: 'tile', base: '#fff4e0', line: '#e8c9a0', main: '#c98b54', accent: '#2a9d8f' },
      { id: 'steel', name: 'ピカピカ ステンレスの キッチン', floor: 'tile', base: '#e8edf2', line: '#c5cfd8', main: '#b8c2cc', accent: '#3a86ff' },
      { id: 'island', name: 'しまの ある アイランド キッチン', floor: 'wood', base: '#f3e3c9', line: '#d8bf95', main: '#ffffff', accent: '#ff8fab', variant: 'island' },
      { id: 'retro', name: 'レトロな タイルの キッチン', floor: 'checker', base: '#fff8ec', line: '#ffcf99', main: '#e76f51', accent: '#2a9d8f' },
    ],
  },
  {
    id: 'bath', name: 'おふろ', short: 'おふろ',
    sizes: { s: [2, 2], m: [3, 2], l: [3, 3] },
    styles: [
      { id: 'hinoki', name: 'ひのきの おふろ', floor: 'wood', base: '#e9d6ab', line: '#c9b07a', main: '#e1b97a', accent: '#7ec8e3', variant: 'hinoki' },
      { id: 'tile', name: 'しろい タイルの おふろ', floor: 'tile', base: '#f4f9fb', line: '#cfe3ea', main: '#ffffff', accent: '#8ed1f0' },
      { id: 'bubble', name: 'あわあわ ジャグジーの おふろ', floor: 'tile', base: '#e6f0ff', line: '#c4d7f5', main: '#ffffff', accent: '#b39ddb', variant: 'bubble' },
      { id: 'onsen', name: 'いわぶろの おんせん', floor: 'stone', base: '#bdb6aa', line: '#8d867a', main: '#8d8579', accent: '#9ad7d6', variant: 'onsen' },
    ],
  },
  {
    id: 'toilet', name: 'トイレ', short: 'トイレ',
    sizes: { s: [1, 1], m: [1, 2], l: [2, 2] },
    styles: [
      { id: 'simple', name: 'シンプルな トイレ', floor: 'tile', base: '#f5f5f5', line: '#dcdcdc', main: '#ffffff', accent: '#9ec9e2' },
      { id: 'flower', name: 'おはなの トイレ', floor: 'tile', base: '#ffe8f0', line: '#ffc8dc', main: '#ffffff', accent: '#ff7aa8', variant: 'flower' },
      { id: 'hotel', name: 'ホテルみたいな トイレ', floor: 'marble', base: '#45455a', line: '#6a6a82', main: '#ffffff', accent: '#d4af37' },
      { id: 'forest', name: 'もりの トイレ', floor: 'wood', base: '#dcc39e', line: '#b89a6e', main: '#ffffff', accent: '#6ab04c', variant: 'plant' },
    ],
  },
  {
    id: 'washroom', name: 'せんめんじょ', short: 'せんめん',
    sizes: { s: [1, 2], m: [2, 2], l: [3, 2] },
    styles: [
      { id: 'white', name: 'まっしろな せんめんじょ', floor: 'tile', base: '#f7f7f7', line: '#dedede', main: '#ffffff', accent: '#74b9ff' },
      { id: 'marine', name: 'マリンな せんめんじょ', floor: 'tile', base: '#e3f2fd', line: '#90caf9', main: '#ffffff', accent: '#1e88e5', variant: 'marine' },
      { id: 'wood', name: 'もくせいの せんめんじょ', floor: 'wood', base: '#e6cfa7', line: '#c7a878', main: '#b07d48', accent: '#81c784' },
    ],
  },
  {
    id: 'bedroom', name: 'しんしつ', short: 'しんしつ',
    sizes: { s: [2, 2], m: [3, 2], l: [3, 3] },
    styles: [
      { id: 'fluffy', name: 'ふかふか ベッドの しんしつ', floor: 'carpet', base: '#efe6ff', line: '#d9c8f7', main: '#ffffff', accent: '#9b7ede' },
      { id: 'princess', name: 'おひめさまの しんしつ', floor: 'carpet', base: '#ffe4ef', line: '#ffc6dc', main: '#ffffff', accent: '#ff8fb8', variant: 'canopy' },
      { id: 'hotel', name: 'ホテルみたいな しんしつ', floor: 'wood', base: '#c8b39b', line: '#a8917a', main: '#ffffff', accent: '#34495e', variant: 'twin' },
      { id: 'starry', name: 'ほしぞらの しんしつ', floor: 'carpet', base: '#1f2a5a', line: '#2c3a74', main: '#ffffff', accent: '#ffd54f', variant: 'stars' },
    ],
  },
  {
    id: 'kids', name: 'こどもべや', short: 'こども',
    sizes: { s: [2, 2], m: [3, 2], l: [3, 3] },
    styles: [
      { id: 'space', name: 'うちゅうの こどもべや', floor: 'carpet', base: '#1b2845', line: '#274472', main: '#ffffff', accent: '#ff9f1c', variant: 'space' },
      { id: 'flower', name: 'おはなばたけの こどもべや', floor: 'carpet', base: '#e8f8e0', line: '#c5ebb3', main: '#ffffff', accent: '#ff70a6', variant: 'flower' },
      { id: 'dino', name: 'きょうりゅうの こどもべや', floor: 'wood', base: '#e9d8a6', line: '#cbb57d', main: '#ffffff', accent: '#57cc99', variant: 'dino' },
      { id: 'train', name: 'でんしゃの こどもべや', floor: 'carpet', base: '#e3f2fd', line: '#bbdefb', main: '#ffffff', accent: '#ef476f', variant: 'train' },
    ],
  },
  {
    id: 'washitsu', name: 'わしつ', short: 'わしつ',
    sizes: { s: [2, 2], m: [3, 2], l: [3, 3] },
    styles: [
      { id: 'tatami', name: 'たたみの わしつ', floor: 'tatami', base: '#d2e4a3', line: '#a8c06c', main: '#8b5a2b', accent: '#d9534f' },
      { id: 'tea', name: 'おちゃの わしつ', floor: 'tatami', base: '#d9e7af', line: '#b0c47a', main: '#5c3d2e', accent: '#2e7d32', variant: 'tea' },
      { id: 'kotatsu', name: 'こたつの わしつ', floor: 'tatami', base: '#dbe9ab', line: '#b4c97c', main: '#e76f51', accent: '#f4a261', variant: 'kotatsu' },
      { id: 'tokonoma', name: 'かけじくの わしつ', floor: 'tatami', base: '#cde09b', line: '#a3ba66', main: '#6d4c41', accent: '#ef5350', variant: 'tokonoma' },
    ],
  },
  {
    id: 'entrance', name: 'げんかん', short: 'げんかん',
    sizes: { s: [1, 1], m: [2, 1], l: [2, 2] },
    styles: [
      { id: 'stone', name: 'いしだたみの げんかん', floor: 'stone', base: '#d3ccc1', line: '#a39a8c', main: '#8d6e63', accent: '#e57373' },
      { id: 'wood', name: 'きの げんかん', floor: 'wood', base: '#e3c194', line: '#c19a6b', main: '#a1887f', accent: '#64b5f6' },
      { id: 'tile', name: 'タイルの げんかん', floor: 'checker', base: '#ffffff', line: '#b0bec5', main: '#78909c', accent: '#ffb74d' },
    ],
  },
  {
    id: 'stairs', name: 'かいだん', short: 'かいだん',
    sizes: { s: [1, 2], m: [1, 3], l: [2, 2] },
    styles: [
      { id: 'wood', name: 'きの かいだん', floor: 'wood', base: '#e0bb8a', line: '#b98e5b', main: '#c49a6c', accent: '#8d6e63' },
      { id: 'white', name: 'しろい かいだん', floor: 'tile', base: '#fafafa', line: '#e0e0e0', main: '#ffffff', accent: '#90a4ae' },
      { id: 'spiral', name: 'くるくる らせんかいだん', floor: 'tile', base: '#eceff1', line: '#cfd8dc', main: '#b0bec5', accent: '#546e7a', variant: 'spiral' },
    ],
  },
  {
    id: 'hall', name: 'ろうか', short: 'ろうか',
    sizes: { s: [1, 2], m: [1, 3], l: [1, 4] },
    styles: [
      { id: 'wood', name: 'きの ろうか', floor: 'wood', base: '#ecd3ac', line: '#cdb083', main: '#a1887f', accent: '#ffcc80' },
      { id: 'runner', name: 'あかい じゅうたんの ろうか', floor: 'wood', base: '#e2c49a', line: '#c4a273', main: '#a1887f', accent: '#c62828', variant: 'runner' },
      { id: 'shiny', name: 'ピカピカの ろうか', floor: 'marble', base: '#f5f5f5', line: '#e0e0e0', main: '#bdbdbd', accent: '#64b5f6' },
    ],
  },
]

// ---------------- そとがわ ----------------

export type ExteriorOption<Id extends string> = { id: Id; name: string }

export type WallId = 'white' | 'brick' | 'wood' | 'pink' | 'sky' | 'log' | 'wa' | 'stone'
export type WallKind = 'plain' | 'brick' | 'siding' | 'log' | 'wa' | 'stone'
export const WALLS: readonly (ExteriorOption<WallId> & { kind: WallKind; base: string; line: string })[] = [
  { id: 'white', name: 'しろい かべ', kind: 'plain', base: '#fbf8f0', line: '#e2dccd' },
  { id: 'brick', name: 'レンガの かべ', kind: 'brick', base: '#c4593b', line: '#f1d6c8' },
  { id: 'wood', name: 'きの かべ', kind: 'siding', base: '#cf9a62', line: '#9c6a3a' },
  { id: 'pink', name: 'ピンクの かべ', kind: 'plain', base: '#ffd1dc', line: '#f2adc0' },
  { id: 'sky', name: 'みずいろの かべ', kind: 'siding', base: '#bfe3f7', line: '#8fc3e3' },
  { id: 'log', name: 'まるたの かべ', kind: 'log', base: '#b07440', line: '#7a4a24' },
  { id: 'wa', name: 'わふうの かべ', kind: 'wa', base: '#f6f1e4', line: '#3b3330' },
  { id: 'stone', name: 'いしづみの かべ', kind: 'stone', base: '#d8d3ca', line: '#a39d93' },
]

export type RoofId = 'red' | 'blue' | 'choco' | 'kawara' | 'flat' | 'tongari'
export type RoofKind = 'gable' | 'kawara' | 'flat' | 'steep'
export const ROOFS: readonly (ExteriorOption<RoofId> & { kind: RoofKind; color: string; dark: string })[] = [
  { id: 'red', name: 'あかい さんかく やね', kind: 'gable', color: '#d9493b', dark: '#a3302a' },
  { id: 'blue', name: 'あおい さんかく やね', kind: 'gable', color: '#3f7cc8', dark: '#2a5893' },
  { id: 'choco', name: 'チョコいろの やね', kind: 'gable', color: '#80502e', dark: '#57331b' },
  { id: 'kawara', name: 'かわらの やね', kind: 'kawara', color: '#5d6771', dark: '#3a424b' },
  { id: 'flat', name: 'たいらな やね', kind: 'flat', color: '#8a939b', dark: '#5f676e' },
  { id: 'tongari', name: 'とんがり やね', kind: 'steep', color: '#4caf7a', dark: '#2f8256' },
]

export type WindowId = 'square' | 'round' | 'arch' | 'shoji' | 'flowerbox'
export const WINDOWS: readonly ExteriorOption<WindowId>[] = [
  { id: 'square', name: 'しかくい まど' },
  { id: 'round', name: 'まるい まど' },
  { id: 'arch', name: 'アーチの まど' },
  { id: 'shoji', name: 'しょうじの まど' },
  { id: 'flowerbox', name: 'はなかざりの まど' },
]

export type DoorId = 'wood' | 'red' | 'white' | 'slide' | 'round'
export const DOORS: readonly (ExteriorOption<DoorId> & { color: string })[] = [
  { id: 'wood', name: 'きの ドア', color: '#a0673a' },
  { id: 'red', name: 'あかい ドア', color: '#d64545' },
  { id: 'white', name: 'しろい ドア', color: '#f4f4f4' },
  { id: 'slide', name: 'がらがら ひきど', color: '#8b6b4a' },
  { id: 'round', name: 'まるい ドア', color: '#3f8f5a' },
]

export type ParkingId = 'none' | 'red' | 'blue' | 'two' | 'garage'
export const PARKINGS: readonly ExteriorOption<ParkingId>[] = [
  { id: 'none', name: 'なし' },
  { id: 'red', name: 'あかい くるま' },
  { id: 'blue', name: 'あおい くるま' },
  { id: 'two', name: 'くるま 2だい' },
  { id: 'garage', name: 'やねつき ガレージ' },
]

export type DoghouseId = 'none' | 'red' | 'blue' | 'log'
export const DOGHOUSES: readonly ExteriorOption<DoghouseId>[] = [
  { id: 'none', name: 'なし' },
  { id: 'red', name: 'あかい やねの いぬごや' },
  { id: 'blue', name: 'あおい やねの いぬごや' },
  { id: 'log', name: 'まるたの いぬごや' },
]

export type GardenId = 'none' | 'flowers' | 'trees' | 'veggies' | 'pond'
export const GARDENS: readonly ExteriorOption<GardenId>[] = [
  { id: 'none', name: 'なし' },
  { id: 'flowers', name: 'おはなばたけ' },
  { id: 'trees', name: 'きが いっぱい' },
  { id: 'veggies', name: 'やさいの はたけ' },
  { id: 'pond', name: 'おさかなの いけ' },
]

export type ExtraId = 'mailbox' | 'bike' | 'swing' | 'chimney' | 'solar' | 'fence' | 'koinobori' | 'balcony'
export const EXTRAS: readonly ExteriorOption<ExtraId>[] = [
  { id: 'mailbox', name: 'ポスト' },
  { id: 'bike', name: 'じてんしゃ' },
  { id: 'swing', name: 'ブランコ' },
  { id: 'chimney', name: 'えんとつ' },
  { id: 'solar', name: 'ソーラーパネル' },
  { id: 'fence', name: 'さく' },
  { id: 'koinobori', name: 'こいのぼり' },
  { id: 'balcony', name: 'ベランダ' },
]

export type Exterior = {
  wall: WallId
  roof: RoofId
  window: WindowId
  door: DoorId
  parking: ParkingId
  doghouse: DoghouseId
  garden: GardenId
  extras: readonly ExtraId[]
}

export const DEFAULT_EXTERIOR: Exterior = {
  wall: 'white', roof: 'red', window: 'square', door: 'wood', parking: 'none', doghouse: 'none', garden: 'none', extras: [],
}

// ---------------- さがす ----------------

export const findHouseType = (id: HouseTypeId) => HOUSE_TYPES.find((t) => t.id === id) ?? HOUSE_TYPES[0]
export const findShape = (id: ShapeId) => SHAPES.find((s) => s.id === id) ?? SHAPES[0]
export const findRoomType = (id: RoomTypeId) => ROOM_TYPES.find((t) => t.id === id) ?? ROOM_TYPES[0]
export const findRoomStyle = (type: RoomTypeId, style: string) => {
  const room = findRoomType(type)
  return room.styles.find((s) => s.id === style) ?? room.styles[0]
}
export const findWall = (id: WallId) => WALLS.find((w) => w.id === id) ?? WALLS[0]
export const findRoof = (id: RoofId) => ROOFS.find((r) => r.id === id) ?? ROOFS[0]
export const findDoor = (id: DoorId) => DOORS.find((d) => d.id === id) ?? DOORS[0]
