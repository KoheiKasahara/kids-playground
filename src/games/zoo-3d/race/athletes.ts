// レースで使う、動物ごとの運動の力（だいたいの実際の値をもとにした、遊びのための値）。
// 速さは実際の最高速度（km/h）のおおよそ。レースでは差を縮めて使う（raceSim.ts）ので、厳密でなくてよい。
// 持久力・小回りなどは 0〜1 の目安。動物の特徴（チーターはすぐ疲れる、ラクダは疲れない、
// ペンギンは泳ぐのが速い、カバは どろんこが へっちゃら…）が勝ちやすさに出るように決める。

import type { SpeciesId } from '../species'

export type Athlete = {
  /** 地面を走る最高速度（km/h、だいたい）。 */
  speed: number
  /** 持久力。1 に近いほど、長く速さを保てる。 */
  stamina: number
  /** 走り出しの速さ。 */
  accel: number
  /** 小回り（カーブ・森の小道）。 */
  agility: number
  /** ジャンプ（ハードル・丸太）。 */
  jump: number
  /** 泳ぐ速さ（km/h、だいたい）。 */
  swim: number
  /** 氷の上で すべらずに走れる。 */
  grip: number
  /** どろんこの中でも走れる。 */
  mud: number
  /** 氷の上を おなかで すべる速さ（km/h。ペンギンだけ）。 */
  slide?: number
  /**
   * よりみち: レースの途中で とくいわざを始めてしまう。clip は species.ts の specials のどれか、
   * chance は 1回のレースで よりみちする確率。
   */
  quirk: { clip: string; chance: number }
  /** 出走表に出す ひとこと（ひらがな中心）。 */
  note: string
}

