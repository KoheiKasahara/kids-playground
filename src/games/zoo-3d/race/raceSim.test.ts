import { describe, expect, test } from 'vitest'
import type { SpeciesId } from '../species'
import { raceById, RACES, type RaceId } from './races'
import { distanceAt, DT, narrate, planRace, poseAt, rankingAt, START_BACK, type RacePlan } from './raceSim'

/** 決まった並びの乱数（mulberry32）。 */
function seeded(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function winRates(id: RaceId, runs: number): Map<SpeciesId, number> {
  const wins = new Map<SpeciesId, number>()
  for (let seed = 1; seed <= runs; seed++) {
    const plan = planRace(raceById(id), seeded(seed * 7919))
    const w = plan.runners[plan.order[0]].species
    wins.set(w, (wins.get(w) ?? 0) + 1)
  }
  return new Map([...wins].map(([k, v]) => [k, v / runs]))
}

describe('どうぶつレースの進み方', () => {
  test('みんな ゴールし、着順は ゴールした じゅんばん。じっきょうの できごとも 時刻じゅん', () => {
    for (const race of RACES) {
      const plan = planRace(race, seeded(42))
      expect(plan.runners.map(r => r.species).sort()).toEqual([...race.runners].sort())
      expect(plan.runners.map(r => r.lane)).toEqual(race.runners.map((_, i) => i))
      const times = plan.order.map(i => plan.runners[i].finish)
      expect(times.every(Number.isFinite), race.id).toBe(true)
      expect([...times].sort((a, b) => a - b)).toEqual(times)
      expect(plan.end).toBeCloseTo(times[times.length - 1], 5)
      // 1ちゃくは、だいたい決めた秒数で ゴールする（よりみちや つまずきで おくれることも ある）
      expect(times[0], race.id).toBeGreaterThan(race.time * 0.8)
      expect(times[0], race.id).toBeLessThan(race.time * 1.6)
      expect(plan.events.map(e => e.t)).toEqual([...plan.events.map(e => e.t)].sort((a, b) => a - b))
      const finishes = plan.events.filter(e => e.type === 'finish')
      expect(finishes.map(e => e.type === 'finish' && e.place)).toEqual(race.runners.map((_, i) => i + 1))
    }
  })

  test('同じ乱数なら同じレースになり、ちがう乱数では ちがう結果も でる', () => {
    const race = raceById('savanna')
    expect(planRace(race, seeded(3)).order).toEqual(planRace(race, seeded(3)).order)
    const winners = new Set(Array.from({ length: 30 }, (_, i) => {
      const plan = planRace(race, seeded(i + 1))
      return plan.runners[plan.order[0]].species
    }))
    expect(winners.size).toBeGreaterThan(1)
  })

  test('位置は スタートの少し うしろから なめらかに進み、ゴールの先で 止まる', () => {
    const plan = planRace(raceById('derby'), seeded(5))
    for (const r of plan.runners) {
      expect(distanceAt(r, 0)).toBeCloseTo(-START_BACK, 5)
      let last = distanceAt(r, 0)
      for (let t = DT / 3; t < r.finish + 6; t += DT / 3) {
        const s = distanceAt(r, t)
        expect(s).toBeGreaterThanOrEqual(last - 1e-6)
        // 1コマで とびすぎない
        expect(s - last).toBeLessThan(0.6)
        last = s
      }
      expect(distanceAt(r, r.finish)).toBeCloseTo(plan.distance, 0)
      expect(distanceAt(r, r.finish + 20) - plan.distance).toBeLessThan(12)
      expect(distanceAt(r, r.finish + 20) - distanceAt(r, r.finish + 19)).toBeLessThan(0.05)
    }
  })

  test('よりみちの あいだは とくいわざをして止まり、1ちゃくは ゴールのあと よろこぶ', () => {
    // よりみち する動物が出るレースを探す
    let plan: RacePlan | undefined
    for (let seed = 1; !plan; seed++) {
      const p = planRace(raceById('forest'), seeded(seed))
      if (p.runners.some(r => r.acts.some(a => a.kind === 'quirk'))) plan = p
    }
    const course = raceById('forest').course
    const index = plan.runners.findIndex(r => r.acts.some(a => a.kind === 'quirk'))
    const quirk = plan.runners[index].acts.find(a => a.kind === 'quirk')!
    const mid = (quirk.from + quirk.to) / 2
    const pose = poseAt(plan, course, index, mid)
    expect(pose.clip).toBe(quirk.kind === 'quirk' && quirk.clip)
    expect(pose.speed).toBeLessThan(0.3)
    expect(plan.events).toContainEqual(expect.objectContaining({ type: 'quirk', runner: index }))

    expect(poseAt(plan, course, 0, -1)).toMatchObject({ clip: 'Idle', speed: 0, finished: false })
    expect(poseAt(plan, course, 0, 5).clip).toMatch(/Run|Walk|Idle|[A-Z]/)
    const winner = plan.order[0]
    const happy = poseAt(plan, course, winner, plan.runners[winner].finish + 6)
    expect(happy).toMatchObject({ clip: 'Happy', finished: true })
    const second = plan.order[1]
    expect(poseAt(plan, course, second, plan.runners[second].finish + 6).clip).toBe('Idle')
  })

  test('ハードルでは とびあがり、しっぱいすると つまずいて おそくなる', () => {
    const race = raceById('hurdle')
    let found = false
    for (let seed = 1; seed < 80 && !found; seed++) {
      const plan = planRace(race, seeded(seed))
      plan.runners.forEach((r, i) => {
        const jumps = r.acts.filter(a => a.kind === 'jump')
        expect(jumps.length).toBe(race.course.jumps.length)
        const hop = jumps[0]
        expect(poseAt(plan, race.course, i, (hop.from + hop.to) / 2).hop).toBeGreaterThan(0.5)
        const trip = r.acts.find(a => a.kind === 'stumble')
        if (!trip) return
        found = true
        expect(poseAt(plan, race.course, i, trip.from + 0.3).trip).toBeGreaterThan(0.3)
        expect(plan.events).toContainEqual(expect.objectContaining({ type: 'stumble', runner: i }))
      })
    }
    expect(found).toBe(true)
  })

  test('とちゅうの順位は 前にいる順、ゴールしたら 着順', () => {
    const plan = planRace(raceById('mud'), seeded(11))
    const t = plan.runners[plan.order[0]].finish / 2
    const ranking = rankingAt(plan, t)
    const ds = ranking.map(i => distanceAt(plan.runners[i], t))
    expect([...ds].sort((a, b) => b - a)).toEqual(ds)
    expect(rankingAt(plan, plan.end + 1)).toEqual(plan.order)
  })

  test('じっきょうは 間を あけて出し、3ちゃくまでと おうえんしている どうぶつの ゴールを 伝える', () => {
    const plan = planRace(raceById('hurdle'), seeded(9))
    const last = plan.order[plan.order.length - 1]
    const lines = narrate(plan, last)
    const finishes = lines.filter(e => e.type === 'finish').map(e => e.runner)
    expect(finishes).toEqual([...plan.order.slice(0, 3), last])
    const others = lines.filter(e => e.type !== 'finish')
    for (let i = 1; i < others.length; i++) expect(others[i].t - others[i - 1].t).toBeGreaterThanOrEqual(1.5 - 1e-9)
  })
})

describe('どうぶつの 運動の力が、勝ちやすさに出る', () => {
  const RUNS = 300
  const rates = new Map(RACES.map(r => [r.id, winRates(r.id, RUNS)]))

  test('どの どうぶつにも 勝つ チャンスがあり、1頭だけが勝ちすぎない', () => {
    for (const race of RACES) {
      const r = rates.get(race.id)!
      for (const id of race.runners) expect(r.get(id) ?? 0, `${race.id}: ${id}`).toBeGreaterThan(0)
      expect(Math.max(...r.values()), race.id).toBeLessThan(0.7)
    }
  }, 60_000)

  test('あしの はやさ・とくいな ことの とおりに、勝ちやすい どうぶつが きまる', () => {
    const best = (id: RaceId) => [...rates.get(id)!].sort((a, b) => b[1] - a[1])[0][0]
    const rate = (id: RaceId, s: SpeciesId) => rates.get(id)!.get(s) ?? 0
    // サバンナ: いちばん はやい チーター
    expect(best('savanna')).toBe('cheetah')
    // ダービー: かけっこの プロの ウマ。ヒツジより ラクダ（つかれない）
    expect(best('derby')).toBe('horse')
    expect(rate('derby', 'camel')).toBeGreaterThan(rate('derby', 'sheep'))
    // 森: 小回りの きく キツネか、つかれない オオカミ。のんびりやの パンダは かちにくい
    expect(['fox', 'wolf']).toContain(best('forest'))
    expect(rate('forest', 'panda')).toBeLessThan(rate('forest', 'red_panda'))
    // こおりと みず: 陸では いちばん おそい ペンギンが、およいで いちばん 勝つ
    expect(best('ice')).toBe('penguin')
    // どろんこ: サイ。どろんこが へいきな カバは クマより かちやすい
    expect(best('mud')).toBe('rhino')
    expect(rate('mud', 'hippo')).toBeGreaterThan(rate('mud', 'gorilla'))
    // ハードル: ジャンプの めいじん カンガルー。ブタは かちにくい
    expect(best('hurdle')).toBe('kangaroo')
    expect(rate('hurdle', 'pig')).toBeLessThan(rate('hurdle', 'goat'))
  }, 60_000)
})
