import { describe, expect, test } from 'vitest'
import * as Matter from 'matter-js'
import {
  BALL_RADIUS,
  BALL_START,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GOAL_AREA,
  GOAL_EXIT_WALL,
  GOAL_EXIT_WALL_THICKNESS,
  GOAL_EXIT_WALL_X,
  GRID_BOTTOM,
  goalBoundaryWallsForArea,
  goalExitWallForArea,
} from './boardLayout'
import { isInGoalArea } from './goal'
import { createGoalExitWallBody } from './usePuzzleEngine'
import { BALL_RESTITUTION, STEP_MS } from './puzzlePhysics'

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
    expect(GOAL_EXIT_WALL_X).toBe(GOAL_AREA.x + GOAL_AREA.width)
    expect(GOAL_EXIT_WALL_X).toBeLessThan(BOARD_WIDTH)
  })

  test('ゴール出口の見えない壁は境界線の外側だけにあり、ゴール帯の高さだけを塞ぐ', () => {
    // プレイエリア側（壁の左面）は、見た目のゴール右端線と完全に一致する。
    expect(GOAL_EXIT_WALL.x - GOAL_EXIT_WALL.width / 2).toBe(GOAL_EXIT_WALL_X)
    // 3px の表示境界線とほぼ同じ太さにして、太い透明壁にならないようにする。
    expect(GOAL_EXIT_WALL_THICKNESS).toBe(4)
    expect(GOAL_EXIT_WALL.width).toBe(GOAL_EXIT_WALL_THICKNESS)
    // ゴール上端より上には伸ばさず、入口は開放する。
    expect(GOAL_EXIT_WALL.y - GOAL_EXIT_WALL.height / 2).toBe(GOAL_AREA.y)
    expect(GOAL_EXIT_WALL.y + GOAL_EXIT_WALL.height / 2).toBe(GOAL_AREA.y + GOAL_AREA.height)
  })

  test('ステージ固有ゴールの範囲で判定と出口壁を組み立てられる', () => {
    const stageGoal = { x: BOARD_WIDTH - 120, y: GRID_BOTTOM, width: 120, height: GOAL_AREA.height }
    expect(isInGoalArea(BOARD_WIDTH - 60, GRID_BOTTOM + 20, stageGoal)).toBe(true)
    expect(isInGoalArea(200, GRID_BOTTOM + 20, stageGoal)).toBe(false)
    expect(goalExitWallForArea(stageGoal)).toBeNull()
    const centerGoal = { x: 90, y: GRID_BOTTOM, width: 180, height: GOAL_AREA.height }
    expect(goalExitWallForArea(centerGoal)?.x).toBe(272)
  })

  test('ゴールの左右境界のうち外周と共有しない側へだけ4px壁を置く', () => {
    const easy = { x: 0, y: GRID_BOTTOM, width: 180, height: GOAL_AREA.height }
    const normal = { x: BOARD_WIDTH - 120, y: GRID_BOTTOM, width: 120, height: GOAL_AREA.height }
    const hard = { x: 90, y: GRID_BOTTOM, width: 180, height: GOAL_AREA.height }
    expect(goalBoundaryWallsForArea(easy).map((wall) => wall.x)).toEqual([182])
    expect(goalBoundaryWallsForArea(normal).map((wall) => wall.x)).toEqual([BOARD_WIDTH - 120 - GOAL_EXIT_WALL_THICKNESS / 2])
    expect(goalBoundaryWallsForArea(hard).map((wall) => wall.x)).toEqual([88, 272])
    expect(goalBoundaryWallsForArea(hard).every((wall) => wall.y - wall.height / 2 === GRID_BOTTOM)).toBe(true)
  })

  test('normalの左壁とhardの左右壁は、ゴール内部のボールを押し出さない', () => {
    const cases = [
      { goal: { x: 240, y: GRID_BOTTOM, width: 120, height: GOAL_AREA.height }, side: 'left' as const },
      { goal: { x: 90, y: GRID_BOTTOM, width: 180, height: GOAL_AREA.height }, side: 'left' as const },
      { goal: { x: 90, y: GRID_BOTTOM, width: 180, height: GOAL_AREA.height }, side: 'right' as const },
    ]

    for (const { goal, side } of cases) {
      const wall = goalBoundaryWallsForArea(goal).find((candidate) =>
        side === 'left' ? candidate.x < goal.x : candidate.x > goal.x + goal.width / 2,
      )!
      const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } })
      const centerY = goal.y + goal.height / 2
      const centerX = side === 'left'
        ? goal.x + BALL_RADIUS + 1
        : goal.x + goal.width - BALL_RADIUS - 1
      const ball = Matter.Bodies.circle(centerX, centerY, BALL_RADIUS, { restitution: BALL_RESTITUTION })
      Matter.Composite.add(engine.world, [
        Matter.Bodies.rectangle(wall.x, wall.y, wall.width, wall.height, { isStatic: true }),
        ball,
      ])
      Matter.Body.setVelocity(ball, { x: side === 'left' ? -16 : 16, y: 0 })
      for (let index = 0; index < 12; index += 1) Matter.Engine.update(engine, STEP_MS)

      if (side === 'left') expect(ball.position.x).toBeGreaterThanOrEqual(goal.x + BALL_RADIUS - 1)
      else expect(ball.position.x).toBeLessThanOrEqual(goal.x + goal.width - BALL_RADIUS + 1)
    }
  })

  test('薄い出口壁でもゴール内から右へ戻るボールをすり抜けさせない', () => {
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } })
    const ball = Matter.Bodies.circle(
      GOAL_EXIT_WALL_X - BALL_RADIUS - 1,
      GOAL_AREA.y + GOAL_AREA.height / 2,
      BALL_RADIUS,
      { restitution: BALL_RESTITUTION },
    )
    Matter.Composite.add(engine.world, [createGoalExitWallBody(), ball])
    Matter.Body.setVelocity(ball, { x: 16, y: 0 })

    for (let index = 0; index < 12; index += 1) Matter.Engine.update(engine, STEP_MS)

    // 円の右端がゴールの見た目上の境界を越えない位置で跳ね返る。
    expect(ball.position.x).toBeLessThanOrEqual(GOAL_EXIT_WALL_X - BALL_RADIUS + 1)
  })
})
