import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import type { ColorMixQuestion } from './types'

const questionGeneratorMock = vi.hoisted(() => ({
  questions: undefined as ColorMixQuestion[] | undefined,
}))

vi.mock('./questionGenerator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./questionGenerator')>()
  return {
    ...actual,
    generateColorMixQuestions: (...args: Parameters<typeof actual.generateColorMixQuestions>) => (
      questionGeneratorMock.questions ?? actual.generateColorMixQuestions(...args)
    ),
  }
})

function renderApp(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

afterEach(() => {
  questionGeneratorMock.questions = undefined
  vi.useRealTimers()
})

describe('ColorMixQuizPlay', () => {
  test('開始画面から難易度選択なしでプレイ画面へ進む', async () => {
    const user = userEvent.setup()
    renderApp('/games/color-mix-quiz')
    await user.click(screen.getByRole('button', { name: 'はじめる' }))
    expect(screen.getByRole('heading', { name: /この (2|3)しょくを まぜると？|この いろから ひくと？/ })).toBeInTheDocument()
  })

  test('色名を答えに使わない4つの色パネルを表示する', () => {
    renderApp('/games/color-mix-quiz/play')
    expect(screen.getAllByRole('button', { name: /[1-4]ばんめの いろ/ })).toHaveLength(4)
  })

  test('回答するとロックされ、共通フィードバックが表示される', async () => {
    const user = userEvent.setup()
    renderApp('/games/color-mix-quiz/play')
    const choices = screen.getAllByRole('button', { name: /[1-4]ばんめの いろ/ })
    await user.click(choices[0])
    expect(screen.getByRole('status')).toHaveTextContent(/せいかい！|ざんねん！/)
    for (const choice of choices) expect(choice).toBeDisabled()
  })

  test('引き算では色の粒を抜いてから4択を有効化し、答え色は演出に表示しない', () => {
    vi.useFakeTimers()
    questionGeneratorMock.questions = [{
      problem: {
        id: 'purple-minus-blue-red',
        kind: 'subtraction',
        recipeId: 'red-blue-purple',
        inputColors: ['#7950a1', '#3977c7'],
        resultColor: '#e94b3c',
        choices: ['#e94b3c', '#f6d743', '#58a85c', '#ef8a2f'],
      },
      choices: ['#e94b3c', '#f6d743', '#58a85c', '#ef8a2f'],
    }]

    renderApp('/games/color-mix-quiz/play')

    expect(screen.getByTestId('subtraction-removal-particles')).toBeInTheDocument()
    for (const choice of screen.getAllByRole('button', { name: /[1-4]ばんめの いろ/ })) expect(choice).toBeDisabled()
    expect(screen.queryByText('できた！')).not.toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(1050) })
    for (const choice of screen.getAllByRole('button', { name: /[1-4]ばんめの いろ/ })) expect(choice).toBeEnabled()
  })

  test('旧難易度URLも単一のプレイ画面へ進む', () => {
    renderApp('/games/color-mix-quiz/expert/play')
    expect(screen.getByRole('heading', { name: /この (2|3)しょくを まぜると？|この いろから ひくと？/ })).toBeInTheDocument()
  })

  test('共有する難易度選択は他のクイズでそのまま使える', () => {
    renderApp('/games/flag-quiz/flag-to-name')
    expect(screen.getByRole('heading', { name: 'むずかしさを えらんでね' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /かんたん/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ふつう/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /むずかしい/ })).toBeInTheDocument()
  })
})
