import { describe, expect, test } from 'vitest'
import type { MathOperation, QuizLevel } from '../types'
import { problemsFor } from './problemPool'

const OPERATIONS: readonly MathOperation[] = ['add', 'sub', 'mul', 'div']
const LEVELS: readonly QuizLevel[] = ['easy', 'normal', 'hard']

const EXPECTED_COUNT: Record<MathOperation, Record<QuizLevel, number>> = {
  add: { easy: 66, normal: 231, hard: 10000 },
  sub: { easy: 66, normal: 231, hard: 5050 },
  mul: { easy: 25, normal: 81, hard: 891 },
  div: { easy: 25, normal: 81, hard: 277 },
}

describe('problemsFor', () => {
  for (const operation of OPERATIONS) {
    for (const level of LEVELS) {
      test(`${operation}/${level} は${EXPECTED_COUNT[operation][level]}件で、idの重複がない`, () => {
        const problems = problemsFor(operation, level)
        expect(problems).toHaveLength(EXPECTED_COUNT[operation][level])
        expect(new Set(problems.map((problem) => problem.id)).size).toBe(problems.length)
      })

      test(`${operation}/${level} は10件以上ある`, () => {
        expect(problemsFor(operation, level).length).toBeGreaterThanOrEqual(10)
      })

      test(`${operation}/${level} は answer が0以上の整数で、演算結果と一致する`, () => {
        for (const problem of problemsFor(operation, level)) {
          expect(Number.isInteger(problem.answer)).toBe(true)
          expect(problem.answer).toBeGreaterThanOrEqual(0)

          if (operation === 'add') expect(problem.left + problem.right).toBe(problem.answer)
          if (operation === 'sub') expect(problem.left - problem.right).toBe(problem.answer)
          if (operation === 'mul') expect(problem.left * problem.right).toBe(problem.answer)
          if (operation === 'div') expect(problem.left / problem.right).toBe(problem.answer)
        }
      })
    }
  }

  test('sub は全件で left >= right', () => {
    for (const level of LEVELS) {
      for (const problem of problemsFor('sub', level)) {
        expect(problem.left).toBeGreaterThanOrEqual(problem.right)
      }
    }
  })

  test('div は全件で right >= 1 かつ あまりなし (left % right === 0)', () => {
    for (const level of LEVELS) {
      for (const problem of problemsFor('div', level)) {
        expect(problem.right).toBeGreaterThanOrEqual(1)
        expect(problem.left % problem.right).toBe(0)
      }
    }
  })

  for (const operation of OPERATIONS) {
    test(`${operation}: かんたん ⊂ ふつう ⊂ むずかしい で、件数が真に増える`, () => {
      const easy = new Set(problemsFor(operation, 'easy').map((problem) => problem.id))
      const normal = new Set(problemsFor(operation, 'normal').map((problem) => problem.id))
      const hard = new Set(problemsFor(operation, 'hard').map((problem) => problem.id))

      for (const id of easy) expect(normal.has(id)).toBe(true)
      for (const id of normal) expect(hard.has(id)).toBe(true)

      expect(easy.size).toBeLessThan(normal.size)
      expect(normal.size).toBeLessThan(hard.size)
    })
  }
})
