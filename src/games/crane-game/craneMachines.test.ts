import { describe, expect, it } from 'vitest'
import {
  BIN,
  CHUTE,
  CRANE_MACHINES,
  findMachine,
  findSpecies,
  prizeReach,
  prizeSpawns,
  restingHeight,
} from './craneMachines'

describe('クレーンゲームの機械', () => {
  it('機械のidと見せ方がそろっている', () => {
    expect(CRANE_MACHINES.length).toBeGreaterThanOrEqual(3)
    expect(new Set(CRANE_MACHINES.map(machine => machine.id)).size).toBe(CRANE_MACHINES.length)
    for (const machine of CRANE_MACHINES) {
      expect(machine.label.length).toBeGreaterThan(0)
      expect(machine.emoji.length).toBeGreaterThan(0)
      expect(machine.description.length).toBeLessThanOrEqual(20)
      expect(machine.hint.length).toBeLessThanOrEqual(30)
      expect(machine.color).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('景品の物理の値がどれも現実的な範囲にある', () => {
    for (const machine of CRANE_MACHINES) {
      expect(new Set(machine.species.map(species => species.id)).size).toBe(machine.species.length)
      for (const species of machine.species) {
        expect(species.mass).toBeGreaterThan(0.02)
        expect(species.mass).toBeLessThan(0.3)
        expect(species.friction).toBeGreaterThan(0)
        expect(species.restitution).toBeLessThan(0.6)
        expect(prizeReach(species.body)).toBeLessThan(0.12)
        expect(restingHeight(species.body)).toBeGreaterThan(0.02)
      }
      expect(machine.grip.hold).toBeGreaterThan(0)
      expect(machine.grip.stiffness).toBeGreaterThan(0)
      expect(machine.grip.capture).toBeGreaterThan(0.05)
    }
  })

  it('並べ場所が参照する景品が実在し、穴の上とケースの外を避けている', () => {
    for (const machine of CRANE_MACHINES) {
      expect(machine.slots.length).toBeGreaterThanOrEqual(10)
      for (const slot of machine.slots) {
        const species = findSpecies(machine, slot.species)
        expect(species, `${machine.id}: ${slot.species}`).toBeDefined()
        const reach = prizeReach(species!.body)
        expect(Math.abs(slot.x) + reach).toBeLessThan(BIN.x)
        expect(Math.abs(slot.z) + reach).toBeLessThan(BIN.z)
        expect(slot.x > CHUTE.maxX || slot.z < CHUTE.minZ).toBe(true)
      }
    }
  })

  it('形ごとに置いたときの高さと、つかみ判定に使う半径が出せる', () => {
    expect(restingHeight({ form: 'ball', radius: 0.08 })).toBeCloseTo(0.08)
    // カプセル形はねかせて置くので、高さは半径ぶんだけ。横には長い。
    expect(restingHeight({ form: 'capsule', radius: 0.05, half: 0.03 })).toBeCloseTo(0.05)
    expect(prizeReach({ form: 'capsule', radius: 0.05, half: 0.03 })).toBeCloseTo(0.08)
    expect(restingHeight({ form: 'box', half: { x: 0.07, y: 0.04, z: 0.05 }, round: 0.01 })).toBeCloseTo(0.05)
    expect(prizeReach({ form: 'box', half: { x: 0.03, y: 0.04, z: 0.04 }, round: 0.01 })).toBeCloseTo(0.06)
  })

  it('同じ round では同じ並び、違う round では並びが変わる', () => {
    const machine = findMachine('plush')!
    const first = prizeSpawns(machine, 0)
    expect(prizeSpawns(machine, 0)).toEqual(first)
    const second = prizeSpawns(machine, 1)
    expect(second).toHaveLength(first.length)
    expect(second.some((spawn, index) => spawn.position.x !== first[index]!.position.x)).toBe(true)
    expect(new Set(second.map(spawn => spawn.id)).size).toBe(second.length)
  })

  it('並べた景品はケースの中、床より上から落ちはじめる', () => {
    for (const machine of CRANE_MACHINES) {
      for (const round of [0, 3]) {
        for (const spawn of prizeSpawns(machine, round)) {
          const reach = prizeReach(spawn.species.body)
          expect(Math.abs(spawn.position.x) + reach).toBeLessThan(BIN.x)
          expect(Math.abs(spawn.position.z) + reach).toBeLessThan(BIN.z)
          expect(spawn.position.y).toBeGreaterThanOrEqual(restingHeight(spawn.species.body))
          expect(spawn.position.y).toBeLessThan(0.3)
        }
      }
    }
  })

  it('知らない機械や景品を引くと undefined になる', () => {
    expect(findMachine('unknown')).toBeUndefined()
    expect(findSpecies(findMachine('plush')!, 'unknown')).toBeUndefined()
  })
})
