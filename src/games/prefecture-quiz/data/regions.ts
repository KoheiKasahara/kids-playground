import { prefectures } from './prefectures'
import type { Prefecture, PrefectureId, RegionId } from './prefectures'

export const REGION_LABEL: Record<RegionId, string> = {
  hokkaido: 'ほっかいどう', tohoku: 'とうほく', kanto: 'かんとう', chubu: 'ちゅうぶ',
  kinki: 'きんき', chugoku: 'ちゅうごく', shikoku: 'しこく', kyushuOkinawa: 'きゅうしゅう・おきなわ',
}

/** 九州・沖縄地方では沖縄全域を座標の離れた専用insetに置く。 */
export const REGION_INSET_IDS: Partial<Record<RegionId, readonly string[]>> = {
  kyushuOkinawa: ['47'],
}

export function prefecturesForRegion(region: RegionId): readonly Prefecture[] {
  return prefectures.filter((prefecture) => prefecture.region === region)
}

export type NumberedPrefecture = { prefecture: Prefecture; number: number }

const numberedByRegion = new Map<RegionId, readonly NumberedPrefecture[]>()
const numberByPrefectureId = new Map<PrefectureId, number>()

/** 地方内の番号は都道府県コード順で固定。問題が変わっても同じ地方なら同じ番号になる。 */
export function numberedPrefecturesForRegion(region: RegionId): readonly NumberedPrefecture[] {
  const cached = numberedByRegion.get(region)
  if (cached) return cached
  const ordered = prefecturesForRegion(region).slice().sort((a, b) => a.id.localeCompare(b.id))
  const numbered = ordered.map((prefecture, index) => ({ prefecture, number: index + 1 }))
  numberedByRegion.set(region, numbered)
  numbered.forEach(({ prefecture, number }) => numberByPrefectureId.set(prefecture.id, number))
  return numbered
}

/** 都道府県が属する地方の中での固定番号（1始まり）。 */
export function prefectureNumberInRegion(prefecture: Prefecture): number {
  const cached = numberByPrefectureId.get(prefecture.id)
  if (cached !== undefined) return cached
  numberedPrefecturesForRegion(prefecture.region)
  return numberByPrefectureId.get(prefecture.id) ?? 0
}
