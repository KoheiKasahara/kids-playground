import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../app/App'
import { GAME_CATALOG, gameRoutePath } from '../games/gameCatalog'
import {
  FAVORITE_GAMES_STORAGE_KEY,
  RECENT_GAMES_STORAGE_KEY,
  resetGameShelfCache,
} from './gameShelfStore'

// ゲームを開くと「さいきん あそんだ」へ保存されるため、テストごとに保存内容を空へ戻す。
beforeEach(() => {
  localStorage.clear()
  resetGameShelfCache()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
}

describe('Home の おきにいり・さいきん', () => {
  test('はじめは棚が空で、ならび方のヒントを出す', () => {
    renderHome()
    const favorites = screen.getByRole('region', { name: 'おきにいり' })
    const recents = screen.getByRole('region', { name: 'さいきん あそんだ' })
    expect(within(favorites).getByText('☆を おすと ここに ならぶよ')).toBeInTheDocument()
    expect(within(recents).getByText('あそんだ ゲームが ここに でるよ')).toBeInTheDocument()
    expect(within(favorites).queryAllByRole('link')).toHaveLength(0)
    expect(within(recents).queryAllByRole('link')).toHaveLength(0)
  })

  test('☆を押すと おきにいりに並び、もう一度押すと外れる', async () => {
    const user = userEvent.setup()
    renderHome()
    const star = screen.getByRole('button', { name: 'パターゴルフを おきにいりに する' })
    expect(star).toHaveAttribute('aria-pressed', 'false')

    await user.click(star)
    expect(star).toHaveAttribute('aria-pressed', 'true')
    const favorites = screen.getByRole('region', { name: 'おきにいり' })
    expect(within(favorites).getByRole('link', { name: 'パターゴルフ（おきにいり）' })).toHaveAttribute(
      'href',
      gameRoutePath('putter-golf'),
    )
    expect(JSON.parse(localStorage.getItem(FAVORITE_GAMES_STORAGE_KEY)!)).toEqual(['putter-golf'])
    // 一覧のカードは同じ名前のリンクのまま残る。
    expect(screen.getByRole('link', { name: 'パターゴルフ' })).toBeInTheDocument()

    await user.click(star)
    expect(star).toHaveAttribute('aria-pressed', 'false')
    expect(within(favorites).queryAllByRole('link')).toHaveLength(0)
  })

  test('遊んだゲームは、ホームへ戻ると さいきん あそんだ の先頭に出る', async () => {
    const user = userEvent.setup()
    renderHome()
    await user.click(screen.getByRole('link', { name: 'さんすうクイズ' }))
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    await user.click(screen.getByRole('link', { name: 'こっきクイズ' }))
    await user.click(screen.getByRole('button', { name: 'もどる' }))

    const recents = screen.getByRole('region', { name: 'さいきん あそんだ' })
    expect(within(recents).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      gameRoutePath('flag-quiz'),
      gameRoutePath('math-quiz'),
    ])
    expect(within(recents).getByRole('link', { name: 'さんすうクイズ（さいきん あそんだ）' })).toBeInTheDocument()
    // 一覧の並び順は保存内容に左右されない。
    const allGames = screen.getByRole('region', { name: /ぜんぶの ゲーム/ })
    expect(within(allGames).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(
      GAME_CATALOG.map((game) => gameRoutePath(game.slug)),
    )
  })

  test('保存済みの並びを起動時に読み込む', () => {
    localStorage.setItem(FAVORITE_GAMES_STORAGE_KEY, JSON.stringify(['crane-game']))
    localStorage.setItem(RECENT_GAMES_STORAGE_KEY, JSON.stringify(['piano-play', 'removed-game']))
    renderHome()
    expect(screen.getByRole('link', { name: 'クレーンゲーム（おきにいり）' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ピアノであそぼう（さいきん あそんだ）' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'クレーンゲームを おきにいりに する' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('localStorageが使えなくても、全ゲームを開けて☆も押せる', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const user = userEvent.setup()
    renderHome()
    for (const game of GAME_CATALOG) {
      expect(screen.getByRole('link', { name: game.title })).toHaveAttribute('href', gameRoutePath(game.slug))
    }
    await user.click(screen.getByRole('button', { name: 'こっきクイズを おきにいりに する' }))
    expect(screen.getByRole('link', { name: 'こっきクイズ（おきにいり）' })).toBeInTheDocument()
  })
})

describe('Home', () => {

  test('こっきクイズが先頭で、先頭にあったゲームは末尾へ移動する', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAccessibleName('こっきクイズ')
    expect(links.slice(-15).map((link) => link.getAttribute('href'))).toEqual(
      [
        'putter-golf',
        'shinkeisuijaku',
        'water-wheel-maze',
        'pyoko-touch',
        'hoshi-tsunagi',
        'robo-kuzushi',
        'mato-ate',
        'dot-adventure',
        'dot-zoo',
        'dot-aquarium',
        'pixel-kart',
        'tsumiki-3d',
        'dot-run',
        'jishaku-pitatto',
        'shabon-pachin',
      ].map(gameRoutePath),
    )
  })
  test('サーキットレースをホームから開ける', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: 'サーキットレース' }))
    expect(await screen.findByRole('heading', { name: 'サーキットレース' })).toBeInTheDocument()
  })
  // JSのonClickだけに依存させず、クローラが辿れる通常リンクであることを守るための監査テスト。
  test('全ゲームカードが<a href="/games/<slug>">の通常リンクとして出力される', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('link')).toHaveLength(GAME_CATALOG.length)
    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
    for (const game of GAME_CATALOG) {
      const link = screen.getByRole('link', { name: game.title })
      expect(link.getAttribute('href')).toBe(gameRoutePath(game.slug))
    }
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
    expect(screen.getByRole('button', { name: 'えを みて こたえる' })).toBeInTheDocument()
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
    expect(await screen.findByRole('heading', { name: 'いろまぜクイズ' })).toBeInTheDocument()
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
    expect(await screen.findByRole('heading', { name: /たいようけい/ }, { timeout: 10_000 })).toBeInTheDocument()
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
    expect(await screen.findByRole('heading', { name: 'うごくぬりえ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'やりなおし' })).toBeInTheDocument()
  })
})
