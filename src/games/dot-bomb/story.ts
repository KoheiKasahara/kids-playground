// ストーリーの おはなし。ワールドの はじめ・ボスの まえ・ボスを たおした あと・エンディングで ながれる。

import type { RideColor, WorldId } from './stages'

export type Speaker = 'pon' | 'elder' | 'king' | 'pyonta' | 'narrator' | 'puni' | 'worm' | 'penguin' | 'dragon'

export type Line = { who: Speaker; text: string; color?: RideColor }

export type SceneBg = WorldId | 'village' | 'ending'

export type StoryScene = {
  id: string
  bg: SceneBg
  /** ぶたいに たつ キャラ（ひだりから じゅんに）。 */
  cast: Speaker[]
  lines: Line[]
  music: 'map' | 'boss' | 'ending'
}

export const SPEAKER_NAMES: Record<Speaker, string> = {
  pon: 'ポン', elder: 'ちょうろう', king: 'ガラクタだいおう', pyonta: 'ピョンタ', narrator: '',
  puni: 'キングプニ', worm: 'ズズ', penguin: 'ペンギンしょうぐん', dragon: 'ボルカ',
}

export const STORY: Record<string, StoryScene> = {
  prologue: {
    id: 'prologue', bg: 'village', cast: ['pon', 'elder', 'king'], music: 'map',
    lines: [
      { who: 'narrator', text: 'ここは ピョンタの むら。ふしぎな いきもの ピョンタと、ボンを つかう ポンが なかよく くらしていました。' },
      { who: 'elder', text: 'たいへんじゃ〜！ ピョンタの たまごが ひとつも ないぞ！' },
      { who: 'pon', text: 'えっ！？ だれが そんな ことを！？' },
      { who: 'king', text: 'ガッハッハ！ たまごは ぜんぶ ワシが もらった！ ワシの おしろの たからものに するのじゃ！' },
      { who: 'king', text: 'とりかえしたければ ガラクタじょう まで くるが よい！ さらばじゃ〜！' },
      { who: 'pon', text: 'まてー！ ぼくの ボンで みちを ひらいて、たまごを とりかえすぞ！' },
      { who: 'elder', text: 'ポンよ、ボンを おいたら すぐ はなれるのじゃ。ブロックの なかに たまごが かくれて おるかも しれん。' },
      { who: 'elder', text: 'たまごを みつけたら のってみるのじゃ！ きっと ちからに なってくれる。' },
    ],
  },
  'boss-forest': {
    id: 'boss-forest', bg: 'forest', cast: ['pon', 'puni'], music: 'boss',
    lines: [
      { who: 'puni', text: 'プニプニ〜！ この もりは とおさないプニ！ きんいろの たまごは わたさないプニ！' },
      { who: 'pon', text: 'おおきい！ でも まけないぞ！' },
      { who: 'narrator', text: 'キングプニは とびはねて おちてくる。あかい しるしから はなれて、おりた ところに ボンを おこう！' },
    ],
  },
  'clear-forest': {
    id: 'clear-forest', bg: 'forest', cast: ['pon', 'pyonta', 'puni'], music: 'map',
    lines: [
      { who: 'puni', text: 'プ、プニ〜… まいったプニ…' },
      { who: 'pon', text: 'きんいろの たまごを とりかえしたよ！ のこりは あと 4つ！' },
      { who: 'pyonta', text: 'ピョン！ ピョン！', color: 'green' },
      { who: 'narrator', text: 'たまごの あしあとは あつい さばくへ つづいている…' },
    ],
  },
  'intro-desert': {
    id: 'intro-desert', bg: 'desert', cast: ['pon', 'pyonta'], music: 'map',
    lines: [
      { who: 'pon', text: 'あつ〜い！ すなの なかに ふしぎな つぼが あるよ。' },
      { who: 'narrator', text: 'つぼに のると、もう ひとつの おなじ すうじの つぼへ ワープするよ。' },
      { who: 'pyonta', text: 'ピョピョン！（あおい ピョンタは ボンを けとばせるよ！）', color: 'blue' },
    ],
  },
  'boss-desert': {
    id: 'boss-desert', bg: 'desert', cast: ['pon', 'worm'], music: 'boss',
    lines: [
      { who: 'worm', text: 'ズズズ… すなの なかから ねらって いるぞ…' },
      { who: 'pon', text: 'じめんが ゆれてる！ でてきた ときが チャンスだ！' },
      { who: 'narrator', text: 'すなが もりあがったら はなれよう。かおを だしている あいだに ボンで ドカーン！' },
    ],
  },
  'clear-desert': {
    id: 'clear-desert', bg: 'desert', cast: ['pon', 'pyonta', 'worm'], music: 'map',
    lines: [
      { who: 'worm', text: 'ズ、ズズ〜… めが まわる〜…' },
      { who: 'pon', text: '2つめの きんいろの たまご！' },
      { who: 'narrator', text: 'つぎは つめたい こおりの くにだ…' },
    ],
  },
  'intro-ice': {
    id: 'intro-ice', bg: 'ice', cast: ['pon', 'pyonta'], music: 'map',
    lines: [
      { who: 'pon', text: 'さむ〜い！ ゆかが つるつる すべるよ！' },
      { who: 'narrator', text: 'こおりの うえでは てを はなしても すこし すべるよ。' },
      { who: 'pyonta', text: 'ピョーン！（ピンクの ピョンタは ブロックを とびこえられるよ！）', color: 'pink' },
    ],
  },
  'boss-ice': {
    id: 'boss-ice', bg: 'ice', cast: ['pon', 'penguin'], music: 'boss',
    lines: [
      { who: 'penguin', text: 'ペーン！ わがはいの すべりこみを うけてみよ！' },
      { who: 'pon', text: 'かべに ぶつかって ふらふらの ときが ねらいめだ！' },
    ],
  },
  'clear-ice': {
    id: 'clear-ice', bg: 'ice', cast: ['pon', 'pyonta', 'penguin'], music: 'map',
    lines: [
      { who: 'penguin', text: 'ぺ、ペーン… まいったでござる…' },
      { who: 'pon', text: '3つめ！ あと すこしだ！' },
      { who: 'narrator', text: 'つぎは あつい あつい かざんだ…' },
    ],
  },
  'intro-volcano': {
    id: 'intro-volcano', bg: 'volcano', cast: ['pon', 'pyonta'], music: 'map',
    lines: [
      { who: 'pon', text: 'あちち！ ゆかの あなから ひが ふきだしてる！' },
      { who: 'narrator', text: 'あなが あかく ひかったら ちゅうい！ はなれて まとう。てきを さそいこむのも いいね。' },
      { who: 'pyonta', text: 'ピョピョ！（きいろの ピョンタは ボンを まっすぐ いっきに ならべられるよ！）', color: 'yellow' },
    ],
  },
  'boss-volcano': {
    id: 'boss-volcano', bg: 'volcano', cast: ['pon', 'dragon'], music: 'boss',
    lines: [
      { who: 'dragon', text: 'ボルルル！ ほのおの ちからを みせてやる！' },
      { who: 'pon', text: 'そらを とんでいる ときは ボンが とどかない… おりてきた ときを ねらおう！' },
    ],
  },
  'clear-volcano': {
    id: 'clear-volcano', bg: 'volcano', cast: ['pon', 'pyonta', 'dragon'], music: 'map',
    lines: [
      { who: 'dragon', text: 'ボ、ボルル… あつく なりすぎた…' },
      { who: 'pon', text: '4つめ！ のこるは ガラクタじょう だけだ！' },
    ],
  },
  'intro-castle': {
    id: 'intro-castle', bg: 'castle', cast: ['pon', 'pyonta'], music: 'map',
    lines: [
      { who: 'pon', text: 'ここが ガラクタじょう…！ ゆかが うごいてる！' },
      { who: 'narrator', text: 'ベルトコンベアに のると ながされるよ。おいた ボンも ながれていくよ。' },
    ],
  },
  'boss-castle': {
    id: 'boss-castle', bg: 'castle', cast: ['pon', 'king'], music: 'boss',
    lines: [
      { who: 'king', text: 'よくぞ ここまで きたな！ ワシの さいきょうロボ「ガラクタン」で あいてを してやる！' },
      { who: 'pon', text: 'たまごを かえしてもらうぞ！' },
    ],
  },
  ending: {
    id: 'ending', bg: 'ending', cast: ['pon', 'king', 'elder'], music: 'ending',
    lines: [
      { who: 'king', text: 'ま、まいった〜… ワシの まけじゃ…' },
      { who: 'pon', text: 'ねえ、どうして たまごを もっていったの？' },
      { who: 'king', text: 'ワシは ずっと ひとりぼっちで… いっしょに あそぶ なかまが ほしかったんじゃ…' },
      { who: 'elder', text: 'それなら ピョンタの むらで いっしょに くらせば よいのじゃ。' },
      { who: 'king', text: 'い、いいのか…！？ ありがとう…！ たまごは ぜんぶ かえすぞ！' },
      { who: 'narrator', text: 'たまごは ぶじに むらへ かえり、たくさんの ピョンタが うまれました。' },
      { who: 'pon', text: 'みんなで あそぼう！ ピョーン！' },
      { who: 'narrator', text: 'おしまい。あそんでくれて ありがとう！' },
    ],
  },
}

/** ステージを はじめる まえに みせる おはなし。 */
export function sceneBefore(stageId: string): string | null {
  switch (stageId) {
    case '1-1': return 'prologue'
    case '1-3': return 'boss-forest'
    case '2-1': return 'intro-desert'
    case '2-3': return 'boss-desert'
    case '3-1': return 'intro-ice'
    case '3-3': return 'boss-ice'
    case '4-1': return 'intro-volcano'
    case '4-3': return 'boss-volcano'
    case '5-1': return 'intro-castle'
    case '5-3': return 'boss-castle'
    default: return null
  }
}

/** ステージを クリアした あとに みせる おはなし。 */
export function sceneAfter(stageId: string): string | null {
  switch (stageId) {
    case '1-3': return 'clear-forest'
    case '2-3': return 'clear-desert'
    case '3-3': return 'clear-ice'
    case '4-3': return 'clear-volcano'
    case '5-3': return 'ending'
    default: return null
  }
}
