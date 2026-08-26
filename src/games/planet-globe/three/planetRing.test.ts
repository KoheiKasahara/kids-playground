import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { applyRadialRingUv, axialTiltRotationZ, createRingMesh } from './planetRing'
import { DEFAULT_VIEW_DIRECTION } from './planetCamera'
import { celestialBodies } from '../data/celestialBodies'

describe('applyRadialRingUv', () => {
  const innerRadius = 10
  const outerRadius = 20

  it('全頂点の uv.x が 0..1 に収まり、uv.y は常に 0.5 になる', () => {
    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 32, 1)
    applyRadialRingUv(geometry, innerRadius, outerRadius)

    const uv = geometry.getAttribute('uv')
    for (let i = 0; i < uv.count; i += 1) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0)
      expect(uv.getX(i)).toBeLessThanOrEqual(1)
      expect(uv.getY(i)).toBeCloseTo(0.5)
    }
  })

  it('内周の頂点は uv.x が 0 付近、外周の頂点は 1 付近になる', () => {
    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 32, 1)
    applyRadialRingUv(geometry, innerRadius, outerRadius)

    const position = geometry.getAttribute('position')
    const uv = geometry.getAttribute('uv')

    let minRadius = Number.POSITIVE_INFINITY
    let maxRadius = 0
    let uvAtMinRadius = 0
    let uvAtMaxRadius = 0

    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i)
      const y = position.getY(i)
      const radius = Math.sqrt(x * x + y * y)
      if (radius < minRadius) {
        minRadius = radius
        uvAtMinRadius = uv.getX(i)
      }
      if (radius > maxRadius) {
        maxRadius = radius
        uvAtMaxRadius = uv.getX(i)
      }
    }

    expect(uvAtMinRadius).toBeCloseTo(0, 1)
    expect(uvAtMaxRadius).toBeCloseTo(1, 1)
  })
})

describe('既定視点から見た輪の姿勢', () => {
  /**
   * usePlanetEngine と同じ組み立て（tiltGroup > ringMesh）で輪のワールド法線を求め、
   * 既定視点との角度から「輪がどれだけ開いて見えるか」を返す。
   * 0 なら視線が輪の平面に含まれ、輪が線に潰れて見える状態。
   */
  function ringOpennessAtDefaultView(body: (typeof celestialBodies)[number]): number {
    const ring = body.ring
    if (ring === undefined) throw new Error('輪を持たない天体では計算できない')

    const tiltGroup = new THREE.Group()
    tiltGroup.rotation.z = axialTiltRotationZ(body)
    const ringMesh = createRingMesh(body, ring)
    tiltGroup.add(ringMesh)
    tiltGroup.updateMatrixWorld(true)

    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(
      ringMesh.getWorldQuaternion(new THREE.Quaternion()),
    )
    const view = new THREE.Vector3(
      DEFAULT_VIEW_DIRECTION.x,
      DEFAULT_VIEW_DIRECTION.y,
      DEFAULT_VIEW_DIRECTION.z,
    ).normalize()

    return Math.abs(view.dot(normal))
  }

  it.each(celestialBodies.filter((body) => body.ring !== undefined))(
    '$id: 既定視点で輪がエッジオン（線）に潰れない',
    (body) => {
      // 真正面(0,0,1)から見ると軸傾き(Zまわり)の輪は開き0になるため、
      // 既定視点は必ず輪が開いて見える方向であることを保証する。
      const openness = ringOpennessAtDefaultView(body)
      expect(openness).toBeGreaterThan(Math.sin((12 * Math.PI) / 180))
    },
  )
})
