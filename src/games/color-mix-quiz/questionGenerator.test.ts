import { describe, expect, test } from 'vitest'
import { colorMixProblemsByLevel } from './data/colorMixQuestions'
import { colorDistance, generateColorMixQuestions, HARD_MAX_NEAR_CHOICE_DISTANCE, HARD_MIN_CHOICE_DISTANCE, validateColorMixProblems } from './questionGenerator'
import { QUESTION_COUNT } from '../quiz-core/types'

describe('color mix question generator', () => {
  test.each(['easy', 'normal', 'hard'] as const)('%s は10問の4択を作る', (level) => {
    const questions = generateColorMixQuestions(level, QUESTION_COUNT, () => 0.37)
    expect(questions).toHaveLength(QUESTION_COUNT)
    for (const question of questions) {
      expect(question.choices).toHaveLength(4)
      expect(new Set(question.choices.map((color) => color.toLowerCase())).size).toBe(4)
      expect(question.choices.filter((color) => color === question.problem.resultColor)).toHaveLength(1)
    }
  })

  test('小さいプールを循環しても同じ問題・同じ結果が連続しない', () => {
    const questions = generateColorMixQuestions('easy', 18, () => 0.01)
    for (let index = 1; index < questions.length; index += 1) {
      expect(questions[index].problem.id).not.toBe(questions[index - 1].problem.id)
      expect(questions[index].problem.resultColor).not.toBe(questions[index - 1].problem.resultColor)
    }
  })

  test('hard の候補は完全一致せず、近いが判別不能なほど近くはない', () => {
    for (const problem of colorMixProblemsByLevel.hard) {
      const distances = problem.choices.filter((color) => color !== problem.resultColor).map((color) => colorDistance(problem.resultColor, color))
      expect(distances.every((distance) => distance >= HARD_MIN_CHOICE_DISTANCE)).toBe(true)
      expect(distances.some((distance) => distance <= HARD_MAX_NEAR_CHOICE_DISTANCE)).toBe(true)
    }
  })

  test('出題データは整合している', () => {
    expect(validateColorMixProblems()).toEqual([])
  })

  test('不整合データは検出する', () => {
    const broken = {
      ...colorMixProblemsByLevel,
      easy: [{ ...colorMixProblemsByLevel.easy[0], choices: ['#ff0000', '#ff0000', '#00ff00', '#0000ff'] as const }],
    }
    expect(validateColorMixProblems(broken)).toContain('red-yellow: duplicate choices')
  })

  test('難易度をまたいでも、同じ入力色ペアに別の正解色は設定できない', () => {
    const broken = {
      ...colorMixProblemsByLevel,
      normal: [
        ...colorMixProblemsByLevel.normal,
        {
          id: 'conflicting-red-yellow',
          inputColors: colorMixProblemsByLevel.easy[0].inputColors,
          resultColor: '#111111',
          choices: ['#111111', '#222222', '#333333', '#444444'] as const,
        },
      ],
    }
    expect(validateColorMixProblems(broken)).toContain('conflicting-red-yellow: input pair conflicts with red-yellow')
  })
})
