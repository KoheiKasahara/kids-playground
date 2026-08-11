import { deltaE2000, labFromHex } from './colorDifference'
import { shuffle } from '../quiz-core/questionGenerator'
import { CHOICE_COUNT, QUESTION_COUNT } from '../quiz-core/types'
import { colorMixProblems, problemsForColorMix } from './data/colorMixQuestions'
import { LEVEL_RANK } from './types'
import type { ColorMixProblem, ColorMixQuestion, QuizLevel } from './types'

// Every ΔE below is CIEDE2000 (see colorDifference.ts) against the problem's own resultColor,
// never raw RGB distance — raw RGB does not track how easily a child can tell two swatches apart.
/** Every distractor of an easy problem must clear this ΔE from the answer. */
export const EASY_MIN_DELTA_E = 25
/** Every distractor of a normal problem must clear this ΔE from the answer. */
export const NORMAL_MIN_DELTA_E = 15
/** Even the deliberately-close hard distractor must stay at or above this ΔE. */
export const HARD_NEAR_MIN_DELTA_E = 10
/** At most one hard distractor may sit in [HARD_NEAR_MIN_DELTA_E, HARD_NEAR_MAX_DELTA_E]. */
export const HARD_NEAR_MAX_DELTA_E = 18
/** Every hard distractor that is not the (optional) near one must clear this ΔE. */
export const HARD_FAR_MIN_DELTA_E = 25
/** Any two of the four swatches on screen must clear this ΔE, so the panel never looks uniform. */
export const MIN_CHOICE_PAIR_DELTA_E = 10

// Guarantees the level's own newly-introduced problems actually show up in a 10-question game,
// even though pools are cumulative (a random 10-of-32 hard game would otherwise mostly show easy
// content). easy has no own-tier quota: every easy problem is already "new" content for a first-time
// player, and small pools already surface every item often via cycling.
export const OWN_TIER_QUOTA: Record<QuizLevel, number> = { easy: 0, normal: 3, hard: 4 }
/** Of hard's own-tier reservation, at least this many must be three-colour problems. */
export const HARD_THREE_COLOR_QUOTA = 2

function isHexColor(color: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color)
}

function distractorsOf(problem: ColorMixProblem): readonly string[] {
  return problem.choices.filter((color) => color.toLowerCase() !== problem.resultColor.toLowerCase())
}

/** Returns data errors instead of throwing so tests and future content additions can report every issue. */
export function validateColorMixProblems(problems: readonly ColorMixProblem[] = colorMixProblems): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const resultForInputSet = new Map<string, string>()
  const knownPaints = new Set<string>(['#e94b3c', '#f6d743', '#3977c7', '#fffdf7', '#263238'])
  for (const problem of problems) knownPaints.add(problem.resultColor.toLowerCase())

  for (const problem of problems) {
    if (ids.has(problem.id)) errors.push(`${problem.id}: duplicate id`)
    ids.add(problem.id)

    if (problem.inputColors.length !== 2 && problem.inputColors.length !== 3) errors.push(`${problem.id}: invalid input color`)
    if (problem.inputColors.some((color) => !isHexColor(color))) errors.push(`${problem.id}: invalid input color`)
    if (problem.inputColors.length === 3 && problem.level !== 'hard') errors.push(`${problem.id}: three-colour problem must be hard`)
    if (new Set(problem.inputColors.map((color) => color.toLowerCase())).size !== problem.inputColors.length) errors.push(`${problem.id}: repeated input color`)
    for (const color of problem.inputColors) {
      if (!knownPaints.has(color.toLowerCase())) errors.push(`${problem.id}: unknown input paint`)
    }

    if (!isHexColor(problem.resultColor)) errors.push(`${problem.id}: invalid result color`)
    if (problem.choices.length !== CHOICE_COUNT) errors.push(`${problem.id}: needs four choices`)
    if (new Set(problem.choices.map((color) => color.toLowerCase())).size !== CHOICE_COUNT) errors.push(`${problem.id}: duplicate choices`)
    if (problem.choices.filter((color) => color.toLowerCase() === problem.resultColor.toLowerCase()).length !== 1) errors.push(`${problem.id}: result must appear once`)
    if (problem.choices.some((color) => !isHexColor(color))) errors.push(`${problem.id}: invalid choice color`)

    // Same paints must never ask two different questions, so the input multiset must be unique
    // across the whole (now cumulative) list.
    const inputSet = problem.inputColors.map((color) => color.toLowerCase()).slice().sort().join('+')
    const priorId = resultForInputSet.get(inputSet)
    if (priorId) errors.push(`${problem.id}: input colors duplicate ${priorId}`)
    else resultForInputSet.set(inputSet, problem.id)

    const distractors = distractorsOf(problem)
    const deltas = distractors.map((color) => deltaE2000(problem.resultColor, color))
    if (problem.level === 'easy') {
      if (deltas.some((delta) => !Number.isFinite(delta) || delta < EASY_MIN_DELTA_E)) errors.push(`${problem.id}: easy choices are too close`)
    } else if (problem.level === 'normal') {
      if (deltas.some((delta) => !Number.isFinite(delta) || delta < NORMAL_MIN_DELTA_E)) errors.push(`${problem.id}: normal choices are too close`)
    } else {
      const nearCount = deltas.filter((delta) => delta >= HARD_NEAR_MIN_DELTA_E && delta <= HARD_NEAR_MAX_DELTA_E).length
      if (deltas.some((delta) => !Number.isFinite(delta) || delta < HARD_NEAR_MIN_DELTA_E)) errors.push(`${problem.id}: hard choices are too close`)
      if (nearCount > 1) errors.push(`${problem.id}: hard has more than one near choice`)
      if (deltas.some((delta) => delta > HARD_NEAR_MAX_DELTA_E && delta < HARD_FAR_MIN_DELTA_E)) errors.push(`${problem.id}: hard choice sits between the near and far bands`)
    }

    for (let i = 0; i < problem.choices.length; i += 1) {
      for (let j = i + 1; j < problem.choices.length; j += 1) {
        const delta = deltaE2000(problem.choices[i], problem.choices[j])
        if (!Number.isFinite(delta) || delta < MIN_CHOICE_PAIR_DELTA_E) errors.push(`${problem.id}: choices are too close to each other`)
      }
    }
  }

  // Guards future content edits: a pool of exactly QUESTION_COUNT would show the same ten
  // problems every game, so every cumulative pool must have at least one spare.
  for (const level of ['easy', 'normal', 'hard'] as const) {
    const poolSize = problems.filter((problem) => LEVEL_RANK[problem.level] <= LEVEL_RANK[level]).length
    if (poolSize < QUESTION_COUNT + 1) errors.push(`${level}: pool is too small`)
  }

  return errors
}

