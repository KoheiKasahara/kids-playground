// どうぶつレースの きろく: 種目ごとに、1ちゃくに なったことのある動物。
// 「みんなを 1ちゃくに しよう」と、なんども見る楽しみにする。保存はブラウザの localStorage だけで、
// 保存できなくても その回の遊びの中では きろくが のこる。

import { SPECIES_ORDER, type SpeciesId } from '../species'
import { isRaceId, raceById, type RaceId } from './races'

export type RaceRecord = Partial<Record<RaceId, SpeciesId[]>>

const KEY = 'zoo-3d-race-v1'

export function loadRecord(): RaceRecord {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown
    if (!raw || typeof raw !== 'object') return {}
    const wins = (raw as { wins?: unknown }).wins
    if (!wins || typeof wins !== 'object') return {}
    const out: RaceRecord = {}
    for (const [id, list] of Object.entries(wins)) {
      if (!isRaceId(id) || !Array.isArray(list)) continue
      const runners = raceById(id).runners
      out[id] = list.filter((s): s is SpeciesId => (SPECIES_ORDER as string[]).includes(s) && runners.includes(s as SpeciesId))
    }
    return out
  } catch {
    return {}
  }
}

/** 1ちゃくを きろくする。はじめての 1ちゃくなら true。 */
export function addWin(record: RaceRecord, race: RaceId, winner: SpeciesId): { record: RaceRecord; first: boolean } {
  const list = record[race] ?? []
  if (list.includes(winner)) return { record, first: false }
  return { record: { ...record, [race]: [...list, winner] }, first: true }
}

export function saveRecord(record: RaceRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ wins: record }))
  } catch {
    // 保存できない端末でも、その回の きろくは画面に のこる
  }
}
