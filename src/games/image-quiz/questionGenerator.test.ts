import { describe, expect, test } from 'vitest'
import { generateImageQuizQuestions } from './questionGenerator'
import type { ImageQuizItem } from './types'

const items: ImageQuizItem[] = Array.from({ length: 12 }, (_, index) => ({
  id: `item-${index}`,
  name: `なまえ${index}`,
  image: `images/item-${index}.png`,
}))

describe('generateImageQuizQuestions', () => {
  test('10問・各4択・正解1つ・問題と選択肢の重複なしで生成する', () => {
    const questions = generateImageQuizQuestions(items, 10, () => 0.42)

    expect(questions).toHaveLength(10)
    expect(new Set(questions.map((question) => question.answer.id)).size).toBe(10)
    for (const question of questions) {
      expect(question.choices).toHaveLength(4)
      expect(new Set(question.choices.map((choice) => choice.id)).size).toBe(4)
      expect(question.choices.filter((choice) => choice.id === question.answer.id)).toHaveLength(1)
    }
  })

  test('画像→名前と名前→画像で同じ問題データを使える', () => {
    const [question] = generateImageQuizQuestions(items, 1, () => 0.42)
    expect(question.answer.name).toBeTruthy()
    expect(question.answer.image).toBeTruthy()
    expect(question.choices.every((choice) => choice.name && choice.image)).toBe(true)
  })
})
