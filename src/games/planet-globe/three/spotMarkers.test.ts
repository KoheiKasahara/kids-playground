import { describe, expect, it } from 'vitest'
import { celestialBodies, celestialBodyById } from '../data/celestialBodies'
import { featureSpotsFor } from '../data/featureSpots'
import { DEFAULT_ZOOM_LEVEL, type CelestialBody } from '../types'
import { cameraDistanceForZoom, viewDirectionOf } from './planetCamera'
import { axialTiltRotationZ } from './planetRing'
import { isRingPointVisible } from './spotPicking'
import {
  MARKER_SURFACE_OFFSET_RATIO,
  resolveRingHighlightBands,
  ringSpotLocalPosition,
  surfaceSpotLocalPosition,
} from './spotMarkers'

function withFlattening(base: CelestialBody, flattening: number): CelestialBody {
  return { ...base, flattening }
}

describe('ringSpotLocalPosition', () => {
  const saturn = celestialBodyById('saturn')

  it('angleDeg=0で+X方向、半径はradiusRatio*body.radius', () => {
    const position = ringSpotLocalPosition(saturn, { radiusRatio: 1.74, angleDeg: 0 })
    expect(position.x).toBeCloseTo(saturn.radius * 1.74, 6)
    expect(position.y).toBe(0)
    expect(position.z).toBeCloseTo(0, 6)
  })

  it('angleDeg=90で+Z方向', () => {
    const position = ringSpotLocalPosition(saturn, { radiusRatio: 1.74, angleDeg: 90 })
    expect(position.x).toBeCloseTo(0, 6)
    expect(position.y).toBe(0)
    expect(position.z).toBeCloseTo(saturn.radius * 1.74, 6)
  })

  it('yは常に0(赤道面)', () => {
    for (const angleDeg of [0, 25, 90, 115, 200, 350]) {
      expect(ringSpotLocalPosition(saturn, { radiusRatio: 2, angleDeg }).y).toBe(0)
    }
  })
})

describe('surfaceSpotLocalPosition', () => {
  const jupiter = celestialBodyById('jupiter') // 扁平を持つ天体で確認する

  it('扁平はY方向だけに効く', () => {
    const flattened = withFlattening(jupiter, 0.1)
    const sphere = withFlattening(jupiter, 0)
    const target = { lonDeg: 20, latDeg: 35 } // 北半球(y>0の向き)

    const flatPos = surfaceSpotLocalPosition(flattened, target)
    const spherePos = surfaceSpotLocalPosition(sphere, target)

    expect(flatPos.x).toBeCloseTo(spherePos.x, 6)
    expect(flatPos.z).toBeCloseTo(spherePos.z, 6)
    expect(flatPos.y).toBeLessThan(spherePos.y)
  })

  it('浮かせ量は半径に効く(lon=0,lat=0の方向は(1,0,0)なのでxへそのまま現れる)', () => {
    const base = withFlattening(jupiter, 0)
    const position = surfaceSpotLocalPosition(base, { lonDeg: 0, latDeg: 0 })
    expect(position.x).toBeCloseTo(base.radius * (1 + MARKER_SURFACE_OFFSET_RATIO), 6)
    expect(position.y).toBeCloseTo(0, 6)
    expect(position.z).toBeCloseTo(0, 6)
  })

  it('lat=90では真上(0, +, 0)を向く', () => {
    const position = surfaceSpotLocalPosition(jupiter, { lonDeg: 123, latDeg: 90 })
    expect(position.x).toBeCloseTo(0, 6)
    expect(position.z).toBeCloseTo(0, 6)
    expect(position.y).toBeGreaterThan(0)
  })
})

describe('resolveRingHighlightBands', () => {
  const saturn = celestialBodyById('saturn')

  it('highlightSegmentIds指定で該当セグメントのinner/outerRadiusRatioを返す', () => {
    const bands = resolveRingHighlightBands(saturn, {
      kind: 'ring',
      radiusRatio: 1.74,
      angleDeg: 25,
      highlightSegmentIds: ['c-ring', 'a-ring'],
    })
    const expected = (saturn.ring?.segments ?? [])
      .filter((segment) => segment.id === 'c-ring' || segment.id === 'a-ring')
      .map((segment) => ({ innerRatio: segment.innerRadiusRatio, outerRatio: segment.outerRadiusRatio }))
    expect(bands).toEqual(expected)
  })

  it('highlightRadiusBandの直接指定を返す', () => {
    const bands = resolveRingHighlightBands(saturn, {
      kind: 'ring',
      radiusRatio: 1.985,
      angleDeg: 115,
      highlightRadiusBand: { innerRatio: 1.95, outerRatio: 2.02 },
    })
    expect(bands).toEqual([{ innerRatio: 1.95, outerRatio: 2.02 }])
  })

  it('存在しないsegment idは無視する', () => {
    const bands = resolveRingHighlightBands(saturn, {
      kind: 'ring',
      radiusRatio: 1.74,
      angleDeg: 25,
      highlightSegmentIds: ['no-such-ring'],
    })
    expect(bands).toEqual([])
  })

  it('輪の無い天体では空配列を返す', () => {
    const moon = celestialBodyById('moon')
    const bands = resolveRingHighlightBands(moon, {
      kind: 'ring',
      radiusRatio: 1.5,
      angleDeg: 0,
      highlightSegmentIds: ['c-ring'],
    })
    expect(bands).toEqual([])
  })

  it('segment idもradiusBandも無ければ空配列を返す', () => {
    const bands = resolveRingHighlightBands(saturn, { kind: 'ring', radiusRatio: 1.5, angleDeg: 0 })
    expect(bands).toEqual([])
  })
})

/**
 * 輪は自転させず `tiltGroup` 直下に固定するので(`usePlanetEngine` 参照)、
 * `angleDeg` の選び方しだいでマーカーが永久に天体の裏側へ隠れてタップできなくなる。
 * 既定視点・既定ズームで全ての輪スポットが見えることを固定する。
 */
describe('輪スポットは既定の視点から見える位置にある', () => {
  const PORTRAIT_ASPECT = 390 / 660

  it.each(celestialBodies.filter((body) => body.ring !== undefined).map((body) => body.id))(
    '%s の輪スポットは天体の裏に隠れない',
    (bodyId) => {
      const body = celestialBodyById(bodyId)
      const view = viewDirectionOf(body)
      const distance = cameraDistanceForZoom(body, DEFAULT_ZOOM_LEVEL, PORTRAIT_ASPECT)
      const length = Math.hypot(view.x, view.y, view.z)

      // カメラのワールド座標を tiltGroup ローカルへ移す(tiltGroupはZ軸まわりの回転のみ)。
      const tilt = -axialTiltRotationZ(body)
      const worldX = (view.x / length) * distance
      const worldY = (view.y / length) * distance
      const worldZ = (view.z / length) * distance
      const flattening = body.flattening ?? 0
      const camera = {
        x: (worldX * Math.cos(tilt) - worldY * Math.sin(tilt)) / body.radius,
        y: (worldX * Math.sin(tilt) + worldY * Math.cos(tilt)) / (body.radius * (1 - flattening)),
        z: worldZ / body.radius,
      }

      for (const spot of featureSpotsFor(bodyId)) {
        if (spot.target.kind !== 'ring') continue
        const position = ringSpotLocalPosition(body, spot.target)
        const normalized = { x: position.x / body.radius, y: 0, z: position.z / body.radius }
        expect(isRingPointVisible(camera, normalized), `${spot.id} が裏側で隠れている`).toBe(true)
      }
    },
  )
})
