import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import FishingPondPlay from './FishingPondPlay'
import { FISH } from './fishingGame'
import { playFishingSound } from './sounds'
import App from '../../app/App'
import { resetGameShelfCache } from '../../pages/gameShelfStore'

vi.mock('./sounds', () => ({ playFishingSound: vi.fn() }))
vi.mock('../../audio/sound', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../audio/sound')>(),
  primeAudio: vi.fn(),
}))
vi.mock('../../utils/haptics', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../utils/haptics')>(),
  vibrate: vi.fn(),
}))

function renderGame() {
  return render(<StrictMode><MemoryRouter><FishingPondPlay /></MemoryRouter></StrictMode>)
}

function start() {
  fireEvent.click(screen.getByRole('button', { name: 'つりを はじめる' }))
}

function advance(ms: number) {
  act(() => { vi.advanceTimersByTime(ms) })
}

describe('FishingPondPlay', () => {
  beforeEach(() => {
    // Reactのフォーカス処理・userEventが使うmicrotaskは実際の順序で動かす。
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  test('開始前は釣りを開始せず、開始したら6種類から選べる', () => {
    renderGame()
    expect(screen.getByRole('heading', { name: 'のんびり さかなつり' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'くまのみを つる' })).not.toBeInTheDocument()
    advance(10_000)
    expect(playFishingSound).not.toHaveBeenCalled()
    start()
    expect(within(screen.getByRole('group', { name: 'おさかなの うみ' })).getAllByRole('button')).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'くまのみを つる' })).toHaveFocus()
  })

  test('魚を選ぶ→待つ→合図→釣果→全種完成→再挑戦を通せる', () => {
    renderGame()
    start()
    for (const [index, fish] of FISH.entries()) {
      fireEvent.click(screen.getByRole('button', { name: `${fish.name}を つる` }))
      expect(screen.getByRole('button', { name: 'まってね…' })).toBeDisabled()
      advance(fish.waitMs - 1)
      expect(screen.queryByRole('button', { name: 'つる！' })).not.toBeInTheDocument()
      advance(1)
      expect(screen.getByRole('button', { name: 'つる！' })).toHaveFocus()
      fireEvent.click(screen.getByRole('button', { name: 'つる！' }))
      expect(screen.getByText(`${index + 1} / 6`)).toBeInTheDocument()
      expect(screen.getByLabelText(`${fish.name} つれた`)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: `${fish.name}を つる` })).not.toBeInTheDocument()
      if (index < FISH.length - 1) fireEvent.click(screen.getByRole('button', { name: 'つぎの おさかな' }))
    }
    expect(screen.getByRole('status')).toHaveTextContent('ぜんぶ つれた！')
    advance(10_000)
    expect(screen.getByText('6 / 6')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(screen.getByText('0 / 6')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'くまのみを つる' })).toBeEnabled()
  })

  test('待機中の連打では魚が変わらず、合図を1分待っても釣れる', () => {
    renderGame()
    start()
    fireEvent.click(screen.getByRole('button', { name: 'ふぐを つる' }))
    fireEvent.click(screen.getByRole('button', { name: 'まってね…' }))
    fireEvent.click(screen.getByRole('button', { name: 'たいを つる' }))
    expect(screen.getByText('0 / 6')).toBeInTheDocument()
    advance(60_000)
    const action = screen.getByRole('button', { name: 'つる！' })
    fireEvent.click(action)
    fireEvent.click(action)
    expect(screen.getByText('1 / 6')).toBeInTheDocument()
    expect(screen.getByLabelText('ふぐ つれた')).toBeInTheDocument()
    expect(screen.getByLabelText('たい まだ')).toBeInTheDocument()
  })

  test('待機中に音を切り替えても待ち時間を延ばさず、無音で最後まで釣れる', () => {
    renderGame()
    start()
    const fish = FISH[0]
    fireEvent.click(screen.getByRole('button', { name: `${fish.name}を つる` }))
    advance(fish.waitMs / 2)
    fireEvent.click(screen.getByRole('button', { name: 'おとを けす' }))
    vi.mocked(playFishingSound).mockClear()
    advance(fish.waitMs / 2)
    fireEvent.click(screen.getByRole('button', { name: 'つる！' }))
    expect(screen.getByText('1 / 6')).toBeInTheDocument()
    expect(playFishingSound).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'おとを だす' }))
    expect(screen.getByRole('button', { name: 'おとを けす' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('待機中にタイトルへ戻るとタイマーが消え、再入場へ合図を持ち越さない', () => {
    const cancel = vi.spyOn(window, 'clearTimeout')
    renderGame()
    start()
    fireEvent.click(screen.getByRole('button', { name: 'まんぼうを つる' }))
    advance(500)
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: 'つりを はじめる' })).toHaveFocus()
    expect(cancel).toHaveBeenCalled()
    start()
    advance(10_000)
    expect(screen.getByRole('status')).toHaveTextContent('おさかなを タップしてね')
    expect(screen.getByText('0 / 6')).toBeInTheDocument()
  })

  test('画面を離れると待機タイマーを解放する', () => {
    const schedule = vi.spyOn(window, 'setTimeout')
    const cancel = vi.spyOn(window, 'clearTimeout')
    const { unmount } = renderGame()
    start()
    fireEvent.click(screen.getByRole('button', { name: 'くまのみを つる' }))
    // jsdom/React自身のタイマー数には依存せず、この魚の待機を解放することを確認。
    const waitCall = schedule.mock.calls.findIndex(([, delay]) => delay === FISH[0].waitMs)
    expect(waitCall).toBeGreaterThanOrEqual(0)
    const timerId = schedule.mock.results[waitCall]!.value
    unmount()
    expect(cancel).toHaveBeenCalledWith(timerId)
    advance(10_000)
    expect(playFishingSound).not.toHaveBeenCalledWith('bite')
  })

})

describe('fishing route integration', () => {
  test('キーボードだけで開始・魚の選択・釣り上げ・次の魚へ進める', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'くまのみを つる' })).toHaveFocus()
    await user.keyboard(' ')
    expect(await screen.findByRole('button', { name: 'つる！' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'つぎの おさかな' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'なんようはぎを つる' })).toHaveFocus()
  })
  test('ホーム末尾から遅延ルートへ入り、プレイ→タイトル→ホームへ一階層ずつ戻る', async () => {
    localStorage.clear()
    resetGameShelfCache()
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    const shelf = screen.getByRole('region', { name: /ぜんぶの ゲーム/ })
    expect(within(shelf).getAllByRole('link').at(-1)).toHaveAccessibleName('のんびり さかなつり')
    await user.click(screen.getByRole('link', { name: 'のんびり さかなつり' }))
    expect(await screen.findByRole('heading', { name: 'のんびり さかなつり' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'つりを はじめる' }))
    expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: 'つりを はじめる' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
  })
})
