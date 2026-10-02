import { useSyncExternalStore } from 'react'

/**
 * 全ゲーム共通の触覚（振動）フィードバック（Issue #784 A7）。
 *
 * `navigator.vibrate` は Android の Chrome などだけが対応し、iOS Safari では使えない。
 * 対応端末でも実行時に拒否されることがあるため、「対応チェック→try/catch」で必ず失敗を吸収し、
 * 振動が使えなくてもゲーム進行に一切影響しないようにする（あくまで手触りの上乗せ）。
 * `prefers-reduced-motion: reduce` のときは体感を強める演出とみなして振動しない。
 * ON/OFF はよみあげ設定と同じくモジュールスコープのストアで持ち、localStorage に保存する（既定は ON）。
 */

export type HapticKind =
  /** ボタンを押した・ものを置いた、などの軽い手ごたえ。 */
  | 'tap'
  /** ぶつかった・当たった瞬間。 */
  | 'impact'
  /** 正解・成功。 */
  | 'success'
  /** 不正解。こわがらせないよう短く1回だけ。 */
  | 'error'
  /** ゴール・ステージクリアなどのお祝い。 */
  | 'celebrate'

export const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  impact: 18,
  success: [12, 50, 18],
  error: 28,
  celebrate: [14, 60, 22, 60, 36],
}

/** 連続した衝突などで振動しっぱなしにならないようにする最小間隔[ms]。 */
const HAPTICS_COOLDOWN_MS = 80

export const HAPTICS_ENABLED_STORAGE_KEY = 'kids-playground:haptics-enabled'

let cachedEnabled: boolean | undefined
let lastVibrateAt: number | null = null
const listeners = new Set<() => void>()

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

function readFromStorage(): boolean {
  try {
    // 明示的に OFF にしたときだけ止める。未設定・不明な値は既定の ON 扱い。
    return window.localStorage.getItem(HAPTICS_ENABLED_STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

/** 振動が有効かどうか（ユーザー設定）。端末が対応しているかどうかは canVibrate() で別に見る。 */
export function isHapticsEnabled(): boolean {
  if (cachedEnabled === undefined) cachedEnabled = readFromStorage()
  return cachedEnabled
}

/** 振動の ON/OFF を切り替えて保存する。OFF にした瞬間に鳴っている振動も止める。 */
export function setHapticsEnabled(enabled: boolean): void {
  const previous = isHapticsEnabled()
  cachedEnabled = enabled
  try {
    window.localStorage.setItem(HAPTICS_ENABLED_STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // 保存できなくてもメモリ上の設定は切り替わる。
  }
  if (!enabled) stopHaptics()
  if (previous !== enabled) listeners.forEach((listener) => listener())
}

export function subscribeHapticsEnabled(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 設定画面から使う React Hook。値が変わると再レンダーされる。 */
export function useHapticsEnabled(): boolean {
  return useSyncExternalStore(subscribeHapticsEnabled, isHapticsEnabled, () => true)
}

/** いま振動を鳴らしてよいか（端末対応・ユーザー設定・動きを減らす設定をすべて満たすか）。 */
export function hapticsAvailable(): boolean {
  return canVibrate() && isHapticsEnabled() && !prefersReducedMotion()
}

/**
 * 種類に応じた短い振動を鳴らす。鳴らせない環境では何もしない。
 * 数値・配列を直接渡すこともできる（ゲーム固有の強弱をつけたいとき用）。
 */
export function vibrate(kind: HapticKind | number | number[]): void {
  if (!hapticsAvailable()) return
  const now = Date.now()
  if (lastVibrateAt !== null && now - lastVibrateAt < HAPTICS_COOLDOWN_MS) return
  lastVibrateAt = now
  const pattern = typeof kind === 'string' ? HAPTIC_PATTERNS[kind] : kind
  try {
    navigator.vibrate(pattern)
  } catch {
    // 対応をうたっていても実行時に拒否される端末があるため、失敗は無視する。
  }
}

/** 鳴っている振動を止める。画面を離れるときなどに呼ぶ。 */
export function stopHaptics(): void {
  if (!canVibrate()) return
  try {
    navigator.vibrate(0)
  } catch {
    // 止められない端末でも、画面遷移そのものは妨げない。
  }
}

/** テスト用: 設定キャッシュとクールダウンを捨てる。アプリ本体からは呼ばない。 */
export function resetHapticsForTest(): void {
  cachedEnabled = undefined
  lastVibrateAt = null
}
