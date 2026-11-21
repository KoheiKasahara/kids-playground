// 動物の種類ごとの定義（見た目のモデル・エサ・固有アクション・説明・ふるまいの傾向）。
// モデルとモーションの実体は public/models/zoo-3d/*.glb、長さや移動量は models/*.json を正とする。

import elephantManifest from './models/elephant.json'
import giraffeManifest from './models/giraffe.json'
import lionManifest from './models/lion.json'
import type { AnimalManifest } from './motion'

export type SpeciesId = 'elephant' | 'giraffe' | 'lion'

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
  food: { id: 'apple' | 'leaves' | 'meat'; label: string; emoji: string }
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
}

export const SPECIES_ORDER: SpeciesId[] = ['elephant', 'giraffe', 'lion']

export function modelUrl(species: Species): string {
  return `${import.meta.env.BASE_URL}models/zoo-3d/${species.manifest.model}`
}
