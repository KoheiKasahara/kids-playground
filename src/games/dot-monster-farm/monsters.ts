// モンスターの しゅるい・のうりょく・わざ。絵（ドット）は sprites.ts、そだてかたは farm.ts。
// ことばから モンスターを よびだす しくみも ここに おく（おなじ ことばなら いつも おなじ モンスター）。

import { hashText, rng } from './pixel'

export type StatKey = 'life' | 'pow' | 'int' | 'spd' | 'def'
export type Stats = Record<StatKey, number>

export const STAT_KEYS: readonly StatKey[] = ['life', 'pow', 'int', 'spd', 'def']
export const STAT_LABEL: Record<StatKey, string> = { life: 'いのち', pow: 'ちから', int: 'かしこさ', spd: 'すばやさ', def: 'まもり' }
/** のうりょくの うえの かぎり。 */
export const STAT_MAX = 999

export type SnackId = 'meat' | 'fish' | 'fruit' | 'cookie'
export const SNACKS: readonly { id: SnackId; name: string }[] = [
  { id: 'meat', name: 'おにく' },
  { id: 'fish', name: 'おさかな' },
  { id: 'fruit', name: 'くだもの' },
  { id: 'cookie', name: 'クッキー' },
]

/** わざの みため。 */
export type FxKind = 'bubble' | 'fire' | 'leaf' | 'rock' | 'feather' | 'wisp' | 'punch' | 'beam'

export type Tech = {
  name: string
  /** ちかい（あいてに くっついて）か とおい（はなれて とばす）か。 */
  range: 'near' | 'far'
  /** つよさに つかう のうりょく。 */
  stat: 'pow' | 'int'
  /** つかうのに いる やるき。 */
  guts: number
  /** いりょく。 */
  power: number
  /** あたりやすさの ほせい（-0.2〜+0.1 くらい）。 */
  hit: number
  fx: FxKind
  /** ひっさつわざ。 */
  big?: boolean
}

export type SpeciesId = 'puru' | 'draco' | 'mofu' | 'goron' | 'piko' | 'fuwari'

export type Species = {
  id: SpeciesId
  name: string
  kind: string
  /** よびだす いしの なまえ。 */
  stone: string
  /** いしの いろ。 */
  stoneColor: string
  lead: string
  /** のびやすさ（1が ふつう）。 */
  growth: Stats
  /** うまれた ときの のうりょく。 */
  base: Stats
  likes: SnackId
  /** 1びょうに たまる やるき。 */
  gutsRate: number
  techs: readonly [Tech, Tech, Tech]
  /** なきごえの たかさ（Hz）。 */
  voice: number
  /** ふわふわ ういている（あしが ない）。 */
  floats?: boolean
}

