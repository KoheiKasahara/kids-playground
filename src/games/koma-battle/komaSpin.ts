/**
 * コマの「高速時は安定 → 失速するとぐらつく」を作る計算。
 *
 * 大前提として、この計算はRapierへ**トルクを足すだけ**であり、
 * 姿勢や位置を毎フレーム上書きする処理はどこにもない。
 * 衝突による姿勢変化・弾かれはすべてRapierの通常物理が決める。
 *
 * 物理的な裏づけ：この寸法のコマ（重心高さ約0.19、円盤の慣性モーメント約0.0092）は
 * 自転が約16rad/sを下回るとジャイロ効果だけでは自立できなくなる。
 * つまり「失速すると倒れる」流れはRapierの素の挙動として既に存在する。
 * ここで足す補正は、その素の挙動の
 *   - 高速域での微細なぐらつきを抑えて「安定して見せる」
 *   - 低速域では補正を0まで抜いて、素の不安定さをそのまま見せる
 * ための味付けであって、倒れる仕組みそのものを作っているわけではない。
 */

export type Vector3 = { x: number; y: number; z: number }

/** ここを超えていれば「高速回転中」。補正が最大になる。 */
export const STABLE_SPIN_SPEED = 34
/** ここを下回ると補正は完全に0になり、素のふらつきがそのまま出る。 */
export const WOBBLE_SPIN_SPEED = 16

/** 起き上がりトルクの係数[N・m/rad]。重力による転倒トルク(最大約0.41N・m)より小さくしてある。 */
export const UPRIGHT_TORQUE_GAIN = 1.6
/** 首振り(歳差)を抑える減衰係数。高速域のこまかい揺れだけを吸う。 */
export const WOBBLE_DAMPING_GAIN = 0.03

/**
 * 補正トルクの上限[N・m]。
 *
 * このコマに重力がかける転倒トルクは最大でも約0.44N・m。
 * 補正がそれを超えると「物理ではなく補正が姿勢を決めている」状態になるため、
 * 合計トルクを必ずそれ未満へ抑える。
 * 通常の対戦ではここまで届かず、姿勢が大きく乱れた瞬間だけ効く安全弁。
 */
export const MAX_ASSIST_TORQUE = 0.3

/**
 * 低速域で加える、ごく小さなふらつき。
 * 素の物理でも倒れるが、倒れ始めるまでの「ぐらぐらしている時間」が
 * 幼児にも分かるよう、傾く向きのきっかけだけを与える。
 */
export const WOBBLE_TORQUE_GAIN = 0.012

/**
 * 補正の効き具合を 0..1 で返す。
 * WOBBLE_SPIN_SPEED以下で0、STABLE_SPIN_SPEED以上で1、間はなめらかにつなぐ。
 */
export function stabilizationStrength(spinSpeed: number): number {
  if (!Number.isFinite(spinSpeed)) return 0
  const absolute = Math.abs(spinSpeed)
  if (absolute <= WOBBLE_SPIN_SPEED) return 0
  if (absolute >= STABLE_SPIN_SPEED) return 1
  const ratio =
    (absolute - WOBBLE_SPIN_SPEED) / (STABLE_SPIN_SPEED - WOBBLE_SPIN_SPEED)
  // smoothstep。しきい値の前後で補正が階段状に切り替わらないようにする。
  return ratio * ratio * (3 - 2 * ratio)
}

/** 補正が抜けた度合い。低速ほど1へ近づき、ふらつきの強さに使う。 */
export function wobbleStrength(spinSpeed: number): number {
  return 1 - stabilizationStrength(spinSpeed)
}

function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

/** クォータニオンからコマのローカル+Y（軸の向き）をワールド座標で得る。 */
export function upVectorOf(rotation: {
  x: number
  y: number
  z: number
  w: number
}): Vector3 {
  const { x, y, z, w } = rotation
  return {
    x: 2 * (x * y + z * w),
    y: 1 - 2 * (x * x + z * z),
    z: 2 * (y * z - x * w),
  }
}

