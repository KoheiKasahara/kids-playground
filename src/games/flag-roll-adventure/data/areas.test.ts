import { describe, expect, it } from 'vitest'
import {
  AREA_ENTRY_CLEARANCE,
  AREA_HEIGHT,
  AREA_WIDTH,
  BALL_RADIUS,
  CUP_FRONT_LIP_TOP_OFFSET,
  CUP_INNER_DEPTH,
  CUP_INNER_WIDTH,
  CUP_SENSOR_INSET,
  CUP_SENSOR_TOP_OFFSET,
} from '../adventurePhysics'
import { areaGroundRects, cupBottomRect, cupFrontLipRect, cupSensorRect, cupWellRect } from '../adventureGeometry'
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

describe('area data', () => {
  it('出口の開口はエリア内で重ならない', () => {
    for (const area of AREAS) {
      const exits = [...area.exits].sort((first, second) => first.x - second.x)
      for (let index = 0; index < exits.length; index += 1) {
        const exit = exits[index]
        if (!exit) continue
        const left = exit.x - exit.width / 2
        const right = exit.x + exit.width / 2
        expect(left).toBeGreaterThanOrEqual(0)
        expect(right).toBeLessThanOrEqual(AREA_WIDTH)
        const previous = exits[index - 1]
        if (previous) {
          expect(left).toBeGreaterThanOrEqual(previous.x + previous.width / 2)
        }
      }
    }
  })
  it('エリアidに重複がない', () => {
    const ids = AREAS.map((area) => area.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('すべての出口が実在エリアと入口へ接続する', () => {
    const ids = new Set(AREAS.map((area) => area.id))
    for (const area of AREAS) {
      for (const exit of area.exits) {
        expect(ids.has(exit.to)).toBe(true)
        expect(findArea(exit.to)?.entries.some((entry) => entry.id === exit.toEntry)).toBe(true)
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
        if (!visited.has(exit.to)) {
          visited.add(exit.to)
          queue.push(exit.to)
        }
      }
    }

    expect(visited).toEqual(new Set(AREAS.map((area) => area.id)))
  })

  it('cupを持つエリアだけが出口を持たず、それ以外は出口を持つ', () => {
    const cupAreas = AREAS.filter((area) => area.cup)
    expect(cupAreas).toHaveLength(1)
    expect(cupAreas[0]?.exits).toEqual([])
    expect(AREAS.filter((area) => !area.cup).every((area) => area.exits.length > 0)).toBe(true)
  })

  it('各エリアに重複しない入口があり、入口と出口がエリア内に収まる', () => {
    for (const area of AREAS) {
      expect(area.entries.length).toBeGreaterThan(0)
      expect(new Set(area.entries.map((entry) => entry.id)).size).toBe(area.entries.length)
      for (const entry of area.entries) {
        expect(entry.x - BALL_RADIUS).toBeGreaterThanOrEqual(0)
        expect(entry.x + BALL_RADIUS).toBeLessThanOrEqual(AREA_WIDTH)
        expect(entry.y - BALL_RADIUS).toBeGreaterThanOrEqual(AREA_ENTRY_CLEARANCE)
        expect(entry.y + BALL_RADIUS).toBeLessThanOrEqual(AREA_HEIGHT)
      }
      for (const exit of area.exits) {
        expect(exit.x - exit.width / 2).toBeGreaterThanOrEqual(0)
        expect(exit.x + exit.width / 2).toBeLessThanOrEqual(AREA_WIDTH)
        expect(exit.y - exit.height / 2).toBeGreaterThanOrEqual(0)
        expect(exit.y + exit.height / 2).toBeLessThanOrEqual(AREA_HEIGHT)
      }
    }
  })

  it('カップのリム接触だけでは内部センサーへ届かず、内側幅はボール直径より十分広い', () => {
    const cupArea = AREAS.find((area) => area.cup)
    const cup = cupArea?.cup
    expect(cup).toBeDefined()
    if (!cup) return

    // 物理側は「中心の判定線 + 半径」までセンサー上端を下げるため、球の外周が
    // リムへ触れただけの位置（rimY + BALL_RADIUS）ではセンサーに重ならない。
    const sensorTop = cup.rimY + CUP_SENSOR_TOP_OFFSET
    expect(sensorTop).toBeGreaterThan(cup.rimY + BALL_RADIUS)
    expect(CUP_INNER_WIDTH).toBeGreaterThanOrEqual(BALL_RADIUS * 2 + 24)
  })

  it('cup geometry matches physical and visual rectangles', () => {
    const cupArea = AREAS.find((area) => area.cup)
    const cup = cupArea?.cup
    expect(cup).toBeDefined()
    if (!cup || !cupArea) return

    const ground = areaGroundRects(cupArea)
    const well = cupWellRect(cup)
    const bottom = cupBottomRect(cup)
    const sensor = cupSensorRect(cup)
    const front = cupFrontLipRect(cup)
    const settledCenterY = cup.rimY + CUP_INNER_DEPTH - BALL_RADIUS
    const settledBallTop = cup.rimY + CUP_INNER_DEPTH - BALL_RADIUS * 2

    expect(ground).toHaveLength(2)
    expect(ground[0]).toMatchObject({ left: 0, top: cup.rimY, height: AREA_HEIGHT - cup.rimY })
    expect(ground[1]).toMatchObject({ top: cup.rimY, height: AREA_HEIGHT - cup.rimY })
    expect(ground[0].width + CUP_INNER_WIDTH + ground[1].width).toBe(AREA_WIDTH)
    expect(well).toEqual({ left: cup.x - CUP_INNER_WIDTH / 2, top: cup.rimY, width: CUP_INNER_WIDTH, height: CUP_INNER_DEPTH })
    expect(bottom).toMatchObject({
      left: cup.x - CUP_INNER_WIDTH / 2,
      top: cup.rimY + CUP_INNER_DEPTH,
      width: CUP_INNER_WIDTH,
    })
    expect(sensor).toMatchObject({
      left: cup.x - CUP_INNER_WIDTH / 2,
      top: cup.rimY + CUP_SENSOR_TOP_OFFSET,
      width: CUP_INNER_WIDTH,
    })
    expect(settledCenterY).toBeGreaterThanOrEqual(sensor.top)
    expect(settledCenterY).toBeLessThanOrEqual(sensor.top + sensor.height)
    expect(settledBallTop).toBeGreaterThanOrEqual(front.top)
    expect(CUP_FRONT_LIP_TOP_OFFSET).toBeGreaterThanOrEqual(CUP_SENSOR_INSET)

    const lowerLeft = cupArea.objects.find((object) => object.id === 'goal-funnel-lower-left')
    const lowerRight = cupArea.objects.find((object) => object.id === 'goal-funnel-lower-right')
    expect(lowerLeft?.kind).toBe('wall')
    expect(lowerRight?.kind).toBe('wall')
    if (!lowerLeft || !lowerRight || lowerLeft.kind !== 'wall' || lowerRight.kind !== 'wall') return
    const lowerLeftInnerEdge = lowerLeft.x + objectExtents(lowerLeft).x
    const lowerRightInnerEdge = lowerRight.x - objectExtents(lowerRight).x
    expect(cup.x - CUP_INNER_WIDTH / 2).toBeGreaterThanOrEqual(lowerLeftInnerEdge)
    expect(cup.x + CUP_INNER_WIDTH / 2).toBeLessThanOrEqual(lowerRightInnerEdge)
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
