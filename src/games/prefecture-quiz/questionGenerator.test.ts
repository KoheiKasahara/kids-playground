import { describe, expect, test } from 'vitest'
import { prefectures } from './data/prefectures'
import { generateMapQuestions, generatePrefectureQuestions } from './questionGenerator'
import { prefecturesForRegion } from './data/regions'

describe('generatePrefectureQuestions', () => {
  test('10問すべてが異なる正解で、各問題に正解を一つ含む4択を作る', () => {
    const questions = generatePrefectureQuestions(prefectures, () => 0.37)
    expect(questions).toHaveLength(10)
    expect(new Set(questions.map((question) => question.answer.id)).size).toBe(10)
    questions.forEach((question) => {
      expect(question.choices).toHaveLength(4)
      expect(new Set(question.choices.map((choice) => choice.id)).size).toBe(4)
      expect(question.choices.filter((choice) => choice.id === question.answer.id)).toHaveLength(1)
    })
  })
})

test('地図モードは重複しない10県を選び、回答候補はその県と同じ地方だけになる', () => {
  const answers = generateMapQuestions(prefectures, () => 0.37)
  expect(answers).toHaveLength(10)
  expect(new Set(answers.map((answer) => answer.id)).size).toBe(10)
  answers.forEach((answer) => {
    expect(prefecturesForRegion(answer.region)).toContain(answer)
    expect(prefecturesForRegion(answer.region).every((candidate) => candidate.region === answer.region)).toBe(true)
  })
})
