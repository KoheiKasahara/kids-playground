import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  CHEER_MAX, DRILLS, RANK_POWER, ROUND_NAMES, SAVE_KEY, TOP_RANK, addDex, calendar, failChance, finishTournament, giveSnack,
  gradeFor, greatChance, loadFarm, newFarm, parseFarm, pet, readDex, readiness, rest, saveFarm, tournamentFoes, train, type Farm,
} from './farm'
import { SPECIES, STAT_KEYS, createMonster, speciesById, statTotal } from './monsters'

const draco = speciesById('draco')!
const farmOf = (overrides: Partial<Farm['monster']> = {}, farm: Partial<Farm> = {}): Farm => ({
  ...newFarm({ ...createMonster(draco, 0, 1), ...overrides }),
  ...farm,
})

describe('calendar', () => {
  test('4がつ 1しゅうめ から はじまり、4しゅうめが たいかい', () => {
    expect(calendar(0)).toMatchObject({ year: 1, month: 4, week: 1, season: 'spring', tournament: false, weeksToTournament: 3 })
    expect(calendar(3)).toMatchObject({ month: 4, week: 4, tournament: true, weeksToTournament: 0 })
    expect(calendar(4)).toMatchObject({ month: 5, week: 1 })
  })

  test('きせつが めぐり、1ねん たつと 2ねんめに なる', () => {
    expect(calendar(4 * 2).season).toBe('summer')
    expect(calendar(4 * 5).season).toBe('autumn')
    expect(calendar(4 * 8)).toMatchObject({ month: 12, season: 'winter' })
    expect(calendar(4 * 9)).toMatchObject({ year: 2, month: 1, season: 'winter' })
    expect(calendar(4 * 12)).toMatchObject({ year: 2, month: 4, season: 'spring' })
  })
})

describe('とっくん', () => {
  test('えらんだ のうりょくが のび、つかれて 1しゅう すすむ', () => {
    const farm = farmOf({}, { petted: true, snacked: true })
    const { farm: next, result } = train(farm, 'rock', 0, .99)
    expect(result.grade).toBe('good')
    expect(result.gains.pow).toBe(Math.round(11 * draco.growth.pow))
    expect(next.monster.stats.pow).toBe(farm.monster.stats.pow + result.gains.pow!)
    expect(next.monster.stats.life).toBeGreaterThan(farm.monster.stats.life)
    expect(next.monster.stats.int).toBe(farm.monster.stats.int)
    expect(next.monster.fatigue).toBeGreaterThan(farm.monster.fatigue)
    expect(next.week).toBe(1)
    expect(next.petted).toBe(false)
    expect(next.snacked).toBe(false)
  })

  test('おうえんする ほど だいせいこうに なりやすい', () => {
    const farm = farmOf()
    expect(greatChance(farm.monster, CHEER_MAX)).toBeGreaterThan(greatChance(farm.monster, 0) + .25)
    // おうえん なしでは せいこう、いっぱい おうえんすると だいせいこうに なる さいころの め。
    const roll = greatChance(farm.monster, 0) + .1
    expect(gradeFor(farm.monster, 0, roll)).toBe('good')
    expect(gradeFor(farm.monster, CHEER_MAX, roll)).toBe('great')
    expect(train(farm, 'run', CHEER_MAX, roll).result.grade).toBe('great')
  })

  test('つかれて いると しっぱい しやすく、げんきなら しっぱい しない', () => {
    expect(failChance(farmOf({ fatigue: 0 }).monster)).toBe(0)
    expect(failChance(farmOf({ fatigue: 90 }).monster)).toBeGreaterThan(.3)
    const { result } = train(farmOf({ fatigue: 90 }), 'study', 0, 0)
    expect(result.grade).toBe('fail')
    expect(result.gains.int).toBeGreaterThan(0)
  })

  test('どの とっくんも それぞれの のうりょくを のばす', () => {
    const mains = new Set(DRILLS.map(d => d.main))
    expect(mains).toEqual(new Set(STAT_KEYS))
    for (const drill of DRILLS) {
      const farm = farmOf()
      const { farm: next } = train(farm, drill.id, 4, .5)
      expect(next.monster.stats[drill.main]).toBeGreaterThan(farm.monster.stats[drill.main])
    }
  })

  test('のうりょくは うえの かぎりを こえない', () => {
    const farm = farmOf({ stats: { life: 999, pow: 998, int: 10, spd: 10, def: 10 } })
    const { farm: next, result } = train(farm, 'rock', CHEER_MAX, .5)
    expect(next.monster.stats.pow).toBe(999)
    expect(next.monster.stats.life).toBe(999)
    expect(result.gains.pow).toBe(1)
  })
})

