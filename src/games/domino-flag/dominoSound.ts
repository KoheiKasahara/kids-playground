/** 倒れ始めの読み取りと発音間引きを、Web Audioから切り離して扱う。 */

/**
 * 倒れ始めとみなす傾き。
 * 完成判定の60度より手前の約23度で拾うことで、倒伏の途中に音を出せる。
 */
export const FALL_SOUND_TILT_RAD = 0.4

/**
 * 倒伏音を調べる間隔。
 * 24msなら160msの完成判定より細かく、毎フレームの全走査ほど重くならない。
 */
export const FALL_SCAN_INTERVAL_MS = 24

/**
 * 倒伏音どうしの最小間隔。
 * 45msなら保留音をまとめつつ、最悪でも約22発/秒に収まる。
 */
export const DOMINO_SOUND_MIN_INTERVAL_MS = 45

/**
 * 1回の代表音に反映する保留数の上限。
 * 6個以上は十分に太い音として扱い、大量倒伏で音量が膨らみ続けないようにする。
 */
export const DOMINO_SOUND_MAX_PENDING_COUNT = 6

/** 完成表示を遅らせず、直前の倒伏音だけを聞かせるためのSE遅延。 */
export const DOMINO_COMPLETE_SOUND_DELAY_MS = 200

export type DominoTiltSource = readonly number[] | ((index: number) => number)

export type DominoFallTracker = {
  /** 未発音ドミノの姿勢だけを読み、新しくしきい値を超えた個数を返す。 */
  countNewFalls: (tilts: DominoTiltSource) => number
  /** まだ読み取る必要があるドミノ数を返す。 */
  getRemainingCount: () => number
}

/**
 * 倒伏済み集合を配列の後ろから詰めるトラッカーを作る。
 * Setを毎回全件走査する代わりに未発音インデックスだけを残すため、走査量は進行とともに減る。
 */
export function createDominoFallTracker(dominoCount: number): DominoFallTracker {
  const safeCount = Number.isFinite(dominoCount) ? Math.max(0, Math.trunc(dominoCount)) : 0
  const unplayedIndices = Array.from({ length: safeCount }, (_, index) => index)

  return {
    countNewFalls: (tilts) => {
      let writeIndex = 0
      let newFalls = 0

      for (let readIndex = 0; readIndex < unplayedIndices.length; readIndex += 1) {
        const dominoIndex = unplayedIndices[readIndex]!
        const tilt = typeof tilts === 'function' ? tilts(dominoIndex) : tilts[dominoIndex]
        if (tilt !== undefined && Number.isFinite(tilt) && tilt >= FALL_SOUND_TILT_RAD) {
          newFalls += 1
          continue
        }
        unplayedIndices[writeIndex] = dominoIndex
        writeIndex += 1
      }

      unplayedIndices.length = writeIndex
      return newFalls
    },
    getRemainingCount: () => unplayedIndices.length,
  }
}

/** 保留数を代表音の強さへ変換する純粋な関数。1個で0.5、6個以上で1.0にする。 */
export function dominoTickIntensityForCount(pendingCount: number): number {
  const safeCount = Number.isFinite(pendingCount)
    ? Math.min(DOMINO_SOUND_MAX_PENDING_COUNT, Math.max(0, Math.trunc(pendingCount)))
    : 0
  return safeCount === 0 ? 0 : Math.min(1, Math.round((0.4 + safeCount * 0.1) * 100) / 100)
}

export type DominoSoundScheduleState = {
  pendingCount: number
  lastPlayedAt: number | null
}

export type DominoSoundScheduleResult = {
  state: DominoSoundScheduleState
  intensity: number | null
}

function normalizePendingCount(count: number): number {
  if (!Number.isFinite(count)) return 0
  return Math.min(DOMINO_SOUND_MAX_PENDING_COUNT, Math.max(0, Math.trunc(count)))
}

/**
 * 保留数とクールダウンを1ステップ進める純粋なスケジューラ。
 * 音声関数を呼ばず、intensityがnullでないときだけ呼び出し側が発音する。
 */
