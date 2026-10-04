// ぼくじょうの すすみかた（しゅう・とっくん・やすみ・おやつ・たいかい・セーブ）。画面や 絵には さわらない 純粋な 関数。

import {
  SPECIES, STAT_KEYS, STAT_MAX, VARIANTS, speciesById, statTotal,
  type Monster, type SnackId, type Species, type StatKey, type Stats,
} from './monsters'
import { rng } from './pixel'

export const WEEKS_PER_MONTH = 4
/** 4がつ から はじまる。 */
export const START_MONTH = 4

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export type Calendar = {
  year: number
  month: number
  /** その月の なんしゅうめ（1〜4）。 */
  week: number
  season: Season
  /** たいかいの ある しゅう。 */
  tournament: boolean
  weeksToTournament: number
}

export function calendar(totalWeeks: number): Calendar {
  const monthIndex = Math.floor(totalWeeks / WEEKS_PER_MONTH) + START_MONTH - 1
  const month = (monthIndex % 12) + 1
  const week = (totalWeeks % WEEKS_PER_MONTH) + 1
  const season: Season = month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter'
  return { year: Math.floor(monthIndex / 12) + 1, month, week, season, tournament: week === WEEKS_PER_MONTH, weeksToTournament: WEEKS_PER_MONTH - week }
}

// ---------------- とっくん ----------------

export type DrillId = 'rock' | 'study' | 'run' | 'fall' | 'pull'
export type Drill = { id: DrillId; name: string; main: StatKey; sub: StatKey }

export const DRILLS: readonly Drill[] = [
  { id: 'rock', name: 'いわわり', main: 'pow', sub: 'life' },
  { id: 'study', name: 'おべんきょう', main: 'int', sub: 'spd' },
  { id: 'run', name: 'かけっこ', main: 'spd', sub: 'life' },
  { id: 'fall', name: 'たきうち', main: 'def', sub: 'int' },
  { id: 'pull', name: 'まるた ひき', main: 'life', sub: 'pow' },
]

export type Grade = 'great' | 'good' | 'fail'

/** おうえんの タップは この かずまで きく。 */
export const CHEER_MAX = 12
/** この つかれを こえると しっぱいしやすい。 */
export const TIRED = 60

const GAIN: Record<Grade, readonly [main: number, sub: number]> = { great: [16, 6], good: [11, 4], fail: [3, 1] }
const TRAIN_FATIGUE = 16

export function failChance(monster: Monster) {
  return Math.max(0, Math.min(.55, (monster.fatigue - 45) / 100))
}

/** だいせいこうの しやすさ。おうえん・なかよしで あがり、つかれで さがる。 */
export function greatChance(monster: Monster, cheer: number) {
  const c = Math.max(0, Math.min(CHEER_MAX, cheer))
  return Math.max(.05, Math.min(.85, .14 + c * .03 + monster.bond * .002 - Math.max(0, monster.fatigue - 40) * .004))
}

export function gradeFor(monster: Monster, cheer: number, roll: number): Grade {
  const fail = failChance(monster)
  if (roll < fail) return 'fail'
  return roll < fail + greatChance(monster, cheer) * (1 - fail) ? 'great' : 'good'
}

export type TrainResult = { drill: Drill; grade: Grade; gains: Partial<Stats> }

function clampStat(v: number) {
  return Math.max(0, Math.min(STAT_MAX, Math.round(v)))
}

function clamp100(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)))
}

// ---------------- ぼくじょう ----------------

export const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const
export const TOP_RANK = RANKS.length - 1
/** たいかいの あいての つよさ（のうりょくの ごうけい）。 */
export const RANK_POWER = [150, 225, 305, 395, 485, 585] as const
export const ROUND_NAMES = ['1かいせん', 'じゅんけっしょう', 'けっしょう'] as const
const ROUND_SCALE = [.86, .95, 1.04] as const

export type Farm = {
  v: 1
  monster: Monster
  /** はじめてからの しゅう。 */
  week: number
  /** いま でられる たいかいの ランク（0=E 〜 5=S）。 */
  rank: number
  /** S ランクで かった かいすう（チャンピオン）。 */
  champion: number
  /** この しゅうに なでたか・おやつを あげたか。 */
  petted: boolean
  snacked: boolean
  wins: number
  battles: number
}

export function newFarm(monster: Monster): Farm {
  return { v: 1, monster, week: 0, rank: 0, champion: 0, petted: false, snacked: false, wins: 0, battles: 0 }
}

function nextWeek(farm: Farm, monster: Monster): Farm {
  return { ...farm, monster, week: farm.week + 1, petted: false, snacked: false }
}

