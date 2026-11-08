/**
 * かぞえて！どうぶつパレード の進行ロジック（画面を持たない純粋関数）。
 *
 * パレードで とおりすぎる どうぶつの なかから、おだいの どうぶつだけを かぞえる。
 * きみ と あいての 3びきが かぞえた かずを だしあい、ぴったりなら 🏅 を 1こ もらえる。
 * さいごの ラウンドが おわったとき 🏅 が いちばん おおいと 1い。
 * 乱数は呼出元から受け取り、テストでは決め打ちできるようにする。
 */

export type Rng = () => number

export type Difficulty = 'easy' | 'hard'

export type ParadeAnimal = { id: string; name: string; emoji: string }

/** パレードに でてくる どうぶつ。かたちの ちがいで 見わけられる ものだけを ならべる。 */
export const PARADE_ANIMALS: readonly ParadeAnimal[] = [
  { id: 'usagi', name: 'うさぎ', emoji: '🐇' },
  { id: 'buta', name: 'ぶた', emoji: '🐖' },
  { id: 'niwatori', name: 'にわとり', emoji: '🐓' },
  { id: 'zou', name: 'ぞう', emoji: '🐘' },
  { id: 'hitsuji', name: 'ひつじ', emoji: '🐑' },
  { id: 'saru', name: 'さる', emoji: '🐒' },
]

export type PlayerId = 'me' | 'panda' | 'kitsune' | 'kaeru'
export type CpuId = Exclude<PlayerId, 'me'>

export type PlayerDef = {
  id: PlayerId
  name: string
  emoji: string
  /** あいての まちがえやすさの倍率（きみは つかわない）。 */
  slip: number
}

export const PLAYERS: readonly PlayerDef[] = [
  { id: 'me', name: 'きみ', emoji: '🐥', slip: 0 },
  { id: 'panda', name: 'パンダ', emoji: '🐼', slip: 0.7 },
  { id: 'kitsune', name: 'きつね', emoji: '🦊', slip: 1.4 },
  { id: 'kaeru', name: 'かえる', emoji: '🐸', slip: 1 },
]

const CPU_PLAYERS = PLAYERS.filter((def): def is PlayerDef & { id: CpuId } => def.id !== 'me')

type Range = readonly [min: number, max: number]

export type DifficultySettings = {
  /** ラウンドごとの おだいの かず（この ならびの ながさが ラウンドの かず）。 */
  targetCounts: readonly Range[]
  /** ラウンドごとの ほかの どうぶつの かず。 */
  decoyCounts: readonly Range[]
  /** ほかの どうぶつの しゅるい。 */
  decoyKinds: number
  /** とおりみちの かず。2つめの みちは はんたいむきに すすむ。 */
  lanes: number
  /** みちごとの よこぎる時間[ms]。 */
  crossMs: readonly number[]
  /** つぎの どうぶつが でてくるまでの間[ms]。おなじ みちでは gapMinMs より つめない。 */
  gapMinMs: number
  gapMaxMs: number
  /** 2つの みちで いっしょに でてくる確率。 */
  pairChance: number
  /** あいてが おだいを みおとす・ほかの どうぶつを かぞえる・2かい かぞえる 確率。 */
  cpuMiss: number
  cpuWrong: number
  cpuDouble: number
}

export const DIFFICULTY_SETTINGS: Readonly<Record<Difficulty, DifficultySettings>> = {
  easy: {
    targetCounts: [[2, 3], [2, 4], [3, 5], [3, 6], [4, 7]],
    decoyCounts: [[1, 2], [1, 3], [2, 3], [2, 4], [2, 4]],
    decoyKinds: 1,
    lanes: 1,
    crossMs: [3400],
    gapMinMs: 950,
    gapMaxMs: 1500,
    pairChance: 0,
    cpuMiss: 0.12,
    cpuWrong: 0.06,
    cpuDouble: 0.03,
  },
  hard: {
    targetCounts: [[3, 5], [4, 6], [4, 7], [5, 8], [6, 9]],
    decoyCounts: [[2, 3], [3, 4], [3, 5], [4, 6], [4, 7]],
    decoyKinds: 2,
    lanes: 2,
    crossMs: [2500, 2100],
    gapMinMs: 520,
    gapMaxMs: 1000,
    pairChance: 0.3,
    cpuMiss: 0.07,
    cpuWrong: 0.05,
    cpuDouble: 0.03,
  },
}

