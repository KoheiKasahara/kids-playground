/**
 * 固定カメラの設定。プレイヤーはカメラを操作しない（Phase 1 の非目標）。
 *
 * 画面比だけを入力にした純粋関数にしてあるので、縦画面・横画面での
 * 見え方を実機なしでもテストできる。
 */

import { TOWER_CENTER_Z } from './bowlingStage'

export type CameraSetup = {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  fov: number
}

/** レーンのやや奥、積み木の手前を見る。ここを中心に手前と奥が均等に入る。 */
const TARGET = { x: 0, y: -0.2, z: -4.6 } as const

/**
 * カメラの位置。玉の後ろ上から、はっきり見下ろす角度で置く。
 *
 * 発射位置は積み木より高いので、カメラを低くすると手前の玉が画面中央で
 * 積み木に重なり、塔がまったく見えなくなる（実画面で確認した）。
 * 見下ろすことで、画面の下側に玉・上側に積み木という分かりやすい構図になる。
 */
const POSITION = { x: 0, y: 8.4, z: 14.2 } as const

/**
 * 積み木の塔まわりに確保したい左右の半幅[m]。
 * 塔の幅（約4.2m）に少し余白を足した値。
 *
 * ここは「塔がどれだけ大きく写るか」を決める値でもある。
 * 塔を奥へ下げたとき、この値のままだと画角を詰めて塔を同じ大きさへ
 * 拡大し返してしまい、そのぶん手前の玉が画面の外側へ押し出されて
 * 下端の操作パネルへ潜り込む（実画面で確認した）。
 * 余白を少し広げて画角を変更前と同じに保ち、
 * 「塔は少しだけ小さく＝少し遠くに見える／玉の見え方は変えない」形にしている。
 */
const REQUIRED_HALF_WIDTH = 3.75

/**
 * 塔のだいたいの位置。左右がはみ出さない画角を決めるために使う。
 *
 * Zは塔の定義から読む。塔を前後へ動かしたとき、ここが古い位置のままだと
 * 実際より近いものとして画角を決めてしまい、塔が小さく写る。
 */
const TOWER_POINT = { x: 0, y: 0.55, z: TOWER_CENTER_Z } as const

/**
 * 縦方向に最低限必要な画角[度]。
 * 手前の玉（視線の約11度下）と塔の上端（約9度上）が同時に入る大きさ。
 * 横長画面ではこちらが効いて、必要以上に引かない＝大きく見える。
 */
const VERTICAL_FOV_MIN = 30

/** 極端な画面比でも破綻しないための上下限。 */
const FOV_MIN = 28
const FOV_MAX = 52

export function bowlingCameraSetup(aspect: number): CameraSetup {
  const safeAspect = Number.isFinite(aspect) ? Math.min(3, Math.max(0.35, aspect)) : 1
  const distanceToTower = Math.hypot(
    POSITION.x - TOWER_POINT.x,
    POSITION.y - TOWER_POINT.y,
    POSITION.z - TOWER_POINT.z,
  )
  // 縦画面ほど横の画角が狭くなるので、そのぶん縦の画角を広げて塔の幅を収める。
  const fovForWidth =
    (2 * Math.atan(REQUIRED_HALF_WIDTH / distanceToTower / safeAspect) * 180) / Math.PI
  const fov = Math.min(FOV_MAX, Math.max(FOV_MIN, Math.max(VERTICAL_FOV_MIN, fovForWidth)))
  return {
    position: { ...POSITION },
    target: { ...TARGET },
    fov,
  }
}
