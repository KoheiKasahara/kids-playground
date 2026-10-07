import { STAGES, type GameEvent, type RecipientId, type World } from './model'

/**
 * Talking to someone switches the map to a picture-book conversation. The lines only
 * dress up what already happened in the world: skipping them never changes the game.
 */
export type Speaker = 'fox' | 'owl' | 'squirrel' | 'rabbit' | 'bear'
export type Partner = Exclude<Speaker, 'fox'>
export type Mood = 'normal' | 'happy' | 'surprised' | 'worried'
export type DialogueLine = { speaker: Speaker; mood: Mood; text: string }
export type Conversation = { partner: Partner; lines: readonly DialogueLine[] }

export const SPEAKER_NAMES: Record<Speaker, string> = {
  fox: 'こぎつね', owl: 'ゆうびんやさん', squirrel: 'りすさん', rabbit: 'うさぎさん', bear: 'くまさん',
}

const GREETINGS = { spring: 'おはよう', summer: 'こんにちは', dusk: 'こんばんは' } as const

const line = (speaker: Speaker, mood: Mood, text: string): DialogueLine => ({ speaker, mood, text })

function postTalk(world: World, event: GameEvent): Conversation {
  const greeting = GREETINGS[STAGES[world.stageIndex].season]
  if (event.type === 'collect') {
    return {
      partner: 'owl',
      lines: world.flags.bridgeRepaired ? [
        line('owl', 'happy', `${greeting}、こぎつねさん！ まってたよ。`),
        line('owl', 'normal', 'りすさんに にもつが とどいているの。'),
        line('fox', 'happy', 'まかせて！ ちゃんと とどけるね！'),
        line('owl', 'happy', 'ありがとう！ はい、にもつだよ。'),
      ] : [
        line('owl', 'happy', `${greeting}、こぎつねさん！ まってたよ。`),
        line('owl', 'worried', 'りすさんに にもつが あるの。でも、かわの はしが こわれているんだ…'),
        line('fox', 'surprised', 'えっ、はしが？'),
        line('fox', 'happy', 'だいじょうぶ！ きのえだで なおしてみる！'),
        line('owl', 'happy', 'たのもしいね！ はい、にもつだよ。'),
      ],
    }
  }
  return {
    partner: 'owl',
    lines: world.delivered.includes('squirrel') ? [
      line('owl', 'happy', 'りすさん、とっても よろこんでいたって！'),
      line('fox', 'happy', 'えへへ、よかった！'),
    ] : [
      line('owl', 'normal', 'にもつ、おねがいね。りすさんが まってるよ。'),
      line('fox', 'happy', 'うん、いってきます！'),
    ],
  }
}

const DELIVERY: Record<RecipientId, readonly [string, string, string]> = {
  squirrel: ['りすさん、おとどけものです！', 'わあ！ わたしに？', 'ありがとう！ おてがみ、うれしいな！'],
  rabbit: ['うさぎさん、にんじん もってきたよ！', 'わあ、おおきな にんじん！', 'ありがとう！ にんじんスープを つくるね！'],
  bear: ['くまさん、りんご もってきたよ！', 'おお、まっかな りんごだ！', 'ありがとう！ りんごを いっしょに たべよう！'],
}

const REQUEST: Record<RecipientId, readonly DialogueLine[]> = {
  squirrel: [
    line('squirrel', 'worried', 'ゆうびんやさんから にもつが とどくはずなんだけど…'),
    line('fox', 'surprised', 'あっ、まだ もらってない！'),
    line('fox', 'happy', 'すぐ とってくるね！'),
    line('squirrel', 'happy', 'ありがとう、まってるね！'),
  ],
  rabbit: [
    line('rabbit', 'worried', 'おなかが ぺこぺこ… にんじんが たべたいなあ。'),
    line('fox', 'happy', 'はたけの にんじん、そだてて くるね！'),
    line('rabbit', 'happy', 'わあ、うれしい！'),
  ],
  bear: [
    line('bear', 'worried', 'あまい りんごが たべたいなあ…'),
    line('fox', 'happy', 'りんごの きから とってくるね！'),
    line('bear', 'happy', 'たのしみに まってるよ。'),
  ],
}

const AFTER: Record<RecipientId, string> = {
  squirrel: 'おてがみ、なんども よんじゃった！',
  rabbit: 'にんじんスープ、ぐつぐつ にているよ！',
  bear: 'りんご、とっても あまかったよ！',
}

function animalTalk(world: World, event: GameEvent, id: RecipientId): Conversation {
  if (event.type === 'deliver' || event.type === 'complete') {
    const [hello, surprise, thanks] = DELIVERY[id]
    const lines = [line('fox', 'happy', hello), line(id, 'surprised', surprise), line(id, 'happy', thanks)]
    if (event.type === 'complete') {
      lines.push(
        line(id, 'normal', 'みんなの ところにも とどけて くれたんだね。'),
        line(id, 'happy', 'すてきな おとどけやさん！'),
        line('fox', 'happy', 'えへへ。みんな にこにこで うれしいな！'),
      )
    }
    return { partner: id, lines }
  }
  if (!STAGES[world.stageIndex].deliveries.includes(id)) {
    return {
      partner: id,
      lines: [
        line(id, 'normal', 'やあ、こぎつねさん。'),
        line(id, 'happy', 'きょうは のんびり おさんぽ しているんだ。'),
        line('fox', 'happy', 'いいね！ また あそぼうね。'),
      ],
    }
  }
  if (world.delivered.includes(id)) {
    return { partner: id, lines: [line(id, 'happy', AFTER[id]), line('fox', 'happy', 'よかった！ また あそぼうね。')] }
  }
  return { partner: id, lines: REQUEST[id] }
}

/** Only the post keeper and the animals talk; picking things up stays on the map. */
export function conversationFor(world: World, event: GameEvent): Conversation | null {
  switch (event.poiId) {
    case 'post': return postTalk(world, event)
    case 'squirrel': case 'rabbit': case 'bear': return animalTalk(world, event, event.poiId)
    default: return null
  }
}

/** Everyone keeps the face they last made while the other one is talking. */
export function moodsAt(conversation: Conversation, index: number): Record<Speaker, Mood> {
  const moods: Record<Speaker, Mood> = { fox: 'normal', owl: 'normal', squirrel: 'normal', rabbit: 'normal', bear: 'normal' }
  for (const { speaker, mood } of conversation.lines.slice(0, index + 1)) moods[speaker] = mood
  return moods
}
