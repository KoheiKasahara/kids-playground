import { describe, expect, test } from 'vitest'
import { buildPath, curvatureAt, curvatureFrom, curvatureTable, pointAt, stadiumPoints } from './course'

describe('コースの中心線', () => {
  test('まっすぐなコースは、長さと位置・向きが そのまま', () => {
    const path = buildPath([{ x: 0, z: 10 }, { x: 0, z: -20 }], { smooth: false })
    expect(path.length).toBeCloseTo(30, 5)
    const p = pointAt(path, 12)
    expect(p.x).toBeCloseTo(0, 5)
    expect(p.z).toBeCloseTo(-2, 5)
    // -z へ進む向き
    expect(Math.abs(p.heading)).toBeCloseTo(Math.PI, 5)
    // 左へずらすと、-z を向いたときの左（-x）へ
    expect(pointAt(path, 12, 2).x).toBeCloseTo(-2, 5)
  })

  test('はしより外は、はしの向きのまま まっすぐ のばす（スタートの うしろ・ゴールの さき）', () => {
    const path = buildPath([{ x: 0, z: 10 }, { x: 0, z: -20 }], { smooth: false })
    expect(pointAt(path, -3).z).toBeCloseTo(13, 5)
    expect(pointAt(path, 35).z).toBeCloseTo(-25, 5)
  })

  test('競技場の輪は 2本の直線と2つの半円の長さで、1周すると もとの所へ もどる', () => {
    const path = buildPath(stadiumPoints(30, 11), { closed: true, smooth: false })
    expect(path.length).toBeCloseTo(60 + 2 * Math.PI * 11, 0)
    const start = pointAt(path, 0)
    const lap = pointAt(path, path.length)
    expect(lap.x).toBeCloseTo(start.x, 3)
    expect(lap.z).toBeCloseTo(start.z, 3)
    expect(pointAt(path, -1).x).toBeLessThan(start.x)
    // 反時計回り: 左（内側）は輪の中心のほう
    const inner = pointAt(path, 5, 2)
    expect(Math.abs(inner.z)).toBeLessThan(Math.abs(pointAt(path, 5).z))
  })

  test('曲がり具合は、直線で 0、半円で 1/半径', () => {
    const path = buildPath(stadiumPoints(30, 11), { closed: true, smooth: false })
    expect(curvatureAt(path, 5)).toBeCloseTo(0, 3)
    const curve = 15 + (Math.PI * 11) / 2
    // 細かい点列で近似しているので、少しの ずれは ゆるす
    expect(Math.abs(curvatureAt(path, curve) - 1 / 11)).toBeLessThan(0.01)
    const table = curvatureTable(path)
    expect(Math.abs(curvatureFrom(table, curve) - 1 / 11)).toBeLessThan(0.01)
    expect(Math.abs(curvatureFrom(table, curve + path.length) - 1 / 11)).toBeLessThan(0.01)
  })

  test('なめらかにつなぐと、制御点を通り、つなぎ目で向きが飛ばない', () => {
    const points = [{ x: 0, z: 20 }, { x: 6, z: 8 }, { x: -6, z: -8 }, { x: 0, z: -20 }]
    const path = buildPath(points)
    let last = pointAt(path, 0).heading
    for (let s = 0.5; s < path.length; s += 0.5) {
      const h = pointAt(path, s).heading
      expect(Math.abs(Math.atan2(Math.sin(h - last), Math.cos(h - last)))).toBeLessThan(0.2)
      last = h
    }
    const end = pointAt(path, path.length)
    expect(end.x).toBeCloseTo(0, 3)
    expect(end.z).toBeCloseTo(-20, 3)
  })
})
