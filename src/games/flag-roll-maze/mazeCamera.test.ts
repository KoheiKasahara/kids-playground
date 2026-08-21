import { describe, expect, it } from 'vitest'
import {
  CAMERA_ELEVATION_RAD,
  CAMERA_FOV,
  computeMazeCameraSetup,
  visualTiltLift,
} from './mazeCamera'
import { WALL_HEIGHT } from './mazePhysics'
import { createMazeStage, mazeStageBounds } from './mazeStage'

const stage = createMazeStage()
const bounds = mazeStageBounds(stage)

/** カメラ空間へ移してから、点が画角の内側にあるかを確かめる。 */
function isInsideView(
  setup: ReturnType<typeof computeMazeCameraSetup>,
  point: { x: number; y: number; z: number },
  aspect: number,
): boolean {
  const sinElevation = Math.sin(CAMERA_ELEVATION_RAD)
  const cosElevation = Math.cos(CAMERA_ELEVATION_RAD)
  const forward = { x: 0, y: -sinElevation, z: -cosElevation }
  const up = { x: 0, y: cosElevation, z: -sinElevation }
  const relative = {
    x: point.x - setup.position.x,
    y: point.y - setup.position.y,
    z: point.z - setup.position.z,
  }
  const depth = relative.x * forward.x + relative.y * forward.y + relative.z * forward.z
  if (depth <= 0) return false
  const vertical = relative.x * up.x + relative.y * up.y + relative.z * up.z
  const tanVertical = Math.tan((CAMERA_FOV * Math.PI) / 360)
  const tanHorizontal = tanVertical * aspect
  return (
    Math.abs(relative.x) <= depth * tanHorizontal + 1e-6 &&
    Math.abs(vertical) <= depth * tanVertical + 1e-6
  )
}

describe('computeMazeCameraSetup', () => {
  it('盤面の中心を見る', () => {
    const setup = computeMazeCameraSetup(bounds, 1)
    expect(setup.target.x).toBeCloseTo(0, 6)
    expect(setup.target.z).toBeCloseTo(0, 6)
  })

  it('斜め上から見下ろす位置に置かれる', () => {
    const setup = computeMazeCameraSetup(bounds, 1)
    expect(setup.position.y).toBeGreaterThan(0)
    // 真上ではなく手前(+Z)側に引いた位置にいる。
    expect(setup.position.z).toBeGreaterThan(0)
    expect(setup.position.x).toBeCloseTo(0, 6)
  })

  it.each([
    ['スマホ縦', 390 / 780],
    ['正方形', 1],
    ['タブレット', 820 / 1180],
    ['PC横', 1440 / 810],
    ['低い横画面', 900 / 380],
  ])('%s の画面比でも盤面の四隅と壁が画角に収まる', (_label, aspect) => {
    const setup = computeMazeCameraSetup(bounds, aspect)
    for (const x of [bounds.minX, bounds.maxX]) {
      for (const z of [bounds.minZ, bounds.maxZ]) {
        for (const y of [0, WALL_HEIGHT]) {
          expect(isInsideView(setup, { x, y, z }, aspect)).toBe(true)
        }
      }
    }
  })

  it.each([
    ['スマホ縦', 390 / 780],
    ['PC横', 1440 / 810],
  ])('%s で盤面を最大まで傾けても四隅が画角から出ない', (_label, aspect) => {
    const setup = computeMazeCameraSetup(bounds, aspect)
    const lift = visualTiltLift(bounds)
    expect(lift).toBeGreaterThan(0)
    for (const x of [bounds.minX, bounds.maxX]) {
      for (const z of [bounds.minZ, bounds.maxZ]) {
        // 傾きで持ち上がった角と、沈み込んだ角の両方を見る。
        for (const y of [-lift, WALL_HEIGHT + lift]) {
          expect(isInsideView(setup, { x, y, z }, aspect)).toBe(true)
        }
      }
    }
  })

  it('縦長の画面ほどカメラを遠ざける', () => {
    const portrait = computeMazeCameraSetup(bounds, 0.5)
    const landscape = computeMazeCameraSetup(bounds, 1.8)
    expect(portrait.distance).toBeGreaterThan(landscape.distance)
  })

  it('aspectが不正でも破綻しない', () => {
    for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const setup = computeMazeCameraSetup(bounds, aspect)
      expect(Number.isFinite(setup.distance)).toBe(true)
      expect(setup.distance).toBeGreaterThan(0)
    }
  })

  it('極端に小さい盤面でも最低距離を保つ', () => {
    const setup = computeMazeCameraSetup({ minX: -0.1, maxX: 0.1, minZ: -0.1, maxZ: 0.1 }, 1)
    expect(setup.distance).toBeGreaterThanOrEqual(4)
  })
})
