import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { observeGameActivity } from './gameActivity'
import { useGameInterval } from './useGameInterval'

function visibility(hidden: boolean) {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden)
  act(() => document.dispatchEvent(new Event('visibilitychange')))
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

test('非表示・blur・pagehideの間は停止し、対応する復帰で一度だけ再開する', () => {
  const change = vi.fn()
  const unsubscribe = observeGameActivity(change)
  expect(change.mock.calls).toEqual([[true]])
  window.dispatchEvent(new Event('blur'))
  visibility(true)
  window.dispatchEvent(new Event('focus'))
  expect(change.mock.calls).toEqual([[true], [false]])
  visibility(false)
  window.dispatchEvent(new Event('focus'))
  window.dispatchEvent(new Event('pagehide'))
  window.dispatchEvent(new Event('focus'))
  expect(change.mock.calls).toEqual([[true], [false], [true], [false]])
  window.dispatchEvent(new Event('pageshow'))
  expect(change.mock.calls.at(-1)).toEqual([true])
  unsubscribe()
  window.dispatchEvent(new Event('blur'))
  visibility(true)
  expect(change).toHaveBeenCalledTimes(5)
})

test('非表示でマウントしても時計を開始せず、復帰後の時間だけを数える', () => {
  vi.useFakeTimers()
  visibility(true)
  const tick = vi.fn()
  const { unmount } = renderHook(() => useGameInterval(tick, 100), { wrapper: StrictMode })
  act(() => vi.advanceTimersByTime(10_000))
  expect(tick).not.toHaveBeenCalled()
  visibility(false)
  act(() => vi.advanceTimersByTime(300))
  expect(tick).toHaveBeenCalledTimes(3)
  act(() => window.dispatchEvent(new Event('blur')))
  act(() => vi.advanceTimersByTime(20_000))
  expect(tick).toHaveBeenCalledTimes(3)
  act(() => window.dispatchEvent(new Event('focus')))
  act(() => vi.advanceTimersByTime(100))
  expect(tick).toHaveBeenCalledTimes(4)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

test('描画でcallbackが変わっても周期をリセットせず、停止・再入場で多重登録しない', () => {
  vi.useFakeTimers()
  const before = vi.fn(), after = vi.fn()
  const { rerender, unmount } = renderHook(({ tick, delay }) => useGameInterval(tick, delay), {
    initialProps: { tick: before, delay: 100 as number | null },
  })
  act(() => vi.advanceTimersByTime(50))
  rerender({ tick: after, delay: 100 })
  act(() => vi.advanceTimersByTime(50))
  expect(before).not.toHaveBeenCalled()
  expect(after).toHaveBeenCalledTimes(1)
  rerender({ tick: after, delay: null })
  expect(vi.getTimerCount()).toBe(0)
  rerender({ tick: after, delay: 100 })
  expect(vi.getTimerCount()).toBe(1)
  unmount()
  window.dispatchEvent(new Event('focus'))
  expect(vi.getTimerCount()).toBe(0)
})
