/**
 * スリングショット操作（ドラッグ → 発射）の変換。
 *
 * DOMにもThree.jsにも依存しない純粋な計算だけを置き、
 * 「ドラッグ距離とパワー」「ドラッグ方向と発射方向」の対応を
 * そのままテストできるようにしている。
 */

import {
  LANE_RESTITUTION,
  LAUNCH_HEIGHT_CONFIG,
  LAUNCH_PULL_MAX,
  LAUNCH_SPEED_MAX,
  LAUNCH_SPEED_MIN,
  LAUNCH_YAW_LIMIT_RAD,
  type LaunchHeightLevel,
} from './bowlingPhysics'
import type { BowlingBallSpec } from './bowlingBalls'

export type Vector3 = { x: number; y: number; z: number }

/** 画面上のドラッグ量[px]。開始点から現在点への差分。 */
export type DragVector = {
  /** 右へ引くと正。 */
  dx: number
  /** 下へ引くと正（手前へ引く＝奥へ発射）。 */
  dy: number
}

export type ViewportSize = { width: number; height: number }

export type LaunchAim = {
  /** ドラッグが引き始めとして成立しているか。これがfalseなら発射しない。 */
  active: boolean
  /** 0〜1のパワー。ドラッグ距離に比例する。 */
  power: number
  /** 左右の向き[rad]。正で右へ飛ぶ。 */
  yaw: number
  /** 玉を引く距離[m]。見た目のスリングショット表現に使う。 */
  pull: number
}

/** これ未満のドラッグは、画面に触れただけとみなして発射しない。 */
export const DRAG_DEAD_ZONE_PX = 12

/**
 * パワーが最大に達するドラッグ距離[px]。
 *
 * 端末の画面サイズに比例させる。小さい画面で最大パワーを出すのに
 * 画面外まで指を動かす必要があると、幼児には最大まで引けない。
 * 上下限は、極端に大きい/小さい画面でも「引ける長さ」に収める保険。
 */
