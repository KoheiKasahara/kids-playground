import { describe, expect, test } from 'vitest'
import { bridgeCells } from './maps'
import {
  getPois,
  getMap,
  interactOnArrival,
  STAGES,
  createWorld,
  getInteraction,
  getObjective,
  interact,
  isWalkableCell,
  targetPoi,
  targetPoint,
  updateWorld,
  type PoiId,
  type World,
} from './model'

function arrive(world: World, id: PoiId): void {
  expect(targetPoi(world, id)).toBe(true)
  for (let frame = 0; world.path.length > 0 && frame < 1000; frame += 1) {
    updateWorld(world, 0.1)
    expect(isWalkableCell(world, Math.floor(world.player.x / 16), Math.floor(world.player.y / 16))).toBe(true)
  }
  const point = getPois(world).find((poi) => poi.id === id)!
  expect(world.player).toMatchObject({ x: point.x, y: point.y + (point.kind === 'animal' ? 16 : 0), walking: false })
  expect(world.path).toEqual([])
}

function visit(world: World, id: PoiId) {
  arrive(world, id)
  return interact(world)
}

describe('森のおとどけやさんの冒険', () => {
  test.each(STAGES.map((stage, index) => [stage.name, index] as const))('%s は案内に沿って歩き、自分で操作すると最後まで遊べる', (_, index) => {
    const world = createWorld(index)
    const events: string[] = []
    for (let step = 0; !world.completed && step < 20; step += 1) {
      const objective = getObjective(world)
      expect(objective.targetId).not.toBeNull()
      arrive(world, objective.targetId!)
      expect(getInteraction(world).enabled).toBe(true)
      events.push(interact(world).type)
    }
    expect(world.completed).toBe(true)
    expect(world.delivered).toEqual(STAGES[index].deliveries)
    expect(events).toContain('repair')
    expect(events).toContain('water')
    expect(events).toContain('harvest')
    expect(events.filter((event) => event === 'complete')).toHaveLength(1)
    expect(Object.values(world.inventory).every((item) => !item)).toBe(true)
    expect(getObjective(world).targetId).toBeNull()
    const completedWorld = structuredClone(world)
    expect(interact(world).type).toBe('none')
    expect(targetPoi(world, 'post')).toBe(false)
    updateWorld(world, 1)
    expect(world).toEqual(completedWorld)
  })

  test('必要な道具がないと川を渡れず、橋を直すと橋の上だけを通れる', () => {
    const world = createWorld()
    expect(targetPoi(world, 'squirrel')).toBe(false)
    expect(world.player.x).toBeLessThan(144)
    expect(world.message).toContain('きのえだ')
    arrive(world, 'bridge')
    expect(getInteraction(world).enabled).toBe(false)
    expect(interact(world).type).toBe('none')
    expect(world.flags.bridgeRepaired).toBe(false)
    expect(visit(world, 'wood').type).toBe('collect')
    expect(visit(world, 'bridge').type).toBe('repair')
    expect(world.inventory.wood).toBe(false)
    expect(targetPoi(world, 'squirrel')).toBe(true)
    const riverSteps = world.path.filter((point) => point.x >= 144 && point.x < 176)
    expect(riverSteps).toEqual([{ x: 152, y: 152 }, { x: 168, y: 152 }])
    arrive(world, 'squirrel')
    expect(getInteraction(world).enabled).toBe(false)
    expect(interact(world).type).toBe('none')
    expect(world.delivered).toEqual([])
  })

  test('動物の手前に立ち止まり、姿が重ならずに品物を渡せる', () => {
    const world = createWorld(1)
    visit(world, 'post')
    visit(world, 'wood')
    visit(world, 'bridge')
    visit(world, 'garden')
    interact(world)
    visit(world, 'apple')
    for (const id of ['squirrel', 'rabbit', 'bear'] as const) {
      const point = getPois(world).find((poi) => poi.id === id)!
      arrive(world, id)
      expect(Math.hypot(world.player.x - point.x, world.player.y - point.y)).toBe(16)
      expect(getInteraction(world)).toMatchObject({ enabled: true, poiId: id })
      expect(interact(world).type).toBe(id === 'bear' ? 'complete' : 'deliver')
    }
    expect(world.completed).toBe(true)
  })

  test('目的地に着いても操作するまでは集めたり育てたりしない', () => {
    const world = createWorld()
    arrive(world, 'garden')
    updateWorld(world, 60)
    expect(world.flags.carrotWatered).toBe(false)
    expect(world.inventory.carrot).toBe(false)
    expect(interact(world).type).toBe('water')
    expect(world.flags.carrotWatered).toBe(true)
    expect(world.inventory.carrot).toBe(false)
    expect(interact(world).type).toBe('harvest')
    expect(world.inventory.carrot).toBe(true)
    expect(interact(world).type).toBe('none')
  })

  test('先に畑を育てたり違う順番で届けたりしても行き詰まらない', () => {
    const world = createWorld(1)
    visit(world, 'garden')
    interact(world)
    visit(world, 'apple')
    visit(world, 'wood')
    visit(world, 'bridge')
    expect(visit(world, 'bear').type).toBe('deliver')
    expect(visit(world, 'rabbit').type).toBe('deliver')
    expect(getObjective(world).targetId).toBe('post')
    visit(world, 'post')
    expect(visit(world, 'squirrel').type).toBe('complete')
    expect(world.delivered).toEqual(['bear', 'rabbit', 'squirrel'])
  })

  test('同じ荷物や配達は二重に数えず、配達済みの品はかごからなくなる', () => {
    const world = createWorld(1)
    expect(visit(world, 'post').type).toBe('collect')
    expect(interact(world).type).toBe('none')
    visit(world, 'wood')
    visit(world, 'bridge')
    expect(visit(world, 'squirrel').type).toBe('deliver')
    expect(world.inventory.parcel).toBe(false)
    expect(interact(world).type).toBe('none')
    expect(world.delivered).toEqual(['squirrel'])
    arrive(world, 'post')
    expect(interact(world).type).toBe('none')
    expect(world.inventory.parcel).toBe(false)
  })

  test('建物そのものをタップすると、壁を通らず入口まで歩く', () => {
    const world = createWorld()
    arrive(world, 'garden')
    expect(targetPoint(world, 56, 180)).toBe(true)
    expect(world.targetId).toBe('post')
    expect(world.path.at(-1)).toEqual({ x: 56, y: 216 })
    expect(world.path.every((point) => isWalkableCell(world, Math.floor(point.x / 16), Math.floor(point.y / 16)))).toBe(true)
    expect(isWalkableCell(world, 3, 11)).toBe(false)
    expect(isWalkableCell(world, 15, 4)).toBe(false)
  })

  test('歩いている間は近くのものを誤って操作しない', () => {
    const world = createWorld()
    expect(getInteraction(world).enabled).toBe(true)
    expect(targetPoi(world, 'wood')).toBe(true)
    expect(getInteraction(world).enabled).toBe(false)
    expect(interact(world).type).toBe('none')
    expect(world.flags.parcelTaken).toBe(false)
  })

  test('画面外・川・不正な座標は目的地にできず、長い停止後も急に遠くへ移動しない', () => {
    const world = createWorld()
    for (const [x, y] of [[-1, 100], [320, 100], [100, 288], [NaN, 10], [Infinity, 10], [8, 8], [160, 80]]) {
      expect(targetPoint(world, x, y)).toBe(false)
    }
    expect(world.path).toEqual([])
    targetPoi(world, 'wood')
    const before = { ...world.player }
    for (const delta of [NaN, Infinity, -1, 0]) updateWorld(world, delta)
    expect(world.player).toEqual(before)
    updateWorld(world, 60)
    expect(Math.hypot(world.player.x - before.x, world.player.y - before.y)).toBeLessThanOrEqual(8)
    expect(world.player.walking).toBe(true)
    expect(world.flags.woodCollected).toBe(false)
  })

  test('移動中に行き先を変えても道から外れず、各コースの状態は独立する', () => {
    const world = createWorld(1)
    targetPoi(world, 'wood')
    updateWorld(world, 0.07)
    arrive(world, 'apple')
    interact(world)
    expect(world.inventory.apple).toBe(true)
    const another = createWorld(1)
    expect(another.inventory.apple).toBe(false)
    expect(another.path).toEqual([])
    for (const index of [-1, 3, 1.5, NaN, Infinity]) expect(createWorld(index).stageIndex).toBe(0)
    expect(createWorld(2).stageIndex).toBe(2)
  })
})


