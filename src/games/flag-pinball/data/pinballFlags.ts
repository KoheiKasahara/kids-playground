import { countries } from '../../flag-quiz/data/countries'
import type { PinballFlag } from '../types'

/**
 * 選択画面に並べる国旗ボールの id。
 * 円形にクロップしても模様の特徴が一目で分かる国を選んである。
 * 表示順は アジア → ヨーロッパ → 北米・中南米 → アフリカ → オセアニア。
 * ('id' は インドネシア、'in' は インド。取り違えに注意)
 */
export const PINBALL_FLAG_IDS: readonly string[] = [
  // アジア(11)
  'jp', 'kr', 'cn', 'in', 'bd', 'th', 'vn', 'id', 'ph', 'sg', 'pk',
  // ヨーロッパ(19)
  'gb', 'fr', 'de', 'it', 'es', 'pt', 'nl', 'be', 'ch', 'se',
  'fi', 'no', 'dk', 'gr', 'tr', 'pl', 'ua', 'at', 'ie',
  // 北米・中南米(5)
  'us', 'ca', 'mx', 'br', 'ar',
  // アフリカ(3)
  'za', 'eg', 'ke',
  // オセアニア(2)
  'au', 'nz',
]

/**
 * ピンボール専用の表示調整。countries は他ゲームと共有するマスターなので、ここだけで持つ。
 *
 * 国旗ボールは 4:3 の国旗を正方形へ object-fit: cover で入れるため、左右が各1/6ずつ切れる。
 * さらに丸くクロップするので、端に意匠がある国旗は中央寄せのままだと意匠が欠ける。
 * 実機（375px幅）で40か国すべてを目視確認し、実際に欠けたものだけをここに書く。
 * - sg: 三日月が左端にあり、中央寄せだと円のふちで半分欠けて三日月に見えない。
 *   左端寄せにすると三日月と星5つが全部入る（右側は無地の赤白なので切れても損失がない）。
 * pk（左端の白帯）/ pt（左寄りの紋章）/ au・nz（右側の星）/ us / za / ke も確認したが、
 * 中央寄せのままで意匠が読めるため調整しない。
 */
const BALL_ADJUSTMENTS: Record<string, { positionX: number }> = {
  sg: { positionX: 0 },
}

/**
 * PINBALL_FLAG_IDS の順に countries から解決した配列。
 * id が見つからない場合はデータ不整合なので、起動時に気付けるようここで throw する。
 */
export const pinballFlags: readonly PinballFlag[] = PINBALL_FLAG_IDS.map((id) => {
  const country = countries.find((c) => c.id === id)
  if (!country) throw new Error(`flag-pinball: countries に存在しない id が指定されています: ${id}`)
  const adjustment = BALL_ADJUSTMENTS[id]
  return adjustment ? { ...country, ballPositionX: adjustment.positionX } : country
})

const pinballFlagsById = new Map(pinballFlags.map((flag) => [flag.id, flag]))

/** id から国旗ボールを引く。未知の id は undefined */
export function findPinballFlag(id: string): PinballFlag | undefined {
  return pinballFlagsById.get(id)
}
