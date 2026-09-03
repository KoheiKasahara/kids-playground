import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  ballOutOfPlay,
  clampBowlingMotion,
  createBowlingWorld,
  launchBall,
  parkBall,
  parkFallenBall,
  readBall,
  readBlockSamples,
  readSettleSamples,
  removeFallenBlocks,
  resetForNextThrow,
  type BowlingWorld,
} from './bowlingWorld'
import {
  LAUNCH_SPEED_MAX,
  LAUNCH_SPEED_MIN,
  LAUNCH_YAW_LIMIT_RAD,
  MAX_BALL_SPEED,
  PHYSICS_TIMESTEP,
} from './bowlingPhysics'
import { createToppleTracker, updateToppleTracker } from './bowlingTopple'
import { createSettleState, updateSettleState } from './bowlingSettle'
import { launchSpeed, type LaunchAim } from './bowlingLaunch'
import { getBowlingBall } from './bowlingBalls'

const STEP_MS = PHYSICS_TIMESTEP * 1000

function aim(power: number, yaw = 0): LaunchAim {
  return { active: true, power, yaw, pull: 0.9 * power }
}

type RunResult = {
  toppled: number
  settledAtMs: number | null
  minBallY: number
  /** 玉が積み木の並びを通り過ぎた時点でも残っていた速度。 */
  ballSpeedAfterImpact: number
  ballPassedTower: boolean
}

/**
 * 1投ぶんを実際にRapierで回す。
 *
 * 物理の細かい数値を固定するのではなく、
 * 「速いまま届くか」「崩れるか」「落ち着くか」という流れだけを確かめる。
 */
function runThrow(bowling: BowlingWorld, seconds: number, launchAim: LaunchAim | null): RunResult {
  const tracker = createToppleTracker(readBlockSamples(bowling))
  const settle = createSettleState()
  if (launchAim) launchBall(bowling, launchAim)
  let settledAtMs: number | null = null
  let minBallY = Number.POSITIVE_INFINITY
  let ballSpeedAfterImpact = 0
  let ballPassedTower = false
  const steps = Math.round(seconds / PHYSICS_TIMESTEP)
  for (let index = 0; index < steps; index += 1) {
    bowling.world.step()
    clampBowlingMotion(bowling)
    removeFallenBlocks(bowling)
    parkFallenBall(bowling)
    updateToppleTracker(tracker, readBlockSamples(bowling), STEP_MS)
    if (settledAtMs === null && updateSettleState(settle, readSettleSamples(bowling), STEP_MS)) {
      settledAtMs = settle.elapsedMs
    }
    const ball = readBall(bowling)
    minBallY = Math.min(minBallY, ball.position.y)
    if (!ballPassedTower && ball.position.z <= -7) {
      ballPassedTower = true
      ballSpeedAfterImpact = ball.speed
    }
  }
  return { toppled: tracker.count, settledAtMs, minBallY, ballSpeedAfterImpact, ballPassedTower }
}

