import { beforeAll, describe, expect, it } from 'vitest'
import { initializeRapier } from '../../physics/rapierLoader'
import { BIN, CHUTE, CRANE_MACHINES, findMachine, findSpecies, prizeReach, type CraneMachine } from './craneMachines'
import { advanceRig, aimRig, createRig, overChute, rigBusy, startGrab, type Rig } from './craneRig'
import { createCraneWorld, type CraneEvent, type CraneWorld } from './craneWorld'

const STEP = 1 / 120
beforeAll(async () => { await initializeRapier() })

function machine(id: string): CraneMachine {
  const found = findMachine(id)
  if (!found) throw new Error(`unknown machine: ${id}`)
  return found
}

function run(world: CraneWorld, rig: Rig, seconds: number, until?: () => boolean): CraneEvent[] {
  const events: CraneEvent[] = []
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    const rigEvents = advanceRig(rig, STEP, { blocked: world.blockedByPrize })
    world.step(rig, rigEvents)
    events.push(...world.consumeEvents())
    if (until?.()) break
  }
  return events
}

/** ねらった場所までアームを動かし、つかむ動作を終わりまで回す。 */
function grabAt(world: CraneWorld, rig: Rig, target: { x: number; z: number }): CraneEvent[] {
  aimRig(rig, target.x, target.z)
  const moving = run(world, rig, 8, () => rig.target === null)
  expect(startGrab(rig)).toBe(true)
  return [...moving, ...run(world, rig, 16, () => !rigBusy(rig))]
}

function expectInsideCabinet(world: CraneWorld, definition: CraneMachine) {
  for (const prize of world.prizes()) {
    const species = findSpecies(definition, prize.species)!
    const reach = prizeReach(species.body)
    expect(Math.abs(prize.position.x)).toBeLessThan(BIN.x + reach)
    expect(Math.abs(prize.position.z)).toBeLessThan(BIN.z + reach)
    expect(prize.position.y).toBeGreaterThan(CHUTE.floor - 0.05)
    expect(prize.position.y).toBeLessThan(BIN.height)
  }
}

describe('クレーンの物理', () => {
  it('並べた景品がどの機械でもケースの中で落ち着く', () => {
    for (const definition of CRANE_MACHINES) {
      const world = createCraneWorld(definition)
      const rig = createRig()
      try {
        run(world, rig, 3)
        expect(world.remaining).toBe(definition.slots.length)
        expectInsideCabinet(world, definition)
        // 穴の上には並べないので、並べただけでは1つも取れない。
        expect(world.collected).toBe(0)
        for (const prize of world.prizes()) expect(prize.position.y).toBeLessThan(0.4)
      } finally { world.dispose() }
    }
  })

  it('落ちてきた景品がぶつかると、音のきっかけを返す', () => {
    const definition = machine('snack')
    const world = createCraneWorld(definition)
    const rig = createRig()
    try {
      const events = run(world, rig, 2)
      expect(events.some(event => event.kind === 'bump')).toBe(true)
    } finally { world.dispose() }
  })

  it('ねらった景品をつかみ、穴まで運んで取れたことを知らせる', () => {
    const definition = machine('plush')
    const world = createCraneWorld(definition)
    const rig = createRig()
    try {
      run(world, rig, 3)
      const target = world.prizes().find(prize => prize.species === 'bear')!
      const events = grabAt(world, rig, target.position)
      expect(events.some(event => event.kind === 'grip' && event.prize === target.id)).toBe(true)
      expect(events.some(event => event.kind === 'caught' && event.prize === target.id)).toBe(true)
      expect(world.collected).toBe(1)
      expect(world.remaining).toBe(definition.slots.length - 1)
      expect(world.holding).toBeNull()
      // 受け皿で落ち着いた景品は片づけられ、ケースの中の景品だけが残る。
      run(world, rig, 2)
      expect(world.prizes().some(prize => prize.id === target.id)).toBe(false)
    } finally { world.dispose() }
  })

  it('支える力が足りないアームでは持ち上げた先ですべり落ち、景品はケースに残る', () => {
    // 支えられる力だけを極端に小さくした機械。ほかの条件はぬいぐるみの機械と同じにして、
    // 「すべるかどうか」が grip.hold だけで決まることを確かめる。
    const definition: CraneMachine = { ...machine('plush'), grip: { ...machine('plush').grip, hold: 0.02 } }
    const world = createCraneWorld(definition)
    const rig = createRig()
    try {
      run(world, rig, 3)
      const target = world.prizes().find(prize => prize.species === 'bear')!
      const events = grabAt(world, rig, target.position)
      expect(events.some(event => event.kind === 'grip' && event.prize === target.id)).toBe(true)
      const slip = events.find(event => event.kind === 'slip' && event.prize === target.id)
      expect(slip).toBeDefined()
      // 穴へ着くより前にすべるので、運ばれずにケースへ落ちる。
      expect(slip!.kind === 'slip' && overChute(slip!.position.x, slip!.position.z)).toBe(false)
      expect(events.some(event => event.kind === 'caught' && event.prize === target.id)).toBe(false)
      expect(world.holding).toBeNull()
      expect(world.prizes().some(prize => prize.id === target.id && !prize.caught)).toBe(true)
      expectInsideCabinet(world, definition)
    } finally { world.dispose() }
  })

  it('何もない場所でつかむと、からぶりで終わる', () => {
    const definition: CraneMachine = { ...machine('plush'), slots: [{ species: 'bear', x: 0.42, z: -0.31 }] }
    const world = createCraneWorld(definition)
    const rig = createRig()
    try {
      run(world, rig, 3)
      const events = grabAt(world, rig, { x: 0.1, z: -0.1 })
      expect(events.some(event => event.kind === 'miss')).toBe(true)
      expect(events.some(event => event.kind === 'grip')).toBe(false)
      expect(world.collected).toBe(0)
      expect(world.remaining).toBe(1)
    } finally { world.dispose() }
  })

  it('つかみ動作をくり返しても景品がケースから出ず、並べ直すと数が戻る', () => {
    const definition = machine('snack')
    const world = createCraneWorld(definition)
    const rig = createRig()
    try {
      run(world, rig, 3)
      for (let attempt = 0; attempt < 3; attempt++) {
        const remaining = world.prizes().filter(prize => !prize.caught)
        grabAt(world, rig, remaining[attempt]!.position)
        expectInsideCabinet(world, definition)
      }
      expect(world.collected).toBeGreaterThan(0)
      expect(world.remaining).toBeLessThan(definition.slots.length)
      world.refill(4)
      run(world, rig, 3)
      expect(world.remaining).toBe(definition.slots.length)
      expectInsideCabinet(world, definition)
    } finally { world.dispose() }
  })
})
