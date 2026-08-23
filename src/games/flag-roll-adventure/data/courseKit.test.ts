import { describe, expect, it } from 'vitest'
import { pinRow, staggeredPinRows, vRail, wallKicker, zigzagRails } from './courseKit'

describe('コース配置ヘルパー', () => {
  it('pinRowは個数・中央間隔・id採番をそろえる', () => {
    const row = pinRow({ idPrefix: 'test-pin', startX: 40, y: 120, count: 4, spacing: 80, radius: 10 })

    expect(row).toHaveLength(4)
    expect(row.map((pin) => pin.x)).toEqual([40, 120, 200, 280])
    expect(row.map((pin) => pin.id)).toEqual(['test-pin-1', 'test-pin-2', 'test-pin-3', 'test-pin-4'])
    expect(row.every((pin) => pin.y === 120 && pin.radius === 10)).toBe(true)
  })

  it('staggeredPinRowsは行ごとの高さと横ずれを生成する', () => {
    const pins = staggeredPinRows({
      idPrefix: 'staggered',
      startX: 40,
      firstY: 150,
      rowCount: 3,
      rowSpacing: 70,
      rowOffset: 40,
      count: 3,
      spacing: 80,
      radius: 10,
    })

    expect(pins).toHaveLength(9)
    expect(pins.slice(0, 3).map((pin) => pin.x)).toEqual([40, 120, 200])
    expect(pins.slice(3, 6).map((pin) => pin.x)).toEqual([80, 160, 240])
    expect(pins.map((pin) => pin.y)).toEqual([150, 150, 150, 220, 220, 220, 290, 290, 290])
    expect(pins.map((pin) => pin.id)).toEqual([
      'staggered-row-1-1',
      'staggered-row-1-2',
      'staggered-row-1-3',
      'staggered-row-2-1',
      'staggered-row-2-2',
      'staggered-row-2-3',
      'staggered-row-3-1',
      'staggered-row-3-2',
      'staggered-row-3-3',
    ])
  })

  it('vRailは左右2本を同じ高さに置く', () => {
    const rails = vRail({
      idPrefix: 'funnel',
      centerX: 240,
      apexY: 360,
      span: 100,
      rise: 80,
      throatWidth: 70,
      width: 18,
      height: 8,
    })

    expect(rails).toHaveLength(2)
    expect(rails.map((rail) => rail.id)).toEqual(['funnel-left', 'funnel-right'])
    expect(rails[0]?.y).toBe(rails[1]?.y)
    expect(rails[0]?.angle).toBeCloseTo(-(rails[1]?.angle ?? 0))
    expect(rails.every((rail) => rail.width === 18 && rail.height === 8)).toBe(true)
  })

  it('zigzagRailsは指定間隔で左右を交互に切り替える', () => {
    const rails = zigzagRails({
      idPrefix: 'branch',
      centerX: 240,
      firstY: 160,
      count: 5,
      rowSpacing: 55,
      span: 90,
      rise: 24,
      width: 18,
      height: 8,
    })

    expect(rails).toHaveLength(5)
    expect(rails.map((rail) => rail.id)).toEqual(['branch-1', 'branch-2', 'branch-3', 'branch-4', 'branch-5'])
    expect(rails.map((rail) => rail.y)).toEqual([160, 215, 270, 325, 380])
    expect(rails[0]?.x).toBe(195)
    expect(rails[1]?.x).toBe(285)
    expect(rails[0]?.angle).toBeCloseTo(-(rails[1]?.angle ?? 0))
  })

  it('wallKickerは回転後の外接半径から中心xを計算する', () => {
    const left = wallKicker({ id: 'kicker-left', side: 'left', y: 152 })
    const right = wallKicker({ id: 'kicker-right', side: 'right', y: 152 })
    const extent = Math.cos(0.34) * 42 + Math.sin(0.34) * 6

    expect(left.angle).toBeCloseTo(0.34)
    expect(right.angle).toBeCloseTo(-0.34)
    expect(left.x).toBeCloseTo(4 + extent)
    expect(right.x).toBeCloseTo(480 - 4 - extent)
    expect(left.width).toBe(84)
    expect(left.height).toBe(12)
  })
})
