// つよさ ランキング。ぜんぶの むしが ぜんぶの あいてと、ぜんぶの ばしょで（じぶん・あいての がわを いれかえて）
// ほんとうの たたかいと おなじ しくみで たたかう「そうあたり たいかい」を して、かった かずで ならべる。
// たねは きまって いるので、なんど みても おなじ けっかに なる。
import { createBattle, runToEnd } from './battle'
import { SPECIES, STAT_KEYS, type Species } from './species'
import { STAGES, type StageId } from './stages'

export type LeagueMatch = { a: Species; b: Species; stage: StageId; startU: number; seed: number }

/** そうあたりの しあい（ちがう むしの くみあわせ × がわ × ばしょ）。 */
export function leagueMatches(roster: readonly Species[] = SPECIES): LeagueMatch[] {
  const matches: LeagueMatch[] = []
  for (const a of roster) {
    for (const b of roster) {
      if (a === b) continue
      for (const stage of STAGES) {
        matches.push({ a, b, stage: stage.id, startU: stage.startU, seed: 1 + matches.length * 7919 })
      }
    }
  }
  return matches
}

/** 1しあい たたかって、かった むしを かえす（じかんぎれでも はんていで かならず きまる）。 */
export function playMatch(m: LeagueMatch): Species {
  const b = runToEnd(createBattle(m.a, m.b, m.stage, m.seed, m.startU))
  return b.winner === 1 ? m.b : m.a
}

export type RankRow = { rank: number; sp: Species; wins: number; losses: number; rate: number }

function total(sp: Species) {
  return STAT_KEYS.reduce((sum, key) => sum + sp.stats[key], 0)
}

/** かった かずの おおい じゅんに ならべる。おなじ かずなら おなじ じゅんい（ならびは つよさの ごうけい → ずかんの じゅん）。 */
export function rankTable(winners: readonly Species[], roster: readonly Species[] = SPECIES): RankRow[] {
  const wins = new Map(roster.map(sp => [sp.id, 0]))
  for (const sp of winners) wins.set(sp.id, (wins.get(sp.id) ?? 0) + 1)
  // 1ぴきは あいて（ほかの ぜんぶ）× ばしょ × がわ 2つ の しあいに でる。
  const played = (roster.length - 1) * STAGES.length * 2
  const rows = roster
    .map((sp, i) => ({ sp, i, wins: wins.get(sp.id) ?? 0 }))
    .sort((x, y) => y.wins - x.wins || total(y.sp) - total(x.sp) || x.i - y.i)
  return rows.map(row => ({
    rank: rows.findIndex(other => other.wins === row.wins) + 1,
    sp: row.sp,
    wins: row.wins,
    losses: played - row.wins,
    rate: played ? row.wins / played : 0,
  }))
}
