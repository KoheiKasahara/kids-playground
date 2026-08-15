import type { FlagBallData } from '../../components/flag-ball/flagBalls'

/**
 * 既存のピンボール固有名を残した互換別名。
 * 国旗ボールを2ゲームの共通基盤へ移したあとも、既存シグネチャとテストのimportを
 * 一度に書き換えずに済むよう、型だけを FlagBallData へ向ける。
 */
export type PinballFlag = FlagBallData

/** 1プレイで射出するボールの数 */
export const BALL_COUNT = 3

/** 1球の得点結果。ballIndex は 0..BALL_COUNT-1 で、選択順と一致する */
export type BallResult = { ballIndex: number; flagId: string; score: number }
