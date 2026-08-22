import { describe, expect, it } from 'vitest'
import { cellToWorld } from './mazeGrid'
import { FLOOR_THICKNESS, TERRAIN_RAIL_THICKNESS } from './mazePhysics'
import { resolveTerrain } from './mazeTerrain'

describe('resolveTerrain', () => {
  it('slabとroundedBarをセル座標からワールド座標へ解決する', () => {
    const cellSize = 2
    const terrain = resolveTerrain([
      {
        kind: 'slab',
        id: 'platform',
        cell: { column: 2.5, row: 3 },
        widthCells: 2,
        depthCells: 3,
        top: 4,
        bottom: 1,
        style: 'step',
      },
      {
        kind: 'roundedBar',
        id: 'nose',
        cell: { column: 1, row: 2.5 },
        widthCells: 2.5,
        y: 3,
        radius: 0.14,
      },
    ], 7, 9, cellSize)

    const slabCenter = cellToWorld(2.5, 3, 7, 9, cellSize)
    expect(terrain.boxes).toEqual([
      {
        id: 'platform',
        x: slabCenter.x,
        y: 2.5,
        z: slabCenter.z,
        width: 4,
        height: 3,
        depth: 6,
        rotationX: 0,
        style: 'step',
      },
    ])

    const barCenter = cellToWorld(1, 2.5, 7, 9, cellSize)
    expect(terrain.bars).toEqual([
      {
        id: 'nose',
        x: barCenter.x,
        y: 3,
        z: barCenter.z,
        length: 5,
        radius: 0.14,
        style: 'platform',
      },
    ])
  })

  it('slabのrailsは指定した辺だけにguard boxとして作る', () => {
    const cellSize = 2
    const terrain = resolveTerrain([
      {
        kind: 'slab',
        id: 'mesa',
        cell: { column: 3, row: 4 },
        widthCells: 4,
        depthCells: 3,
        top: 2,
        rails: ['left', 'front'],
      },
    ], 7, 9, cellSize)

    const center = cellToWorld(3, 4, 7, 9, cellSize)
    expect(terrain.boxes.map((box) => box.id)).toEqual([
      'mesa',
      'mesa-rail-left',
      'mesa-rail-front',
    ])
    expect(terrain.boxes.find((box) => box.id === 'mesa-rail-left')).toMatchObject({
      x: center.x - 4,
      y: 2.45,
      z: center.z,
      width: TERRAIN_RAIL_THICKNESS,
      depth: 6,
      style: 'guard',
    })
    expect(terrain.boxes.find((box) => box.id === 'mesa-rail-front')).toMatchObject({
      x: center.x,
      y: 2.45,
      z: center.z + 3,
      width: 8,
      depth: TERRAIN_RAIL_THICKNESS,
      style: 'guard',
    })
    expect(terrain.boxes.some((box) => box.id === 'mesa-rail-right')).toBe(false)
    expect(terrain.boxes.some((box) => box.id === 'mesa-rail-back')).toBe(false)
  })

  it('rampの上面を両端の指定高へ合わせ、+Zへ下る回転を付ける', () => {
    const cellSize = 2
    const horizontalDepth = 4 * cellSize
    const terrain = resolveTerrain([
      {
        kind: 'ramp',
        id: 'slide',
        cell: { column: 3, row: 4 },
        widthCells: 3,
        depthCells: 4,
        topStart: 5,
        topEnd: 1,
        thickness: 0.5,
        rails: ['right'],
        style: 'slide',
      },
    ], 7, 9, cellSize)

    const ramp = terrain.boxes.find((box) => box.id === 'slide')!
    const expectedRotation = Math.atan2(4, horizontalDepth)
    expect(ramp.rotationX).toBeCloseTo(expectedRotation, 8)
    expect(ramp.rotationX).toBeGreaterThan(0)
    expect(ramp.depth).toBeCloseTo(horizontalDepth / Math.cos(expectedRotation), 8)

    // 回転後の上面の式で見ることで、厚みを含めても入力どおりの両端高になることを確かめる。
    const topAt = (z: number) => (
      ramp.y +
      ramp.height / (2 * Math.cos(ramp.rotationX)) -
      Math.tan(ramp.rotationX) * (z - ramp.z)
    )
    expect(topAt(ramp.z - horizontalDepth / 2)).toBeCloseTo(5, 8)
    expect(topAt(ramp.z + horizontalDepth / 2)).toBeCloseTo(1, 8)

    const rail = terrain.boxes.find((box) => box.id === 'slide-rail-right')
    expect(rail).toMatchObject({ rotationX: ramp.rotationX, style: 'guard' })
  })

  it('slabのbottomを省略すると地面の床と重なる既定値を使う', () => {
    const terrain = resolveTerrain([
      {
        kind: 'slab',
        id: 'grounded',
        cell: { column: 1, row: 1 },
        widthCells: 1,
        depthCells: 1,
        top: 2,
      },
    ], 3, 3, 2)

    const slab = terrain.boxes[0]!
    expect(slab.height).toBeCloseTo(2 + FLOOR_THICKNESS, 8)
    expect(slab.y).toBeCloseTo((2 - FLOOR_THICKNESS) / 2, 8)
  })
})
