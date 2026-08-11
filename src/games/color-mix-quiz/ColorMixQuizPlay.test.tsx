import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { generateColorMixQuestions } from './questionGenerator'
import styles from './ColorMixQuizPlay.module.css'

function renderApp(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ColorMixQuizPlay', () => {
  test('色名を答えに使わない4つの色パネルを表示する', () => {
    renderApp('/games/color-mix-quiz/easy/play')
    expect(screen.getByRole('heading', { name: 'この 2しょくを まぜると？' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /[1-4]ばんめの いろ/ })).toHaveLength(4)
  })

  test('回答するとロックされ、共通フィードバックが表示される', async () => {
    const user = userEvent.setup()
    renderApp('/games/color-mix-quiz/normal/play')
    const choices = screen.getAllByRole('button', { name: /[1-4]ばんめの いろ/ })
    await user.click(choices[0])
    expect(screen.getByRole('status')).toHaveTextContent(/せいかい！|ざんねん！/)
    for (const choice of choices) expect(choice).toBeDisabled()
  })

  test('不正な難易度は難易度選択へ戻る', () => {
    renderApp('/games/color-mix-quiz/expert/play')
    expect(screen.getByRole('heading', { name: 'むずかしさを えらんでね' })).toBeInTheDocument()
  })

  test('不正解のときも まざった色と えらんだ色を見せる', async () => {
    // Math.random を定数に固定し、コンポーネント内部の generateColorMixQuestions と同じ結果を
    // 事前に計算しておくことで、どの選択肢が不正解かをテスト側で確定させる（当たり運に頼らない）。
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const expected = generateColorMixQuestions('normal')
    const firstQuestion = expected[0]
    const wrongIndex = firstQuestion.choices.findIndex((color) => color !== firstQuestion.problem.resultColor)
    expect(wrongIndex).toBeGreaterThanOrEqual(0)

    const user = userEvent.setup()
    renderApp('/games/color-mix-quiz/normal/play')
    const choices = screen.getAllByRole('button', { name: /[1-4]ばんめの いろ/ })
    await user.click(choices[wrongIndex])

    expect(screen.getByRole('status')).toHaveTextContent('ざんねん！')
    expect(screen.getByTestId('mixed-paint')).toBeInTheDocument()
    expect(screen.getByText('えらんだいろ')).toBeInTheDocument()
    expect(screen.getByText('まざったいろ')).toBeInTheDocument()
  })

  test('3色の問題では見出しが「3しょく」になり、絵の具が3つ表示される', () => {
    // この乱数値で hard の1問目が3色問題(blue-yellow-white)になることを事前に確認済み。
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const expected = generateColorMixQuestions('hard')
    expect(expected[0].problem.inputColors).toHaveLength(3)

    const { container } = renderApp('/games/color-mix-quiz/hard/play')
    expect(screen.getByRole('heading', { name: 'この 3しょくを まぜると？' })).toBeInTheDocument()
    expect(container.querySelectorAll(`.${styles.paint}`)).toHaveLength(3)
    expect(container.querySelector(`.${styles.paintC}`)).toBeInTheDocument()
    expect(container.querySelector(`.${styles.paintStage}.${styles.trio}`)).toBeInTheDocument()
  })
})