export const SPECIES: readonly Species[] = [
  {
    id: 'puru', name: 'ぷるん', kind: 'スライム', stone: 'みずいろの いし', stoneColor: '#5ab8f0',
    lead: 'ぷるぷるで タフ。いのちが のびやすい',
    growth: { life: 1.5, pow: 1, int: 1, spd: .8, def: 1.2 },
    base: { life: 44, pow: 26, int: 26, spd: 20, def: 32 },
    likes: 'fruit', gutsRate: 12, voice: 620,
    techs: [
      { name: 'ぷにタックル', range: 'near', stat: 'pow', guts: 18, power: 12, hit: .05, fx: 'punch' },
      { name: 'あわ ぶくぶく', range: 'far', stat: 'int', guts: 20, power: 10, hit: .05, fx: 'bubble' },
      { name: 'ぷるぷる プレス', range: 'near', stat: 'pow', guts: 44, power: 26, hit: -.08, fx: 'punch', big: true },
    ],
  },
  {
    id: 'draco', name: 'ドラコ', kind: 'こどもドラゴン', stone: 'あかい いし', stoneColor: '#f05a48',
    lead: 'げんきな ちびドラゴン。ちからが のびやすい',
    growth: { life: 1.2, pow: 1.5, int: .9, spd: 1, def: .9 },
    base: { life: 36, pow: 38, int: 22, spd: 26, def: 24 },
    likes: 'meat', gutsRate: 11, voice: 300,
    techs: [
      { name: 'しっぽ アタック', range: 'near', stat: 'pow', guts: 18, power: 12, hit: 0, fx: 'punch' },
      { name: 'ひのこ', range: 'far', stat: 'int', guts: 20, power: 10, hit: 0, fx: 'fire' },
      { name: 'ほのおの ブレス', range: 'far', stat: 'pow', guts: 46, power: 27, hit: -.1, fx: 'beam', big: true },
    ],
  },
  {
    id: 'mofu', name: 'モフ', kind: 'もふもふ', stone: 'みどりの いし', stoneColor: '#6ad06a',
    lead: 'ながい みみの もふもふ。すばやさが のびやすい',
    growth: { life: 1, pow: .9, int: 1.2, spd: 1.5, def: .9 },
    base: { life: 32, pow: 24, int: 30, spd: 40, def: 22 },
    likes: 'fruit', gutsRate: 13, voice: 820,
    techs: [
      { name: 'みみ ビンタ', range: 'near', stat: 'pow', guts: 16, power: 11, hit: .08, fx: 'punch' },
      { name: 'はっぱ カッター', range: 'far', stat: 'int', guts: 20, power: 10, hit: .05, fx: 'leaf' },
      { name: 'もふもふ ハリケーン', range: 'near', stat: 'int', guts: 44, power: 25, hit: 0, fx: 'leaf', big: true },
    ],
  },
  {
    id: 'goron', name: 'ゴロン', kind: 'いわの こ', stone: 'ちゃいろの いし', stoneColor: '#b08a5a',
    lead: 'かたい いわの からだ。まもりが のびやすい',
    growth: { life: 1.2, pow: 1.2, int: .8, spd: .7, def: 1.6 },
    base: { life: 40, pow: 34, int: 18, spd: 14, def: 44 },
    likes: 'cookie', gutsRate: 10, voice: 200,
    techs: [
      { name: 'いわ パンチ', range: 'near', stat: 'pow', guts: 18, power: 13, hit: 0, fx: 'punch' },
      { name: 'いわ おとし', range: 'far', stat: 'pow', guts: 22, power: 11, hit: -.05, fx: 'rock' },
      { name: 'ごろごろ アタック', range: 'near', stat: 'pow', guts: 46, power: 28, hit: -.1, fx: 'punch', big: true },
    ],
  },
  {
    id: 'piko', name: 'ピコ', kind: 'ことり', stone: 'きいろい いし', stoneColor: '#f8d040',
    lead: 'すばしっこい ことり。よけるのが とくい',
    growth: { life: 1.1, pow: 1.1, int: 1.1, spd: 1.5, def: 1 },
    base: { life: 38, pow: 30, int: 28, spd: 38, def: 26 },
    likes: 'fish', gutsRate: 15, voice: 1100,
    techs: [
      { name: 'つつき', range: 'near', stat: 'pow', guts: 16, power: 12, hit: .1, fx: 'punch' },
      { name: 'はね とばし', range: 'far', stat: 'int', guts: 20, power: 10, hit: .05, fx: 'feather' },
      { name: 'つむじかぜ', range: 'far', stat: 'int', guts: 44, power: 25, hit: 0, fx: 'feather', big: true },
    ],
  },
  {
    id: 'fuwari', name: 'ふわり', kind: 'おばけ', stone: 'むらさきの いし', stoneColor: '#a878e8',
    lead: 'ふわふわ うかぶ おばけ。かしこさが のびやすい',
    growth: { life: .9, pow: .8, int: 1.6, spd: 1.2, def: 1 },
    base: { life: 30, pow: 18, int: 44, spd: 32, def: 26 },
    likes: 'cookie', gutsRate: 13, voice: 520, floats: true,
    techs: [
      { name: 'おどかし', range: 'near', stat: 'int', guts: 18, power: 11, hit: .05, fx: 'punch' },
      { name: 'ひとだま', range: 'far', stat: 'int', guts: 20, power: 11, hit: 0, fx: 'wisp' },
      { name: 'ゆらゆら ビーム', range: 'far', stat: 'int', guts: 46, power: 27, hit: -.05, fx: 'beam', big: true },
    ],
  },
]

export const VARIANTS = 4
/** いろちがい（めずらしい いろ）の ばんごう。 */
export const RARE_VARIANT = 3

export function speciesById(id: string): Species | undefined {
  return SPECIES.find(s => s.id === id)
}

export type Monster = {
  species: SpeciesId
  /** いろの ばんごう（0〜3。3は いろちがい）。 */
  variant: number
  name: string
  stats: Stats
  /** つかれ（0〜100）。 */
  fatigue: number
  /** なかよし（0〜100）。 */
  bond: number
}

/** モンスターを うみだす。のうりょくは しゅるいの きほんに すこし ゆらぎを つける。 */
export function createMonster(species: Species, variant: number, seed: number): Monster {
  const r = rng(seed)
  const stats = {} as Stats
  for (const key of STAT_KEYS) stats[key] = Math.round(species.base[key] * (.9 + r() * .2))
  return { species: species.id, variant, name: species.name, stats, fatigue: 0, bond: 20 }
}

/** いしから よぶ ときの いろ。たまに いろちがいが でる。 */
export function stoneVariant(random: () => number) {
  if (random() < .08) return RARE_VARIANT
  return Math.floor(random() * 3)
}

/** ことばを ととのえる（まえと うしろの くうはく・おおきすぎる ながさ）。 */
export function cleanWord(text: string) {
  return [...text.trim().replace(/\s+/g, ' ')].slice(0, 12).join('')
}

/**
 * ことばから モンスターを よびだす。おなじ ことばなら いつも おなじ しゅるい・いろ・のうりょく。
 * ことばで よぶと いろちがいが すこし でやすい。
 */
export function monsterFromWord(text: string): Monster | null {
  const word = cleanWord(text)
  if (!word) return null
  const seed = hashText(word)
  const r = rng(seed)
  const species = SPECIES[Math.floor(r() * SPECIES.length)]
  const variant = r() < .12 ? RARE_VARIANT : Math.floor(r() * 3)
  const monster = createMonster(species, variant, seed ^ 0x5bd1e995)
  // ことばの ちからで ひとつだけ のうりょくが すこし たかく うまれる。
  const bonus = STAT_KEYS[Math.floor(r() * STAT_KEYS.length)]
  monster.stats[bonus] += 6
  return monster
}

export function statTotal(stats: Stats) {
  return STAT_KEYS.reduce((sum, key) => sum + stats[key], 0)
}
