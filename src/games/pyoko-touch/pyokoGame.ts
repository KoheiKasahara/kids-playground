// ぴょこぴょこタッチの純粋ロジック（出現・消滅・得点のルール）。
// タイマーやDOMを持たず「経過時間をdeltaMsだけ進めると次の状態が決まる」形にすることで、
// 画面を描画せずに反射あそびのルールそのものをテストできる。

export type PyokoDifficulty = 'easy' | 'fast'

/** つかまえる相手か、さわると もどってしまう相手か。色以外の手がかりとして絵柄と名前も持つ。 */
export type CreatureKind = 'friend' | 'bee'

export type Creature = {
  emoji: string
  name: string
  kind: CreatureKind
}

/** 穴から顔を出すなかま。読み上げ・aria-labelにも使うのでひらがな中心の名前を添える。 */
export const FRIENDS: readonly Creature[] = [
  { emoji: '🐹', name: 'ハムスター', kind: 'friend' },
  { emoji: '🐰', name: 'うさぎ', kind: 'friend' },
  { emoji: '🐸', name: 'かえる', kind: 'friend' },
  { emoji: '🐿️', name: 'りす', kind: 'friend' },
  { emoji: '🐱', name: 'ねこ', kind: 'friend' },
  { emoji: '🐤', name: 'ひよこ', kind: 'friend' },
]

/** さわると1てん もどってしまう相手。ぶつかっても責めない柔らかい扱いにする。 */
export const BEE: Creature = { emoji: '🐝', name: 'はち', kind: 'bee' }

/** 穴の数。縦画面で3列に並べたいので3の倍数にする。 */
export const HOLE_COUNT = 9

export type DifficultySetting = {
  /** 1回のあそびの長さ[ms]。 */
  durationMs: number
  /** 次に顔を出すまでの間隔[ms]の下限・上限。 */
  spawnIntervalMs: readonly [number, number]
  /** 顔を出しつづける時間[ms]の下限・上限。 */
  visibleMs: readonly [number, number]
  /** 同時に顔を出せる数。 */
  maxVisible: number
  /** はちが混ざる割合（0〜1）。 */
  beeRate: number
}

export const DIFFICULTY_SETTINGS: Record<PyokoDifficulty, DifficultySetting> = {
  easy: {
    durationMs: 30_000,
    spawnIntervalMs: [900, 1400],
    visibleMs: [1700, 2300],
    maxVisible: 1,
    beeRate: 0,
  },
  fast: {
    durationMs: 30_000,
    spawnIntervalMs: [500, 900],
    visibleMs: [1000, 1500],
    maxVisible: 2,
    beeRate: 0.3,
  },
}

/** 顔を出している / つかまえた / さわってしまった / にげられた の4状態。 */
export type PopStatus = 'up' | 'caught' | 'oops' | 'gone'

export type Pop = {
  id: number
  holeIndex: number
  creature: Creature
  status: PopStatus
  /** このelapsedMsを過ぎたら次へ進む（up→gone、それ以外→穴から消える）。 */
  untilMs: number
}

export type PyokoState = {
  elapsedMs: number
  pops: readonly Pop[]
  nextSpawnAtMs: number
  nextPopId: number
  score: number
}

/** つかまえた/にげられた あとの余韻[ms]。タップの手ごたえを目で確かめられる長さにする。 */
export const FEEDBACK_MS = 400

/** 穴が埋まっていて出せなかったときに、次に出現を試すまでの時間[ms]。 */
const SPAWN_RETRY_MS = 200

/** はじめの1ぴきが出るまでの間[ms]。画面を見る前に出て取り逃すことがないようにする。 */
const FIRST_SPAWN_DELAY_MS = 800

function pickInRange(range: readonly [number, number], randomFn: () => number): number {
  const [min, max] = range
  return Math.round(min + randomFn() * (max - min))
}

export function createInitialState(): PyokoState {
  return {
    elapsedMs: 0,
    pops: [],
    nextSpawnAtMs: FIRST_SPAWN_DELAY_MS,
    nextPopId: 1,
    score: 0,
  }
}

export function isFinished(state: PyokoState, difficulty: PyokoDifficulty): boolean {
  return state.elapsedMs >= DIFFICULTY_SETTINGS[difficulty].durationMs
}

