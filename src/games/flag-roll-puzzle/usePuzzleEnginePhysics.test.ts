import { describe, expect, it } from 'vitest'
import { createCannonSensorBody, createPuzzleSpinnerBody } from './usePuzzleEngine'

describe('flag-roll-puzzle の特殊パーツBody', () => {
  it('キャノンは置かれたidをラベルへ含む円形センサーだけを作る', () => {
    const sensor = createCannonSensorBody({
      id: 'part-42',
      typeId: 'cannon',
      cell: { col: 2, row: 3 },
    })
    expect(sensor.label).toBe('cannon-sensor:part-42')
    expect(sensor.isSensor).toBe(true)
    expect(sensor.isStatic).toBe(true)
    expect(sensor.circleRadius).toBeGreaterThan(0)
  })

  it('Spinnerは静的な面取り十字Bodyを返す', () => {
    const spinner = createPuzzleSpinnerBody({
      id: 'part-7',
      typeId: 'spinner',
      cell: { col: 2, row: 3 },
    })
    expect(spinner.isStatic).toBe(true)
    expect(spinner.isSensor).toBe(false)
    expect(spinner.parts).toHaveLength(3)
  })
})

