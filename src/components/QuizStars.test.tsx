import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import QuizStars from './QuizStars'
import { quizStarCount } from '../games/quiz-core/stars'

describe('QuizStars（Issue #784 A9）', () => {
  test('全問正解で★3、7割以上で★2、それ以外でも★1はもらえる', () => {
    expect(quizStarCount(10, 10)).toBe(3)
    expect(quizStarCount(7, 10)).toBe(2)
    expect(quizStarCount(6, 10)).toBe(1)
    expect(quizStarCount(0, 10)).toBe(1)
    expect(quizStarCount(0, 0)).toBe(1)
  })

  test('ほしの数を読み上げ名で伝える', () => {
    render(<QuizStars correctCount={8} totalCount={10} />)
    expect(screen.getByRole('img', { name: 'ほし 2こ' })).toBeInTheDocument()
  })
})
