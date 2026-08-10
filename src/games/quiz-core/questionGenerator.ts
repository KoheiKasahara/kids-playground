import { CHOICE_COUNT, QUESTION_COUNT } from './types'
import type { Identifiable, QuizQuestion } from './types'

/** Fisher–Yatesシャッフル。元の配列は変更しない。 */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }
  return result
}

/** 母集団から重複なく最大count件を選ぶ。 */
export function pickRandom<T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  return shuffle(items, random).slice(0, Math.max(0, count))
}

/**
 * ID付きデータから1ゲーム分の4択問題を作る。
 * 正解はゲーム内で重複せず、各選択肢は正解をちょうど1件含む。
 */
export function generateQuizQuestions<T extends Identifiable>(
  items: readonly T[],
  questionCount: number = QUESTION_COUNT,
  random: () => number = Math.random,
  choiceCount: number = CHOICE_COUNT,
): QuizQuestion<T>[] {
  const safeChoiceCount = Math.max(1, choiceCount)
  const answers = pickRandom(items, questionCount, random)

  return answers.map((answer) => {
    const distractorPool = items.filter((item) => item.id !== answer.id)
    const distractors = pickRandom(distractorPool, safeChoiceCount - 1, random)
    return {
      answer,
      choices: shuffle([answer, ...distractors], random),
    }
  })
}
