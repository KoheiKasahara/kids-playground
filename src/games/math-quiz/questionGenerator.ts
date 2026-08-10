import { pickRandom, shuffle } from '../quiz-core/questionGenerator'
import { problemsFor } from './data/problemPool'
import { CHOICE_COUNT, QUESTION_COUNT } from './types'
import type { MathOperation, MathProblem, MathQuestion, QuizLevel } from './types'

/**
 * 1問分の誤答候補を作る。
 * 当てずっぽうが効きすぎる純粋乱数を避け、子どもが実際にやりがちなまちがい
 * (符号のとりちがえ、繰り上がり忘れ、九九の隣、演算のとりちがえなど) を候補にする。
 */
export function buildDistractors(
  problem: MathProblem,
  count: number,
  random: () => number = Math.random,
): number[] {
  const { operation, left, right, answer } = problem

  const raw: number[] = [answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer - 10]

  if (operation === 'add') {
    // 繰り上がり忘れ (answer - 10 は共通候補と重複するが、後段の重複除去に任せる)
    raw.push(answer - 10, left + right + 10)
  } else if (operation === 'sub') {
    raw.push(right - left, left + right)
  } else if (operation === 'mul') {
    raw.push(answer + left, answer - left, answer + right, answer - right, left + right)
  } else {
    raw.push(left - right, right)
  }

  const seen = new Set<number>()
  const candidates: number[] = []
  for (const value of raw) {
    if (!Number.isInteger(value) || value < 0 || value === answer) continue
    if (seen.has(value)) continue
    seen.add(value)
    candidates.push(value)
  }

  const picked = shuffle(candidates, random).slice(0, count)

  // 候補が足りない場合 (answer が 0 や 1 のときなど) は、未使用の非負整数で埋める
  const used = new Set(picked)
  used.add(answer)
  let filler = answer + 1
  while (picked.length < count) {
    if (!used.has(filler)) {
      picked.push(filler)
      used.add(filler)
    }
    filler += 1
  }

  return picked
}

/**
 * 演算・むずかしさから、1ゲーム分のさんすう問題を作る。
 *
 * - 正解となる計算は questionCount 件、重複なく選ぶ。
 * - 各問題の選択肢は正解1件 + 誤答 (CHOICE_COUNT - 1) 件で、同一問題内で重複しない。
 * - 選択肢の順序は random でシャッフルする。
 */
export function generateMathQuestions(
  operation: MathOperation,
  level: QuizLevel,
  questionCount: number = QUESTION_COUNT,
  random: () => number = Math.random,
): MathQuestion[] {
  const problems = pickRandom(problemsFor(operation, level), questionCount, random)

  return problems.map((problem) => {
    const distractors = buildDistractors(problem, CHOICE_COUNT - 1, random)
    return {
      problem,
      choices: shuffle([problem.answer, ...distractors], random),
    }
  })
}
