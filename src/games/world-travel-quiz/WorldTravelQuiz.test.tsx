import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import WorldTravelQuizPlay from './WorldTravelQuizPlay'
import WorldTravelQuizResult from './WorldTravelQuizResult'
import WorldTravelQuizStart from './WorldTravelQuizStart'

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

  test.each(['northAmerica', 'southAmerica', 'oceania'] as const)('%s を選んでもゲームを開始できる', (region) => {
    reducedMotion()
    render(<MemoryRouter initialEntries={[`/games/world-travel-quiz/${region}/play`]}><Routes><Route path="/games/world-travel-quiz/:region/play" element={<WorldTravelQuizPlay />} /></Routes></MemoryRouter>)
    expect(screen.getByText('1 / 10')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'この くには どこ？' })).toBeInTheDocument()
  })

  test.each(['northAmerica', 'southAmerica', 'oceania'] as const)('%s は10問を終えて結果まで進める', async (region) => {
    reducedMotion(); const user = userEvent.setup()
    render(<MemoryRouter initialEntries={[`/games/world-travel-quiz/${region}/play`]}><Routes><Route path="/games/world-travel-quiz/:region/play" element={<WorldTravelQuizPlay />} /><Route path="/games/world-travel-quiz/:region/result" element={<WorldTravelQuizResult />} /><Route path="/games/world-travel-quiz" element={<h1>start</h1>} /></Routes></MemoryRouter>)
    for (let index = 0; index < 10; index += 1) {
      await user.click(screen.getAllByRole('button').find((button) => button.textContent !== 'やめる')!)
      await user.click(screen.getByRole('button', { name: index === 9 ? 'けっかを みる' : 'つぎの くにへ' }))
    }
    expect(screen.getByRole('heading', { name: 'たびが しゅうりょう！' })).toBeInTheDocument()
  })
})

describe('WorldTravelQuizStart', () => {
  test('6地域を選べる', () => {
    render(<MemoryRouter><WorldTravelQuizStart /></MemoryRouter>)
    for (const name of ['アジア', 'ヨーロッパ', 'アフリカ', '北アメリカ', '南アメリカ', 'オセアニア']) expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument()
  })
})

describe('WorldTravelQuizResult', () => {
  test('不正な結果stateは開始画面へ戻す', () => {
    render(<MemoryRouter initialEntries={['/games/world-travel-quiz/asia/result']}><Routes><Route path="/games/world-travel-quiz" element={<h1>start</h1>} /><Route path="/games/world-travel-quiz/:region/result" element={<WorldTravelQuizResult />} /></Routes></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'start' })).toBeInTheDocument()
  })
})