/** とっくんを して 1しゅう すすめる。 */
export function train(farm: Farm, drillId: DrillId, cheer: number, roll: number): { farm: Farm; result: TrainResult } {
  const drill = DRILLS.find(d => d.id === drillId) ?? DRILLS[0]
  const species = speciesOf(farm.monster)
  const grade = gradeFor(farm.monster, cheer, roll)
  const [main, sub] = GAIN[grade]
  const gains: Partial<Stats> = {}
  gains[drill.main] = Math.max(1, Math.round(main * species.growth[drill.main]))
  gains[drill.sub] = Math.round(sub * species.growth[drill.sub])
  const stats = { ...farm.monster.stats }
  for (const key of STAT_KEYS) {
    const before = stats[key]
    stats[key] = clampStat(before + (gains[key] ?? 0))
    if (gains[key] !== undefined) gains[key] = stats[key] - before
  }
  const monster: Monster = {
    ...farm.monster,
    stats,
    fatigue: clamp100(farm.monster.fatigue + TRAIN_FATIGUE),
    bond: clamp100(farm.monster.bond + (grade === 'great' ? 2 : 1)),
  }
  return { farm: nextWeek(farm, monster), result: { drill, grade, gains } }
}

/** ゆっくり やすんで 1しゅう すすめる。 */
export function rest(farm: Farm): Farm {
  return nextWeek(farm, { ...farm.monster, fatigue: clamp100(farm.monster.fatigue - 65), bond: clamp100(farm.monster.bond + 2) })
}

/** おやつ（1しゅうに 1かい）。すきな ものだと とても よろこぶ。 */
export function giveSnack(farm: Farm, snack: SnackId): { farm: Farm; liked: boolean } {
  if (farm.snacked) return { farm, liked: false }
  const liked = speciesOf(farm.monster).likes === snack
  const monster = {
    ...farm.monster,
    bond: clamp100(farm.monster.bond + (liked ? 6 : 3)),
    fatigue: clamp100(farm.monster.fatigue - (liked ? 10 : 5)),
  }
  return { farm: { ...farm, monster, snacked: true }, liked }
}

/** なでる。1しゅうに 1かいだけ なかよしが あがる（なんかい なでても よい）。 */
export function pet(farm: Farm): Farm {
  if (farm.petted) return farm
  return { ...farm, petted: true, monster: { ...farm.monster, bond: clamp100(farm.monster.bond + 3) } }
}

export function speciesOf(monster: Monster): Species {
  return speciesById(monster.species) ?? SPECIES[0]
}

export function rankName(rank: number) {
  return `${RANKS[Math.max(0, Math.min(TOP_RANK, rank))]}ランク`
}

// ---------------- たいかい ----------------

const FOE_NAMES: Record<string, readonly string[]> = {
  puru: ['ぷるる', 'ぷにお', 'ぷるりん'],
  draco: ['ガルド', 'ドラッチ', 'ボルカ'],
  mofu: ['モフリン', 'ふわみ', 'ラビ'],
  goron: ['ガンセキ', 'ゴロタ', 'ロック'],
  piko: ['ピピ', 'チュンタ', 'ハネル'],
  fuwari: ['ユラリ', 'オバッチ', 'ミスト'],
}

/** たいかいの あいて 3にん。ランクと ラウンドで つよさが きまる。 */
export function tournamentFoes(farm: Farm, seed: number): Monster[] {
  const r = rng(seed)
  const rank = Math.max(0, Math.min(TOP_RANK, farm.rank))
  const champion = rank === TOP_RANK ? Math.min(6, farm.champion) : 0
  const power = RANK_POWER[rank] * (1 + champion * .08)
  const picked = new Set<string>()
  return ROUND_SCALE.map((scale, round) => {
    let species = SPECIES[Math.floor(r() * SPECIES.length)]
    for (let i = 0; i < 4 && picked.has(species.id); i++) species = SPECIES[Math.floor(r() * SPECIES.length)]
    picked.add(species.id)
    const weights = STAT_KEYS.map(key => species.base[key] * species.growth[key] * (.85 + r() * .3))
    const sum = weights.reduce((a, b) => a + b, 0)
    const total = power * scale
    const stats = {} as Stats
    STAT_KEYS.forEach((key, i) => { stats[key] = clampStat(total * weights[i] / sum) })
    const names = FOE_NAMES[species.id] ?? [species.name]
    return {
      species: species.id,
      variant: r() < .1 ? VARIANTS - 1 : Math.floor(r() * 3),
      name: names[(round + Math.floor(r() * names.length)) % names.length],
      stats,
      fatigue: 0,
      bond: 40 + rank * 8,
    }
  })
}