/** おだいを みせてから パレードが はじまるまで[ms]。 */
export const SHOW_MS = 2400
/** パレードの さいしょの どうぶつが でてくるまで[ms]。 */
export const LEAD_IN_MS = 300
/** さいごの どうぶつが いなくなってから おわるまで[ms]。 */
export const TAIL_MS = 500
/** こたえあわせで 1ぴき ずつ かぞえる間[ms]。 */
export const REVEAL_STEP_MS = 450
/** かぞえおわってから ぴったりかを みせるまで[ms]。 */
export const JUDGE_DELAY_MS = 600
/** かぞえられる いちばん おおきい かず。 */
export const MAX_COUNT = 20
/** あいてが どうぶつを みてから かぞえるまで[ms]。 */
export const CPU_REACT_MIN_MS = 150
export const CPU_REACT_MAX_MS = 450
/** あいてが うっかり 2かい かぞえるときの間[ms]。 */
export const CPU_DOUBLE_GAP_MS = 200
/** 画面の はしの そとで まつ ぶん（ステージの はばに たいする%）。 */
export const EDGE_PERCENT = 10

export type Marcher = {
  /** ラウンドの なかで 一意の番号。 */
  key: number
  /** PARADE_ANIMALS の番号。 */
  animal: number
  lane: number
  /** パレードが はじまってから でてくる時刻[ms]。 */
  startMs: number
  crossMs: number
  /** -1: みぎ → ひだり、1: ひだり → みぎ。 */
  dir: 1 | -1
}

export type Parade = {
  /** おだいの どうぶつ（PARADE_ANIMALS の番号）。 */
  target: number
  targetCount: number
  marchers: readonly Marcher[]
  /** パレードが おわる時刻[ms]。 */
  endMs: number
}

export type Phase = 'show' | 'parade' | 'answer' | 'reveal' | 'over'

export type GameState = {
  difficulty: Difficulty
  round: number
  phase: Phase
  /** いまの phase に入ってからの時間[ms]。 */
  phaseMs: number
  parade: Parade
  /** あいてが かぞえる時刻（パレードの はじまりから[ms]）。この かずが あいての こたえ。 */
  cpuTaps: Readonly<Record<CpuId, readonly number[]>>
  /** きみが かぞえた かず。 */
  myCount: number
  /** OK を おして きまった こたえ。きまるまでは null。 */
  answers: Readonly<Record<PlayerId, number>> | null
  /** ぴったりで もらった 🏅 の かず。 */
  medals: Readonly<Record<PlayerId, number>>
  /** こたえあわせが おわったか。 */
  judged: boolean
}

export type GameEvent = 'show' | 'go' | 'stop' | 'count' | 'correct' | 'miss' | 'win' | 'lose'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const randInt = (rng: Rng, n: number) => Math.min(n - 1, Math.floor(rng() * n))
const randRange = (rng: Rng, [min, max]: Range) => min + randInt(rng, max - min + 1)

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1)
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

export const roundCount = (difficulty: Difficulty): number => DIFFICULTY_SETTINGS[difficulty].targetCounts.length

/** どうぶつが ステージの まんなかを とおる時刻[ms]。 */
export const passTime = (marcher: Marcher): number => marcher.startMs + marcher.crossMs / 2

