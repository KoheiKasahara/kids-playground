import * as Matter from 'matter-js'
import {
  AREA_HEIGHT,
  AREA_WIDTH,
  BALL_DENSITY,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
  BALL_RADIUS,
  BALL_RESTITUTION,
  CUP_FRICTION,
  CUP_RESTITUTION,
  EXIT_SENSOR_HEIGHT,
  GRAVITY,
  OUTER_WALL_THICKNESS,
  PIN_FRICTION,
  PIN_RESTITUTION,
  START,
  WALL_FRICTION,
  WALL_RESTITUTION,
} from './adventurePhysics'
import { AREAS, findArea, START_AREA_ID } from './data/areas'
import { areaGroundRects, cupBottomRect, cupSensorRect, type AdventureRect } from './adventureGeometry'
import type { AreaCup, AreaExit, AreaJumpPad, AreaPin, AreaZone } from './types'

export type AdventureZoneEntry = {
  areaId: string
  zone: AreaZone
  body: Matter.Body
}

export type AdventureWorld = {
  engine: Matter.Engine
  ballBody: Matter.Body
  /** 接触判定に使うセンサー以外のボディ。ボール本体は含まない。 */
  solidBodies: Matter.Body[]
  pinByLabel: Map<string, { areaId: string; pin: AreaPin }>
  jumpByLabel: Map<string, { areaId: string; jump: AreaJumpPad }>
  exitByLabel: Map<string, { areaId: string; exit: AreaExit }>
  cupByLabel: Map<string, { areaId: string; cup: AreaCup }>
  zoneByLabel: Map<string, AdventureZoneEntry>
}

function worldPoint(areaId: string, x: number, y: number) {
  const area = findArea(areaId)
  if (!area) throw new Error(`flag-roll-adventure: unknown area id: ${areaId}`)
  return { x: area.origin.x + x, y: area.origin.y + y }
}

function createRectBody(areaId: string, rect: AdventureRect, options: Matter.IChamferableBodyDefinition): Matter.Body {
  const center = worldPoint(areaId, rect.left + rect.width / 2, rect.top + rect.height / 2)
  return Matter.Bodies.rectangle(center.x, center.y, rect.width, rect.height, options)
}

/** 出口・カップ以外の下抜けを防ぐ床。開口だけを残すので、外側へ落ちたときも通常は救済に頼らない。 */
function createPortalFloorBodies(area: (typeof AREAS)[number]): Matter.Body[] {
  const material = area.cup
    ? { restitution: CUP_RESTITUTION, friction: CUP_FRICTION }
    : { restitution: WALL_RESTITUTION, friction: WALL_FRICTION }
  return areaGroundRects(area).map((rect, index) =>
    createRectBody(area.id, rect, {
      isStatic: true,
      ...material,
      label: area.cup
        ? `cup-ground:${area.id}:${index}`
        : `portal-floor:${area.id}:${index}`,
    }),
  )
}

function createCupBodies(
  area: (typeof AREAS)[number],
  cupByLabel: Map<string, { areaId: string; cup: AreaCup }>,
): Matter.Body[] {
  if (!area.cup) return []
  const { cup } = area
  const common = { isStatic: true, restitution: CUP_RESTITUTION, friction: CUP_FRICTION }
  const bottom = createRectBody(area.id, cupBottomRect(cup), {
    ...common,
    label: `cup-bottom:${area.id}:${cup.id}`,
  })
  const sensor = createRectBody(area.id, cupSensorRect(cup), {
    isStatic: true,
    isSensor: true,
    label: `cup-sensor:${area.id}:${cup.id}`,
  })
  cupByLabel.set(sensor.label, { areaId: area.id, cup })
  return [bottom, sensor]
}

