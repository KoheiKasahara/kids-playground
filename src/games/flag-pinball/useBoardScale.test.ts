import { describe, expect, it } from 'vitest'
import { BOARD_HEIGHT, BOARD_WIDTH } from './boardLayout'
import { computeBoardScale } from './useBoardScale'

describe('computeBoardScale', () => {
  it.each([
    [359, 744, 0.744],
    [374, 776, 0.776],
    [344, 732, 344 / 480],
    [1008, 700, 0.7],
  ])('利用可能領域 %d×%d に盤面全体を収める', (width, height, expectedScale) => {
    const scale = computeBoardScale(width, height)
    expect(scale).toBeCloseTo(expectedScale, 6)
    expect(BOARD_WIDTH * scale).toBeLessThanOrEqual(width + 0.000001)
    expect(BOARD_HEIGHT * scale).toBeLessThanOrEqual(height + 0.000001)
  })

  it('初回計測前の0や負値では等倍にフォールバックする', () => {
    expect(computeBoardScale(0, 700)).toBe(1)
    expect(computeBoardScale(400, -1)).toBe(1)
  })
})
