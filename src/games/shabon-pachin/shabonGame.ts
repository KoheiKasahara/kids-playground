// しゃぼんだま パチンの純粋ロジック（しゃぼんだまの出現・上昇・わる判定）。
// タイマーやDOMを持たず「経過時間をdeltaMsだけ進めると次の状態が決まる」形にすることで、
// 画面を描画せずに あそびのルールそのものをテストできる。

export type ShabonMode = 'color' | 'shape'

/** しゃぼんだまの なかみ。いろモードは色、かたちモードは記号で見分ける。 */
export type ShabonKind = {
  id: string
  /** おだい・aria-labelに使うひらがなの名前。 */
  name: string
  /** しゃぼんだまの色。 */
  color: string
  /** しゃぼんだまの中に描く記号。いろモードでは色だけで見分ける。 */
  symbol: string
}

export const COLOR_KINDS: readonly ShabonKind[] = [
  { id: 'red', name: 'あか', color: '#ff6b6b', symbol: '' },
  { id: 'blue', name: 'あお', color: '#4dabf7', symbol: '' },
  { id: 'yellow', name: 'きいろ', color: '#ffd43b', symbol: '' },
  { id: 'green', name: 'みどり', color: '#69db7c', symbol: '' },
]

export const SHAPE_KINDS: readonly ShabonKind[] = [
  { id: 'circle', name: 'まる', color: '#b197fc', symbol: '●' },
  { id: 'triangle', name: 'さんかく', color: '#b197fc', symbol: '▲' },
  { id: 'square', name: 'しかく', color: '#b197fc', symbol: '■' },
  { id: 'star', name: 'ほし', color: '#b197fc', symbol: '★' },
]

export const MODE_KINDS: Record<ShabonMode, readonly ShabonKind[]> = {
  color: COLOR_KINDS,
  shape: SHAPE_KINDS,
}

/** この数だけ おだいの しゃぼんだまを わると クリア。 */
export const GOAL_COUNT = 10
/** この数だけ わるごとに おだいが かわる。 */
export const POPS_PER_TARGET = 3
/** 同時に ただよう しゃぼんだまの上限。 */
export const MAX_FLOATING = 6
/** 次の しゃぼんだまが でるまでの間隔[ms]の下限・上限。 */
export const SPAWN_INTERVAL_MS: readonly [number, number] = [650, 1050]
/** 下から上まで のぼりきる時間[ms]の下限・上限。 */
export const RISE_MS: readonly [number, number] = [5200, 7000]
/** おだいの しゃぼんだまが でる割合（0〜1）。 */
export const TARGET_RATE = 0.45
/** わった しゃぼんだまの はじける演出を のこす時間[ms]。 */
export const POP_EFFECT_MS = 450
/** ちがう しゃぼんだまを さわったときに ぷるぷる ゆれる時間[ms]。 */
export const WOBBLE_MS = 500

export type Bubble = {
  id: number
  kindIndex: number
  /** よこの位置（0=左はし、1=右はし）。 */
  x: number
  bornAt: number
  riseMs: number
  /** わった時刻。わっていなければnull。 */
  poppedAt: number | null
  /** ぷるぷるが おわる時刻。 */
  wobbleUntil: number
}

export type ShabonState = {
  elapsedMs: number
  bubbles: Bubble[]
  nextSpawnAt: number
  nextId: number
  targetIndex: number
  popped: number
  mistakes: number
}

export type TouchResult = 'hit' | 'wrong' | 'none'

function randomBetween([min, max]: readonly [number, number]): number {
  return min + Math.random() * (max - min)
}

function randomIndex(length: number): number {
  return Math.min(length - 1, Math.floor(Math.random() * length))
}

export function createInitialState(mode: ShabonMode): ShabonState {
  return {
    elapsedMs: 0,
    bubbles: [],
    // さいしょの1こは すぐ でるようにして、まつ時間を つくらない。
    nextSpawnAt: 200,
    nextId: 0,
    targetIndex: randomIndex(MODE_KINDS[mode].length),
    popped: 0,
    mistakes: 0,
  }
}

