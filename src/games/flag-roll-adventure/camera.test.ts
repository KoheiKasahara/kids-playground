import { describe, expect, it } from 'vitest'
import { AREA_COLUMN_STEP, AREA_HEIGHT } from './adventurePhysics'
import {
  cameraPositionForArea,
  easeInOutCubic,
  interpolateCameraPosition,
} from './camera'

describe('camera', () => {
  it('エリアidからoriginを使ったカメラ位置を返す', () => {
    expect(cameraPositionForArea('sky')).toEqual({ x: AREA_COLUMN_STEP, y: 0 })
    expect(cameraPositionForArea('forest')).toEqual({ x: AREA_COLUMN_STEP, y: AREA_HEIGHT })
    expect(cameraPositionForArea('cave')).toEqual({ x: 0, y: AREA_HEIGHT * 2 })
    expect(cameraPositionForArea('river')).toEqual({ x: AREA_COLUMN_STEP * 2, y: AREA_HEIGHT * 2 })
    expect(cameraPositionForArea('cloud')).toEqual({ x: AREA_COLUMN_STEP, y: AREA_HEIGHT * 3 })
    expect(cameraPositionForArea('goal')).toEqual({ x: AREA_COLUMN_STEP, y: AREA_HEIGHT * 4 })
  })

  it('easeInOutCubicはt=0/0.5/1で端点と中央を返す', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(0.5)).toBe(0.5)
    expect(easeInOutCubic(1)).toBe(1)
  })

  it('イージング値はtの増加に対して単調に増え、補間の端点を保つ', () => {
    const samples = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map(easeInOutCubic)
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeGreaterThanOrEqual(samples[index - 1] ?? 0)
    }

    const from = { x: 0, y: 0 }
    const to = { x: 0, y: AREA_HEIGHT }
    expect(interpolateCameraPosition(from, to, 0)).toEqual(from)
    expect(interpolateCameraPosition(from, to, 1)).toEqual(to)
    expect(interpolateCameraPosition(from, to, 0.5)).toEqual({ x: 0, y: AREA_HEIGHT / 2 })

    const horizontalFrom = { x: AREA_COLUMN_STEP, y: AREA_HEIGHT }
    const horizontalTo = { x: 0, y: AREA_HEIGHT * 2 }
    expect(interpolateCameraPosition(horizontalFrom, horizontalTo, 0.5)).toEqual({
      x: AREA_COLUMN_STEP / 2,
      y: AREA_HEIGHT * 1.5,
    })
  })
})
