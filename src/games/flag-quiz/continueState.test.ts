import { describe, expect, test } from 'vitest'
import { countriesForLevel } from './data/countries'
import {
  createGame,
  generateContinuedQuestions,
  readContinueState,
  remainingCountryCount,
} from './continueState'
import { CHOICE_COUNT, QUESTION_COUNT } from './types'

describe('continueState', () => {
  const pool = countriesForLevel('normal')

  test('出題済みの国は正解に選ばない', () => {
    const usedIds = pool.slice(0, 20).map((country) => country.id)
    const questions = generateContinuedQuestions(pool, usedIds)
    expect(questions).toHaveLength(QUESTION_COUNT)
    for (const question of questions) {
      expect(usedIds).not.toContain(question.answer.id)
      expect(question.choices).toHaveLength(CHOICE_COUNT)
      expect(question.choices.filter((choice) => choice.id === question.answer.id)).toHaveLength(1)
    }
    expect(new Set(questions.map((q) => q.answer.id)).size).toBe(QUESTION_COUNT)
  })

  test('残りが10問に満たないときは残りの国だけを出題する', () => {
    const usedIds = pool.slice(0, 40).map((country) => country.id)
    const questions = generateContinuedQuestions(pool, usedIds)
    expect(questions.map((q) => q.answer.id).sort()).toEqual(pool.slice(40).map((c) => c.id).sort())
    expect(remainingCountryCount(pool, usedIds)).toBe(pool.length - 40)
  })

  test('readContinueState は不正な値を null にする', () => {
    expect(readContinueState(null)).toBeNull()
    expect(readContinueState({})).toBeNull()
    expect(readContinueState({ continueFrom: { usedIds: [1], correctCount: 0, totalCount: 10 } })).toBeNull()
    expect(readContinueState({ continueFrom: { usedIds: [], correctCount: 11, totalCount: 10 } })).toBeNull()
    expect(
      readContinueState({ continueFrom: { usedIds: ['jp'], correctCount: 3, totalCount: 10 } }),
    ).toEqual({ usedIds: ['jp'], correctCount: 3, totalCount: 10 })
  })

  test('全部出題ずみの引き継ぎは新しいゲームになる', () => {
    const usedIds = pool.map((country) => country.id)
    const game = createGame('normal', { continueFrom: { usedIds, correctCount: 0, totalCount: pool.length } })
    expect(game.continueFrom).toBeNull()
    expect(game.questions).toHaveLength(QUESTION_COUNT)
  })
})
