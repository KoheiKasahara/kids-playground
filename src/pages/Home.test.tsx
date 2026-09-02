import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../app/App'
import { GAME_CATALOG, gameRoutePath } from '../games/gameCatalog'

describe('Home', () => {
  // JSのonClickだけに依存させず、クローラが辿れる通常リンクであることを守るための監査テスト。
  test('全ゲームカードが<a href="/games/<slug>">の通常リンクとして出力される', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    for (const game of GAME_CATALOG) {
      const link = screen.getByRole('link', { name: game.title })
      expect(link.getAttribute('href')).toBe(gameRoutePath(game.slug))
    }
  })

  test('ゲーム一覧に現在の22ゲームすべてが表示される', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'こっきクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'こっきピンボール' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'こっきドミノ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'こっきころころめいろ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'こっきコロコロパズル' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'おやさいクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'くだものクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'はたらくくるまクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'さんすうクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'いろまぜクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '都道府県クイズ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'せかい旅行クイズ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'にほん旅行クイズ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ちきゅうぎ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'たいようけい' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '3Dせんろづくり' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ピアノであそぼう' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'くるまのみちづくり' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'コマバトル' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '3Dクルマづくり' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'うごくぬりえ' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(22)
  })

  test('「都道府県クイズ」を押すと開始画面に遷移する', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: '都道府県クイズ' }))
    expect(screen.getByRole('heading', { name: '都道府県クイズ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /かたちを みて/ })).toBeInTheDocument()
  })

  test('「こっきクイズ」を押すと国旗クイズの開始画面に遷移する', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('link', { name: 'こっきクイズ' }))
    expect(screen.getByRole('heading', { name: 'こっきクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'こっきを みて こたえる' })).toBeInTheDocument()
  })

  test('「はたらくくるまクイズ」を押すと開始画面に遷移する', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('link', { name: 'はたらくくるまクイズ' }))
    expect(screen.getByRole('heading', { name: 'はたらくくるまクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /しゃしんを みて こたえる/ })).toBeInTheDocument()
  })

  test('「さんすうクイズ」を押すと開始画面に遷移する', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('link', { name: 'さんすうクイズ' }))
    expect(screen.getByRole('heading', { name: 'さんすうクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /たしざん/ })).toBeInTheDocument()
  })

  test('「せかい旅行クイズ」を押すと遅延読込した開始画面に遷移する', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: 'せかい旅行クイズ' }))
    expect(await screen.findByRole('heading', { name: 'せかい旅行クイズ' })).toBeInTheDocument()
  })

  test('「いろまぜクイズ」を押すと開始画面に遷移する', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: 'いろまぜクイズ' }))
    expect(screen.getByRole('heading', { name: 'いろまぜクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'はじめる' })).toBeInTheDocument()
  })

  test('「こっきピンボール」を押すと遅延読込したボール選択画面に遷移する', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: 'こっきピンボール' }))
    expect(await screen.findByRole('heading', { name: 'こっきピンボール' })).toBeInTheDocument()
    expect(screen.getByText('ボールを 3こ えらんでね！')).toBeInTheDocument()
  })

  test('「にほん旅行クイズ」を押すと遅延読込した開始画面に遷移する', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: 'にほん旅行クイズ' }))
    expect(await screen.findByRole('heading', { name: 'にほん旅行クイズ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'たびに しゅっぱつ！' })).toBeInTheDocument()
  })

  test('「こっきコロコロパズル」を押すと遅延読込したゲーム画面に遷移する', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: 'こっきコロコロパズル' }))
    expect(await screen.findByRole('heading', { name: 'こっきコロコロパズル' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'かんたん' }))
    expect(screen.getByRole('button', { name: 'ボールを おとす！' })).toBeInTheDocument()
  })

  test('「こっきドミノ」を押すと遅延読込した国選択画面に遷移する', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: 'こっきドミノ' }))
    expect(await screen.findByRole('heading', { name: 'こっきドミノ' })).toBeInTheDocument()
    expect(screen.getByText('どの こっきに する？')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'にほん' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'フランス' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'アメリカ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'イギリス' })).toBeInTheDocument()
  })

  test('「たいようけい」を押すと遅延読込したビューワーに遷移する', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: 'たいようけい' }))
    expect(await screen.findByRole('heading', { name: /たいようけい/ }, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
  })

  test('「3Dせんろづくり」を押すと遅延読込した線路画面に遷移する', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: '3Dせんろづくり' }))
    expect(await screen.findByRole('heading', { name: /3Dせんろづくり/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ちょくせんを ついか' })).toBeInTheDocument()
  })

  test('「うごくぬりえ」を押すとぬりえ画面に遷移する', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: 'うごくぬりえ' }))
    expect(screen.getByRole('heading', { name: 'うごくぬりえ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'やりなおし' })).toBeInTheDocument()
  })
})
