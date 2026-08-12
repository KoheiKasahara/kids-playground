import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import JapanTravelQuizPlay from './JapanTravelQuizPlay'
import JapanTravelQuizResult from './JapanTravelQuizResult'

const originalMatchMedia = window.matchMedia
afterEach(() => { window.matchMedia = originalMatchMedia })
function reducedMotion() {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
}

describe('JapanTravelQuizPlay', () => {
  test('回答と次へを連打しても、reduced-motionで次の問題へ一度だけ進む', async () => {
    reducedMotion(); const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/japan-travel-quiz/play']}><Routes><Route path="/games/japan-travel-quiz/play" element={<JapanTravelQuizPlay />} /></Routes></MemoryRouter>)
    await user.click(screen.getAllByRole('button').find((button) => button.textContent !== 'やめる')!)
    expect(screen.getByRole('status')).toBeInTheDocument()
    await user.dblClick(screen.getByRole('button', { name: 'つぎの けんへ' }))
    expect(screen.getByText('2 / 10')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('JapanTravelQuizResult', () => {
  test('不正な結果stateは開始画面へ戻す', () => {
    render(<MemoryRouter initialEntries={['/games/japan-travel-quiz/result']}><Routes><Route path="/games/japan-travel-quiz" element={<h1>start</h1>} /><Route path="/games/japan-travel-quiz/result" element={<JapanTravelQuizResult />} /></Routes></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'start' })).toBeInTheDocument()
  })
})
