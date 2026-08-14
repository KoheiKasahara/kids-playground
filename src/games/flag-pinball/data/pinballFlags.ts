import { countries } from '../../flag-quiz/data/countries'
import type { PinballFlag } from '../types'

/**
 * 選択画面に並べる国旗ボールの id。
 * 円形にクロップしても模様の特徴が一目で分かる国だけを選んである。
 * 表示順は 日本 → アジア → ヨーロッパ → 南北アメリカ。
 */
export const PINBALL_FLAG_IDS: readonly string[] = [
  'jp', 'kr', 'cn', 'in', 'bd',
  'gb', 'fr', 'de', 'it', 'be', 'ch', 'se', 'fi', 'gr', 'ua', 'pl',
  'us', 'ca', 'br', 'ar',
]

/**
 * PINBALL_FLAG_IDS の順に countries から解決した配列。
 * id が見つからない場合はデータ不整合なので、起動時に気付けるようここで throw する。
 */
export const pinballFlags: readonly PinballFlag[] = PINBALL_FLAG_IDS.map((id) => {
  const country = countries.find((c) => c.id === id)
  if (!country) throw new Error(`flag-pinball: countries に存在しない id が指定されています: ${id}`)
  return country
})

const pinballFlagsById = new Map(pinballFlags.map((flag) => [flag.id, flag]))

/** id から国旗ボールを引く。未知の id は undefined */
export function findPinballFlag(id: string): PinballFlag | undefined {
  return pinballFlagsById.get(id)
}