export function fullPowerDragPx(viewport: ViewportSize): number {
  const shorterSide = Math.min(
    Number.isFinite(viewport.width) ? viewport.width : 0,
    Number.isFinite(viewport.height) ? viewport.height : 0,
  )
  const base = Math.max(shorterSide, 0) * 0.45
  return Math.min(320, Math.max(110, base))
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/**
 * ドラッグ量から狙いを決める。
 *
 * - ドラッグ距離 → パワー（0〜1）
 * - ドラッグ方向 → 発射方向（引いた向きの逆）
 *
 * 左右はLAUNCH_YAW_LIMIT_RADで制限し、幼児が真横へ撃ってしまって
 * 何も起きない投球になるのを防ぐ。前方向へは必ず飛ぶ。
 */
export function aimFromDrag(drag: DragVector, viewport: ViewportSize): LaunchAim {
  const dx = Number.isFinite(drag.dx) ? drag.dx : 0
  const dy = Number.isFinite(drag.dy) ? drag.dy : 0
  const length = Math.hypot(dx, dy)
  const fullPower = fullPowerDragPx(viewport)
  if (length <= DRAG_DEAD_ZONE_PX) {
    return { active: false, power: 0, yaw: 0, pull: 0 }
  }
  const power = clamp(
    (length - DRAG_DEAD_ZONE_PX) / Math.max(1, fullPower - DRAG_DEAD_ZONE_PX),
    0,
    1,
  )
  // 手前(下)へ引いた量だけを前方成分として扱う。
  // 上へ引いた（＝奥へ押した）場合も、後ろ向きには飛ばさず真っ直ぐ前へ出す。
  const forward = Math.max(dy, 0)
  const rawYaw = Math.atan2(-dx, Math.max(forward, 1))
  return {
    active: true,
    power,
    yaw: clamp(rawYaw, -LAUNCH_YAW_LIMIT_RAD, LAUNCH_YAW_LIMIT_RAD),
    pull: LAUNCH_PULL_MAX * power,
  }
}

/**
 * 発射方向の単位ベクトル。
 *
 * pitchRadは仰角[rad]（正で上向き、負で下向き）。狙う高さ（ひくい/ふつう/たかい）ごとに
 * bowlingPhysics.ts の LAUNCH_HEIGHT_CONFIG から渡す。ドラッグの上下量（DragVector.dy）は
 * ここには一切関わらない＝ドラッグでは高さは変わらない（aimFromDrag参照）。
 */
export function launchDirection(yaw: number, pitchRad: number): Vector3 {
  const safeYaw = clamp(yaw, -LAUNCH_YAW_LIMIT_RAD, LAUNCH_YAW_LIMIT_RAD)
  const cosPitch = Math.cos(pitchRad)
  return {
    x: Math.sin(safeYaw) * cosPitch,
    y: Math.sin(pitchRad),
    z: -Math.cos(safeYaw) * cosPitch,
  }
}

/**
 * パワーから発射速度[m/s]を決める。
 *
 * 最小でも LAUNCH_SPEED_MIN あり、弱い発射でも「コロコロ」にはならない。
 * 玉ごとの倍率（launchSpeedScale）はここでだけ掛ける。
 */
export function launchSpeed(power: number, ball: BowlingBallSpec): number {
  const p = clamp(power, 0, 1)
  const base = LAUNCH_SPEED_MIN + (LAUNCH_SPEED_MAX - LAUNCH_SPEED_MIN) * p
  return base * ball.launchSpeedScale
}

/**
 * 発射時に玉へ与える速度ベクトル。
 *
 * heightLevelは別UI（ひくい/ふつう/たかい）で選んだ値をそのまま渡す。
 * ドラッグ由来のaimには高さの情報を一切含めない（型LaunchAim参照）ので、
 * 「引っ張る量や向きで高さが勝手に変わる」ことは起きない。
 */
export function launchVelocity(
  aim: LaunchAim,
  ball: BowlingBallSpec,
  heightLevel: LaunchHeightLevel,
): Vector3 {
  const heightConfig = LAUNCH_HEIGHT_CONFIG[heightLevel]
  const speed = launchSpeed(aim.power, ball) * heightConfig.speedScale
  const direction = launchDirection(aim.yaw, heightConfig.pitchRad)
  return {
    x: direction.x * speed,
    y: direction.y * speed,
    z: direction.z * speed,
  }
}

/**
 * ドラッグ中に玉をどれだけ引き戻すか（世界座標のオフセット）。
 * 発射方向（水平成分のみ）の逆へ水平に下げるだけで、高さは変えない
 * （高さを変えると発射のたびに軌道が変わってしまう。pitchRadに0を渡すのはそのため）。
 */
export function pullOffset(aim: LaunchAim): Vector3 {
  const direction = launchDirection(aim.yaw, 0)
  const horizontal = Math.hypot(direction.x, direction.z) || 1
  return {
    x: (-direction.x / horizontal) * aim.pull,
    y: 0,
    z: (-direction.z / horizontal) * aim.pull,
  }
}

export type TrajectoryOptions = {
  gravityY: number
  /** その位置のレーン面の高さ。ここへ届いたら軌道を打ち切る。 */
  surfaceY: (z: number) => number
  /** レーン面からどれだけ上で打ち切るか（玉の半径ぶん）。 */
  clearance?: number
  /** 何秒先まで見せるか。 */
  maxTime?: number
  /** 点の数。 */
  samples?: number
}

type ArcResult = {
  points: Vector3[]
  /** 軌道が地面へ届いた瞬間の速度。地面に届かず尽きた場合はnull。 */
  landingVelocity: Vector3 | null
}

/** 放物線を等間隔サンプリングし、地面（surfaceY+clearance）へ届いたら打ち切る。 */
function simulateArc(start: Vector3, velocity: Vector3, options: TrajectoryOptions): ArcResult {
  const { gravityY, surfaceY } = options
  const clearance = options.clearance ?? 0
  const maxTime = options.maxTime ?? 1.4
  const samples = Math.max(1, Math.floor(options.samples ?? 14))
  const points: Vector3[] = []
  const dt = maxTime / samples
  let landingVelocity: Vector3 | null = null
  for (let index = 1; index <= samples; index += 1) {
    const t = index * dt
    const point: Vector3 = {
      x: start.x + velocity.x * t,
      y: start.y + velocity.y * t + 0.5 * gravityY * t * t,
      z: start.z + velocity.z * t,
    }
    points.push(point)
    if (point.y <= surfaceY(point.z) + clearance) {
      landingVelocity = { x: velocity.x, y: velocity.y + gravityY * t, z: velocity.z }
      break
    }
  }
  return { points, landingVelocity }
}

/**
 * 発射前に見せる予測軌道。
 *
 * カメラは発射方向のほぼ真後ろにあるため、玉から前方へ伸ばした矢印は
 * 奥行き方向に潰れて見えない（実画面で確認）。
 * そこで「どこへ飛ぶか」を点の並びで見せる。点の長さがそのままパワーになり、
 * 左右の曲がりが発射方向になるので、文字を読めない幼児でも分かる。
 */
export function predictTrajectory(
  start: Vector3,
  velocity: Vector3,
  options: TrajectoryOptions,
): Vector3[] {
  return simulateArc(start, velocity, options).points
}

/** 玉の反発係数から、床とぶつかったときのおおまかな反発係数を見積もる。 */
export function combinedRestitution(ballRestitution: number): number {
  return (ballRestitution + LANE_RESTITUTION) / 2
}

/** これ未満の跳ね上がり速度[m/s]では、2個目のバウンド点を出さない（最初の点とほぼ重なって見分けが付かないため）。 */
const MIN_BOUNCE_UP_SPEED = 0.6

export type BouncePreview = {
  /** 発射から最初の接地までの点列（従来の赤い軌道ガイド用）。 */
  points: Vector3[]
  /** 最初に床へ着く位置。空中で軌道が尽きた場合はnull。 */
  firstBounce: Vector3 | null
  /** 最初の接地から先、次に床へ着くと予測される位置。ほとんど跳ねない球ではnull。 */
  secondBounce: Vector3 | null
}

/**
 * 軌道プレビュー（バウンド予測つき）。
 *
 * 実際の発射計算（launchVelocity）と同じ重力・pitchRadのロジックをそのまま使うので、
 * ここで見せる弾道は実際の物理挙動とほぼ一致する。
 * バウンド後の速度は、垂直成分だけを反発係数で減衰させ、水平成分はそのまま
 * 引き継ぐ単純化した近似（実際のRapierは着地の摩擦で水平方向も減速するが、
 * プレビューは「だいたいどこで跳ねるか」が伝われば十分なため、あえて単純化してある）。
 */
export function predictBouncePreview(
  start: Vector3,
  velocity: Vector3,
  options: TrajectoryOptions & { restitution: number },
): BouncePreview {
  const first = simulateArc(start, velocity, options)
  const firstBounce = first.points[first.points.length - 1] ?? null
  if (!firstBounce || !first.landingVelocity) {
    return { points: first.points, firstBounce: null, secondBounce: null }
  }
  const restitution = Number.isFinite(options.restitution)
    ? Math.min(1, Math.max(0, options.restitution))
    : 0
  const bounceVelocity: Vector3 = {
    x: first.landingVelocity.x,
    y: -first.landingVelocity.y * restitution,
    z: first.landingVelocity.z,
  }
  if (bounceVelocity.y < MIN_BOUNCE_UP_SPEED) {
    return { points: first.points, firstBounce, secondBounce: null }
  }
  const second = simulateArc(firstBounce, bounceVelocity, options)
  const secondBounce = second.points[second.points.length - 1] ?? null
  return { points: first.points, firstBounce, secondBounce }
}
