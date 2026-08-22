import { describe, expect, it } from 'vitest'
import {
  BALL_SCREEN_DIAMETER_RATIO,
  clampMazeZoomIndex,
  DEFAULT_MAZE_ZOOM_INDEX,
  followZoomScale,
  MAX_MAZE_ZOOM_INDEX,
  MAZE_ZOOM_SCALES,
  mazeZoomScale,
  MIN_MAZE_ZOOM_INDEX,
  CAMERA_ELEVATION_FOLLOW_LAMBDA,
  CAMERA_ELEVATION_RAD,
  CAMERA_FOV,
  CAMERA_LAUNCH_FOLLOW_LAMBDA,
  cameraSetupForFocus,
  computeMazeCameraDistance,
  desiredCameraFocus,
  followCameraElevation,
  followCameraFocus,
  LOOK_AHEAD_SECONDS,
  MAX_FOLLOW_LAG_IN_RADII,
  MAX_LOOK_AHEAD_IN_RADII,
  MIN_VISIBLE_CELLS_ON_SHORT_SIDE,
} from './mazeCamera'
import { BALL_RADIUS, MAX_BALL_SPEED } from './mazePhysics'
import { CELL_SIZE, mazeStageBounds } from './mazeStage'
import { createMazeStageById } from './mazeStages'

const stageBounds = mazeStageBounds(createMazeStageById('adventure'))

function safeAspect(aspect: number): number {
  return Number.isFinite(aspect) && aspect > 0 ? aspect : 1
}

function tanShortHalf(aspect: number): number {
  return (
    Math.tan((CAMERA_FOV * Math.PI) / 360) * Math.min(1, safeAspect(aspect))
  )
}

function ballScreenDiameterRatio(distance: number, aspect: number): number {
  return BALL_RADIUS / (distance * tanShortHalf(aspect))
}

function visibleCellsOnShortSide(distance: number, aspect: number): number {
  return (2 * distance * tanShortHalf(aspect)) / CELL_SIZE
}

describe('computeMazeCameraDistance', () => {
  it.each([
    ['スマホ縦', 390 / 780, 15.6],
    ['正方形', 1, 7.8],
    ['タブレット', 820 / 1180, 11.2],
    ['PC横', 1440 / 810, 7.8],
    ['低い横画面', 900 / 380, 7.8],
  ])(
    '%sではボールの画面短辺占有率を狙い、3.4マス以上を残す',
    (_label, aspect, expectedDistance) => {
      const distance = computeMazeCameraDistance(aspect)

      expect(distance).toBeCloseTo(expectedDistance, 1)
      expect(ballScreenDiameterRatio(distance, aspect)).toBeCloseTo(
        BALL_SCREEN_DIAMETER_RATIO,
        6,
      )
      expect(visibleCellsOnShortSide(distance, aspect)).toBeGreaterThanOrEqual(
        MIN_VISIBLE_CELLS_ON_SHORT_SIDE - 1e-9,
      )
    },
  )

  it('距離の下限が効く場合でも画面短辺のマス数を確保する', () => {
    const distance = computeMazeCameraDistance(1, {
      minVisibleCellsOnShortSide: 10,
    })

    expect(visibleCellsOnShortSide(distance, 1)).toBeGreaterThanOrEqual(10 - 1e-9)
    expect(distance).toBeGreaterThan(
      computeMazeCameraDistance(1, { minVisibleCellsOnShortSide: 0 }),
    )
  })

  it('aspectが0、負数、NaN、Infinityでも有限で正の距離になる', () => {
    for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const distance = computeMazeCameraDistance(aspect)
      expect(Number.isFinite(distance)).toBe(true)
      expect(distance).toBeGreaterThan(0)
    }
  })
})

