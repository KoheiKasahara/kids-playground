import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { isSoundEnabled } from '../../audio/sound'
import surfaceStyles from '../../components/GamePlaySurface.module.css'
import TontonSumoPlay, { RESULT_DELAY_MS } from './TontonSumoPlay'
import { COMPUTER_INTERVAL_MS } from './sumoGame'
import { WIDE_VIEW, project } from './projection'
import { startBgm } from './sounds'

const stopBgm = vi.hoisted(() => vi.fn())
vi.mock('./sounds', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sounds')>()
  return { ...actual, startBgm: vi.fn(() => stopBgm) }
})

function renderGame() {
  return render(<StrictMode><MemoryRouter><TontonSumoPlay /></MemoryRouter></StrictMode>)
}
function advance(ms: number) { act(() => { vi.advanceTimersByTime(ms) }) }
function scene() { return document.querySelector('svg[role="img"]') as SVGSVGElement }
/** Pointer-down on the box at ring coordinates; the SVG is laid out 1:1 with its viewBox. */
function tapBox(x: number, z: number, target: Element = scene()) {
  const p = project(x, z)
  fireEvent.pointerDown(target, { button: 0, clientX: p.x - WIDE_VIEW.x, clientY: p.y - WIDE_VIEW.y })
}
function tapUntilDecided(x: number, z = 0) {
  for (let n = 0; n < 120 && !screen.getByRole('status').textContent?.includes('かち'); n++) {
    tapBox(x, z)
    advance(200)
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { left: 0, top: 0, width: WIDE_VIEW.width, height: WIDE_VIEW.height, right: WIDE_VIEW.width, bottom: WIDE_VIEW.height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.mocked(startBgm).mockClear(); stopBgm.mockClear() })

describe('TontonSumoPlay', () => {
  test('pick both wrestlers → two-player bout decided by taps → replay → back to selection', () => {
    const { container } = renderGame()
    expect(container.querySelector(`.${surfaceStyles.surface}`)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^えんぴつ（おおきさ 5、おもさ 2）/ }))
    expect(screen.getByRole('button', { name: /^えんぴつ（おおきさ 5、おもさ 2）/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /あお/ }))
    fireEvent.click(screen.getByRole('button', { name: /^ロボット/ }))
    expect(screen.getByRole('button', { name: /あお/ })).toHaveTextContent('ロボット')
    expect(screen.getByRole('button', { name: /あか/ })).toHaveTextContent('えんぴつ')

    fireEvent.click(screen.getByRole('button', { name: /ふたりで/ }))
    expect(container.querySelector(`.${surfaceStyles.surface}`)).not.toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('はっけよい')
    expect(screen.getByRole('button', { name: /はこを トントン/ })).toHaveFocus()
    // Folded along the back: the near half shows the printed wrestler, the far half its blank inside.
    for (const side of ['left', 'right']) {
      expect(scene().querySelectorAll(`[data-side="${side}"] [data-face="print"]`)).toHaveLength(1)
      expect(scene().querySelectorAll(`[data-side="${side}"] [data-face="blank"]`)).toHaveLength(1)
    }
    tapBox(-1.25, 0)
    expect(screen.getByRole('status')).toHaveTextContent('のこった')
    tapUntilDecided(-1.25)
    expect(screen.getByRole('status')).toHaveTextContent('えんぴつの かち！')
    expect(screen.queryByRole('button', { name: 'もういちど' })).toBeNull()
    advance(RESULT_DELAY_MS)
    expect(screen.getByRole('button', { name: 'もういちど' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(screen.getByRole('status')).toHaveTextContent('はっけよい')
    // The right player wins from their own half.
    tapUntilDecided(1.25)
    expect(screen.getByRole('status')).toHaveTextContent('ロボットの かち！')
    advance(RESULT_DELAY_MS)
    fireEvent.click(screen.getByRole('button', { name: 'えらびなおす' }))
    expect(screen.getByRole('button', { name: /ひとりで/ })).toBeInTheDocument()
    expect(container.querySelector(`.${surfaceStyles.surface}`)).toBeNull()
    advance(1) // jsdom queues a selectionchange after focus moves
    expect(vi.getTimerCount()).toBe(0)
  })

  test('8-bit BGM plays only during the bout and follows the sound toggle', () => {
    renderGame()
    expect(startBgm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /ふたりで/ }))
    expect(startBgm).toHaveBeenCalled()
    const started = vi.mocked(startBgm).mock.calls.length
    const stopped = stopBgm.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'おとを けす' }))
    expect(stopBgm).toHaveBeenCalledTimes(stopped + 1)
    fireEvent.click(screen.getByRole('button', { name: 'おとを だす' }))
    expect(startBgm).toHaveBeenCalledTimes(started + 1)

    tapUntilDecided(-1.25)
    expect(stopBgm).toHaveBeenCalledTimes(stopped + 2)
    advance(RESULT_DELAY_MS)
    fireEvent.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(startBgm).toHaveBeenCalledTimes(started + 2)
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: /ひとりで/ })).toBeInTheDocument()
    expect(stopBgm).toHaveBeenCalledTimes(stopped + 3)
  })

  test('taps anywhere on the play area count, but not on the header buttons', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /ふたりで/ }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'おとを けす' }), { button: 0, clientX: 10, clientY: 10 })
    expect(screen.getByRole('status')).toHaveTextContent('はっけよい')
    fireEvent.pointerDown(screen.getByRole('button', { name: 'おとを けす' }).closest('main')!.querySelector('section')!, { button: 0, clientX: 600, clientY: 900 })
    expect(screen.getByRole('status')).toHaveTextContent('のこった')
  })

  test('solo waits for the first tap, then the computer taps slowly and can win', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /ひとりで/ }))
    advance(30000)
    expect(screen.getByRole('status')).toHaveTextContent('はっけよい')
    tapBox(0.2, 0)
    for (let n = 0; n < 120 && !screen.getByRole('status').textContent?.includes('かち'); n++) advance(COMPUTER_INTERVAL_MS)
    expect(screen.getByRole('status')).toHaveTextContent('おにぎりの かち！')
    advance(RESULT_DELAY_MS + 3000)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('keyboard A/L tap behind either wrestler, ignore repeat and remove handlers on exit', () => {
    const { unmount } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: /ふたりで/ }))
    for (let n = 0; n < 20; n++) { advance(150); fireEvent.keyDown(window, { key: 'l', repeat: true }) }
    expect(screen.getByRole('status')).toHaveTextContent('はっけよい')
    for (let n = 0; n < 120 && !screen.getByRole('status').textContent?.includes('かち'); n++) { advance(200); fireEvent.keyDown(window, { key: 'l' }) }
    expect(screen.getByRole('status')).toHaveTextContent('おにぎりの かち！')
    unmount()
    fireEvent.keyDown(window, { key: 'a' })
    expect(vi.getTimerCount()).toBe(0)
  })

  test('hidden tabs pause the computer; returning and unmounting cleans up sound and timers', () => {
    const { unmount } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: /ひとりで/ }))
    fireEvent.keyDown(window, { key: ' ', code: 'Space' })
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    advance(30000)
    expect(screen.getByRole('status')).toHaveTextContent('のこった')
    hidden.mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'おとを けす' }))
    expect(isSoundEnabled()).toBe(false)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(isSoundEnabled()).toBe(true)
    renderGame()
    expect(screen.getByRole('button', { name: /ひとりで/ })).toBeInTheDocument()
  })
})
