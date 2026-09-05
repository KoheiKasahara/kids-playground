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
  setBowlingBall,
  type BowlingWorld,
} from './bowlingWorld'
import {
  LAUNCH_SPEED_MAX,
  LAUNCH_SPEED_MIN,
  LAUNCH_YAW_LIMIT_RAD,
  MAX_BALL_SPEED,
  PHYSICS_TIMESTEP,
  type LaunchHeightLevel,
} from './bowlingPhysics'
import { createToppleTracker, updateToppleTracker } from './bowlingTopple'
import { createSettleState, updateSettleState } from './bowlingSettle'
import { launchSpeed, type LaunchAim } from './bowlingLaunch'
import { BOWLING_STAGES, laneSurfaceY, TOWER_CENTER_Z } from './bowlingStage'
import { getBowlingBall } from './bowlingBalls'

const STEP_MS = PHYSICS_TIMESTEP * 1000

/** 塔の手前の目印。ここへ届いた時点の速度で「勢いのまま届いたか」を見る。 */
const TOWER_APPROACH_Z = TOWER_CENTER_Z + 2.6
/** 塔の奥の目印。ここまで玉が進んだら、塔を通り抜けたとみなす。 */
const TOWER_EXIT_Z = TOWER_CENTER_Z - 1.4

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
function runThrow(
  bowling: BowlingWorld,
  seconds: number,
  launchAim: LaunchAim | null,
  heightLevel?: LaunchHeightLevel,
): RunResult {
  const tracker = createToppleTracker(readBlockSamples(bowling))
  const settle = createSettleState()
  if (launchAim) launchBall(bowling, launchAim, heightLevel)
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
    if (!ballPassedTower && ball.position.z <= TOWER_EXIT_Z) {
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
    // 積み木の少し手前へ到達するまで進める。
    let speedAtTower = 0
    for (let index = 0; index < 240; index += 1) {
      bowling.world.step()
      clampBowlingMotion(bowling)
      const ball = readBall(bowling)
      if (ball.position.z <= TOWER_APPROACH_Z) {
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

describe('毎投の玉切替', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('ballIdを指定すると、その玉のBallSpecで世界が作られる', () => {
    for (const ballId of ['heavy', 'bouncy', 'small'] as const) {
      const bowling = createBowlingWorld(RAPIER, { ballId })
      expect(bowling.ballSpec.id).toBe(ballId)
      expect(bowling.ballSpec).toEqual(getBowlingBall(ballId))
      bowling.world.free()
    }
  })

  it('はずむだまは発射位置が他より高い', () => {
    const heavy = createBowlingWorld(RAPIER, { ballId: 'heavy' })
    const bouncy = createBowlingWorld(RAPIER, { ballId: 'bouncy' })
    expect(bouncy.anchor.y).toBeGreaterThan(heavy.anchor.y)
    heavy.world.free()
    bouncy.world.free()
  })

  it('投球待機中は玉を切り替えられ、新しい玉が発射位置へ置かれる', () => {
    const bowling = createBowlingWorld(RAPIER, { ballId: 'heavy' })
    const changed = setBowlingBall(bowling, RAPIER, 'small')
    expect(changed).toBe(true)
    expect(bowling.ballSpec.id).toBe('small')
    const ball = readBall(bowling)
    expect(ball.position.x).toBeCloseTo(bowling.anchor.x, 5)
    expect(ball.position.y).toBeCloseTo(bowling.anchor.y, 5)
    expect(ball.position.z).toBeCloseTo(bowling.anchor.z, 5)
    expect(ball.speed).toBe(0)
    expect(bowling.launched).toBe(false)
    bowling.world.free()
  })

  it('同じ玉を選び直しても何も起きない（no-op）', () => {
    const bowling = createBowlingWorld(RAPIER, { ballId: 'heavy' })
    const changed = setBowlingBall(bowling, RAPIER, 'heavy')
    expect(changed).toBe(false)
    expect(bowling.ballSpec.id).toBe('heavy')
    bowling.world.free()
  })

  it('飛行中は玉を切り替えられない（見た目と物理がずれるのを防ぐ）', () => {
    const bowling = createBowlingWorld(RAPIER, { ballId: 'heavy' })
    launchBall(bowling, aim(1))
    expect(bowling.launched).toBe(true)
    const changed = setBowlingBall(bowling, RAPIER, 'small')
    expect(changed).toBe(false)
    expect(bowling.ballSpec.id).toBe('heavy')
    bowling.world.free()
  })

  it('3投それぞれで違う玉を選んでも、投球数や倒れ判定はいつも通り機能する', () => {
    const bowling = createBowlingWorld(RAPIER, { ballId: 'heavy' })
    const order: Array<'heavy' | 'bouncy' | 'small'> = ['heavy', 'bouncy', 'small']
    const results: number[] = []
    for (const ballId of order) {
      if (bowling.ballSpec.id !== ballId) setBowlingBall(bowling, RAPIER, ballId)
      results.push(runThrow(bowling, 6, aim(1)).toppled)
      resetForNextThrow(bowling)
    }
    for (const toppled of results) {
      expect(toppled).toBeGreaterThan(0)
    }
    bowling.world.free()
  })

  it('リトライ（作り直し）後は、指定した玉から新しい物理状態で始まる', () => {
    const first = createBowlingWorld(RAPIER, { ballId: 'small' })
    runThrow(first, 5, aim(1))
    first.world.free()
    // 「もういちど」はworldを作り直す想定。前の投球の速度や崩れは一切引き継がない。
    const retried = createBowlingWorld(RAPIER, { ballId: 'small' })
    expect(retried.ballSpec.id).toBe('small')
    expect(retried.launched).toBe(false)
    const ball = readBall(retried)
    expect(ball.speed).toBe(0)
    for (const sample of readSettleSamples(retried)) {
      expect(sample.linearSpeed).toBe(0)
    }
    retried.world.free()
  })
})

describe('玉ごとの体感差（物理挙動）', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  /** 発射してから、玉の垂直速度が「落ちる→跳ね上がる」を何回繰り返したか数える。 */
  function countBounces(bowling: BowlingWorld, seconds: number, launchAim: LaunchAim): number {
    launchBall(bowling, launchAim)
    let bounces = 0
    let falling = false
    const steps = Math.round(seconds / PHYSICS_TIMESTEP)
    for (let index = 0; index < steps; index += 1) {
      bowling.world.step()
      clampBowlingMotion(bowling)
      removeFallenBlocks(bowling)
      parkFallenBall(bowling)
      const ball = readBall(bowling)
      if (ball.velocity.y < -0.5) {
        falling = true
      } else if (falling && ball.velocity.y > 1.5) {
        bounces += 1
        falling = false
      }
    }
    return bounces
  }

  it('はずむだまは、飛んでから何度も跳ねる（1回当たって終わりにならない）', () => {
    // 最大パワーは塔の上端をかすめて1回の大バウンドになりやすいため、
    // 「複数の積み木へ連鎖ヒットしやすい」を確かめやすい中程度のパワーで見る
    // （幼児の投球はパワーが揃わないため、最大パワーだけを基準にしない）。
    // 助走をTOWER_DEPTH_OFFSETぶん伸ばしたため、0.7だと積み木へ届く前に
    // 勢いを失う。基準を0.8へ上げても「中程度の力」の範囲内。
    const bowling = createBowlingWorld(RAPIER, { ballId: 'bouncy' })
    const bounces = countBounces(bowling, 7, aim(0.8))
    expect(bounces).toBeGreaterThanOrEqual(2)
    bowling.world.free()
  })

  it('どっしりだまは、はずむだまほど跳ねない（跳ね返りが弱い）', () => {
    const heavy = createBowlingWorld(RAPIER, { ballId: 'heavy' })
    const bouncy = createBowlingWorld(RAPIER, { ballId: 'bouncy' })
    const heavyBounces = countBounces(heavy, 7, aim(0.8))
    const bouncyBounces = countBounces(bouncy, 7, aim(0.8))
    expect(bouncyBounces).toBeGreaterThan(heavyBounces)
    heavy.world.free()
    bouncy.world.free()
  })

  /** 発射から積み木が落ち着くまでの間に、どれかの積み木が達した最大速度。 */
  function maxBlockSpeed(bowling: BowlingWorld, seconds: number, launchAim: LaunchAim): number {
    launchBall(bowling, launchAim)
    let peak = 0
    const steps = Math.round(seconds / PHYSICS_TIMESTEP)
    for (let index = 0; index < steps; index += 1) {
      bowling.world.step()
      clampBowlingMotion(bowling)
      removeFallenBlocks(bowling)
      parkFallenBall(bowling)
      for (const block of bowling.blocks) {
        if (block.removed) continue
        const linear = block.body.linvel()
        peak = Math.max(peak, Math.hypot(linear.x, linear.y, linear.z))
      }
    }
    return peak
  }

  it('どっしりだまは、同じパワーでもいちばん積み木を激しく吹き飛ばす（質量による破壊力）', () => {
    const heavy = createBowlingWorld(RAPIER, { ballId: 'heavy' })
    const bouncy = createBowlingWorld(RAPIER, { ballId: 'bouncy' })
    const small = createBowlingWorld(RAPIER, { ballId: 'small' })
    const heavyPeak = maxBlockSpeed(heavy, 3, aim(1))
    const bouncyPeak = maxBlockSpeed(bouncy, 3, aim(1))
    const smallPeak = maxBlockSpeed(small, 3, aim(1))
    expect(heavyPeak).toBeGreaterThan(bouncyPeak)
    expect(heavyPeak).toBeGreaterThan(smallPeak)
    heavy.world.free()
    bouncy.world.free()
    small.world.free()
  })

  it('ちいさいだまは高速でも積み木や床をすり抜けず、必ずぶつかる', () => {
    // ちいさいだまは隙間を抜けやすいのが仕様（副次的な特徴）なので、
    // 「当たった後に大きく減速するか」ではなく「衝突判定そのものが
    // 抜けていないか（必ずどこかへ当たって崩すか、速度が有限のままか）」を見る。
    const bowling = createBowlingWorld(RAPIER, { ballId: 'small' })
    const result = runThrow(bowling, 5, aim(1))
    expect(result.ballPassedTower).toBe(true)
    expect(result.toppled).toBeGreaterThan(0)
    expect(Number.isFinite(result.ballSpeedAfterImpact)).toBe(true)
    // すり抜けて加速するようなバグがないか（発射速度を超えて増速しない）。
    expect(result.ballSpeedAfterImpact).toBeLessThanOrEqual(
      launchSpeed(1, getBowlingBall('small')) * 1.05,
    )
    // 落下中も安全域を超えない（暴走・NaN化しない）。
    expect(result.minBallY).toBeGreaterThan(-100)
    bowling.world.free()
  })

  it('ちいさいだまの最大速度は安全域(MAX_BALL_SPEED)を超えない', () => {
    const bowling = createBowlingWorld(RAPIER, { ballId: 'small' })
    launchBall(bowling, aim(1))
    for (let index = 0; index < 30; index += 1) {
      bowling.world.step()
      clampBowlingMotion(bowling)
      const ball = readBall(bowling)
      expect(Number.isFinite(ball.speed)).toBe(true)
      expect(ball.speed).toBeLessThanOrEqual(MAX_BALL_SPEED * 1.001)
    }
    bowling.world.free()
  })
})

describe('ステージごとの世界（Phase 3）', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it.each(BOWLING_STAGES)('$name: 積み木の数がステージ定義と一致する', (stage) => {
    const bowling = createBowlingWorld(RAPIER, { stageId: stage.id })
    expect(bowling.stage.id).toBe(stage.id)
    expect(bowling.blocks.length).toBe(stage.blocks.length)
    bowling.world.free()
  })

  it.each(BOWLING_STAGES)(
    '$name: 触らずに2.5秒回しても崩れず、沈み込み・空中停止もしない',
    (stage) => {
      const bowling = createBowlingWorld(RAPIER, { stageId: stage.id })
      const initial = bowling.placements.map((placement) => placement.position)
      const result = runThrow(bowling, 2.5, null)
      expect(result.toppled, `${stage.id}: 触っていないのに倒れた`).toBe(0)
      bowling.blocks.forEach((block, index) => {
        const start = initial[index]!
        const now = block.body.translation()
        const horizontal = Math.hypot(now.x - start.x, now.z - start.z)
        expect(horizontal, `${stage.id}: ${index}番目の積み木が横へずれすぎている`).toBeLessThan(
          0.12,
        )
        expect(
          Math.abs(now.y - start.y),
          `${stage.id}: ${index}番目の積み木が縦へずれすぎている（沈み込み・空中停止）`,
        ).toBeLessThan(0.12)
      })
      bowling.world.free()
    },
  )

  it.each(BOWLING_STAGES)('$name: 最大パワーで投げると2個以上倒れる', (stage) => {
    const bowling = createBowlingWorld(RAPIER, { stageId: stage.id })
    const result = runThrow(bowling, 3.5, aim(1))
    expect(result.toppled).toBeGreaterThanOrEqual(2)
    bowling.world.free()
  })

  // 3種×7ステージをすべて回すと重いので、玉ごとの体感差は代表2ステージ
  // （tall・pyramid）でだけ確かめる。残りはheavyのみで可（設計書§6.3）。
  const BALL_VARIETY_STAGE_IDS = new Set(['tall', 'pyramid'])

  it.each(BOWLING_STAGES)('$name: 最大パワー投球後も世界が壊れない（NaNが出ない・落ち着く）', (stage) => {
    const ballIds = BALL_VARIETY_STAGE_IDS.has(stage.id)
      ? (['heavy', 'bouncy', 'small'] as const)
      : (['heavy'] as const)
    for (const ballId of ballIds) {
      const bowling = createBowlingWorld(RAPIER, { stageId: stage.id, ballId })
      // ちいさいだま(軽い・低減衰)はtallのように縦に高いステージで、崩れた破片が
      // 何度も跳ねて落ち着くまでに時間がかかることがあるため、ここだけ既存の
      // 「1投は必ず落ち着く」テスト(8秒)と同じ長さで確かめる。
      const result = runThrow(bowling, 9, aim(1))
      expect(Number.isFinite(result.minBallY), `${stage.id}/${ballId}: NaNが出た`).toBe(true)
      expect(result.settledAtMs, `${stage.id}/${ballId}: 落ち着かない`).not.toBeNull()
      bowling.world.free()
    }
  })

  it('pyramidでも、resetForNextThrow後に積み木が初期配置へ戻る', () => {
    const bowling = createBowlingWorld(RAPIER, { stageId: 'pyramid' })
    const before = readBlockSamples(bowling)
    runThrow(bowling, 4, aim(1))
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
    bowling.world.free()
  })
})

describe('発射の高さ3段階（ひくい/ふつう/たかい、Rapier実測）', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  /** 玉が最初にレーン面へ着くまでの経過時間[ms]。着かないまま終われば null。 */
  function firstGroundContactMs(
    bowling: BowlingWorld,
    seconds: number,
    launchAim: LaunchAim,
    heightLevel: LaunchHeightLevel,
  ): number | null {
    launchBall(bowling, launchAim, heightLevel)
    const steps = Math.round(seconds / PHYSICS_TIMESTEP)
    for (let index = 0; index < steps; index += 1) {
      bowling.world.step()
      clampBowlingMotion(bowling)
      const ball = readBall(bowling)
      if (ball.position.y <= laneSurfaceY(ball.position.z) + bowling.ballSpec.radius + 0.02) {
        return (index + 1) * STEP_MS
      }
    }
    return null
  }

  it('ひくいは、ふつうよりはっきり早く床へ着く（低弾道・早期接地）', () => {
    const low = createBowlingWorld(RAPIER, { ballId: 'heavy' })
    const normal = createBowlingWorld(RAPIER, { ballId: 'heavy' })
    const lowMs = firstGroundContactMs(low, 3, aim(1), 'low')
    const normalMs = firstGroundContactMs(normal, 3, aim(1), 'normal')
    expect(lowMs).not.toBeNull()
    expect(normalMs).not.toBeNull()
    expect(lowMs!).toBeLessThan(normalMs!)
    low.world.free()
    normal.world.free()
  })

  it('たかいは、ふつうよりはっきり滞空時間が長い（山なり弾道）', () => {
    const normal = createBowlingWorld(RAPIER, { ballId: 'heavy' })
    const high = createBowlingWorld(RAPIER, { ballId: 'heavy' })
    // 「たかい」は上向きの角度いっぱいに強く引くと積み木の頭上を通り過ぎるため
    // （bowlingPhysics.ts参照）、中くらいの力で比べる。
    const normalMs = firstGroundContactMs(normal, 3, aim(0.5), 'normal')
    const highMs = firstGroundContactMs(high, 3, aim(0.5), 'high')
    expect(normalMs).not.toBeNull()
    expect(highMs).not.toBeNull()
    expect(highMs!).toBeGreaterThan(normalMs!)
    normal.world.free()
    high.world.free()
  })

  it('3段階とも、適度な強さで投げれば積み木まで届いて崩れる', () => {
    const cases: Array<{ heightLevel: LaunchHeightLevel; power: number }> = [
      { heightLevel: 'low', power: 1 },
      { heightLevel: 'normal', power: 1 },
      { heightLevel: 'high', power: 0.5 },
    ]
    for (const { heightLevel, power } of cases) {
      const bowling = createBowlingWorld(RAPIER, { ballId: 'heavy' })
      const result = runThrow(bowling, 6, aim(power), heightLevel)
      expect(result.toppled, `height=${heightLevel} power=${power}`).toBeGreaterThan(0)
      bowling.world.free()
    }
  })

  it('高さを指定しなければ既定（ふつう）で発射される', () => {
    const withDefault = createBowlingWorld(RAPIER, { ballId: 'heavy' })
    const withNormal = createBowlingWorld(RAPIER, { ballId: 'heavy' })
    const velocityDefault = launchBall(withDefault, aim(1))!
    const velocityNormal = launchBall(withNormal, aim(1), 'normal')!
    expect(velocityDefault).toEqual(velocityNormal)
    withDefault.world.free()
    withNormal.world.free()
  })
})
