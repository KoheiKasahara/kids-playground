import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import StripeRally from './StripeRally'
import { advance, grid, LAPS, position, RECHARGE } from './race'

vi.mock('./sounds')
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

test('操作なしで完走し、ダッシュして再挑戦できる。退出後のタイマーは残らない', () => {
  vi.useFakeTimers()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const game = render(<MemoryRouter><StripeRally /></MemoryRouter>)
  const button = (name: RegExp) => screen.getByRole('button', { name })
  fireEvent.click(button(/スタート/))
  act(() => vi.advanceTimersByTime(40_000))
  expect(screen.getByRole('status')).toHaveTextContent(/[1-3]いで かんそう/)
  fireEvent.click(button(/もういちど/))
  fireEvent.click(button(/ダッシュ/))
  expect(button(/じゅうでん/)).toHaveAttribute('aria-disabled', 'true')
  act(() => vi.advanceTimersByTime(4100))
  expect(button(/ダッシュ/)).toHaveAttribute('aria-disabled', 'false')
  fireEvent.click(button(/もどる/))
  expect(button(/スタート/)).toBeVisible()
  fireEvent.click(button(/スタート/))
  game.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

test('チャージのたびにダッシュすると両方の車を追い抜ける', () => {
  let race = grid()
  for (let i = 0; i < 1000 && race.distance < LAPS; i++) {
    if (race.cooldown === 0) race.cooldown = RECHARGE
    race = advance(race)
  }
  expect(race.distance).toBe(LAPS)
  expect(position(race)).toBe(1)
})
