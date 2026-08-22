import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  BALL_RADIUS,
  BALL_SPAWN_CLEARANCE_IN_RADII,
  GOAL_CUP_DEPTH,
  GOAL_CUP_FLOOR_Y,
  GOAL_RADIUS,
  GOAL_REACHED_MAX_Y,
  HOLE_FALL_Y,
  MAX_BALL_SPEED,
  PHYSICS_TIMESTEP,
  WALL_HEIGHT,
} from './mazePhysics'
import {
  findMazePath,
  mazeStageBounds,
  CELL_SIZE,
  cellToWorld,
  type MazePoint,
} from './mazeStage'
import { createMazeStageById, MAZE_STAGE_ROWS, MAZE_STAGES } from './mazeStages'
import {
  applyBumperKicks,
  applyTiltToGravity,
  advanceSpinners,
  ballSpawnPosition,
  createMazeWorld,
  isGoalReached,
  limitBallSpeed,
  resetBall,
  settleBallInGoalCup,
  pushBallOutOfSpinner,
} from './mazeWorld'
import { hasFallenBelowFloor, hasFallenOut } from './mazeRescue'
import { smoothTilt, type TiltInput } from './tiltInput'

/** 実時間で70秒ぶん。ギミックからの復帰を挟んでも、失敗を「遅い」と区別できる長さにする。 */
const MAX_STEPS = Math.round(70 / PHYSICS_TIMESTEP)

/** 穴の落下判定は復帰モジュールの実装に依存させず、物理テスト内で正本のしきい値を使う。 */
function hasFallenBelowFloorForTest(position: { y: number }): boolean {
  return position.y < HOLE_FALL_Y
}

/** チェックポイントがまだ無い場合も、STARTへ安全に戻せるようにする。 */
function checkpointPositionForTest(
  index: number,
  checkpoints: readonly MazePoint[],
  fallback: MazePoint,
): MazePoint {
  return checkpoints[index] ?? fallback
}

/** 経路上のチェックポイント位置を特定し、落下後の再開ウェイポイントを決める。 */
function pathIndexNearPoint(waypoints: readonly MazePoint[], point: MazePoint): number {
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const [index, waypoint] of waypoints.entries()) {
    const distance = Math.hypot(waypoint.x - point.x, waypoint.z - point.z)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  }
  return nearestIndex
}

/** 上部スピナーへ南向きに進み、棒を実際に通過させるオートプレイ用の経路を作る。 */
function pathThroughTopSpinner(waypoints: readonly MazePoint[]): MazePoint[] {
  const stage = createMazeStageById('adventure')
  const spinner = stage.gimmicks.spinners.find(({ id }) => id === 'spinner-top')
  if (spinner === undefined) return [...waypoints]

  const spinnerNorthPoint = cellToWorld(7, 1, stage.columnCount, stage.rowCount)
  const spinnerMiddlePoint = cellToWorld(7, 2, stage.columnCount, stage.rowCount)
  // 棒の掃引範囲にあるセル中心を個別に目標にすると押し合いでスタックするため、南側の次点へ連続して進める。
  return waypoints.filter(
    (point) =>
      (point.x !== spinnerNorthPoint.x || point.z !== spinnerNorthPoint.z) &&
      (point.x !== spinnerMiddlePoint.x || point.z !== spinnerMiddlePoint.z),
  )
}

type SimulationResult = {
  goalStep: number | null
  maxSpeed: number
  leftBoard: boolean
  hitWall: boolean
  rescueCount: number
}

/**
 * 経路のウェイポイントへ向かってスティックを倒し続ける自動プレイ。
 *
 * エンジンと同じ「入力を平滑化 → 重力へ反映 → 速度上限」の順で回し、
 * 実際に遊んだときと同じ物理条件でクリアできるかを確かめる。
 */