/** 直立からの傾き[rad]。0が完全な直立、π/2で真横。 */
export function tiltAngleOf(up: Vector3): number {
  return Math.acos(Math.min(1, Math.max(-1, up.y)))
}

/** コマ自身の軸まわりの回転速度。倒れたコマの「まだ回っているか」もこれで測る。 */
export function spinSpeedOf(angularVelocity: Vector3, up: Vector3): number {
  return dot(angularVelocity, up)
}

export type StabilizationInput = {
  /** コマの軸の向き（ワールド）。 */
  up: Vector3
  /** 角速度（ワールド）。 */
  angularVelocity: Vector3
  /** コマ自身の軸まわりの回転速度。 */
  spinSpeed: number
  /** 低速域のふらつきに使う位相。runごとにコマ別の値を渡す。 */
  wobblePhase: number
}

/**
 * このステップで加えるトルクを返す。
 *
 * 内訳は3つだけ。
 *  1. 起き上がり  : 傾きを戻す。高速時のみ強く効く。
 *  2. 首振り減衰  : 軸に垂直な角速度を吸う。高速時のみ効く。
 *  3. ふらつき    : 低速時だけ、傾く向きのきっかけを与える小さなトルク。
 */
export function stabilizationTorque(input: StabilizationInput): Vector3 {
  const { up, angularVelocity, spinSpeed, wobblePhase } = input
  const strength = stabilizationStrength(spinSpeed)
  const tilt = tiltAngleOf(up)

  // up と ワールド上向き の外積が、傾きを戻す回転軸になる。
  const axis = cross(up, { x: 0, y: 1, z: 0 })
  const axisLength = Math.hypot(axis.x, axis.y, axis.z)

  let torque: Vector3 = { x: 0, y: 0, z: 0 }

  if (axisLength > 1e-6) {
    const scale = (UPRIGHT_TORQUE_GAIN * strength * tilt) / axisLength
    torque = { x: axis.x * scale, y: axis.y * scale, z: axis.z * scale }
  }

  // 軸に平行な成分（自転そのもの）は絶対に触らない。垂直成分だけを吸う。
  const along = dot(angularVelocity, up)
  const perpendicular: Vector3 = {
    x: angularVelocity.x - along * up.x,
    y: angularVelocity.y - along * up.y,
    z: angularVelocity.z - along * up.z,
  }
  const damping = WOBBLE_DAMPING_GAIN * strength
  torque = {
    x: torque.x - perpendicular.x * damping,
    y: torque.y - perpendicular.y * damping,
    z: torque.z - perpendicular.z * damping,
  }

  // 低速時だけ、水平面内でゆっくり向きの変わる小さなトルクを足す。
  const wobble = wobbleStrength(spinSpeed) * WOBBLE_TORQUE_GAIN
  if (wobble > 0) {
    torque = {
      x: torque.x + Math.cos(wobblePhase) * wobble,
      y: torque.y,
      z: torque.z + Math.sin(wobblePhase) * wobble,
    }
  }

  // 補正が重力より強くならないよう、最後に必ず頭打ちにする。
  const magnitude = Math.hypot(torque.x, torque.y, torque.z)
  if (magnitude > MAX_ASSIST_TORQUE) {
    const scale = MAX_ASSIST_TORQUE / magnitude
    return { x: torque.x * scale, y: torque.y * scale, z: torque.z * scale }
  }
  return torque
}

/**
 * 速度が安全域を超えていれば丸めた値を返す。超えていなければnull。
 * NaN/Infinityが混ざった場合もここで拾う。
 */
export function clampedVector(vector: Vector3, maxLength: number): Vector3 | null {
  const { x, y, z } = vector
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return { x: 0, y: 0, z: 0 }
  }
  const length = Math.hypot(x, y, z)
  if (length <= maxLength || length === 0) return null
  const scale = maxLength / length
  return { x: x * scale, y: y * scale, z: z * scale }
}
