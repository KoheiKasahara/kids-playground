import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  applyRadialRingUv,
  axialTiltRotationZ,
  createRingMeshes,
  ringOuterRadiusRatio,
  sampleRingBands,
} from './planetRing'
import { viewDirectionOf } from './planetCamera'
import { celestialBodies } from '../data/celestialBodies'
import type { RingSpec } from '../types'

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

describe('sampleRingBands', () => {
  const bands = [
    { at: 0, color: '#000000', opacity: 0 },
    { at: 0.5, color: '#ffffff', opacity: 1 },
    { at: 1, color: '#808080', opacity: 0.5 },
  ] as const

  it('境界(at)そのものでは、その帯の色とopacityをそのまま返す', () => {
    expect(sampleRingBands(bands, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 })
    expect(sampleRingBands(bands, 0.5)).toEqual({ r: 255, g: 255, b: 255, a: 1 })
  })

  it('範囲外は両端の値へクランプする', () => {
    expect(sampleRingBands(bands, -1)).toEqual({ r: 0, g: 0, b: 0, a: 0 })
    expect(sampleRingBands(bands, 2).a).toBeCloseTo(0.5)
  })

  it('境界の中間では線形補間した値を返す', () => {
    const mid = sampleRingBands(bands, 0.25)
    expect(mid.r).toBeCloseTo(127.5, 0)
    expect(mid.a).toBeCloseTo(0.5, 5)
  })

  it('エンケ間隙のようなopacityの落ち込みは、両隣より明確に低いalphaになる', () => {
    const aRingBands = [
      { at: 0, color: '#d3c4a4', opacity: 0.7 },
      { at: 0.74, color: '#d6c7a7', opacity: 0.74 },
      { at: 0.79, color: '#b5a68a', opacity: 0.12 },
      { at: 0.84, color: '#d4c5a5', opacity: 0.72 },
      { at: 1, color: '#c3b394', opacity: 0.4 },
    ] as const
    const before = sampleRingBands(aRingBands, 0.76)
    const gap = sampleRingBands(aRingBands, 0.79)
    const after = sampleRingBands(aRingBands, 0.82)

    expect(gap.a).toBeLessThan(before.a * 0.5)
    expect(gap.a).toBeLessThan(after.a * 0.5)
  })
})

describe('ringOuterRadiusRatio', () => {
  it('segmentsの中で最大のouterRadiusRatioを返す', () => {
    const ring: RingSpec = {
      segments: [
        { id: 'a', innerRadiusRatio: 1.2, outerRadiusRatio: 1.5, bands: [{ at: 0, color: '#fff', opacity: 1 }] },
        { id: 'b', innerRadiusRatio: 1.6, outerRadiusRatio: 2.3, bands: [{ at: 0, color: '#fff', opacity: 1 }] },
      ],
    }
    expect(ringOuterRadiusRatio(ring)).toBe(2.3)
  })
})

describe('createRingMeshes', () => {
  const saturn = celestialBodies.find((body) => body.id === 'saturn')

  it('土星のring.segmentsと同じ数のメッシュを作る', () => {
    expect(saturn).toBeDefined()
    if (saturn === undefined || saturn.ring === undefined) return
    const meshes = createRingMeshes(saturn, saturn.ring)
    expect(meshes).toHaveLength(saturn.ring.segments.length)
  })

  it('セグメントは半径方向に重ならない(内側→外側の順で隙間なく並ぶか、すき間が空く)', () => {
    expect(saturn).toBeDefined()
    if (saturn === undefined || saturn.ring === undefined) return
    const sorted = [...saturn.ring.segments].sort((a, b) => a.innerRadiusRatio - b.innerRadiusRatio)
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].innerRadiusRatio).toBeGreaterThanOrEqual(sorted[i - 1].outerRadiusRatio)
    }
  })

  it('B環とA環の間にカッシーニ間隙(幾何的なすき間)が存在する', () => {
    expect(saturn).toBeDefined()
    if (saturn === undefined || saturn.ring === undefined) return
    const bRing = saturn.ring.segments.find((segment) => segment.id === 'b-ring')
    const aRing = saturn.ring.segments.find((segment) => segment.id === 'a-ring')
    expect(bRing).toBeDefined()
    expect(aRing).toBeDefined()
    if (bRing === undefined || aRing === undefined) return
    expect(aRing.innerRadiusRatio).toBeGreaterThan(bRing.outerRadiusRatio)
  })
})

describe('既定/上書き視点から見た輪の姿勢', () => {
  /**
   * usePlanetEngine と同じ組み立て(tiltGroup > ringMesh)で輪のワールド法線を求め、
   * 天体ごとの視点(`viewDirectionOf`)との角度から「輪がどれだけ開いて見えるか」を返す。
   * 0 なら視線が輪の平面に含まれ、輪が線に潰れて見える状態。
   */
  function ringOpennessAtView(body: (typeof celestialBodies)[number]): number {
    const ring = body.ring
    if (ring === undefined) throw new Error('輪を持たない天体では計算できない')

    const tiltGroup = new THREE.Group()
    tiltGroup.rotation.z = axialTiltRotationZ(body)
    const [ringMesh] = createRingMeshes(body, ring)
    tiltGroup.add(ringMesh)
    tiltGroup.updateMatrixWorld(true)

    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(
      ringMesh.getWorldQuaternion(new THREE.Quaternion()),
    )
    const direction = viewDirectionOf(body)
    const view = new THREE.Vector3(direction.x, direction.y, direction.z).normalize()

    return Math.abs(view.dot(normal))
  }

  it.each(celestialBodies.filter((body) => body.ring !== undefined))(
    '$id: 天体ごとの視点で輪がエッジオン(線)に潰れない',
    (body) => {
      const openness = ringOpennessAtView(body)
      expect(openness).toBeGreaterThan(Math.sin((12 * Math.PI) / 180))
    },
  )
})
