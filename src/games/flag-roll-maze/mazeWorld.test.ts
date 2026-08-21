import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  BALL_RADIUS,
  MAX_BALL_SPEED,
  PHYSICS_TIMESTEP,
  WALL_HEIGHT,
} from './mazePhysics'
import {
  createMazeStage,
  findMazePath,
  mazeStageBounds,
  MAZE_STAGE_ROWS,
  type MazePoint,
} from './mazeStage'
import {
  applyTiltToGravity,
  ballSpawnPosition,
  createMazeWorld,
  isGoalReached,
  limitBallSpeed,
  resetBall,
} from './mazeWorld'
import { hasFallenOut } from './mazeRescue'
import { smoothTilt, type TiltInput } from './tiltInput'

/** 実時間で40秒ぶん。人が遊ぶ想定より十分長く取って、失敗を「遅い」と区別する。 */
const MAX_STEPS = Math.round(40 / PHYSICS_TIMESTEP)

type SimulationResult = {
  goalStep: number | null
  maxSpeed: number
  leftBoard: boolean
  hitWall: boolean
}

/**
 * 経路のウェイポイントへ向かってスティックを倒し続ける自動プレイ。
 *
 * エンジンと同じ「入力を平滑化 → 重力へ反映 → 速度上限」の順で回し、
 * 実際に遊んだときと同じ物理条件でクリアできるかを確かめる。
 */
function autoPlay(waypoints: MazePoint[]): SimulationResult {
  const stage = createMazeStage()
  const bounds = mazeStageBounds(stage)
  const { world, ball } = createMazeWorld(RAPIER, stage)

  let tilt: TiltInput = { x: 0, y: 0 }
  let waypointIndex = 0
  let maxSpeed = 0
  let leftBoard = false
  let hitWall = false
  let goalStep: number | null = null

  try {
    for (let step = 1; step <= MAX_STEPS; step += 1) {
      const position = ball.translation()

      // 通過したウェイポイントは飛ばし、次の角を目標にする。
      while (
        waypointIndex < waypoints.length - 1 &&
        Math.hypot(
          position.x - waypoints[waypointIndex]!.x,
          position.z - waypoints[waypointIndex]!.z,
        ) < 0.5
      ) {
        waypointIndex += 1
      }
      const waypoint = waypoints[waypointIndex]!
      const dx = waypoint.x - position.x
      const dz = waypoint.z - position.z
      const length = Math.hypot(dx, dz)
      const target: TiltInput =
        length === 0 ? { x: 0, y: 0 } : { x: dx / length, y: dz / length }
      tilt = smoothTilt(tilt, target, PHYSICS_TIMESTEP)

      applyTiltToGravity(world, tilt)
      world.step()
      limitBallSpeed(ball)

      const velocity = ball.linvel()
      maxSpeed = Math.max(maxSpeed, Math.hypot(velocity.x, velocity.y, velocity.z))
      const next = ball.translation()
      if (hasFallenOut(next, bounds)) leftBoard = true
      // 壁の高さを超えたら乗り上げている。
      if (next.y > WALL_HEIGHT) hitWall = true

      if (isGoalReached(next, stage.goal)) {
        goalStep = step
        break
      }
    }
  } finally {
    world.free()
  }

  return { goalStep, maxSpeed, leftBoard, hitWall }
}

