import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// jsdomはwindow.scrollTo()もwindow.scrollYの実際の変化も再現しないため、
// scrollToをスパイに差し替え、scrollYはテスト側で明示的に書き換えて
// 「ユーザーがどこまでスクロールしたか」を模擬する。
function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

describe('SPA遷移時のスクロール位置管理（Issue #299）', () => {
  let scrollToSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    sessionStorage.clear()
    scrollToSpy = vi.fn()
    window.scrollTo = scrollToSpy as unknown as typeof window.scrollTo
    setScrollY(0)
  })

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  test('トップ→ゲームの通常遷移では先頭(0,0)へスクロールされる', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    scrollToSpy.mockClear()

    await user.click(screen.getByRole('link', { name: '都道府県クイズ' }))
    expect(screen.getByRole('heading', { name: '都道府県クイズ' })).toBeInTheDocument()
    expect(scrollToSpy).toHaveBeenLastCalledWith(0, 0)
  })

  test('SEO説明文までスクロール→別画面→同じゲームを再訪しても先頭から表示される', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await user.click(screen.getByRole('link', { name: '都道府県クイズ' }))
    expect(screen.getByRole('heading', { name: '都道府県クイズ' })).toBeInTheDocument()

    // ページ下部のSEO説明文（GameIntro）まで読んだ状態を模す。
    setScrollY(800)

    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()

    scrollToSpy.mockClear()
    await user.click(screen.getByRole('link', { name: '都道府県クイズ' }))
    expect(screen.getByRole('heading', { name: '都道府県クイズ' })).toBeInTheDocument()
    // 前回そのゲームで下部までスクロールしていても、再訪時は先頭から始まる。
    expect(scrollToSpy).toHaveBeenLastCalledWith(0, 0)
  })

  test('ブラウザの戻る/進むでは離れる直前のスクロール位置へ復元される', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await user.click(screen.getByRole('link', { name: '都道府県クイズ' }))
    expect(screen.getByRole('heading', { name: '都道府県クイズ' })).toBeInTheDocument()
    setScrollY(650)

    scrollToSpy.mockClear()
    window.history.back()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
    })
    // ホームは今回のセッションでまだ訪れていない履歴エントリなので先頭に戻る。
    expect(scrollToSpy).toHaveBeenLastCalledWith(0, 0)

    scrollToSpy.mockClear()
    window.history.forward()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '都道府県クイズ' })).toBeInTheDocument()
    })
    // 進むで戻ったゲーム画面は、離れる直前のスクロール位置(650)へ復元される。
    expect(scrollToSpy).toHaveBeenLastCalledWith(0, 650)
  })
})
