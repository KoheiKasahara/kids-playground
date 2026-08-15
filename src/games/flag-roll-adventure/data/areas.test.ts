import { describe, expect, it } from 'vitest'
import {
  AREA_ENTRY_CLEARANCE,
  AREA_HEIGHT,
  AREA_WIDTH,
  BALL_RADIUS,
  CANNON_MUZZLE_OFFSET,
  CUP_FRONT_LIP_TOP_OFFSET,
  CUP_INNER_DEPTH,
  CUP_INNER_WIDTH,
  CUP_SENSOR_INSET,
  CUP_SENSOR_TOP_OFFSET,
  EXIT_WIDTH,
  MAX_SPEED,
  PORTAL_FLOOR_HEIGHT,
} from '../adventurePhysics'
import { areaGroundRects, cupBottomRect, cupFrontLipRect, cupSensorRect, cupWellRect, worldSize } from '../adventureGeometry'
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

function segmentIntersectsRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
  rect: { left: number; top: number; right: number; bottom: number },
): boolean {
  let minimum = 0
  let maximum = 1
  for (const [origin, delta, lower, upper] of [
    [start.x, end.x - start.x, rect.left, rect.right],
    [start.y, end.y - start.y, rect.top, rect.bottom],
  ]) {
    if (Math.abs(delta) < Number.EPSILON) {
      if (origin < lower || origin > upper) return false
      continue
    }
    const first = (lower - origin) / delta
    const second = (upper - origin) / delta
    const entry = Math.min(first, second)
    const exit = Math.max(first, second)
    minimum = Math.max(minimum, entry)
    maximum = Math.min(maximum, exit)
    if (minimum > maximum) return false
  }
  return true
}

function canReachArea(startAreaId: string, targetAreaId: string): boolean {
  const visited = new Set<string>([startAreaId])
  const queue = [startAreaId]
  while (queue.length > 0) {
    const areaId = queue.shift()
    if (!areaId) continue
    if (areaId === targetAreaId) return true
    const area = findArea(areaId)
    if (!area) continue
    for (const exit of area.exits) {
      if (!visited.has(exit.to)) {
        visited.add(exit.to)
        queue.push(exit.to)
      }
    }
  }
  return false
}

