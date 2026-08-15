import { describe, expect, it } from 'vitest'
import { AREA_COLUMN_STEP, AREA_HEIGHT, AREA_WIDTH, PORTAL_FLOOR_HEIGHT } from './adventurePhysics'
import { areaGroundRects, worldSize } from './adventureGeometry'
import { AREAS } from './data/areas'
import type { AdventureArea, AreaExit } from './types'

function makeExit(id: string, x: number, width: number): AreaExit {
  return {
    id,
    kind: 'hole',
    x,
    y: AREA_HEIGHT - 52,
    width,
    height: 40,
    to: 'next',
    toEntry: 'next-entry',
  }
}

function makeArea(exits: readonly AreaExit[]): AdventureArea {
  return {
    id: 'test-area',
    nameJa: 'テスト',
    theme: 'sky',
    origin: { x: 0, y: 0 },
    objects: [],
    entries: [],
    exits,
  }
}

describe('adventure geometry', () => {
  it('全エリアがoriginから算出したworld矩形の中に収まる', () => {
    const size = worldSize(AREAS)

    expect(size).toEqual({ width: AREA_COLUMN_STEP * 2 + AREA_WIDTH, height: AREA_HEIGHT * 5 })
    for (const area of AREAS) {
      expect(area.origin.x).toBeGreaterThanOrEqual(0)
      expect(area.origin.y).toBeGreaterThanOrEqual(0)
      expect(area.origin.x + AREA_WIDTH).toBeLessThanOrEqual(size.width)
      expect(area.origin.y + AREA_HEIGHT).toBeLessThanOrEqual(size.height)
    }

    const horizontallyPlacedAreas = AREAS.slice(0, 2).map((area, index) => ({
      ...area,
      origin: { x: index * AREA_COLUMN_STEP, y: index * AREA_HEIGHT },
    }))
    const horizontallyPlacedSize = worldSize(horizontallyPlacedAreas)
    expect(horizontallyPlacedSize).toEqual({
      width: AREA_COLUMN_STEP + AREA_WIDTH,
      height: AREA_HEIGHT * 2,
    })
    for (const area of horizontallyPlacedAreas) {
      expect(area.origin.x + AREA_WIDTH).toBeLessThanOrEqual(horizontallyPlacedSize.width)
      expect(area.origin.y + AREA_HEIGHT).toBeLessThanOrEqual(horizontallyPlacedSize.height)
    }
  })

  it('出口1つのエリアでは従来どおり2枚の地面を返す', () => {
    const area = AREAS.find((candidate) => candidate.id === 'sky')
    expect(area).toBeDefined()
    if (!area) return
    const exit = area.exits[0]
    expect(exit).toBeDefined()
    if (!exit) return

    const top = AREA_HEIGHT - PORTAL_FLOOR_HEIGHT
    const openingLeft = exit.x - exit.width / 2
    const openingRight = exit.x + exit.width / 2
    expect(areaGroundRects(area)).toEqual([
      { left: 0, top, width: openingLeft, height: PORTAL_FLOOR_HEIGHT },
      { left: openingRight, top, width: AREA_WIDTH - openingRight, height: PORTAL_FLOOR_HEIGHT },
    ])
  })

  it('出口2つをx昇順に並べ、左端・間・右端の3枚に分ける', () => {
    const area = makeArea([
      makeExit('right', 360, 80),
      makeExit('left', 100, 80),
    ])
    const top = AREA_HEIGHT - PORTAL_FLOOR_HEIGHT
    const rects = areaGroundRects(area)

    expect(rects).toEqual([
      { left: 0, top, width: 60, height: PORTAL_FLOOR_HEIGHT },
      { left: 140, top, width: 180, height: PORTAL_FLOOR_HEIGHT },
      { left: 400, top, width: 80, height: PORTAL_FLOOR_HEIGHT },
    ])

    const openingWidth = area.exits.reduce((sum, exit) => sum + exit.width, 0)
    const groundWidth = rects.reduce((sum, rect) => sum + rect.width, 0)
    expect(groundWidth + openingWidth).toBe(AREA_WIDTH)
  })

  it('出口0個でカップ無しのエリアは地面を作らない', () => {
    expect(areaGroundRects(makeArea([]))).toEqual([])
  })

  it('端に接する開口や重なる開口から幅0以下の矩形を返さない', () => {
    const touchingEdge = areaGroundRects(makeArea([makeExit('edge', 70, 140)]))
    const overlapping = areaGroundRects(makeArea([
      makeExit('left', 120, 140),
      makeExit('right', 160, 140),
    ]))

    expect(touchingEdge).toHaveLength(1)
    expect(overlapping.every((rect) => rect.width > 0)).toBe(true)
    expect(touchingEdge.every((rect) => rect.width > 0)).toBe(true)
  })
})
