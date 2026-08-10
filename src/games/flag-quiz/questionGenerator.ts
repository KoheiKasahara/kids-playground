import { generateQuizQuestions } from '../quiz-core/questionGenerator'
export { pickRandom, shuffle } from '../quiz-core/questionGenerator'
import type { Country, Question } from './types'
import { QUESTION_COUNT } from './types'

/**
 * 国データから、1ゲーム分の問題を生成する。
 *
 * - 正解国は questionCount 件、重複なく選ぶ（countries が足りない場合は作れるだけ）。
 * - 各問題の選択肢は正解1件 + 不正解 (CHOICE_COUNT - 1) 件で、同一問題内で重複しない。
 * - 選択肢の順序は random でシャッフルする。
 * - countries を破壊的に変更しない。
 */
export function generateQuestions(
  countries: readonly Country[],
  questionCount: number = QUESTION_COUNT,
  random: () => number = Math.random,
): Question[] {
  return generateQuizQuestions(countries, questionCount, random)
}
