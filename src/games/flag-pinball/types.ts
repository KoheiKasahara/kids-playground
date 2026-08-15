import type { Country } from '../flag-quiz/types'

/**
 * ピンボールで使う国旗ボール。国旗クイズの Country を再利用し、
 * 丸くクロップしたときだけ必要になる表示調整を任意プロパティとして足す。
 */
export type PinballFlag = Country & {
  /**
   * 円形ボールにしたときの横方向の表示位置。0=左端寄せ / 0.5=中央 / 1=右端寄せ。
   * 省略時は中央。端に意匠がある国旗を欠けさせないためだけに使う。
   */
  ballPositionX?: number
}

/** 遊びかた。'normal' = 自分で3こ選ぶ / 'allFlags' = 選べる国旗をぜんぶ順番に射出する */
export type PinballMode = 'normal' | 'allFlags'

/** 通常モード('normal')で選ぶボールの数。全射出モードの球数は選べる国旗の総数になる */
export const BALL_COUNT = 3

/** 1球の得点結果。ballIndex は 0..BALL_COUNT-1 で、選択順と一致する */
export type BallResult = { ballIndex: number; flagId: string; score: number }