describe('cameraSetupForFocus', () => {
  it('ボール中心の斜め上から同じ仰角で見下ろす', () => {
    const focus = { x: 4, z: -2 }
    const setup = cameraSetupForFocus(focus, 10)

    expect(setup.target).toEqual({ x: focus.x, y: BALL_RADIUS, z: focus.z })
    expect(setup.position.x).toBeCloseTo(focus.x, 10)
    expect(setup.position.y).toBeGreaterThan(setup.target.y)
    expect(setup.position.z).toBeGreaterThan(focus.z)
    expect(setup.fov).toBe(CAMERA_FOV)
    expect(setup.distance).toBe(10)
  })

  it('フォーカスが動いてもカメラの向きと仰角は変わらない', () => {
    const first = cameraSetupForFocus({ x: 0, z: 0 }, 8)
    const second = cameraSetupForFocus({ x: 5, z: -7 }, 8)
    const direction = (setup: ReturnType<typeof cameraSetupForFocus>) => ({
      x: setup.target.x - setup.position.x,
      y: setup.target.y - setup.position.y,
      z: setup.target.z - setup.position.z,
    })

    expect(direction(second)).toEqual(direction(first))
    expect(Math.atan2(-direction(first).y, -direction(first).z)).toBeCloseTo(
      CAMERA_ELEVATION_RAD,
      10,
    )
  })

  it('高さを省略したときは従来どおりBALL_RADIUSを注視する', () => {
    const focus = { x: 1.5, z: -2.25 }
    const distance = 7.2

    expect(cameraSetupForFocus(focus, distance)).toEqual(
      cameraSetupForFocus(focus, distance, BALL_RADIUS),
    )
  })
})

describe('desiredCameraFocus', () => {
  const openBounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }

  it('進行方向へ先読みし、上限で頭打ちにする', () => {
    const shortMove = desiredCameraFocus(
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      openBounds,
    )
    const cappedMove = desiredCameraFocus(
      { x: 0, z: 0 },
      { x: MAX_BALL_SPEED, z: 0 },
      openBounds,
    )

    expect(shortMove.x).toBeCloseTo(LOOK_AHEAD_SECONDS, 6)
    expect(shortMove.z).toBe(0)
    expect(cappedMove.x).toBeCloseTo(MAX_LOOK_AHEAD_IN_RADII * BALL_RADIUS, 6)
    expect(cappedMove.z).toBe(0)
  })

  it('静止時は先読みせず、歩ける矩形の外へ出ない', () => {
    expect(
      desiredCameraFocus({ x: 1, z: -2 }, { x: 0, z: 0 }, stageBounds),
    ).toEqual({ x: 1, z: -2 })

    const focus = desiredCameraFocus(
      { x: stageBounds.maxX - 0.01, z: 0 },
      { x: 100, z: 0 },
      stageBounds,
    )
    expect(focus.x).toBeCloseTo(stageBounds.maxX - CELL_SIZE, 10)
    expect(focus.z).toBeGreaterThanOrEqual(stageBounds.minZ + CELL_SIZE)
    expect(focus.z).toBeLessThanOrEqual(stageBounds.maxZ - CELL_SIZE)
  })

  it('insetを差し替えられる', () => {
    const bounds = { minX: -4, maxX: 4, minZ: -4, maxZ: 4 }
    const focus = desiredCameraFocus(
      { x: 3.9, z: 0 },
      { x: 100, z: 0 },
      bounds,
      { inset: 0.5 },
    )
    expect(focus.x).toBeCloseTo(3.5, 10)
  })

  it('細長い40マス相当のboundsでも距離とクランプがステージ形状に依存しない', () => {
    const longBounds = {
      minX: (-3 * CELL_SIZE) / 2,
      maxX: (3 * CELL_SIZE) / 2,
      minZ: (-40 * CELL_SIZE) / 2,
      maxZ: (40 * CELL_SIZE) / 2,
    }
    const shortDistance = computeMazeCameraDistance(1)
    const longDistance = computeMazeCameraDistance(1)
    const focus = desiredCameraFocus(
      { x: 0, z: longBounds.maxZ - CELL_SIZE / 2 },
      { x: 0, z: MAX_BALL_SPEED },
      longBounds,
    )

    // 距離はboundsの大きさではなく画面比率だけで決まるので、コースが伸びても変わらない。
    expect(longDistance).toBe(shortDistance)
    expect(focus.x).toBeGreaterThanOrEqual(longBounds.minX + CELL_SIZE)
    expect(focus.x).toBeLessThanOrEqual(longBounds.maxX - CELL_SIZE)
    expect(focus.z).toBeCloseTo(longBounds.maxZ - CELL_SIZE, 10)
  })
})

