import { shuffle } from '../quiz-core/questionGenerator'
import type { Country } from '../flag-quiz/types'
import { countryById } from './data/travelCountries'
import type { TravelCourse, TravelQuestion } from './types'
import { CHOICE_COUNT, QUESTION_COUNT } from './types'

/** 10問で正解の位置を均等に近くするための、非破壊の位置バッグ。 */
export function answerPositionBag(random: () => number = Math.random): number[] {
  return shuffle([0, 1, 2, 3, 0, 1, 2, 3, 0, 1], random)
}

export function generateTravelQuestions(
  course: TravelCourse,
  random: () => number = Math.random,
  distractorPool?: readonly Country[],
): TravelQuestion[] {
  const answers = course.countryIds.map((id) => countryById.get(id)).filter((country): country is Country => Boolean(country))
  if (answers.length !== QUESTION_COUNT) throw new Error('Travel course must contain ten known countries.')
  const positions = answerPositionBag(random)
  const pool = distractorPool ?? answers
  return answers.map((answer, index) => {
    const distractors = pool.filter((country) => country.id !== answer.id)
    const selected = shuffle(distractors, random).slice(0, CHOICE_COUNT - 1)
    if (selected.length !== CHOICE_COUNT - 1) throw new Error('Travel question needs at least three distinct distractors.')
    const choices = [...selected]
    choices.splice(positions[index], 0, answer)
    return { answer, choices, answerIndex: positions[index] }
  })
}
