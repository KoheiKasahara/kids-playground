import { describe, expect, test } from 'vitest'
import {
  AUTO_AFTER, BATTLE_SECONDS, DT, NEAR, READY_SECONDS, command, createBattle, distance, drainBattleEvents, maxHpOf, setAuto,
  simulate, stepBattle, type Battle, type BattleEvent,
} from './battle'
import { SPECIES, STAT_KEYS, createMonster, speciesById, type Monster } from './monsters'

const draco = speciesById('draco')!
const goron = speciesById('goron')!

function scaled(m: Monster, k: number): Monster {
  const stats = { ...m.stats }
  for (const key of STAT_KEYS) stats[key] = Math.round(stats[key] * k)
  return { ...m, stats }
}

function run(b: Battle, seconds: number) {
  const events: BattleEvent[] = []
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    stepBattle(b)
    events.push(...drainBattleEvents(b))
  }
  return events
}

describe('たいかいの たたかい', () => {
  test('よーいの あと ファイト！ で はじまる', () => {
    const b = createBattle(createMonster(draco, 0, 1), createMonster(goron, 0, 2), 1)
    expect(b.f[0].hp).toBe(maxHpOf(b.f[0].monster))
    expect(b.state).toBe('ready')
    const events = run(b, READY_SECONDS + .1)
    expect(events.map(e => e.type)).toContain('go')
    expect(b.state).toBe('fight')
  })

  test('ちかい わざを えらぶと あいてに ちかづいて つかう', () => {
    const b = createBattle(createMonster(draco, 0, 1), createMonster(goron, 0, 2), 3)
    run(b, READY_SECONDS + .05)
    const before = distance(b)
    expect(before).toBeGreaterThan(NEAR)
    command(b, 0)
    expect(b.f[0].plan?.name).toBe(draco.techs[0].name)
    const events = run(b, 1.5)
    const windup = events.find(e => e.type === 'windup' && e.side === 0)
    expect(windup).toMatchObject({ tech: { name: draco.techs[0].name } })
    expect(events.some(e => (e.type === 'hit' || e.type === 'miss') && e.side === 0)).toBe(true)
  })

  test('なにも えらばないと しばらくして じぶんで うごく', () => {
    const b = createBattle(createMonster(draco, 0, 1), createMonster(goron, 0, 2), 5)
    run(b, READY_SECONDS)
    const events = run(b, AUTO_AFTER + .2)
    expect(events.some(e => e.type === 'auto')).toBe(true)
  })

  test('おまかせに すると すぐ じぶんで たたかう', () => {
    const b = createBattle(createMonster(draco, 0, 1), createMonster(goron, 0, 2), 5)
    setAuto(b, true)
    const events = run(b, READY_SECONDS + 1.5)
    expect(events.some(e => e.type === 'windup' && e.side === 0)).toBe(true)
    expect(events.some(e => e.type === 'auto')).toBe(false)
  })

  test('たいりょくが なくなると たおれて おわる', () => {
    const b = createBattle(createMonster(draco, 0, 1), createMonster(goron, 0, 2), 7)
    b.f[1].hp = 1
    setAuto(b, true)
    const events = run(b, READY_SECONDS + 10)
    expect(events.some(e => e.type === 'ko' && e.side === 1)).toBe(true)
    expect(b.state).toBe('over')
    expect(b.winner).toBe(0)
  })

  test('じかんぎれは のこりの たいりょくの わりあいで きまる', () => {
    const b = createBattle(createMonster(draco, 0, 1), createMonster(goron, 0, 2), 9)
    run(b, READY_SECONDS + .1)
    b.time = BATTLE_SECONDS - DT / 2
    b.f[0].hp = b.f[0].maxHp * .5
    b.f[1].hp = b.f[1].maxHp * .4
    const events = run(b, DT * 2)
    expect(events.some(e => e.type === 'timeup')).toBe(true)
    expect(b.winner).toBe(0)
  })

  test('おなじ たねなら おなじ けっか', () => {
    const make = () => createBattle(createMonster(draco, 0, 1), createMonster(goron, 1, 2), 11)
    const a = make(), b = make()
    simulate(a)
    simulate(b)
    expect(a.winner).toBe(b.winner)
    expect(a.time).toBe(b.time)
    expect(a.f[1].hp).toBe(b.f[1].hp)
  })

  test('つよく そだてた ほうが かちやすい', () => {
    let strong = 0, weak = 0, n = 0
    for (const a of SPECIES) for (const c of SPECIES) for (let seed = 0; seed < 3; seed++) {
      const me = createMonster(a, 0, seed), foe = createMonster(c, 0, seed + 9)
      if (simulate(createBattle(scaled(me, 1.5), foe, seed + 1)) === 0) strong++
      if (simulate(createBattle(scaled(me, .7), foe, seed + 1)) === 0) weak++
      n++
    }
    expect(strong / n).toBeGreaterThan(.85)
    expect(weak / n).toBeLessThan(.25)
  })

  test('たたかいは じかん いないに おわる', () => {
    for (const a of SPECIES) {
      const b = createBattle(createMonster(a, 0, 1), createMonster(SPECIES[(SPECIES.indexOf(a) + 1) % SPECIES.length], 0, 2), 13)
      simulate(b)
      expect(b.state).toBe('over')
      expect(b.time).toBeLessThanOrEqual(BATTLE_SECONDS + DT)
    }
  })
})
