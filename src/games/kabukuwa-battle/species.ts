// カブトムシ・クワガタの しゅるい。じっさいに いる 有名な 種類を、日本と 世界から えらんだ。
//
// ■ おおきさ（ずかんの オスの 体長。ツノ・大あごを ふくむ）
//   体長は つぎの 図鑑・記録の あたいを つかった。
//   - カブトムシ: 日本の 図鑑の オスの はんい（ツノを ふくむ）
//   - ヘラクレスオオカブト: ギネス世界記録の 最長 172mm
//   - コーカサスオオカブト（Chalcosoma chiron）: オス 最大 130mm
//   - アトラスオオカブト: オス 約 60〜120mm
//   - ゾウカブト: ふつう 70〜120mm、最大の オスで 137mm
//   - グラントシロカブト: オス 50〜85mm
//   - ノコギリクワガタ: オス 26〜74mm（野外の 最大記録 74.7mm）
//   - ミヤマクワガタ: オス 42〜78mm（野外の 最大記録 78.6mm）
//   - オオクワガタ: 野外の 最大記録 77.0mm
//   - ギラファノコギリクワガタ: オス 最大 119mm（世界で いちばん ながい クワガタ）
//   - パラワンオオヒラタクワガタ: 野外の オス 最大 111.3mm
//   - ニジイロクワガタ: オス 24〜70mm
//   ゲームの「おおきさ」は、この 最大体長を ヘラクレス（172mm）が 10 に なるように わりふった（sizeScore）。
//
// ■ ちから・はやさ
//   図鑑や 飼育書で よく いわれる とくちょうから きめた。
//   ちから: 「アジア最大で 気性が あらく 最強の こえも ある」コーカサス、「はさむ力が とても つよい」パラワンオオヒラタ、
//           「ながい ツノで はさんで もちあげる」ヘラクレス、「おもくて どっしり」ゾウカブト などを たかく、
//           「おだやかな せいかく」の ニジイロクワガタを ひくく した。
//   はやさ: 「動きが すばやく 攻撃的」な アトラス、「ちいさく 活発」な ニジイロ などを たかく、
//           「しんちょうで 動きが ゆっくり」な オオクワガタ、「のんびり おもい」ゾウカブトを ひくく した。

export type BeetleGroup = 'kabuto' | 'kuwagata'
/** わざの かた。すくいなげ（したから すくう）・はさみあげ（はさんで もちあげる）・はさみ（しめつける）・たいあたり。 */
export type MoveKind = 'scoop' | 'lift' | 'pinch' | 'charge'
export type StatKey = 'size' | 'power' | 'speed'
export type Stats = Readonly<Record<StatKey, number>>

export const STAT_KEYS: readonly StatKey[] = ['size', 'power', 'speed']
export const STAT_LABEL: Readonly<Record<StatKey, string>> = { size: 'おおきさ', power: 'ちから', speed: 'はやさ' }
export const STAT_MAX = 10

export type V3 = readonly [number, number, number]
/** 色の ならび（くらい → あかるい）。 */
export type Ramp = readonly string[]

/** ツノ・あごの ほね（とおる 点。からだの ながさ=1 の ざひょう。x まえ・y ひだり・z うえ）。 */
export type Limb = {
  /** つけね: あたま か むね。 */
  root: 'head' | 'pron'
  /** つけねからの 点の ならび（ひだりがわ。y>0 の ものは みぎに うつしも つくる）。 */
  path: readonly V3[]
  /** ふとさ（つけね, さき）。 */
  r: readonly [number, number]
  /** さきの ふたまた（ながさ）。 */
  fork?: number
  /** こぶ・は（path の どこ 0〜1、ながさ、むき）。 */
  teeth?: readonly { at: number; len: number; dir: 'up' | 'down' | 'in' }[]
  /** ツノの したがわの 毛（ヘラクレス）。 */
  hair?: boolean
}

export type Pattern = 'spots' | 'fuzz' | 'gold' | 'rainbow' | 'metal'

export type Look = {
  /** からだの はば・たかさ（からだの ながさ=1）。 */
  width: number
  height: number
  /** あたま・むねの 大きさの ばいりつ。 */
  head: number
  pron: number
  elytra: Ramp
  pronotum: Ramp
  horn: Ramp
  leg: Ramp
  pattern?: Pattern
  /** パターンの 2つめの 色（もよう・毛）。 */
  accent?: Ramp
  horns?: readonly Limb[]
  /** クワガタの 大あご（ひだりがわ）。 */
  jaw?: Limb
  /** ミヤマの みみ（あたまの よこの でっぱり）。 */
  ears?: boolean
  /** ぜんぶの ながさに たいする からだ（ツノ・あごを のぞく）の わりあいの めやす。 */
  bodyShare: number
}

