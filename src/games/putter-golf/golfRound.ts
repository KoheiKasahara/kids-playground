/**
 * 1コース（3ホール）ぶんの進みぐあいと成績。純粋な計算だけを置く。
 * 打った数が多くても「できた！」で終わり、失敗やゲームオーバーは作らない。
 */
import type { CourseId } from './golfCourses'

export type Stamp = 'hole-in-one' | 'great' | 'par' | 'clear'
export type HoleScore = { holeId: string; strokes: number; par: number; stars: number; stamp: Stamp }
export type RoundState = { courseId: CourseId; holeIndex: number; strokes: number; scores: HoleScore[] }

/** この打数をこえると「おたすけ」ボタンを出す。 */
export const ASSIST_AFTER = 5
const STORAGE_KEY = 'putter-golf-best-v1'

export const STAMP_TEXT: Record<Stamp, string> = {
  'hole-in-one': 'ホールインワン！',
  great: 'すごい！',
  par: 'ぴったり！',
  clear: 'できた！',
}

export function stampFor(strokes: number, par: number): Stamp {
  if (strokes <= 1) return 'hole-in-one'
  if (strokes < par) return 'great'
  if (strokes === par) return 'par'
  return 'clear'
}

/** めやす以内で★3、めやす+2まで★2、それより多くても★1。 */
export function starsFor(strokes: number, par: number): number {
  if (strokes <= par) return 3
  if (strokes <= par + 2) return 2
  return 1
}

export function createRound(courseId: CourseId): RoundState {
  return { courseId, holeIndex: 0, strokes: 0, scores: [] }
}

export function recordShot(state: RoundState): RoundState {
  return { ...state, strokes: state.strokes + 1 }
}

/** カップインしたホールの成績を残す。同じホールを2回数えない。 */
export function finishHole(state: RoundState, hole: { id: string; par: number }): RoundState {
  if (state.scores.some(score => score.holeId === hole.id)) return state
  const strokes = Math.max(1, state.strokes)
  return { ...state, scores: [...state.scores, { holeId: hole.id, strokes, par: hole.par, stars: starsFor(strokes, hole.par), stamp: stampFor(strokes, hole.par) }] }
}

export function nextHole(state: RoundState): RoundState {
  return { ...state, holeIndex: state.holeIndex + 1, strokes: 0 }
}

/** いまのホールをはじめからやり直す。打った数も0へ戻す。 */
export function restartHole(state: RoundState): RoundState {
  return { ...state, strokes: 0, scores: state.scores.slice(0, state.holeIndex) }
}

export function roundTotals(scores: readonly HoleScore[]) {
  return scores.reduce((sum, score) => ({ strokes: sum.strokes + score.strokes, par: sum.par + score.par, stars: sum.stars + score.stars }), { strokes: 0, par: 0, stars: 0 })
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function storage(): StorageLike | null {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

/** コースごとの いちばん多い★の数。保存できない環境では何もしない。 */
export function loadBestStars(store: StorageLike | null = storage()): Partial<Record<CourseId, number>> {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(STORAGE_KEY) ?? '{}')
    if (!parsed || typeof parsed !== 'object') return {}
    const result: Partial<Record<CourseId, number>> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if ((key === 'meadow' || key === 'beach' || key === 'moon') && typeof value === 'number' && Number.isFinite(value)) result[key] = value
    }
    return result
  } catch { return {} }
}

export function saveBestStars(courseId: CourseId, stars: number, store: StorageLike | null = storage()): Partial<Record<CourseId, number>> {
  const best = loadBestStars(store)
  if ((best[courseId] ?? 0) >= stars) return best
  const next = { ...best, [courseId]: stars }
  try { store?.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* 保存できなくても遊びは続けられる */ }
  return next
}
