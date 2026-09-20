import { countries } from '../../games/flag-quiz/data/countries'
import type { Continent, Country } from '../../games/flag-quiz/types'

/**
 * flag-quizのcountriesマスターに含まれない、国旗ボール専用の追加国。
 * 北マケドニアはこっきドミノで先に同じ扱い(flag-icons@7.5.0のflags/4x3/mk.svgを個別追加)を
 * しており、その前例にならう。ブルガリアも同じ配布物からflags/bg.svgを追加した。
 * クイズの出題国を増やす判断とは切り離したいため、この2か国はここでだけ持つ。
 */
const SUPPLEMENTAL_COUNTRIES: readonly Country[] = [
  { id: 'mk', nameJa: 'きたマケドニア', nameEn: 'North Macedonia', continent: 'europe', flag: 'flags/mk.svg', level: 'hard' },
  { id: 'bg', nameJa: 'ブルガリア', nameEn: 'Bulgaria', continent: 'europe', flag: 'flags/bg.svg', level: 'hard' },
]

/**
 * 国旗を使う4つのミニゲーム（ピンボール・ころころ3種）で共有する国旗ボールのデータ。
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
 * 選択画面に並べる大陸の順。
 * 近い地域がまとまって出るよう アジア → ヨーロッパ → 北米・中南米 → アフリカ → オセアニア にする。
 */
const CONTINENT_ORDER: readonly Continent[] = [
  'asia',
  'europe',
  'northAmerica',
  'southAmerica',
  'africa',
  'oceania',
]

/**
 * 国旗クイズの countries は他ゲームのマスターなので、円形表示の調整だけをここで持つ。
 * 中央クロップでは左右が各12.5%切れるため、旗竿側(左)や旗尾側(右)に意匠が寄っている
 * 国旗だけ寄せ位置を指定する。
 * ('id' は インドネシア、'in' は インド。取り違えに注意)
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

  // ここから150か国へ広げたときに足した分。どれも旗竿側(左)の意匠が中央クロップで
  // 切れてしまい、残った色だけでは他国の旗と見分けられなくなるもの。
  om: { positionX: 0 }, // ハンジャル(短剣)の紋章
  by: { positionX: 0 }, // 赤白の飾り帯
  mt: { positionX: 0 }, // ジョージ十字
  si: { positionX: 0 }, // 国章。ないと他のスラブ系三色旗と区別できない
  mz: { positionX: 0 }, // 三角の中の紋章
  vu: { positionX: 0 }, // いのししの牙の紋章
  zw: { positionX: 0 }, // ジンバブエ・バード

  // 逆に旗尾側(右)へ意匠が寄っている国旗は、右端寄せにする。
  zm: { positionX: 1 }, // 右端の3色帯とワシ
  va: { positionX: 1 }, // 右側の鍵の紋章
}

/**
 * 国旗クイズのマスター(150か国)＋ボール専用の追加国を、大陸順に並べた国旗ボール一覧。
 * ピンボール・ころころ3種の選択肢はこの一覧をそのまま使うため、
 * マスターへ国が増えれば4ゲームの選択肢もそのまま増える。
 * 並びは大陸ごとにまとめたうえで、大陸の中ではマスターの並び（よく知られた国が先）を保つ。
 */
export const flagBalls: readonly FlagBallData[] = [...countries, ...SUPPLEMENTAL_COUNTRIES]
  .map((country, order) => ({ country, order }))
  .sort(
    (left, right) =>
      CONTINENT_ORDER.indexOf(left.country.continent) - CONTINENT_ORDER.indexOf(right.country.continent) ||
      left.order - right.order,
  )
  .map(({ country }) => {
    const adjustment = BALL_ADJUSTMENTS[country.id]
    return adjustment ? { ...country, ballPositionX: adjustment.positionX } : country
  })

/**
 * 選択画面に並べる国旗ボールの id。表示順は flagBalls と同じ。
 * 保存された選択（URL・playState）の検証にも使うため、一覧とは別に公開する。
 */
export const FLAG_BALL_IDS: readonly string[] = flagBalls.map((flag) => flag.id)

const flagBallsById = new Map(flagBalls.map((flag) => [flag.id, flag]))

// 調整だけが残って対象の国が消えると、意図した寄せが黙って効かなくなる。
// データ不整合として起動時に気付けるようここで throw する。
for (const id of Object.keys(BALL_ADJUSTMENTS)) {
  if (!flagBallsById.has(id)) {
    throw new Error(`flag-ball: 存在しない id に表示調整が指定されています: ${id}`)
  }
}

/** id から国旗ボールを引く。未知の id は undefined */
export function findFlagBall(id: string): FlagBallData | undefined {
  return flagBallsById.get(id)
}
