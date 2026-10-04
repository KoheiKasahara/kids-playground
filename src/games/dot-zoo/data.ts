// どうぶつえんの データ（どうぶつ・おくもの・えさ・おける かず）。

export type SpeciesId = 'lion' | 'tiger' | 'elephant' | 'giraffe' | 'zebra' | 'hippo' | 'panda' | 'monkey' | 'rabbit' | 'penguin'
  | 'bear' | 'kangaroo' | 'crocodile' | 'flamingo' | 'eagle' | 'koala' | 'rhino' | 'capybara'
export type ObjectKind = 'tree' | 'palm' | 'bamboo' | 'bush' | 'rock' | 'flowers' | 'lamp' | 'pond'
export type FoodKind = 'meat' | 'grass' | 'fish' | 'fruit'

export type SpeciesDef = {
  id: SpeciesId
  name: string
  /** おける かず。 */
  limit: number
  /** たべる もの。 */
  eats: readonly FoodKind[]
  /** そばに あると うれしい もの。 */
  likes: readonly ObjectKind[]
  /** いけに はいれる。 */
  swims?: boolean
  /** そらを とべる（ときどき はばたいて、きや いわに とまる）。 */
  flies?: boolean
  /** いけが ないと おけない。 */
  needsPond?: boolean
  /** あるく はやさ（マス/びょう）。 */
  speed: number
  /** 画面での 大きさ（ぶつからない ための はんけい）。 */
  radius: number
  /** とくいな しぐさ。 */
  act: string
}

export const SPECIES: readonly SpeciesDef[] = [
  { id: 'lion', name: 'ライオン', limit: 2, eats: ['meat'], likes: ['rock'], speed: .7, radius: .45, act: 'ガオー！' },
  { id: 'tiger', name: 'トラ', limit: 2, eats: ['meat'], likes: ['bush', 'pond'], speed: .75, radius: .45, act: 'ガルル！' },
  { id: 'elephant', name: 'ゾウ', limit: 1, eats: ['grass', 'fruit'], likes: ['pond'], speed: .45, radius: .6, act: 'パオーン！' },
  { id: 'giraffe', name: 'キリン', limit: 1, eats: ['grass'], likes: ['tree'], speed: .55, radius: .5, act: 'のびー' },
  { id: 'zebra', name: 'シマウマ', limit: 3, eats: ['grass'], likes: ['flowers'], speed: .85, radius: .45, act: 'ヒヒーン！' },
  { id: 'hippo', name: 'カバ', limit: 1, eats: ['grass', 'fruit'], likes: ['pond'], swims: true, needsPond: true, speed: .4, radius: .55, act: 'あーん' },
  { id: 'panda', name: 'パンダ', limit: 2, eats: ['grass'], likes: ['bamboo'], speed: .4, radius: .4, act: 'ころりん' },
  { id: 'monkey', name: 'サル', limit: 3, eats: ['fruit'], likes: ['tree', 'palm'], speed: .9, radius: .3, act: 'ウキキッ！' },
  { id: 'rabbit', name: 'ウサギ', limit: 4, eats: ['grass', 'fruit'], likes: ['flowers', 'bush'], speed: .8, radius: .25, act: 'ぴょーん' },
  { id: 'penguin', name: 'ペンギン', limit: 4, eats: ['fish'], likes: ['pond'], swims: true, needsPond: true, speed: .5, radius: .28, act: 'パタパタ' },
  { id: 'bear', name: 'クマ', limit: 2, eats: ['fish', 'fruit'], likes: ['tree', 'rock'], speed: .55, radius: .45, act: 'ガオッ' },
  { id: 'kangaroo', name: 'カンガルー', limit: 2, eats: ['grass'], likes: ['bush', 'flowers'], speed: .95, radius: .35, act: 'ぴょんぴょん' },
  { id: 'crocodile', name: 'ワニ', limit: 2, eats: ['meat', 'fish'], likes: ['pond', 'rock'], swims: true, speed: .35, radius: .5, act: 'パクッ！' },
  { id: 'flamingo', name: 'フラミンゴ', limit: 4, eats: ['fish'], likes: ['pond', 'flowers'], swims: true, speed: .6, radius: .25, act: 'かたあし' },
  { id: 'eagle', name: 'ワシ', limit: 2, eats: ['meat', 'fish'], likes: ['tree', 'palm', 'rock'], flies: true, speed: .6, radius: .3, act: 'ピーヒョロロ！' },
  { id: 'koala', name: 'コアラ', limit: 2, eats: ['grass'], likes: ['tree'], speed: .3, radius: .3, act: 'ぎゅっ' },
  { id: 'rhino', name: 'サイ', limit: 1, eats: ['grass'], likes: ['rock', 'pond'], speed: .45, radius: .55, act: 'ドスン！' },
  { id: 'capybara', name: 'カピバラ', limit: 3, eats: ['grass', 'fruit'], likes: ['pond', 'flowers'], swims: true, speed: .45, radius: .38, act: 'まったり' },
]

export type ObjectDef = {
  kind: ObjectKind
  name: string
  limit: number
  /** しめる マス（よこ × たて）。 */
  size: number
  /** どうぶつが とおれない。 */
  blocks: boolean
}

export const OBJECTS: readonly ObjectDef[] = [
  { kind: 'tree', name: 'き', limit: 8, size: 1, blocks: true },
  { kind: 'palm', name: 'やしのき', limit: 6, size: 1, blocks: true },
  { kind: 'bamboo', name: 'たけ', limit: 4, size: 1, blocks: true },
  { kind: 'bush', name: 'しげみ', limit: 8, size: 1, blocks: true },
  { kind: 'rock', name: 'いわ', limit: 6, size: 1, blocks: true },
  { kind: 'flowers', name: 'はなばたけ', limit: 8, size: 1, blocks: false },
  { kind: 'pond', name: 'いけ', limit: 2, size: 3, blocks: false },
  { kind: 'lamp', name: 'あかり', limit: 4, size: 1, blocks: true },
]

export const FOODS: readonly { kind: FoodKind; name: string }[] = [
  { kind: 'meat', name: 'おにく' },
  { kind: 'grass', name: 'くさ' },
  { kind: 'fish', name: 'さかな' },
  { kind: 'fruit', name: 'くだもの' },
]

/** かこいの 大きさ（マス）。 */
export const GRID = 12
/** どうぶつは ぜんぶで なんとうまで。 */
export const MAX_ANIMALS = 12
/** どうぶつ いがいの ものは ぜんぶで いくつまで。 */
export const MAX_OBJECTS = 30
/** えさは いちどに いくつまで。 */
export const MAX_FOODS = 6

export const speciesById = new Map(SPECIES.map(s => [s.id, s]))
export const objectByKind = new Map(OBJECTS.map(o => [o.kind, o]))
export const foodByKind = new Map(FOODS.map(f => [f.kind, f]))

export function speciesDef(id: SpeciesId) {
  return speciesById.get(id)!
}
export function objectDef(kind: ObjectKind) {
  return objectByKind.get(kind)!
}
export function foodName(kind: FoodKind) {
  return foodByKind.get(kind)!.name
}