export function isFinished(state: ShabonState): boolean {
  return state.popped >= GOAL_COUNT
}

/** 0（下はし）〜1（上はし）で、しゃぼんだまの のぼりぐあいを返す。 */
export function riseProgress(bubble: Bubble, elapsedMs: number): number {
  return Math.min(1, Math.max(0, (elapsedMs - bubble.bornAt) / bubble.riseMs))
}

function isFloating(bubble: Bubble): boolean {
  return bubble.poppedAt === null
}

function pickKindIndex(state: ShabonState, kindCount: number): number {
  const floatingTarget = state.bubbles.some((b) => isFloating(b) && b.kindIndex === state.targetIndex)
  // おだいが1こも ただよっていないときは かならず おだいを出し、さがしても見つからない時間を つくらない。
  if (!floatingTarget || Math.random() < TARGET_RATE) return state.targetIndex
  const others = Array.from({ length: kindCount }, (_, i) => i).filter((i) => i !== state.targetIndex)
  return others[randomIndex(others.length)]!
}

export function advance(state: ShabonState, mode: ShabonMode, deltaMs: number): ShabonState {
  if (isFinished(state)) return state
  const elapsedMs = state.elapsedMs + deltaMs
  // のぼりきった しゃぼんだま・はじけおわった演出を取りのぞく。
  const bubbles = state.bubbles.filter((bubble) =>
    bubble.poppedAt === null
      ? riseProgress(bubble, elapsedMs) < 1
      : elapsedMs - bubble.poppedAt < POP_EFFECT_MS,
  )
  let next: ShabonState = { ...state, elapsedMs, bubbles }

  if (elapsedMs >= next.nextSpawnAt) {
    const floatingCount = next.bubbles.filter(isFloating).length
    if (floatingCount < MAX_FLOATING) {
      const bubble: Bubble = {
        id: next.nextId,
        kindIndex: pickKindIndex(next, MODE_KINDS[mode].length),
        x: 0.12 + Math.random() * 0.76,
        bornAt: elapsedMs,
        riseMs: randomBetween(RISE_MS),
        poppedAt: null,
        wobbleUntil: 0,
      }
      next = { ...next, bubbles: [...next.bubbles, bubble], nextId: next.nextId + 1 }
    }
    next = { ...next, nextSpawnAt: elapsedMs + randomBetween(SPAWN_INTERVAL_MS) }
  }
  return next
}

export function touchBubble(
  state: ShabonState,
  mode: ShabonMode,
  bubbleId: number,
): { state: ShabonState; result: TouchResult } {
  if (isFinished(state)) return { state, result: 'none' }
  const bubble = state.bubbles.find((b) => b.id === bubbleId)
  if (!bubble || !isFloating(bubble)) return { state, result: 'none' }

  if (bubble.kindIndex !== state.targetIndex) {
    const bubbles = state.bubbles.map((b) =>
      b.id === bubbleId ? { ...b, wobbleUntil: state.elapsedMs + WOBBLE_MS } : b,
    )
    return { state: { ...state, bubbles, mistakes: state.mistakes + 1 }, result: 'wrong' }
  }

  const popped = state.popped + 1
  const bubbles = state.bubbles.map((b) => (b.id === bubbleId ? { ...b, poppedAt: state.elapsedMs } : b))
  let targetIndex = state.targetIndex
  if (popped < GOAL_COUNT && popped % POPS_PER_TARGET === 0) {
    const kindCount = MODE_KINDS[mode].length
    // つぎの おだいは いまと ちがうものにして、かわったことが わかるようにする。
    targetIndex = (targetIndex + 1 + randomIndex(kindCount - 1)) % kindCount
  }
  return { state: { ...state, bubbles, popped, targetIndex }, result: 'hit' }
}

/** まちがいの少なさで★をつける。じかん制限は つけず、ゆっくり さがしても よい。 */
export function scoreStars(mistakes: number): 1 | 2 | 3 {
  return mistakes <= 1 ? 3 : mistakes <= 4 ? 2 : 1
}
