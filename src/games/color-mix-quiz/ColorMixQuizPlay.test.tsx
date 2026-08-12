import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'

function renderApp(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

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