export type Species = {
  id: string
  name: string
  /** みじかい よびな（じっきょうで つかう）。 */
  short: string
  group: BeetleGroup
  /** すんでいる ところ。 */
  home: string
  /** 地図の くぎり（アイコン用）。 */
  area: 'japan' | 'asia' | 'america' | 'oceania'
  /** ずかんの オスの 体長 [さいしょう, さいだい] mm。 */
  lengthMm: readonly [number, number]
  stats: Stats
  move: { name: string; kind: MoveKind }
  /** ひとこと（ずかんの とくちょう）。 */
  fact: string
  /** からだの どっしり ぐあい（おなじ ながさでの おもさ）。カブトは ずんぐり、クワガタは ひらたい。 */
  build: number
  /** なきごえの かわりの こうかおんの たかさ。 */
  voice: number
  look: Look
}

/** 最大体長 → おおきさ（1〜10）。ヘラクレスの 172mm を 10 と する。 */
export const LONGEST_MM = 172
export function sizeScore(maxMm: number) {
  return Math.max(1, Math.min(STAT_MAX, Math.round(maxMm / LONGEST_MM * STAT_MAX)))
}

const BLACK_GLOSS: Ramp = ['#07070a', '#16161c', '#2a2a34', '#4a4a58', '#8a8a9c']
const LEG_BLACK: Ramp = ['#060608', '#141418', '#26262e', '#44444e']
const MAHOGANY: Ramp = ['#170804', '#311108', '#521c0e', '#7a2e18', '#aa4c2c']

const s = (size: number, power: number, speed: number): Stats => ({ size, power, speed })

