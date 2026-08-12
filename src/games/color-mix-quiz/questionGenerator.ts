import { shuffle } from '../quiz-core/questionGenerator'
import { CHOICE_COUNT, QUESTION_COUNT } from '../quiz-core/types'
import { colorMixProblems } from './data/colorMixQuestions'
import type { ColorMixProblem, ColorMixQuestion, SubtractionProblem } from './types'

type ProblemPool = readonly ColorMixProblem[]

function take<T>(items: readonly T[], count: number): T[] {
  return items.slice(0, Math.max(0, count))
}

function targetCounts(questionCount: number) {
  const additions = Math.round(questionCount * 0.7)
  const subtractions = Math.round(questionCount * 0.2)
  return {
    'two-color-addition': additions,
    subtraction: subtractions,
    'three-color-addition': Math.min(1, Math.max(0, questionCount - additions - subtractions)),
  } as const
}

/**
 * Selects a balanced game without hard-coding question order: a ten-question game
 * targets 7 two-colour additions, 2 reverse-recipe subtractions and 1 three-colour
 * addition. It fills any missing category from other unused problems, then only
 * repeats after every available problem has appeared.
 */
export function selectColorMixProblems(
  pool: ProblemPool = colorMixProblems,
  questionCount: number = QUESTION_COUNT,
  random: () => number = Math.random,
): ColorMixProblem[] {
  if (pool.length === 0 || questionCount <= 0) return []

  const shuffled = shuffle(pool, random)
  const targets = targetCounts(questionCount)
  const selected: ColorMixProblem[] = []
  for (const kind of ['two-color-addition', 'subtraction', 'three-color-addition'] as const) {
    selected.push(...take(shuffled.filter((problem) => problem.kind === kind), targets[kind]))
  }

  const used = new Set(selected.map((problem) => problem.id))
  selected.push(...take(shuffle(shuffled.filter((problem) => !used.has(problem.id)), random), questionCount - selected.length))

  // A future, smaller pool still produces a full game, but no question repeats while
  // a unique one remains available.
  while (selected.length < questionCount) selected.push(...take(shuffle(pool, random), questionCount - selected.length))
  return shuffle(selected, random)
}

export function generateColorMixQuestions(
  questionCount: number = QUESTION_COUNT,
  random: () => number = Math.random,
  pool: ProblemPool = colorMixProblems,
): ColorMixQuestion[] {
  return selectColorMixProblems(pool, questionCount, random).map((problem) => ({
    problem,
    choices: shuffle(problem.choices, random),
  }))
}

/** Returns authored-data errors instead of throwing, so additions are safe to review. */
export function validateColorMixProblems(pool: ProblemPool = colorMixProblems): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const additions = new Map<string, Extract<ColorMixProblem, { kind: 'two-color-addition' }>>()

  for (const problem of pool) {
    if (ids.has(problem.id)) errors.push(`${problem.id}: duplicate id`)
    ids.add(problem.id)
    if (problem.inputColors.some((color) => !/^#[0-9a-f]{6}$/i.test(color))) errors.push(`${problem.id}: invalid input color`)
    if (!/^#[0-9a-f]{6}$/i.test(problem.resultColor)) errors.push(`${problem.id}: invalid result color`)
    if (problem.choices.length !== CHOICE_COUNT) errors.push(`${problem.id}: needs four choices`)
    if (new Set(problem.choices.map((color) => color.toLowerCase())).size !== CHOICE_COUNT) errors.push(`${problem.id}: duplicate choices`)
    if (problem.choices.filter((color) => color.toLowerCase() === problem.resultColor.toLowerCase()).length !== 1) errors.push(`${problem.id}: result must appear once`)
    if (problem.choices.some((color) => !/^#[0-9a-f]{6}$/i.test(color))) errors.push(`${problem.id}: invalid choice color`)
    if (problem.kind === 'two-color-addition') additions.set(problem.id, problem)
  }

  for (const problem of pool.filter((candidate): candidate is SubtractionProblem => candidate.kind === 'subtraction')) {
    const recipe = additions.get(problem.recipeId)
    if (!recipe) {
      errors.push(`${problem.id}: missing reverse recipe ${problem.recipeId}`)
      continue
    }
    const [finishedColor, removedColor] = problem.inputColors
    const remainingColor = recipe.inputColors.find((color) => color.toLowerCase() !== removedColor.toLowerCase())
    if (finishedColor.toLowerCase() !== recipe.resultColor.toLowerCase() || !recipe.inputColors.some((color) => color.toLowerCase() === removedColor.toLowerCase()) || remainingColor?.toLowerCase() !== problem.resultColor.toLowerCase()) {
      errors.push(`${problem.id}: is not a reverse of ${problem.recipeId}`)
    }
  }
  return errors
}
