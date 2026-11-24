// どうぶつずかん（観察のスタンプ）。実際の動物園のスタンプラリーのように、
// どうぶつを「よく見た」「えさをあげた」「ねているところを見た」「とくいわざを見つけた」ときにスタンプがたまる。
// とくいわざ・ねている所は、ボタンでさせるのではなく、動物が自分でしているところを見つける（観察する）。
// 保存はブラウザの localStorage だけ。保存できなくても、その回の遊びの中ではスタンプを集められる。

import { SPECIES, type SpeciesId } from './species'
import { AREA_ORDER, isAreaId, type AreaId } from './zooMap'

export type StampKind = string

export type Zukan = Partial<Record<SpeciesId, StampKind[]>>

/** スタンプの見た目（ずかん・トースト）。とくいわざは、その動物の固有アクションの絵文字を使う。 */
export const BASE_STAMPS = [
  { kind: 'see', emoji: '👀', label: 'よく みた' },
  { kind: 'feed', emoji: '🍽️', label: 'えさを あげた' },
  { kind: 'sleep', emoji: '💤', label: 'ねている ところ' },
] as const

export function stampKinds(species: SpeciesId): StampKind[] {
  return [...BASE_STAMPS.map(s => s.kind), ...SPECIES[species].specials.map(s => s.clip)]
}

export function stampInfo(species: SpeciesId, kind: StampKind): { emoji: string; label: string } {
  const base = BASE_STAMPS.find(s => s.kind === kind)
  if (base) return { emoji: base.emoji, label: base.label }
  const special = SPECIES[species].specials.find(s => s.clip === kind)
  return special ? { emoji: special.emoji, label: special.label } : { emoji: '✨', label: kind }
}

export function hasStamp(zukan: Zukan, species: SpeciesId, kind: StampKind): boolean {
  return zukan[species]?.includes(kind) ?? false
}

/** スタンプを押す。新しく押せたら、新しいずかんを返す（すでにあれば undefined）。 */
export function addStamp(zukan: Zukan, species: SpeciesId, kind: StampKind): Zukan | undefined {
  if (!stampKinds(species).includes(kind) || hasStamp(zukan, species, kind)) return undefined
  return { ...zukan, [species]: [...(zukan[species] ?? []), kind] }
}

export function countStamps(zukan: Zukan, species: readonly SpeciesId[]): { got: number; total: number } {
  let got = 0
  let total = 0
  for (const id of species) {
    const kinds = stampKinds(id)
    total += kinds.length
    got += kinds.filter(k => hasStamp(zukan, id, k)).length
  }
  return { got, total }
}

/** その動物を見つけたことがあるか（ずかんで ？ にしない）。 */
export function discovered(zukan: Zukan, species: SpeciesId): boolean {
  return (zukan[species]?.length ?? 0) > 0
}

// ---------------------------------------------------------------------------
// 保存

const KEY = 'zoo-3d-v1'

export type ZooSave = { zukan: Zukan; area: AreaId }

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined
  } catch {
    return undefined
  }
}

/** 保存した内容を読む。へんなデータは捨て、知っている動物・スタンプだけを残す。 */
export function parseSave(data: unknown): ZooSave {
  const result: ZooSave = { zukan: {}, area: AREA_ORDER[0] }
  if (!data || typeof data !== 'object') return result
  const { zukan, area } = data as Record<string, unknown>
  if (isAreaId(area)) result.area = area
  if (zukan && typeof zukan === 'object') {
    for (const [id, kinds] of Object.entries(zukan as Record<string, unknown>)) {
      if (!(id in SPECIES) || !Array.isArray(kinds)) continue
      const species = id as SpeciesId
      const valid = stampKinds(species)
      const list = [...new Set(kinds.filter((k): k is string => typeof k === 'string' && valid.includes(k)))]
      if (list.length) result.zukan[species] = list
    }
  }
  return result
}

export function loadSave(): ZooSave {
  try {
    const raw = storage()?.getItem(KEY)
    return parseSave(raw ? JSON.parse(raw) : undefined)
  } catch {
    return parseSave(undefined)
  }
}

/** 保存する。保存できなかったら false（遊びはそのまま続けられる）。 */
export function writeSave(save: ZooSave): boolean {
  try {
    const s = storage()
    if (!s) return false
    s.setItem(KEY, JSON.stringify(save))
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// 観察（よく見ている時間を数えて、スタンプの条件を満たしたら知らせる）

/** 画面の高さに対して、これ以上の大きさで見えていれば「よく見ている」。 */
export const WATCH_SIZE = 0.075
/** スタンプになるまで見ている時間（秒）。 */
export const WATCH_TIME: Record<'see' | 'sleep' | 'special', number> = { see: 1.2, sleep: 1.0, special: 0.5 }

/** 画面に映る大きさ（画面の高さに対する割合）。size は動物の大きさ、fov は縦の視野角（度）。 */
export function apparentSize(size: number, dist: number, fovDeg: number): number {
  const view = 2 * Math.max(0.1, dist) * Math.tan((fovDeg * Math.PI) / 360)
  return size / view
}

export type Sighting = {
  id: string
  species: SpeciesId
  /** 画面に映る大きさ（画面外なら 0）。 */
  size: number
  /** いましていること（ねている・とくいわざ）。 */
  doing?: { kind: 'sleep' } | { kind: 'special'; clip: string }
}

/** 見ている時間をためる入れ物（動物ごと・スタンプの種類ごと）。 */
export type WatchState = Map<string, number>

/** 1フレーム分の観察。条件を満たしたスタンプ（species と kind）を返す。 */
export function observe(state: WatchState, dt: number, sightings: readonly Sighting[]): { species: SpeciesId; kind: StampKind; id: string }[] {
  const found: { species: SpeciesId; kind: StampKind; id: string }[] = []
  const alive = new Set<string>()
  const watch = (key: string, need: number, species: SpeciesId, kind: StampKind, id: string) => {
    alive.add(key)
    const before = state.get(key) ?? 0
    const t = before + dt
    state.set(key, t)
    // 足す前と後で比べる（t - dt で戻すと、小数の誤差で境目をまたいだことに気づけないことがある）
    if (before < need && t >= need) found.push({ species, kind, id })
  }
  for (const s of sightings) {
    if (s.size < WATCH_SIZE) continue
    watch(`${s.id}:see`, WATCH_TIME.see, s.species, 'see', s.id)
    if (s.doing?.kind === 'sleep') watch(`${s.id}:sleep`, WATCH_TIME.sleep, s.species, 'sleep', s.id)
    if (s.doing?.kind === 'special') watch(`${s.id}:${s.doing.clip}`, WATCH_TIME.special, s.species, s.doing.clip, s.id)
  }
  // 見るのをやめたり、動作が終わったりしたら数え直す
  for (const key of [...state.keys()]) if (!alive.has(key)) state.delete(key)
  return found
}
