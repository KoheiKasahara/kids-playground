import { describe, expect, test } from 'vitest'
import { vehiclesForLevel } from './data/vehicles'
import { generateVehicleQuestions } from './questionGenerator'

function seededRandom(seed: number): () => number {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0x100000000
  }
}

describe('generateVehicleQuestions', () => {
  test.each(['easy', 'normal', 'hard'] as const)(
    '%sで10問・各4択・正解1つ・問題重複なし',
    (level) => {
      const pool = vehiclesForLevel(level)
      const questions = generateVehicleQuestions(pool, 10, seededRandom(1234))

      expect(questions).toHaveLength(10)
      expect(new Set(questions.map((question) => question.answer.id)).size).toBe(10)
      for (const question of questions) {
        expect(question.choices).toHaveLength(4)
        expect(new Set(question.choices.map((choice) => choice.id)).size).toBe(4)
        expect(
          question.choices.filter((choice) => choice.id === question.answer.id),
        ).toHaveLength(1)
        for (const choice of question.choices) {
          expect(pool).toContain(choice)
        }
      }
    },
  )
})
