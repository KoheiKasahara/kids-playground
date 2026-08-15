/**
 * 国旗ボールの実体は2ゲーム共通の components/flag-ball に移した。
 * この薄い互換exportは既存のピンボール固有importとテストをそのまま維持するために残す。
 */
export {
  FLAG_BALL_IDS as PINBALL_FLAG_IDS,
  flagBalls as pinballFlags,
  findFlagBall as findPinballFlag,
} from '../../../components/flag-ball/flagBalls'
