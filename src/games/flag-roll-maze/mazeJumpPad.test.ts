import { describe, expect, it } from 'vitest'
import { CELL_SIZE } from './mazeGrid'
import {
  BALL_RADIUS,
  GRAVITY_MAGNITUDE,
  JUMP_PAD_ALREADY_RISING,
  JUMP_PAD_FORWARD_SPEED,
  JUMP_PAD_MARGIN,
  JUMP_PAD_MAX_SIDE_SPEED,
  JUMP_PAD_TOP,
  JUMP_PAD_UP_SPEED,
  MAX_TILT_RAD,
} from './mazePhysics'
import { jumpPadLaunch } from './mazeJumpPad'
import { createMazeStageById } from './mazeStages'
import type { JumpPadGimmick } from './mazeGimmicks'

const pad: JumpPadGimmick = {
  id: 'test-pad',
  center: { x: 2, z: 3 },
  halfWidth: 1,
  halfDepth: 0.5,
  top: JUMP_PAD_TOP,
}

function launchPosition(z = pad.center.z) {
  return { x: pad.center.x, y: pad.top + BALL_RADIUS, z }
}

describe('jumpPadLaunch', () => {
  it('範囲内で低く、上昇中でなければ進行方向へ発射する', () => {
    expect(
      jumpPadLaunch(launchPosition(), { x: 2, y: 0, z: -4 }, pad),
    ).toEqual({ x: 0.6, y: JUMP_PAD_UP_SPEED, z: JUMP_PAD_FORWARD_SPEED })
  })

  it('範囲外・高すぎる位置・すでに上昇中では発射しない', () => {
    expect(
      jumpPadLaunch(
        {
          ...launchPosition(),
          x: pad.center.x + pad.halfWidth + BALL_RADIUS + JUMP_PAD_MARGIN + 0.001,
        },
        { x: 0, y: 0, z: 0 },
        pad,
      ),
    ).toBeNull()
    expect(
      jumpPadLaunch(
        {
          ...launchPosition(),
          z: pad.center.z + pad.halfDepth + BALL_RADIUS + JUMP_PAD_MARGIN + 0.001,
        },
        { x: 0, y: 0, z: 0 },
        pad,
      ),
    ).toBeNull()
    expect(
      jumpPadLaunch(
        { ...launchPosition(), y: pad.top + BALL_RADIUS * 2.2 + 0.001 },
        { x: 0, y: 0, z: 0 },
        pad,
      ),
    ).toBeNull()
    expect(
      jumpPadLaunch(
        launchPosition(),
        { x: 0, y: JUMP_PAD_ALREADY_RISING, z: 0 },
        pad,
      ),
    ).toBeNull()
  })

  it('横速度は3割だけ残し、必ず±1.2へ補正する', () => {
    expect(
      jumpPadLaunch(launchPosition(), { x: 10, y: 0, z: 0 }, pad)!.x,
    ).toBe(JUMP_PAD_MAX_SIDE_SPEED)
    expect(
      jumpPadLaunch(launchPosition(), { x: -10, y: 0, z: 0 }, pad)!.x,
    ).toBe(-JUMP_PAD_MAX_SIDE_SPEED)
  })

  it('パッド両端からでもハードルを越え、背面より先へ着地する', () => {
    const stage = createMazeStageById('athletic')
    const athleticPad = stage.gimmicks.jumpPads.find(
      ({ id }) => id === 'jump-pad-athletic',
    )
    const hurdle = stage.terrain.boxes.find(({ id }) => id === 'athletic-hurdle')
    const cap = stage.terrain.bars.find(({ id }) => id === 'athletic-hurdle-cap')
    expect(athleticPad).toBeDefined()
    expect(hurdle).toBeDefined()
    expect(cap).toBeDefined()
    if (athleticPad === undefined || hurdle === undefined || cap === undefined) return

    const hurdleEffectiveHeight = cap.y + cap.radius
    const startY = athleticPad.top + BALL_RADIUS
    const launch = jumpPadLaunch(
      { x: athleticPad.center.x, y: startY, z: athleticPad.center.z },
      { x: 0, y: 0, z: 0 },
      athleticPad,
    )!
    const landingSeconds =
      (launch.y + Math.sqrt(launch.y ** 2 + 2 * GRAVITY_MAGNITUDE * athleticPad.top)) /
      GRAVITY_MAGNITUDE

    for (const startZ of [
      athleticPad.center.z - athleticPad.halfDepth,
      athleticPad.center.z + athleticPad.halfDepth,
    ]) {
      const hurdleSeconds = (hurdle.z - startZ) / launch.z
      const centerY =
        startY +
        launch.y * hurdleSeconds -
        (GRAVITY_MAGNITUDE / 2) * hurdleSeconds ** 2
      const clearance = centerY - BALL_RADIUS - hurdleEffectiveHeight
      const landingZ = startZ + launch.z * landingSeconds

      expect(clearance).toBeGreaterThan(0.4)
      expect(landingZ).toBeGreaterThan(hurdle.z + hurdle.depth / 2)
    }
  })

  it('ハードルは実データで通路幅いっぱいをふさぎ、最大傾斜では跳ばずに越えられない', () => {
    const stage = createMazeStageById('athletic')
    const hurdle = stage.terrain.boxes.find(({ id }) => id === 'athletic-hurdle')
    expect(hurdle).toBeDefined()
    if (hurdle === undefined) return

    const row = stage.rows[17]!
    const corridorWidth = [...row].filter((cell) => cell !== '#').length * CELL_SIZE
    const hurdleTop = hurdle.y + hurdle.height / 2
    // 全奥行きを緩い坂として使えても必要な角度は18°を大きく超える。実際は垂直面なのでさらに越えにくい。
    const minimumClimbSlope = Math.atan2(hurdleTop, hurdle.depth)

    expect(hurdle.width).toBeCloseTo(corridorWidth, 8)
    expect(minimumClimbSlope).toBeGreaterThan(MAX_TILT_RAD)
  })
})