describe('area data', () => {
  it('forestはcaveとriverへ向かう2つの異なる出口を持つ', () => {
    const forest = findArea('forest')
    expect(forest).toBeDefined()
    if (!forest) return

    expect(forest.exits).toHaveLength(2)
    expect(forest.exits.map((exit) => exit.to).sort()).toEqual(['cave', 'river'])
    expect(new Set(forest.exits.map((exit) => exit.to)).size).toBe(2)
  })

  it('caveとriverは異なる入口idでcloudへ合流する', () => {
    const caveExit = findArea('cave')?.exits[0]
    const riverExit = findArea('river')?.exits[0]
    expect(caveExit?.to).toBe('cloud')
    expect(riverExit?.to).toBe('cloud')
    expect(caveExit?.toEntry).toBeDefined()
    expect(riverExit?.toEntry).toBeDefined()
    expect(caveExit?.toEntry).not.toBe(riverExit?.toEntry)
  })

  it('forestの左右どちらの出口からもgoalへ到達できる', () => {
    const forest = findArea('forest')
    expect(forest).toBeDefined()
    if (!forest) return

    for (const exit of forest.exits) {
      expect(canReachArea(exit.to, 'goal')).toBe(true)
    }
  })

  it('全エリアがworld矩形に収まり、origin同士が重ならない', () => {
    const size = worldSize(AREAS)
    for (const area of AREAS) {
      expect(area.origin.x).toBeGreaterThanOrEqual(0)
      expect(area.origin.y).toBeGreaterThanOrEqual(0)
      expect(area.origin.x + AREA_WIDTH).toBeLessThanOrEqual(size.width)
      expect(area.origin.y + AREA_HEIGHT).toBeLessThanOrEqual(size.height)
    }

    for (let firstIndex = 0; firstIndex < AREAS.length; firstIndex += 1) {
      const first = AREAS[firstIndex]
      if (!first) continue
      for (let secondIndex = firstIndex + 1; secondIndex < AREAS.length; secondIndex += 1) {
        const second = AREAS[secondIndex]
        if (!second) continue
        const separated =
          first.origin.x + AREA_WIDTH <= second.origin.x ||
          second.origin.x + AREA_WIDTH <= first.origin.x ||
          first.origin.y + AREA_HEIGHT <= second.origin.y ||
          second.origin.y + AREA_HEIGHT <= first.origin.y
        expect(separated, `${first.id}/${second.id}`).toBe(true)
      }
    }
  })

  it('forestの左右出口は重ならず、間に正の幅の地面帯を残す', () => {
    const forest = findArea('forest')
    expect(forest).toBeDefined()
    if (!forest) return
    const exits = [...forest.exits].sort((first, second) => first.x - second.x)
    const leftExit = exits[0]
    const rightExit = exits[1]
    expect(leftExit).toBeDefined()
    expect(rightExit).toBeDefined()
    if (!leftExit || !rightExit) return

    const leftOpeningRight = leftExit.x + leftExit.width / 2
    const rightOpeningLeft = rightExit.x - rightExit.width / 2
    expect(leftOpeningRight).toBeLessThan(rightOpeningLeft)

    const ground = areaGroundRects(forest)
    expect(ground).toHaveLength(3)
    expect(ground[1]?.left).toBe(leftOpeningRight)
    expect(ground[1]?.width).toBe(rightOpeningLeft - leftOpeningRight)
    expect(ground[1]?.width).toBeGreaterThan(0)
  })
  it('出口の開口はエリア内で重ならない', () => {
    for (const area of AREAS) {
      const exits = [...area.exits].sort((first, second) => first.x - second.x)
      for (let index = 0; index < exits.length; index += 1) {
        const exit = exits[index]
        if (!exit) continue
        const left = exit.x - exit.width / 2
        const right = exit.x + exit.width / 2
        expect(exit.width).toBeGreaterThan(0)
        expect(left).toBeGreaterThanOrEqual(0)
        expect(right).toBeLessThanOrEqual(AREA_WIDTH)
        const previous = exits[index - 1]
        if (previous) {
          expect(left).toBeGreaterThanOrEqual(previous.x + previous.width / 2)
        }
      }
    }
  })
  it('すべての出口幅は通常ポータルの範囲に収まる', () => {
    for (const area of AREAS) {
      for (const exit of area.exits) {
        expect(exit.width).toBeGreaterThanOrEqual(EXIT_WIDTH)
        expect(exit.width).toBeLessThanOrEqual(180)
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
        const minY = object.kind === 'pin'
          ? object.y - object.radius
          : object.y - objectExtents(object).y
        expect(minY).toBeGreaterThanOrEqual(AREA_ENTRY_CLEARANCE)
      }
    }
  })

  it('ギミックの速度・砲口・ゾーン境界を保つ', () => {
    for (const area of AREAS) {
      for (const object of area.objects) {
        if (object.kind === 'jump') {
          expect(object.power, `${area.id}:${object.id}`).toBeLessThanOrEqual(MAX_SPEED)
        }
      }

      for (const zone of area.zones ?? []) {
        if (zone.kind === 'cannon') {
          expect(zone.power, `${area.id}:${zone.id}`).toBeLessThanOrEqual(MAX_SPEED)
          expect(CANNON_MUZZLE_OFFSET, `${area.id}:${zone.id}`).toBeGreaterThan(zone.radius)
          expect(zone.x - zone.radius, `${area.id}:${zone.id} left`).toBeGreaterThanOrEqual(0)
          expect(zone.x + zone.radius, `${area.id}:${zone.id} right`).toBeLessThanOrEqual(AREA_WIDTH)
          expect(zone.y - zone.radius, `${area.id}:${zone.id} top`).toBeGreaterThanOrEqual(0)
          expect(zone.y + zone.radius, `${area.id}:${zone.id} bottom`).toBeLessThanOrEqual(AREA_HEIGHT)
          const muzzleEnd = {
            x: zone.x + Math.cos(zone.angle) * 250,
            y: zone.y + Math.sin(zone.angle) * 250,
          }
          for (const exit of area.exits) {
            expect(
              segmentIntersectsRect(
                { x: zone.x, y: zone.y },
                muzzleEnd,
                {
                  left: exit.x - exit.width / 2,
                  top: exit.y - exit.height / 2,
                  right: exit.x + exit.width / 2,
                  bottom: exit.y + exit.height / 2,
                },
              ),
              `${area.id}:${zone.id}/${exit.id} cannon path`,
            ).toBe(false)
            expect(Math.hypot(zone.x - exit.x, zone.y - exit.y), `${area.id}:${zone.id}/${exit.id} distance`).toBeGreaterThanOrEqual(120)
          }
          continue
        }

        if (zone.kind === 'float') {
          expect(zone.gravityScale).toBeGreaterThanOrEqual(0)
          expect(zone.gravityScale).toBeLessThanOrEqual(1)
        }
        const halfWidth = zone.width / 2
        const halfHeight = zone.height / 2
        const zoneAngle = zone.kind === 'boost' ? zone.angle : 0
        const cosine = Math.abs(Math.cos(zoneAngle))
        const sine = Math.abs(Math.sin(zoneAngle))
        const extentX = cosine * halfWidth + sine * halfHeight
        const extentY = sine * halfWidth + cosine * halfHeight
        expect(zone.x - extentX, `${area.id}:${zone.id} left`).toBeGreaterThanOrEqual(0)
        expect(zone.x + extentX, `${area.id}:${zone.id} right`).toBeLessThanOrEqual(AREA_WIDTH)
        expect(zone.y - extentY, `${area.id}:${zone.id} top`).toBeGreaterThanOrEqual(0)
        expect(zone.y + extentY, `${area.id}:${zone.id} bottom`).toBeLessThanOrEqual(AREA_HEIGHT)
      }
    }
  })

  it('各エリアの160px帯には回転後AABBが交差するオブジェクトがある', () => {
    const bandHeight = 160
    for (const area of AREAS) {
      const floorY = area.cup ? area.cup.rimY : AREA_HEIGHT - PORTAL_FLOOR_HEIGHT
      for (let bandTop = AREA_ENTRY_CLEARANCE; bandTop < floorY; bandTop += bandHeight) {
        const bandBottom = Math.min(floorY, bandTop + bandHeight)
        const hasObject = area.objects.some((object) => {
          const extents = objectExtents(object)
          return object.y - extents.y < bandBottom && object.y + extents.y > bandTop
        })
        expect(hasObject, `${area.id}:${bandTop}-${bandBottom}`).toBe(true)
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

  it('cave cannon launches upward', () => {
    const caveCannons = (findArea('cave')?.zones ?? []).filter((zone) => zone.kind === 'cannon')
    expect(caveCannons.length).toBeGreaterThan(0)
    expect(caveCannons.every((cannon) => Math.sin(cannon.angle) < 0)).toBe(true)
  })
})
