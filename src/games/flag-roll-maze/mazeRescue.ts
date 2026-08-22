import {
  BALL_RADIUS,
  FALL_OUT_Y,
  HOLE_FALL_Y,
  OUT_OF_BOUNDS_MARGIN_IN_RADII,
  type PhysicsVector,
} from './mazePhysics'
import { CELL_SIZE } from './mazeGrid'
import type { MazePoint } from './mazeGrid'
import type { SpinnerGimmick } from './mazeGimmicks'

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

/** 床面より下へ抜けたか。外周から落ちた場合も同じ復帰処理へ流すために分けて判定する。 */
export function hasFallenBelowFloor(
  position: PhysicsVector,
  fallY = HOLE_FALL_Y,
): boolean {
  return position.y < fallY
}

/** チェックポイントへ近づいたとみなす水平距離。高さは復帰判定に影響させない。 */
export const CHECKPOINT_RADIUS = CELL_SIZE * 0.75

/** 復帰直後に同じ穴やギミックを連続判定しないための猶予時間。 */
export const RESPAWN_GRACE_MS = 350

/**
 * 復帰した直後にボールを止めておく時間。
 * すぐ転がり出すと、幼児が状況を把握する前に同じ失敗を繰り返してしまう。
 * ゲームオーバー画面を挟まずに立て直す間だけを作るので、短く保つ。
 */
export const RESPAWN_SETTLE_MS = 500

export type CheckpointTracker = { index: number }

export function createCheckpointTracker(): CheckpointTracker {
  return { index: 0 }
}

/** 次のチェックポイントだけを順番に確認し、後戻りせずに通過記録を進める。 */
export function updateCheckpointTracker(
  tracker: CheckpointTracker,
  position: PhysicsVector,
  checkpoints: readonly MazePoint[],
): CheckpointTracker {
  let index = tracker.index
  while (index + 1 < checkpoints.length) {
    const next = checkpoints[index + 1]
    if (next === undefined) break
    const horizontalDistance = Math.hypot(
      position.x - next.x,
      position.z - next.z,
    )
    if (horizontalDistance > CHECKPOINT_RADIUS) break
    index += 1
  }
  return { index }
}

/** 有効な通過記録がなければ、呼び出し側が用意した安全な復帰先を使う。 */
export function checkpointPosition(
  tracker: CheckpointTracker,
  checkpoints: readonly MazePoint[],
  fallback: MazePoint,
): MazePoint {
  return checkpoints[tracker.index] ?? fallback
}

export type StallTracker = {
  /** 停滞が続いている時間。 */
  stalledMs: number
  /** ナッジを繰り返した回数。動かなければ復帰へ切り替える。 */
  nudgeCount: number
}

export function createStallTracker(): StallTracker {
  return { stalledMs: 0, nudgeCount: 0 }
}

/** ナッジを3回繰り返しても動かなければ、ギミックに挟まったとして復帰させる。 */
export const STALL_RESCUE_NUDGE_COUNT = 3

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
type StallTrackerInput = { stalledMs: number; nudgeCount?: number }

export function updateStallTracker(
  tracker: StallTracker,
  input: { speed: number; tiltMagnitude: number; deltaMs: number },
): { tracker: StallTracker; nudge: boolean; rescue: boolean }
export function updateStallTracker(
  tracker: StallTrackerInput,
  input: { speed: number; tiltMagnitude: number; deltaMs: number },
): { tracker: StallTracker; nudge: boolean; rescue: boolean }
export function updateStallTracker(
  tracker: StallTrackerInput,
  input: { speed: number; tiltMagnitude: number; deltaMs: number },
): { tracker: StallTracker; nudge: boolean; rescue: boolean } {
  const stalling =
    input.tiltMagnitude >= STALL_TILT_THRESHOLD && input.speed < STALL_SPEED
  if (!stalling) {
    return {
      tracker: { stalledMs: 0, nudgeCount: 0 },
      nudge: false,
      rescue: false,
    }
  }

  const stalledMs = tracker.stalledMs + Math.max(0, input.deltaMs)
  const nudgeCount = tracker.nudgeCount ?? 0
  if (stalledMs < STALL_DURATION_MS) {
    return {
      tracker: { stalledMs, nudgeCount },
      nudge: false,
      rescue: false,
    }
  }

  const nextNudgeCount = nudgeCount + 1
  if (nextNudgeCount >= STALL_RESCUE_NUDGE_COUNT) {
    return {
      tracker: { stalledMs: 0, nudgeCount: 0 },
      nudge: true,
      rescue: true,
    }
  }
  return {
    tracker: { stalledMs: 0, nudgeCount: nextNudgeCount },
    nudge: true,
    rescue: false,
  }
}

/** 回転棒の掃引円のそばに居続けたとみなすまでの時間。 */
export const SPINNER_TRAP_MS = 3000

/** 押し出しても抜けられなかったら復帰へ切り替える回数。 */
export const SPINNER_TRAP_ESCAPE_LIMIT = 2

export type SpinnerTrapTracker = {
  spinnerId: string | null
  trappedMs: number
  escapeCount: number
}

export function createSpinnerTrapTracker(): SpinnerTrapTracker {
  return { spinnerId: null, trappedMs: 0, escapeCount: 0 }
}

function spinnerContainsPosition(
  position: PhysicsVector,
  spinner: SpinnerGimmick,
): boolean {
  return (
    Math.hypot(position.x - spinner.center.x, position.z - spinner.center.z) <=
    spinner.sweepRadius + BALL_RADIUS
  )
}

/**
 * 掃引円 + ボール半径の内側に居続けている回転棒を見つける。
 * 棒に回され続けると速度は出ているため停滞判定では拾えず、別の見張りが要る。
 */
export function updateSpinnerTrapTracker(
  tracker: SpinnerTrapTracker,
  position: PhysicsVector,
  spinners: readonly SpinnerGimmick[],
  deltaMs: number,
): { tracker: SpinnerTrapTracker; escapeFrom: SpinnerGimmick | null; rescue: boolean } {
  const inRange = spinners.filter((spinner) => spinnerContainsPosition(position, spinner))
  const spinner =
    inRange.find((candidate) => candidate.id === tracker.spinnerId) ?? inRange[0]

  if (spinner === undefined || (tracker.spinnerId !== null && tracker.spinnerId !== spinner.id)) {
    return {
      tracker: createSpinnerTrapTracker(),
      escapeFrom: null,
      rescue: false,
    }
  }

  if (tracker.spinnerId === null) {
    return {
      tracker: { spinnerId: spinner.id, trappedMs: 0, escapeCount: 0 },
      escapeFrom: null,
      rescue: false,
    }
  }

  const trappedMs = tracker.trappedMs + Math.max(0, deltaMs)
  if (trappedMs < SPINNER_TRAP_MS) {
    return {
      tracker: { ...tracker, trappedMs },
      escapeFrom: null,
      rescue: false,
    }
  }

  const escapeCount = tracker.escapeCount + 1
  if (escapeCount >= SPINNER_TRAP_ESCAPE_LIMIT) {
    return {
      tracker: createSpinnerTrapTracker(),
      escapeFrom: spinner,
      rescue: true,
    }
  }

  return {
    tracker: { spinnerId: spinner.id, trappedMs: 0, escapeCount },
    escapeFrom: spinner,
    rescue: false,
  }
}
