import type { Country } from '../flag-quiz/types'

/** ピンボールで使う国旗ボール。国旗クイズの Country をそのまま再利用する */
export type PinballFlag = Country

/** 1プレイで射出するボールの数 */
export const BALL_COUNT = 3

/** 1球の得点結果。ballIndex は 0..BALL_COUNT-1 で、選択順と一致する */
export type BallResult = { ballIndex: number; flagId: string; score: number }
