// ステージの データ。マップは 1もじ＝1マスの もじれつで かく。
//
//   #  まわりの かべ          H  こわれない はしら        .  ゆか（ブロックが おかれるかも）
//   _  ゆか（ブロックを おかない）  s  かならず おく ブロック    P  ポンの スタート
//   D  ゴールの とびら        ~  みず（あるけない。ひは とおる）
//   i  こおりの ゆか（ブロックが おかれるかも）  I  こおり（ブロックを おかない）
//   < > ^ v  ベルトコンベア    o  ひの でる あな          1〜9  ワープつぼ（おなじ すうじどうしで つながる）
//   a〜f  てきの スタート（ステージの enemies で しゅるいを きめる）
//   B  ボスの いる ところ（ボスは 2×2マス。この マスが ひだりうえ）

export type WorldId = 'forest' | 'desert' | 'ice' | 'volcano' | 'castle'
export type RideColor = 'green' | 'blue' | 'pink' | 'yellow'
export type BossKind = 'puni' | 'worm' | 'penguin' | 'dragon' | 'king'
export type EnemyKind =
  | 'puni' | 'tentou' | 'sabo' | 'sasori' | 'yukidama' | 'penguin' | 'obake'
  | 'hinotama' | 'maguman' | 'komori' | 'robo' | 'neji'

export type ItemCounts = Partial<Record<'bomb' | 'fire' | 'speed' | 'heart', number>>

export type StageDef = {
  id: string
  world: WorldId
  /** 「1-1」の ような ばんごう。 */
  no: string
  name: string
  map: readonly string[]
  enemies: Partial<Record<'a' | 'b' | 'c' | 'd' | 'e' | 'f', EnemyKind>>
  boss?: BossKind
  /** '.' と 'i' の マスに ブロックを おく わりあい。 */
  density: number
  items: ItemCounts
  egg: RideColor | null
  /** はじめの ボンの かず・ひの ながさ。 */
  start: { bombs: number; fire: number }
  dark?: boolean
  /** あそびかたの ヒントを だす（さいしょの ステージ）。 */
  tutorial?: boolean
}

export type WorldDef = {
  id: WorldId
  no: number
  name: string
  lead: string
}

export const WORLDS: readonly WorldDef[] = [
  { id: 'forest', no: 1, name: 'みどりの もり', lead: 'プニプニが いっぱい' },
  { id: 'desert', no: 2, name: 'さらさら さばく', lead: 'ワープつぼで ひとっとび' },
  { id: 'ice', no: 3, name: 'つるつる こおりのくに', lead: 'ゆかが すべるよ' },
  { id: 'volcano', no: 4, name: 'ぐらぐら かざん', lead: 'ひの あなに ちゅうい' },
  { id: 'castle', no: 5, name: 'ガラクタじょう', lead: 'ベルトで ながされる' },
]

