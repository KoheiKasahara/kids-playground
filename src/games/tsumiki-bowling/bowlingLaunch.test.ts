import { describe, expect, it } from 'vitest'
import {
  aimFromDrag,
  DRAG_DEAD_ZONE_PX,
  fullPowerDragPx,
  launchDirection,
  launchSpeed,
  launchVelocity,
  predictTrajectory,
  pullOffset,
} from './bowlingLaunch'
import {
  LAUNCH_PITCH_RAD,
  LAUNCH_PULL_MAX,
  LAUNCH_SPEED_MAX,
  LAUNCH_SPEED_MIN,
  LAUNCH_YAW_LIMIT_RAD,
} from './bowlingPhysics'
import { getBowlingBall } from './bowlingBalls'

const VIEWPORT = { width: 390, height: 844 }
const BALL = getBowlingBall('heavy')

describe('aimFromDrag: ドラッグ距離とパワー', () => {
  it('デッドゾーン以下のドラッグでは発射しない', () => {
    const aim = aimFromDrag({ dx: 0, dy: DRAG_DEAD_ZONE_PX - 1 }, VIEWPORT)
    expect(aim.active).toBe(false)
    expect(aim.power).toBe(0)
  })

  it('デッドゾーンを超えると発射できるようになる', () => {
    expect(aimFromDrag({ dx: 0, dy: DRAG_DEAD_ZONE_PX + 6 }, VIEWPORT).active).toBe(true)
  })

  it('引くほどパワーが上がり、最大で1になる', () => {
    const full = fullPowerDragPx(VIEWPORT)
    const weak = aimFromDrag({ dx: 0, dy: full * 0.25 }, VIEWPORT)
    const middle = aimFromDrag({ dx: 0, dy: full * 0.55 }, VIEWPORT)
    const strong = aimFromDrag({ dx: 0, dy: full }, VIEWPORT)
    expect(weak.power).toBeLessThan(middle.power)
    expect(middle.power).toBeLessThan(strong.power)
    expect(strong.power).toBeCloseTo(1, 5)
  })

  it('最大より長く引いてもパワーは1を超えない', () => {
    const aim = aimFromDrag({ dx: 0, dy: fullPowerDragPx(VIEWPORT) * 3 }, VIEWPORT)
    expect(aim.power).toBe(1)
  })

  it('パワー最大までのドラッグ距離は画面の短辺に比例し、上下限で頭打ちになる', () => {
    expect(fullPowerDragPx({ width: 390, height: 844 })).toBeCloseTo(390 * 0.45, 5)
    expect(fullPowerDragPx({ width: 120, height: 200 })).toBe(110)
    expect(fullPowerDragPx({ width: 1600, height: 1200 })).toBe(320)
  })

  it('引いた距離が同じなら、向きが違ってもパワーは同じ', () => {
    const down = aimFromDrag({ dx: 0, dy: 150 }, VIEWPORT)
    const diagonal = aimFromDrag({ dx: 150 * Math.SQRT1_2, dy: 150 * Math.SQRT1_2 }, VIEWPORT)
    expect(diagonal.power).toBeCloseTo(down.power, 5)
  })
})

describe('aimFromDrag: ドラッグ方向と発射方向', () => {
  it('まっすぐ手前へ引くと、まっすぐ前へ飛ぶ', () => {
    const aim = aimFromDrag({ dx: 0, dy: 200 }, VIEWPORT)
    expect(aim.yaw).toBeCloseTo(0, 6)
    const direction = launchDirection(aim.yaw)
    expect(direction.x).toBeCloseTo(0, 6)
    expect(direction.z).toBeLessThan(0)
  })

  it('右へ引くと左へ、左へ引くと右へ飛ぶ（引いた向きの逆）', () => {
    const pulledRight = aimFromDrag({ dx: 120, dy: 200 }, VIEWPORT)
    const pulledLeft = aimFromDrag({ dx: -120, dy: 200 }, VIEWPORT)
    expect(pulledRight.yaw).toBeLessThan(0)
    expect(pulledLeft.yaw).toBeGreaterThan(0)
    expect(launchDirection(pulledRight.yaw).x).toBeLessThan(0)
    expect(launchDirection(pulledLeft.yaw).x).toBeGreaterThan(0)
  })

  it('どれだけ斜めに引いても、左右の振れは上限を超えない', () => {
    for (const dx of [-2000, -400, 400, 2000]) {
      const aim = aimFromDrag({ dx, dy: 5 }, VIEWPORT)
      expect(Math.abs(aim.yaw)).toBeLessThanOrEqual(LAUNCH_YAW_LIMIT_RAD + 1e-9)
    }
  })

  it('奥へ押しても後ろ向きには飛ばない（必ず前方へ出る）', () => {
    const aim = aimFromDrag({ dx: 0, dy: -200 }, VIEWPORT)
    expect(aim.active).toBe(true)
    expect(launchDirection(aim.yaw).z).toBeLessThan(0)
  })

  it('発射方向はつねにやや下向きで、積み木へ斜め下から入る', () => {
    const direction = launchDirection(0)
    expect(direction.y).toBeCloseTo(-Math.sin(LAUNCH_PITCH_RAD), 6)
    expect(direction.y).toBeLessThan(0)
    expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1, 6)
  })

  it('NaNのドラッグでも壊れない', () => {
    const aim = aimFromDrag({ dx: Number.NaN, dy: Number.NaN }, VIEWPORT)
    expect(aim.active).toBe(false)
  })
})

