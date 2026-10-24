import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { isSoundEnabled } from '../../audio/sound'
import surfaceStyles from '../../components/GamePlaySurface.module.css'
import App from '../../app/App'
import { resetGameShelfCache } from '../../pages/gameShelfStore'
import SugorokuPlay, { COMPUTER_DELAY_MS, REST_MS, RESULT_DELAY_MS } from './SugorokuPlay'
import { playSugorokuSound } from './sounds'

vi.mock('./sounds', () => ({ playSugorokuSound: vi.fn() }))
vi.mock('../../audio/sound', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../audio/sound')>(),
  primeAudio: vi.fn(),
}))
vi.mock('../../utils/haptics', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../utils/haptics')>(),
  vibrate: vi.fn(),
}))

/** つぎに でる サイコロの め。なくなったら 1 が でる。 */
let rolls: number[] = []

function renderGame() {
  return render(<StrictMode><MemoryRouter><SugorokuPlay /></MemoryRouter></StrictMode>)
}

function advance(ms: number) {
  act(() => { vi.advanceTimersByTime(ms) })
}

const status = () => screen.getByRole('status')
const dice = () => screen.getByRole('button', { name: 'サイコロを ふる' })
const positionOf = (player: number) => Number(document.querySelector(`[data-player="${player}"]`)?.getAttribute('data-position'))

/** うごきおわって、つぎの ひとの ばん・おやすみ・ゴールの どれかを みせている。 */
const settled = () => /の ばん|おやすみ|ゴール！/.test(status().textContent ?? '')

/** サイコロを ふって、その ばんが おわるまで すすめる（コンピュータの ばんは まだ ふらない）。 */
function roll(value: number) {
  rolls.push(value)
  fireEvent.click(dice())
  waitForTurn()
}

function waitForTurn() {
  for (let n = 0; n < 100; n++) {
    advance(100)
    if (settled()) return
  }
  throw new Error(`turn did not finish: ${status().textContent}`)
}

beforeEach(() => {
  rolls = []
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockImplementation(() => ((rolls.shift() ?? 1) - 0.5) / 6)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.mocked(playSugorokuSound).mockClear()
})

