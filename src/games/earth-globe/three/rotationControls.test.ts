import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { describe, expect, it } from 'vitest'
import {
  configureGlobeRotationControls,
  HORIZONTAL_DRAG_SCALE,
  MAX_VIEW_LATITUDE_DEGREES,
  VERTICAL_DRAG_SCALE,
} from './rotationControls'

type OrbitControlsInternals = OrbitControls & {
  _handleMouseDownRotate: (event: MouseEvent) => void
  _handleMouseMoveRotate: (event: MouseEvent) => void
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
})
