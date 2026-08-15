import { describe, expect, it } from 'vitest'
import {
  AREA_ENTRY_CLEARANCE,
  AREA_HEIGHT,
  AREA_WIDTH,
  BALL_RADIUS,
} from '../adventurePhysics'
import { AREAS, findArea, START_AREA_ID } from './areas'

function objectExtents(object: (typeof AREAS)[number]['objects'][number]) {
  if (object.kind === 'pin') return { x: object.radius, y: object.radius }
  const halfWidth = object.width / 2
  const halfHeight = object.height / 2
  const cosine = Math.abs(Math.cos(object.angle))
  const sine = Math.abs(Math.sin(object.angle))
  return {
    x: cosine * halfWidth + sine * halfHeight,
    y: sine * halfWidth + cosine * halfHeight,
  }
}

describe('Phase 1 area data', () => {
  it('エリアidに重複がない', () => {
    const ids = AREAS.map((area) => area.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('すべてのexit.toが実在エリアかnullである', () => {
    const ids = new Set(AREAS.map((area) => area.id))
    for (const area of AREAS) {
      for (const exit of area.exits) {
        expect(exit.to === null || ids.has(exit.to)).toBe(true)
      }
    }
  })

  it('START_AREA_IDが実在し、スタートから全エリアへ到達できる', () => {
    expect(findArea(START_AREA_ID)).toBeDefined()

    const visited = new Set<string>([START_AREA_ID])
    const queue = [START_AREA_ID]
    while (queue.length > 0) {
      const areaId = queue.shift()
      if (!areaId) continue
      const area = findArea(areaId)
      if (!area) continue
      for (const exit of area.exits) {
        if (exit.to !== null && !visited.has(exit.to)) {
          visited.add(exit.to)
          queue.push(exit.to)
        }
      }
    }

    expect(visited).toEqual(new Set(AREAS.map((area) => area.id)))
  })

  it('to:nullのゴール出口が少なくとも1つある', () => {
    expect(AREAS.some((area) => area.exits.some((exit) => exit.to === null))).toBe(true)
  })

  it('全オブジェクトが回転後もエリア矩形の中に収まる', () => {
    for (const area of AREAS) {
      for (const object of area.objects) {
        const extents = objectExtents(object)
        expect(object.x - extents.x).toBeGreaterThanOrEqual(0)
        expect(object.x + extents.x).toBeLessThanOrEqual(AREA_WIDTH)
        expect(object.y - extents.y).toBeGreaterThanOrEqual(0)
        expect(object.y + extents.y).toBeLessThanOrEqual(AREA_HEIGHT)
      }
    }
  })

  it('各エリアの上端AREA_ENTRY_CLEARANCEには障害物を置かない', () => {
    for (const area of AREAS) {
      for (const object of area.objects) {
        const minY = object.kind === 'wall'
          ? object.y - objectExtents(object).y
          : object.y - object.radius
        expect(minY).toBeGreaterThanOrEqual(AREA_ENTRY_CLEARANCE)
      }
    }
  })

  it('障害物どうしはボール直径＋16px以上の最小余白を持つ', () => {
    const requiredClearance = BALL_RADIUS * 2 + 16
    for (const area of AREAS) {
      for (let firstIndex = 0; firstIndex < area.objects.length; firstIndex += 1) {
        const first = area.objects[firstIndex]
        if (!first) continue
        for (let secondIndex = firstIndex + 1; secondIndex < area.objects.length; secondIndex += 1) {
          const second = area.objects[secondIndex]
          if (!second) continue
          const firstExtents = objectExtents(first)
          const secondExtents = objectExtents(second)
          // 壁は長い矩形なので、円形の外接半径だけで判定すると、上下に離れた
          // 斜面まで「重なった」と誤判定する。回転後のAABB間隔を使い、
          // ボール直径＋16pxの通路が実際に残ることを保守的に確認する。
          const gapX = Math.max(0, Math.abs(first.x - second.x) - firstExtents.x - secondExtents.x)
          const gapY = Math.max(0, Math.abs(first.y - second.y) - firstExtents.y - secondExtents.y)
          const surfaceClearance = Math.hypot(gapX, gapY)
          expect(surfaceClearance, `${area.id}:${first.id}/${second.id}`).toBeGreaterThanOrEqual(requiredClearance)
        }
      }
    }
  })
})