/** たいかいが おわった。ぜんぶ かったら ランクが あがる。 */
export function finishTournament(farm: Farm, roundsWon: number): { farm: Farm; champion: boolean; rankUp: boolean } {
  const won = roundsWon >= ROUND_SCALE.length
  const monster = {
    ...farm.monster,
    fatigue: clamp100(farm.monster.fatigue + 10 + roundsWon * 5),
    bond: clamp100(farm.monster.bond + (won ? 6 : 2)),
  }
  const rankUp = won && farm.rank < TOP_RANK
  const champion = won && farm.rank === TOP_RANK
  const next = nextWeek({
    ...farm,
    rank: rankUp ? farm.rank + 1 : farm.rank,
    champion: farm.champion + (champion ? 1 : 0),
    wins: farm.wins + roundsWon,
    battles: farm.battles + Math.min(ROUND_SCALE.length, roundsWon + (won ? 0 : 1)),
  }, monster)
  return { farm: next, champion, rankUp }
}

/** つぎの たいかいの めやす（ごうけいの つよさ）。 */
export function rankPower(farm: Farm) {
  const rank = Math.max(0, Math.min(TOP_RANK, farm.rank))
  return Math.round(RANK_POWER[rank] * (rank === TOP_RANK ? 1 + Math.min(6, farm.champion) * .08 : 1))
}

/** つよさの めやす（3だんかい）。 */
export function readiness(farm: Farm): 'strong' | 'even' | 'weak' {
  const ratio = statTotal(farm.monster.stats) / rankPower(farm)
  return ratio >= 1.05 ? 'strong' : ratio >= .9 ? 'even' : 'weak'
}

// ---------------- セーブ ----------------

export const SAVE_KEY = 'dot-monster-farm-v1'
const DEX_KEY = 'dot-monster-farm-dex-v1'
const MUSIC_KEY = 'dot-monster-farm-music-v1'

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

/** ほぞんされた データを たしかめる。こわれて いたら null（はじめから）。 */
export function parseFarm(raw: unknown): Farm | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Partial<Farm>
  const m = f.monster as Partial<Monster> | undefined
  if (f.v !== 1 || !m || typeof m !== 'object') return null
  if (typeof m.species !== 'string' || !speciesById(m.species)) return null
  if (!isInt(m.variant, 0, VARIANTS - 1) || typeof m.name !== 'string' || !m.name) return null
  if (!m.stats || typeof m.stats !== 'object') return null
  const stats = {} as Stats
  for (const key of STAT_KEYS) {
    const v = (m.stats as Partial<Stats>)[key]
    if (!isInt(v, 0, STAT_MAX)) return null
    stats[key] = v
  }
  if (!isInt(m.fatigue, 0, 100) || !isInt(m.bond, 0, 100)) return null
  if (!isInt(f.week, 0, 1e6) || !isInt(f.rank, 0, TOP_RANK) || !isInt(f.champion, 0, 1e6)) return null
  if (!isInt(f.wins, 0, 1e6) || !isInt(f.battles, 0, 1e6)) return null
  return {
    v: 1,
    monster: { species: m.species as Monster['species'], variant: m.variant, name: m.name.slice(0, 12), stats, fatigue: m.fatigue, bond: m.bond },
    week: f.week,
    rank: f.rank,
    champion: f.champion,
    petted: f.petted === true,
    snacked: f.snacked === true,
    wins: f.wins,
    battles: f.battles,
  }
}

export function loadFarm(): Farm | null {
  try {
    const text = localStorage.getItem(SAVE_KEY)
    return text ? parseFarm(JSON.parse(text)) : null
  } catch {
    return null
  }
}

export function saveFarm(farm: Farm) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(farm)) } catch { /* ほぞん できなくても あそべる */ }
}

export function clearFarm() {
  try { localStorage.removeItem(SAVE_KEY) } catch { /* なにも しない */ }
}

/** ずかん（であった しゅるいと いろ）。'puru:0' の ような もじの あつまり。 */
export function readDex(): Set<string> {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(DEX_KEY) ?? '[]')
    if (!Array.isArray(list)) return new Set()
    return new Set(list.filter((v): v is string => typeof v === 'string' && /^[a-z]+:\d$/.test(v)))
  } catch {
    return new Set()
  }
}

export function addDex(monster: Monster) {
  const dex = readDex()
  dex.add(`${monster.species}:${monster.variant}`)
  try { localStorage.setItem(DEX_KEY, JSON.stringify([...dex])) } catch { /* なにも しない */ }
  return dex
}

export function readMusic(): boolean {
  try { return localStorage.getItem(MUSIC_KEY) !== 'off' } catch { return true }
}

export function writeMusic(on: boolean) {
  try { localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off') } catch { /* なにも しない */ }
}