export const SPECIES: readonly Species[] = [
  {
    id: 'kabutomushi',
    name: 'カブトムシ',
    short: 'カブトムシ',
    group: 'kabuto',
    home: 'にほん・アジア',
    area: 'japan',
    lengthMm: [30, 85],
    stats: s(sizeScore(85), 6, 5),
    move: { name: 'すくいなげ', kind: 'scoop' },
    fact: 'にほんで いちばん にんきの こんちゅう。じぶんの おもさの 20ばいを ひっぱる ちからもち。',
    build: 1.2,
    voice: 330,
    look: {
      width: .56, height: .44, head: 1, pron: 1, bodyShare: .66,
      elytra: MAHOGANY, pronotum: MAHOGANY, horn: ['#120604', '#2a0e06', '#48190c', '#6e2a16', '#9a4426'], leg: ['#0c0403', '#1e0a06', '#36140c', '#552214'],
      horns: [
        { root: 'head', path: [[0, 0, 0], [.14, 0, .05], [.28, 0, .17], [.36, 0, .33]], r: [.05, .028], fork: .07 },
        { root: 'pron', path: [[0, 0, 0], [.07, 0, .02], [.12, 0, .0]], r: [.035, .018], fork: .035 },
      ],
    },
  },
  {
    id: 'hercules',
    name: 'ヘラクレスオオカブト',
    short: 'ヘラクレス',
    group: 'kabuto',
    home: 'ちゅうおう・みなみアメリカ',
    area: 'america',
    lengthMm: [50, 172],
    stats: s(sizeScore(172), 9, 4),
    move: { name: 'はさみあげ', kind: 'lift' },
    fact: 'せかいで いちばん ながい カブトムシ。2ほんの ながい ツノで はさんで もちあげる。',
    build: 1.05,
    voice: 180,
    look: {
      width: .54, height: .42, head: 1, pron: 1.08, bodyShare: .5,
      elytra: ['#3a3218', '#6e6232', '#a0904c', '#c8b868', '#e8dc98'], accent: ['#0a0806', '#1c160e', '#2c2418'], pattern: 'spots',
      pronotum: BLACK_GLOSS, horn: BLACK_GLOSS, leg: LEG_BLACK,
      horns: [
        { root: 'pron', path: [[0, 0, .03], [.3, 0, .12], [.66, 0, .1], [.9, 0, -.03]], r: [.075, .03], hair: true, teeth: [{ at: .78, len: .05, dir: 'down' }] },
        { root: 'head', path: [[0, 0, 0], [.22, 0, -.01], [.46, 0, .06], [.58, 0, .2]], r: [.05, .026], teeth: [{ at: .35, len: .05, dir: 'up' }, { at: .6, len: .04, dir: 'up' }] },
      ],
    },
  },
  {
    id: 'caucasus',
    name: 'コーカサスオオカブト',
    short: 'コーカサス',
    group: 'kabuto',
    home: 'インドネシア・マレーシア',
    area: 'asia',
    lengthMm: [60, 130],
    stats: s(sizeScore(130), 10, 5),
    move: { name: '3ぼんヅノ なげ', kind: 'scoop' },
    fact: 'アジアで いちばん 大きい カブトムシ。きしょうが あらく「さいきょう」とも いわれる。',
    build: 1.25,
    voice: 220,
    look: {
      width: .6, height: .44, head: 1, pron: 1.12, bodyShare: .6, pattern: 'metal',
      elytra: ['#050806', '#121a12', '#243222', '#41543a', '#86a07a'], pronotum: ['#050806', '#121a12', '#243222', '#41543a', '#86a07a'],
      horn: ['#050705', '#111811', '#222e20', '#3c4c36', '#7a9270'], leg: LEG_BLACK,
      horns: [
        { root: 'pron', path: [[0, .13, .03], [.16, .21, .09], [.38, .21, .08], [.52, .12, .04]], r: [.05, .022] },
        { root: 'head', path: [[0, 0, 0], [.16, 0, .02], [.32, 0, .14], [.38, 0, .38]], r: [.05, .025], teeth: [{ at: .55, len: .06, dir: 'up' }] },
      ],
    },
  },
  {
    id: 'atlas',
    name: 'アトラスオオカブト',
    short: 'アトラス',
    group: 'kabuto',
    home: 'とうなんアジア',
    area: 'asia',
    lengthMm: [60, 120],
    stats: s(sizeScore(120), 7, 7),
    move: { name: 'ひっかけなげ', kind: 'scoop' },
    fact: 'コーカサスの なかま。からだは すこし ちいさいけれど うごきが すばやい。',
    build: 1.15,
    voice: 250,
    look: {
      width: .58, height: .44, head: 1, pron: 1.05, bodyShare: .66, pattern: 'metal',
      elytra: ['#080604', '#1c1610', '#342a1c', '#5a4a30', '#a08a5c'], pronotum: ['#080604', '#1c1610', '#342a1c', '#5a4a30', '#a08a5c'],
      horn: ['#070504', '#18120c', '#2e2418', '#4e3e2a', '#8c7650'], leg: LEG_BLACK,
      horns: [
        { root: 'pron', path: [[0, .13, .03], [.12, .22, .07], [.27, .2, .07], [.34, .1, .05]], r: [.045, .02] },
        { root: 'head', path: [[0, 0, 0], [.12, 0, .03], [.22, 0, .14], [.24, 0, .26]], r: [.045, .024], teeth: [{ at: .45, len: .04, dir: 'up' }] },
      ],
    },
  },
  {
    id: 'elephas',
    name: 'ゾウカブト',
    short: 'ゾウカブト',
    group: 'kabuto',
    home: 'メキシコ・ちゅうおうアメリカ',
    area: 'america',
    lengthMm: [70, 137],
    stats: s(sizeScore(137), 8, 2),
    move: { name: 'どすこい たいあたり', kind: 'charge' },
    fact: 'からだじゅうに こまかい 毛が はえた おもたい カブトムシ。どっしりして うごかない。',
    build: 1.55,
    voice: 150,
    look: {
      width: .66, height: .5, head: 1.05, pron: 1.15, bodyShare: .72, pattern: 'fuzz',
      elytra: ['#120c06', '#24180c', '#3a2814', '#563c1e', '#7a5a30'], accent: ['#6a5020', '#94742e', '#c09c44', '#e0c070'],
      pronotum: ['#120c06', '#24180c', '#3a2814', '#563c1e', '#7a5a30'], horn: ['#0a0705', '#1c140c', '#30221a', '#4c3626', '#76563c'], leg: ['#0a0604', '#1c120a', '#301e12', '#4a301c'],
      horns: [
        { root: 'head', path: [[0, 0, 0], [.14, 0, .04], [.25, 0, .18], [.27, 0, .36]], r: [.07, .03], fork: .04 },
        { root: 'pron', path: [[0, .16, .02], [.07, .2, .06], [.11, .21, .1]], r: [.035, .016] },
        { root: 'pron', path: [[0, 0, .05], [.05, 0, .08]], r: [.03, .018] },
      ],
    },
  },
  {
    id: 'grantii',
    name: 'グラントシロカブト',
    short: 'グラント',
    group: 'kabuto',
    home: 'アメリカ・メキシコ',
    area: 'america',
    lengthMm: [50, 85],
    stats: s(sizeScore(85), 5, 5),
    move: { name: 'すくいあげ', kind: 'scoop' },
    fact: 'しろっぽい からだに くろい もようが ある、ヘラクレスの なかま。かんそうした ちいきに すむ。',
    build: 1.05,
    voice: 300,
    look: {
      width: .54, height: .42, head: 1, pron: 1.05, bodyShare: .62, pattern: 'spots',
      elytra: ['#5a564a', '#8e8a7a', '#b8b4a2', '#d8d4c2', '#f2f0e4'], accent: ['#1a140c', '#2e2416', '#40321e'],
      pronotum: ['#5a564a', '#8e8a7a', '#b8b4a2', '#d8d4c2', '#f2f0e4'], horn: BLACK_GLOSS, leg: LEG_BLACK,
      horns: [
        { root: 'pron', path: [[0, 0, .03], [.18, 0, .08], [.36, 0, .06], [.46, 0, -.02]], r: [.055, .022], teeth: [{ at: .6, len: .035, dir: 'down' }] },
        { root: 'head', path: [[0, 0, 0], [.14, 0, .0], [.26, 0, .06], [.32, 0, .16]], r: [.04, .02] },
      ],
    },
  },
  {
    id: 'nokogiri',
    name: 'ノコギリクワガタ',
    short: 'ノコギリ',
    group: 'kuwagata',
    home: 'にほん',
    area: 'japan',
    lengthMm: [26, 75],
    stats: s(sizeScore(75), 5, 6),
    move: { name: 'のこぎり はさみ', kind: 'pinch' },
    fact: 'ぐいっと まがった 大あごに ギザギザの は。あかちゃいろの からだが めじるし。',
    build: .85,
    voice: 420,
    look: {
      width: .5, height: .3, head: 1.25, pron: 1, bodyShare: .64,
      elytra: ['#1a0804', '#3a1408', '#5e220e', '#8a3618', '#bc5a30'], pronotum: ['#140603', '#2e1006', '#4c1c0c', '#722e16', '#a24c28'],
      horn: ['#120502', '#2a0e06', '#46180a', '#6c2814', '#9a4022'], leg: ['#100402', '#240c06', '#3e160a', '#5e2412'],
      jaw: { root: 'head', path: [[0, .07, 0], [.16, .15, .02], [.34, .14, .04], [.45, .03, .05]], r: [.04, .016], teeth: [{ at: .3, len: .03, dir: 'in' }, { at: .5, len: .035, dir: 'in' }, { at: .68, len: .03, dir: 'in' }] },
    },
  },
  {
    id: 'miyama',
    name: 'ミヤマクワガタ',
    short: 'ミヤマ',
    group: 'kuwagata',
    home: 'にほん',
    area: 'japan',
    lengthMm: [42, 79],
    stats: s(sizeScore(79), 5, 6),
    move: { name: 'ミヤマ はさみなげ', kind: 'lift' },
    fact: 'あたまの よこに「みみ」が あり、きんいろの こまかい 毛が はえる。すずしい 山に すむ。',
    build: .9,
    voice: 380,
    look: {
      width: .52, height: .32, head: 1.35, pron: 1, bodyShare: .66, pattern: 'gold', ears: true,
      elytra: ['#1a0e06', '#36200e', '#563618', '#7c5426', '#a87a40'], accent: ['#8a6a2a', '#b89040', '#e0bc60'],
      pronotum: ['#140a04', '#2e1a0a', '#4a2e14', '#6c4620', '#966838'], horn: ['#100804', '#26160a', '#402612', '#603c1e', '#8a5a32'], leg: ['#0e0804', '#22140a', '#3a2412', '#58381e'],
      jaw: { root: 'head', path: [[0, .07, 0], [.18, .11, .03], [.32, .1, .06], [.4, .04, .08]], r: [.04, .018], fork: .05, teeth: [{ at: .45, len: .03, dir: 'in' }] },
    },
  },
  {
    id: 'ookuwa',
    name: 'オオクワガタ',
    short: 'オオクワ',
    group: 'kuwagata',
    home: 'にほん',
    area: 'japan',
    lengthMm: [30, 77],
    stats: s(sizeScore(77), 6, 3),
    move: { name: 'がっちり はさみ', kind: 'pinch' },
    fact: '「くろい ダイヤ」と よばれる にんきもの。しんちょうで、ふとい 大あごの はさむ ちからが つよい。',
    build: 1,
    voice: 300,
    look: {
      width: .54, height: .3, head: 1.3, pron: 1.05, bodyShare: .74,
      elytra: BLACK_GLOSS, pronotum: BLACK_GLOSS, horn: BLACK_GLOSS, leg: LEG_BLACK,
      jaw: { root: 'head', path: [[0, .08, 0], [.11, .13, .01], [.22, .11, .02], [.28, .04, .02]], r: [.05, .022], teeth: [{ at: .45, len: .055, dir: 'in' }] },
    },
  },
  {
    id: 'giraffa',
    name: 'ギラファノコギリクワガタ',
    short: 'ギラファ',
    group: 'kuwagata',
    home: 'インド・とうなんアジア',
    area: 'asia',
    lengthMm: [50, 119],
    stats: s(sizeScore(119), 7, 5),
    move: { name: 'ロング はさみなげ', kind: 'lift' },
    fact: 'せかいで いちばん ながい クワガタ。キリンの くびの ような ながい 大あごを もつ。',
    build: .8,
    voice: 360,
    look: {
      width: .48, height: .28, head: 1.25, pron: .95, bodyShare: .52,
      elytra: BLACK_GLOSS, pronotum: BLACK_GLOSS, horn: BLACK_GLOSS, leg: ['#120604', '#2a0e08', '#46180e', '#6a2616'],
      jaw: { root: 'head', path: [[0, .06, 0], [.28, .1, .03], [.58, .09, .05], [.8, .02, .04]], r: [.04, .016], teeth: [{ at: .2, len: .035, dir: 'in' }, { at: .62, len: .05, dir: 'up' }] },
    },
  },
  {
    id: 'palawan',
    name: 'パラワンオオヒラタクワガタ',
    short: 'パラワン',
    group: 'kuwagata',
    home: 'フィリピン（パラワンとう）',
    area: 'asia',
    lengthMm: [50, 111],
    stats: s(sizeScore(111), 9, 5),
    move: { name: 'さいきょう はさみ', kind: 'pinch' },
    fact: 'せかいで いちばん 大きい ヒラタクワガタ。ひらたい からだと、はさむ ちからは クワガタで さいきょう クラス。',
    build: 1,
    voice: 260,
    look: {
      width: .58, height: .26, head: 1.3, pron: 1.05, bodyShare: .6,
      elytra: BLACK_GLOSS, pronotum: BLACK_GLOSS, horn: BLACK_GLOSS, leg: LEG_BLACK,
      jaw: { root: 'head', path: [[0, .08, 0], [.22, .12, .01], [.46, .1, .02], [.58, .03, .02]], r: [.045, .018], teeth: [{ at: .22, len: .04, dir: 'in' }, { at: .4, len: .025, dir: 'in' }, { at: .55, len: .025, dir: 'in' }, { at: .7, len: .02, dir: 'in' }] },
    },
  },
  {
    id: 'niji',
    name: 'ニジイロクワガタ',
    short: 'ニジイロ',
    group: 'kuwagata',
    home: 'オーストラリア・ニューギニア',
    area: 'oceania',
    lengthMm: [24, 70],
    stats: s(sizeScore(70), 3, 7),
    move: { name: 'にじいろ すくいあげ', kind: 'lift' },
    fact: 'にじいろに かがやく せかいで いちばん きれいな クワガタ。おだやかな せいかく。',
    build: .85,
    voice: 520,
    look: {
      width: .52, height: .3, head: 1.2, pron: 1, bodyShare: .72, pattern: 'rainbow',
      elytra: ['#0a2a14', '#14562a', '#2a8a3a', '#7cc040', '#e8e070'], accent: ['#3a0c2a', '#7a1a4a', '#c43a5a', '#ff8a5a', '#ffd070'],
      pronotum: ['#0a2a14', '#14562a', '#2a8a3a', '#7cc040', '#e8e070'], horn: ['#2a0c18', '#5a1830', '#8a2a3c', '#c0604a', '#f0a070'], leg: ['#081a10', '#123a20', '#1e5a30', '#3a8a48'],
      jaw: { root: 'head', path: [[0, .07, 0], [.1, .1, .04], [.17, .11, .12], [.2, .07, .2]], r: [.035, .016] },
    },
  },
]

const BY_ID = new Map(SPECIES.map(sp => [sp.id, sp]))

export function speciesById(id: string | null | undefined): Species | undefined {
  return id ? BY_ID.get(id) : undefined
}

export function speciesOfGroup(group: BeetleGroup) {
  return SPECIES.filter(sp => sp.group === group)
}

export const GROUP_LABEL: Readonly<Record<BeetleGroup, string>> = { kabuto: 'カブトムシの なかま', kuwagata: 'クワガタの なかま' }
export const MOVE_LABEL: Readonly<Record<MoveKind, string>> = { scoop: 'すくって なげる', lift: 'はさんで もちあげる', pinch: 'はさんで しめつける', charge: 'からだで おしだす' }
