import { describe, expect, it } from 'vitest'
import { createCannonSensorBody, createPuzzlePartBodies, createPuzzleSpinnerBody } from './usePuzzleEngine'

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

  it('ジャンプ台は配置したIDと向きを持つ静的な傾斜Bodyを作る', () => {
    const bodies = createPuzzlePartBodies({
      id: 'part-ramp',
      typeId: 'jumpRampRight',
      cell: { col: 2, row: 3 },
    })
    expect(bodies).toHaveLength(1)
    expect(bodies[0].isStatic).toBe(true)
    expect(bodies[0].label).toBe('jump-ramp:jumpRampRight:part-ramp:0')
    expect(bodies[0].angle).toBeLessThan(0)
  })
})
