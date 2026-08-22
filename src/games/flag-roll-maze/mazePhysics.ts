import type { TiltInput } from './tiltInput'

/**
 * 盤面を傾ける代わりに、重力ベクトルの向きを変えて転がす。
 * こうすると床コライダーを毎フレーム動かさずに済み、
 * Phase 2でジャイロ入力へ差し替えても物理側は一切変わらない。
 */

/** 幼児が追いかけられる速さで転がるよう、実スケールより弱い重力にする。 */
export const GRAVITY_MAGNITUDE = 12

/**
 * 最大入力でも盤面は18°までしか傾けない。
 * 転がり球の加速度は約 (5/7)·g·sinθ なので、最大でも 2.7 前後に収まる。
 */
export const MAX_TILT_RAD = (18 * Math.PI) / 180

/** 見た目の盤面はこの割合だけ傾け、操作の手応えを出しつつ酔いにくくする。 */
export const VISUAL_TILT_RATIO = 0.62

/** 接触が薄いコライダーを抜けないよう、表示より細かい120Hzで積分する。 */
export const PHYSICS_TIMESTEP = 1 / 120

/** 低速端末で物理計算が雪だるま式に増えないよう、1フレーム4回までにする。 */
export const MAX_PHYSICS_SUBSTEPS = 4

/** タブ復帰時の巨大な時間跳躍を物理へ渡さない。 */
export const MAX_FRAME_DELTA_MS = 100

/**
 * 旗が画面で見えるよう従来の1.5倍にした半径。
 * この値をコース寸法の基準単位 R とし、床・壁・通路をRの倍率で定義する。
 */
export const BALL_RADIUS = 0.63

/** 1マスを3Rにして、直径2Rのボールの左右へ片側0.5Rの余白を確保する。 */
export const CELL_SIZE_IN_RADII = 3.0

/** スポーン位置を0.03Rだけ浮かせ、初期フレームで球が床へめり込むのを防ぐ。 */
export const BALL_SPAWN_CLEARANCE_IN_RADII = 0.03

/** 密度ではなく質量を直接与え、盤面サイズを変えても手触りを固定する。 */
export const BALL_MASS = 1

/** 転がり続けても加速し切らないよう、わずかな減衰を掛ける。 */
export const BALL_LINEAR_DAMPING = 0.42
export const BALL_ANGULAR_DAMPING = 0.55

/** 滑るのではなく転がるように、床と球の摩擦は高めにする。 */
export const BALL_FRICTION = 0.7
export const FLOOR_FRICTION = 0.85
export const WALL_FRICTION = 0.25

/** 壁で跳ね返って迷子にならないよう、反発はほぼ殺す。 */
export const BALL_RESTITUTION = 0.08
export const WALL_RESTITUTION = 0.02

/** これ以上速くならない上限。壁抜けと「速すぎて操作できない」を同時に防ぐ。 */
export const MAX_BALL_SPEED = 5.4

/**
 * 床は球半径に近い0.95Rの厚みを持たせ、盤面全体を連続して支えつつ床を抜けないようにする。
 */
export const FLOOR_THICKNESS = BALL_RADIUS * 0.95

/** 壁は球の直径2Rより0.2R高い2.2Rとし、最大傾斜でも乗り越えられない高さを確保する。 */
export const WALL_HEIGHT = BALL_RADIUS * 2.2

/** 球の中心が1.05R以内なら判定を取りこぼさず、1マスの半分1.5R未満に収めて隣へ広がらないようにする。 */
export const GOAL_RADIUS = BALL_RADIUS * 1.05

/** 盤面より9.5R下まで落ちた場合だけ場外とみなし、通常の跳ね返りで誤判定しない。 */
export const FALL_OUT_Y = -BALL_RADIUS * 9.5

/** 球の直径2Rを超える押し出しも許容し、外周への接触だけで場外扱いにせず戻れない位置だけを判定する。 */
export const OUT_OF_BOUNDS_MARGIN_IN_RADII = 2.4

/**
 * 回転棒の長さ。3マス幅(5.67)の部屋に置くと、棒が通路と垂直になったときでも
 * 壁ぎわに片側1.63の退避レーンが残り、直径1.26のボールが必ず脇を抜けられる。
 * 塞ぎ切らないことで「当たっても楽しいが、詰まって進めなくなることはない」状態にする。
 */
export const SPINNER_LENGTH = 2.4
export const SPINNER_THICKNESS = 0.26
/** ボール直径1.26を確実に押せる高さ。低いと乗り越えられる。 */
export const SPINNER_HEIGHT = 1.15
export const SPINNER_FRICTION = 0.2
export const SPINNER_RESTITUTION = 0.15

/** バンパー。直径0.92。2マス幅の部屋の中央に置いても、両脇に1.43の通り道が残る。 */
export const BUMPER_RADIUS = 0.46
export const BUMPER_HEIGHT = 0.9
export const BUMPER_FRICTION = 0.1
/** コライダー自体の反発。実際の「ポン！」は下の追加インパルスで作る。 */
export const BUMPER_RESTITUTION = 0.6
/** 触れた瞬間に外向きへ加える速度変化(質量1なのでそのままΔv)。強すぎると操作不能になる。 */
export const BUMPER_KICK_IMPULSE = 2.4
/** 同じバンパーが連打で暴発しないための間隔。 */
export const BUMPER_COOLDOWN_MS = 260
/** キック判定はコライダー接触より少しだけ広く取り、低速で触れても必ず弾く。 */
export const BUMPER_KICK_MARGIN = 0.04

