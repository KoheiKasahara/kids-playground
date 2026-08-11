import type { QuizLevel } from '../quiz-core/types'

export type { QuizLevel } from '../quiz-core/types'
export { CHOICE_COUNT, isQuizLevel, LEVEL_LABEL, LEVEL_STARS, QUESTION_COUNT } from '../quiz-core/types'

/** A paint colour is always authored explicitly; it is never calculated from its inputs. */
export type ColorMixProblem = {
  id: string
  inputColors: readonly [string, string]
  resultColor: string
  /** Four visible paint swatches, including resultColor exactly once. */
  choices: readonly [string, string, string, string]
}

export type ColorMixQuestion = {
  problem: ColorMixProblem
  choices: string[]
}

export const LEVEL_DESCRIPTION: Record<QuizLevel, string> = {
  easy: 'きほんの いろまぜ',
  normal: 'しろ・くろも まぜよう',
  hard: 'にている いろを みわけよう',
}
