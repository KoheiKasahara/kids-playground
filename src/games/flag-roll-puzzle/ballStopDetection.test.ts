import { describe, expect, test } from 'vitest'
import { observeBallStop, createStopObservation } from './ballStopDetection'
import { STOP_DURATION_MS } from './puzzlePhysics'

describe('ballStopDetection', () => {
  test('低速でも、十分な時間と位置の静止がそろうまで途中停止にしない', () => {
    let observation = createStopObservation()
    const first = observeBallStop(observation, { x: 100, y: 200, speed: 0.04 }, 1000, false)
    observation = first.observation
    expect(first.stopped).toBe(false)

    const tooSoon = observeBallStop(observation, { x: 100.2, y: 200.1, speed: 0.04 }, 1000 + STOP_DURATION_MS - 1, false)
    observation = tooSoon.observation
    expect(tooSoon.stopped).toBe(false)

    expect(observeBallStop(observation, { x: 100.2, y: 200.1, speed: 0.04 }, 1000 + STOP_DURATION_MS, false).stopped).toBe(true)
  })

  test('ゆっくり転がり続けて位置が変わる場合は途中停止にしない', () => {
    let observation = createStopObservation()
    observation = observeBallStop(observation, { x: 100, y: 200, speed: 0.04 }, 0, false).observation
    const moving = observeBallStop(observation, { x: 102, y: 200, speed: 0.04 }, STOP_DURATION_MS + 100, false)
    expect(moving.stopped).toBe(false)
    expect(moving.observation.quietSince).toBe(STOP_DURATION_MS + 100)
  })

  test('一瞬だけの低速は、その後に速度が戻れば停止候補をリセットする', () => {
    const quiet = observeBallStop(createStopObservation(), { x: 100, y: 200, speed: 0.04 }, 0, false)
    const moving = observeBallStop(quiet.observation, { x: 100, y: 200, speed: 1 }, 100, false)
    expect(moving.stopped).toBe(false)
    expect(moving.observation.quietSince).toBeNull()
  })

  test('ゴール内は長時間静止しても途中停止にしない', () => {
    const quiet = observeBallStop(createStopObservation(), { x: 100, y: 600, speed: 0 }, 0, true)
    expect(quiet.stopped).toBe(false)
    expect(quiet.observation.quietSince).toBeNull()
  })
})
