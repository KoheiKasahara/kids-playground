// かいてんずしの マスターデータ。えらべる かたち・シャリ・ネタ・トッピング・おさら・おきゃくさん・たからもの。
// 色は こい → あかるい の 5だん（Ramp）で もち、sushiArt.ts が この 色で ドット絵を かく。

import type { Ramp } from './pixel'

export type StyleId = 'nigiri' | 'gunkan' | 'maki' | 'temaki'
export type RiceId = 'shiro' | 'aka' | 'goma' | 'sakura' | 'kuro'
export type NetaId =
  | 'maguro' | 'toro' | 'salmon' | 'hamachi' | 'ebi' | 'ika' | 'tako' | 'tamago'
  | 'unagi' | 'ikura' | 'uni' | 'corn' | 'negitoro' | 'kyuri' | 'natto' | 'hamburg'
export type ToppingId = 'wasabi' | 'negi' | 'mayo' | 'tare' | 'lemon' | 'shiso' | 'kinpaku' | 'aburi'
export type PlateId = 'ao' | 'aka' | 'kiiro' | 'midori' | 'kuro' | 'kin'
export type AnimalId = 'neko' | 'inu' | 'usagi' | 'kuma' | 'pengin'
export type PrizeId =
  | 'maneki' | 'daruma' | 'koma' | 'kendama' | 'furin' | 'chochin'
  | 'koinobori' | 'denden' | 'taiyaki' | 'ramune' | 'temari' | 'kinsushi'

/**
 * ネタの かたち。
 * slice: うすく きった きりみ / block: あつみの ある かたまり / grain: つぶつぶ / paste: たたいた もの / veg: やさい
 */
export type NetaForm = 'slice' | 'block' | 'grain' | 'paste' | 'veg'

export type StyleDef = { id: StyleId; name: string }
export type RiceDef = { id: RiceId; name: string; ramp: Ramp }
export type NetaDef = { id: NetaId; name: string; form: NetaForm; ramp: Ramp }
export type ToppingDef = { id: ToppingId; name: string }
export type PlateDef = { id: PlateId; name: string; ramp: Ramp; rim: string }
export type AnimalDef = { id: AnimalId; name: string; likes: readonly NetaId[] }
export type PrizeDef = { id: PrizeId; name: string; rare?: boolean }

export const STYLES: readonly StyleDef[] = [
  { id: 'nigiri', name: 'にぎり' },
  { id: 'gunkan', name: 'ぐんかん' },
  { id: 'maki', name: 'まきもの' },
  { id: 'temaki', name: 'てまき' },
]

export const RICES: readonly RiceDef[] = [
  { id: 'shiro', name: 'しろ', ramp: ['#8a8070', '#c4bcaa', '#e6e0d2', '#f7f4ea', '#ffffff'] },
  { id: 'aka', name: 'あか', ramp: ['#6e4632', '#a8785c', '#cfa284', '#e6c4a8', '#f6e2cc'] },
  { id: 'goma', name: 'ごま', ramp: ['#857a68', '#bfb6a0', '#e2dbc8', '#f4f0e2', '#fffdf6'] },
  { id: 'sakura', name: 'さくら', ramp: ['#94485e', '#d27e98', '#eeaabe', '#f9ccda', '#fff0f5'] },
  { id: 'kuro', name: 'くろ', ramp: ['#1e0e24', '#3e2246', '#5e3a68', '#80588a', '#a982b2'] },
]

export const NETAS: readonly NetaDef[] = [
  { id: 'maguro', name: 'まぐろ', form: 'slice', ramp: ['#4a0614', '#8c1224', '#c82436', '#e84c5c', '#ff96a0'] },
  { id: 'toro', name: 'とろ', form: 'slice', ramp: ['#6a1c2c', '#b4465a', '#de7a8c', '#f2a8b6', '#ffdce4'] },
  { id: 'salmon', name: 'サーモン', form: 'slice', ramp: ['#7a2a0e', '#d0522a', '#f2844a', '#ffad78', '#ffdcc4'] },
  { id: 'hamachi', name: 'はまち', form: 'slice', ramp: ['#7a4c44', '#c2928a', '#e6c2b6', '#f5ddd2', '#fff5f0'] },
  { id: 'ebi', name: 'えび', form: 'slice', ramp: ['#8a3a20', '#d86a40', '#f4a070', '#fcd2b4', '#fff4ea'] },
  { id: 'ika', name: 'いか', form: 'slice', ramp: ['#7c8a96', '#bac6d0', '#dfe6ec', '#f3f6f9', '#ffffff'] },
  { id: 'tako', name: 'たこ', form: 'slice', ramp: ['#4a0c22', '#86203e', '#b8405c', '#e4b4b8', '#fff2ee'] },
  { id: 'tamago', name: 'たまご', form: 'block', ramp: ['#7a5206', '#c69614', '#eec436', '#ffe070', '#fff6b4'] },
  { id: 'unagi', name: 'うなぎ', form: 'slice', ramp: ['#24100a', '#52260e', '#86461a', '#b6702c', '#e2a454'] },
  { id: 'ikura', name: 'いくら', form: 'grain', ramp: ['#640a04', '#be2808', '#ee5818', '#ff9040', '#ffe0b0'] },
  { id: 'uni', name: 'うに', form: 'grain', ramp: ['#7a3a04', '#cc760c', '#f2a41a', '#ffc94a', '#fff0a4'] },
  { id: 'corn', name: 'コーン', form: 'grain', ramp: ['#7a5800', '#cea200', '#f4d01e', '#ffe866', '#fffcc0'] },
  { id: 'negitoro', name: 'ねぎとろ', form: 'paste', ramp: ['#742838', '#be586c', '#e6889a', '#f5b2be', '#ffe0e6'] },
  { id: 'kyuri', name: 'きゅうり', form: 'veg', ramp: ['#0c2a0a', '#285612', '#4c8822', '#80b844', '#c6e48a'] },
  { id: 'natto', name: 'なっとう', form: 'grain', ramp: ['#341c06', '#663e12', '#986828', '#c49850', '#ead092'] },
  { id: 'hamburg', name: 'ハンバーグ', form: 'block', ramp: ['#220e06', '#522a12', '#844c28', '#b07844', '#d8a868'] },
]