describe('つみきボウリングの世界', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('レーン・積み木・玉が作られ、玉は発射位置で止まっている', () => {
    const bowling = createBowlingWorld(RAPIER)
    expect(bowling.blocks.length).toBe(bowling.stage.blocks.length)
    expect(bowling.launched).toBe(false)
    const ball = readBall(bowling)
    expect(ball.speed).toBe(0)
    expect(ball.position.z).toBeCloseTo(bowling.anchor.z, 5)
    bowling.world.free()
  })

  it('ねらっている間、玉は落ちずに発射位置へとどまる', () => {
    const bowling = createBowlingWorld(RAPIER)
    const startY = readBall(bowling).position.y
    runThrow(bowling, 2, null)
    expect(readBall(bowling).position.y).toBeCloseTo(startY, 3)
    bowling.world.free()
  })

  it('触っていない積み木は勝手に崩れない', () => {
    const bowling = createBowlingWorld(RAPIER)
    const result = runThrow(bowling, 3, null)
    expect(result.toppled).toBe(0)
    bowling.world.free()
  })

  it('ドラッグ中は玉が引いた向きの逆へ下がる', () => {
    const bowling = createBowlingWorld(RAPIER)
    parkBall(bowling, aim(1))
    const pulled = readBall(bowling).position
    expect(pulled.z).toBeGreaterThan(bowling.anchor.z)
    expect(pulled.y).toBeCloseTo(bowling.anchor.y, 6)
    parkBall(bowling, null)
    expect(readBall(bowling).position.z).toBeCloseTo(bowling.anchor.z, 6)
    bowling.world.free()
  })

  it('発射すると、指定どおりの速さで前へ飛び出す', () => {
    const bowling = createBowlingWorld(RAPIER)
    const velocity = launchBall(bowling, aim(1))!
    expect(velocity.z).toBeLessThan(0)
    expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeCloseTo(
      launchSpeed(1, getBowlingBall('heavy')),
      3,
    )
    expect(bowling.launched).toBe(true)
    // 同じ投球で二重に発射しない。
    expect(launchBall(bowling, aim(1))).toBeNull()
    bowling.world.free()
  })

  it('最大パワーの玉は、積み木へ届くまでに勢いを失わない', () => {
    const bowling = createBowlingWorld(RAPIER)
    launchBall(bowling, aim(1))
    // 積み木の手前（z ≒ -3.5）へ到達するまで進める。
    let speedAtTower = 0
    for (let index = 0; index < 240; index += 1) {
      bowling.world.step()
      clampBowlingMotion(bowling)
      const ball = readBall(bowling)
      if (ball.position.z <= -3) {
        speedAtTower = ball.speed
        break
      }
    }
    // 発射直後の勢いがそのまま積み木へ届いている（減衰・摩擦で失速していない）。
    expect(speedAtTower).toBeGreaterThan(LAUNCH_SPEED_MAX * 0.9)
    bowling.world.free()
  })

  it('最大パワーでも積み木をすり抜けず、必ずぶつかって崩す', () => {
    const bowling = createBowlingWorld(RAPIER)
    const result = runThrow(bowling, 5, aim(1))
    // すり抜けていたら、玉はほとんど減速せずに通り抜けてしまう。
    expect(result.ballPassedTower).toBe(true)
    expect(result.ballSpeedAfterImpact).toBeLessThan(LAUNCH_SPEED_MAX * 0.9)
    // 1発で塔の半分以上が崩れる。
    expect(result.toppled).toBeGreaterThanOrEqual(Math.ceil(bowling.blocks.length / 2))
    bowling.world.free()
  })

  it('弱い発射でも積み木まで届き、いくつかは倒れる', () => {
    const bowling = createBowlingWorld(RAPIER)
    const result = runThrow(bowling, 5, aim(0))
    expect(result.toppled).toBeGreaterThan(0)
    bowling.world.free()
  })

  it('どのパワーでも、1発で塔の半分より多くが崩れる', () => {
    // このゲームは点を competing する遊びではないので、
    // 「強いほど多く倒れる」ではなく「どう投げてもガラガラ崩れる」を守る。
    // パワーの差は倒した数ではなく、飛ぶ速さと崩れ方の派手さで感じさせる。
    for (const power of [0, 0.5, 1]) {
      const bowling = createBowlingWorld(RAPIER)
      const result = runThrow(bowling, 5, aim(power))
      expect(result.toppled, `power=${power} の崩れ方が寂しい`).toBeGreaterThan(
        bowling.blocks.length / 2,
      )
      bowling.world.free()
    }
  })

  it('左右へずらしても、端の積み木へ当たって何かは崩れる', () => {
    for (const yaw of [-LAUNCH_YAW_LIMIT_RAD, -0.09, 0.09, LAUNCH_YAW_LIMIT_RAD]) {
      const bowling = createBowlingWorld(RAPIER)
      const result = runThrow(bowling, 5, aim(1, yaw))
      // 端を狙っても「当たったのに何も起きない」投球にはしない。
      expect(result.toppled, `yaw=${yaw} の崩れ方が寂しい`).toBeGreaterThanOrEqual(5)
      bowling.world.free()
    }
  })

  it('1投は必ず落ち着き、次の投球へ移れる', () => {
    const bowling = createBowlingWorld(RAPIER)
    const result = runThrow(bowling, 8, aim(1))
    expect(result.settledAtMs).not.toBeNull()
    bowling.world.free()
  })

  it('速度と角速度は安全域を超えない（暴走しない）', () => {
    const bowling = createBowlingWorld(RAPIER)
    launchBall(bowling, aim(1))
    for (let index = 0; index < 900; index += 1) {
      bowling.world.step()
      clampBowlingMotion(bowling)
      const ball = readBall(bowling)
      expect(Number.isFinite(ball.speed)).toBe(true)
      expect(ball.speed).toBeLessThanOrEqual(MAX_BALL_SPEED * 1.001)
      for (const sample of readSettleSamples(bowling)) {
        expect(Number.isFinite(sample.linearSpeed)).toBe(true)
      }
    }
    bowling.world.free()
  })

  it('レーン外へ落ちた玉は止まり、落ち着き判定を邪魔しない', () => {
    const bowling = createBowlingWorld(RAPIER)
    launchBall(bowling, aim(1))
    bowling.ball.setTranslation({ x: 0, y: -20, z: 0 }, true)
    expect(ballOutOfPlay(bowling)).toBe(true)
    parkFallenBall(bowling)
    expect(readBall(bowling).speed).toBe(0)
    expect(readSettleSamples(bowling).length).toBe(bowling.blocks.length)
    bowling.world.free()
  })

  it('次の投球で積み木が完全に組み直され、前の投球の状態が残らない', () => {
    const bowling = createBowlingWorld(RAPIER)
    const before = readBlockSamples(bowling)
    runThrow(bowling, 5, aim(1))
    resetForNextThrow(bowling)
    const after = readBlockSamples(bowling)
    after.forEach((sample, index) => {
      const initial = before[index]!
      expect(sample.position.x).toBeCloseTo(initial.position.x, 5)
      expect(sample.position.y).toBeCloseTo(initial.position.y, 5)
      expect(sample.position.z).toBeCloseTo(initial.position.z, 5)
      expect(sample.rotation.w).toBeCloseTo(initial.rotation.w, 5)
    })
    for (const sample of readSettleSamples(bowling)) {
      expect(sample.linearSpeed).toBe(0)
      expect(sample.angularSpeed).toBe(0)
    }
    expect(bowling.launched).toBe(false)
    expect(bowling.blocks.every((block) => !block.removed)).toBe(true)
    bowling.world.free()
  })

  it('組み直した直後の積み木は、また勝手には崩れない', () => {
    const bowling = createBowlingWorld(RAPIER)
    runThrow(bowling, 5, aim(1))
    resetForNextThrow(bowling)
    const result = runThrow(bowling, 2, null)
    expect(result.toppled).toBe(0)
    bowling.world.free()
  })

  it('3投続けても、毎回同じ塔へ投げられる', () => {
    const bowling = createBowlingWorld(RAPIER)
    const counts: number[] = []
    for (let index = 0; index < 3; index += 1) {
      counts.push(runThrow(bowling, 5, aim(1)).toppled)
      resetForNextThrow(bowling)
    }
    for (const count of counts) {
      expect(count).toBeGreaterThanOrEqual(Math.ceil(bowling.blocks.length / 2))
    }
    bowling.world.free()
  })

  it('最小パワーの発射でも、遅すぎない速度で飛び出す', () => {
    const bowling = createBowlingWorld(RAPIER)
    const velocity = launchBall(bowling, aim(0))!
    expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeGreaterThanOrEqual(
      LAUNCH_SPEED_MIN - 1e-6,
    )
    bowling.world.free()
  })
})
