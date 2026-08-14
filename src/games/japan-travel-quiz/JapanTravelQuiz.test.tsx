import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import JapanTravelQuizPlay from './JapanTravelQuizPlay'
import JapanTravelQuizResult from './JapanTravelQuizResult'
import { prefectures } from '../prefecture-quiz/data/prefectures'
import type { JapanTravelQuestion } from './types'

const questionGeneratorMock = vi.hoisted(() => ({
  questions: undefined as JapanTravelQuestion[] | undefined,
}))

vi.mock('./questionGenerator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./questionGenerator')>()
  return {
    ...actual,
    generateJapanTravelQuestions: (...args: Parameters<typeof actual.generateJapanTravelQuestions>) => (
      questionGeneratorMock.questions ?? actual.generateJapanTravelQuestions(...args)
    ),
  }
})

const originalMatchMedia = window.matchMedia
afterEach(() => { window.matchMedia = originalMatchMedia; questionGeneratorMock.questions = undefined })
function reducedMotion() {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
}

describe('JapanTravelQuizPlay', () => {
  test('回答と次へを連打しても、reduced-motionで次の問題へ一度だけ進む', async () => {
    reducedMotion(); const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/japan-travel-quiz/play']}><Routes><Route path="/games/japan-travel-quiz/play" element={<JapanTravelQuizPlay />} /></Routes></MemoryRouter>)
    // ヘッダの「やめる」「よみあげ」トグルを除いた、選択肢ボタンだけを対象にする。
    const choices = screen
      .getAllByRole('button')
      .filter((button) => button.textContent !== 'やめる' && !(button.textContent ?? '').includes('よみあげ'))
    await user.click(choices[0])
    expect(screen.getByRole('status')).toBeInTheDocument()
    for (const choice of choices) expect(choice).toBeDisabled()
    await user.dblClick(screen.getByRole('button', { name: 'つぎの けんへ' }))
    expect(screen.getByText('2 / 10')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('10問を正解と不正解を混ぜて進めると、正確な結果を表示する', async () => {
    reducedMotion()
    questionGeneratorMock.questions = prefectures.slice(0, 10).map((answer) => ({
      answer,
      choices: [answer, ...prefectures.filter((item) => item.id !== answer.id).slice(0, 3)],
      answerIndex: 0,
    }))
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/japan-travel-quiz/play']}><Routes>
      <Route path="/games/japan-travel-quiz/play" element={<JapanTravelQuizPlay />} />
      <Route path="/games/japan-travel-quiz/result" element={<JapanTravelQuizResult />} />
      <Route path="/games/japan-travel-quiz" element={<h1>start</h1>} />
    </Routes></MemoryRouter>)

    for (let index = 0; index < 10; index += 1) {
      const question = questionGeneratorMock.questions[index]
      // 最終問題も正解にして、結果遷移直前の加点が取りこぼされないことを守る。
      const selected = question.choices[(index + 1) % 2]
      await user.click(screen.getByRole('button', { name: selected.nameHiragana }))
      expect(screen.getByRole('status')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: index === 9 ? 'けっかを みる' : 'つぎの けんへ' }))
      if (index < 9) expect(await screen.findByText(`${index + 2} / 10`)).toBeInTheDocument()
    }

    expect(await screen.findByText('5 / 10 もん せいかい！')).toBeInTheDocument()
  })
})

describe('JapanTravelQuizResult', () => {
  test('不正な結果stateは開始画面へ戻す', () => {
    render(<MemoryRouter initialEntries={['/games/japan-travel-quiz/result']}><Routes><Route path="/games/japan-travel-quiz" element={<h1>start</h1>} /><Route path="/games/japan-travel-quiz/result" element={<JapanTravelQuizResult />} /></Routes></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'start' })).toBeInTheDocument()
  })
})
