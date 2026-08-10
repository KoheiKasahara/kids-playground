import { generateQuizQuestions, pickRandom } from '../quiz-core/questionGenerator'
import type { Prefecture } from './data/prefectures'
import { PREFECTURE_CHOICE_COUNT, PREFECTURE_QUESTION_COUNT } from './types'

export function generatePrefectureQuestions(
  items: readonly Prefecture[],
  random: () => number = Math.random,
) {
  return generateQuizQuestions(items, PREFECTURE_QUESTION_COUNT, random, PREFECTURE_CHOICE_COUNT)
}

/** 地図モードは4択にせず、10件の正解だけを選び、県の地方を回答面にする。 */
export function generateMapQuestions(items: readonly Prefecture[], random: () => number = Math.random): Prefecture[] {
  return pickRandom(items, PREFECTURE_QUESTION_COUNT, random)
}
