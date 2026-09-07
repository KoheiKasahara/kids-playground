import { lazy } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import GameRouteBoundary from './GameRouteBoundary'

const FailedGame = lazy(() => Promise.reject(new Error('chunk unavailable')))
function BrokenGame(): never { throw new Error('render failed') }
function TestRoutes({ broken = false }: { broken?: boolean }) {
  const { pathname } = useLocation()
  return (
    <GameRouteBoundary>
      {pathname === '/' ? <h1>ゲームいちらん</h1> : broken ? <BrokenGame /> : <FailedGame />}
    </GameRouteBoundary>
  )
}

afterEach(() => vi.restoreAllMocks())

test.each([false, true])('読込/描画失敗からホームへ戻ると境界も復帰する: %s', async (broken) => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(<MemoryRouter initialEntries={['/games/broken']}><TestRoutes broken={broken} /></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'うまく よみこめませんでした' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'もういちど よみこむ' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'ゲームを えらぶ' }))
  expect(await screen.findByRole('heading', { name: 'ゲームいちらん' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