/** 実機とヘッドレス測定で共有する、固定コースのMatter.js物理ワールドを生成する。 */
export function createAdventureWorld(random: () => number): AdventureWorld {
  const startArea = findArea(START_AREA_ID)
  const startEntry = startArea?.entries[0]
  if (!startArea || !startEntry) throw new Error(`flag-roll-adventure: start entry is missing`)

  const engine = Matter.Engine.create({ gravity: { ...GRAVITY } })

  // 外壁はコースの面白さを表すarea dataへ混ぜず、全エリアで共通の安全柵として生成する。
  const outerWalls = AREAS.flatMap((area) => {
    const left = Matter.Bodies.rectangle(
      area.origin.x,
      area.origin.y + AREA_HEIGHT / 2,
      OUTER_WALL_THICKNESS,
      AREA_HEIGHT,
      {
        isStatic: true,
        restitution: WALL_RESTITUTION,
        friction: WALL_FRICTION,
        label: `outer-left:${area.id}`,
      },
    )
    const right = Matter.Bodies.rectangle(
      area.origin.x + AREA_WIDTH,
      area.origin.y + AREA_HEIGHT / 2,
      OUTER_WALL_THICKNESS,
      AREA_HEIGHT,
      {
        isStatic: true,
        restitution: WALL_RESTITUTION,
        friction: WALL_FRICTION,
        label: `outer-right:${area.id}`,
      },
    )
    const top = [
      Matter.Bodies.rectangle(
        area.origin.x + AREA_WIDTH / 2,
        area.origin.y,
        AREA_WIDTH,
        OUTER_WALL_THICKNESS,
        {
          isStatic: true,
          restitution: WALL_RESTITUTION,
          friction: WALL_FRICTION,
          label: `outer-top:${area.id}`,
        },
      ),
    ]
    return [left, right, ...top]
  })

  const wallBodies: Matter.Body[] = []
  const pinBodies: Matter.Body[] = []
  const jumpBodies: Matter.Body[] = []
  const pinByLabel = new Map<string, { areaId: string; pin: AreaPin }>()
  const jumpByLabel = new Map<string, { areaId: string; jump: AreaJumpPad }>()
  for (const area of AREAS) {
    for (const object of area.objects) {
      const point = worldPoint(area.id, object.x, object.y)
      if (object.kind === 'wall') {
        wallBodies.push(
          Matter.Bodies.rectangle(point.x, point.y, object.width, object.height, {
            isStatic: true,
            angle: object.angle,
            restitution: object.restitution ?? WALL_RESTITUTION,
            friction: WALL_FRICTION,
            label: `wall:${area.id}:${object.id}`,
          }),
        )
      } else if (object.kind === 'pin') {
        const label = `pin:${area.id}:${object.id}`
        pinBodies.push(
          Matter.Bodies.circle(point.x, point.y, object.radius, {
            isStatic: true,
            restitution: object.restitution ?? PIN_RESTITUTION,
            friction: PIN_FRICTION,
            label,
          }),
        )
        pinByLabel.set(label, { areaId: area.id, pin: object })
      } else {
        const label = `jump:${area.id}:${object.id}`
        jumpBodies.push(
          Matter.Bodies.rectangle(point.x, point.y, object.width, object.height, {
            isStatic: true,
            angle: object.angle,
            restitution: WALL_RESTITUTION,
            friction: WALL_FRICTION,
            label,
          }),
        )
        jumpByLabel.set(label, { areaId: area.id, jump: object })
      }
    }
  }

  const exitByLabel = new Map<string, { areaId: string; exit: AreaExit }>()
  const exitSensors = AREAS.flatMap((area) =>
    area.exits.map((exit) => {
      const point = worldPoint(area.id, exit.x, exit.y)
      const label = `exit:${area.id}:${exit.id}`
      exitByLabel.set(label, { areaId: area.id, exit })
      return Matter.Bodies.rectangle(point.x, point.y, exit.width, exit.height || EXIT_SENSOR_HEIGHT, {
        isStatic: true,
        isSensor: true,
        label,
      })
    }),
  )
  const zoneByLabel = new Map<string, AdventureZoneEntry>()
  const zoneBodies = AREAS.flatMap((area) =>
    (area.zones ?? []).map((zone) => {
      const point = worldPoint(area.id, zone.x, zone.y)
      const label = `zone:${area.id}:${zone.kind}:${zone.id}`
      const body = zone.kind === 'cannon'
        ? Matter.Bodies.circle(point.x, point.y, zone.radius, {
            isStatic: true,
            isSensor: true,
            label,
          })
        : Matter.Bodies.rectangle(point.x, point.y, zone.width, zone.height, {
            isStatic: true,
            isSensor: true,
            angle: zone.kind === 'boost' ? zone.angle : 0,
            label,
          })
      zoneByLabel.set(label, { areaId: area.id, zone, body })
      return body
    }),
  )
  const cupByLabel = new Map<string, { areaId: string; cup: AreaCup }>()
  const portalFloors = AREAS.flatMap((area) => createPortalFloorBodies(area))
  const cupBodies = AREAS.flatMap((area) => createCupBodies(area, cupByLabel))
  const staticBodies = [...outerWalls, ...wallBodies, ...pinBodies, ...jumpBodies, ...portalFloors, ...cupBodies]
  const solidBodies = staticBodies.filter((body) => !body.isSensor)
  Matter.Composite.add(
    engine.world,
    [...solidBodies, ...exitSensors, ...zoneBodies, ...cupBodies.filter((body) => body.isSensor)],
  )

  const initialPosition = worldPoint(
    START_AREA_ID,
    startEntry.x + (random() * 2 - 1) * START.jitterX,
    startEntry.y,
  )
  const ballBody = Matter.Bodies.circle(initialPosition.x, initialPosition.y, BALL_RADIUS, {
    restitution: BALL_RESTITUTION,
    friction: BALL_FRICTION,
    frictionAir: BALL_FRICTION_AIR,
    density: BALL_DENSITY,
    label: 'adventure-ball',
  })
  Matter.Body.setVelocity(ballBody, {
    x: START.minVx + random() * (START.maxVx - START.minVx),
    y: START.minVy + random() * (START.maxVy - START.minVy),
  })
  Matter.Composite.add(engine.world, ballBody)

  return { engine, ballBody, solidBodies, pinByLabel, jumpByLabel, exitByLabel, cupByLabel, zoneByLabel }
}
