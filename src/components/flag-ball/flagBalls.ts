import { countries } from '../../games/flag-quiz/data/countries'
import type { Country } from '../../games/flag-quiz/types'

/**
 * flag-quizの105か国マスターに含まれない、国旗ボール専用の追加国。
 * 北マケドニアはこっきドミノで先に同じ扱い(flag-icons@7.5.0のflags/4x3/mk.svgを個別追加)を
 * しており、その前例にならう。ブルガリアも同じ配布物からflags/bg.svgを追加した。
 * マスターを増やすとクイズ側の国数（105か国）が変わってしまうため、ここでだけ持つ。
 */
const SUPPLEMENTAL_COUNTRIES: Readonly<Record<string, Country>> = {
  mk: { id: 'mk', nameJa: 'きたマケドニア', nameEn: 'North Macedonia', continent: 'europe', flag: 'flags/mk.svg', level: 'hard' },
  bg: { id: 'bg', nameJa: 'ブルガリア', nameEn: 'Bulgaria', continent: 'europe', flag: 'flags/bg.svg', level: 'hard' },
}

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
  // アジア(19)
  'jp', 'kr', 'cn', 'in', 'bd', 'th', 'vn', 'id', 'ph', 'sg', 'pk',
  'my', 'mn', 'np', 'kz', 'il', 'sa', 'lk', 'kh',
  // ヨーロッパ(26)
  'gb', 'fr', 'de', 'it', 'es', 'pt', 'nl', 'be', 'ch', 'se',
  'fi', 'no', 'dk', 'gr', 'tr', 'pl', 'ua', 'at', 'ie',
  'cz', 'is', 'hr', 'mk', 'ro', 'hu', 'bg',
  // 北米・中南米(13)
  'us', 'ca', 'mx', 'br', 'ar', 'cl', 'co', 'jm', 'uy', 'cu', 'pe', 've', 'cr',
  // アフリカ(11)
  'za', 'eg', 'ke', 'ma', 'ng', 'et', 'tz', 'gh', 'sn', 'cm', 'dz',
  // オセアニア(6)
  'au', 'nz', 'pg', 'ws', 'fj', 'to',
]

/**
 * 国旗クイズの countries は他ゲームのマスターなので、円形表示の調整だけをここで持つ。
 * 国旗ボールの選択肢は75件に固定し、ピンボールと新しい冒険ゲームで同じ一覧を使う。
 */
const BALL_ADJUSTMENTS: Record<string, { positionX: number }> = {
  // 三日月と星を左側へ残すため、シンガポールだけ左端寄せにする。
  sg: { positionX: 0 },
  // 二又の旗の左側にある三日月と、旗の輪郭そのものが欠けないよう左端寄せにする。
  np: { positionX: 0 },
  // 旗竿側の紋章(ソヨンボ)が中央クロップだとほぼ切れて消えるため、左端寄せにする。
  mn: { positionX: 0 },
  // 左上のカントン(白地に赤十字)が中央クロップだとほぼ切れて消えるため、左端寄せにする。
  to: { positionX: 0 },
}

/**
 * FLAG_BALL_IDS の順に、countries（flag-quizマスター）→ SUPPLEMENTAL_COUNTRIES の順で解決した配列。
 * どちらにも見つからない場合はデータ不整合なので、起動時に気付けるようここで throw する。
 */
export const flagBalls: readonly FlagBallData[] = FLAG_BALL_IDS.map((id) => {
  const country = countries.find((c) => c.id === id) ?? SUPPLEMENTAL_COUNTRIES[id]
  if (!country) throw new Error(`flag-ball: countries に存在しない id が指定されています: ${id}`)
  const adjustment = BALL_ADJUSTMENTS[id]
  return adjustment ? { ...country, ballPositionX: adjustment.positionX } : country
})

const flagBallsById = new Map(flagBalls.map((flag) => [flag.id, flag]))

/** id から国旗ボールを引く。未知の id は undefined */
export function findFlagBall(id: string): FlagBallData | undefined {
  return flagBallsById.get(id)
}
