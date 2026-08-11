import type { QuizLevel } from '../quiz-core/types'

export type { QuizLevel } from '../quiz-core/types'
export { CHOICE_COUNT, isQuizLevel, LEVEL_LABEL, LEVEL_RANK, LEVEL_STARS, QUESTION_COUNT } from '../quiz-core/types'

/** A paint colour is always authored explicitly; it is never calculated from its inputs. */
export type ColorMixProblem = {
  id: string
  /** The difficulty at which this problem is introduced. Pools are cumulative. */
  level: QuizLevel
  /** Two or three paints, shown left-to-right. Three-colour problems are hard-only. */
  inputColors: readonly string[]
  resultColor: string
  /** Four visible paint swatches, including resultColor exactly once. */
  choices: readonly [string, string, string, string]
}

export type ColorMixQuestion = {
  problem: ColorMixProblem
  choices: string[]
}

export const LEVEL_DESCRIPTION: Record<QuizLevel, string> = {
  easy: 'きほんの いろを まぜよう',
  normal: 'いろんな いろを まぜよう',
  hard: '3つの いろにも ちょうせん',
}