/** のこり秒数（切り上げ）。0より下には行かない。 */
export function remainingSeconds(state: PyokoState, difficulty: PyokoDifficulty): number {
  const rest = DIFFICULTY_SETTINGS[difficulty].durationMs - state.elapsedMs
  return Math.max(0, Math.ceil(rest / 1000))
}

/** まだ何も入っていない穴の番号。 */
function freeHoles(pops: readonly Pop[]): number[] {
  const used = new Set(pops.map((pop) => pop.holeIndex))
  const free: number[] = []
  for (let index = 0; index < HOLE_COUNT; index += 1) {
    if (!used.has(index)) free.push(index)
  }
  return free
}

function pickCreature(setting: DifficultySetting, randomFn: () => number): Creature {
  if (randomFn() < setting.beeRate) return BEE
  const index = Math.min(FRIENDS.length - 1, Math.floor(randomFn() * FRIENDS.length))
  return FRIENDS[index]!
}

/**
 * 時間をdeltaMsだけ進めた次の状態を返す。
 * 「顔を出す→引っこむ→消える」と出現の間隔だけを扱い、得点の加算はtouchHoleに任せる。
 */
export function advance(
  state: PyokoState,
  difficulty: PyokoDifficulty,
  deltaMs: number,
  randomFn: () => number = Math.random,
): PyokoState {
  const setting = DIFFICULTY_SETTINGS[difficulty]
  const elapsedMs = state.elapsedMs + deltaMs

  // 出たままの時間が過ぎたものは「にげた」へ。余韻の終わったものは穴から消す。
  const pops = state.pops
    .map((pop) =>
      pop.status === 'up' && elapsedMs >= pop.untilMs
        ? { ...pop, status: 'gone' as const, untilMs: elapsedMs + FEEDBACK_MS }
        : pop,
    )
    .filter((pop) => pop.status === 'up' || elapsedMs < pop.untilMs)

  if (elapsedMs >= setting.durationMs || elapsedMs < state.nextSpawnAtMs) {
    return { ...state, elapsedMs, pops }
  }

  const visibleCount = pops.filter((pop) => pop.status === 'up').length
  const candidates = freeHoles(pops)
  if (visibleCount >= setting.maxVisible || candidates.length === 0) {
    // 穴が空くまで少し待ってから、また出現を試す。
    return { ...state, elapsedMs, pops, nextSpawnAtMs: elapsedMs + SPAWN_RETRY_MS }
  }

  const holeIndex = candidates[Math.min(candidates.length - 1, Math.floor(randomFn() * candidates.length))]!
  const pop: Pop = {
    id: state.nextPopId,
    holeIndex,
    creature: pickCreature(setting, randomFn),
    status: 'up',
    untilMs: elapsedMs + pickInRange(setting.visibleMs, randomFn),
  }

  return {
    ...state,
    elapsedMs,
    pops: [...pops, pop],
    nextSpawnAtMs: elapsedMs + pickInRange(setting.spawnIntervalMs, randomFn),
    nextPopId: state.nextPopId + 1,
  }
}

export type TouchResult = 'friend' | 'bee' | 'none'

/**
 * 穴をタッチしたときの結果。
 * なかまなら1てん、はちなら1てん もどる（0てんより下がらない）。空の穴は何も起きない。
 */
export function touchHole(state: PyokoState, holeIndex: number): { state: PyokoState; result: TouchResult } {
  const target = state.pops.find((pop) => pop.holeIndex === holeIndex && pop.status === 'up')
  if (!target) return { state, result: 'none' }

  const caught = target.creature.kind === 'friend'
  const pops = state.pops.map((pop) =>
    pop.id === target.id
      ? { ...pop, status: caught ? ('caught' as const) : ('oops' as const), untilMs: state.elapsedMs + FEEDBACK_MS }
      : pop,
  )

  return {
    state: {
      ...state,
      pops,
      score: caught ? state.score + 1 : Math.max(0, state.score - 1),
    },
    result: caught ? 'friend' : 'bee',
  }
}

/** 結果画面のひとこと。点数だけでなく記号と文言でも達成感を伝える。 */
export function judge(score: number): { emoji: string; message: string } {
  if (score >= 20) return { emoji: '🏆', message: 'タッチめいじん！' }
  if (score >= 10) return { emoji: '🎉', message: 'じょうずに つかまえたね！' }
  return { emoji: '🐾', message: 'もういちど あそぼう！' }
}
