/**
 * 玉の定義。Phase 2 で3種類（どっしり・はずむ・ちいさい）を持つ。
 *
 * 玉ごとに変わる値だけをここへ集め、全部の玉で共通の値
 * （重力・タイムステップ・発射角など）は bowlingPhysics.ts 側に置く。
 * 数値を調整したり玉を1種類増やしたりするときは、この配列を触るだけでよい。
 *
 * 3種類の役割:
 * - どっしりだま = 破壊力（大きく重く、まとめて押し崩す）
 * - はずむだま   = 連鎖（高反発で跳ねながら複数の積み木へ当たる）
 * - ちいさいだま = スピード（小さく軽いが、3種類で最速）
 *
 * 「重い/はずむ/軽い」を数値の飾りにしないため、単なるパラメータの微調整ではなく
 * 半径・質量・反発係数・発射速度倍率のどれかで必ずはっきりした差を付けている。
 */

export type BowlingBallId = 'heavy' | 'bouncy' | 'small'

export type BowlingBallSpec = {
  id: BowlingBallId
  /** 画面に出す名前。 */
  name: string
  /** 半径[m]。 */
  radius: number
  /** 密度。質量は density * (4/3)πr³ で決まる（ballMass参照）。 */
  density: number
  friction: number
  restitution: number
  /** 発射後に勢いが落ちすぎないよう、どの玉も減衰はごく小さい値にしてある。 */
  linearDamping: number
  angularDamping: number
  /**
   * 発射速度の倍率。1.0 が bowlingPhysics.ts の LAUNCH_SPEED_MIN/MAX そのまま。
   * 「重い玉ほど遅い」という調整はしない（重くても速いのがこのゲームの狙い）。
   * ちいさいだまだけ、ここを上げて「一段速い」を作る。
   */
  launchSpeedScale: number
  /**
   * 発射位置（レーン面からの高さ）への上乗せ[m]。
   * はずむだまだけ少し高くし、着地・命中のバウンドが画面でも見えるようにする。
   */
  launchHeightOffset: number
  /** 見た目の色。 */
  color: number
  /** ハイライト（つや）の色。 */
  emissive: number
  /** 選択カードに出す絵文字アイコン。文字を読めなくても種類が伝わるようにする。 */
  icon: string
  /** 選択カードで玉を描く相対サイズ（1.0がいちばん大きい玉）。実際の半径比に合わせている。 */
  uiSizeScale: number
}

export const BOWLING_BALL_SPECS: readonly BowlingBallSpec[] = [
  {
    id: 'heavy',
    name: 'どっしりだま',
    // 3種類でいちばん大きい。小さいと積み木の隙間を抜けてしまい、まとめて崩せない。
    radius: 0.46,
    // 重い。積み木との質量比を大きくして、当たっても玉がほとんど減速しないようにする
    // （質量はおよそ4.9kgで、積み木1個(約0.20kg)のおよそ25倍）。
    density: 12,
    // 摩擦は低め。レーンで転がり続けても速度が落ちにくい。
    friction: 0.22,
    // 跳ね返り控えめ。積み木に当たって跳ね返らず、押し切って直線的に進む。
    restitution: 0.08,
    linearDamping: 0.012,
    angularDamping: 0.05,
    launchSpeedScale: 1,
    launchHeightOffset: 0,
    color: 0xe8453c,
    emissive: 0x5a0f0a,
    icon: '💪',
    uiSizeScale: 1,
  },
  {
    id: 'bouncy',
    name: 'はずむだま',
    // 中くらいの大きさ。
    radius: 0.34,
    // 中くらいの重さ（およそ1.0kg）。どっしりだまよりずっと軽く、
    // 1回で押し切るのではなく、跳ねながら複数の積み木へ当たっていく。
    // これより軽くすると、崩れて飛び散る積み木に弾かれて軌道が荒れすぎる
    // （実測: density 3.4だと1回の大きなバウンドで場外近くまで飛んでしまい、
    // 複数回跳ねる前に戻ってこなかった）。
    density: 6,
    friction: 0.16,
    // 高反発。床にも積み木にもはっきり弾む。
    // 0.74まで上げると威力のある衝突で跳ね返りが強すぎ、1回の大バウンドで
    // 終わってしまう投球が増えたため、複数回の連鎖バウンドが安定して
    // 出る0.6に調整している（どっしり0.08・ちいさい0.18よりは明確に高い）。
    restitution: 0.6,
    linearDamping: 0.006,
    angularDamping: 0.03,
    launchSpeedScale: 1,
    // 発射位置を少し高くし、落差を作ってバウンドを目立たせる。
    // 高くしすぎる（実測+0.55）と塔の上端をかすめて、そのまま空高く
    // 飛んでいって戻ってこない投球が増えたため、控えめな値にしてある。
    launchHeightOffset: 0.18,
    color: 0x2fc4c8,
    emissive: 0x043b3d,
    icon: '⚡',
    uiSizeScale: 0.72,
  },
  {
    id: 'small',
    name: 'ちいさいだま',
    // 3種類でいちばん小さい。
    radius: 0.24,
    // 軽い（およそ0.35kg）。単純な最強にしないため、質量はいちばん小さくしてある。
    density: 6,
    friction: 0.14,
    restitution: 0.18,
    linearDamping: 0,
    angularDamping: 0.02,
    // 3種類の中で唯一ここを上げ、「シュッ」と分かる速度差を作る主役にする。
    launchSpeedScale: 1.32,
    launchHeightOffset: 0,
    color: 0xffd23f,
    emissive: 0x7a4b00,
    icon: '💨',
    uiSizeScale: 0.5,
  },
]

export const DEFAULT_BOWLING_BALL_ID: BowlingBallId = 'heavy'

export function getBowlingBall(id: BowlingBallId | string | undefined): BowlingBallSpec {
  const found = BOWLING_BALL_SPECS.find((ball) => ball.id === id)
  // 未知のIDでも落とさず既定の玉へ戻す（URLや保存値が壊れていても遊べるようにする）。
  return found ?? BOWLING_BALL_SPECS[0]!
}

/** 玉の質量[kg]。density × 球の体積から求める（Rapierが内部でも同じ式を使う）。 */
export function ballMass(ball: BowlingBallSpec): number {
  return ball.density * ((4 / 3) * Math.PI * ball.radius ** 3)
}