export const STAGES: readonly StageDef[] = [
  {
    id: '1-1', world: 'forest', no: '1-1', name: 'はじまりの もり', tutorial: true,
    map: [
      '###############',
      '#P__.......a..#',
      '#_H.H.H.H.H.H.#',
      '#_............#',
      '#.H.H.H.H.H.H.#',
      '#......a......#',
      '#.H.H.H.H.H.H.#',
      '#.............#',
      '#.H.H.H.H.H.H.#',
      '#.......D.....#',
      '#.H.H.H.H.H.H.#',
      '#...a.........#',
      '###############',
    ],
    enemies: { a: 'puni' }, density: .5, items: { bomb: 1, fire: 1, speed: 1 }, egg: 'green', start: { bombs: 1, fire: 2 },
  },
  {
    id: '1-2', world: 'forest', no: '1-2', name: 'もりの いけ',
    map: [
      '###############',
      '#P__....a.....#',
      '#_H.H.H.H.H.H.#',
      '#_.....b......#',
      '#.H.H~~~~~H.H.#',
      '#....~~~~~....#',
      '#.H.H~~~~~H.H.#',
      '#a...........a#',
      '#.H.H.H.H.H.H.#',
      '#......b......#',
      '#.H.H.H.H.H.H.#',
      '#....D......a.#',
      '###############',
    ],
    enemies: { a: 'puni', b: 'tentou' }, density: .55, items: { bomb: 1, fire: 1, speed: 1, heart: 1 }, egg: 'green', start: { bombs: 1, fire: 2 },
  },
  {
    id: '1-3', world: 'forest', no: '1-3', name: 'キングプニの ひろば', boss: 'puni',
    map: [
      '###############',
      '#P_.........._#',
      '#_H.........H_#',
      '#.............#',
      '#.............#',
      '#.............#',
      '#......B......#',
      '#.............#',
      '#.............#',
      '#.............#',
      '#_H.........H_#',
      '#_..........._#',
      '###############',
    ],
    enemies: {}, density: .2, items: { bomb: 1, fire: 1, heart: 1 }, egg: 'green', start: { bombs: 2, fire: 2 },
  },
  {
    id: '2-1', world: 'desert', no: '2-1', name: 'ワープつぼの さばく',
    map: [
      '###############',
      '#P__...1....a.#',
      '#_H.H.H.H.H.H.#',
      '#_............#',
      '#.H.H.H.H.H.H.#',
      '#2.....b......#',
      '#.H.H.H.H.H.H.#',
      '#......a.....2#',
      '#.H.H.H.H.H.H.#',
      '#.............#',
      '#.H.H.H.H.H.H.#',
      '#..b...D...1..#',
      '###############',
    ],
    enemies: { a: 'sabo', b: 'sasori' }, density: .55, items: { bomb: 1, fire: 1, speed: 1, heart: 1 }, egg: 'blue', start: { bombs: 2, fire: 2 },
  },
  {
    id: '2-2', world: 'desert', no: '2-2', name: 'ピラミッドの めいろ',
    map: [
      '###############',
      '#P__..H.H..a..#',
      '#_H.H.H.H.H.H.#',
      '#_....H.H.....#',
      '#HHH.HH.HH.HHH#',
      '#......b......#',
      '#.H.H.H1H.H.H.#',
      '#2.....a......#',
      '#HHH.HH.HH.HHH#',
      '#.....H.H.....#',
      '#.H.H.H.H.H.H.#',
      '#a.b..HDH..1.2#',
      '###############',
    ],
    enemies: { a: 'sabo', b: 'sasori' }, density: .5, items: { bomb: 1, fire: 1, speed: 1, heart: 1 }, egg: 'blue', start: { bombs: 2, fire: 2 },
  },
  {
    id: '2-3', world: 'desert', no: '2-3', name: 'ズズの すなば', boss: 'worm',
    map: [
      '###############',
      '#P_.........._#',
      '#_H.........H_#',
      '#.............#',
      '#....H...H....#',
      '#.............#',
      '#......B......#',
      '#.............#',
      '#....H...H....#',
      '#.............#',
      '#_H.........H_#',
      '#_..........._#',
      '###############',
    ],
    enemies: {}, density: .2, items: { bomb: 1, fire: 1, heart: 1 }, egg: 'blue', start: { bombs: 2, fire: 3 },
  },
  {
    id: '3-1', world: 'ice', no: '3-1', name: 'つるつる こおりのうみ',
    map: [
      '###############',
      '#P__..iiii..a.#',
      '#_H.HiHiHiH.H.#',
      '#_...iiiiii...#',
      '#.H.HiHiHiH.H.#',
      '#..b.iiiiii...#',
      '#.HiHiH.HiHiH.#',
      '#.iiiii.a.iiii#',
      '#.HiHiH.HiHiH.#',
      '#..iiii.......#',
      '#.H.H.H.H.H.H.#',
      '#a.....D....b.#',
      '###############',
    ],
    enemies: { a: 'yukidama', b: 'penguin' }, density: .5, items: { bomb: 1, fire: 1, speed: 1, heart: 1 }, egg: 'pink', start: { bombs: 2, fire: 3 },
  },
  {
    id: '3-2', world: 'ice', no: '3-2', name: 'ゆきの めいきゅう',
    map: [
      '###############',
      '#P__...a....c.#',
      '#_H.H.HiH.H.H.#',
      '#_....iii.....#',
      '#.H.HiHiHiH.H.#',
      '#...iiiiiii..b#',
      '#.H.HiH_HiH.H.#',
      '#c..iii_iii...#',
      '#.H.HiHDHiH.H.#',
      '#....iiiii....#',
      '#.H.H.HiH.H.H.#',
      '#b....a.....a.#',
      '###############',
    ],
    enemies: { a: 'yukidama', b: 'penguin', c: 'obake' }, density: .55, items: { bomb: 1, fire: 1, speed: 1, heart: 1 }, egg: 'pink', start: { bombs: 2, fire: 3 },
  },
  {
    id: '3-3', world: 'ice', no: '3-3', name: 'ペンギンしょうぐんの こおりば', boss: 'penguin',
    map: [
      '###############',
      '#P_.........._#',
      '#_H.........H_#',
      '#...iiiiiii...#',
      '#..iiiiiiiii..#',
      '#..iiiiiiiii..#',
      '#..iiiiBiiii..#',
      '#..iiiiiiiii..#',
      '#..iiiiiiiii..#',
      '#...iiiiiii...#',
      '#_H.........H_#',
      '#_..........._#',
      '###############',
    ],
    enemies: {}, density: .15, items: { bomb: 1, fire: 1, heart: 1 }, egg: 'pink', start: { bombs: 3, fire: 3 },
  },
  {
    id: '4-1', world: 'volcano', no: '4-1', name: 'ふきだす ひの あな',
    map: [
      '###############',
      '#P__....a.....#',
      '#_H.H.H.H.H.H.#',
      '#_.....o......#',
      '#.H.H.H.H.H.H.#',
      '#.o.......b.o.#',
      '#.H.H.H.H.H.H.#',
      '#....a..o.....#',
      '#.H.H.H.H.H.H.#',
      '#.o.........b.#',
      '#.H.H.H.H.H.H.#',
      '#a.....D....o.#',
      '###############',
    ],
    enemies: { a: 'hinotama', b: 'maguman' }, density: .5, items: { bomb: 1, fire: 1, speed: 1, heart: 1 }, egg: 'yellow', start: { bombs: 3, fire: 3 },
  },
  {
    id: '4-2', world: 'volcano', no: '4-2', name: 'まっくら どうくつ', dark: true,
    map: [
      '###############',
      '#P__..a....o..#',
      '#_H.H.H.H.H.H.#',
      '#_.........c..#',
      '#.H.HHH.HHH.H.#',
      '#.o.H.....H.o.#',
      '#.H.H.b.D.H.H.#',
      '#...H.....H...#',
      '#.H.HHH.HHH.H.#',
      '#..c....o...a.#',
      '#.H.H.H.H.H.H.#',
      '#b.....a.....c#',
      '###############',
    ],
    enemies: { a: 'hinotama', b: 'maguman', c: 'komori' }, density: .5, items: { bomb: 1, fire: 1, speed: 1, heart: 1 }, egg: 'yellow', start: { bombs: 3, fire: 3 },
  },
  {
    id: '4-3', world: 'volcano', no: '4-3', name: 'ボルカの かこう', boss: 'dragon',
    map: [
      '###############',
      '#P_.........._#',
      '#_H.........H_#',
      '#...H.....H...#',
      '#.............#',
      '#.............#',
      '#......B......#',
      '#.............#',
      '#.............#',
      '#...H.....H...#',
      '#_H.........H_#',
      '#_..........._#',
      '###############',
    ],
    enemies: {}, density: .15, items: { bomb: 1, fire: 1, heart: 1 }, egg: 'yellow', start: { bombs: 3, fire: 3 },
  },
  {
    id: '5-1', world: 'castle', no: '5-1', name: 'ベルトコンベア こうじょう',
    map: [
      '###############',
      '#P__.....a....#',
      '#_H.H.H.H.H.H.#',
      '#_.>>>>>>>>...#',
      '#.H.H.H.H.H.H.#',
      '#...<<<<<<<<b.#',
      '#.H.H.H.H.H.H.#',
      '#.a.>>>>>>>>..#',
      '#.H.H.H.H.H.H.#',
      '#..b<<<<<<<<..#',
      '#.H.H.H.H.H.H.#',
      '#...a..D....b.#',
      '###############',
    ],
    enemies: { a: 'robo', b: 'neji' }, density: .5, items: { bomb: 1, fire: 1, speed: 1, heart: 1 }, egg: 'blue', start: { bombs: 3, fire: 3 },
  },
  {
    id: '5-2', world: 'castle', no: '5-2', name: 'くらやみの ろうか', dark: true,
    map: [
      '###############',
      '#P__.....a....#',
      '#_H.H.H.H.H.H.#',
      '#_.....c......#',
      '#.H.HvH.H^H.H.#',
      '#....v...^....#',
      '#.H.HvH.H^H.H.#',
      '#a...v.D.^..b.#',
      '#.H.HvH.H^H.H.#',
      '#....v...^....#',
      '#.H.HvH.H^H.H.#',
      '#..c.....b...a#',
      '###############',
    ],
    enemies: { a: 'robo', b: 'neji', c: 'obake' }, density: .5, items: { bomb: 1, fire: 1, speed: 1, heart: 1 }, egg: 'pink', start: { bombs: 3, fire: 3 },
  },
  {
    id: '5-3', world: 'castle', no: '5-3', name: 'ガラクタだいおうの まえ', boss: 'king',
    map: [
      '###############',
      '#P_.........._#',
      '#_H.........H_#',
      '#.............#',
      '#...H.....H...#',
      '#.............#',
      '#......B......#',
      '#.............#',
      '#...H.....H...#',
      '#.............#',
      '#_H.........H_#',
      '#_..........._#',
      '###############',
    ],
    enemies: {}, density: .15, items: { bomb: 1, fire: 1, heart: 1 }, egg: 'green', start: { bombs: 3, fire: 3 },
  },
]

