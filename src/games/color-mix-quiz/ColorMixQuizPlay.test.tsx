import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'

function renderApp(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

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
})
