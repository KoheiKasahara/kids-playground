// 動物の種類ごとの定義（見た目のモデル・エサ・固有アクション・説明・ふるまいの傾向）。
// モデルとモーションの実体は public/models/zoo-3d/*.glb、長さや移動量は models/*.json を正とする。

import camelManifest from './models/camel.json'
import capybaraManifest from './models/capybara.json'
import crocodileManifest from './models/crocodile.json'
import deerManifest from './models/deer.json'
import elephantManifest from './models/elephant.json'
import flamingoManifest from './models/flamingo.json'
import foxManifest from './models/fox.json'
import giraffeManifest from './models/giraffe.json'
import gorillaManifest from './models/gorilla.json'
import hippoManifest from './models/hippo.json'
import kangarooManifest from './models/kangaroo.json'
import lionManifest from './models/lion.json'
import monkeyManifest from './models/monkey.json'
import ostrichManifest from './models/ostrich.json'
import pandaManifest from './models/panda.json'
import penguinManifest from './models/penguin.json'
import polarBearManifest from './models/polar_bear.json'
import rabbitManifest from './models/rabbit.json'
import redPandaManifest from './models/red_panda.json'
import rhinoManifest from './models/rhino.json'
import sheepManifest from './models/sheep.json'
import tigerManifest from './models/tiger.json'
import zebraManifest from './models/zebra.json'
import type { FoodKind } from './effects'
import type { AnimalManifest } from './motion'

export type SpeciesId = 'elephant' | 'giraffe' | 'lion' | 'panda' | 'tiger' | 'penguin' | 'zebra' | 'hippo' | 'rabbit' | 'kangaroo' | 'flamingo' | 'polar_bear' | 'camel' | 'monkey' | 'capybara' | 'crocodile' | 'sheep' | 'gorilla' | 'red_panda' | 'rhino' | 'deer' | 'fox' | 'ostrich'

export type SpecialAction = {
  clip: string
  label: string
  emoji: string
  /** 池のほとりへ歩いてから行う（水浴び）。 */
  atPond?: boolean
}

export type Species = {
  id: SpeciesId
  name: string
  emoji: string
  color: string
  manifest: AnimalManifest
  food: { id: FoodKind; label: string; emoji: string }
  specials: SpecialAction[]
  facts: string[]
  /** エサを食べるとき、エサから体の中心までの距離（m, 大人の大きさ）。 */
  reach: number
  /** タップ判定用の球（動物の前方 +z、大人の大きさ）。 */
  hit: { y: number; z: number; r: number }[]
  /** 追いかけるカメラが見る高さと距離。 */
  follow: { height: number; distance: number }
  members: { id: string; scale: number; label: string }[]
  mood: { idle: [number, number]; wander: number; run: number; special: number; graze: number; sleep: number }
}

