/**
 * 玉の定義。Phase 1 は「どっしりだま」1種類だけを持つ。
 *
 * Phase 2 で「はずむだま」「ちいさいだま」を足すときに、
 * この配列へ1件足すだけで済むよう、玉ごとに変わる値だけをここへ置いている。
 * 逆に、全部の玉で共通の値（重力・タイムステップ・発射角など）は
 * bowlingPhysics.ts 側に置き、ここには複製しない。
 */

export type BowlingBallId = 'heavy'

export type BowlingBallSpec = {
  id: BowlingBallId
  /** 画面に出す名前。 */
  name: string
  /** 半径[m]。積み木の柱1本(高さ1.0m)とほぼ同じ大きさの塊になる。 */
  radius: number
  /**
   * 密度。質量は density * (4/3)πr³ で決まる。
   * どっしりだまは約4.9kgで、積み木1個(約0.20kg)のおよそ25倍。
   */
  density: number
  friction: number
  restitution: number
  /** 発射後に勢いが落ちすぎないよう、減衰はほぼ0にしてある。 */
  linearDamping: number
  angularDamping: number
  /**
   * 発射速度の倍率。1.0 が bowlingPhysics.ts の LAUNCH_SPEED_MIN/MAX そのまま。
   * 「重い玉ほど遅い」という調整は行わない（重くても速いのがこのゲームの狙い）。
   */
  launchSpeedScale: number
  /** 見た目の色。 */
  color: number
  /** ハイライト（つや）の色。 */
  emissive: number
}

export const BOWLING_BALL_SPECS: readonly BowlingBallSpec[] = [
  {
    id: 'heavy',
    name: 'どっしりだま',
    // 大きめ。小さいと積み木の隙間を抜けてしまい、まとめて崩せない。
    radius: 0.46,
    // 重め。積み木との質量比を大きくして、当たっても玉がほとんど減速しないようにする。
    density: 12,
    // 摩擦は低め。レーンで転がり続けても速度が落ちにくい。
    friction: 0.22,
    // 跳ね返り控えめ。積み木に当たって跳ね返らず、押し切って直線的に進む。
    restitution: 0.08,
    linearDamping: 0.012,
    angularDamping: 0.05,
    launchSpeedScale: 1,
    color: 0xe8453c,
    emissive: 0x5a0f0a,
  },
]

export const DEFAULT_BOWLING_BALL_ID: BowlingBallId = 'heavy'

export function getBowlingBall(id: BowlingBallId | string | undefined): BowlingBallSpec {
  const found = BOWLING_BALL_SPECS.find((ball) => ball.id === id)
  // 未知のIDでも落とさず既定の玉へ戻す（URLや保存値が壊れていても遊べるようにする）。
  return found ?? BOWLING_BALL_SPECS[0]!
}
