import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { describe, expect, it } from 'vitest'
import {
  configureGlobeRotationControls,
  HORIZONTAL_DRAG_SCALE,
  MAX_VIEW_LATITUDE_DEGREES,
  VERTICAL_DRAG_SCALE,
  VERTICAL_DRAG_SCALE_NEAR_POLE,
  VERTICAL_SOFT_LIMIT_START_DEGREES,
} from './rotationControls'

type OrbitControlsInternals = OrbitControls & {
  _handleMouseDownRotate: (event: MouseEvent) => void
  _handleMouseMoveRotate: (event: MouseEvent) => void
  _sphericalDelta: THREE.Spherical
  state: number
}

function createControls() {
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 200 })
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 0, 300)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = false
  controls.update()
  return controls as OrbitControlsInternals
}

function createDampedControls() {
  const controls = createControls()
  controls.enableDamping = true
  controls.dampingFactor = 0.22
  return controls
}

function setPolarAngleDegrees(controls: OrbitControlsInternals, latitudeDegrees: number) {
  const polarAngle = THREE.MathUtils.degToRad(90 - latitudeDegrees)
  const camera = controls.object as THREE.PerspectiveCamera
  camera.position.setFromSphericalCoords(300, polarAngle, 0)
  controls.update()
}

function expectedVerticalDragScaleFor(latitudeDegrees: number): number {
  const distanceFromEquator = Math.min(Math.abs(latitudeDegrees), MAX_VIEW_LATITUDE_DEGREES)
  if (distanceFromEquator <= VERTICAL_SOFT_LIMIT_START_DEGREES) return VERTICAL_DRAG_SCALE

  const softRange = MAX_VIEW_LATITUDE_DEGREES - VERTICAL_SOFT_LIMIT_START_DEGREES
  const progress = (distanceFromEquator - VERTICAL_SOFT_LIMIT_START_DEGREES) / softRange
  return THREE.MathUtils.lerp(VERTICAL_DRAG_SCALE, VERTICAL_DRAG_SCALE_NEAR_POLE, progress)
}

function rotateFromOrigin(controls: OrbitControlsInternals, x: number, y: number) {
  controls._handleMouseDownRotate(new MouseEvent('pointerdown', { clientX: 0, clientY: 0 }))
  controls._handleMouseMoveRotate(new MouseEvent('pointermove', { clientX: x, clientY: y }))
  return {
    azimuth: controls.getAzimuthalAngle(),
    polar: controls.getPolarAngle(),
  }
}

describe('globe rotation controls', () => {
  it('reduces horizontal and vertical drag by separate child-friendly factors', () => {
    const standard = createControls()
    const adjusted = createControls()
    configureGlobeRotationControls(adjusted)

    const standardHorizontal = rotateFromOrigin(standard, 100, 0)
    const adjustedHorizontal = rotateFromOrigin(adjusted, 100, 0)
    expect(Math.abs(adjustedHorizontal.azimuth / standardHorizontal.azimuth))
      .toBeCloseTo(HORIZONTAL_DRAG_SCALE)

    // 極クランプに当たらない移動量で、純粋な縦係数を確認する。
    const standardVertical = rotateFromOrigin(createControls(), 0, 30)
    const adjustedVertical = rotateFromOrigin(adjusted, 0, 30)
    expect(Math.abs((adjustedVertical.polar - Math.PI / 2) / (standardVertical.polar - Math.PI / 2)))
      .toBeCloseTo(VERTICAL_DRAG_SCALE)

    standard.dispose()
    adjusted.dispose()
  })

  it('keeps the view away from both poles without restricting yaw', () => {
    const controls = createControls()
    configureGlobeRotationControls(controls)

    expect(controls.minPolarAngle).toBeCloseTo(THREE.MathUtils.degToRad(90 - MAX_VIEW_LATITUDE_DEGREES))
    expect(controls.maxPolarAngle).toBeCloseTo(THREE.MathUtils.degToRad(90 + MAX_VIEW_LATITUDE_DEGREES))

    rotateFromOrigin(controls, 0, 1_000)
    expect(controls.getPolarAngle()).toBeCloseTo(controls.minPolarAngle)

    const azimuthAtLimit = controls.getAzimuthalAngle()
    rotateFromOrigin(controls, 100, 0)
    expect(controls.getAzimuthalAngle()).not.toBeCloseTo(azimuthAtLimit)

    controls.dispose()
  })

  it('tapers vertical drag sensitivity down as latitude approaches the limit', () => {
    const nearPoleLatitudeDegrees = 60

    const standard = createControls()
    const adjusted = createControls()
    configureGlobeRotationControls(adjusted)

    setPolarAngleDegrees(standard, nearPoleLatitudeDegrees)
    setPolarAngleDegrees(adjusted, nearPoleLatitudeDegrees)
    const polarBefore = adjusted.getPolarAngle()
    expect(standard.getPolarAngle()).toBeCloseTo(polarBefore)

    const standardResult = rotateFromOrigin(standard, 0, 3)
    const adjustedResult = rotateFromOrigin(adjusted, 0, 3)

    const expectedScale = expectedVerticalDragScaleFor(nearPoleLatitudeDegrees)
    expect(expectedScale).toBeLessThan(VERTICAL_DRAG_SCALE)

    const standardDeltaPolar = standardResult.polar - polarBefore
    const adjustedDeltaPolar = adjustedResult.polar - polarBefore
    expect(Math.abs(adjustedDeltaPolar / standardDeltaPolar)).toBeCloseTo(expectedScale, 2)

    standard.dispose()
    adjusted.dispose()
  })

  it('weakens damped inertia of vertical rotation near the pole compared to the equator', () => {
    const nearPoleLatitudeDegrees = 60

    const equatorControls = createDampedControls()
    const nearPoleControls = createDampedControls()
    configureGlobeRotationControls(equatorControls)
    configureGlobeRotationControls(nearPoleControls)
    setPolarAngleDegrees(nearPoleControls, nearPoleLatitudeDegrees)

    const equatorPolarBefore = equatorControls.getPolarAngle()
    const nearPolePolarBefore = nearPoleControls.getPolarAngle()

    // ドラッグ入力を介さず、慣性のみが働く区間(state === NONE)を直接再現する。
    equatorControls._sphericalDelta.phi = 0.05
    nearPoleControls._sphericalDelta.phi = 0.05
    equatorControls.update()
    nearPoleControls.update()

    const equatorChange = Math.abs(equatorControls.getPolarAngle() - equatorPolarBefore)
    const nearPoleChange = Math.abs(nearPoleControls.getPolarAngle() - nearPolePolarBefore)

    expect(nearPoleChange).toBeLessThan(equatorChange)
    expect(nearPoleChange / equatorChange).toBeCloseTo(
      expectedVerticalDragScaleFor(nearPoleLatitudeDegrees) / VERTICAL_DRAG_SCALE,
      2,
    )

    equatorControls.dispose()
    nearPoleControls.dispose()
  })
})