/** そのラウンドの パレードを つくる。おなじ みちの どうぶつは かさならないよう 間を あける。 */
export function createParade(difficulty: Difficulty, round: number, rng: Rng): Parade {
  const settings = DIFFICULTY_SETTINGS[difficulty]
  const index = clamp(round, 1, settings.targetCounts.length) - 1
  const target = randInt(rng, PARADE_ANIMALS.length)
  const others = shuffle(
    PARADE_ANIMALS.map((_, i) => i).filter((i) => i !== target),
    rng,
  ).slice(0, settings.decoyKinds)
  const targetCount = randRange(rng, settings.targetCounts[index]!)
  const decoyCount = randRange(rng, settings.decoyCounts[index]!)
  const kinds = shuffle(
    [
      ...Array.from({ length: targetCount }, () => target),
      ...Array.from({ length: decoyCount }, (_, i) => others[i % others.length]!),
    ],
    rng,
  )

  const laneFree = Array.from({ length: settings.lanes }, () => LEAD_IN_MS)
  let nextStart = LEAD_IN_MS
  let previousStart = LEAD_IN_MS
  let pairLane: number | null = null
  const marchers = kinds.map((animal, key): Marcher => {
    const lane = pairLane ?? randInt(rng, settings.lanes)
    const start = Math.max(pairLane === null ? nextStart : previousStart, laneFree[lane]!)
    pairLane = settings.lanes > 1 && rng() < settings.pairChance ? (lane + 1) % settings.lanes : null
    laneFree[lane] = start + settings.gapMinMs
    previousStart = start
    nextStart = start + settings.gapMinMs + rng() * (settings.gapMaxMs - settings.gapMinMs)
    return { key, animal, lane, startMs: Math.round(start), crossMs: settings.crossMs[lane]!, dir: lane % 2 === 0 ? -1 : 1 }
  })
  const endMs = Math.max(...marchers.map((marcher) => marcher.startMs + marcher.crossMs)) + TAIL_MS
  return { target, targetCount, marchers, endMs }
}

/**
 * パレードの はじまりから t[ms] の ときの よこの いち（ステージの はばに たいする%、まんなかが 50）。
 * まだ でていない・もう いなくなった ときは null。
 */
export function marcherX(marcher: Marcher, t: number): number | null {
  const progress = (t - marcher.startMs) / marcher.crossMs
  if (progress < 0 || progress > 1) return null
  const travelled = (100 + EDGE_PERCENT * 2) * progress
  return marcher.dir === -1 ? 100 + EDGE_PERCENT - travelled : -EDGE_PERCENT + travelled
}

/** あいてが かぞえる時刻を きめる。みおとし・ほかの どうぶつ・2かい かぞえる まちがいが まざる。 */
export function planCpuTaps(difficulty: Difficulty, parade: Parade, rng: Rng): Record<CpuId, number[]> {
  const settings = DIFFICULTY_SETTINGS[difficulty]
  const order = [...parade.marchers].sort((a, b) => passTime(a) - passTime(b))
  const plans = {} as Record<CpuId, number[]>
  for (const def of CPU_PLAYERS) {
    const taps: number[] = []
    for (const marcher of order) {
      const at = Math.round(passTime(marcher) + CPU_REACT_MIN_MS + rng() * (CPU_REACT_MAX_MS - CPU_REACT_MIN_MS))
      if (marcher.animal === parade.target) {
        if (rng() < settings.cpuMiss * def.slip) continue
        taps.push(at)
        if (rng() < settings.cpuDouble * def.slip) taps.push(at + CPU_DOUBLE_GAP_MS)
      } else if (rng() < settings.cpuWrong * def.slip) {
        taps.push(at)
      }
    }
    plans[def.id] = taps.sort((a, b) => a - b)
  }
  return plans
}

const noMedals = (): Record<PlayerId, number> => ({ me: 0, panda: 0, kitsune: 0, kaeru: 0 })

function startRound(difficulty: Difficulty, round: number, medals: Readonly<Record<PlayerId, number>>, rng: Rng): GameState {
  const parade = createParade(difficulty, round, rng)
  return {
    difficulty,
    round,
    phase: 'show',
    phaseMs: 0,
    parade,
    cpuTaps: planCpuTaps(difficulty, parade, rng),
    myCount: 0,
    answers: null,
    medals,
    judged: false,
  }
}

export function createInitialState(difficulty: Difficulty, rng: Rng): GameState {
  return startRound(difficulty, 1, noMedals(), rng)
}

/** きみが かぞえる（+1）・へらす（-1）。パレードの あいだと こたえを きめる あいだだけ。 */
export function changeCount(state: GameState, delta: number): GameState {
  if (state.phase !== 'parade' && state.phase !== 'answer') return state
  const myCount = clamp(state.myCount + delta, 0, MAX_COUNT)
  return myCount === state.myCount ? state : { ...state, myCount }
}

/** こたえを きめて、こたえあわせへ。 */
export function confirmAnswer(state: GameState): GameState {
  if (state.phase !== 'answer') return state
  const answers = { me: state.myCount } as Record<PlayerId, number>
  for (const def of CPU_PLAYERS) answers[def.id] = state.cpuTaps[def.id].length
  return { ...state, phase: 'reveal', phaseMs: 0, answers }
}

