import { render, screen } from '@testing-library/react'
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

  test('引き算では回答後に色の粒を抜き、正解色を表示する', async () => {
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
    for (const choice of screen.getAllByRole('button', { name: /[1-4]ばんめの いろ/ })) expect(choice).toBeEnabled()
    expect(screen.queryByText('できた！')).not.toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: '1ばんめの いろ' }))
    for (const choice of screen.getAllByRole('button', { name: /[1-4]ばんめの いろ/ })) expect(choice).toBeDisabled()
    expect(screen.getByText('できた！')).toBeInTheDocument()
  })

  test('旧難易度URLも単一のプレイ画面へ進む', () => {
    renderApp('/games/color-mix-quiz/expert/play')
    expect(screen.getByRole('heading', { name: /この (2|3)しょくを まぜると？|この いろから ひくと？/ })).toBeInTheDocument()
  })

  test('10問を正解と不正解を混ぜて進めると、正確な結果を表示する', async () => {
    questionGeneratorMock.questions = Array.from({ length: 10 }, (_, index) => ({
      problem: {
        id: `test-${index}`,
        kind: 'two-color-addition' as const,
        inputColors: ['#111111', '#222222'],
        resultColor: '#333333',
        choices: ['#333333', '#444444', '#555555', '#666666'],
      },
      choices: ['#333333', '#444444', '#555555', '#666666'],
    }))
    const user = userEvent.setup()
    renderApp('/games/color-mix-quiz/play')

    for (let index = 0; index < 10; index += 1) {
      // 最終問題も正解にして、結果遷移直前の加点が取りこぼされないことを守る。
      await user.click(screen.getByRole('button', { name: `${index % 2 === 1 ? 1 : 2}ばんめの いろ` }))
      expect(screen.getByRole('status')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: index === 9 ? 'けっかを みる' : 'つぎのもんだい' }))
    }

    expect(await screen.findByText('5 / 10もん せいかい！')).toBeInTheDocument()
  })

  test('有効な結果stateなしで結果URLを開くと開始画面へ戻る', () => {
    renderApp('/games/color-mix-quiz/result')
    expect(screen.getByRole('heading', { name: 'いろまぜクイズ' })).toBeInTheDocument()
  })

  test('共有する難易度選択は他のクイズでそのまま使える', () => {
    renderApp('/games/flag-quiz/flag-to-name')
    expect(screen.getByRole('heading', { name: 'むずかしさを えらんでね' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /かんたん/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ふつう/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /むずかしい/ })).toBeInTheDocument()
  })
})
