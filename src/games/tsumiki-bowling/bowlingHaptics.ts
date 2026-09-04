/**
 * つみきボウリングの触覚フィードバック（Phase 4）。
 *
 * `navigator.vibrate` は対応端末でも許可されない/呼べないことが珍しくないため、
 * 「対応チェック→try/catch」で必ず失敗を吸収し、振動が使えなくてもゲーム進行に
 * 一切影響しないようにする（必須機能ではなく、あくまで手触りの上乗せ）。
 * `prefers-reduced-motion: reduce` のときは、体感を強める演出とみなして振動もしない。
 */

/** 連続衝突で振動しっぱなしにならないようにする最小間隔[ms]。 */
const HAPTICS_COOLDOWN_MS = 120

/** navigator.vibrate が関数として存在するか。 */
export function canVibrate(): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  } catch {
    return false
  }
}

function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  } catch {
    return false
  }
}

export type BowlingHaptics = {
  /** 発射の瞬間。短く軽く。 */
  launch(): void
  /** 衝突の瞬間。strengthが弱いときは何もしない（弱い当たりまで震わせると煩わしい）。 */
  impact(strength: number): void
  /** 1投で全部倒したときのお祝い。3段の短いパルス。 */
  perfect(): void
  dispose(): void
}

export function createBowlingHaptics(): BowlingHaptics {
  let disposed = false
  let lastVibrateAt: number | null = null

  function isSupported(): boolean {
    return canVibrate() && !prefersReducedMotion()
  }

  function vibrate(pattern: number | number[]): void {
    if (disposed || !isSupported()) return
    const now = Date.now()
    if (lastVibrateAt !== null && now - lastVibrateAt < HAPTICS_COOLDOWN_MS) return
    lastVibrateAt = now
    try {
      navigator.vibrate(pattern)
    } catch {
      // 対応をうたっていても実行時に拒否される端末があるため、失敗は無視する。
    }
  }

  return {
    launch() {
      vibrate(10)
    },
    impact(strength) {
      if (!Number.isFinite(strength) || strength < 0.5) return
      const clamped = Math.min(1, Math.max(0, strength))
      vibrate(Math.round(15 + clamped * 10))
    },
    perfect() {
      vibrate([14, 60, 26])
    },
    dispose() {
      if (disposed) return
      disposed = true
      // 画面を離れた直後に振動が鳴り続けないよう、予約ぶんを打ち切る
      // （vibrate(0)は「いま鳴っている振動の停止」を意味する）。
      if (!canVibrate()) return
      try {
        navigator.vibrate(0)
      } catch {
        // 停止できない端末でも、画面遷移そのものは妨げない。
      }
    },
  }
}
