import { generateQuizQuestions } from '../quiz-core/questionGenerator'
import type { ImageQuizItem, ImageQuizQuestion } from './types'
import { QUESTION_COUNT } from '../quiz-core/types'

/**
 * 画像クイズ用の4択問題を生成する。
 * 画像→名前・名前→画像のどちらも同じ問題データを使う。
 */
export function generateImageQuizQuestions(
  items: readonly ImageQuizItem[],
  questionCount: number = QUESTION_COUNT,
  random: () => number = Math.random,
): ImageQuizQuestion[] {
  return generateQuizQuestions(items, questionCount, random)
}