function repeatsPrevious(problem: ColorMixProblem, previous: ColorMixProblem | undefined): boolean {
  return previous !== undefined && (problem.id === previous.id || problem.resultColor === previous.resultColor)
}

/** Swaps in a later non-conflicting item whenever the current one would repeat `previous`'s id/result. */
function fixAdjacentRepeats(items: ColorMixProblem[], previous: ColorMixProblem | undefined): ColorMixProblem[] {
  const result = items.slice()
  let last = previous
  for (let index = 0; index < result.length; index += 1) {
    if (repeatsPrevious(result[index], last)) {
      const swapIndex = result.findIndex((candidate, laterIndex) => laterIndex > index && !repeatsPrevious(candidate, last))
      // If no swap is possible, accept the order rather than looping forever.
      if (swapIndex > index) {
        const temp = result[index]
        result[index] = result[swapIndex]
        result[swapIndex] = temp
      }
    }
    last = result[index]
  }
  return result
}

function reserveOwnTier(pool: readonly ColorMixProblem[], level: QuizLevel, questionCount: number, random: () => number): ColorMixProblem[] {
  const ownTier = pool.filter((problem) => problem.level === level)
  const reserved: ColorMixProblem[] = []

  if (level === 'hard') {
    const threeColor = ownTier.filter((problem) => problem.inputColors.length === 3)
    const threeColorQuota = Math.min(HARD_THREE_COLOR_QUOTA, threeColor.length, questionCount)
    reserved.push(...shuffle(threeColor, random).slice(0, threeColorQuota))
  }

  const ownTierQuota = Math.min(OWN_TIER_QUOTA[level], ownTier.length, questionCount)
  const remainingOwnTier = shuffle(
    ownTier.filter((problem) => !reserved.includes(problem)),
    random,
  )
  for (const problem of remainingOwnTier) {
    if (reserved.length >= ownTierQuota) break
    reserved.push(problem)
  }

  return reserved
}

/**
 * Builds `questionCount` questions from the level's cumulative pool.
 *
 * When the pool has enough problems, a level's own newly-introduced problems (and, for hard, its
 * three-colour problems) are reserved first via `reserveOwnTier` so the requested difficulty is
 * actually represented, then the rest of the game is filled randomly from the whole pool.
 * When the pool is smaller than `questionCount`, problems repeat across cycles instead (today's
 * cycling behaviour); quotas do not apply there since every problem already appears every cycle.
 * Either way, an ordering pass guarantees no two consecutive questions share an id or a resultColor —
 * several problems now deliberately share a similar, brownish answer family, so this matters more
 * than it used to.
 */
export function generateColorMixQuestions(
  level: QuizLevel,
  questionCount: number = QUESTION_COUNT,
  random: () => number = Math.random,
): ColorMixQuestion[] {
  const pool = problemsForColorMix(level)
  if (pool.length === 0 || questionCount <= 0) return []

  let selected: ColorMixProblem[]

  if (questionCount <= pool.length) {
    const reserved = reserveOwnTier(pool, level, questionCount, random)
    const remainingPool = pool.filter((problem) => !reserved.includes(problem))
    const fillCount = questionCount - reserved.length
    const filler = shuffle(remainingPool, random).slice(0, fillCount)
    selected = fixAdjacentRepeats(shuffle([...reserved, ...filler], random), undefined)
  } else {
    selected = []
    let previous: ColorMixProblem | undefined
    while (selected.length < questionCount) {
      const cycle = fixAdjacentRepeats(shuffle(pool, random), previous)
      for (const problem of cycle) {
        if (selected.length >= questionCount) break
        if (repeatsPrevious(problem, previous)) continue
        selected.push(problem)
        previous = problem
      }
    }
  }

  return selected.map((problem) => ({ problem, choices: shuffle(problem.choices, random) }))
}

// Re-exported for tests that want to reason about swatch distance directly.
export { deltaE2000, labFromHex }
