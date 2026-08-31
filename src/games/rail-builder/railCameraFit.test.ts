import { describe, expect, test } from 'vitest'
import {
  calculateRailCameraFit,
  RAIL_CAMERA_CLIP_FAR,
  RAIL_CAMERA_CLIP_NEAR,
  RAIL_CAMERA_FRONT_CLEARANCE,
  type RailCameraBounds,
  type RailCameraFit,
} from './railCameraFit'

const CAMERA_OFFSET = { x: 18, y: 23, z: 20 }
const OVERVIEW_TARGET = { x: 0, y: 0, z: 0 }
const BASE_VIEW_SIZE = 15
const MIN_ZOOM = 0.72 - 0.14 * 4
const PAN_LIMIT = 46
const WORLD_HALF_SIZE = 50
const WORLD_MIN_HEIGHT = -0.5
const WORLD_MAX_HEIGHT = 8
const BOUNDS: RailCameraBounds = {
  minX: -WORLD_HALF_SIZE,
  maxX: WORLD_HALF_SIZE,
  minY: WORLD_MIN_HEIGHT,
  maxY: WORLD_MAX_HEIGHT,
  minZ: -WORLD_HALF_SIZE,
  maxZ: WORLD_HALF_SIZE,
}

function fitFor(aspect: number, target = { x: 0, y: 0, z: 0 }): RailCameraFit {
  return calculateRailCameraFit({
    bounds: BOUNDS,
    overviewTarget: OVERVIEW_TARGET,
    target,
    cameraOffset: CAMERA_OFFSET,
    aspect,
    baseViewSize: BASE_VIEW_SIZE,
    minZoom: MIN_ZOOM,
  })
}

function viewDimensions(aspect: number, zoom: number): { width: number; height: number } {
  const viewSize = BASE_VIEW_SIZE / zoom
  return aspect >= 1
    ? { width: viewSize * aspect, height: viewSize }
    : { width: viewSize, height: viewSize / aspect }
}

function corners(bounds: RailCameraBounds): { x: number; y: number; z: number }[] {
  const result: { x: number; y: number; z: number }[] = []
  for (const x of [bounds.minX, bounds.maxX]) {
    for (const y of [bounds.minY, bounds.maxY]) {
      for (const z of [bounds.minZ, bounds.maxZ]) {
        result.push({ x, y, z })
      }
    }
  }
  return result
}