describe('followCameraFocus', () => {
  it('補間した注視点が単調にボールへ近づく', () => {
    const current = { x: -1, z: 0 }
    const desired = { x: 0, z: 0 }
    const ball = { x: 0, z: 0 }
    const first = followCameraFocus(current, desired, ball, 0.1)
    const second = followCameraFocus(first, desired, ball, 0.1)

    expect(first.x).toBeGreaterThan(current.x)
    expect(second.x).toBeGreaterThan(first.x)
    expect(Math.abs(second.x - ball.x)).toBeLessThan(Math.abs(first.x - ball.x))
  })

  it('経過時間が同じならフレームレートに依存せず同じ位置へ収束する', () => {
    const current = { x: -1, z: 0 }
    const desired = { x: 0.5, z: 0 }
    const ball = { x: 0, z: 0 }
    const oneFrame = followCameraFocus(current, desired, ball, 1)
    let sixtyFrames = current
    for (let index = 0; index < 60; index += 1) {
      sixtyFrames = followCameraFocus(sixtyFrames, desired, ball, 1 / 60)
    }

    expect(sixtyFrames.x).toBeCloseTo(oneFrame.x, 10)
    expect(sixtyFrames.z).toBeCloseTo(oneFrame.z, 10)
  })

  it('最大速度で直進し続けてもボールから3Rより離れない', () => {
    const bounds = { minX: -10000, maxX: 10000, minZ: -100, maxZ: 100 }
    const deltaSeconds = 1 / 60
    let focus = { x: 0, z: 0 }

    for (let index = 0; index <= 600; index += 1) {
      const ball = { x: MAX_BALL_SPEED * index * deltaSeconds, z: 0 }
      const desired = desiredCameraFocus(
        ball,
        { x: MAX_BALL_SPEED, z: 0 },
        bounds,
      )
      focus = followCameraFocus(focus, desired, ball, deltaSeconds)

      expect(Math.hypot(focus.x - ball.x, focus.z - ball.z)).toBeLessThanOrEqual(
        MAX_FOLLOW_LAG_IN_RADII * BALL_RADIUS + 1e-8,
      )
    }
  })
})

describe('followCameraElevation', () => {
  it('高さを滑らかに目標へ収束させ、発射中はより速く追従できる', () => {
    const first = followCameraElevation(BALL_RADIUS, 5, 0.1)
    const second = followCameraElevation(first, 5, 0.1)
    const launch = followCameraElevation(
      BALL_RADIUS,
      5,
      0.1,
      CAMERA_LAUNCH_FOLLOW_LAMBDA,
    )

    expect(first).toBeGreaterThan(BALL_RADIUS)
    expect(second).toBeGreaterThan(first)
    expect(second).toBeLessThan(5)
    expect(launch).toBeGreaterThan(first)
    expect(CAMERA_ELEVATION_FOLLOW_LAMBDA).toBeLessThan(5)
  })

  it('不正な高さ・経過時間・追従速度でも有限な高さを返す', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const next = followCameraElevation(value, value, value, value)
      expect(Number.isFinite(next)).toBe(true)
    }
  })
})

