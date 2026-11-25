// しいくいんさんの「おねがい」。エリアごとに3つの小さなお題（えさをあげる・とくいわざを見つける・
// ねている動物を見つける・ちかくでよく見る）を出し、ぜんぶできたらメダルがもらえる。
// お題の達成は、ずかんのスタンプと同じ観察の知らせ（onObserve）で判定する。スタンプを持っていても、もう一度できる。
// まだスタンプのない動物・わざを選びやすくして、ずかん集めの道しるべにする。

import { SPECIES, type SpeciesId } from './species'
import { hasStamp, stampInfo, type StampKind, type Zukan } from './zukan'
import type { AreaId } from './zooMap'

export type Mission = {
  /** null は「このエリアの どの動物でも」（ねている ところ）。 */
  species: SpeciesId | null
  kind: StampKind
}

export type MissionSet = {
  area: AreaId
  missions: Mission[]
  done: boolean[]
}

/** 1回に出すお題の数。 */
export const MISSIONS_PER_SET = 3

type Candidate = Mission & { weight: number; group: 'feed' | 'special' | 'watch' }

function pick<T extends { weight: number }>(list: T[], rand: () => number): T | undefined {
  const total = list.reduce((sum, c) => sum + c.weight, 0)
  if (total <= 0) return undefined
  let r = rand() * total
  for (const c of list) {
    r -= c.weight
    if (r < 0) return c
  }
  return list[list.length - 1]
}

/**
 * そのエリアのお題を作る。えさ・とくいわざ・みる（ねがお／よく見る）を1つずつ、ちがう動物で出す。
 * まだスタンプのないお題は選ばれやすい。
 */
export function createMissions(area: AreaId, species: readonly SpeciesId[], zukan: Zukan, rand: () => number = Math.random): MissionSet {
  const fresh = (s: SpeciesId, kind: StampKind) => (hasStamp(zukan, s, kind) ? 1 : 4)
  const candidates: Candidate[] = []
  for (const s of species) {
    candidates.push({ species: s, kind: 'feed', weight: fresh(s, 'feed'), group: 'feed' })
    for (const sp of SPECIES[s].specials) candidates.push({ species: s, kind: sp.clip, weight: fresh(s, sp.clip), group: 'special' })
    candidates.push({ species: s, kind: 'see', weight: fresh(s, 'see') * 0.5, group: 'watch' })
  }
  candidates.push({ species: null, kind: 'sleep', weight: 2, group: 'watch' })
  const missions: Mission[] = []
  const used = new Set<SpeciesId>()
  for (const group of ['feed', 'special', 'watch'] as const) {
    const options = candidates.filter(c => c.group === group && (c.species === null || !used.has(c.species)))
    const chosen = pick(options, rand)
    if (!chosen) continue
    missions.push({ species: chosen.species, kind: chosen.kind })
    if (chosen.species) used.add(chosen.species)
  }
  return { area, missions, done: missions.map(() => false) }
}

export function matches(mission: Mission, species: SpeciesId, kind: StampKind): boolean {
  return mission.kind === kind && (mission.species === null || mission.species === species)
}

/** 観察の知らせを当てはめる。新しくできたお題の番号と、新しい状態を返す（何もなければ同じ状態）。 */
export function applyObservation(set: MissionSet, species: SpeciesId, kind: StampKind): { set: MissionSet; completed: number[] } {
  const completed = set.missions.flatMap((m, i) => (!set.done[i] && matches(m, species, kind) ? [i] : []))
  if (!completed.length) return { set, completed }
  return { set: { ...set, done: set.done.map((d, i) => d || completed.includes(i)) }, completed }
}

export function allDone(set: MissionSet): boolean {
  return set.missions.length > 0 && set.done.every(Boolean)
}

/** まだできていないお題か（「みにいく」のお知らせを出すかどうか）。 */
export function isWanted(set: MissionSet | undefined, species: SpeciesId, kind: StampKind): boolean {
  return !!set && set.missions.some((m, i) => !set.done[i] && matches(m, species, kind))
}

/** お題の絵と文。 */
export function missionText(mission: Mission): { emoji: string; text: string } {
  if (mission.species === null) return { emoji: '💤', text: 'ねている どうぶつを みつけよう' }
  const s = SPECIES[mission.species]
  if (mission.kind === 'feed') return { emoji: s.food.emoji, text: `${s.name}に ${s.food.label}を あげよう` }
  if (mission.kind === 'see') return { emoji: '👀', text: `${s.name}を ちかくで よく みよう` }
  if (mission.kind === 'sleep') return { emoji: '💤', text: `${s.name}の ねがおを みつけよう` }
  const info = stampInfo(mission.species, mission.kind)
  return { emoji: info.emoji, text: `${s.name}の「${info.label}」を みつけよう` }
}