function dot(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function assertAllCornersDepth(fit: RailCameraFit): void {
  for (const corner of corners(BOUNDS)) {
    const depth = dot(
      {
        x: fit.cameraPosition.x - corner.x,
        y: fit.cameraPosition.y - corner.y,
        z: fit.cameraPosition.z - corner.z,
      },
      fit.direction,
    )
    expect(depth).toBeGreaterThanOrEqual(RAIL_CAMERA_FRONT_CLEARANCE - 1e-8)
    expect(depth).toBeGreaterThan(RAIL_CAMERA_CLIP_NEAR)
    expect(depth).toBeLessThan(RAIL_CAMERA_CLIP_FAR)
  }
}

function assertAllCornersFit(fit: RailCameraFit, aspect: number): void {
  const dimensions = viewDimensions(aspect, fit.overviewZoom)
  for (const corner of corners(BOUNDS)) {
    const relativeToOverview = {
      x: corner.x - OVERVIEW_TARGET.x,
      y: corner.y - OVERVIEW_TARGET.y,
      z: corner.z - OVERVIEW_TARGET.z,
    }
    const projectedX = dot(relativeToOverview, fit.right)
    const projectedY = dot(relativeToOverview, fit.up)
    const depth = dot(
      {
        x: fit.cameraPosition.x - corner.x,
        y: fit.cameraPosition.y - corner.y,
        z: fit.cameraPosition.z - corner.z,
      },
      fit.direction,
    )
    expect(Math.abs(projectedX)).toBeLessThanOrEqual(dimensions.width / 2 + 1e-8)
    expect(Math.abs(projectedY)).toBeLessThanOrEqual(dimensions.height / 2 + 1e-8)
    expect(depth).toBeGreaterThanOrEqual(RAIL_CAMERA_FRONT_CLEARANCE - 1e-8)
    expect(depth).toBeGreaterThan(RAIL_CAMERA_CLIP_NEAR)
    expect(depth).toBeLessThan(RAIL_CAMERA_CLIP_FAR)
  }
}

describe('rail camera fit', () => {
  test.each([
    ['portrait', 390 / 844],
    ['landscape', 844 / 390],
    ['desktop', 1920 / 1200],
  ])('%s overview keeps all eight bounds corners in the frustum', (_name, aspect) => {
    const fit = fitFor(aspect)
    assertAllCornersFit(fit, aspect)
    expect(fit.minDepth).toBeGreaterThan(RAIL_CAMERA_CLIP_NEAR)
    expect(fit.maxDepth).toBeLessThan(fit.fogFar)
    expect(fit.fogFar).toBeLessThan(RAIL_CAMERA_CLIP_FAR)
  })

  test('portrait framing includes both horizontal sides with padding', () => {
    const fit = fitFor(390 / 844)
    const dimensions = viewDimensions(390 / 844, fit.overviewZoom)
    const horizontalProjection = corners(BOUNDS).map((corner) => dot({
      x: corner.x - OVERVIEW_TARGET.x,
      y: corner.y - OVERVIEW_TARGET.y,
      z: corner.z - OVERVIEW_TARGET.z,
    }, fit.right))
    expect(Math.min(...horizontalProjection)).toBeLessThan(-dimensions.width / 2 * 0.9)
    expect(Math.max(...horizontalProjection)).toBeGreaterThan(dimensions.width / 2 * 0.9)
  })

  test('aspect changes recompute the overview zoom', () => {
    const portrait = fitFor(390 / 844)
    const landscape = fitFor(844 / 390)
    expect(portrait.overviewZoom).not.toBeCloseTo(landscape.overviewZoom, 8)
    expect(portrait.requiredWidth).toBeCloseTo(landscape.requiredWidth)
    expect(portrait.requiredHeight).toBeCloseTo(landscape.requiredHeight)
  })

  test('keeps overview framing and fog stable while camera target pans', () => {
    const targets = [
      OVERVIEW_TARGET,
      { x: PAN_LIMIT, y: 0, z: PAN_LIMIT },
      { x: PAN_LIMIT, y: 0, z: -PAN_LIMIT },
      { x: -PAN_LIMIT, y: 0, z: PAN_LIMIT },
      { x: -PAN_LIMIT, y: 0, z: -PAN_LIMIT },
    ]
    const centerFit = fitFor(844 / 390, OVERVIEW_TARGET)
    for (const target of targets) {
      const fit = fitFor(844 / 390, target)
      expect(fit.overviewZoom).toBeCloseTo(centerFit.overviewZoom)
      expect(fit.requiredWidth).toBeCloseTo(centerFit.requiredWidth)
      expect(fit.requiredHeight).toBeCloseTo(centerFit.requiredHeight)
      expect(fit.fogNear).toBeCloseTo(centerFit.fogNear)
      expect(fit.fogFar).toBeCloseTo(centerFit.fogFar)
      assertAllCornersDepth(fit)
    }
    expect(fitFor(844 / 390, { x: PAN_LIMIT, y: 0, z: PAN_LIMIT }).cameraDistance)
      .not.toBeCloseTo(centerFit.cameraDistance)
  })

  test.each([
    { x: 0, y: 0, z: 0 },
    { x: PAN_LIMIT, y: 0, z: 0 },
    { x: -PAN_LIMIT, y: 0, z: 0 },
    { x: 0, y: 0, z: PAN_LIMIT },
    { x: 0, y: 0, z: -PAN_LIMIT },
  ])('keeps the nearest bounds surface in front of near clip at target %o', (target) => {
    const fit = fitFor(844 / 390, target)
    expect(fit.cameraDistance).toBeGreaterThan(RAIL_CAMERA_CLIP_NEAR)
    expect(fit.minDepth).toBeCloseTo(RAIL_CAMERA_FRONT_CLEARANCE)
    expect(fit.maxDepth).toBeGreaterThan(fit.minDepth)
    expect(fit.fogNear).toBeLessThan(fit.fogFar)
  })

  test('does not narrow overview when the natural fit is above MIN_ZOOM', () => {
    const smallBounds: RailCameraBounds = {
      minX: -2,
      maxX: 2,
      minY: -0.5,
      maxY: 2,
      minZ: -2,
      maxZ: 2,
    }
    const fit = calculateRailCameraFit({
      bounds: smallBounds,
      overviewTarget: OVERVIEW_TARGET,
      target: { x: 0, y: 0, z: 0 },
      cameraOffset: CAMERA_OFFSET,
      aspect: 1920 / 1200,
      baseViewSize: BASE_VIEW_SIZE,
      minZoom: MIN_ZOOM,
    })
    expect(fit.fitZoom).toBeGreaterThan(MIN_ZOOM)
    expect(fit.overviewZoom).toBe(MIN_ZOOM)
  })

  test('keeps fog rate below 70 percent at the farthest bounds depth', () => {
    const fit = fitFor(1920 / 1200)
    const fogRate = (fit.maxDepth - fit.fogNear) / (fit.fogFar - fit.fogNear)
    expect(fogRate).toBeLessThanOrEqual(0.7)
  })
})