describe('発射速度', () => {
  it('最小パワーでも十分速く、最大パワーで上限になる', () => {
    expect(launchSpeed(0, BALL)).toBeCloseTo(LAUNCH_SPEED_MIN, 5)
    expect(launchSpeed(1, BALL)).toBeCloseTo(LAUNCH_SPEED_MAX, 5)
    // 「弱い発射でもコロコロにしない」ための下限。
    expect(LAUNCH_SPEED_MIN).toBeGreaterThanOrEqual(12)
  })

  it('3種類とも同じパワーなら、ちいさいだまがいちばん速く飛ぶ', () => {
    const heavy = getBowlingBall('heavy')
    const bouncy = getBowlingBall('bouncy')
    const small = getBowlingBall('small')
    for (const power of [0, 0.5, 1]) {
      expect(launchSpeed(power, small)).toBeGreaterThan(launchSpeed(power, heavy))
      expect(launchSpeed(power, small)).toBeGreaterThan(launchSpeed(power, bouncy))
    }
  })

  it('どっしり・はずむだまも、最弱でも十分速い（全種類の勢いを落とさない）', () => {
    const heavy = getBowlingBall('heavy')
    const bouncy = getBowlingBall('bouncy')
    expect(launchSpeed(0, heavy)).toBeGreaterThanOrEqual(LAUNCH_SPEED_MIN)
    expect(launchSpeed(0, bouncy)).toBeGreaterThanOrEqual(LAUNCH_SPEED_MIN)
  })

  it('パワーに対して単調に増える', () => {
    const speeds = [0, 0.25, 0.5, 0.75, 1].map((power) => launchSpeed(power, BALL))
    for (let index = 1; index < speeds.length; index += 1) {
      expect(speeds[index]!).toBeGreaterThan(speeds[index - 1]!)
    }
  })

  it('速度ベクトルの大きさが発射速度と一致する', () => {
    const aim = aimFromDrag({ dx: 60, dy: 200 }, VIEWPORT)
    const velocity = launchVelocity(aim, BALL)
    expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeCloseTo(
      launchSpeed(aim.power, BALL),
      4,
    )
  })
})

describe('引き戻し', () => {
  it('パワーに比例し、上限を超えない', () => {
    const weak = aimFromDrag({ dx: 0, dy: 60 }, VIEWPORT)
    const strong = aimFromDrag({ dx: 0, dy: 400 }, VIEWPORT)
    expect(weak.pull).toBeLessThan(strong.pull)
    expect(strong.pull).toBeCloseTo(LAUNCH_PULL_MAX, 5)
  })

  it('発射方向の逆へ、高さを変えずに下がる', () => {
    const aim = aimFromDrag({ dx: 0, dy: 400 }, VIEWPORT)
    const offset = pullOffset(aim)
    expect(offset.y).toBe(0)
    expect(offset.z).toBeGreaterThan(0)
    expect(Math.hypot(offset.x, offset.z)).toBeCloseTo(LAUNCH_PULL_MAX, 5)
  })
})

describe('予測軌道', () => {
  const start = { x: 0, y: 3, z: 7 }
  const surfaceY = (z: number) => z * 0.055

  it('レーン面に届いたところで終わる', () => {
    const points = predictTrajectory(start, { x: 0, y: -3, z: -20 }, {
      gravityY: -16,
      surfaceY,
      clearance: 0.46,
    })
    expect(points.length).toBeGreaterThan(1)
    const last = points[points.length - 1]!
    expect(last.y).toBeLessThanOrEqual(surfaceY(last.z) + 0.46)
  })

  it('パワーが強いほど遠くまで伸びる', () => {
    const options = { gravityY: -16, surfaceY, clearance: 0.46 }
    const weak = predictTrajectory(start, { x: 0, y: -1.7, z: -15.9 }, options)
    const strong = predictTrajectory(start, { x: 0, y: -3.6, z: -32.8 }, options)
    const weakEnd = weak[weak.length - 1]!
    const strongEnd = strong[strong.length - 1]!
    expect(strongEnd.z).toBeLessThan(weakEnd.z)
  })

  it('左右に振ると軌道も左右へ寄る', () => {
    const options = { gravityY: -16, surfaceY, clearance: 0.46 }
    const right = predictTrajectory(start, { x: 6, y: -3.6, z: -32 }, options)
    const left = predictTrajectory(start, { x: -6, y: -3.6, z: -32 }, options)
    expect(right[right.length - 1]!.x).toBeGreaterThan(0)
    expect(left[left.length - 1]!.x).toBeLessThan(0)
  })
})
