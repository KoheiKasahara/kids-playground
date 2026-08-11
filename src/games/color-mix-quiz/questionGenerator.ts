import { shuffle } from '../quiz-core/questionGenerator'
import { CHOICE_COUNT, QUESTION_COUNT } from '../quiz-core/types'
import { problemsForColorMix } from './data/colorMixQuestions'
import type { ColorMixProblem, ColorMixQuestion, QuizLevel } from './types'

export const HARD_MIN_CHOICE_DISTANCE = 20
export const HARD_MAX_NEAR_CHOICE_DISTANCE = 82

type Rgb = readonly [number, number, number]

function rgb(color: string): Rgb | undefined {
  const match = /^#([0-9a-f]{6})$/i.exec(color)
  if (!match) return undefined
  const value = match[1]
  return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16)]
}

export function colorDistance(first: string, second: string): number {
  const a = rgb(first)
  const b = rgb(second)
  if (!a || !b) return Number.NaN
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/** Returns data errors instead of throwing so tests and future content additions can report every issue. */
export function validateColorMixProblems(
  pools: Record<QuizLevel, readonly ColorMixProblem[]> = {
    easy: problemsForColorMix('easy'),
    normal: problemsForColorMix('normal'),
    hard: problemsForColorMix('hard'),
  },
): string[] {
  const errors: string[] = []
  const resultForInputPair = new Map<string, { resultColor: string; id: string }>()
  for (const level of ['easy', 'normal', 'hard'] as const) {
    const ids = new Set<string>()
    for (const problem of pools[level]) {
      if (ids.has(problem.id)) errors.push(`${level}: duplicate id ${problem.id}`)
      ids.add(problem.id)
      if (problem.inputColors.length !== 2 || problem.inputColors.some((color) => !rgb(color))) errors.push(`${problem.id}: invalid input color`)
      if (!rgb(problem.resultColor)) errors.push(`${problem.id}: invalid result color`)
      // The question does not show a mixing ratio, so the same two input paints must always
      // have the same answer even when they occur in a different difficulty pool or order.
      const inputPair = problem.inputColors.map((color) => color.toLowerCase()).sort().join('+')
      const prior = resultForInputPair.get(inputPair)
      if (prior && prior.resultColor !== problem.resultColor.toLowerCase()) {
        errors.push(`${problem.id}: input pair conflicts with ${prior.id}`)
      } else if (!prior) {
        resultForInputPair.set(inputPair, { resultColor: problem.resultColor.toLowerCase(), id: problem.id })
      }
      if (problem.choices.length !== CHOICE_COUNT) errors.push(`${problem.id}: needs four choices`)
      if (new Set(problem.choices.map((color) => color.toLowerCase())).size !== CHOICE_COUNT) errors.push(`${problem.id}: duplicate choices`)
      if (problem.choices.filter((color) => color.toLowerCase() === problem.resultColor.toLowerCase()).length !== 1) errors.push(`${problem.id}: result must appear once`)
      if (problem.choices.some((color) => !rgb(color))) errors.push(`${problem.id}: invalid choice color`)
      if (level === 'hard') {
        const distances = problem.choices.filter((color) => color !== problem.resultColor).map((color) => colorDistance(problem.resultColor, color))
        if (distances.some((distance) => !Number.isFinite(distance) || distance < HARD_MIN_CHOICE_DISTANCE)) errors.push(`${problem.id}: hard choices are too close`)
        if (!distances.some((distance) => distance <= HARD_MAX_NEAR_CHOICE_DISTANCE)) errors.push(`${problem.id}: hard needs a near choice`)
      }
    }
  }
  return errors
}

/**
 * Builds ten questions from a level-local pool. Small pools cycle only after every item was used;
 * the first item of a fresh cycle is swapped when needed so neither the same paint pair nor its
 * result colour appears twice in a row.
 */
export function generateColorMixQuestions(
  level: QuizLevel,
  questionCount: number = QUESTION_COUNT,
  random: () => number = Math.random,
): ColorMixQuestion[] {
  const pool = problemsForColorMix(level)
  if (pool.length === 0 || questionCount <= 0) return []
  const selected: ColorMixProblem[] = []
  let previous: ColorMixProblem | undefined
  while (selected.length < questionCount) {
    const cycle = shuffle(pool, random)
    const firstAcceptable = cycle.findIndex((problem) => !previous || (problem.id !== previous.id && problem.resultColor !== previous.resultColor))
    if (firstAcceptable > 0) [cycle[0], cycle[firstAcceptable]] = [cycle[firstAcceptable], cycle[0]]
    for (const problem of cycle) {
      if (selected.length >= questionCount) break
      if (previous && (problem.id === previous.id || problem.resultColor === previous.resultColor)) continue
      selected.push(problem)
      previous = problem
    }
  }
  return selected.map((problem) => ({ problem, choices: shuffle(problem.choices, random) }))
}
