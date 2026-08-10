import { generateQuizQuestions } from '../quiz-core/questionGenerator'
import { QUESTION_COUNT } from '../quiz-core/types'
import type { Vehicle, VehicleQuestion } from './types'

export function generateVehicleQuestions(
  vehicles: readonly Vehicle[],
  questionCount: number = QUESTION_COUNT,
  random: () => number = Math.random,
): VehicleQuestion[] {
  return generateQuizQuestions(vehicles, questionCount, random)
}
