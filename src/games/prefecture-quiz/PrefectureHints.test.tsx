import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import PrefectureQuizPlay from './PrefectureQuizPlay'
import { prefectures } from './data/prefectures'
import { useQuestionSpeech } from '../../speech'

vi.mock('../../speech', () => ({ SpeechToggle: () => null, useQuestionSpeech: vi.fn() }))
vi.mock('../../utils/quizSound', () => ({ playCorrectSound: vi.fn() }))
vi.mock('./questionGenerator', () => ({
  generatePrefectureQuestions: () => ['15', '02'].map((id) => ({
    answer: prefectures.find((prefecture) => prefecture.id === id)!,
    choices: prefectures.filter((prefecture) => ['15', '02', '27', '47'].includes(prefecture.id)),
  })),
  generateMapQuestions: () => prefectures,
}))

function renderMode(mode: string) {
  render(<MemoryRouter initialEntries={[`/${mode}`]}><Routes><Route path="/:mode" element={<PrefectureQuizPlay />} /></Routes></MemoryRouter>)
}

test('形の問題は最初から正解県のヒントを表示・読み上げし、次問で切り替わる', async () => {
  const user = userEvent.setup()
  renderMode('shape-to-name')
  expect(screen.getByText(/ひんと：おこめが ゆうめいだよ！/)).toBeInTheDocument()
  expect(useQuestionSpeech).toHaveBeenLastCalledWith('この かたちは なーんだ？ ヒント。おこめが ゆうめいだよ！', 0)
  await user.click(screen.getByRole('button', { name: 'にいがたけん' }))
  expect(screen.getByRole('status')).toHaveTextContent('せいかい！')
  await user.click(screen.getByRole('button', { name: 'つぎの もんだい' }))
  expect(screen.queryByText(/おこめが ゆうめいだよ！/)).not.toBeInTheDocument()
  expect(screen.getByText(/ひんと：りんごが ゆうめいだよ！/)).toBeInTheDocument()
  expect(useQuestionSpeech).toHaveBeenLastCalledWith('この かたちは なーんだ？ ヒント。りんごが ゆうめいだよ！', 1)
})

test.each(['name-to-shape', 'name-to-map'])('%sには形の問題用ヒントを表示しない', (mode) => {
  renderMode(mode)
  expect(screen.queryByText(/ひんと：/)).not.toBeInTheDocument()
})