function autoPlay(waypoints: MazePoint[]): SimulationResult {
  const stage = createMazeStageById('adventure')
  const bounds = mazeStageBounds(stage)
  const { world, ball, spinners } = createMazeWorld(RAPIER, stage)
  const bumperCooldowns = new Map<string, number>()
  const checkpointPathIndices = stage.checkpoints.map((checkpoint) =>
    pathIndexNearPoint(waypoints, checkpoint),
  )

  let tilt: TiltInput = { x: 0, y: 0 }
  let waypointIndex = 0
  let checkpointIndex = 0
  let maxSpeed = 0
  let leftBoard = false
  let hitWall = false
  let rescueCount = 0
  let goalStep: number | null = null

  try {
    for (let step = 1; step <= MAX_STEPS; step += 1) {
      const position = ball.translation()

      // 近づいたチェックポイントだけを前進記録し、後退したときも復帰先を巻き戻さない。
      while (
        checkpointIndex < stage.checkpoints.length - 1 &&
        Math.hypot(
          position.x - stage.checkpoints[checkpointIndex + 1]!.x,
          position.z - stage.checkpoints[checkpointIndex + 1]!.z,
        ) <= CELL_SIZE * 0.75
      ) {
        checkpointIndex += 1
      }

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
        length === 0 ? { x: 0, y: 0 } : { x: (dx / length) * 0.25, y: (dz / length) * 0.25 }

      tilt = smoothTilt(tilt, target, PHYSICS_TIMESTEP)

      applyTiltToGravity(world, tilt)
      advanceSpinners(spinners, step * PHYSICS_TIMESTEP)
      world.step()
      limitBallSpeed(ball)
      applyBumperKicks(
        ball,
        stage.gimmicks.bumpers,
        bumperCooldowns,
        step * PHYSICS_TIMESTEP * 1000,
      )
      limitBallSpeed(ball)

      const velocity = ball.linvel()
      maxSpeed = Math.max(maxSpeed, Math.hypot(velocity.x, velocity.y, velocity.z))
      const next = ball.translation()

      if (hasFallenBelowFloorForTest(next)) {
        const checkpoint = checkpointPositionForTest(
          checkpointIndex,
          stage.checkpoints,
          stage.start,
        )
        const spawn = ballSpawnPosition(checkpoint)
        ball.setTranslation(spawn, true)
        ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
        ball.setAngvel({ x: 0, y: 0, z: 0 }, true)
        tilt = { x: 0, y: 0 }
        waypointIndex = checkpointPathIndices[checkpointIndex] ?? 0
        rescueCount += 1
        continue
      }

      while (
        checkpointIndex < stage.checkpoints.length - 1 &&
        Math.hypot(
          next.x - stage.checkpoints[checkpointIndex + 1]!.x,
          next.z - stage.checkpoints[checkpointIndex + 1]!.z,
        ) <= CELL_SIZE * 0.75
      ) {
        checkpointIndex += 1
      }

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

  return { goalStep, maxSpeed, leftBoard, hitWall, rescueCount }
}

describe('createMazeWorld', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('床矩形とギミックを含めても剛体・コライダー数を抑える', () => {
    for (const definition of MAZE_STAGES) {
      const stage = createMazeStageById(definition.id)
      const { world } = createMazeWorld(RAPIER, stage)
      try {
        // バンパーは固定Colliderだけなので、動く剛体はボールと回転棒だけになる。
        expect(world.bodies.len()).toBe(1 + stage.gimmicks.spinners.length)
        expect(world.colliders.len()).toBe(
          stage.floors.length +
            stage.walls.length +
            stage.gimmicks.spinners.length +
            stage.gimmicks.bumpers.length +
            2,
        )
        console.log(
          '迷路ワールドのステージ別剛体数・コライダー数',
          stage.id,
          world.bodies.len(),
          world.colliders.len(),
        )
        expect(world.bodies.len()).toBeLessThanOrEqual(6)
        expect(world.colliders.len()).toBeLessThanOrEqual(80)
      } finally {
        world.free()
      }
    }
  })

  it('ボールはSTARTの真上に置かれ、床へめり込まない', () => {
    const stage = createMazeStageById('adventure')
    const { world, ball } = createMazeWorld(RAPIER, stage)
    try {
      const spawn = ballSpawnPosition(stage.start)
      expect(ball.translation().x).toBeCloseTo(stage.start.x, 6)
      expect(ball.translation().z).toBeCloseTo(stage.start.z, 6)
      expect(spawn.y).toBeGreaterThanOrEqual(BALL_RADIUS)
      expect(spawn.y).toBeCloseTo(
        BALL_RADIUS * (1 + BALL_SPAWN_CLEARANCE_IN_RADII),
        6,
      )
    } finally {
      world.free()
    }
  })

  it('大きくしたボールに対して壁と浅いゴールカップの余白を保つ', () => {
    // 壁の高さに余裕を持たせ、球の乗り越えとゴール判定の取りこぼしを防ぐ。
    expect(WALL_HEIGHT - BALL_RADIUS * 2).toBeGreaterThanOrEqual(0.1)
    expect(GOAL_RADIUS).toBeGreaterThanOrEqual(BALL_RADIUS)
    expect(GOAL_CUP_DEPTH).toBeLessThan(BALL_RADIUS * 0.5)
    expect(GOAL_CUP_FLOOR_Y).toBeLessThan(0)
  })

  it('ゴールへ入ったボールは浅いカップ底で止まり、国旗が見える高さに残る', () => {
    const stage = createMazeStageById('adventure')
    const { world, ball } = createMazeWorld(RAPIER, stage)
    try {
      ball.setTranslation(
        { x: stage.goal.x, y: BALL_RADIUS * 1.8, z: stage.goal.z },
        true,
      )
      ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
      applyTiltToGravity(world, { x: 0, y: 0 })
      for (let step = 0; step < 240; step += 1) world.step()

      const settled = ball.translation()
      expect(settled.y).toBeCloseTo(BALL_RADIUS + GOAL_CUP_FLOOR_Y, 2)
      expect(settled.y).toBeGreaterThan(BALL_RADIUS * 0.5)
      expect(isGoalReached(settled, stage.goal)).toBe(true)

      for (let step = 0; step < 120; step += 1) world.step()
      const still = ball.translation()
      expect(Math.abs(still.y - settled.y)).toBeLessThan(0.02)
      expect(Math.hypot(still.x - stage.goal.x, still.z - stage.goal.z)).toBeLessThan(0.02)
    } finally {
      world.free()
    }
  })

  it('傾けていなければボールはその場に留まる', () => {
    const stage = createMazeStageById('adventure')
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
    const stage = createMazeStageById('adventure')
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
    const stage = createMazeStageById('adventure')
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
    const stage = createMazeStageById('adventure')
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
    const stage = createMazeStageById('adventure')
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

  it('縦通路の列7を下向きの重力だけで転がっても穴に落ちない', () => {
    const stage = createMazeStageById('adventure')
    const { world, ball } = createMazeWorld(RAPIER, stage)
    try {
      const laneTopPoint = cellToWorld(
        7,
        3,
        stage.columnCount,
        stage.rowCount,
      )
      const lowerRoomEntry = cellToWorld(
        7,
        7,
        stage.columnCount,
        stage.rowCount,
      )
      ball.setTranslation(
        { x: laneTopPoint.x, y: BALL_RADIUS + 0.02, z: laneTopPoint.z },
        true,
      )
      ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
      world.gravity = { x: 0, y: 0, z: 12 }

      let reachedLowerRoom = false
      for (let step = 0; step < 600; step += 1) {
        world.step()
        limitBallSpeed(ball)
        const position = ball.translation()
        expect(hasFallenBelowFloor(position)).toBe(false)
        if (position.z >= lowerRoomEntry.z) {
          reachedLowerRoom = true
          break
        }
      }

      expect(reachedLowerRoom).toBe(true)
    } finally {
      world.free()
    }
  })

  it('回転棒を進めると静止ボールが押され、速度上限も守る', () => {
    const stage = createMazeStageById('adventure')
    const { world, ball, spinners } = createMazeWorld(RAPIER, stage)
    try {
      const spinner = spinners[0]!
      const initialRotation = spinner.body.rotation()
      // 棒の掃引範囲へ置き、重力の影響を切って回転による押し出しだけを測る。
      ball.setTranslation(
        {
          x: spinner.gimmick.center.x,
          y: BALL_RADIUS + 0.02,
          z: spinner.gimmick.center.z + 0.35,
        },
        true,
      )
      ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
      world.gravity = { x: 0, y: 0, z: 0 }

      let maxHorizontalSpeed = 0
      let maxSpeed = 0
      for (let step = 1; step <= 240; step += 1) {
        // setNextKinematicRotationの速度推定を有効にするため、必ずstepの直前に呼ぶ。
        advanceSpinners(spinners, step * PHYSICS_TIMESTEP)
        world.step()
        limitBallSpeed(ball)
        const velocity = ball.linvel()
        maxHorizontalSpeed = Math.max(
          maxHorizontalSpeed,
          Math.hypot(velocity.x, velocity.z),
        )
        maxSpeed = Math.max(maxSpeed, Math.hypot(velocity.x, velocity.y, velocity.z))
      }

      const finalRotation = spinner.body.rotation()
      const rotationDelta = Math.hypot(
        finalRotation.x - initialRotation.x,
        finalRotation.y - initialRotation.y,
        finalRotation.z - initialRotation.z,
        finalRotation.w - initialRotation.w,
      )
      expect(rotationDelta).toBeGreaterThan(0.01)
      expect(maxHorizontalSpeed).toBeGreaterThan(0.05)
      expect(maxSpeed).toBeLessThanOrEqual(MAX_BALL_SPEED + 1e-4)
    } finally {
      world.free()
    }
  })

  it('回転棒の中心から外向きの水平速度を与える', () => {
    const stage = createMazeStageById('adventure')
    const { world, ball } = createMazeWorld(RAPIER, stage)
    try {
      const spinner = stage.gimmicks.spinners[0]!
      const offset = 0.35
      ball.setTranslation(
        {
          x: spinner.center.x + offset,
          y: BALL_RADIUS + 0.02,
          z: spinner.center.z,
        },
        true,
      )
      ball.setLinvel({ x: 0, y: 0, z: 0 }, true)

      pushBallOutOfSpinner(ball, spinner)

      const velocity = ball.linvel()
      expect(velocity.x).toBeGreaterThan(0)
      expect(velocity.y).toBeCloseTo(0, 6)
      // spinner-topはセル座標が小数なので、Rapierの微小な丸め誤差を許容する。
      expect(velocity.z).toBeCloseTo(0, 5)
    } finally {
      world.free()
    }
  })

  it('バンパーへ転がしたボールを外向きへ弾き、速度上限も守る', () => {
    const stage = createMazeStageById('adventure')
    const { world, ball } = createMazeWorld(RAPIER, stage)
    try {
      const bumper = stage.gimmicks.bumpers[0]!
      const distance = bumper.radius + BALL_RADIUS - 0.03
      ball.setTranslation(
        {
          x: bumper.center.x - distance,
          y: BALL_RADIUS + 0.02,
          z: bumper.center.z,
        },
        true,
      )
      ball.setLinvel({ x: 1.2, y: 0, z: 0 }, true)
      world.gravity = { x: 0, y: 0, z: 0 }
      world.step()

      const kicked = applyBumperKicks(ball, stage.gimmicks.bumpers, new Map(), 0)
      limitBallSpeed(ball)
      const position = ball.translation()
      const velocity = ball.linvel()
      const outwardDot =
        velocity.x * (position.x - bumper.center.x) +
        velocity.z * (position.z - bumper.center.z)
      const speed = Math.hypot(velocity.x, velocity.y, velocity.z)

      expect(kicked).toEqual([bumper.id])
      expect(outwardDot).toBeGreaterThan(0)
      expect(speed).toBeLessThanOrEqual(MAX_BALL_SPEED + 1e-4)
    } finally {
      world.free()
    }
  })

  it('穴の下まで落ちたボールをチェックポイントへ戻し、直後の再落下を防ぐ', () => {
    const stage = createMazeStageById('adventure')
    const { world, ball } = createMazeWorld(RAPIER, stage)
    try {
      const hole = stage.holes[0]!
      ball.setTranslation(
        { x: hole.center.x, y: BALL_RADIUS, z: hole.center.z },
        true,
      )
      ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
      world.gravity = { x: 0, y: -12, z: 0 }

      let fallStep: number | null = null
      for (let step = 1; step <= 240; step += 1) {
        world.step()
        if (hasFallenBelowFloorForTest(ball.translation())) {
          fallStep = step
          break
        }
      }
      expect(fallStep).not.toBeNull()

      const checkpoint = checkpointPositionForTest(1, stage.checkpoints, stage.start)
      const spawn = ballSpawnPosition(checkpoint)
      ball.setTranslation(spawn, true)
      ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
      ball.setAngvel({ x: 0, y: 0, z: 0 }, true)

      const position = ball.translation()
      const velocity = ball.linvel()
      expect(position.x).toBeCloseTo(checkpoint.x, 6)
      expect(position.z).toBeCloseTo(checkpoint.z, 6)
      expect(position.y).toBeCloseTo(spawn.y, 6)
      expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeCloseTo(0, 6)
      // 復帰先は穴から離れたチェックポイントなので、グレース期間なしでも即時再判定しない。
      expect(hasFallenBelowFloorForTest(position)).toBe(false)
    } finally {
      world.free()
    }
  })

  it('回転棒の掃引範囲で長時間動かしてもボールを盤外へ出さない', () => {
    const stage = createMazeStageById('adventure')
    const bounds = mazeStageBounds(stage)
    const { world, ball, spinners } = createMazeWorld(RAPIER, stage)
    try {
      const spinner = spinners[0]!
      ball.setTranslation(
        {
          x: spinner.gimmick.center.x,
          y: BALL_RADIUS + 0.02,
          z: spinner.gimmick.center.z + 0.35,
        },
        true,
      )
      ball.setLinvel({ x: 0, y: 0, z: 0 }, true)

      for (let step = 1; step <= 1200; step += 1) {
        advanceSpinners(spinners, step * PHYSICS_TIMESTEP)
        world.step()
        limitBallSpeed(ball)
      }

      expect(hasFallenOut(ball.translation(), bounds)).toBe(false)
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
    const result = autoPlay(pathThroughTopSpinner(waypoints!))

    expect(result.goalStep).not.toBeNull()
    console.log('オートプレイのゴール到達秒数', result.goalStep! * PHYSICS_TIMESTEP)
    expect(result.leftBoard).toBe(false)
    expect(result.hitWall).toBe(false)
  })

  it('ゴールまでの速さが幼児向けの範囲に収まる', () => {
    const result = autoPlay(pathThroughTopSpinner(findMazePath(MAZE_STAGE_ROWS)!))
    expect(result.maxSpeed).toBeLessThanOrEqual(MAX_BALL_SPEED + 1e-4)

    const seconds = result.goalStep! * PHYSICS_TIMESTEP
    // 一瞬で終わらず、復帰を挟んでもテスト上限には収まる範囲。
    expect(seconds).toBeGreaterThan(5)
    expect(seconds).toBeLessThan(70)
  })
})

describe('isGoalReached', () => {
  it('カップ底まで入ったゴール中心のボールを判定する', () => {
    const stage = createMazeStageById('adventure')
    expect(isGoalReached({ x: stage.goal.x, y: GOAL_REACHED_MAX_Y, z: stage.goal.z }, stage.goal)).toBe(true)
  })

  it('カップの縁を横切っただけでは判定しない', () => {
    const stage = createMazeStageById('adventure')
    expect(isGoalReached({ x: stage.goal.x, y: BALL_RADIUS, z: stage.goal.z }, stage.goal)).toBe(false)
  })

  it('離れていれば判定しない', () => {
    const stage = createMazeStageById('adventure')
    expect(isGoalReached({ x: stage.goal.x + 2, y: 0, z: stage.goal.z }, stage.goal))
      .toBe(false)
  })
})

describe('settleBallInGoalCup', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('上向きへ跳ねさせず、水平の勢いを止める', () => {
    const stage = createMazeStageById('adventure')
    const { world, ball } = createMazeWorld(RAPIER, stage)
    try {
      ball.setLinvel({ x: 2.4, y: -0.5, z: -1.8 }, true)
      settleBallInGoalCup(ball)

      const velocity = ball.linvel()
      expect(velocity.y).toBeLessThanOrEqual(0)
      expect(Math.hypot(velocity.x, velocity.z)).toBe(0)
    } finally {
      world.free()
    }
  })
})
