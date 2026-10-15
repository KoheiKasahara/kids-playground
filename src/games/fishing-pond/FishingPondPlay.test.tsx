import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import FishingPondPlay from './FishingPondPlay'
import { ESCAPE_MS, FISH } from './fishingGame'
import { LURE_AFTER_SEC } from './pondSim'
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

/** 魚が食いつくまで待つ（動かさなくても近くの魚が寄ってくる）。 */
function waitForBite() {
  for (let i = 0; i < 80 && !screen.queryByRole('button', { name: 'まく！' }); i++) advance(500)
  return screen.getByRole('button', { name: 'まく！' })
}

function reelUntilLanded() {
  let taps = 0
  while (screen.queryByRole('button', { name: 'まく！' }) && taps < 30) {
    fireEvent.click(screen.getByRole('button', { name: 'まく！' }))
    taps++
  }
  return taps
}

function newlyCaught(seen: ReadonlySet<string>) {
  return FISH.find((fish) => !seen.has(fish.id) && screen.queryByLabelText(`${fish.name} つれた`))
}

describe('FishingPondPlay', () => {
  beforeEach(() => {
    // Reactのフォーカス処理・userEventが使うmicrotaskは実際の順序で動かす。
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  test('タイトルでは魚が泳ぐだけで食いつかず、開始すると針が出る', () => {
    renderGame()
    expect(screen.getByRole('heading', { name: 'のんびり さかなつり' })).toBeInTheDocument()
    advance(20_000)
    expect(playFishingSound).not.toHaveBeenCalledWith('bite')
    expect(screen.queryByTestId('hook')).not.toBeInTheDocument()
    expect(document.querySelectorAll('[data-fish]')).toHaveLength(6)
    start()
    expect(screen.getByTestId('hook')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'えさを ゆらす' })).toHaveFocus()
  })

  test('泳ぐ魚が食いつく→連打で釣る→全種完成→再挑戦を通せる', () => {
    renderGame()
    start()
    const seen = new Set<string>()
    for (let index = 0; index < FISH.length; index++) {
      const reel = waitForBite()
      expect(reel).toHaveFocus()
      expect(playFishingSound).toHaveBeenCalledWith('bite')
      expect(screen.getByRole('progressbar', { name: 'まきあげ' })).toHaveAttribute('aria-valuenow', '0')
      const taps = reelUntilLanded()
      const fish = newlyCaught(seen)!
      expect(taps).toBeLessThanOrEqual(fish.pulls)
      seen.add(fish.id)
      expect(screen.getByText(`${index + 1} / 6`)).toBeInTheDocument()
      expect(document.querySelector(`[data-fish="${fish.id}"]`)).toBeNull()
      if (index < FISH.length - 1) fireEvent.click(screen.getByRole('button', { name: 'つぎの おさかな' }))
    }
    expect(screen.getByRole('status')).toHaveTextContent('ぜんぶ つれた！')
    expect(playFishingSound).toHaveBeenCalledWith('complete')
    advance(10_000)
    expect(screen.getByText('6 / 6')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(screen.getByText('0 / 6')).toBeInTheDocument()
    advance(100)
    expect(document.querySelectorAll('[data-fish]')).toHaveLength(6)
  })

  test('海をさわると針がそこへ向かって動く', () => {
    renderGame()
    start()
    const sea = screen.getByRole('group', { name: 'おさかなの うみ' })
    vi.spyOn(sea, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) })
    advance(100)
    const hook = screen.getByTestId('hook')
    const before = parseFloat(hook.style.left)
    fireEvent.pointerDown(sea, { clientX: 60, clientY: 320, pointerId: 1 })
    advance(150)
    expect(parseFloat(screen.getByTestId('hook').style.left)).toBeLessThan(before)
    fireEvent.pointerMove(sea, { clientX: 60, clientY: 320, pointerId: 1 })
    fireEvent.pointerUp(sea, { pointerId: 1 })
    advance(2000)
    expect(parseFloat(screen.getByTestId('hook').style.left)).toBeCloseTo(15, 0)
  })

  test('かかったら海をタップしても巻ける。放っておくと逃げて、また釣れる', () => {
    renderGame()
    start()
    waitForBite()
    const sea = screen.getByRole('group', { name: 'おさかなの うみ' })
    fireEvent.pointerDown(sea, { clientX: 10, clientY: 10, pointerId: 1 })
    expect(Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeGreaterThan(0)
    expect(playFishingSound).toHaveBeenCalledWith('reel')
    advance(ESCAPE_MS + 100)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('にげちゃった')
    expect(playFishingSound).toHaveBeenCalledWith('escape')
    expect(screen.getByText('0 / 6')).toBeInTheDocument()
    waitForBite()
    reelUntilLanded()
    expect(screen.getByText('1 / 6')).toBeInTheDocument()
  })

  test('「えさを ゆらす」で待たずに魚を呼べる', () => {
    renderGame()
    start()
    fireEvent.click(screen.getByRole('button', { name: 'えさを ゆらす' }))
    advance(500)
    expect(screen.getByRole('status')).toHaveTextContent('おさかなが きたよ')
    advance((LURE_AFTER_SEC - 1) * 1000)
    expect(screen.getByRole('button', { name: 'まく！' })).toBeInTheDocument()
  })

  test('音を切っても最後まで遊べ、効果音は鳴らない', () => {
    renderGame()
    start()
    fireEvent.click(screen.getByRole('button', { name: 'おとを けす' }))
    vi.mocked(playFishingSound).mockClear()
    waitForBite()
    reelUntilLanded()
    expect(screen.getByText('1 / 6')).toBeInTheDocument()
    expect(playFishingSound).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'おとを だす' }))
    expect(screen.getByRole('button', { name: 'おとを けす' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('かかった途中でタイトルへ戻ると、再入場へ釣果も合図も持ち越さない', () => {
    renderGame()
    start()
    waitForBite()
    fireEvent.click(screen.getByRole('button', { name: 'まく！' }))
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: 'つりを はじめる' })).toHaveFocus()
    advance(10_000)
    expect(screen.getByText('0 / 6')).toBeInTheDocument()
    start()
    expect(screen.getByRole('status')).not.toHaveTextContent('かかった')
    expect(document.querySelectorAll('[data-fish]')).toHaveLength(6)
  })

  test('画面を離れるとアニメーションを止める', () => {
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
    const { unmount } = renderGame()
    start()
    advance(100)
    unmount()
    expect(cancel).toHaveBeenCalled()
    vi.mocked(playFishingSound).mockClear()
    advance(20_000)
    expect(playFishingSound).not.toHaveBeenCalled()
  })
})

describe('fishing route integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('キーボードだけで開始・針の移動・呼び寄せ・釣り上げ・次の魚へ進める', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'えさを ゆらす' })).toHaveFocus()
    act(() => { vi.advanceTimersByTime(50) })
    const before = parseFloat(screen.getByTestId('hook').style.left)
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(parseFloat(screen.getByTestId('hook').style.left)).toBeLessThan(before - 10)
    await user.keyboard(' ')
    act(() => { vi.advanceTimersByTime(LURE_AFTER_SEC * 1000) })
    expect(screen.getByRole('button', { name: 'まく！' })).toHaveFocus()
    for (let i = 0; i < 12 && !screen.queryByRole('button', { name: 'つぎの おさかな' }); i++) await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'つぎの おさかな' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'えさを ゆらす' })).toHaveFocus()
  })

  test('ホーム末尾から遅延ルートへ入り、プレイ→タイトル→ホームへ一階層ずつ戻る', async () => {
    vi.useRealTimers()
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
