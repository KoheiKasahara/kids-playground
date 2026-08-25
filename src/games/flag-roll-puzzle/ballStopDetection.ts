import {
  STOP_DURATION_MS,
  STOP_POSITION_DELTA,
  STOP_SPEED_THRESHOLD,
} from './puzzlePhysics'

export type BallMotionSample = {
  readonly x: number
  readonly y: number
  readonly speed: number
}

export type StopObservation = {
  readonly quietSince: number | null
  readonly referencePosition: { readonly x: number; readonly y: number } | null
}

export function createStopObservation(): StopObservation {
  return { quietSince: null, referencePosition: null }
}

export type StopObservationResult = {
  readonly observation: StopObservation
  readonly stopped: boolean
}

/**
 * 低速かつ位置もほぼ変わらない状態が継続したときだけ停止とみなす。
 * ゴール領域は Phase 1 の自然な物理挙動を維持するため、ここでは必ず除外する。
 */
export function observeBallStop(
  previous: StopObservation,
  sample: BallMotionSample,
  now: number,
  inGoal: boolean,
): StopObservationResult {
  if (inGoal || sample.speed > STOP_SPEED_THRESHOLD) {
    return { observation: createStopObservation(), stopped: false }
  }

  if (previous.quietSince === null || previous.referencePosition === null) {
    return {
      observation: { quietSince: now, referencePosition: { x: sample.x, y: sample.y } },
      stopped: false,
    }
  }

  const distance = Math.hypot(sample.x - previous.referencePosition.x, sample.y - previous.referencePosition.y)
  if (distance > STOP_POSITION_DELTA) {
    return {
      observation: { quietSince: now, referencePosition: { x: sample.x, y: sample.y } },
      stopped: false,
    }
  }

  return { observation: previous, stopped: now - previous.quietSince >= STOP_DURATION_MS }
}
