/**
 * 「積み木が倒れた」の判定。
 *
 * 単純な接触では、玉がかすっただけ・隣が揺れただけでも数えてしまい、
 * 画面の見た目と数字が食い違う。ここでは
 *   1) 初期姿勢からの傾き
 *   2) 初期位置からの移動（横移動・落下）
 * のどちらかが、一定時間続いたときだけ「倒れた」と確定させる。
 *
 * 確定した積み木はラッチして戻さないので、揺れて条件を出入りしても
 * 二重に数えられることはない。
 */

export type Quaternion = { x: number; y: number; z: number; w: number }
export type Vec3 = { x: number; y: number; z: number }

export type BlockSample = {
  position: Vec3
  rotation: Quaternion
}

/** 初期姿勢からこれ以上傾いたら「倒れた」候補。約29度。 */
export const TOPPLE_TILT_RAD = 0.5

/** 初期位置からこれ以上ずれたら「倒れた」候補（水平距離）。積み木1個ぶんより少し大きい。 */
export const TOPPLE_MOVE_DISTANCE = 0.42

/** 初期位置からこれ以上落ちたら「倒れた」候補。板が1段ぶん落ちたら確実に入る。 */
export const TOPPLE_DROP_DISTANCE = 0.35

/**
 * 候補状態がこの時間続いたら確定する。
 * 衝突の瞬間に大きく揺れただけの積み木を、その場で数えないための待ち時間。
 */
export const TOPPLE_CONFIRM_MS = 220

export type ToppleEntry = {
  /** 確定したか。いちど true になったら戻さない。 */
  toppled: boolean
  /** 候補状態が続いている時間[ms]。 */
  pendingMs: number
  initialUp: Vec3
  initialPosition: Vec3
}

export type ToppleTracker = {
  entries: ToppleEntry[]
  /** 確定した積み木の数。 */
  count: number
}

/** クォータニオンを積み木のローカル+Yへ適用した向き（＝積み木の「上」）。 */
export function upVector(rotation: Quaternion): Vec3 {
  const { x, y, z, w } = rotation
  return {
    x: 2 * (x * y - z * w),
    y: 1 - 2 * (x * x + z * z),
    z: 2 * (x * w + y * z),
  }
}

/** 2つの「上」の間の角度[rad]。 */
export function tiltAngleBetween(a: Vec3, b: Vec3): number {
  const lengthA = Math.hypot(a.x, a.y, a.z)
  const lengthB = Math.hypot(b.x, b.y, b.z)
  if (lengthA < 1e-6 || lengthB < 1e-6) return 0
  const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / (lengthA * lengthB)
  return Math.acos(Math.min(1, Math.max(-1, dot)))
}

export function createToppleTracker(initial: readonly BlockSample[]): ToppleTracker {
  return {
    entries: initial.map((sample) => ({
      toppled: false,
      pendingMs: 0,
      initialUp: upVector(sample.rotation),
      initialPosition: { ...sample.position },
    })),
    count: 0,
  }
}

/** いま倒れた条件を満たしているか（時間の確定はまだ見ない）。 */
export function isToppledNow(entry: ToppleEntry, sample: BlockSample): boolean {
  const tilt = tiltAngleBetween(entry.initialUp, upVector(sample.rotation))
  if (tilt >= TOPPLE_TILT_RAD) return true
  const movedHorizontally = Math.hypot(
    sample.position.x - entry.initialPosition.x,
    sample.position.z - entry.initialPosition.z,
  )
  if (movedHorizontally >= TOPPLE_MOVE_DISTANCE) return true
  return entry.initialPosition.y - sample.position.y >= TOPPLE_DROP_DISTANCE
}

/**
 * 1ステップぶん判定を進める。戻り値はこのステップで新しく確定した数。
 * （効果や音を「確定した瞬間だけ」出したいときに使えるようにしてある）
 */
export function updateToppleTracker(
  tracker: ToppleTracker,
  samples: readonly BlockSample[],
  stepMs: number,
): number {
  let newlyToppled = 0
  tracker.entries.forEach((entry, index) => {
    if (entry.toppled) return
    const sample = samples[index]
    if (!sample) return
    if (!isToppledNow(entry, sample)) {
      entry.pendingMs = 0
      return
    }
    entry.pendingMs += stepMs
    if (entry.pendingMs >= TOPPLE_CONFIRM_MS) {
      entry.toppled = true
      tracker.count += 1
      newlyToppled += 1
    }
  })
  return newlyToppled
}

/** 次の投球・もういちどのために、判定を初期姿勢からやり直す。 */
export function resetToppleTracker(
  tracker: ToppleTracker,
  initial: readonly BlockSample[],
): void {
  tracker.count = 0
  tracker.entries = initial.map((sample) => ({
    toppled: false,
    pendingMs: 0,
    initialUp: upVector(sample.rotation),
    initialPosition: { ...sample.position },
  }))
}
