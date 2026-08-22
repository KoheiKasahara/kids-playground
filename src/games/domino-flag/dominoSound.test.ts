import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  DOMINO_COMPLETE_SOUND_DELAY_MS,
  DOMINO_SOUND_MIN_INTERVAL_MS,
  advanceDominoSoundSchedule,
  createDominoFallTracker,
  createDominoSoundController,
  dominoTickIntensityForCount,
} from './dominoSound'
import { createDominoCourse } from './dominoCourse'

function createTilts(dominoCount: number, fallenCount: number): number[] {
  return Array.from({ length: dominoCount }, (_, index) => (index < fallenCount ? 0.5 : 0))
}

function createTestController(
  soundEnabled: boolean | (() => boolean) = true,
  dominoCount = 10,
) {
  const playTick = vi.fn()
  const playComplete = vi.fn()
  const controller = createDominoSoundController({
    dominoCount,
    playTick,
    playComplete,
    soundEnabled,
    now: () => 0,
  })

  return {
    controller,
    playTick,
    playComplete,
  }
}

describe('dominoSound', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('しきい値を超えた新規倒伏だけを一度ずつ検出する', () => {
    const tracker = createDominoFallTracker(3)

    expect(tracker.countNewFalls([0.1, 0.41, 0.39])).toBe(1)
    expect(tracker.getRemainingCount()).toBe(2)
    expect(tracker.countNewFalls([0.5, 0.7, 0.5])).toBe(2)
    expect(tracker.getRemainingCount()).toBe(0)
    expect(tracker.countNewFalls([1, 1, 1])).toBe(0)
  })

  test('クールダウン内の複数倒伏を代表音1発にまとめる', () => {
    const { controller, playTick } = createTestController()

    controller.scan(createTilts(10, 1), 0)
    controller.scan(createTilts(10, 4), 10)
    controller.scan(createTilts(10, 5), 20)

    expect(playTick).toHaveBeenCalledTimes(1)
    expect(playTick).toHaveBeenLastCalledWith(0.5)

    controller.scan(createTilts(10, 5), DOMINO_SOUND_MIN_INTERVAL_MS)

    expect(playTick).toHaveBeenCalledTimes(2)
    expect(playTick).toHaveBeenLastCalledWith(0.8)
  })

  test('保留数に応じてintensityが上がり、上限で頭打ちになる', () => {
    const one = createTestController()
    one.controller.scan(createTilts(10, 1), 0)
    expect(one.playTick).toHaveBeenLastCalledWith(0.5)

    const many = createTestController(true, 20)
    many.controller.scan(createTilts(20, 6), 0)
    expect(many.playTick).toHaveBeenLastCalledWith(1)
    many.controller.scan(createTilts(20, 20), DOMINO_SOUND_MIN_INTERVAL_MS)
    expect(many.playTick).toHaveBeenLastCalledWith(1)
  })

  test('クールダウン経過後は保留音を鳴らし、その後も再び鳴る', () => {
    const { controller, playTick } = createTestController()

    controller.scan(createTilts(10, 1), 0)
    controller.scan(createTilts(10, 2), DOMINO_SOUND_MIN_INTERVAL_MS - 1)
    expect(playTick).toHaveBeenCalledTimes(1)

    controller.scan(createTilts(10, 2), DOMINO_SOUND_MIN_INTERVAL_MS)
    expect(playTick).toHaveBeenCalledTimes(2)

    controller.scan(createTilts(10, 3), DOMINO_SOUND_MIN_INTERVAL_MS * 2)
    expect(playTick).toHaveBeenCalledTimes(3)
  })

  test('完成通知後はドミノ音をダッキングする', () => {
    const { controller, playTick, playComplete } = createTestController()

    controller.scan(createTilts(10, 1), 0)
    controller.notifyComplete(0)
    controller.scan(createTilts(10, 10), DOMINO_SOUND_MIN_INTERVAL_MS * 2)
    vi.advanceTimersByTime(DOMINO_COMPLETE_SOUND_DELAY_MS)

    expect(playTick).toHaveBeenCalledTimes(1)
    expect(playComplete).toHaveBeenCalledTimes(1)
  })

  test('完成SEは通知が複数回でも1回だけ遅延再生する', () => {
    const { controller, playComplete } = createTestController()

    controller.notifyComplete(0)
    controller.notifyComplete(0)
    expect(playComplete).not.toHaveBeenCalled()

    vi.advanceTimersByTime(DOMINO_COMPLETE_SOUND_DELAY_MS - 1)
    expect(playComplete).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(playComplete).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(DOMINO_COMPLETE_SOUND_DELAY_MS * 2)
    expect(playComplete).toHaveBeenCalledTimes(1)
  })

  test('dispose後は完成SEが鳴らず、タイマーも残さない', () => {
    const { controller, playComplete } = createTestController()

    controller.notifyComplete(0)
    controller.dispose()
    vi.advanceTimersByTime(DOMINO_COMPLETE_SOUND_DELAY_MS)

    expect(playComplete).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  test('新しいコントローラなら完成SEをもう一度だけ鳴らせる', () => {
    const first = createTestController()
    first.controller.notifyComplete(0)
    vi.advanceTimersByTime(DOMINO_COMPLETE_SOUND_DELAY_MS)

    const second = createTestController()
    second.controller.notifyComplete(DOMINO_COMPLETE_SOUND_DELAY_MS)
    second.controller.notifyComplete(DOMINO_COMPLETE_SOUND_DELAY_MS)
    vi.advanceTimersByTime(DOMINO_COMPLETE_SOUND_DELAY_MS)

    expect(first.playComplete).toHaveBeenCalledTimes(1)
    expect(second.playComplete).toHaveBeenCalledTimes(1)
  })

  test('サウンドOFFでも検出と保留は進むが、音は鳴らさない', () => {
    const { controller, playTick, playComplete } = createTestController(false)

    controller.scan(createTilts(10, 3), 0)
    controller.scan(createTilts(10, 6), DOMINO_SOUND_MIN_INTERVAL_MS)
    controller.notifyComplete(0)
    vi.advanceTimersByTime(DOMINO_COMPLETE_SOUND_DELAY_MS)

    expect(playTick).not.toHaveBeenCalled()
    expect(playComplete).not.toHaveBeenCalled()
  })

  test('純粋スケジューラは発音許可がない間も保留数を保持する', () => {
    const waiting = advanceDominoSoundSchedule(
      { pendingCount: 0, lastPlayedAt: null },
      3,
      0,
      false,
    )
    const played = advanceDominoSoundSchedule(waiting.state, 0, DOMINO_SOUND_MIN_INTERVAL_MS, true)

    expect(waiting.intensity).toBeNull()
    expect(waiting.state.pendingCount).toBe(3)
    expect(played.intensity).toBe(0.7)
  })

  test('ボール区間を含むロング277枚でも同時倒伏の間引きと残数を維持する', () => {
    const dominoCount = createDominoCourse('long', 'jp').placements.length
    expect(dominoCount).toBe(277)

    const tracker = createDominoFallTracker(dominoCount)
    const allFallen = createTilts(dominoCount, dominoCount)
    expect(tracker.countNewFalls(allFallen)).toBe(dominoCount)
    expect(tracker.getRemainingCount()).toBe(0)
    expect(dominoTickIntensityForCount(dominoCount)).toBeLessThanOrEqual(1)

    const playTick = vi.fn()
    const playComplete = vi.fn()
    const controller = createDominoSoundController({
      dominoCount,
      playTick,
      playComplete,
      soundEnabled: true,
      now: () => 0,
    })
    const firstBatch = createTilts(dominoCount, Math.floor(dominoCount / 2))
    controller.scan(firstBatch, 0)
    controller.scan(allFallen, DOMINO_SOUND_MIN_INTERVAL_MS - 1)
    expect(playTick).toHaveBeenCalledTimes(1)

    controller.scan(allFallen, DOMINO_SOUND_MIN_INTERVAL_MS)
    expect(playTick).toHaveBeenCalledTimes(2)
    expect(
      playTick.mock.calls.every(([intensity]) => intensity <= 1),
    ).toBe(true)
    controller.dispose()
  })
})
