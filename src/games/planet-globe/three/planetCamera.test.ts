import { describe, expect, it } from 'vitest'
import { celestialBodies } from '../data/celestialBodies'
import {
  CAMERA_FOV_DEGREES,
  cameraDistanceForZoom,
  easeOutCubic,
  fitDistance,
  viewRadiusOf,
} from './planetCamera'
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, type ZoomLevel } from '../types'

const PORTRAIT_ASPECT = 0.46
const LANDSCAPE_ASPECT = 1.8

/** planetCamera.ts の実装から独立して、画面に収まるかどうかを検証するための制約式。 */
function limitingHalfFovRadians(aspect: number, fovDegrees = CAMERA_FOV_DEGREES): number {
  const verticalFov = (fovDegrees * Math.PI) / 180
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect)
  return Math.min(verticalFov, horizontalFov) / 2
}

describe('fitDistance', () => {
  it('縦長画面のほうが横長画面より収める距離が遠い', () => {
    const portraitDistance = fitDistance(100, PORTRAIT_ASPECT)
    const landscapeDistance = fitDistance(100, LANDSCAPE_ASPECT)
    expect(portraitDistance).toBeGreaterThan(landscapeDistance)
  })
})

describe('cameraDistanceForZoom', () => {
  it('レベル0→3で単調に近づく', () => {
    const body = celestialBodies[0]
    const levels: ZoomLevel[] = [0, 1, 2, 3]
    const distances = levels.map((level) => cameraDistanceForZoom(body, level, LANDSCAPE_ASPECT))

    for (let i = 1; i < distances.length; i += 1) {
      expect(distances[i]).toBeLessThan(distances[i - 1])
    }
  })

  it.each(celestialBodies)(
    '$id: ズーム段階0では aspect 0.46 と 1.8 の両方で天体(輪を含む)が画面に収まる',
    (body) => {
      for (const aspect of [PORTRAIT_ASPECT, LANDSCAPE_ASPECT]) {
        const distance = cameraDistanceForZoom(body, MIN_ZOOM_LEVEL, aspect)
        const halfFov = limitingHalfFovRadians(aspect)
        // 天体(輪を含む視野半径)が画面の端まで届かないことを、実装と独立の式で確認する。
        // 土星の輪の見切れを防ぐための回帰テスト。
        expect(viewRadiusOf(body)).toBeLessThanOrEqual(distance * Math.sin(halfFov))
      }
    },
  )
})

describe('easeOutCubic', () => {
  it('0未満は0にクランプされる', () => {
    expect(easeOutCubic(-1)).toBe(0)
  })

  it('1より大きい値は1にクランプされる', () => {
    expect(easeOutCubic(2)).toBe(1)
  })

  it('0と1ではそれぞれ0と1になる', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
  })

  it('MAX_ZOOM_LEVELを使った補間比が0..1に収まる', () => {
    expect(MAX_ZOOM_LEVEL).toBe(3)
    expect(easeOutCubic(0.5)).toBeGreaterThan(0)
    expect(easeOutCubic(0.5)).toBeLessThan(1)
  })
})
