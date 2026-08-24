import { describe, expect, test } from 'vitest'
import {
  BALL_RADIUS,
  BALL_START,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GOAL_AREA,
  GOAL_RAMP,
  GOAL_RAMP_PEAK,
  GRID_BOTTOM,
} from './boardLayout'
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

  test('ゴールのふちは、ゴールの右となりの床の上にある', () => {
    // 左上端がゴールの右端、右下端が床に接する
    const halfLength = GOAL_RAMP.length / 2
    const halfThickness = GOAL_RAMP.thickness / 2
    const angle = (GOAL_RAMP.angleDeg * Math.PI) / 180
    const leftEndX = GOAL_RAMP.x - halfLength * Math.cos(angle)
    const bottom = GOAL_RAMP.y + halfLength * Math.sin(angle) + halfThickness * Math.cos(angle)
    expect(leftEndX).toBeCloseTo(GOAL_AREA.x + GOAL_AREA.width)
    expect(bottom).toBeCloseTo(BOARD_HEIGHT)
    // ゴール領域そのものは塞がない（ふちの本体はゴールの右となりにある）
    expect(GOAL_RAMP.x).toBeGreaterThan(GOAL_AREA.x + GOAL_AREA.width)
  })

  test('ゴールのふちはゴール側が高い（入りやすく、出にくい向き）', () => {
    // 角度が正＝時計回り＝左端が高い。ここが逆になると、
    // 中のボールが坂を上って出ていき、外からは入れない受け皿になってしまう。
    expect(GOAL_RAMP.angleDeg).toBeGreaterThan(0)
    expect(GOAL_RAMP_PEAK).toBeGreaterThan(0)
    // 段差はボールの半径より低く、勢いよく転がってきたボールなら乗り越えられる高さにする
    expect(GOAL_RAMP_PEAK).toBeLessThan(BALL_RADIUS)
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