test.each([0, 1, 2])('森 %i はマップのタップと到着処理だけでクリアできる', index => {
  const world = createWorld(index)
  for (let step = 0; !world.completed && step < 20; step++) {
    const id = getObjective(world).targetId!
    arrive(world, id)
    const event = interactOnArrival(world)
    expect(event?.type).not.toBe('none')
    expect(interactOnArrival(world)).toBeNull()
  }
  expect(world.completed).toBe(true)
})

test('各マップは川・橋・建物の位置が異なり、到達可能な道がつながる', () => {
  const worlds = [0, 1, 2].map(createWorld)
  expect(new Set(worlds.map(w => JSON.stringify(getPois(w)))).size).toBe(3)
  expect(new Set(worlds.map(w => getMap(w).tiles.join('\n'))).size).toBe(3)
  expect(new Set(worlds.map(w => JSON.stringify(bridgeCells(getMap(w))))).size).toBe(3)
  for (const world of worlds) {
    expect(targetPoi(world, 'squirrel')).toBe(false)
    visit(world, 'wood')
    visit(world, 'bridge')
    for (const poi of getPois(world)) arrive(world, poi.id)
  }
})

test('地面への移動ではおてつだいせず、目的地を変えると最後のタップだけ実行する', () => {
  const world = createWorld()
  targetPoi(world, 'post')
  targetPoint(world, 72, 232)
  for (let i = 0; i < 50; i++) updateWorld(world, .1)
  expect(interactOnArrival(world)).toBeNull()
  expect(world.inventory.parcel).toBe(false)
  targetPoi(world, 'post')
  arrive(world, 'garden')
  expect(interactOnArrival(world)?.type).toBe('water')
  expect(world.inventory.parcel).toBe(false)
  expect(world.inventory.carrot).toBe(false)
})
