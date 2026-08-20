import { describe, expect, it } from 'vitest'
import {
  BASE_BORDER_RADIUS,
  BASE_POLYGON_ALTITUDE,
  GLOBE_CURVATURE_RESOLUTION_DEGREES,
  POLYGON_CAP_CURVATURE_RESOLUTION_DEGREES,
  SELECTED_BORDER_RADIUS,
  SELECTED_POLYGON_ALTITUDE,
} from './globeLayers'
import { cameraDistanceForZoom, GLOBE_RADIUS } from './zoomLevels'

// iPhone相当の縦画面（カメラのfovは45度）。壁の見え方をpxで見積もるために使う。
const VIEWPORT_HEIGHT_PX = 844
const FIELD_OF_VIEW_DEGREES = 45

/** 曲面を分割したときに、面が球の内側へ沈み込む量。 */
function tessellationSag(radius: number, resolutionDegrees: number): number {
  return radius * (1 - Math.cos((resolutionDegrees / 2) * (Math.PI / 180)))
}

/** 地表付近の1画面ピクセルが何world unitに相当するか。 */
function worldUnitsPerPixel(cameraDistance: number): number {
  const distanceToSurface = cameraDistance - GLOBE_RADIUS
  const visibleHeight = 2 * distanceToSurface
    * Math.tan((FIELD_OF_VIEW_DEGREES / 2) * (Math.PI / 180))
  return visibleHeight / VIEWPORT_HEIGHT_PX
}

describe('earth-globe layers', () => {
  it('stacks the sea, the land cap, the border line and the selected country outward', () => {
    const landCapRadius = GLOBE_RADIUS * (1 + BASE_POLYGON_ALTITUDE)
    const selectedCapRadius = GLOBE_RADIUS * (1 + SELECTED_POLYGON_ALTITUDE)

    expect(landCapRadius).toBeGreaterThan(GLOBE_RADIUS)
    expect(BASE_BORDER_RADIUS).toBeGreaterThan(landCapRadius)
    expect(selectedCapRadius).toBeGreaterThan(BASE_BORDER_RADIUS)
    expect(SELECTED_BORDER_RADIUS).toBeGreaterThan(selectedCapRadius)
  })

  it('keeps the land cap above the sea even where both are tessellated', () => {
    // capを低くしすぎると、曲面分割で内側へ沈んだcapが海の球体を突き抜けて
    // 陸がまだらに欠ける。海の球体は頂点で半径100が最大値になる。
    const landCapRadius = GLOBE_RADIUS * (1 + BASE_POLYGON_ALTITUDE)
    const lowestCapRadius = landCapRadius
      - tessellationSag(landCapRadius, POLYGON_CAP_CURVATURE_RESOLUTION_DEGREES)

    expect(tessellationSag(GLOBE_RADIUS, GLOBE_CURVATURE_RESOLUTION_DEGREES))
      .toBeGreaterThan(0)
    expect(lowestCapRadius).toBeGreaterThan(GLOBE_RADIUS)
  })

  it('hides the extruded land wall when zoomed out but keeps it visible when zoomed in', () => {
    // 押し出しの側面は、地球全体表示で海岸線を斜めから見るとギザついた縁になる。
    // 全体表示では1px未満に収め、最大ズームでは立体感が残る高さにする。
    const wallHeight = GLOBE_RADIUS * BASE_POLYGON_ALTITUDE

    expect(wallHeight / worldUnitsPerPixel(cameraDistanceForZoom(0, true)))
      .toBeLessThan(1)
    expect(wallHeight / worldUnitsPerPixel(cameraDistanceForZoom(3)))
      .toBeGreaterThan(2)
  })
})