/** こたえあわせで いま なんびき めまで かぞえたか。 */
export function revealedCount(state: GameState): number {
  if (state.phase !== 'reveal') return 0
  return Math.min(state.parade.targetCount, Math.floor(state.phaseMs / REVEAL_STEP_MS))
}

/** ぴったりかを みせる時刻（こたえあわせが はじまってから[ms]）。 */
export const judgeAtMs = (targetCount: number): number => targetCount * REVEAL_STEP_MS + JUDGE_DELAY_MS

export function isExact(state: GameState, id: PlayerId): boolean {
  return state.answers !== null && state.answers[id] === state.parade.targetCount
}

/** パレードの あいだ、あいてが いま かぞえた ところか（画面で ぴょこっと うごかす）。 */
export function cpuTappedWithin(state: GameState, id: CpuId, windowMs: number): boolean {
  if (state.phase !== 'parade') return false
  return state.cpuTaps[id].some((at) => at <= state.phaseMs && state.phaseMs - at < windowMs)
}

function judge(state: GameState): { state: GameState; events: GameEvent[] } {
  const medals = { ...state.medals }
  for (const def of PLAYERS) if (isExact(state, def.id)) medals[def.id] += 1
  return { state: { ...state, judged: true, medals }, events: [isExact(state, 'me') ? 'correct' : 'miss'] }
}

/** ゲームを dtMs だけ すすめる。音や振動の きっかけは events で返す。 */
export function advance(state: GameState, dtMs: number): { state: GameState; events: GameEvent[] } {
  const now = state.phaseMs + dtMs
  switch (state.phase) {
    case 'show':
      if (now >= SHOW_MS) return { state: { ...state, phase: 'parade', phaseMs: 0 }, events: ['go'] }
      return { state: { ...state, phaseMs: now }, events: [] }
    case 'parade':
      if (now >= state.parade.endMs) return { state: { ...state, phase: 'answer', phaseMs: 0 }, events: ['stop'] }
      return { state: { ...state, phaseMs: now }, events: [] }
    case 'reveal': {
      if (state.judged) return { state, events: [] }
      const next = { ...state, phaseMs: now }
      const events: GameEvent[] = revealedCount(next) > revealedCount(state) ? ['count'] : []
      if (now < judgeAtMs(state.parade.targetCount)) return { state: next, events }
      const judged = judge(next)
      return { state: judged.state, events: [...events, ...judged.events] }
    }
    case 'answer':
    case 'over':
      // こたえを きめるのは じぶんの ペースで。時間は すすめない。
      return { state, events: [] }
  }
}

/** こたえあわせの あと、つぎの ラウンドへ。さいごの ラウンドなら けっかへ。 */
export function nextRound(state: GameState, rng: Rng): { state: GameState; events: GameEvent[] } {
  if (state.phase !== 'reveal' || !state.judged) return { state, events: [] }
  if (state.round < roundCount(state.difficulty)) {
    return { state: startRound(state.difficulty, state.round + 1, state.medals, rng), events: ['show'] }
  }
  const over: GameState = { ...state, phase: 'over', phaseMs: 0 }
  return { state: over, events: [rankOf(over, 'me') === 1 ? 'win' : 'lose'] }
}

/** じゅんい（1から）。🏅 が おなじなら おなじ じゅんい。 */
export function rankOf(state: GameState, id: PlayerId): number {
  const mine = state.medals[id]
  return 1 + PLAYERS.filter((def) => state.medals[def.id] > mine).length
}

/** けっかの ならび（じゅんい順。おなじ じゅんいなら きみが さき）。 */
export function standings(state: GameState): { id: PlayerId; rank: number; medals: number }[] {
  return PLAYERS.map((def) => ({ id: def.id, rank: rankOf(state, def.id), medals: state.medals[def.id] })).sort(
    (a, b) => a.rank - b.rank || (a.id === 'me' ? -1 : b.id === 'me' ? 1 : 0),
  )
}

/** ★の数。🏅 が 1こ以上で 1い=3、2い=2、3い=1。🏅 が 0こ または 4いは 0。 */
export function resultStars(state: GameState): number {
  if (state.medals.me === 0) return 0
  return Math.max(0, 4 - rankOf(state, 'me'))
}