describe('createMazeWorld', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('動く剛体はボール1個だけで、床と壁は固定物になる', () => {
    const stage = createMazeStage()
    const { world } = createMazeWorld(RAPIER, stage)
    try {
      expect(world.bodies.len()).toBe(1)
      // 床1枚と、まとめた壁の枚数ぶんのコライダーが固定物として増える。
      expect(world.colliders.len()).toBe(stage.walls.length + 2)
    } finally {
      world.free()
    }
  })

  it('ボールはSTARTの真上に置かれ、床へめり込まない', () => {
    const stage = createMazeStage()
    const { world, ball } = createMazeWorld(RAPIER, stage)
    try {
      const spawn = ballSpawnPosition(stage.start)
      expect(ball.translation().x).toBeCloseTo(stage.start.x, 6)
      expect(ball.translation().z).toBeCloseTo(stage.start.z, 6)
      expect(spawn.y).toBeGreaterThanOrEqual(BALL_RADIUS)
    } finally {
      world.free()
    }
  })

  it('傾けていなければボールはその場に留まる', () => {
    const stage = createMazeStage()
    const { world, ball } = createMazeWorld(RAPIER, stage)
    try {
      applyTiltToGravity(world, { x: 0, y: 0 })
      for (let step = 0; step < 240; step += 1) world.step()
      const position = ball.translation()
      expect(Math.hypot(position.x - stage.start.x, position.z - stage.start.z))
        .toBeLessThan(0.1)
    } finally {
      world.free()
    }
  })

  it('傾けた向きへ転がり出す', () => {
    const stage = createMazeStage()
    const { world, ball } = createMazeWorld(RAPIER, stage)
    try {
      // STARTからは+X方向の通路が伸びている。
      applyTiltToGravity(world, { x: 1, y: 0 })
      for (let step = 0; step < 120; step += 1) world.step()
      const position = ball.translation()
      expect(position.x).toBeGreaterThan(stage.start.x + 0.2)
      expect(Math.abs(position.z - stage.start.z)).toBeLessThan(0.3)
    } finally {
      world.free()
    }
  })

  it('壁に当たっても盤面の外へ出ない', () => {
    const stage = createMazeStage()
    const bounds = mazeStageBounds(stage)
    const { world, ball } = createMazeWorld(RAPIER, stage)
    try {
      // 外周壁のある-X方向へ倒し続ける。
      applyTiltToGravity(world, { x: -1, y: 0 })
      for (let step = 0; step < 1200; step += 1) {
        world.step()
        limitBallSpeed(ball)
      }
      expect(hasFallenOut(ball.translation(), bounds)).toBe(false)
      expect(ball.translation().y).toBeLessThan(WALL_HEIGHT)
    } finally {
      world.free()
    }
  })

  it('速度上限を超えたら抑える', () => {
    const stage = createMazeStage()
    const { world, ball } = createMazeWorld(RAPIER, stage)
    try {
      ball.setLinvel({ x: 40, y: 0, z: 0 }, true)
      expect(limitBallSpeed(ball)).toBe(true)
      const velocity = ball.linvel()
      expect(Math.hypot(velocity.x, velocity.y, velocity.z))
        .toBeLessThanOrEqual(MAX_BALL_SPEED + 1e-4)
    } finally {
      world.free()
    }
  })

  it('resetBallでSTARTへ戻り、勢いも消える', () => {
    const stage = createMazeStage()
    const { world, ball } = createMazeWorld(RAPIER, stage)
    try {
      applyTiltToGravity(world, { x: 1, y: 0 })
      for (let step = 0; step < 240; step += 1) world.step()
      expect(ball.translation().x).toBeGreaterThan(stage.start.x + 0.2)

      resetBall(ball, stage.start)
      const position = ball.translation()
      const velocity = ball.linvel()
      expect(position.x).toBeCloseTo(stage.start.x, 6)
      expect(position.z).toBeCloseTo(stage.start.z, 6)
      expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeCloseTo(0, 6)
    } finally {
      world.free()
    }
  })
})

describe('スティック操作だけでゴールできる', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('経路をなぞる操作でゴールへ到達し、途中で盤外へ出ない', () => {
    const waypoints = findMazePath(MAZE_STAGE_ROWS)
    expect(waypoints).not.toBeNull()
    const result = autoPlay(waypoints!)

    expect(result.goalStep).not.toBeNull()
    expect(result.leftBoard).toBe(false)
    expect(result.hitWall).toBe(false)
  })

  it('ゴールまでの速さが幼児向けの範囲に収まる', () => {
    const result = autoPlay(findMazePath(MAZE_STAGE_ROWS)!)
    expect(result.maxSpeed).toBeLessThanOrEqual(MAX_BALL_SPEED + 1e-4)

    const seconds = result.goalStep! * PHYSICS_TIMESTEP
    // 一瞬で終わらず、かといって飽きるほど長くもない範囲。
    expect(seconds).toBeGreaterThan(5)
    expect(seconds).toBeLessThan(35)
  })
})

describe('isGoalReached', () => {
  it('ゴール中心の真上なら高さに関わらず判定する', () => {
    const stage = createMazeStage()
    expect(isGoalReached({ x: stage.goal.x, y: 3, z: stage.goal.z }, stage.goal)).toBe(true)
  })

  it('離れていれば判定しない', () => {
    const stage = createMazeStage()
    expect(isGoalReached({ x: stage.goal.x + 2, y: 0, z: stage.goal.z }, stage.goal))
      .toBe(false)
  })
})
