import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import WorldTravelQuizPlay from './WorldTravelQuizPlay'
import WorldTravelQuizResult from './WorldTravelQuizResult'

const originalMatchMedia = window.matchMedia
afterEach(() => { window.matchMedia = originalMatchMedia })
function reducedMotion() {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
}

describe('WorldTravelQuizPlay', () => {
  test('回答と次へを連打しても、reduced-motionで次の問題へ一度だけ進む', async () => {
    reducedMotion(); const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/world-travel-quiz/asia/play']}><Routes><Route path="/games/world-travel-quiz/:region/play" element={<WorldTravelQuizPlay />} /></Routes></MemoryRouter>)
    await user.click(screen.getAllByRole('button').find((button) => button.textContent !== 'やめる')!)
    expect(screen.getByRole('status')).toBeInTheDocument()
    const next = screen.getByRole('button', { name: 'つぎの くにへ' })
    await user.dblClick(next)
    expect(screen.getByText('2 / 10')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('WorldTravelQuizResult', () => {
  test('不正な結果stateは開始画面へ戻す', () => {
    render(<MemoryRouter initialEntries={['/games/world-travel-quiz/asia/result']}><Routes><Route path="/games/world-travel-quiz" element={<h1>start</h1>} /><Route path="/games/world-travel-quiz/:region/result" element={<WorldTravelQuizResult />} /></Routes></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'start' })).toBeInTheDocument()
  })
})
