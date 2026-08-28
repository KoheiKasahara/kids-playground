import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import App from './App'

describe('直接アクセス（URL直入力を想定）', () => {
  test('/games/prefecture-quiz を直接開くと都道府県クイズの開始画面が出る', () => {
    render(
      <MemoryRouter initialEntries={['/games/prefecture-quiz']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: '都道府県クイズ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /かたちを みて/ })).toBeInTheDocument()
  })

  test('/games/vegetable-quiz を直接開くとおやさいクイズの開始画面が出る', () => {
    render(
      <MemoryRouter initialEntries={['/games/vegetable-quiz']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'おやさいクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /イラストを みて こたえる/ })).toBeInTheDocument()
  })

  test('/games/math-quiz を直接開くとさんすうクイズの開始画面が出る', () => {
    render(
      <MemoryRouter initialEntries={['/games/math-quiz']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'さんすうクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /たしざん/ })).toBeInTheDocument()
  })

  test('/games/color-mix-quiz を直接開くといろまぜクイズの開始画面が出る', () => {
    render(
      <MemoryRouter initialEntries={['/games/color-mix-quiz']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'いろまぜクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'はじめる' })).toBeInTheDocument()
  })
})

describe('不正URL', () => {
  test('存在しないゲームのURLはホームへフォールバックする', () => {
    render(
      <MemoryRouter initialEntries={['/games/does-not-exist']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
  })
})

describe('ブラウザの戻る・進む', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  test('ゲームへ遷移後、戻る・進むでホームとゲーム画面を行き来できる', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '都道府県クイズ' }))
    expect(screen.getByRole('heading', { name: '都道府県クイズ' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/games/prefecture-quiz')

    window.history.back()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
    })
    expect(window.location.pathname).toBe('/')

    window.history.forward()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '都道府県クイズ' })).toBeInTheDocument()
    })
    expect(window.location.pathname).toBe('/games/prefecture-quiz')
  })

  test('トップ→ゲームA→ゲームB→戻る、で1つ前のゲームへ戻る', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await user.click(screen.getByRole('link', { name: '都道府県クイズ' }))
    expect(screen.getByRole('heading', { name: '都道府県クイズ' })).toBeInTheDocument()

    window.history.back()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('link', { name: 'さんすうクイズ' }))
    expect(screen.getByRole('heading', { name: 'さんすうクイズ' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/games/math-quiz')

    window.history.back()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
    })
    expect(window.location.pathname).toBe('/')
  })
})
