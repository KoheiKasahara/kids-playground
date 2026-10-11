import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { isSoundEnabled } from '../../audio/sound'
import surfaceStyles from '../../components/GamePlaySurface.module.css'
import TontonSumoPlay from './TontonSumoPlay'
import { COMPUTER_INTERVAL_MS, RING_EDGE } from './sumoGame'

function renderGame() {
  return render(<StrictMode><MemoryRouter><TontonSumoPlay /></MemoryRouter></StrictMode>)
}
function advance(ms: number) { act(() => { vi.advanceTimersByTime(ms) }) }
function leftTap() { fireEvent.click(screen.getByRole('button', { name: 'ひだりの トン！' })) }

beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] }))
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('TontonSumoPlay', () => {
  test('the winning touch cannot activate replay with its following compatibility click', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /ふたりで/ }))
    for (let n = 0; n < RING_EDGE; n++) {
      advance(150)
      const pointer = new Event('pointerdown', { bubbles: true, cancelable: true })
      Object.defineProperty(pointer, 'button', { value: 0 })
      fireEvent(screen.getByRole('button', { name: 'ひだりの トン！' }), pointer)
    }
    const replay = screen.getByRole('button', { name: 'もういちど' })
    fireEvent.click(replay, { detail: 1 })
    expect(screen.getByRole('status')).toHaveTextContent('おもちの かち！')
    fireEvent.pointerDown(replay)
    fireEvent.click(replay, { detail: 1 })
    expect(screen.getByRole('status')).toHaveTextContent('はっけよい')
  })

  test('selection → two-player match → winner → replay → selection', () => {
    const { container } = renderGame()
    expect(container.querySelector(`.${surfaceStyles.surface}`)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'まめ' }))
    expect(screen.getByRole('button', { name: 'まめ' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /ふたりで/ }))
    expect(container.querySelector(`.${surfaceStyles.surface}`)).not.toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('はっけよい')
    for (let n = 0; n < RING_EDGE; n++) { advance(150); leftTap() }
    expect(screen.getByRole('status')).toHaveTextContent('まめの かち！')
    expect(screen.getByRole('button', { name: 'もういちど' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'ひだりの トン！' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(screen.getByRole('status')).toHaveTextContent('はっけよい')
    expect(screen.getByRole('button', { name: 'ひだりの トン！' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: /ひとりで/ })).toBeInTheDocument()
    expect(container.querySelector(`.${surfaceStyles.surface}`)).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  test('solo waits for the first tap, then plays slowly and can win', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /ひとりで/ }))
    advance(30000)
    expect(screen.getByRole('status')).toHaveTextContent('はっけよい')
    leftTap()
    advance(COMPUTER_INTERVAL_MS * (RING_EDGE + 1))
    expect(screen.getByRole('status')).toHaveTextContent('そらの かち！')
    expect(vi.getTimerCount()).toBe(0)
  })

  test('keyboard A/L supports either player, ignores repeat and removes handlers on exit', () => {
    const { unmount } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: /ふたりで/ }))
    for (let n = 0; n < RING_EDGE + 2; n++) { advance(150); fireEvent.keyDown(window, { key: 'l', repeat: true }) }
    expect(screen.getByRole('status')).toHaveTextContent('はっけよい')
    for (let n = 0; n < RING_EDGE; n++) { advance(150); fireEvent.keyDown(window, { key: 'l' }) }
    expect(screen.getByRole('status')).toHaveTextContent('そらの かち！')
    unmount()
    fireEvent.keyDown(window, { key: 'a' })
    expect(vi.getTimerCount()).toBe(0)
  })

  test('hidden tabs pause the computer; returning and unmounting cleans up sound and timers', () => {
    const { unmount } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: /ひとりで/ }))
    leftTap()
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
