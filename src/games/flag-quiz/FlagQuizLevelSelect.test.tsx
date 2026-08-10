import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'

/**
 * ルーティングを含めて実際のアプリ (src/app/routes.tsx) をレンダリングする。
 * 画面遷移まわり（プレイ画面への遷移・もどるなど）を実際のルート定義で検証するため、
 * MemoryRouter + App を使う。
 */
function renderApp(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  )
}

describe('FlagQuizLevelSelect', () => {
  test('3つのむずかしさボタンと「もどる」ボタンが表示される', () => {
    renderApp(['/games/flag-quiz/flag-to-name'])
    expect(screen.getByRole('heading', { name: 'むずかしさを えらんでね' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /かんたん/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ふつう/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /むずかしい/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
  })

  test('こっき→なまえモードでは選んでいるモード名が表示される', () => {
    renderApp(['/games/flag-quiz/flag-to-name'])
    expect(screen.getByText('こっき → なまえ')).toBeInTheDocument()
  })

  test('なまえ→こっきモードでは選んでいるモード名が表示される', () => {
    renderApp(['/games/flag-quiz/name-to-flag'])
    expect(screen.getByText('なまえ → こっき')).toBeInTheDocument()
  })

  test('パネルめくりモードでは選んでいるモード名が表示される', () => {
    renderApp(['/games/flag-quiz/panel-flag'])
    expect(screen.getByText('パネルめくり')).toBeInTheDocument()
  })

  test('「かんたん」を押すと、こっき→なまえモードのかんたんのプレイ画面に遷移する', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/flag-to-name'])
    await user.click(screen.getByRole('button', { name: /かんたん/ }))
    expect(screen.getByRole('heading', { name: 'この くにの なまえは？' })).toBeInTheDocument()
    expect(screen.getByText('かんたん')).toBeInTheDocument()
  })

  test('「むずかしい」を押すと、なまえ→こっきモードのむずかしいのプレイ画面に遷移する', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/name-to-flag'])
    await user.click(screen.getByRole('button', { name: /むずかしい/ }))
    expect(screen.getAllByRole('button', { name: /ばんめ の こっき/ })).toHaveLength(4)
    expect(screen.getByText('むずかしい')).toBeInTheDocument()
  })

  test('パネルめくりモードで「かんたん」を押すと、パネルクイズのプレイ画面に遷移する', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/panel-flag'])
    await user.click(screen.getByRole('button', { name: /かんたん/ }))
    expect(screen.getByRole('heading', { name: 'この くにの なまえは？' })).toBeInTheDocument()
    expect(screen.getByText('かんたん')).toBeInTheDocument()
  })

  test('「もどる」を押すとモード選択画面に戻る', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/flag-to-name'])
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'こっきクイズ' })).toBeInTheDocument()
  })
})