describe('やすみ・おやつ・なでる', () => {
  test('やすむと つかれが とれて 1しゅう すすむ', () => {
    const next = rest(farmOf({ fatigue: 80 }))
    expect(next.monster.fatigue).toBe(15)
    expect(next.week).toBe(1)
  })

  test('おやつは 1しゅうに 1かい。すきな ものは もっと よろこぶ', () => {
    const farm = farmOf({ bond: 20, fatigue: 40 })
    const liked = giveSnack(farm, draco.likes)
    expect(liked.liked).toBe(true)
    expect(liked.farm.snacked).toBe(true)
    const other = giveSnack(farm, 'cookie')
    expect(other.liked).toBe(false)
    expect(liked.farm.monster.bond).toBeGreaterThan(other.farm.monster.bond)
    expect(giveSnack(liked.farm, draco.likes).farm).toBe(liked.farm)
  })

  test('なでると 1しゅうに 1かい なかよしが あがる', () => {
    const farm = farmOf({ bond: 20 })
    const once = pet(farm)
    expect(once.monster.bond).toBe(23)
    expect(pet(once)).toBe(once)
  })
})

describe('たいかい', () => {
  test('あいては 3にんで、あとの しあいほど つよい', () => {
    const farm = farmOf()
    const foes = tournamentFoes(farm, 42)
    expect(foes).toHaveLength(ROUND_NAMES.length)
    const totals = foes.map(f => statTotal(f.stats))
    expect(totals[0]).toBeLessThan(totals[2])
    for (const total of totals) expect(Math.abs(total - RANK_POWER[0])).toBeLessThan(RANK_POWER[0] * .15)
    expect(tournamentFoes(farm, 42)).toEqual(foes)
    expect(new Set(foes.map(f => f.species)).size).toBeGreaterThan(1)
  })

  test('ランクが あがると あいても つよく なる', () => {
    const low = tournamentFoes(farmOf({}, { rank: 0 }), 1).map(f => statTotal(f.stats))
    const high = tournamentFoes(farmOf({}, { rank: 4 }), 1).map(f => statTotal(f.stats))
    expect(Math.min(...high)).toBeGreaterThan(Math.max(...low) * 2)
  })

  test('ぜんぶ かつと ランクが あがり、Sランクで かつと チャンピオン', () => {
    const won = finishTournament(farmOf(), 3)
    expect(won.rankUp).toBe(true)
    expect(won.farm.rank).toBe(1)
    expect(won.farm.wins).toBe(3)
    expect(won.farm.week).toBe(1)
    const top = finishTournament(farmOf({}, { rank: TOP_RANK }), 3)
    expect(top.champion).toBe(true)
    expect(top.farm.rank).toBe(TOP_RANK)
    expect(top.farm.champion).toBe(1)
  })

  test('まけると ランクは そのまま', () => {
    const lost = finishTournament(farmOf({}, { rank: 2 }), 1)
    expect(lost.rankUp).toBe(false)
    expect(lost.farm.rank).toBe(2)
    expect(lost.farm.wins).toBe(1)
    expect(lost.farm.battles).toBe(2)
  })

  test('つよさの めやす', () => {
    const weak = farmOf({ stats: { life: 20, pow: 20, int: 20, spd: 20, def: 20 } })
    expect(readiness(weak)).toBe('weak')
    const strong = farmOf({ stats: { life: 40, pow: 40, int: 40, spd: 40, def: 40 } })
    expect(readiness(strong)).toBe('strong')
  })
})

describe('セーブ', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  test('ほぞんして よみだせる', () => {
    const farm = train(farmOf(), 'rock', 3, .4).farm
    saveFarm(farm)
    expect(loadFarm()).toEqual(farm)
  })

  test('こわれた データは つかわない', () => {
    const good = JSON.parse(JSON.stringify(farmOf())) as Farm
    expect(parseFarm(good)).toEqual(good)
    const broken: unknown[] = [
      null, 'farm', 3, {}, { ...good, v: 2 },
      { ...good, monster: { ...good.monster, species: 'unicorn' } },
      { ...good, monster: { ...good.monster, variant: 9 } },
      { ...good, monster: { ...good.monster, stats: { ...good.monster.stats, pow: 5000 } } },
      { ...good, monster: { ...good.monster, stats: { ...good.monster.stats, int: 'a' } } },
      { ...good, monster: { ...good.monster, fatigue: -1 } },
      { ...good, rank: 6 },
      { ...good, week: 1.5 },
    ]
    for (const raw of broken) expect(parseFarm(raw)).toBeNull()
    store.set(SAVE_KEY, '{not json')
    expect(loadFarm()).toBeNull()
  })

  test('ずかんに であった モンスターを のこす', () => {
    expect(readDex().size).toBe(0)
    addDex(createMonster(SPECIES[0], 3, 1))
    addDex(createMonster(SPECIES[1], 0, 1))
    expect(readDex()).toEqual(new Set(['puru:3', 'draco:0']))
  })

  test('localStorage が つかえなくても とまらない', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    })
    expect(loadFarm()).toBeNull()
    expect(() => saveFarm(farmOf())).not.toThrow()
    expect(readDex().size).toBe(0)
  })
})
