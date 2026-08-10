import { describe, expect, test } from 'vitest'
import { generateQuizQuestions } from './questionGenerator'

const items = Array.from({ length: 12 }, (_, index) => ({ id: `item-${index}`, value: index }))

describe('generateQuizQuestions', () => {
  test('ID付きデータから重複しない10問・各4択を作る', () => {
    const questions = generateQuizQuestions(items, 10, () => 0.42)

    expect(questions).toHaveLength(10)
    expect(new Set(questions.map((question) => question.answer.id)).size).toBe(10)
    for (const question of questions) {
      expect(question.choices).toHaveLength(4)
      expect(new Set(question.choices.map((choice) => choice.id)).size).toBe(4)
      expect(question.choices.filter((choice) => choice.id === question.answer.id)).toHaveLength(1)
    }
  })

  test('元の配列を変更しない', () => {
    const before = items.map((item) => item.id)
    generateQuizQuestions(items)
    expect(items.map((item) => item.id)).toEqual(before)
  })
})
