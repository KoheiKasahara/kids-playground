import { describe, expect, test } from 'vitest'
import { createCourse, type GateRow } from './course'
import { initialRun, jumpHeight, jumpRun, meteorX, stepRun } from './game'

const meteorRow: GateRow = { distance: 1, lanes: ['+4', null, null], meteor: { from: -1, to: 0 } }

describe('ほしぞらパレード', () => {
  test('ゲートの数と位置が変わり、すべての列に素通りできる道がある', () => {
    const course = createCourse(() => 0)
    const other = createCourse(() => 0.75)
    expect(other[0]).toEqual({ distance: 1, lanes: ['+3', null, '×2'] })
    expect(course[0]).toEqual(other[0])
    expect(other.slice(1)).not.toEqual(course.slice(1))
    for (const rows of [course, other]) {
      expect(rows.map(row => row.distance)).toEqual(rows.map((_, i) => i + 1))
      expect(rows.some(row => row.lanes[1])).toBe(true)
      expect(rows.filter(row => row.meteor).length).toBeGreaterThanOrEqual(2)
      expect(rows.some(row => row.meteor && row.lanes.every(label => label === null))).toBe(true)
      for (const row of rows) {
        expect(row.lanes.some((label, i) => label === null && row.meteor?.to !== i - 1)).toBe(true)
        if (row.meteor) {
          expect(row.lanes[row.meteor.to + 1]).toBeNull()
          expect(row.meteor.to).not.toBe(row.meteor.from)
        }
      }
    }
  })

  test('空いたレーンは素通りし、通ったレーンのゲートだけを一度適用する', () => {
    const rows: GateRow[] = [
      { distance: 1, lanes: ['+1', null, '+3'] },
      { distance: 2, lanes: [null, '−6', '×2'] },
    ]
    expect(stepRun(initialRun(), 3, 0, rows)).toMatchObject({ count: 3, passed: 1, lastEvent: 'pass' })
    const first = stepRun(initialRun(), 3, -0.7, rows)
    expect(first).toMatchObject({ count: 4, passed: 1, lastEvent: 'grow' })
    expect(stepRun(first, 0.5, 0, rows).count).toBe(4)
    expect(stepRun(first, 3, 0, rows)).toMatchObject({ count: 1, passed: 2, lastEvent: 'shrink' })
    expect(stepRun(first, 3, 0.7, rows)).toMatchObject({ count: 8, passed: 2, lastEvent: 'grow' })
  })

  test('隕石は手前でレーンに収まり、地上で当たると2つ減り、残りは最低ひとつ', () => {
    expect(meteorX(meteorRow, -1)).toBeCloseTo(-2 / 3)
    expect(meteorX(meteorRow, 0.25)).toBeCloseTo(-1 / 3)
    expect(meteorX(meteorRow, 0.75)).toBe(0)
    expect(meteorX(meteorRow, 1)).toBe(0)
    expect(stepRun(initialRun(), 3, 0, [meteorRow])).toMatchObject({ count: 1, lastEvent: 'hit' })
    expect(stepRun({ ...initialRun(), count: 2 }, 3, 0, [meteorRow])).toMatchObject({ count: 1, lastEvent: 'hit' })
    expect(stepRun(initialRun(), 3, 0.7, [meteorRow])).toMatchObject({ count: 3, lastEvent: 'dodge' })
  })

  test('跳び越える瞬間の高さで隕石を避け、空中でも選んだゲートを取れる', () => {
    const rows = [meteorRow]
    const atTakeoff = stepRun(initialRun(), 2.2, 0, rows)
    const jumping = jumpRun(atTakeoff)
    expect(jumpRun(jumping)).toBe(jumping)
    const apex = stepRun(jumping, 0.55, 0, rows)
    expect(jumpHeight(apex)).toBeCloseTo(1)
    expect(apex).toMatchObject({ count: 3, lastEvent: 'dodge' })
    const touchdown = stepRun(jumping, 1.15, 0, rows)
    expect(jumpHeight(touchdown)).toBe(0)
    expect(jumpRun(touchdown)).toBe(touchdown)
    const landed = stepRun(jumping, 1.32, 0, rows)
    expect(landed.lastEvent).toBe('dodge')
    expect(jumpHeight(landed)).toBe(0)
    expect(jumpRun(landed).jumpTime).toBeGreaterThan(0)
    expect(stepRun(jumping, 1.32, -0.7, rows)).toMatchObject({ count: 7, lastEvent: 'grow' })
    expect(stepRun(jumpRun(initialRun()), 3, 0, rows).lastEvent).toBe('hit')
  })

  test('長いフレームでも各列を横切った瞬間の位置で数を決める', () => {
    const rows: GateRow[] = [
      { distance: 1, lanes: ['+1', null, '×2'] },
      { distance: 2, lanes: [null, '−1', '×2'] },
    ]
    const start = { ...initialRun(), distance: 0.98, playerX: -0.84 }
    const oneFrame = stepRun(start, 3, 1, rows)
    let manyFrames = start
    for (let i = 0; i < 60; i++) manyFrames = stepRun(manyFrames, 0.05, 1, rows)
    expect(oneFrame).toMatchObject({ count: 8, passed: 2, playerX: 0.84 })
    expect(manyFrames.distance).toBeCloseTo(oneFrame.distance)
    expect(manyFrames.count).toBe(oneFrame.count)
    expect(manyFrames.playerX).toBe(oneFrame.playerX)
  })

  test('指した横位置で止まり、外側は道の両端まで。ゴール後は結果が確定する', () => {
    const rows = createCourse(() => 0.5)
    const start = initialRun()
    expect(stepRun(start, 0, 1, rows)).toBe(start)
    expect(stepRun(start, 1, 0.2, rows).playerX).toBeCloseTo(0.2)
    expect(stepRun(start, 1, -3, rows).playerX).toBe(-0.84)
    expect(stepRun(start, 1, 5, rows).playerX).toBe(0.84)
    const lastRow = stepRun(start, 22.3, 0, rows)
    expect(lastRow).toMatchObject({ passed: rows.length, finished: false })
    const goal = stepRun(lastRow, 5, 0, rows)
    expect(goal).toMatchObject({ distance: rows.length + 1, finished: true, count: lastRow.count })
    expect(stepRun(goal, 1, -1, rows)).toBe(goal)
    expect(jumpRun(goal)).toBe(goal)
    expect(initialRun()).toEqual(start)
  })
})