/** 床面より下のここまで落ちたら「穴に落ちた」とみなす。0.5秒程度で判定が出る深さ。 */
export const HOLE_FALL_Y = -BALL_RADIUS * 1.8
/** 穴の底に見える暗い面の高さ。判定より十分下に置き、ボールが到達する前に復帰させる。 */
export const HOLE_PIT_BOTTOM_Y = -BALL_RADIUS * 4.2

export type PhysicsVector = { x: number; y: number; z: number }

/**
 * 傾き入力を重力ベクトルへ変換する。
 *
 * 入力の大きさ m（0〜1）を傾き角 θ = m · MAX_TILT_RAD とし、
 * 「盤面を (x, y) 方向へ θ だけ傾けた」のと等価な重力を返す。
 * 大きさは常に GRAVITY_MAGNITUDE のままなので、傾けても総重力は変わらない。
 */
export function gravityFromTilt(
  tilt: TiltInput,
  magnitude = GRAVITY_MAGNITUDE,
  maxTiltRad = MAX_TILT_RAD,
): PhysicsVector {
  const length = Math.hypot(tilt.x, tilt.y)
  if (length === 0 || !Number.isFinite(length)) {
    return { x: 0, y: -magnitude, z: 0 }
  }
  const clamped = Math.min(1, length)
  const angle = clamped * maxTiltRad
  const sin = Math.sin(angle)
  return {
    x: (tilt.x / length) * sin * magnitude,
    y: -Math.cos(angle) * magnitude,
    z: (tilt.y / length) * sin * magnitude,
  }
}

/**
 * 見た目の盤面を傾けるための回転軸と角度。
 * 重力と同じ方向・同じ向きだが、角度だけ VISUAL_TILT_RATIO で控えめにする。
 *
 * 盤面の下り坂の向きは「法線が倒れる向き」と同じになる
 * （高さ y = -(nx·x + nz·z)/ny を最急降下すると向きは (nx, nz)）。
 * したがって入力方向へ転がすには、法線を入力と同じ向きへ倒す必要がある。
 */
export function visualTiltRotation(
  tilt: TiltInput,
  ratio = VISUAL_TILT_RATIO,
  maxTiltRad = MAX_TILT_RAD,
): { axis: PhysicsVector; angle: number } {
  const length = Math.hypot(tilt.x, tilt.y)
  if (length === 0 || !Number.isFinite(length)) {
    return { axis: { x: 1, y: 0, z: 0 }, angle: 0 }
  }
  const ux = tilt.x / length
  const uz = tilt.y / length
  // 上向き(0,1,0)が (ux, uz) 側へ倒れる回転軸。傾けた先が下り坂になる。
  return {
    axis: { x: uz, y: 0, z: -ux },
    angle: Math.min(1, length) * maxTiltRad * ratio,
  }
}

/**
 * 見た目の傾きをpivot点まわりの回転にするための、Groupへ与える平行移動。
 * 原点まわりに回すと盤の端にいるボールが上下へ大きく振れ、寄った追従カメラが
 * 揺れてしまうため、回転中心をボールへ寄せる。Three.jsに依存しない純粋関数にする。
 */
export function visualTiltPivotOffset(
  rotation: { axis: PhysicsVector; angle: number },
  pivot: PhysicsVector,
): PhysicsVector {
  if (!Number.isFinite(rotation.angle) || rotation.angle === 0) {
    return { x: 0, y: 0, z: 0 }
  }

  const axisLength = Math.hypot(rotation.axis.x, rotation.axis.y, rotation.axis.z)
  if (axisLength === 0 || !Number.isFinite(axisLength)) {
    return { x: 0, y: 0, z: 0 }
  }

  const axis = {
    x: rotation.axis.x / axisLength,
    y: rotation.axis.y / axisLength,
    z: rotation.axis.z / axisLength,
  }
  const cross = {
    x: axis.y * pivot.z - axis.z * pivot.y,
    y: axis.z * pivot.x - axis.x * pivot.z,
    z: axis.x * pivot.y - axis.y * pivot.x,
  }
  const dot = axis.x * pivot.x + axis.y * pivot.y + axis.z * pivot.z
  const cos = Math.cos(rotation.angle)
  const sin = Math.sin(rotation.angle)
  const rotated = {
    x: pivot.x * cos + cross.x * sin + axis.x * dot * (1 - cos),
    y: pivot.y * cos + cross.y * sin + axis.y * dot * (1 - cos),
    z: pivot.z * cos + cross.z * sin + axis.z * dot * (1 - cos),
  }
  return {
    x: pivot.x - rotated.x,
    y: pivot.y - rotated.y,
    z: pivot.z - rotated.z,
  }
}

/** 速度上限を超えた分だけ方向を保って縮める。超えていなければ null を返す。 */
export function clampSpeed(
  velocity: PhysicsVector,
  maxSpeed = MAX_BALL_SPEED,
): PhysicsVector | null {
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
  if (speed <= maxSpeed || speed === 0) return null
  const ratio = maxSpeed / speed
  return { x: velocity.x * ratio, y: velocity.y * ratio, z: velocity.z * ratio }
}
