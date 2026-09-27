import type { FloaterKind } from './types'

/** キャラクターの絵を描くときの基準の半径（PukupukaCharacters の座標）。 */
export const CHARACTER_BASE_RADIUS = 8

/** お知らせ・読み上げで使う仲間の名前。 */
export const FRIEND_NAMES: Record<FloaterKind, string> = {
  duck: 'アヒル',
  chick: 'ひよこ',
  ringBear: 'くま',
  boat: 'ねこ',
  frog: 'かえる',
  penguin: 'ペンギン',
}
