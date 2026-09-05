import { describe, expect, it } from 'vitest'
import {
  aimFromDrag,
  combinedRestitution,
  DRAG_DEAD_ZONE_PX,
  fullPowerDragPx,
  launchDirection,
  launchSpeed,
  launchVelocity,
  predictBouncePreview,
  predictTrajectory,
  pullOffset,
} from './bowlingLaunch'
import {
  DEFAULT_LAUNCH_HEIGHT_LEVEL,
  LANE_RESTITUTION,
  LAUNCH_HEIGHT_CONFIG,
  LAUNCH_HEIGHT_LEVELS,
  LAUNCH_PULL_MAX,
  LAUNCH_SPEED_MAX,
  LAUNCH_SPEED_MIN,
  LAUNCH_YAW_LIMIT_RAD,
} from './bowlingPhysics'
import { getBowlingBall } from './bowlingBalls'

const VIEWPORT = { width: 390, height: 844 }
const BALL = getBowlingBall('heavy')
/** 「ふつう」のpitchRad。既存テストはこれまでどおり標準の弾道を確かめる。 */
const NORMAL_PITCH_RAD = LAUNCH_HEIGHT_CONFIG.normal.pitchRad

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
    const direction = launchDirection(aim.yaw, NORMAL_PITCH_RAD)
    expect(direction.x).toBeCloseTo(0, 6)
    expect(direction.z).toBeLessThan(0)
  })

  it('右へ引くと左へ、左へ引くと右へ飛ぶ（引いた向きの逆）', () => {
    const pulledRight = aimFromDrag({ dx: 120, dy: 200 }, VIEWPORT)
    const pulledLeft = aimFromDrag({ dx: -120, dy: 200 }, VIEWPORT)
    expect(pulledRight.yaw).toBeLessThan(0)
    expect(pulledLeft.yaw).toBeGreaterThan(0)
    expect(launchDirection(pulledRight.yaw, NORMAL_PITCH_RAD).x).toBeLessThan(0)
    expect(launchDirection(pulledLeft.yaw, NORMAL_PITCH_RAD).x).toBeGreaterThan(0)
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
    expect(launchDirection(aim.yaw, NORMAL_PITCH_RAD).z).toBeLessThan(0)
  })

  it('「ふつう」の発射方向はごくわずかに上向きで、単位ベクトルのまま', () => {
    // 積み木までの距離(LAUNCH_Z)を伸ばしたため、Phase 1〜4のような下向きのままだと
    // 速度・重力・発射位置を変えなくても手前で失速してしまう（bowlingPhysics.ts参照）。
    // ここではわずかに上向きの標準的な放物線になる。
    const direction = launchDirection(0, NORMAL_PITCH_RAD)
    expect(direction.y).toBeCloseTo(Math.sin(NORMAL_PITCH_RAD), 6)
    expect(direction.y).toBeGreaterThan(0)
    expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1, 6)
  })

  it('ドラッグの上下量(dy)は、発射方向の仰角には一切関わらない（高さは別UIでだけ変える）', () => {
    // dyはパワー（引いた距離）と前後判定にしか使われず、
    // launchDirectionへ渡すpitchRadはbowlingPhysics.tsのLAUNCH_HEIGHT_CONFIGだけが決める。
    const shallow = aimFromDrag({ dx: 0, dy: 60 }, VIEWPORT)
    const deep = aimFromDrag({ dx: 0, dy: 500 }, VIEWPORT)
    expect(shallow.power).not.toBeCloseTo(deep.power, 2)
    for (const level of LAUNCH_HEIGHT_LEVELS) {
      const pitchRad = LAUNCH_HEIGHT_CONFIG[level].pitchRad
      expect(launchDirection(shallow.yaw, pitchRad).y).toBeCloseTo(
        launchDirection(deep.yaw, pitchRad).y,
        10,
      )
    }
  })

  it('NaNのドラッグでも壊れない', () => {
    const aim = aimFromDrag({ dx: Number.NaN, dy: Number.NaN }, VIEWPORT)
    expect(aim.active).toBe(false)
  })
})