export const TOPPINGS: readonly ToppingDef[] = [
  { id: 'wasabi', name: 'わさび' },
  { id: 'negi', name: 'ねぎ' },
  { id: 'mayo', name: 'マヨ' },
  { id: 'tare', name: 'たれ' },
  { id: 'lemon', name: 'レモン' },
  { id: 'shiso', name: 'しそ' },
  { id: 'kinpaku', name: 'きんぱく' },
  { id: 'aburi', name: 'あぶり' },
]

/** トッピングは 3つまで。おおすぎると おすしが みえなくなる。 */
export const MAX_TOPPINGS = 3

export const PLATES: readonly PlateDef[] = [
  { id: 'ao', name: 'あお', ramp: ['#0e2a66', '#1c4ca8', '#3478dc', '#6aa8f4', '#b4dcff'], rim: '#ffffff' },
  { id: 'aka', name: 'あか', ramp: ['#5a0a12', '#a41824', '#d8343a', '#f46a60', '#ffb4a4'], rim: '#ffffff' },
  { id: 'kiiro', name: 'きいろ', ramp: ['#7a5000', '#c88e00', '#f2c218', '#ffe060', '#fff6b8'], rim: '#ffffff' },
  { id: 'midori', name: 'みどり', ramp: ['#0c3a1c', '#1c7034', '#34a44c', '#6ed07a', '#bcf0b8'], rim: '#ffffff' },
  { id: 'kuro', name: 'くろ', ramp: ['#0a0810', '#1a1622', '#2c2636', '#463e52', '#6c6278'], rim: '#e8b838' },
  { id: 'kin', name: 'きん', ramp: ['#6a3a04', '#b07010', '#e4a820', '#ffd64c', '#fff6b0'], rim: '#fffbe0' },
]

export const ANIMALS: readonly AnimalDef[] = [
  { id: 'neko', name: 'ねこ', likes: ['maguro', 'toro', 'salmon', 'ikura'] },
  { id: 'inu', name: 'いぬ', likes: ['hamburg', 'tamago', 'ebi', 'maguro'] },
  { id: 'usagi', name: 'うさぎ', likes: ['kyuri', 'corn', 'tamago', 'natto'] },
  { id: 'kuma', name: 'くま', likes: ['salmon', 'ikura', 'uni', 'unagi'] },
  { id: 'pengin', name: 'ペンギン', likes: ['ika', 'ebi', 'hamachi', 'tako', 'negitoro'] },
]

export const PRIZES: readonly PrizeDef[] = [
  { id: 'maneki', name: 'まねきねこ' },
  { id: 'daruma', name: 'だるま' },
  { id: 'koma', name: 'こま' },
  { id: 'kendama', name: 'けんだま' },
  { id: 'furin', name: 'ふうりん' },
  { id: 'chochin', name: 'ちょうちん' },
  { id: 'koinobori', name: 'こいのぼり' },
  { id: 'denden', name: 'でんでんだいこ' },
  { id: 'taiyaki', name: 'たいやき' },
  { id: 'ramune', name: 'ラムネ' },
  { id: 'temari', name: 'てまり' },
  { id: 'kinsushi', name: 'きんの おすし', rare: true },
]

/** ガチャは おさら 5まいで 1かい。 */
export const PLATES_PER_GACHA = 5

const byId = <T extends { id: string }>(list: readonly T[]) => {
  const map = new Map(list.map(item => [item.id, item]))
  return (id: string) => map.get(id)
}

const findStyle = byId(STYLES)
const findRice = byId(RICES)
const findNeta = byId(NETAS)
const findTopping = byId(TOPPINGS)
const findPlate = byId(PLATES)
const findAnimal = byId(ANIMALS)
const findPrize = byId(PRIZES)

export const riceDef = (id: RiceId) => findRice(id)!
export const netaDef = (id: NetaId) => findNeta(id)!
export const toppingDef = (id: ToppingId) => findTopping(id)!
export const plateDef = (id: PlateId) => findPlate(id)!
export const animalDef = (id: AnimalId) => findAnimal(id)!
export const prizeDef = (id: PrizeId) => findPrize(id)!

export const isStyle = (v: unknown): v is StyleId => typeof v === 'string' && !!findStyle(v)
export const isRice = (v: unknown): v is RiceId => typeof v === 'string' && !!findRice(v)
export const isNeta = (v: unknown): v is NetaId => typeof v === 'string' && !!findNeta(v)
export const isTopping = (v: unknown): v is ToppingId => typeof v === 'string' && !!findTopping(v)
export const isPlate = (v: unknown): v is PlateId => typeof v === 'string' && !!findPlate(v)
export const isPrize = (v: unknown): v is PrizeId => typeof v === 'string' && !!findPrize(v)