describe('SugorokuPlay', () => {
  test('えらぶ → サイコロで すすむ → しかけ → ゴール → もういちど → えらびなおす', () => {
    const { container } = renderGame()
    expect(container.querySelector(`.${surfaceStyles.surface}`)).toBeNull()
    expect(screen.getByRole('button', { name: /もりの こみち/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'ふたり' }))
    expect(screen.getByRole('button', { name: 'ふたり' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^ひとり/ })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'はじめる！' }))

    expect(container.querySelector(`.${surfaceStyles.surface}`)).not.toBeNull()
    expect(status()).toHaveTextContent('うさぎさんの ばん！')
    expect(dice()).toHaveFocus()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    // 3 で「+2 すすむ」に とまり、5 まで すすむ。1マスずつ かぞえながら うごく。
    rolls.push(3)
    fireEvent.click(dice())
    expect(status()).toHaveTextContent('ころころ')
    expect(dice()).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(dice())
    advance(800)
    expect(status()).toHaveTextContent('3が でた！')
    advance(500)
    expect(positionOf(0)).toBe(1)
    advance(1000)
    expect(status()).toHaveTextContent('やったね！ 2 すすむ')
    waitForTurn()
    expect(positionOf(0)).toBe(5)
    expect(status()).toHaveTextContent('くまさんの ばん！')
    expect(playSugorokuSound).toHaveBeenCalledWith('good', undefined)

    roll(4)
    expect(positionOf(1)).toBe(4)
    // 「もう1かい」なら おなじ ひとが また ふる。
    roll(1)
    expect(positionOf(0)).toBe(6)
    expect(status()).toHaveTextContent('うさぎさんの ばん！')
    // 「ワープ」で 11 から 15 へ。
    roll(5)
    expect(positionOf(0)).toBe(15)
    roll(6)
    expect(positionOf(1)).toBe(10)
    expect(screen.getAllByRole('listitem')[1]).toHaveTextContent('のこり 9')

    roll(4)
    expect(positionOf(0)).toBe(19)
    expect(status()).toHaveTextContent('うさぎさんが ゴール！')
    expect(playSugorokuSound).toHaveBeenCalledWith('goal')
    expect(screen.queryByRole('button', { name: 'もういちど' })).toBeNull()
    advance(RESULT_DELAY_MS)
    const result = screen.getByRole('region', { name: 'うさぎさんの かち！' })
    const places = within(result).getAllByRole('listitem')
    expect(places[0]).toHaveTextContent('1いうさぎさんゴール！')
    expect(places[1]).toHaveTextContent('2いくまさんのこり 9マス')
    expect(screen.getByRole('button', { name: 'もういちど' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(status()).toHaveTextContent('うさぎさんの ばん！')
    expect([positionOf(0), positionOf(1)]).toEqual([0, 0])
    expect(screen.queryByRole('button', { name: 'もういちど' })).toBeNull()

    roll(2)
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: 'はじめる！' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ふたり' })).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelector(`.${surfaceStyles.surface}`)).toBeNull()
    advance(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('ひとりでは コンピュータの くまさんが じぶんで ふり、やすみの マスでは 1かい とばす', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /^うみの ぼうけん/ }))
    fireEvent.click(screen.getByRole('button', { name: 'はじめる！' }))
    expect(screen.getByText('コンピュータ')).toBeInTheDocument()

    roll(6)
    expect(positionOf(0)).toBe(6)
    expect(status()).toHaveTextContent('くまさんの ばん')
    expect(dice()).toHaveAttribute('aria-disabled', 'true')
    // コンピュータの ばんに おしても なにも おきない。
    fireEvent.click(dice())
    expect(status()).toHaveTextContent('くまさんの ばん')

    rolls.push(1)
    advance(COMPUTER_DELAY_MS)
    expect(status()).toHaveTextContent('ころころ')
    waitForTurn()
    expect(positionOf(1)).toBe(1)
    expect(status()).toHaveTextContent('うさぎさんの ばん！')

    roll(6)
    expect(positionOf(0)).toBe(12)
    rolls.push(2)
    advance(COMPUTER_DELAY_MS)
    waitForTurn()
    expect(positionOf(1)).toBe(3)

    // 12 → 13 は「やすみ」。くまさんが ふった あと、うさぎさんは 1かい やすむ。
    roll(1)
    expect(positionOf(0)).toBe(13)
    rolls.push(1)
    advance(COMPUTER_DELAY_MS)
    waitForTurn()
    expect(positionOf(1)).toBe(4)
    expect(status()).toHaveTextContent('うさぎさんは おやすみ')
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('おやすみ')
    expect(dice()).toHaveAttribute('aria-disabled', 'true')
    expect(playSugorokuSound).toHaveBeenCalledWith('rest')

    advance(REST_MS)
    expect(status()).toHaveTextContent('くまさんの ばん')
    rolls.push(2)
    advance(COMPUTER_DELAY_MS)
    waitForTurn()
    expect(positionOf(1)).toBe(6)
    expect(status()).toHaveTextContent('うさぎさんの ばん！')
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('のこり 16')
  })

  test('とちゅうで もどったり ぬけたり すると、タイマーと おとを かたづける', () => {
    const { unmount } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'はじめる！' }))
    rolls.push(6)
    fireEvent.click(dice())
    advance(900)
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    advance(1)
    expect(vi.getTimerCount()).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'はじめる！' }))
    expect([positionOf(0), positionOf(1)]).toEqual([0, 0])
    roll(2)
    fireEvent.click(screen.getByRole('button', { name: 'おとを けす' }))
    expect(isSoundEnabled()).toBe(false)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(isSoundEnabled()).toBe(true)
  })

  test('ばんめんは マスの しゅるいを もじでも しめし、コマの いばしょを よみあげる', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /^おかしの くに/ }))
    fireEvent.click(screen.getByRole('button', { name: 'さんにん' }))
    fireEvent.click(screen.getByRole('button', { name: 'はじめる！' }))
    const board = screen.getByRole('img', { name: /^おかしの くに。/ })
    expect(board).toHaveAccessibleName('おかしの くに。うさぎさんは スタート、くまさんは スタート、ねこさんは スタート')
    expect(board.querySelectorAll('[data-square]')).toHaveLength(25)
    expect(board.querySelector('[data-square="2"]')).toHaveTextContent('+2すすむ')
    expect(board.querySelector('[data-square="5"]')).toHaveTextContent('やすみ')
    expect(board.querySelector('[data-square="9"]')).toHaveTextContent('ワープ')
    expect(board.querySelector('[data-square="12"]')).toHaveTextContent('−2もどる')
    expect(board.querySelector('[data-square="24"]')).toHaveTextContent('ゴール')
    roll(1)
    expect(screen.getByRole('img', { name: /^おかしの くに。/ })).toHaveAccessibleName(/うさぎさんは 1ばんめの マス/)
  })
})

describe('sugoroku route integration', () => {
  test('ホームから遅延ルートへ入り、プレイ→えらぶ→ホームへ一階層ずつ戻る', async () => {
    vi.useRealTimers()
    localStorage.clear()
    resetGameShelfCache()
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: 'わくわく すごろく' }))
    expect(await screen.findByRole('heading', { name: 'わくわく すごろく' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'はじめる！' }))
    expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: 'はじめる！' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
  })
})