describe('発射の高さ3段階（ひくい/ふつう/たかい）', () => {
  it('3段階あり、ふつうが既定になっている', () => {
    expect(LAUNCH_HEIGHT_LEVELS).toEqual(['low', 'normal', 'high'])
    expect(DEFAULT_LAUNCH_HEIGHT_LEVEL).toBe('normal')
  })

  it('ひくい＜ふつう＜たかいの順に仰角が上向きへはっきり変わる（弾道が明確に違う）', () => {
    const low = launchDirection(0, LAUNCH_HEIGHT_CONFIG.low.pitchRad)
    const normal = launchDirection(0, LAUNCH_HEIGHT_CONFIG.normal.pitchRad)
    const high = launchDirection(0, LAUNCH_HEIGHT_CONFIG.high.pitchRad)
    // ひくいははっきり下向き、たかいははっきり上向き。ふつうはその間。
    expect(low.y).toBeLessThan(0)
    expect(high.y).toBeGreaterThan(0)
    expect(low.y).toBeLessThan(normal.y)
    expect(normal.y).toBeLessThan(high.y)
    // 3段階とも単位ベクトルのまま（速度の大きさは高さで変えない）。
    for (const direction of [low, normal, high]) {
      expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1, 6)
    }
  })

  it('たかいの速度ベクトルは、ふつうよりはっきり上向きになる', () => {
    const aim = aimFromDrag({ dx: 0, dy: 200 }, VIEWPORT)
    const lowVelocity = launchVelocity(aim, BALL, 'low')
    const normalVelocity = launchVelocity(aim, BALL, 'normal')
    const highVelocity = launchVelocity(aim, BALL, 'high')
    expect(lowVelocity.y).toBeLessThan(0)
    expect(normalVelocity.y).toBeGreaterThan(0)
    expect(highVelocity.y).toBeGreaterThan(normalVelocity.y)
  })

  it('ひくい/ふつうは発射速度の大きさをそのまま使う（弾道の形だけが変わる）', () => {
    const aim = aimFromDrag({ dx: 0, dy: 200 }, VIEWPORT)
    for (const level of ['low', 'normal'] as const) {
      const velocity = launchVelocity(aim, BALL, level)
      expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeCloseTo(
        launchSpeed(aim.power, BALL) * LAUNCH_HEIGHT_CONFIG[level].speedScale,
        4,
      )
    }
  })

  it('たかいは、強く引いても積み木の頭上を通り過ぎないよう速度をやや抑えてある', () => {
    const aim = aimFromDrag({ dx: 0, dy: 400 }, VIEWPORT)
    const highVelocity = launchVelocity(aim, BALL, 'high')
    const normalVelocity = launchVelocity(aim, BALL, 'normal')
    expect(Math.hypot(highVelocity.x, highVelocity.y, highVelocity.z)).toBeLessThan(
      Math.hypot(normalVelocity.x, normalVelocity.y, normalVelocity.z),
    )
    expect(LAUNCH_HEIGHT_CONFIG.high.speedScale).toBeLessThan(1)
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
    const velocity = launchVelocity(aim, BALL, DEFAULT_LAUNCH_HEIGHT_LEVEL)
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

describe('反発係数の見積もり', () => {
  it('レーンの反発とだいたい平均した値になる', () => {
    expect(combinedRestitution(1)).toBeCloseTo((1 + LANE_RESTITUTION) / 2, 6)
    expect(combinedRestitution(0)).toBeCloseTo(LANE_RESTITUTION / 2, 6)
  })

  it('はずむだまはどっしりだまより、床でよく跳ね返る見積もりになる', () => {
    const heavy = getBowlingBall('heavy')
    const bouncy = getBowlingBall('bouncy')
    expect(combinedRestitution(bouncy.restitution)).toBeGreaterThan(
      combinedRestitution(heavy.restitution),
    )
  })
})

describe('軌道プレビューのバウンド予測', () => {
  const start = { x: 0, y: 4, z: 20 }
  const surfaceY = (z: number) => z * 0.055

  it('よく跳ねる球（反発係数が高い）では、最初の着地点のさらに先に2個目のバウンド地点が出る', () => {
    const preview = predictBouncePreview(
      start,
      { x: 0, y: -2, z: -18 },
      { gravityY: -16, surfaceY, clearance: 0.34, restitution: 0.6, maxTime: 1.5 },
    )
    expect(preview.firstBounce).not.toBeNull()
    expect(preview.secondBounce).not.toBeNull()
    // 2個目は1個目よりさらに奥（積み木側、-z方向）にある。
    expect(preview.secondBounce!.z).toBeLessThan(preview.firstBounce!.z)
  })

  it('ほとんど跳ねない球（反発係数が低い）では、2個目のバウンド地点を出さない', () => {
    const preview = predictBouncePreview(
      start,
      { x: 0, y: -2, z: -18 },
      { gravityY: -16, surfaceY, clearance: 0.46, restitution: 0.04, maxTime: 1.5 },
    )
    expect(preview.firstBounce).not.toBeNull()
    expect(preview.secondBounce).toBeNull()
  })

  it('空中で軌道が尽きて着地しなかった場合は、バウンド地点も出さない', () => {
    const preview = predictBouncePreview(
      start,
      { x: 0, y: 0.01, z: -1 },
      { gravityY: -16, surfaceY, clearance: 0.34, restitution: 0.6, maxTime: 0.05, samples: 3 },
    )
    expect(preview.firstBounce).toBeNull()
    expect(preview.secondBounce).toBeNull()
  })
})
