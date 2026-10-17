// レーンの おすし・たべた おさらの かず・ガチャけん・たからものを ブラウザに ほぞんする。
// ほぞん できなくても（プライベートモードなど）あそべる。

import { isPrize, type PrizeId } from './data'
import { LANE_CAPACITY } from './lane'
import { parseRecipe, type Recipe } from './recipe'

const KEY = 'kaiten-sushi-v1'

export type SushiSave = {
  lane: Recipe[]
  eaten: number
  tickets: number
  prizes: PrizeId[]
}

export const EMPTY_SAVE: SushiSave = { lane: [], eaten: 0, tickets: 0, prizes: [] }

const count = (v: unknown, max: number) => (Number.isInteger(v) && (v as number) >= 0 ? Math.min(max, v as number) : 0)

/** ほぞんした ものを もどす。おかしな ところは すてて、つかえる ものだけ のこす。 */
export function parseSave(data: unknown): SushiSave {
  if (!data || typeof data !== 'object') return { ...EMPTY_SAVE }
  const { lane, eaten, tickets, prizes } = data as Record<string, unknown>
  return {
    lane: Array.isArray(lane) ? lane.map(parseRecipe).filter((r): r is Recipe => r !== null).slice(0, LANE_CAPACITY) : [],
    eaten: count(eaten, 99999),
    tickets: count(tickets, 99),
    prizes: Array.isArray(prizes) ? [...new Set(prizes.filter(isPrize))] : [],
  }
}

export function readSave(): SushiSave {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? parseSave(JSON.parse(raw)) : { ...EMPTY_SAVE }
  } catch {
    return { ...EMPTY_SAVE }
  }
}

export function writeSave(save: SushiSave): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(save))
  } catch {
    // ほぞん できなくても その ばで あそべる。
  }
}
