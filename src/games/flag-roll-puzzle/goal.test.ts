import { describe, expect, test } from 'vitest'
import { BALL_RADIUS, BALL_START, BOARD_HEIGHT, BOARD_WIDTH, GOAL_AREA, GRID_BOTTOM } from './boardLayout'
import { isInGoalArea } from './goal'

describe('goal', () => {
  test('ゴール領域の中にボールの中心があれば到達とみなす', () => {
    expect(isInGoalArea(GOAL_AREA.x + GOAL_AREA.width / 2, GOAL_AREA.y + GOAL_AREA.height / 2)).toBe(true)
  })

  test('床の上に転がってきたボールもゴールに入ったと判定する', () => {
    // 床(BOARD_HEIGHT)の上で止まったボールの中心
    expect(isInGoalArea(GOAL_AREA.x + 20, BOARD_HEIGHT - BALL_RADIUS)).toBe(true)
  })

  test('ゴールの外（右側の床・グリッドの中・開始位置）は到達にしない', () => {
    // ゴールの右隣の床
    expect(isInGoalArea(GOAL_AREA.x + GOAL_AREA.width + 20, BOARD_HEIGHT - BALL_RADIUS)).toBe(false)
    // ゴールの真上（まだグリッドの中）
    expect(isInGoalArea(GOAL_AREA.x + 20, GRID_BOTTOM - 1)).toBe(false)
    // 開始位置
    expect(isInGoalArea(BALL_START.x, BALL_START.y)).toBe(false)
  })

  test('ゴールは盤面の下部にあり、開始位置の真下から外れている', () => {
    // 開始位置からまっすぐ落ちるだけでは入らない配置であること。
    // ここが崩れると「ななめ板で向きを変える」遊びが成立しなくなる。
    expect(GOAL_AREA.x + GOAL_AREA.width).toBeLessThan(BALL_START.x - BALL_RADIUS)
    expect(BALL_START.x).toBeLessThanOrEqual(BOARD_WIDTH)
    expect(GOAL_AREA.y).toBe(GRID_BOTTOM)
    expect(GOAL_AREA.y + GOAL_AREA.height).toBe(BOARD_HEIGHT)
  })
})