export const ATHLETES: Record<SpeciesId, Athlete> = {
  // サバンナ ダッシュ
  cheetah: {
    speed: 110, stamina: 0.2, accel: 1, agility: 0.9, jump: 0.75, swim: 3, grip: 0.55, mud: 0.3,
    quirk: { clip: 'Lookout', chance: 0.18 },
    note: 'せかいいち はやいけど、すぐ つかれちゃう',
  },
  lion: {
    speed: 80, stamina: 0.3, accel: 0.9, agility: 0.7, jump: 0.75, swim: 4, grip: 0.5, mud: 0.4,
    quirk: { clip: 'Roll', chance: 0.22 },
    note: 'みじかい きょりなら とても はやい',
  },
  ostrich: {
    speed: 70, stamina: 0.85, accel: 0.75, agility: 0.6, jump: 0.6, swim: 2, grip: 0.4, mud: 0.35,
    quirk: { clip: 'Dance', chance: 0.14 },
    note: 'とべない かわりに、ながく はやく はしれる',
  },
  zebra: {
    speed: 65, stamina: 0.75, accel: 0.7, agility: 0.65, jump: 0.6, swim: 4, grip: 0.4, mud: 0.5,
    quirk: { clip: 'Roll', chance: 0.14 },
    note: 'むれで ながく はしるのが とくい',
  },
  giraffe: {
    speed: 60, stamina: 0.6, accel: 0.5, agility: 0.3, jump: 0.4, swim: 2, grip: 0.3, mud: 0.3,
    quirk: { clip: 'Stretch', chance: 0.14 },
    note: 'ながい あしで おおまたに はしる',
  },
  // ぼくじょう ダービー
  horse: {
    speed: 70, stamina: 0.8, accel: 0.75, agility: 0.7, jump: 0.75, swim: 5, grip: 0.4, mud: 0.5,
    quirk: { clip: 'Prance', chance: 0.07 },
    note: 'はしるのが だいすきな かけっこの プロ',
  },
  camel: {
    speed: 65, stamina: 1, accel: 0.4, agility: 0.4, jump: 0.3, swim: 3, grip: 0.4, mud: 0.4,
    quirk: { clip: 'Chew', chance: 0.18 },
    note: 'はじめは ゆっくり。でも ぜんぜん つかれない',
  },
  deer: {
    speed: 60, stamina: 0.5, accel: 0.9, agility: 0.9, jump: 0.95, swim: 5, grip: 0.45, mud: 0.4,
    quirk: { clip: 'Bow', chance: 0.14 },
    note: 'すばしっこくて カーブが じょうず',
  },
  alpaca: {
    speed: 50, stamina: 0.65, accel: 0.55, agility: 0.6, jump: 0.5, swim: 3, grip: 0.5, mud: 0.4,
    quirk: { clip: 'Hum', chance: 0.18 },
    note: 'ふわふわだけど おもったより はやい',
  },
  sheep: {
    speed: 42, stamina: 0.6, accel: 0.6, agility: 0.75, jump: 0.6, swim: 3, grip: 0.45, mud: 0.4,
    quirk: { clip: 'Baa', chance: 0.18 },
    note: 'カーブで みんなに ついていくのが とくい',
  },
  // もりの クロスカントリー
  wolf: {
    speed: 60, stamina: 0.95, accel: 0.7, agility: 0.75, jump: 0.75, swim: 6, grip: 0.6, mud: 0.5,
    quirk: { clip: 'Howl', chance: 0.12 },
    note: 'ながい みちのりでも つかれない',
  },
  tiger: {
    speed: 60, stamina: 0.3, accel: 0.85, agility: 0.7, jump: 0.9, swim: 8, grip: 0.5, mud: 0.5,
    quirk: { clip: 'Stretch', chance: 0.2 },
    note: 'ジャンプが とくい。でも ながい きょりは にがて',
  },
  fox: {
    speed: 48, stamina: 0.6, accel: 0.85, agility: 0.85, jump: 0.9, swim: 4, grip: 0.6, mud: 0.4,
    quirk: { clip: 'Pounce', chance: 0.18 },
    note: 'くねくね みちを すいすい はしる',
  },
  panda: {
    speed: 36, stamina: 0.55, accel: 0.5, agility: 0.7, jump: 0.55, swim: 3, grip: 0.6, mud: 0.5,
    quirk: { clip: 'Roll', chance: 0.22 },
    note: 'のんびりやさん。とちゅうで ころりん するかも',
  },
  red_panda: {
    speed: 30, stamina: 0.5, accel: 0.75, agility: 0.95, jump: 0.85, swim: 2, grip: 0.6, mud: 0.3,
    quirk: { clip: 'Groom', chance: 0.25 },
    note: 'きのぼりが とくい。まるたも ひょいっ',
  },
  raccoon: {
    speed: 28, stamina: 0.55, accel: 0.75, agility: 0.95, jump: 0.75, swim: 5, grip: 0.5, mud: 0.5,
    quirk: { clip: 'Peekaboo', chance: 0.25 },
    note: 'てさきが きようで ちょこまか はしる',
  },
  // こおりと みずの レース
  polar_bear: {
    speed: 40, stamina: 0.5, accel: 0.6, agility: 0.5, jump: 0.5, swim: 10, grip: 1, mud: 0.4,
    quirk: { clip: 'Stand', chance: 0.14 },
    note: 'こおりの うえでも すべらない あしの うら',
  },
  penguin: {
    speed: 7, stamina: 0.7, accel: 0.6, agility: 0.5, jump: 0.3, swim: 28, grip: 0.8, mud: 0.3, slide: 15,
    quirk: { clip: 'Flap', chance: 0.18 },
    note: 'あるくのは ゆっくり。でも およぐと とっても はやい',
  },
  capybara: {
    speed: 35, stamina: 0.45, accel: 0.55, agility: 0.5, jump: 0.4, swim: 14, grip: 0.45, mud: 0.7,
    quirk: { clip: 'Shake', chance: 0.2 },
    note: 'およぎが じょうずな のんびりやさん',
  },
  crocodile: {
    speed: 17, stamina: 0.45, accel: 0.8, agility: 0.3, jump: 0.1, swim: 32, grip: 0.45, mud: 0.8, slide: 12,
    quirk: { clip: 'Bask', chance: 0.25 },
    note: 'みずの なかは すいすい。りくは にがて',
  },
  flamingo: {
    speed: 35, stamina: 0.6, accel: 0.6, agility: 0.5, jump: 0.5, swim: 18, grip: 0.4, mud: 0.6,
    quirk: { clip: 'Display', chance: 0.18 },
    note: 'ながい あしで あさい みずも じゃぶじゃぶ',
  },
  // どろんこ グランプリ
  rhino: {
    speed: 50, stamina: 0.35, accel: 0.6, agility: 0.35, jump: 0.3, swim: 4, grip: 0.4, mud: 0.8,
    quirk: { clip: 'Paw', chance: 0.18 },
    note: 'おもそうだけど はやい。どろあびが だいすき',
  },
  bear: {
    speed: 56, stamina: 0.3, accel: 0.8, agility: 0.6, jump: 0.55, swim: 6, grip: 0.6, mud: 0.55,
    quirk: { clip: 'Stand', chance: 0.18 },
    note: 'みじかい きょりは とても はやい',
  },
  hippo: {
    speed: 30, stamina: 0.45, accel: 0.5, agility: 0.3, jump: 0.2, swim: 8, grip: 0.4, mud: 1,
    quirk: { clip: 'Yawn', chance: 0.2 },
    note: 'どろんこの なかでも へっちゃら',
  },
  elephant: {
    speed: 35, stamina: 0.7, accel: 0.35, agility: 0.25, jump: 0.15, swim: 5, grip: 0.5, mud: 0.85,
    quirk: { clip: 'Trumpet', chance: 0.18 },
    note: 'いちばん おおきい。ずんずん すすむ',
  },
  gorilla: {
    speed: 40, stamina: 0.4, accel: 0.7, agility: 0.6, jump: 0.5, swim: 2, grip: 0.6, mud: 0.6,
    quirk: { clip: 'ChestBeat', chance: 0.22 },
    note: 'うでも つかって ドドドッと はしる',
  },
  // ぴょんぴょん ハードル
  kangaroo: {
    speed: 56, stamina: 0.55, accel: 0.7, agility: 0.5, jump: 1, swim: 4, grip: 0.4, mud: 0.3,
    quirk: { clip: 'Box', chance: 0.2 },
    note: 'ジャンプの めいじん。ハードルも ひとっとび',
  },
  rabbit: {
    speed: 45, stamina: 0.45, accel: 0.95, agility: 0.85, jump: 0.95, swim: 2, grip: 0.4, mud: 0.2,
    quirk: { clip: 'Stand', chance: 0.2 },
    note: 'すばやく はねる。でも どろんこは きらい',
  },
  goat: {
    speed: 32, stamina: 0.6, accel: 0.8, agility: 0.9, jump: 0.95, swim: 3, grip: 0.7, mud: 0.5,
    quirk: { clip: 'Bleat', chance: 0.2 },
    note: 'がけも のぼれる ジャンプの たつじん',
  },
  monkey: {
    speed: 30, stamina: 0.45, accel: 0.75, agility: 0.85, jump: 0.85, swim: 4, grip: 0.5, mud: 0.4,
    quirk: { clip: 'Scratch', chance: 0.18 },
    note: 'ハードルを てで つかんで のりこえる',
  },
  meerkat: {
    speed: 32, stamina: 0.5, accel: 0.9, agility: 0.95, jump: 0.45, swim: 1, grip: 0.4, mud: 0.4,
    quirk: { clip: 'Sentry', chance: 0.28 },
    note: 'ちいさくて すばしっこい。でも ハードルは たかい',
  },
  pig: {
    speed: 18, stamina: 0.55, accel: 0.6, agility: 0.5, jump: 0.35, swim: 4, grip: 0.4, mud: 1,
    quirk: { clip: 'Root', chance: 0.2 },
    note: 'どろんこが だいすき。ぬかるみで おいあげる',
  },
}
