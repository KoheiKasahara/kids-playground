import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { globeCountries } from './data/globeCountries'
import { worldFeatures } from './data/worldFeatures'
import {
  clampLabelToViewport,
  computeCountryLabelCandidates,
  estimateLabelWidth,
  filterLabelCandidatesForZoom,
  isInVisibleHemisphere,
  LABEL_HEIGHT_PX,
  LABEL_VIEWPORT_PADDING,
  latLngToGlobePosition,
  MAX_VISIBLE_LABELS,
  maxVisibleLabelsForViewport,
  placeLabelsGreedily,
  priorityForLabelLayout,
  rectanglesOverlap,
  visibleHemisphereEdgeThresholdForZoom,
  type CountryLabelCandidate,
} from './countryLabels'
import { GLOBE_RADIUS, type GlobeFeature, type ZoomLevel } from './types'
import { cameraDistanceForZoom } from './three/zoomLevels'

function candidate(
  countryId: string,
  areaRank: number,
  priority = 1_000 - areaRank,
): CountryLabelCandidate {
  return {
    countryId,
    nameJa: countryId,
    anchor: { x: 0, y: 0, z: 1 },
    area: 100 - areaRank,
    areaRank,
    priority,
  }
}

function placedCountryIdsAt(
  width: number,
  height: number,
  latitude: number,
  longitude: number,
  zoomLevel: ZoomLevel,
): readonly string[] {
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
  const cameraPosition = latLngToGlobePosition(
    latitude,
    longitude,
    cameraDistanceForZoom(zoomLevel),
  )
  camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)

  const candidates = computeCountryLabelCandidates(globeCountries, worldFeatures)
  const layoutCandidates = filterLabelCandidatesForZoom(candidates, zoomLevel).flatMap((candidate) => {
    if (!isInVisibleHemisphere(
      camera.position,
      candidate.anchor,
      visibleHemisphereEdgeThresholdForZoom(zoomLevel),
    )) return []

    const projected = new THREE.Vector3(
      candidate.anchor.x * GLOBE_RADIUS,
      candidate.anchor.y * GLOBE_RADIUS,
      candidate.anchor.z * GLOBE_RADIUS,
    ).project(camera)
    if (projected.z < -1 || projected.z > 1) return []

    const screenX = (projected.x + 1) * 0.5 * width
    const screenY = (1 - projected.y) * 0.5 * height

    return [{
      id: candidate.countryId,
      name: candidate.nameJa,
      x: screenX,
      y: screenY,
      width: estimateLabelWidth(candidate.nameJa),
      height: LABEL_HEIGHT_PX,
      priority: candidate.priority,
    }]
  })

  const placements = placeLabelsGreedily(
    layoutCandidates,
    { width, height, padding: LABEL_VIEWPORT_PADDING },
    maxVisibleLabelsForViewport(zoomLevel, width),
    zoomLevel,
  )
  return placements.map((placement) => placement.id)
}

