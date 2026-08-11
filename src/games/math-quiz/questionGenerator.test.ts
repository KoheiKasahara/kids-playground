import { describe, expect, test } from 'vitest'
import { problemsFor } from './data/problemPool'
import { buildDistractors, generateMathQuestions } from './questionGenerator'
import type { MathOperation, MathProblem, QuizLevel } from './types'

function seededRandom(seed: number): () => number {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0x100000000
  }
}

const OPERATIONS: readonly MathOperation[] = ['add', 'sub', 'mul', 'div']
const LEVELS: readonly QuizLevel[] = ['easy', 'normal', 'hard']

describe('generateMathQuestions', () => {
  for (const operation of OPERATIONS) {
    for (const level of LEVELS) {
      test(`${operation}/${level} で10問・各4択・正解1つ・問題重複なしを作る`, () => {
        const questions = generateMathQuestions(operation, level, 10, seededRandom(1234))

        expect(questions).toHaveLength(10)
        expect(new Set(questions.map((question) => question.problem.id)).size).toBe(10)

        for (const question of questions) {
          expect(question.choices).toHaveLength(4)
          expect(new Set(question.choices).size).toBe(4)
          expect(question.choices.filter((choice) => choice === question.problem.answer)).toHaveLength(1)
          for (const choice of question.choices) {
            expect(Number.isInteger(choice)).toBe(true)
            expect(choice).toBeGreaterThanOrEqual(0)
          }
        }
      })
    }
  }

  test('同じシードの乱数を渡すと同じ結果になる', () => {
    const first = generateMathQuestions('add', 'normal', 10, seededRandom(777))
    const second = generateMathQuestions('add', 'normal', 10, seededRandom(777))
    expect(second).toEqual(first)
  })

  test('母集団が questionCount より少ない場合でもエラーにならず、作れるだけ生成する', () => {
    expect(() => generateMathQuestions('mul', 'easy', 100, seededRandom(3))).not.toThrow()
    const questions = generateMathQuestions('mul', 'easy', 100, seededRandom(3))
    expect(questions.length).toBe(problemsFor('mul', 'easy').length)
  })
})

function findProblem(operation: MathOperation, level: QuizLevel, predicate: (problem: MathProblem) => boolean): MathProblem {
  const found = problemsFor(operation, level).find(predicate)
  if (!found) throw new Error('テスト用の問題が見つかりません')
  return found
}

describe('buildDistractors', () => {
  test('要求した件数を返す', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const problem = findProblem('add', 'hard', (p) => p.left === 40 && p.right === 40)
      expect(buildDistractors(problem, 3, seededRandom(seed))).toHaveLength(3)
    }
  })

  test('answer === 1 の問題でも3件・正解と不一致・非負・重複なしを返す', () => {
    const problem = findProblem('sub', 'easy', (p) => p.left === 2 && p.right === 1)
    expect(problem.answer).toBe(1)

    for (let seed = 0; seed < 20; seed += 1) {
      const distractors = buildDistractors(problem, 3, seededRandom(seed))
      expect(distractors).toHaveLength(3)
      for (const value of distractors) {
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).not.toBe(problem.answer)
      }
      expect(new Set(distractors).size).toBe(3)
    }
  })
})