export function advanceDominoSoundSchedule(
  state: DominoSoundScheduleState,
  newlyFallenCount: number,
  nowMs: number,
  canPlay: boolean,
): DominoSoundScheduleResult {
  const pendingCount = Math.min(
    DOMINO_SOUND_MAX_PENDING_COUNT,
    normalizePendingCount(state.pendingCount) + normalizePendingCount(newlyFallenCount),
  )
  const cooldownElapsed =
    state.lastPlayedAt === null || nowMs - state.lastPlayedAt >= DOMINO_SOUND_MIN_INTERVAL_MS

  if (pendingCount === 0 || !canPlay || !cooldownElapsed) {
    return {
      state: { pendingCount, lastPlayedAt: state.lastPlayedAt },
      intensity: null,
    }
  }

  return {
    state: { pendingCount: 0, lastPlayedAt: nowMs },
    intensity: dominoTickIntensityForCount(pendingCount),
  }
}

type DominoSoundTimerId = ReturnType<typeof globalThis.setTimeout>

export type DominoSoundControllerOptions = {
  /** 1 run分のドミノ数。 */
  dominoCount: number
  /** ドミノ代表音を鳴らす副作用。 */
  playTick: (intensity: number) => void
  /** 完成音を鳴らす副作用。 */
  playComplete: () => void
  /** 固定値または最新のサウンドON/OFFを返す関数。 */
  soundEnabled: boolean | (() => boolean)
  /** テストで時刻を差し替えるための時計。 */
  now: () => number
  /** 完成SEのタイマー。省略時は環境のsetTimeoutを使う。 */
  setTimeoutFn?: (handler: () => void, timeoutMs: number) => DominoSoundTimerId
  /** 完成SEのタイマー解除。 */
  clearTimeoutFn?: (timerId: DominoSoundTimerId) => void
}

export type DominoSoundController = {
  /** 姿勢を読み、新規倒伏を発音スケジューラへ渡す。 */
  scan: (tilts: DominoTiltSource, nowMs?: number) => number
  /** run中1回だけ完成SEを遅延予約し、以後のドミノ音を止める。 */
  notifyComplete: (nowMs?: number) => void
  /** タイマーと以後の発音を破棄する。 */
  dispose: () => void
}

/** 倒伏検出・間引き・完成SEを1 run分だけ束ねるコントローラを作る。 */
export function createDominoSoundController(
  options: DominoSoundControllerOptions,
): DominoSoundController {
  const tracker = createDominoFallTracker(options.dominoCount)
  const scheduleTimer =
    options.setTimeoutFn ?? ((handler, timeoutMs) => globalThis.setTimeout(handler, timeoutMs))
  const clearScheduleTimer =
    options.clearTimeoutFn ?? ((timerId) => globalThis.clearTimeout(timerId))
  const isSoundEnabled = (): boolean => {
    const configured = options.soundEnabled
    return typeof configured === 'function' ? configured() : configured
  }

  let scheduleState: DominoSoundScheduleState = {
    pendingCount: 0,
    lastPlayedAt: null,
  }
  let completeTimer: DominoSoundTimerId | null = null
  let completeNotified = false
  let disposed = false

  function advanceSchedule(newlyFallenCount: number, nowMs: number): void {
    if (disposed || completeNotified) return
    const result = advanceDominoSoundSchedule(
      scheduleState,
      newlyFallenCount,
      nowMs,
      isSoundEnabled(),
    )
    scheduleState = result.state
    if (result.intensity !== null) options.playTick(result.intensity)
  }

  function scan(tilts: DominoTiltSource, nowMs?: number): number {
    if (disposed || completeNotified) return 0
    const currentTime = nowMs ?? options.now()
    const newFalls = tracker.countNewFalls(tilts)
    advanceSchedule(newFalls, currentTime)
    return newFalls
  }

  function notifyComplete(nowMs?: number): void {
    if (disposed || completeNotified) return
    completeNotified = true
    // 完成時点で保留していた倒伏音も破棄し、完成SEだけを残す。
    scheduleState = { pendingCount: 0, lastPlayedAt: nowMs ?? options.now() }
    completeTimer = scheduleTimer(() => {
      completeTimer = null
      if (disposed || !isSoundEnabled()) return
      options.playComplete()
    }, DOMINO_COMPLETE_SOUND_DELAY_MS)
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    if (completeTimer !== null) {
      clearScheduleTimer(completeTimer)
      completeTimer = null
    }
    scheduleState = { pendingCount: 0, lastPlayedAt: scheduleState.lastPlayedAt }
  }

  return { scan, notifyComplete, dispose }
}