describe('earth-globe country labels', () => {
  it('判定したカメラ側の半球だけを可視とする', () => {
    expect(isInVisibleHemisphere(
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 1 },
    )).toBe(true)
    expect(isInVisibleHemisphere(
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 },
    )).toBe(false)
    expect(isInVisibleHemisphere(
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 0 },
      0.1,
    )).toBe(false)
  })

  it('ズームごとの面積順位LODと最大表示数を適用する', () => {
    const zoomZero = filterLabelCandidatesForZoom([
      candidate('large', 8),
      candidate('small', 9),
    ], 0)
    expect(zoomZero.map((item) => item.countryId)).toEqual(['large'])

    const zoomOne = filterLabelCandidatesForZoom([
      candidate('large', 1),
      candidate('medium', 18),
      candidate('small', 19),
    ], 1)
    expect(zoomOne.map((item) => item.countryId)).toEqual(['large', 'medium'])

    const zoomThree = filterLabelCandidatesForZoom([
      candidate('cn', 120),
      candidate('jp', 121),
      candidate('kr', 122),
      candidate('other', 97),
    ], 3)
    expect(zoomThree).toHaveLength(4)
    expect(zoomThree.map((item) => item.countryId)).toEqual(
      expect.arrayContaining(['cn', 'jp', 'kr', 'other']),
    )
  })

  it('画面幅から表示上限を算出し、ズーム時は画面中央を優先する', () => {
    expect(maxVisibleLabelsForViewport(3, 375)).toBeLessThanOrEqual(10)
    expect(maxVisibleLabelsForViewport(3, 1280)).toBe(MAX_VISIBLE_LABELS[3])
    expect(maxVisibleLabelsForViewport(0, 375)).toBe(MAX_VISIBLE_LABELS[0])
    expect(visibleHemisphereEdgeThresholdForZoom(0)).toBeLessThan(
      visibleHemisphereEdgeThresholdForZoom(3),
    )

    const viewport = { width: 375, height: 812, padding: LABEL_VIEWPORT_PADDING }
    const largeEdgeCountry = candidate('large-edge', 1, 9_900)
    const smallCenterCountry = candidate('small-center', 180, 9_800)
    expect(priorityForLabelLayout(
      smallCenterCountry,
      viewport.width / 2,
      viewport.height / 2,
      viewport,
      3,
    )).toBeGreaterThan(priorityForLabelLayout(
      largeEdgeCountry,
      viewport.width - 20,
      viewport.height / 2,
      viewport,
      3,
    ))
  })

  it('重要度の高いラベルを優先し、重なりと上限を貪欲に除外する', () => {
    const first = {
      id: 'first', name: 'いち', x: 100, y: 100, width: 80, height: 30, priority: 10,
    }
    const overlapping = {
      id: 'overlapping', name: 'に', x: 105, y: 100, width: 80, height: 30, priority: 1,
    }
    const separate = {
      id: 'separate', name: 'さん', x: 240, y: 100, width: 80, height: 30, priority: 2,
    }

    const placements = placeLabelsGreedily(
      [overlapping, separate, first],
      { width: 320, height: 200, padding: 8 },
      2,
      0,
    )

    expect(placements.map((item) => item.id)).toEqual(['first', 'separate'])
    expect(rectanglesOverlap(placements[0]!.rect, placements[1]!.rect)).toBe(false)
    expect(placeLabelsGreedily(
      [first, separate],
      { width: 320, height: 200 },
      1,
    )).toHaveLength(1)

    const clamped = clampLabelToViewport(
      { id: 'edge', name: 'はし', x: -40, y: 240, width: 80, height: 30, priority: 1 },
      { width: 320, height: 200, padding: 8 },
    )
    expect(clamped.x).toBe(48)
    expect(clamped.y).toBe(177)
  })

  it('緯度経度を地球座標へ変換し、最大ポリゴンからアンカーを求める', () => {
    const equatorPrimeMeridian = latLngToGlobePosition(0, 0)
    expect(equatorPrimeMeridian.x).toBeCloseTo(0)
    expect(equatorPrimeMeridian.y).toBeCloseTo(0)
    expect(equatorPrimeMeridian.z).toBeCloseTo(1)

    const fixtureFeature: GlobeFeature = {
      id: 1,
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ]],
      },
    }
    const [fixtureCandidate] = computeCountryLabelCandidates([
      { id: 'xx', nameJa: 'てすと', flag: 'flags/xx.svg', numericId: 1 },
    ], [fixtureFeature])

    expect(fixtureCandidate?.anchor).toMatchObject(latLngToGlobePosition(5, 5))
    expect(Math.hypot(
      fixtureCandidate?.anchor.x ?? 0,
      fixtureCandidate?.anchor.y ?? 0,
      fixtureCandidate?.anchor.z ?? 0,
    )).toBeCloseTo(1)
  })

  it('実データでも日本のアンカーが日本付近に収まる', () => {
    const countries = globeCountries.filter((country) => country.id === 'jp')
    const candidates = computeCountryLabelCandidates(countries, worldFeatures)
    const japan = candidates.find((item) => item.countryId === 'jp')

    expect(japan).toBeDefined()
    expect(japan?.anchor.y).toBeGreaterThan(0.5)
    expect(japan?.anchor.x).toBeGreaterThan(0)
    expect(japan?.anchor.z).toBeLessThan(0)
  })

  it('Zoom 3の実データでは日本・韓国・中国を候補から外さない', () => {
    const candidates = computeCountryLabelCandidates(globeCountries, worldFeatures)
    const ids = filterLabelCandidatesForZoom(candidates, 3).map((item) => item.countryId)

    expect(ids).toEqual(expect.arrayContaining(['jp', 'kr', 'cn']))
    expect(ids.length).toBe(candidates.length)
  })

  // LODのしきい値や表示上限を変更しても、実カメラ投影の受け入れ要件を壊したら検知できるようにする。
  it('実カメラの東アジアZoom 3で両方向とも日本・韓国・中国を配置する', () => {
    for (const [latitude, longitude] of [[35, 130], [36, 128]]) {
      const ids = placedCountryIdsAt(375, 812, latitude, longitude, 3)

      expect(ids).toEqual(expect.arrayContaining(['jp', 'kr', 'cn']))
      expect(ids.length).toBeLessThanOrEqual(maxVisibleLabelsForViewport(3, 375))
      expect(ids).not.toEqual(expect.arrayContaining(['ca', 'gl']))
    }
  })

  it('実カメラの東アジアZoom 2でも複数ラベルを配置する', () => {
    const ids = placedCountryIdsAt(375, 812, 35, 130, 2)

    expect(ids.length).toBeGreaterThan(0)
    expect(ids.length).toBeLessThanOrEqual(maxVisibleLabelsForViewport(2, 375))
  })

  it('実カメラの欧州Zoom 3で中規模国を地域の優先度だけで配置する', () => {
    const ids = placedCountryIdsAt(375, 812, 48, 10, 3)
    const europeanIds = ids.filter((id) => (
      ['fr', 'de', 'it'].includes(id)
    ))

    expect(europeanIds.length).toBeGreaterThanOrEqual(2)
  })

  it('Zoom 0は主要国を上限以内に抑える', () => {
    const ids = placedCountryIdsAt(375, 812, 25, 135, 0)

    expect(ids.length).toBeLessThanOrEqual(maxVisibleLabelsForViewport(0, 375))
  })
})
