import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import WorldTravelAnswerModeSelect from './WorldTravelAnswerModeSelect'
import WorldTravelQuizPlay from './WorldTravelQuizPlay'
import WorldTravelQuizResult from './WorldTravelQuizResult'
import WorldTravelQuizStart from './WorldTravelQuizStart'

const originalMatchMedia = window.matchMedia
afterEach(() => { window.matchMedia = originalMatchMedia })
function reducedMotion() {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
}

describe('WorldTravelQuizPlay', () => {
  test('国名モードで回答と次へを連打しても、reduced-motionで次の問題へ一度だけ進む', async () => {
    reducedMotion(); const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/world-travel-quiz/asia/country-name/play']}><Routes><Route path="/games/world-travel-quiz/:region/:answerMode/play" element={<WorldTravelQuizPlay />} /></Routes></MemoryRouter>)
    await user.click(screen.getAllByRole('button').find((button) => button.textContent !== 'やめる')!)
    expect(screen.getByRole('status')).toBeInTheDocument()
    const next = screen.getByRole('button', { name: 'つぎの くにへ' })
    await user.dblClick(next)
    expect(screen.getByText('2 / 10')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test.each(['northAmerica', 'southAmerica', 'oceania'] as const)('%s を選んでも国名モードを開始できる', (region) => {
    reducedMotion()
    render(<MemoryRouter initialEntries={[`/games/world-travel-quiz/${region}/country-name/play`]}><Routes><Route path="/games/world-travel-quiz/:region/:answerMode/play" element={<WorldTravelQuizPlay />} /></Routes></MemoryRouter>)
    expect(screen.getByText('1 / 10')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'この くには どこ？' })).toBeInTheDocument()
  })

  test('国旗モードでは4枚の国旗から回答できる', async () => {
    reducedMotion(); const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/world-travel-quiz/europe/flag/play']}><Routes><Route path="/games/world-travel-quiz/:region/:answerMode/play" element={<WorldTravelQuizPlay />} /></Routes></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'この くにの こっきは どれ？' })).toBeInTheDocument()
    const flags = screen.getAllByRole('button', { name: /ばんめ の こっき/ })
    expect(flags).toHaveLength(4)
    await user.click(flags[0])
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  test('国旗モードでも10問を終えて結果まで進める', async () => {
    reducedMotion(); const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/world-travel-quiz/asia/flag/play']}><Routes><Route path="/games/world-travel-quiz/:region/:answerMode/play" element={<WorldTravelQuizPlay />} /><Route path="/games/world-travel-quiz/:region/:answerMode/result" element={<WorldTravelQuizResult />} /><Route path="/games/world-travel-quiz" element={<h1>start</h1>} /></Routes></MemoryRouter>)
    for (let index = 0; index < 10; index += 1) {
      await user.click(screen.getAllByRole('button', { name: /ばんめ の こっき/ })[0])
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

describe('WorldTravelAnswerModeSelect', () => {
  test('国名と国旗の2方式を選べる', () => {
    render(<MemoryRouter initialEntries={['/games/world-travel-quiz/asia/answer-mode']}><Routes><Route path="/games/world-travel-quiz/:region/answer-mode" element={<WorldTravelAnswerModeSelect />} /></Routes></MemoryRouter>)
    expect(screen.getByRole('button', { name: /国名で答える/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /国旗で答える/ })).toBeInTheDocument()
  })
})

describe('WorldTravelQuizResult', () => {
  test('不正な結果stateは開始画面へ戻す', () => {
    render(<MemoryRouter initialEntries={['/games/world-travel-quiz/asia/flag/result']}><Routes><Route path="/games/world-travel-quiz" element={<h1>start</h1>} /><Route path="/games/world-travel-quiz/:region/:answerMode/result" element={<WorldTravelQuizResult />} /></Routes></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'start' })).toBeInTheDocument()
  })
})
