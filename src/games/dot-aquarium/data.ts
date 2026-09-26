// すいそうに いれられる いきもの・もの・えさ の きまり。

export type SpeciesId = 'clown' | 'neon' | 'angel' | 'tang' | 'puffer' | 'seahorse' | 'jelly' | 'crab' | 'eel' | 'turtle' | 'shark'
  | 'octopus' | 'squid' | 'moray' | 'ray'
export type DecorKind = 'kelp' | 'rock' | 'wood' | 'coral' | 'anemone' | 'clam' | 'chest' | 'castle' | 'pot' | 'bubbler'
export type FoodKind = 'flake' | 'pellet' | 'shrimp'

/** いきものが すむ ところ。 */
export type Zone = 'high' | 'mid' | 'low' | 'any' | 'floor' | 'sand'

export type SpeciesDef = {
  id: SpeciesId
  name: string
  /** トレイに だす みじかい なまえ。 */
  short?: string
  /** この しゅるいは なんびき まで。 */
  limit: number
  /** からだの おおきさ（あたりはんてい・うごける はんい）。 */
  w: number
  h: number
  zone: Zone
  /** およぐ はやさ（ドット / びょう）。 */
  speed: number
  eats: readonly FoodKind[]
  likes: readonly DecorKind[]
  /** サメが くると にげる。 */
  small: boolean
  /** むれで およぐ。 */
  school?: boolean
  /** タップした ときの ひとこと。 */
  act: string
}

export const SPECIES: readonly SpeciesDef[] = [
  { id: 'clown', name: 'クマノミ', limit: 6, w: 20, h: 12, zone: 'mid', speed: 18, eats: ['flake', 'shrimp'], likes: ['anemone', 'coral'], small: true, act: 'イソギンチャクが だいすき！' },
  { id: 'neon', name: 'ネオンテトラ', limit: 10, w: 12, h: 6, zone: 'mid', speed: 24, eats: ['flake'], likes: ['kelp', 'wood'], small: true, school: true, act: 'みんなで いっしょに およぐよ' },
  { id: 'angel', name: 'エンゼルフィッシュ', short: 'エンゼル', limit: 4, w: 18, h: 22, zone: 'mid', speed: 11, eats: ['flake', 'shrimp'], likes: ['wood', 'kelp'], small: true, act: 'ひらひら ゆうがに およぐよ' },
  { id: 'tang', name: 'ナンヨウハギ', limit: 4, w: 22, h: 14, zone: 'any', speed: 20, eats: ['flake', 'pellet'], likes: ['coral', 'rock'], small: true, act: 'あおくて きれいでしょ' },
  { id: 'puffer', name: 'ハリセンボン', limit: 2, w: 18, h: 14, zone: 'low', speed: 8, eats: ['shrimp', 'pellet'], likes: ['pot', 'coral'], small: false, act: 'ぷくーっ！' },
  { id: 'seahorse', name: 'タツノオトシゴ', limit: 3, w: 10, h: 18, zone: 'mid', speed: 5, eats: ['shrimp'], likes: ['kelp', 'coral'], small: false, act: 'しっぽで つかまるのが とくい' },
  { id: 'jelly', name: 'クラゲ', limit: 4, w: 16, h: 20, zone: 'any', speed: 5, eats: ['flake'], likes: ['bubbler'], small: false, act: 'ふわ〜り ふわ〜り' },
  { id: 'crab', name: 'カニ', limit: 3, w: 18, h: 10, zone: 'floor', speed: 12, eats: ['pellet', 'shrimp'], likes: ['rock', 'pot'], small: false, act: 'チョキチョキ！' },
  { id: 'eel', name: 'チンアナゴ', limit: 5, w: 6, h: 26, zone: 'sand', speed: 0, eats: ['flake'], likes: ['rock', 'clam'], small: false, act: 'すなから こんにちは' },
  { id: 'turtle', name: 'ウミガメ', limit: 1, w: 38, h: 18, zone: 'any', speed: 9, eats: ['shrimp', 'pellet'], likes: ['rock', 'wood'], small: false, act: 'のんびり いこうね' },
  { id: 'shark', name: 'サメ', limit: 1, w: 56, h: 20, zone: 'mid', speed: 15, eats: ['shrimp'], likes: ['castle', 'chest'], small: false, act: 'ぼく やさしい サメだよ' },
  { id: 'octopus', name: 'タコ', limit: 1, w: 28, h: 20, zone: 'low', speed: 7, eats: ['shrimp', 'pellet'], likes: ['pot', 'rock'], small: false, act: 'あしは 8ぽん あるよ' },
  { id: 'squid', name: 'イカ', limit: 3, w: 24, h: 10, zone: 'high', speed: 16, eats: ['shrimp', 'flake'], likes: ['kelp', 'bubbler'], small: true, act: 'すいすい〜っ' },
  { id: 'moray', name: 'ウツボ', limit: 1, w: 40, h: 10, zone: 'low', speed: 8, eats: ['shrimp'], likes: ['rock', 'castle'], small: false, act: 'くちを パクパク。こわくないよ' },
  { id: 'ray', name: 'エイ', limit: 2, w: 30, h: 12, zone: 'low', speed: 10, eats: ['pellet', 'shrimp'], likes: ['clam', 'rock'], small: false, act: 'つばさみたいに ひらひら' },
]

