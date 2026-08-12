import { describe, expect, test } from 'vitest'
import { colorMixProblems, subtractionProblems, twoColorAdditionProblems } from './data/colorMixQuestions'
import { generateColorMixQuestions, selectColorMixProblems, validateColorMixProblems } from './questionGenerator'
import { QUESTION_COUNT } from '../quiz-core/types'

describe('color mix question generator', () => {
  test('問題プールは明快な2色足し算16問、引き算6問、3色足し算4問で構成される', () => {
    expect(twoColorAdditionProblems).toHaveLength(16)
    expect(subtractionProblems).toHaveLength(6)
    expect(colorMixProblems.filter((problem) => problem.kind === 'three-color-addition')).toHaveLength(4)
    expect(colorMixProblems).toHaveLength(26)
  })

  test('1ゲームは重複なしの10問、正解が一つだけの4択を作る', () => {
    const questions = generateColorMixQuestions(QUESTION_COUNT, () => 0.37)
    expect(questions).toHaveLength(QUESTION_COUNT)
    expect(new Set(questions.map((question) => question.problem.id)).size).toBe(QUESTION_COUNT)
    for (const question of questions) {
      expect(question.choices).toHaveLength(4)
      expect(new Set(question.choices.map((color) => color.toLowerCase())).size).toBe(4)
      expect(question.choices.filter((color) => color === question.problem.resultColor)).toHaveLength(1)
    }
  })

  test('10問は足し算7問、逆レシピ引き算2問、3色足し算1問をシャッフルして出す', () => {
    const selected = selectColorMixProblems(colorMixProblems, QUESTION_COUNT, () => 0.13)
    expect(selected.filter((problem) => problem.kind === 'two-color-addition')).toHaveLength(7)
    expect(selected.filter((problem) => problem.kind === 'subtraction')).toHaveLength(2)
    expect(selected.filter((problem) => problem.kind === 'three-color-addition')).toHaveLength(1)
    expect(selected.map((problem) => problem.kind)).not.toEqual([
      'two-color-addition', 'two-color-addition', 'two-color-addition', 'two-color-addition', 'two-color-addition', 'two-color-addition', 'two-color-addition', 'subtraction', 'subtraction', 'three-color-addition',
    ])
  })

  test('プールが小さくなっても、利用可能な問題を使い切るまで重複しない', () => {
    const smallPool = colorMixProblems.slice(0, 3)
    const selected = selectColorMixProblems(smallPool, 5, () => 0.01)
    expect(new Set(selected.slice(0, smallPool.length).map((problem) => problem.id)).size).toBe(smallPool.length)
  })

  test('引き算は既存の二色レシピを逆向きにしたものだけ', () => {
    for (const subtraction of subtractionProblems) {
      const recipe = twoColorAdditionProblems.find((addition) => addition.id === subtraction.recipeId)
      expect(recipe).toBeDefined()
      expect(subtraction.inputColors[0]).toBe(recipe?.resultColor)
      expect(recipe?.inputColors).toContain(subtraction.inputColors[1])
      expect(recipe?.inputColors.find((color) => color !== subtraction.inputColors[1])).toBe(subtraction.resultColor)
    }
  })

  test('出題データは整合している', () => {
    expect(validateColorMixProblems()).toEqual([])
  })

  test('正解と一致しない引き算は検出する', () => {
    const broken = colorMixProblems.map((problem) => problem.id === 'purple-minus-blue-red'
      ? { ...problem, resultColor: '#f6d743', choices: ['#f6d743', '#e94b3c', '#58a85c', '#ef8a2f'] as const }
      : problem)
    expect(validateColorMixProblems(broken)).toContain('purple-minus-blue-red: is not a reverse of red-blue-purple')
  })
})
