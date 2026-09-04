import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TsumikiBowlingPlay from './TsumikiBowlingPlay'

// WebGLとRapierはjsdomで動かさない。ここで見たいのは
// 「ステージ選択 ⇄ プレイ」の切り替えそのもの。
vi.mock('./useTsumikiBowlingEngine', () => ({
  useTsumikiBowlingEngine: () => ({ registerContainer: vi.fn(), setBallId: vi.fn() }),
}))

function renderPlay() {
  return render(
    <MemoryRouter initialEntries={['/games/tsumiki-bowling']}>
      <TsumikiBowlingPlay />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  // jsdomのwindow.scrollToは未実装で警告を出すため、呼ばれたことだけを見るモックにする。
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

describe('TsumikiBowlingPlay', () => {
  it('最初はステージ選択が出て、選ぶとプレイ画面へ切り替わる', async () => {
    const user = userEvent.setup()
    renderPlay()
    expect(screen.getByText('どの つみきを たおす？')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /つみきタワー/ }))
    expect(screen.getByRole('heading', { name: 'つみきボウリング' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ステージをかえる' })).toBeInTheDocument()
  })

  it('「ステージをかえる」で選択画面へ戻れる', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(screen.getByRole('button', { name: /つみきタワー/ }))
    await user.click(screen.getByRole('button', { name: 'ステージをかえる' }))
    expect(screen.getByText('どの つみきを たおす？')).toBeInTheDocument()
  })

  it('ステージを切り替えるたびにページ先頭へ戻す（下までスクロールして選んでも、ゲームが画面に収まる）', async () => {
    const user = userEvent.setup()
    renderPlay()
    const scrollTo = vi.mocked(window.scrollTo)
    scrollTo.mockClear()

    await user.click(screen.getByRole('button', { name: /ピラミッド/ }))
    expect(scrollTo).toHaveBeenCalledWith(0, 0)

    scrollTo.mockClear()
    await user.click(screen.getByRole('button', { name: 'ステージをかえる' }))
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })
})
