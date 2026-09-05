/**
 * 固定カメラの設定。プレイヤーはカメラを操作しない（Phase 1 の非目標）。
 *
 * 画面比とステージだけを入力にした純粋関数にしてあるので、縦画面・横画面や
 * ステージごとの見え方を実機なしでもテストできる。
 */

import { getBowlingStage, stageBounds, type BowlingStage } from './bowlingStage'

export type CameraSetup = {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  fov: number
}

/** レーンのやや奥、積み木の手前を見る。ここを中心に手前と奥が均等に入る。 */
const TARGET = { x: 0, y: -0.2, z: -1 } as const

/**
 * カメラの位置。玉の後ろ上から、はっきり見下ろす角度で置く。
 *
 * 発射位置は積み木より高いので、カメラを低くすると手前の玉が画面中央で
 * 積み木に重なり、塔がまったく見えなくなる（実画面で確認した）。
 * 見下ろすことで、画面の下側に玉・上側に積み木という分かりやすい構図になる。
 *
 * 発射距離を伸ばした（LAUNCH_Zを7→20）のに合わせて、玉を追いかけるように
 * カメラも奥（+Z）・上（+Y）へ動かしてある。ただし積み木からの距離が
 * 開きすぎると、下のWIDTH_MARGINで吸収しきれず画角の使い分けが利かなくなる
 * （縦横比ごとの差が出なくなる）ため、玉のすぐ後ろまでは追わず、
 * 積み木と玉のほぼ中間あたりに留めている。
 */
const POSITION = { x: 0, y: 7.5, z: 27 } as const

/**
 * どのステージでも最低限確保したい左右の半幅[m]（下限）。
 *
 * ここは「積み木がどれだけ大きく写るか」を決める値でもある。
 * ステージごとの半幅(stageBounds().halfWidth)にそのままWIDTH_MARGINを足すと、
 * tower より狭いステージ（例: tall）でこの下限が効き、寄りすぎて手前の玉が
 * 画面の外側へ押し出され下端の操作パネルへ潜り込む、という事態を防ぐ
 * （実画面で確認した）。
 */
const REQUIRED_HALF_WIDTH_MIN = 3.75

/**
 * ステージの半幅へ足す余白[m]。
 *
 * 発射距離を伸ばしたぶんカメラも積み木から遠ざかったため、以前(1.65)のままだと
 * 画角が横縦比によらずVERTICAL_FOV_MINへ張り付いてしまい、「縦画面ほど画角を
 * 広げる」という使い分けが利かなくなる（実測で確認した）。ここを広げて、
 * 幅方向に必要な画角がどの縦横比でも一定以上働くようにしてある。
 */
const WIDTH_MARGIN = 2.5

/**
 * 縦方向に最低限必要な画角[度]。
 * 手前の玉と積み木の上端が同時に入る大きさ。
 * 横長画面ではこちらが効いて、必要以上に引かない＝大きく見える。
 */
const VERTICAL_FOV_MIN = 28

/** 極端な画面比でも破綻しないための上下限。 */
const FOV_MIN = 28
const FOV_MAX = 52

export function bowlingCameraSetup(
  aspect: number,
  stage: BowlingStage = getBowlingStage(undefined),
): CameraSetup {
  const safeAspect = Number.isFinite(aspect) ? Math.min(3, Math.max(0.35, aspect)) : 1
  const bounds = stageBounds(stage)
  // 距離の見積もりに使うyは常に定数0.55のまま（ステージの高さでは変えない）。
  // zはステージ側の指定(cameraZ)を優先する。tower はここへPhase 1と同じ値を
  // 明示しているので、既定ステージでは従来と完全に同じ距離・画角になる。
  const stagePoint = { x: 0, y: 0.55, z: stage.cameraZ ?? bounds.centerZ }
  const distanceToStage = Math.hypot(
    POSITION.x - stagePoint.x,
    POSITION.y - stagePoint.y,
    POSITION.z - stagePoint.z,
  )
  const requiredHalfWidth = Math.max(REQUIRED_HALF_WIDTH_MIN, bounds.halfWidth + WIDTH_MARGIN)
  // 縦画面ほど横の画角が狭くなるので、そのぶん縦の画角を広げてステージの幅を収める。
  const fovForWidth =
    (2 * Math.atan(requiredHalfWidth / distanceToStage / safeAspect) * 180) / Math.PI
  const fov = Math.min(FOV_MAX, Math.max(FOV_MIN, Math.max(VERTICAL_FOV_MIN, fovForWidth)))
  return {
    position: { ...POSITION },
    target: { ...TARGET },
    fov,
  }
}
