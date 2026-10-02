import { pickRandom, shuffle } from '../quiz-core/questionGenerator'
import { CHOICE_COUNT, QUESTION_COUNT } from './types'
import type { Country, Question, QuizLevel } from './types'
import { countriesForLevel } from './data/countries'
import { generateQuestions } from './questionGenerator'

/**
 * 結果画面の「つづける」からプレイ画面へ引き継ぐ、これまでの成績。
 * usedIds は出題済みの国。つづけて遊ぶときは正解の国としてもう選ばない。
 */
export type ContinueState = {
  usedIds: string[]
  correctCount: number
  totalCount: number
  /** パネルめくりモードでだけ使う累計得点 */
  score?: number
  maxScore?: number
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

/** location.state から「つづける」の引き継ぎ情報を取り出す。不正な値なら null（新しいゲーム扱い） */
export function readContinueState(value: unknown): ContinueState | null {
  if (typeof value !== 'object' || value === null) return null
  const continueFrom = (value as Record<string, unknown>).continueFrom
  if (typeof continueFrom !== 'object' || continueFrom === null) return null
  const candidate = continueFrom as Record<string, unknown>
  if (
    !isStringArray(candidate.usedIds) ||
    !isNonNegativeInteger(candidate.correctCount) ||
    !isNonNegativeInteger(candidate.totalCount) ||
    candidate.correctCount > candidate.totalCount
  ) return null
  const hasScore = candidate.score !== undefined || candidate.maxScore !== undefined
  if (hasScore && (!isNonNegativeInteger(candidate.score) || !isNonNegativeInteger(candidate.maxScore))) {
    return null
  }
  return {
    usedIds: candidate.usedIds,
    correctCount: candidate.correctCount,
    totalCount: candidate.totalCount,
    ...(hasScore ? { score: candidate.score as number, maxScore: candidate.maxScore as number } : {}),
  }
}

/** 出題プールのうち、まだ出題していない国の数 */
export function remainingCountryCount(countries: readonly Country[], usedIds: readonly string[]): number {
  const used = new Set(usedIds)
  return countries.filter((country) => !used.has(country.id)).length
}

/**
 * 出題済みの国を正解から除いて、つづきの問題を作る。
 * 残りが questionCount に満たないときは残りの国だけを出題する。
 * 不正解の選択肢はプール全体から選ぶ（出題済みの国が選択肢に混ざるのはかまわない）。
 */
export function generateContinuedQuestions(
  countries: readonly Country[],
  usedIds: readonly string[],
  questionCount: number = QUESTION_COUNT,
  random: () => number = Math.random,
): Question[] {
  const used = new Set(usedIds)
  const answers = pickRandom(
    countries.filter((country) => !used.has(country.id)),
    questionCount,
    random,
  )
  return answers.map((answer) => {
    const distractors = pickRandom(
      countries.filter((country) => country.id !== answer.id),
      CHOICE_COUNT - 1,
      random,
    )
    return { answer, choices: shuffle([answer, ...distractors], random) }
  })
}

/** 「つづける」で来た場合はつづきの問題を、そうでなければ新しい10問を作る */
export function createGame(
  level: QuizLevel,
  locationState: unknown,
): { questions: Question[]; continueFrom: ContinueState | null } {
  const pool = countriesForLevel(level)
  const continueFrom = readContinueState(locationState)
  // 引き継いだ国がすでに出つくしている（URL再訪など）ときは新しいゲームにする
  if (continueFrom && remainingCountryCount(pool, continueFrom.usedIds) > 0) {
    return { questions: generateContinuedQuestions(pool, continueFrom.usedIds), continueFrom }
  }
  return { questions: generateQuestions(pool), continueFrom: null }
}
