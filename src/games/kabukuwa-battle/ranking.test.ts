import { describe, expect, test } from 'vitest'
import { leagueMatches, playMatch, rankTable } from './ranking'
import { SPECIES } from './species'
import { STAGES } from './stages'

describe('つよさ ランキング', () => {
  test('ぜんぶの むしが ぜんぶの あいてと、ぜんぶの ばしょで がわを いれかえて たたかう', () => {
    const matches = leagueMatches()
    expect(matches).toHaveLength(SPECIES.length * (SPECIES.length - 1) * STAGES.length)
    expect(matches.every(m => m.a !== m.b)).toBe(true)
    for (const sp of SPECIES) {
      expect(matches.filter(m => m.a === sp || m.b === sp), sp.id).toHaveLength((SPECIES.length - 1) * STAGES.length * 2)
    }
  })

  test('いまいる むしを ぜんぶ のせて、かった かずの じゅんに ならぶ。おなじ かずは おなじ じゅんい', () => {
    const [a, b, c] = SPECIES
    const winners = [a, a, a, b, c, c, c]
    const rows = rankTable(winners)
    expect(rows.map(r => r.sp.id).sort()).toEqual(SPECIES.map(sp => sp.id).sort())
    expect(rows.slice(0, 2).map(r => r.rank)).toEqual([1, 1])
    expect(rows[2]).toMatchObject({ rank: 3, sp: b, wins: 1 })
    expect(rows[3].rank).toBe(4)
    for (const row of rows) expect(row.wins + row.losses).toBe((SPECIES.length - 1) * STAGES.length * 2)
  })

  test('そうあたりの けっかは なんど やっても おなじで、おおきい むしが うえに くる', () => {
    const some = leagueMatches().slice(0, 40)
    expect(some.map(playMatch)).toEqual(some.map(playMatch))
    const rows = rankTable(leagueMatches().map(playMatch))
    expect(rows.reduce((sum, r) => sum + r.wins, 0)).toBe(leagueMatches().length)
    const rankOf = (id: string) => rows.find(r => r.sp.id === id)!.rank
    expect(rankOf('hercules')).toBeLessThan(rankOf('niji'))
    expect(rankOf('caucasus')).toBeLessThan(rankOf('ookuwa'))
  })
})
