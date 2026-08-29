import { describe, expect, it } from 'vitest'
import { celestialBodies } from '../data/celestialBodies'
import {
  CAMERA_FOV_DEGREES,
  cameraDistanceForZoom,
  DEFAULT_VIEW_DIRECTION,
  easeOutCubic,
  fitDistance,
  viewDirectionOf,
  viewRadiusOf,
} from './planetCamera'
import { ringOuterRadiusRatio } from './planetRing'
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
  it('追加したズームアウト2段階を含め、レベル-2→3で単調に近づく', () => {
    const body = celestialBodies[0]
    const levels: ZoomLevel[] = [-2, -1, 0, 1, 2, 3]
    const distances = levels.map((level) => cameraDistanceForZoom(body, level, LANDSCAPE_ASPECT))

    for (let i = 1; i < distances.length; i += 1) {
      expect(distances[i]).toBeLessThan(distances[i - 1])
    }
  })

  it('既存の0〜3段階と最大ズーム距離を変えず、-2/-1だけを同じ比率で追加する', () => {
    const body = celestialBodies[0]
    const legacyRatio = (body.zoom.inMargin / body.zoom.outMargin) ** (1 / 3)
    const distanceAtZero = cameraDistanceForZoom(body, 0, LANDSCAPE_ASPECT)
    const distanceAtMax = cameraDistanceForZoom(body, MAX_ZOOM_LEVEL, LANDSCAPE_ASPECT)

    expect(distanceAtZero).toBeCloseTo(fitDistance(viewRadiusOf(body), LANDSCAPE_ASPECT) * body.zoom.outMargin)
    expect(distanceAtMax).toBeCloseTo(fitDistance(viewRadiusOf(body), LANDSCAPE_ASPECT) * body.zoom.inMargin)
    expect(cameraDistanceForZoom(body, -1, LANDSCAPE_ASPECT) / distanceAtZero).toBeCloseTo(1 / legacyRatio)
    expect(cameraDistanceForZoom(body, -2, LANDSCAPE_ASPECT) / distanceAtZero).toBeCloseTo(1 / legacyRatio ** 2)
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

describe('viewDirectionOf', () => {
  it('viewDirectionを持たない天体は既定視点を返す', () => {
    const moon = celestialBodies.find((body) => body.id === 'moon')
    expect(moon).toBeDefined()
    if (moon === undefined) return
    expect(viewDirectionOf(moon)).toEqual(DEFAULT_VIEW_DIRECTION)
  })

  it('viewDirectionを持つ天体はそれを返す(既定値を上書きする)', () => {
    const saturn = celestialBodies.find((body) => body.id === 'saturn')
    expect(saturn).toBeDefined()
    if (saturn === undefined || saturn.viewDirection === undefined) return
    expect(viewDirectionOf(saturn)).toEqual(saturn.viewDirection)
    expect(viewDirectionOf(saturn)).not.toEqual(DEFAULT_VIEW_DIRECTION)
  })
})

describe('viewRadiusOf', () => {
  it('輪を持つ天体は輪の最外周セグメントまでを視野半径に含める', () => {
    const saturn = celestialBodies.find((body) => body.id === 'saturn')
    expect(saturn).toBeDefined()
    if (saturn === undefined || saturn.ring === undefined) return
    expect(viewRadiusOf(saturn)).toBeCloseTo(saturn.radius * ringOuterRadiusRatio(saturn.ring))
  })
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

  it('既存のMAX_ZOOM_LEVELを使った補間比が0..1に収まる', () => {
    expect(MAX_ZOOM_LEVEL).toBe(3)
    expect(easeOutCubic(0.5)).toBeGreaterThan(0)
    expect(easeOutCubic(0.5)).toBeLessThan(1)
  })
})