export type DecorDef = {
  kind: DecorKind
  name: string
  limit: number
  /** すなの うえに おいた ときの はば・たかさ。 */
  w: number
  h: number
}

export const DECOR: readonly DecorDef[] = [
  { kind: 'kelp', name: 'かいそう', limit: 6, w: 14, h: 70 },
  { kind: 'rock', name: 'いわ', limit: 4, w: 32, h: 20 },
  { kind: 'wood', name: 'りゅうぼく', limit: 2, w: 62, h: 40 },
  { kind: 'coral', name: 'サンゴ', limit: 4, w: 28, h: 28 },
  { kind: 'anemone', name: 'イソギンチャク', limit: 2, w: 24, h: 18 },
  { kind: 'clam', name: 'シャコガイ', limit: 2, w: 22, h: 12 },
  { kind: 'chest', name: 'たからばこ', limit: 1, w: 22, h: 17 },
  { kind: 'castle', name: 'おしろ', limit: 1, w: 42, h: 50 },
  { kind: 'pot', name: 'つぼ', limit: 2, w: 18, h: 22 },
  { kind: 'bubbler', name: 'ぶくぶく', limit: 2, w: 12, h: 6 },
]

export type FoodDef = {
  kind: FoodKind
  name: string
  /** いちどに おちる かず。 */
  count: number
  /** しずむ はやさ。 */
  sink: number
  /** おなかが どれだけ ふくれるか。 */
  fill: number
}

export const FOODS: readonly FoodDef[] = [
  { kind: 'flake', name: 'フレーク', count: 6, sink: 6, fill: .14 },
  { kind: 'pellet', name: 'つぶえさ', count: 3, sink: 22, fill: .24 },
  { kind: 'shrimp', name: 'エビ', count: 1, sink: 12, fill: .5 },
]

/** いきもの ぜんぶで。 */
export const MAX_CREATURES = 20
/** もの ぜんぶで。 */
export const MAX_DECOR = 16

const speciesMap = new Map(SPECIES.map(s => [s.id, s]))
const decorMap = new Map(DECOR.map(d => [d.kind, d]))
const foodMap = new Map(FOODS.map(f => [f.kind, f]))

export function speciesDef(id: SpeciesId): SpeciesDef {
  return speciesMap.get(id)!
}

export function decorDef(kind: DecorKind): DecorDef {
  return decorMap.get(kind)!
}

export function foodDef(kind: FoodKind): FoodDef {
  return foodMap.get(kind)!
}

export function isSpecies(v: unknown): v is SpeciesId {
  return typeof v === 'string' && speciesMap.has(v as SpeciesId)
}

export function isDecor(v: unknown): v is DecorKind {
  return typeof v === 'string' && decorMap.has(v as DecorKind)
}

/** 「1ぴき・2ひき・3びき」。 */
export function hiki(n: number) {
  const last = n % 10
  if (last === 3) return `${n}びき`
  if (last === 1 || last === 6 || last === 8 || last === 0) return `${n}ぴき`
  return `${n}ひき`
}
