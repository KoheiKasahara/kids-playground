import { afterEach, describe, expect, it, vi } from 'vitest'
import { createResizeScheduler } from './sceneResize'

afterEach(() => {
  vi.useRealTimers()
})

describe('createResizeScheduler', () => {
  it('すぐ1回と、遅延ぶんの測り直しを行う', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const scheduler = createResizeScheduler(run, [0, 100])

    scheduler.schedule()
    expect(run).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)
    expect(run).toHaveBeenCalledTimes(3)
  })

  it('cancelすると予約ぶんは実行されない', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const scheduler = createResizeScheduler(run, [50, 200])

    scheduler.schedule()
    scheduler.cancel()
    vi.advanceTimersByTime(500)

    expect(run).toHaveBeenCalledTimes(1)
  })

  it('連続で呼ばれても予約が積み残らない', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const scheduler = createResizeScheduler(run, [10])

    scheduler.schedule()
    scheduler.schedule()
    vi.advanceTimersByTime(10)
    scheduler.cancel()
    vi.advanceTimersByTime(500)

    expect(run).toHaveBeenCalledTimes(4)
  })
})