export const SPECIES: Record<SpeciesId, Species> = {
  elephant: {
    id: 'elephant',
    name: 'ゾウ',
    emoji: '🐘',
    color: '#7f93b8',
    manifest: elephantManifest as AnimalManifest,
    food: { id: 'apple', label: 'りんご', emoji: '🍎' },
    specials: [
      { clip: 'Trumpet', label: 'パオーン', emoji: '🎺' },
      { clip: 'Bath', label: 'みずあび', emoji: '💦', atPond: true },
    ],
    facts: [
      'はなで みずを すって、シャワーみたいに かけるよ',
      'りくで いちばん おおきな どうぶつだよ',
      'おおきな みみを ぱたぱたして、からだを ひやすよ',
    ],
    reach: 1.55,
    hit: [{ y: 1.05, z: 0, r: 0.95 }, { y: 1.45, z: 1.0, r: 0.62 }],
    follow: { height: 1.1, distance: 9 },
    members: [
      { id: 'elephant-mom', scale: 1, label: 'おかあさん' },
      { id: 'elephant-baby', scale: 0.62, label: 'あかちゃん' },
    ],
    mood: { idle: [2.5, 5.5], wander: 5, run: 0.7, special: 1.2, graze: 1.3, sleep: 0.45 },
  },
  giraffe: {
    id: 'giraffe',
    name: 'キリン',
    emoji: '🦒',
    color: '#e9b949',
    manifest: giraffeManifest as AnimalManifest,
    food: { id: 'leaves', label: 'はっぱ', emoji: '🌿' },
    specials: [
      { clip: 'Stretch', label: 'のびーる', emoji: '🦒' },
      { clip: 'Eat', label: 'くびを さげる', emoji: '🌱' },
    ],
    facts: [
      'くびが とっても ながいよ',
      'たかい きの はっぱを たべるよ',
      'あたまに 2ほんの つのが あるよ',
    ],
    reach: (giraffeManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.9,
    hit: [{ y: 1.7, z: 0, r: 0.62 }, { y: 2.8, z: 0.75, r: 0.5 }, { y: 0.9, z: 0, r: 0.5 }],
    follow: { height: 2.0, distance: 11 },
    members: [
      { id: 'giraffe-dad', scale: 1, label: 'おとうさん' },
      { id: 'giraffe-kid', scale: 0.66, label: 'こども' },
    ],
    mood: { idle: [3, 6], wander: 5, run: 0.5, special: 1.0, graze: 1.0, sleep: 0.35 },
  },
  lion: {
    id: 'lion',
    name: 'ライオン',
    emoji: '🦁',
    color: '#e59a3c',
    manifest: lionManifest as AnimalManifest,
    food: { id: 'meat', label: 'おにく', emoji: '🍖' },
    specials: [
      { clip: 'Roar', label: 'がおー', emoji: '📣' },
      { clip: 'Roll', label: 'ごろん', emoji: '🌀' },
    ],
    facts: [
      'どうぶつの おうさま って よばれているよ',
      'おとうさんには ふさふさの たてがみが あるよ',
      '1にちの はんぶん いじょう ねているよ',
    ],
    reach: (lionManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.7,
    hit: [{ y: 0.65, z: 0, r: 0.55 }, { y: 0.95, z: 0.65, r: 0.45 }],
    follow: { height: 0.7, distance: 6 },
    members: [
      { id: 'lion-dad', scale: 1, label: 'おとうさん' },
      { id: 'lion-cub', scale: 0.6, label: 'こども' },
    ],
    mood: { idle: [2.5, 5], wander: 4, run: 0.8, special: 1.0, graze: 0.6, sleep: 0.9 },
  },
  panda: {
    id: 'panda',
    name: 'パンダ',
    emoji: '🐼',
    color: '#9aa3b5',
    manifest: pandaManifest as AnimalManifest,
    food: { id: 'bamboo', label: 'たけ', emoji: '🎋' },
    specials: [
      { clip: 'Wave', label: 'てをふる', emoji: '👋' },
      { clip: 'Roll', label: 'ころりん', emoji: '🌀' },
    ],
    facts: [
      'たけや ささの はっぱが だいすきだよ',
      'すわって まえあしで じょうずに たべるよ',
      'めの まわりと みみと あしが くろいよ',
    ],
    reach: (pandaManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.5,
    hit: [{ y: 0.6, z: 0, r: 0.5 }, { y: 0.9, z: 0.6, r: 0.38 }],
    follow: { height: 0.65, distance: 5.5 },
    members: [
      { id: 'panda-mom', scale: 1, label: 'おかあさん' },
      { id: 'panda-baby', scale: 0.58, label: 'あかちゃん' },
    ],
    mood: { idle: [3, 6], wander: 3.5, run: 0.4, special: 1.2, graze: 1.6, sleep: 0.8 },
  },
  tiger: {
    id: 'tiger',
    name: 'トラ',
    emoji: '🐯',
    color: '#f29a3a',
    manifest: tigerManifest as AnimalManifest,
    food: { id: 'meat', label: 'おにく', emoji: '🍖' },
    specials: [
      { clip: 'Stretch', label: 'のびー', emoji: '🐾' },
      { clip: 'Roar', label: 'がおー', emoji: '📣' },
    ],
    facts: [
      'からだに くろい しましまが あるよ',
      'ネコの なかまで いちばん おおきいよ',
      'みずが すきで およぐのが じょうずだよ',
    ],
    reach: (tigerManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.7,
    hit: [{ y: 0.62, z: 0, r: 0.55 }, { y: 0.92, z: 0.7, r: 0.42 }],
    follow: { height: 0.7, distance: 6 },
    members: [
      { id: 'tiger-mom', scale: 1, label: 'おかあさん' },
      { id: 'tiger-cub', scale: 0.56, label: 'こども' },
    ],
    mood: { idle: [2.5, 5], wander: 4.5, run: 0.9, special: 1.1, graze: 0.6, sleep: 0.8 },
  },
  penguin: {
    id: 'penguin',
    name: 'ペンギン',
    emoji: '🐧',
    color: '#6a7a99',
    manifest: penguinManifest as AnimalManifest,
    food: { id: 'fish', label: 'さかな', emoji: '🐟' },
    specials: [
      { clip: 'Flap', label: 'ぱたぱた', emoji: '🙌' },
      { clip: 'Hop', label: 'ぴょんぴょん', emoji: '⬆️' },
    ],
    facts: [
      'とりの なかまだけど、そらは とべないよ',
      'うみの なかを とっても はやく およぐよ',
      'よちよち あるくよ。おなかで すべることも あるよ',
    ],
    reach: (penguinManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.4,
    hit: [{ y: 0.45, z: 0, r: 0.36 }, { y: 0.82, z: 0.1, r: 0.26 }],
    follow: { height: 0.45, distance: 4.6 },
    members: [
      { id: 'penguin-dad', scale: 1, label: 'おとうさん' },
      { id: 'penguin-mom', scale: 0.94, label: 'おかあさん' },
      { id: 'penguin-chick', scale: 0.6, label: 'ひな' },
    ],
    mood: { idle: [2, 4.5], wander: 5, run: 0.6, special: 1.3, graze: 0.8, sleep: 0.5 },
  },
  zebra: {
    id: 'zebra',
    name: 'シマウマ',
    emoji: '🦓',
    color: '#8d8f9c',
    manifest: zebraManifest as AnimalManifest,
    food: { id: 'grass', label: 'ほしくさ', emoji: '🌾' },
    specials: [
      { clip: 'Rear', label: 'ヒヒーン', emoji: '🐴' },
      { clip: 'Roll', label: 'ごろごろ', emoji: '🌀' },
    ],
    facts: [
      'しましまの もようは 1とう ずつ ちがうよ',
      'ウマの なかまで、はしるのが はやいよ',
      'すなの うえで ごろごろして からだを きれいにするよ',
    ],
    reach: (zebraManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.9,
    hit: [{ y: 1.0, z: 0, r: 0.55 }, { y: 1.55, z: 0.75, r: 0.4 }],
    follow: { height: 1.0, distance: 7 },
    members: [
      { id: 'zebra-mom', scale: 1, label: 'おかあさん' },
      { id: 'zebra-foal', scale: 0.62, label: 'こども' },
    ],
    mood: { idle: [2.5, 5], wander: 5, run: 1.0, special: 1.0, graze: 1.4, sleep: 0.35 },
  },
  hippo: {
    id: 'hippo',
    name: 'カバ',
    emoji: '🦛',
    color: '#a898bf',
    manifest: hippoManifest as AnimalManifest,
    food: { id: 'watermelon', label: 'スイカ', emoji: '🍉' },
    specials: [
      { clip: 'Yawn', label: 'おおあくび', emoji: '😮' },
      { clip: 'Splash', label: 'みずあび', emoji: '💦', atPond: true },
    ],
    facts: [
      'くちを とっても おおきく あけられるよ',
      'ひるまは みずの なかで すごすのが すきだよ',
      'めと はなと みみが あたまの うえに あるよ',
    ],
    reach: (hippoManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.9,
    hit: [{ y: 0.65, z: 0, r: 0.65 }, { y: 0.85, z: 0.85, r: 0.45 }],
    follow: { height: 0.75, distance: 7 },
    members: [
      { id: 'hippo-mom', scale: 1, label: 'おかあさん' },
      { id: 'hippo-baby', scale: 0.58, label: 'あかちゃん' },
    ],
    mood: { idle: [3, 6], wander: 3.5, run: 0.4, special: 1.3, graze: 1.4, sleep: 0.9 },
  },
  rabbit: {
    id: 'rabbit',
    name: 'ウサギ',
    emoji: '🐰',
    color: '#e3c49b',
    manifest: rabbitManifest as AnimalManifest,
    food: { id: 'carrot', label: 'にんじん', emoji: '🥕' },
    specials: [
      { clip: 'Binky', label: 'ぴょーん', emoji: '✨' },
      { clip: 'Stand', label: 'たっち', emoji: '👀' },
    ],
    facts: [
      'ながい みみで とおくの おとも きこえるよ',
      'うしろあしで ぴょんぴょん はねて すすむよ',
      'うれしいと、とびあがって からだを ひねるよ',
    ],
    reach: (rabbitManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.35,
    hit: [{ y: 0.3, z: 0, r: 0.3 }, { y: 0.55, z: 0.22, r: 0.24 }],
    follow: { height: 0.35, distance: 4.6 },
    members: [
      { id: 'rabbit-mom', scale: 1, label: 'おかあさん' },
      { id: 'rabbit-kid', scale: 0.75, label: 'こども' },
      { id: 'rabbit-baby', scale: 0.58, label: 'あかちゃん' },
    ],
    mood: { idle: [1.5, 3.5], wander: 6, run: 1.4, special: 1.3, graze: 1.5, sleep: 0.5 },
  },
  kangaroo: {
    id: 'kangaroo',
    name: 'カンガルー',
    emoji: '🦘',
    color: '#c98c5a',
    manifest: kangarooManifest as AnimalManifest,
    food: { id: 'grass', label: 'ほしくさ', emoji: '🌾' },
    specials: [
      { clip: 'Jump', label: 'ジャンプ', emoji: '⬆️' },
      { clip: 'Box', label: 'ボクシング', emoji: '🥊' },
    ],
    facts: [
      'おかあさんの おなかには あかちゃんを いれる ふくろが あるよ',
      'うしろあしで おおきく ぴょーんと はねて すすむよ',
      'ふとい しっぽで からだを ささえるよ',
    ],
    reach: (kangarooManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.4,
    hit: [{ y: 0.45, z: 0, r: 0.32 }, { y: 0.85, z: 0.12, r: 0.25 }],
    follow: { height: 0.75, distance: 5.2 },
    members: [
      { id: 'kangaroo-mom', scale: 1.2, label: 'おかあさん' },
      { id: 'kangaroo-joey', scale: 0.72, label: 'こども' },
    ],
    mood: { idle: [2, 4.5], wander: 5.5, run: 1.2, special: 1.2, graze: 1.3, sleep: 0.6 },
  },
  flamingo: {
    id: 'flamingo',
    name: 'フラミンゴ',
    emoji: '🦩',
    color: '#f59ab2',
    manifest: flamingoManifest as AnimalManifest,
    food: { id: 'shrimp', label: 'エビ', emoji: '🦐' },
    specials: [
      { clip: 'Display', label: 'ばさばさ', emoji: '🪶' },
      { clip: 'March', label: 'マーチ', emoji: '🎵' },
    ],
    facts: [
      'かたあしで たったまま ねむるよ',
      'エビなどを たべて からだが ピンクに なるよ',
      'みんなで ならんで ダンスのように あるくよ',
    ],
    reach: (flamingoManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.4,
    hit: [{ y: 0.9, z: 0, r: 0.3 }, { y: 1.35, z: 0.2, r: 0.22 }, { y: 0.45, z: 0, r: 0.2 }],
    follow: { height: 0.95, distance: 5 },
    members: [
      { id: 'flamingo-a', scale: 1, label: 'おとうさん' },
      { id: 'flamingo-b', scale: 0.96, label: 'おかあさん' },
      { id: 'flamingo-chick', scale: 0.62, label: 'ひな' },
    ],
    mood: { idle: [2.5, 5], wander: 4, run: 0.5, special: 1.2, graze: 1.6, sleep: 0.7 },
  },
  polar_bear: {
    id: 'polar_bear',
    name: 'シロクマ',
    emoji: '🐻‍❄️',
    color: '#9fb8c8',
    manifest: polarBearManifest as AnimalManifest,
    food: { id: 'fish', label: 'さかな', emoji: '🐟' },
    specials: [
      { clip: 'Stand', label: 'たちあがる', emoji: '🐾' },
      { clip: 'Splash', label: 'ばしゃっ', emoji: '💦', atPond: true },
    ],
    facts: [
      'さむい こおりの くにに すんでいるよ',
      'およぐのが とくいで、うみを ながく およげるよ',
      'しろく みえる けの したの はだは くろいよ',
    ],
    reach: (polarBearManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.9,
    hit: [{ y: 0.7, z: 0, r: 0.6 }, { y: 0.95, z: 0.8, r: 0.38 }],
    follow: { height: 0.8, distance: 6.5 },
    members: [
      { id: 'polar-bear-mom', scale: 1, label: 'おかあさん' },
      { id: 'polar-bear-cub', scale: 0.55, label: 'こども' },
    ],
    mood: { idle: [2.5, 5], wander: 4.5, run: 0.6, special: 1.3, graze: 1.0, sleep: 0.8 },
  },
  camel: {
    id: 'camel',
    name: 'ラクダ',
    emoji: '🐫',
    color: '#d9ae72',
    manifest: camelManifest as AnimalManifest,
    food: { id: 'carrot', label: 'にんじん', emoji: '🥕' },
    specials: [
      { clip: 'Chew', label: 'もぐもぐ', emoji: '😋' },
      { clip: 'Bellow', label: 'ぶおー', emoji: '📣' },
    ],
    facts: [
      'せなかに こぶが 2つ あるよ',
      'あつい さばくでも げんきに あるけるよ',
      'おなじ がわの まえあしと うしろあしを いっしょに だして あるくよ',
    ],
    reach: (camelManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.8,
    hit: [{ y: 1.15, z: 0, r: 0.6 }, { y: 1.55, z: 1.1, r: 0.35 }, { y: 1.2, z: 0.7, r: 0.3 }],
    follow: { height: 1.15, distance: 7.5 },
    members: [
      { id: 'camel-mom', scale: 1, label: 'おかあさん' },
      { id: 'camel-calf', scale: 0.62, label: 'こども' },
    ],
    mood: { idle: [3, 6], wander: 4, run: 0.4, special: 1.2, graze: 1.3, sleep: 0.5 },
  },
  monkey: {
    id: 'monkey',
    name: 'サル',
    emoji: '🐵',
    color: '#b18f72',
    manifest: monkeyManifest as AnimalManifest,
    food: { id: 'banana', label: 'バナナ', emoji: '🍌' },
    specials: [
      { clip: 'Clap', label: 'ぱちぱち', emoji: '👏' },
      { clip: 'Scratch', label: 'ぽりぽり', emoji: '🤔' },
    ],
    facts: [
      'かおと おしりが あかいよ',
      'てを つかって じょうずに たべるよ',
      'さむい ひは みんなで くっついて あたたまるよ',
    ],
    reach: (monkeyManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.3,
    hit: [{ y: 0.55, z: 0, r: 0.35 }, { y: 0.85, z: 0.35, r: 0.27 }],
    follow: { height: 0.6, distance: 4.8 },
    members: [
      { id: 'monkey-mom', scale: 1, label: 'おかあさん' },
      { id: 'monkey-kid', scale: 0.75, label: 'こども' },
      { id: 'monkey-baby', scale: 0.55, label: 'あかちゃん' },
    ],
    mood: { idle: [1.5, 3.5], wander: 5, run: 1.3, special: 1.4, graze: 1.4, sleep: 0.5 },
  },
  capybara: {
    id: 'capybara',
    name: 'カピバラ',
    emoji: '🦫',
    color: '#b5814f',
    manifest: capybaraManifest as AnimalManifest,
    food: { id: 'apple', label: 'りんご', emoji: '🍎' },
    specials: [
      { clip: 'Relax', label: 'おふろ', emoji: '♨️', atPond: true },
      { clip: 'Shake', label: 'ぶるぶる', emoji: '💫' },
    ],
    facts: [
      'せかいで いちばん おおきな ネズミの なかまだよ',
      'およぐのが じょうずで、みずの なかが すきだよ',
      'のんびりやさんで、ほかの どうぶつとも なかよしだよ',
    ],
    reach: (capybaraManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.6,
    hit: [{ y: 0.45, z: 0, r: 0.42 }, { y: 0.6, z: 0.55, r: 0.3 }],
    follow: { height: 0.5, distance: 5 },
    members: [
      { id: 'capybara-mom', scale: 1, label: 'おかあさん' },
      { id: 'capybara-kid', scale: 0.72, label: 'こども' },
      { id: 'capybara-baby', scale: 0.52, label: 'あかちゃん' },
    ],
    mood: { idle: [3.5, 7], wander: 3, run: 0.3, special: 1.4, graze: 1.6, sleep: 1.0 },
  },
  crocodile: {
    id: 'crocodile',
    name: 'ワニ',
    emoji: '🐊',
    color: '#6fa65b',
    manifest: crocodileManifest as AnimalManifest,
    food: { id: 'meat', label: 'おにく', emoji: '🍖' },
    specials: [
      { clip: 'Chomp', label: 'ぱくっ', emoji: '😬' },
      { clip: 'Bask', label: 'ぽかぽか', emoji: '☀️' },
    ],
    facts: [
      'くちを あけたまま ひなたぼっこを するよ',
      'めと はなが あたまの うえに あるので、みずに かくれて ようすを みられるよ',
      'ながい しっぽで みずの なかを すいすい およぐよ',
    ],
    reach: (crocodileManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.9,
    hit: [{ y: 0.25, z: 0, r: 0.4 }, { y: 0.25, z: 0.75, r: 0.32 }, { y: 0.2, z: -0.8, r: 0.3 }],
    follow: { height: 0.35, distance: 5.5 },
    members: [
      { id: 'crocodile-dad', scale: 1, label: 'おとうさん' },
      { id: 'crocodile-kid', scale: 0.6, label: 'こども' },
    ],
    mood: { idle: [4, 8], wander: 2.5, run: 0.3, special: 1.2, graze: 0.6, sleep: 1.2 },
  },
  sheep: {
    id: 'sheep',
    name: 'ヒツジ',
    emoji: '🐑',
    color: '#d8cdb8',
    manifest: sheepManifest as AnimalManifest,
    food: { id: 'grass', label: 'ほしくさ', emoji: '🌾' },
    specials: [
      { clip: 'Baa', label: 'メェー', emoji: '🎵' },
      { clip: 'Pronk', label: 'ぴょこん', emoji: '⬆️' },
    ],
    facts: [
      'もこもこの けは、セーターの けいとに なるよ',
      'みんなで いっしょに うごくのが すきだよ',
      'くさを たべたあと、くちを もぐもぐ うごかすよ',
    ],
    reach: (sheepManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.5,
    hit: [{ y: 0.6, z: 0, r: 0.4 }, { y: 0.85, z: 0.45, r: 0.24 }],
    follow: { height: 0.6, distance: 5 },
    members: [
      { id: 'sheep-mom', scale: 1, label: 'おかあさん' },
      { id: 'sheep-lamb', scale: 0.62, label: 'こども' },
    ],
    mood: { idle: [2, 4.5], wander: 4.5, run: 0.7, special: 1.2, graze: 2.0, sleep: 0.5 },
  },
  gorilla: {
    id: 'gorilla',
    name: 'ゴリラ',
    emoji: '🦍',
    color: '#5a5560',
    manifest: gorillaManifest as AnimalManifest,
    food: { id: 'leaves', label: 'はっぱ', emoji: '🌿' },
    specials: [
      { clip: 'ChestBeat', label: 'ドンドコ', emoji: '🥁' },
      { clip: 'Stomp', label: 'ドシン', emoji: '✊' },
    ],
    facts: [
      'むねを たたいて ドンドコ おとを だすよ',
      'こぶしを じめんに ついて あるくよ',
      'おとなの オスは せなかが ぎんいろに なるよ',
    ],
    reach: (gorillaManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.4,
    hit: [{ y: 0.8, z: 0, r: 0.55 }, { y: 1.05, z: 0.45, r: 0.3 }],
    follow: { height: 0.9, distance: 6 },
    members: [
      { id: 'gorilla-dad', scale: 1, label: 'おとうさん' },
      { id: 'gorilla-baby', scale: 0.5, label: 'あかちゃん' },
    ],
    mood: { idle: [3, 6], wander: 3.5, run: 0.5, special: 1.3, graze: 1.5, sleep: 0.8 },
  },
  red_panda: {
    id: 'red_panda',
    name: 'レッサーパンダ',
    emoji: '🦝',
    color: '#c95b2c',
    manifest: redPandaManifest as AnimalManifest,
    food: { id: 'bamboo', label: 'たけ', emoji: '🎋' },
    specials: [
      { clip: 'Stand', label: 'たっち', emoji: '🙌' },
      { clip: 'Groom', label: 'かおあらい', emoji: '🧼' },
    ],
    facts: [
      'しましまの ふさふさ しっぽが あるよ',
      'うしろあしで すっくと たつことが あるよ',
      'たけの はっぱや くだものを たべるよ',
    ],
    reach: (redPandaManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.3,
    hit: [{ y: 0.42, z: 0, r: 0.3 }, { y: 0.6, z: 0.36, r: 0.24 }],
    follow: { height: 0.45, distance: 4.6 },
    members: [
      { id: 'red-panda-mom', scale: 1, label: 'おかあさん' },
      { id: 'red-panda-kid', scale: 0.65, label: 'こども' },
    ],
    mood: { idle: [2, 4.5], wander: 4.5, run: 0.8, special: 1.4, graze: 1.6, sleep: 0.8 },
  },
  rhino: {
    id: 'rhino',
    name: 'サイ',
    emoji: '🦏',
    color: '#a3a09d',
    manifest: rhinoManifest as AnimalManifest,
    food: { id: 'grass', label: 'ほしくさ', emoji: '🌾' },
    specials: [
      { clip: 'Paw', label: 'ふんっ', emoji: '💨' },
      { clip: 'Wallow', label: 'どろあび', emoji: '🟤', atPond: true },
    ],
    facts: [
      'はなの うえに おおきな つのが あるよ',
      'どろあびを して、ひやけや むしから からだを まもるよ',
      'からだは おもいけど、はしると とても はやいよ',
    ],
    reach: (rhinoManifest as AnimalManifest).clips.Eat.food?.reach ?? 1.0,
    hit: [{ y: 0.8, z: 0, r: 0.7 }, { y: 0.8, z: 0.95, r: 0.42 }],
    follow: { height: 0.9, distance: 8 },
    members: [
      { id: 'rhino-mom', scale: 1, label: 'おかあさん' },
      { id: 'rhino-calf', scale: 0.56, label: 'こども' },
    ],
    mood: { idle: [3, 6], wander: 3.5, run: 0.5, special: 1.2, graze: 1.6, sleep: 0.7 },
  },
  deer: {
    id: 'deer',
    name: 'シカ',
    emoji: '🦌',
    color: '#b97a48',
    manifest: deerManifest as AnimalManifest,
    food: { id: 'cracker', label: 'せんべい', emoji: '🍘' },
    specials: [
      { clip: 'Bow', label: 'おじぎ', emoji: '🙇' },
      { clip: 'Leap', label: 'ジャンプ', emoji: '⬆️' },
    ],
    facts: [
      'オスの あたまには えだのような つのが あるよ',
      'せんべいが ほしいと、ぺこりと おじぎを するよ',
      'からだに しろい てんてんの もようが あるよ',
    ],
    reach: (deerManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.6,
    hit: [{ y: 0.85, z: 0, r: 0.42 }, { y: 1.25, z: 0.6, r: 0.28 }],
    follow: { height: 0.9, distance: 6 },
    members: [
      { id: 'deer-dad', scale: 1, label: 'おとうさん' },
      { id: 'deer-fawn', scale: 0.6, label: 'こども' },
    ],
    mood: { idle: [2.5, 5], wander: 4.5, run: 0.9, special: 1.4, graze: 1.6, sleep: 0.5 },
  },
  fox: {
    id: 'fox',
    name: 'キツネ',
    emoji: '🦊',
    color: '#e8823a',
    manifest: foxManifest as AnimalManifest,
    food: { id: 'meat', label: 'おにく', emoji: '🍖' },
    specials: [
      { clip: 'Pounce', label: 'ぴょーん', emoji: '❄️' },
      { clip: 'Howl', label: 'コーン', emoji: '🎵' },
    ],
    facts: [
      'ふさふさの おおきな しっぽが あるよ',
      'みみが よくて、ゆきの したの ネズミの おとも きこえるよ',
      'たかく とびあがって、はなから ゆきに とびこむよ',
    ],
    reach: (foxManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.4,
    hit: [{ y: 0.45, z: 0, r: 0.32 }, { y: 0.66, z: 0.42, r: 0.24 }],
    follow: { height: 0.5, distance: 4.8 },
    members: [
      { id: 'fox-mom', scale: 1, label: 'おかあさん' },
      { id: 'fox-kit', scale: 0.62, label: 'こども' },
    ],
    mood: { idle: [2, 4.5], wander: 5, run: 1.2, special: 1.3, graze: 0.8, sleep: 0.8 },
  },
  ostrich: {
    id: 'ostrich',
    name: 'ダチョウ',
    emoji: '🐦',
    color: '#4a4245',
    manifest: ostrichManifest as AnimalManifest,
    food: { id: 'leaves', label: 'はっぱ', emoji: '🌿' },
    specials: [
      { clip: 'Dance', label: 'ダンス', emoji: '💃' },
      { clip: 'Lookout', label: 'みはり', emoji: '👀' },
    ],
    facts: [
      'せかいで いちばん おおきな とりだよ',
      'とべないけれど、はしるのが とても はやいよ',
      'たまごも せかいで いちばん おおきいよ',
    ],
    reach: (ostrichManifest as AnimalManifest).clips.Eat.food?.reach ?? 0.6,
    hit: [{ y: 1.15, z: 0, r: 0.42 }, { y: 1.9, z: 0.35, r: 0.25 }, { y: 0.55, z: 0, r: 0.25 }],
    follow: { height: 1.2, distance: 6.5 },
    members: [
      { id: 'ostrich-dad', scale: 1, label: 'おとうさん' },
      { id: 'ostrich-chick', scale: 0.5, label: 'ひな' },
    ],
    mood: { idle: [2, 4.5], wander: 4.5, run: 1.4, special: 1.2, graze: 1.4, sleep: 0.5 },
  },
}

export const SPECIES_ORDER: SpeciesId[] = ['elephant', 'giraffe', 'lion', 'panda', 'tiger', 'penguin', 'zebra', 'hippo', 'rabbit', 'kangaroo', 'flamingo', 'polar_bear', 'camel', 'monkey', 'capybara', 'crocodile', 'sheep', 'gorilla', 'red_panda', 'rhino', 'deer', 'fox', 'ostrich']

export function modelUrl(species: Species): string {
  return `${import.meta.env.BASE_URL}models/zoo-3d/${species.manifest.model}`
}
