import { countries } from '../../games/flag-quiz/data/countries'
import type { Country } from '../../games/flag-quiz/types'

/**
 * 2つの国旗ミニゲームで共有する国旗ボールのデータ。
 * 国旗クイズの Country をそのまま使い、円形ボールにしたときだけ必要になる
 * 横方向の表示調整を任意プロパティとして足す。ゲーム固有の得点や物理値は持たせない。
 */
export type FlagBallData = Country & {
  /**
   * 円形ボールにしたときの横方向の表示位置。0=左端寄せ / 0.5=中央 / 1=右端寄せ。
   * 省略時は中央。端に意匠がある国旗を欠けさせないためだけに使う。
   */
  ballPositionX?: number
}

/**
 * 選択画面に並べる国旗ボールの id。
 * 円形にクロップしても模様の特徴が一目で分かる国を選んである。
 * 表示順は アジア → ヨーロッパ → 北米・中南米 → アフリカ → オセアニア。
 * ('id' は インドネシア、'in' は インド。取り違えに注意)
 */
export const FLAG_BALL_IDS: readonly string[] = [
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
 * 国旗クイズの countries は他ゲームのマスターなので、円形表示の調整だけをここで持つ。
 * 国旗ボールの選択肢は40件に固定し、ピンボールと新しい冒険ゲームで同じ一覧を使う。
 */
const BALL_ADJUSTMENTS: Record<string, { positionX: number }> = {
  // 三日月と星を左側へ残すため、シンガポールだけ左端寄せにする。
  sg: { positionX: 0 },
}

/**
 * FLAG_BALL_IDS の順に countries から解決した配列。
 * id が見つからない場合はデータ不整合なので、起動時に気付けるようここで throw する。
 */
export const flagBalls: readonly FlagBallData[] = FLAG_BALL_IDS.map((id) => {
  const country = countries.find((c) => c.id === id)
  if (!country) throw new Error(`flag-ball: countries に存在しない id が指定されています: ${id}`)
  const adjustment = BALL_ADJUSTMENTS[id]
  return adjustment ? { ...country, ballPositionX: adjustment.positionX } : country
})

const flagBallsById = new Map(flagBalls.map((flag) => [flag.id, flag]))

/** id から国旗ボールを引く。未知の id は undefined */
export function findFlagBall(id: string): FlagBallData | undefined {
  return flagBallsById.get(id)
}