describe('プレイ中のズーム段階', () => {
  it('標準の段は距離を変えず、実機で決めたカメラ距離のままになる', () => {
    expect(mazeZoomScale(DEFAULT_MAZE_ZOOM_INDEX)).toBe(1)
  })

  it('既存の前後2段に加え、さらに前後2段ずつ選べる', () => {
    expect(MAZE_ZOOM_SCALES).toEqual([
      1.39, 1.29,
      // Phase 4実装時点のズーム段階。ここを基準に前後2段を追加する。
      1.19, 1.09, 1, 0.92, 0.84,
      0.77, 0.71,
    ])
    expect(DEFAULT_MAZE_ZOOM_INDEX - MIN_MAZE_ZOOM_INDEX).toBe(4)
    expect(MAX_MAZE_ZOOM_INDEX - DEFAULT_MAZE_ZOOM_INDEX).toBe(4)
  })

  it('段が上がるほど寄る（距離が縮む）', () => {
    for (let index = 1; index <= MAX_MAZE_ZOOM_INDEX; index += 1) {
      expect(mazeZoomScale(index)).toBeLessThan(mazeZoomScale(index - 1))
    }
  })

  it('範囲外や壊れた値でも選べる段に収まる', () => {
    expect(clampMazeZoomIndex(-5)).toBe(MIN_MAZE_ZOOM_INDEX)
    expect(clampMazeZoomIndex(99)).toBe(MAX_MAZE_ZOOM_INDEX)
    expect(clampMazeZoomIndex(Number.NaN)).toBe(DEFAULT_MAZE_ZOOM_INDEX)
    expect(clampMazeZoomIndex(1.4)).toBe(1)
  })

  it('1段あたりの変化が小さく、数回押して合わせられる', () => {
    for (let index = 1; index < MAZE_ZOOM_SCALES.length; index += 1) {
      const ratio = mazeZoomScale(index - 1) / mazeZoomScale(index)
      expect(ratio).toBeGreaterThan(1.05)
      expect(ratio).toBeLessThan(1.15)
    }
  })

  it('一番引いても迷路全体（9マス）は見渡せない', () => {
    const aspect = 390 / 780
    const distance = computeMazeCameraDistance(aspect) * mazeZoomScale(MIN_MAZE_ZOOM_INDEX)
    const cells = visibleCellsOnShortSide(distance, aspect)

    expect(cells).toBeGreaterThan(visibleCellsOnShortSide(computeMazeCameraDistance(aspect), aspect))
    expect(cells).toBeLessThan(6)
  })

  it('一番寄せてもボールが画面を占有しすぎない', () => {
    const aspect = 390 / 780
    const distance = computeMazeCameraDistance(aspect) * mazeZoomScale(MAX_MAZE_ZOOM_INDEX)
    const ratio = ballScreenDiameterRatio(distance, aspect)

    expect(ratio).toBeGreaterThan(BALL_SCREEN_DIAMETER_RATIO)
    // 国旗は大きく見えるが、画面の4分の1を占有しない。
    expect(ratio).toBeLessThan(0.25)
  })

  it('ズームは距離だけを変え、向きも仰角も変えない', () => {
    const focus = { x: 2, z: -3 }
    const near = cameraSetupForFocus(focus, 10 * mazeZoomScale(MAX_MAZE_ZOOM_INDEX))
    const far = cameraSetupForFocus(focus, 10 * mazeZoomScale(MIN_MAZE_ZOOM_INDEX))
    const elevation = (setup: ReturnType<typeof cameraSetupForFocus>) =>
      Math.atan2(setup.position.y - setup.target.y, setup.position.z - setup.target.z)

    expect(near.target).toEqual(far.target)
    expect(elevation(near)).toBeCloseTo(elevation(far), 10)
    expect(near.distance).toBeLessThan(far.distance)
  })
})

describe('followZoomScale', () => {
  it('目標の倍率へ滑らかに近づく', () => {
    const first = followZoomScale(1, 0.84, 1 / 60)
    const second = followZoomScale(first, 0.84, 1 / 60)

    expect(first).toBeLessThan(1)
    expect(first).toBeGreaterThan(0.84)
    expect(second).toBeLessThan(first)
  })

  it('経過時間が同じならフレームレートに依存しない', () => {
    const oneFrame = followZoomScale(1, 0.84, 0.5)
    let many = 1
    for (let index = 0; index < 30; index += 1) many = followZoomScale(many, 0.84, 0.5 / 30)

    expect(many).toBeCloseTo(oneFrame, 10)
  })

  it('経過時間が0や不正でも現在値を保つ', () => {
    expect(followZoomScale(1, 0.84, 0)).toBe(1)
    expect(followZoomScale(1, 0.84, Number.NaN)).toBe(1)
  })
})