export function stageIndex(id: string) {
  return STAGES.findIndex(s => s.id === id)
}

export function worldOf(stage: StageDef) {
  return WORLDS.find(w => w.id === stage.world) ?? WORLDS[0]
}

export function stagesOfWorld(world: WorldId) {
  return STAGES.filter(s => s.world === world)
}

/** のりものの なまえと とくぎ。 */
export const RIDES: Record<RideColor, { name: string; skill: string; how: string }> = {
  green: { name: 'みどりピョンタ', skill: 'ダッシュ', how: 'まっすぐ びゅーんと はしって てきを はじきとばす' },
  blue: { name: 'あおピョンタ', skill: 'キック', how: 'ボンを けとばして すべらせる' },
  pink: { name: 'ピンクピョンタ', skill: 'ジャンプ', how: 'ブロックや ボンを ぴょーんと とびこえる' },
  yellow: { name: 'きいろピョンタ', skill: 'ならべボン', how: 'ボンを まっすぐ いっきに ならべる' },
}

export const ENEMY_NAMES: Record<EnemyKind, string> = {
  puni: 'プニプニ', tentou: 'テントン', sabo: 'サボテンくん', sasori: 'サソリン', yukidama: 'ユキダマン', penguin: 'ペンペン',
  obake: 'オバケン', hinotama: 'ヒノタマ', maguman: 'マグマン', komori: 'コウモリン', robo: 'ガラクタロボ', neji: 'ネジまる',
}

export const BOSS_NAMES: Record<BossKind, string> = {
  puni: 'キングプニ', worm: 'サンドワーム ズズ', penguin: 'ペンギンしょうぐん', dragon: 'ほのおドラゴン ボルカ', king: 'ガラクタだいおう',
}
