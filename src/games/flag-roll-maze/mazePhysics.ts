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

/** 星の見た目の大きさ。ボールより明らかに小さく、通り道を塞がない。 */
export const STAR_VISUAL_RADIUS = BALL_RADIUS * 0.42
/** 星を浮かせる高さ。ボールの中心と同じ高さにして、転がって当たれば必ず取れる。 */
export const STAR_HOVER_Y = BALL_RADIUS

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

/** 高台の柵は球が抜けない厚みにしつつ、通路を必要以上に狭めない細さにする。 */
export const TERRAIN_RAIL_THICKNESS = BALL_RADIUS * 0.2
/** 高台と段差の横から落ちないよう、既定の柵は球半径より少し高くする。 */
export const TERRAIN_SLAB_RAIL_HEIGHT = 0.9
/** すべり台は薄すぎて抜けず、重すぎて段差にならない厚みにする。 */
export const TERRAIN_RAMP_THICKNESS = 0.5
/** すべり台の柵は視界を遮らず、横へ飛び出すことだけを防ぐ高さにする。 */
export const TERRAIN_RAMP_RAIL_HEIGHT = 0.7

/** 車は道路の両脇へ十分な通り道を残せる横幅にし、X方向へだけ往復させる。 */
export const CAR_WIDTH = 2.4
/** 車体はボールが乗り越えにくく、それでいて道路を見渡せる低さにする。 */
export const CAR_BODY_HEIGHT = 0.78
/** 車間の空きをボール直径より広く保てる奥行きにする。 */
export const CAR_DEPTH = 1.3
/** 車体の角を丸め、動く直角の壁へ引っかかる感触を抑える。 */
export const CAR_BODY_ROUND = 0.22
/** 屋根は円柱にして、真上から落ちたボールが平らな面で静止しないようにする。 */
export const CAR_CABIN_RADIUS = 0.42
/** 動く車に接しても貼り付かず、横へ押し出される摩擦にする。 */
export const CAR_FRICTION = 0.25
/** 軽く弾く手応えを残しつつ、幼児向けに吹き飛ばしすぎない反発にする。 */
export const CAR_RESTITUTION = 0.35

/** ジャンプ床は既存の床から目立たせつつ、通行を妨げない薄さにする。 */
export const JUMP_PAD_TOP = 0.12
/** 床の縁へ少し触れただけでも発射でき、中心を正確に狙わせない余白にする。 */
export const JUMP_PAD_MARGIN = 0.25
/** ハードルを越えながら着地帯へ収まる上向きの発射速度にする。 */
export const JUMP_PAD_UP_SPEED = 5.6
/** コース進行方向へ必ず運び、横だけのジャンプにならないようにする。 */
export const JUMP_PAD_FORWARD_SPEED = 2.4
/** 横速度を少し残しつつ、子どもの操作を進行方向へ補正する割合にする。 */
export const JUMP_PAD_SIDE_RETENTION = 0.3
/** 横へ飛びすぎて通路外へ寄らないよう、発射後の横速度を制限する。 */
export const JUMP_PAD_MAX_SIDE_SPEED = 1.2
/** 発射直後の合成速度だけは、通常の上限より少し高く許可する。 */
export const JUMP_PAD_SPEED_CAP = 6.6
/** 高速のまま走り続けず、ハードルを越えた直後には通常の操作感へ戻す時間にする。 */
export const JUMP_PAD_SPEED_CAP_MS = 350
/** 落ちてきたらすぐ再挑戦できるよう、同じ床の連続発火を短時間だけ抑える。 */
export const JUMP_PAD_COOLDOWN_MS = 420
/** すでに上昇中のボールへ二重に打ち上げ速度を加えないしきい値にする。 */
export const JUMP_PAD_ALREADY_RISING = JUMP_PAD_UP_SPEED * 0.5

/** 大砲の砲室と発射位置を一致させ、捕捉後に不自然な位置補正を見せない高さにする。 */
export const CANNON_MUZZLE_Y = 1.0
/** 行き止まりへ入った子が細かく中心を狙わなくても捕捉される、十分に広い水平半径にする。 */
export const CANNON_CAPTURE_RADIUS = 1.55
/** 大きく跳ねて通過中のボールまで吸い込まないよう、捕捉対象の高さを抑える。 */
export const CANNON_CAPTURE_MAX_Y = 1.9
/** 砲室へ入ったことを見せつつ、待たせすぎない演出時間にする。 */
export const CANNON_HOLD_MS = 340
/** 万一砲室へ収まり切らなくても必ず発射して、永久に詰まる状態を作らない保険にする。 */
export const CANNON_CAPTURE_TIMEOUT_MS = 1200
/** 発射直後に同じ大砲へ再捕捉されず、着地点まで安全に進める待ち時間にする。 */
export const CANNON_COOLDOWN_MS = 1500
/** 大砲の発射速度を通常の上限で削らないため、飛行中だけ許す上限にする。 */
export const CANNON_LAUNCH_SPEED_CAP = 8.6
/** 尾根を越えて着地するまでだけ高速を許し、その後は従来の操作感へ戻す時間にする。 */
export const CANNON_LAUNCH_WINDOW_MS = 1200
/** 捕捉中は砲室中心へ少しずつ寄せ、急な位置移動で見た目が飛ばないようにする。 */
export const CANNON_SETTLE_LERP = 0.35

/** 壁は球の直径2Rより0.2R高い2.2Rとし、最大傾斜でも乗り越えられない高さを確保する。 */
export const WALL_HEIGHT = BALL_RADIUS * 2.2

/**
 * ゴールは実物の穴のように深く落とさず、球の約28%だけ低い浅いカップにする。
 * 国旗面の大半が盤面より上に残るため、カップイン後も主役のボールを見失わない。
 */
export const GOAL_CUP_DEPTH = BALL_RADIUS * 0.28
/** カップ底の半径。球が少し転がり込んで止まれる広さを持たせる。 */
export const GOAL_CUP_RADIUS = BALL_RADIUS * 1.18
/** 床面から見えるカップの縁。1マスの半分(1.5R)を越えず、隣の通路へ広がらない。 */
export const GOAL_CUP_RIM_RADIUS = BALL_RADIUS * 1.4
/** カップ底の上面の高さ。通常の床面は0。 */
export const GOAL_CUP_FLOOR_Y = -GOAL_CUP_DEPTH
/**
 * ボールが浅いカップへ実際に沈み始めてからゴールにする高さ。
 * 入り口の縁を横切っただけで結果を出さず、カップインと判定を一致させる。
 */
export const GOAL_REACHED_MAX_Y = BALL_RADIUS - GOAL_CUP_DEPTH * 0.5
/** カップ底に乗った球を取りこぼさない、球半径ぶんの中心判定。 */
export const GOAL_RADIUS = BALL_RADIUS

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
