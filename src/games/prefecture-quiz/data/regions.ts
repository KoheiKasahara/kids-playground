import { prefectures } from './prefectures'
import type { Prefecture, RegionId } from './prefectures'

export const REGION_LABEL: Record<RegionId, string> = {
  hokkaido: 'ほっかいどう', tohoku: 'とうほく', kanto: 'かんとう', chubu: 'ちゅうぶ',
  kinki: 'きんき', chugoku: 'ちゅうごく', shikoku: 'しこく', kyushuOkinawa: 'きゅうしゅう・おきなわ',
}

/** 地方主図で輪郭だけでは押しにくい県の、重ならない補助タップ枠。 */
export const REGION_TOUCH_TARGET_IDS: Partial<Record<RegionId, readonly string[]>> = {
  kanto: ['11', '13', '14'],
  kinki: ['25', '27', '29'],
  kyushuOkinawa: ['41'],
}

/** 九州・沖縄地方では沖縄全域を座標の離れた専用insetに置く。 */
export const REGION_INSET_IDS: Partial<Record<RegionId, readonly string[]>> = {
  kyushuOkinawa: ['47'],
}

export function prefecturesForRegion(region: RegionId): readonly Prefecture[] {
  return prefectures.filter((prefecture) => prefecture.region === region)
}
