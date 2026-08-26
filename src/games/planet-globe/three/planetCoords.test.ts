import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { latToV, lonToU, rotationYFacing } from './planetCoords'

describe('lonToU', () => {
  it('lon=0 は u=0.5(テクスチャ中央)', () => {
    expect(lonToU(0)).toBe(0.5)
  })

  it('180度と-180度は同じ点(継ぎ目)を指す', () => {
    expect(lonToU(180)).toBe(lonToU(-180))
  })

  it('東経(正)ほどuが大きくなる', () => {
    expect(lonToU(90)).toBeCloseTo(0.75, 10)
    expect(lonToU(-90)).toBeCloseTo(0.25, 10)
  })

  it('範囲外の値も周期的にwrapする', () => {
    expect(lonToU(360)).toBeCloseTo(lonToU(0), 10)
    expect(lonToU(-360)).toBeCloseTo(lonToU(0), 10)
  })
})

describe('latToV', () => {
  it('北極(+90)がv=0、南極(-90)がv=1', () => {
    expect(latToV(90)).toBe(0)
    expect(latToV(-90)).toBe(1)
  })

  it('赤道(0)はv=0.5', () => {
    expect(latToV(0)).toBeCloseTo(0.5, 10)
  })

  it('範囲外はクランプする', () => {
    expect(latToV(120)).toBe(0)
    expect(latToV(-120)).toBe(1)
  })
})

describe('rotationYFacing', () => {
  it('u=0.25で回転0になる', () => {
    expect(rotationYFacing(0.25)).toBeCloseTo(0, 10)
  })

  it('u=0で回転がπ/2になる', () => {
    expect(rotationYFacing(0)).toBeCloseTo(Math.PI / 2, 10)
  })

  it.each([0, 0.1, 0.25, 0.4, 0.6, 0.83, 1])(
    'u=%f: rotationYFacingを適用するとd(u)=(-cos2πu,0,sin2πu)が+Zを向く(回帰)',
    (u) => {
      const angle = rotationYFacing(u)
      const d = new THREE.Vector3(-Math.cos(2 * Math.PI * u), 0, Math.sin(2 * Math.PI * u))
      const rotated = d.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)

      expect(rotated.x).toBeCloseTo(0, 5)
      expect(rotated.y).toBeCloseTo(0, 5)
      expect(rotated.z).toBeCloseTo(1, 5)
    },
  )
})
