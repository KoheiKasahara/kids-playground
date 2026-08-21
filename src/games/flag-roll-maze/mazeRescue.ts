import {
  BALL_RADIUS,
  FALL_OUT_Y,
  OUT_OF_BOUNDS_MARGIN_IN_RADII,
  type PhysicsVector,
} from './mazePhysics'

/**
 * 「動けなくなって遊びが止まる」状態を検出するための、物理から独立した小さな判定。
 * 幼児が自分で立て直せない場面を、大人が手を出さずに解消することだけを目的にする。
 */

/** 傾けているのに実質止まっているとみなす速さ（ワールド単位/秒）。 */
export const STALL_SPEED = 0.12

/** 停滞とみなすまでの時間。短すぎると壁ぎわの一瞬の停止で誤爆する。 */
export const STALL_DURATION_MS = 1400

/** 停滞判定の対象にする入力の大きさ。触っていないときは救済しない。 */
export const STALL_TILT_THRESHOLD = 0.45

export type StallTracker = {
  /** 停滞が続いている時間。 */
  stalledMs: number
}

export function createStallTracker(): StallTracker {
  return { stalledMs: 0 }
}

/** 盤面から落ちたか。外周壁があるため通常は起きないが、保険として必ず見る。 */
export function hasFallenOut(
  position: PhysicsVector,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  fallOutY = FALL_OUT_Y,
): boolean {
  if (position.y < fallOutY) return true
  // 盤面の外側へ大きく出た場合も、戻れる見込みがないので場外にする。
  const margin = BALL_RADIUS * OUT_OF_BOUNDS_MARGIN_IN_RADII
  return (
    position.x < bounds.minX - margin ||
    position.x > bounds.maxX + margin ||
    position.z < bounds.minZ - margin ||
    position.z > bounds.maxZ + margin
  )
}

/**
 * 停滞時間を積み上げ、しきい値を超えたら一度だけ `nudge` を立ててリセットする。
 * 状態を引数と戻り値だけで受け渡すので、時間を進めるテストが書きやすい。
 */
export function updateStallTracker(
  tracker: StallTracker,
  input: { speed: number; tiltMagnitude: number; deltaMs: number },
): { tracker: StallTracker; nudge: boolean } {
  const stalling =
    input.tiltMagnitude >= STALL_TILT_THRESHOLD && input.speed < STALL_SPEED
  if (!stalling) return { tracker: { stalledMs: 0 }, nudge: false }

  const stalledMs = tracker.stalledMs + Math.max(0, input.deltaMs)
  if (stalledMs < STALL_DURATION_MS) return { tracker: { stalledMs }, nudge: false }
  return { tracker: { stalledMs: 0 }, nudge: true }
}
