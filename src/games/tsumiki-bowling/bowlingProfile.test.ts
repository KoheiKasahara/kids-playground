import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import { getBowlingBall } from './bowlingBalls'
import { automaticLaunchVelocity, predictBouncePreview, type LaunchAim } from './bowlingLaunch'
import { PHYSICS_TIMESTEP, GRAVITY_Y } from './bowlingPhysics'
import {
  clampBowlingMotion,
  createBowlingWorld,
  launchAutomaticBall,
  parkFallenBall,
  readBall,
  removeFallenBlocks,
} from './bowlingWorld'
import { BOWLING_STAGES, getBowlingStage, laneSurfaceY, stageBounds } from './bowlingStage'

const CENTER_AIM: LaunchAim = { active: true, power: 1, yaw: 0, pull: 0 }

type ProfileRun = {
  velocity: { x: number; y: number; z: number }
  firstGroundZ: number | null
  maxHeightNearStage: number
  approachHeight: number | null
  movedBlocks: number
  movedBlockIndices: number[]
}

function runAutomaticProfile(ballId: 'heavy' | 'bouncy' | 'small', stageId = 'tower'): ProfileRun {
  const bowling = createBowlingWorld(RAPIER, { stageId, ballId })
  const velocity = launchAutomaticBall(bowling, CENTER_AIM)!
  const startPositions = bowling.blocks.map((block) => block.body.translation())
  const bounds = stageBounds(bowling.stage)
  let firstGroundZ: number | null = null
  let maxHeightNearStage = -Infinity
  let approachHeight: number | null = null
  for (let index = 0; index < Math.round(4 / PHYSICS_TIMESTEP); index += 1) {
    bowling.world.step()
    clampBowlingMotion(bowling)
    removeFallenBlocks(bowling)
    parkFallenBall(bowling)
    const ball = readBall(bowling)
    if (firstGroundZ === null && ball.position.y <= laneSurfaceY(ball.position.z) + bowling.ballSpec.radius + 0.03) {
      firstGroundZ = ball.position.z
    }
    if (approachHeight === null && ball.position.z <= bounds.frontZ + 0.6) approachHeight = ball.position.y - laneSurfaceY(ball.position.z)
    if (ball.position.z <= bounds.frontZ + 0.6 && ball.position.z >= bounds.backZ - 0.6) {
      maxHeightNearStage = Math.max(maxHeightNearStage, ball.position.y)
    }
  }
  const movedBlocks = bowling.blocks.filter((block, index) => {
    const start = startPositions[index]!
    const position = block.body.translation()
    return Math.hypot(position.x - start.x, position.y - start.y, position.z - start.z) > 0.08
  }).length
  const movedBlockIndices = bowling.blocks.flatMap((block, index) => {
    const start = startPositions[index]!
    const position = block.body.translation()
    return Math.hypot(position.x - start.x, position.y - start.y, position.z - start.z) > 0.08
      ? [index]
      : []
  })
  bowling.world.free()
  return { velocity, firstGroundZ, maxHeightNearStage, approachHeight, movedBlocks, movedBlockIndices }
}

beforeAll(async () => {
  await RAPIER.init()
})

describe('固定玉プロフィール', () => {

  it('玉ごとに弾道と速さが違い、同じ狙いでも役割が変わる', () => {
    const heavy = getBowlingBall('heavy')
    const bouncy = getBowlingBall('bouncy')
    const small = getBowlingBall('small')
    const heavyVelocity = automaticLaunchVelocity(CENTER_AIM, heavy)
    const bouncyVelocity = automaticLaunchVelocity(CENTER_AIM, bouncy)
    const smallVelocity = automaticLaunchVelocity(CENTER_AIM, small)

    expect(heavyVelocity.y).toBeLessThan(0)
    expect(smallVelocity.y).toBeLessThan(0)
    expect(bouncyVelocity.y).toBe(0)
    expect(Math.hypot(smallVelocity.x, smallVelocity.y, smallVelocity.z)).toBeGreaterThan(
      Math.hypot(heavyVelocity.x, heavyVelocity.y, heavyVelocity.z),
    )
  })

  it('Rapier実測でも、はずむ玉は手前で床へ着いてから高い軌道へ戻る', () => {
    const bouncy = runAutomaticProfile('bouncy')
    const bounds = stageBounds(getBowlingStage('tower'))
    expect(bouncy.firstGroundZ).not.toBeNull()
    expect(bouncy.firstGroundZ!).toBeGreaterThan(bounds.frontZ + 2)
    expect(bouncy.approachHeight!).toBeGreaterThan(1.2)
    const world = createBowlingWorld(RAPIER, { ballId: 'bouncy' })
    const preview = predictBouncePreview(world.anchor, automaticLaunchVelocity(CENTER_AIM, world.ballSpec), {
      gravityY: GRAVITY_Y, surfaceY: laneSurfaceY, clearance: world.ballSpec.radius,
      restitution: world.ballSpec.restitution, samples: 180, maxTime: 1.8,
    })
    const predicted = preview.bouncePoints.find((point) => point.z <= bounds.frontZ + 0.6)!
    expect(predicted).toBeDefined()
    expect(Math.abs(predicted.y - laneSurfaceY(predicted.z) - bouncy.approachHeight!)).toBeLessThan(0.5)
    world.world.free()
    expect(bouncy.movedBlocks).toBeGreaterThan(2)
    const heavy = runAutomaticProfile('heavy')
    expect(heavy.approachHeight!).toBeLessThan(0.7)
  })

  it('Rapier実測でも、重い玉は低く押し、小さい玉は速く通り抜ける', () => {
    const heavy = runAutomaticProfile('heavy')
    const small = runAutomaticProfile('small', 'gate')
    expect(heavy.velocity.y).toBeLessThan(0)
    expect(small.velocity.y).toBeLessThan(0)
    expect(Math.hypot(small.velocity.x, small.velocity.y, small.velocity.z)).toBeGreaterThan(
      Math.hypot(heavy.velocity.x, heavy.velocity.y, heavy.velocity.z),
    )
    expect(heavy.movedBlocks).toBeGreaterThan(getBowlingStage('tower').blocks.length / 2)
    expect(small.movedBlocks).toBeGreaterThan(0)
  })

  it('gateでは、重い玉は奥の門を倒し、小さい玉はすき間の宝箱へ届く', () => {
    const heavy = runAutomaticProfile('heavy', 'gate')
    const small = runAutomaticProfile('small', 'gate')
    // gateの0〜5が手前の門、6〜10が奥の門、11〜12が宝箱の連鎖。
    expect(heavy.movedBlockIndices.some((index) => index >= 6 && index <= 10)).toBe(true)
    expect(small.movedBlockIndices.filter((index) => index >= 11)).toHaveLength(2)
    expect(small.movedBlockIndices.some((index) => index < 11)).toBe(false)
  })
})

// 既存の7配置を固定弾道でも遊べることを、実物理の結果で確かめる。
it.each(BOWLING_STAGES.map((stage) => stage.id))('%sで3種類とも中央への一投に反応がある', (stageId) => {
  for (const ballId of ['heavy', 'bouncy', 'small'] as const) {
    expect(runAutomaticProfile(ballId, stageId).movedBlocks, ballId).toBeGreaterThan(0)
  }
})
