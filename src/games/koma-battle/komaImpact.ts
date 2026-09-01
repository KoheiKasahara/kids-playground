/**
 * コマ衝突の強さと発生間隔を、物理・音・視覚演出から切り離して扱う。
 *
 * Rapierの接触イベントをそのまま毎ステップ演出へ流すと、接触中の
 * コマが音やリングを連打してしまう。この小さな状態機械で「接触開始」
 * の代表イベントだけを通す。
 */

/** この速度未満の接触は、かすっただけとして演出しない。 */
export const IMPACT_MIN_RELATIVE_SPEED = 0.7
/** この速度で強い衝突の上限へ到達する。 */
export const IMPACT_MAX_RELATIVE_SPEED = 4.5
/** 同じ接触対象へ再び演出を出すまでの最短時間[ms]。 */
export const IMPACT_PAIR_COOLDOWN_MS = 160
/** 異なる対象でも短時間に鳴りすぎないための全体間隔[ms]。 */
export const IMPACT_GLOBAL_COOLDOWN_MS = 85

export type KomaImpactLevel = 'weak' | 'normal' | 'strong'

export function impactIntensityForRelativeSpeed(relativeSpeed: number): number {
  if (!Number.isFinite(relativeSpeed) || relativeSpeed < IMPACT_MIN_RELATIVE_SPEED) return 0
  return Math.min(
    1,
    Math.max(0, (relativeSpeed - IMPACT_MIN_RELATIVE_SPEED) /
      (IMPACT_MAX_RELATIVE_SPEED - IMPACT_MIN_RELATIVE_SPEED)),
  )
}

export function impactLevelForRelativeSpeed(relativeSpeed: number): KomaImpactLevel | null {
  const intensity = impactIntensityForRelativeSpeed(relativeSpeed)
  if (intensity <= 0) return null
  if (intensity >= 0.66) return 'strong'
  if (intensity >= 0.28) return 'normal'
  return 'weak'
}

export type KomaImpactThrottle = {
  /** このイベントを演出へ通してよいかを返す。通す場合は時刻を記録する。 */
  tryEmit: (key: string, nowMs: number) => boolean
  /** 再戦やテストで状態を空にする。 */
  reset: () => void
}

export function createKomaImpactThrottle(
  pairCooldownMs = IMPACT_PAIR_COOLDOWN_MS,
  globalCooldownMs = IMPACT_GLOBAL_COOLDOWN_MS,
): KomaImpactThrottle {
  const lastByKey = new Map<string, number>()
  let lastGlobalAt: number | null = null

  function tryEmit(key: string, nowMs: number): boolean {
    if (!key || !Number.isFinite(nowMs)) return false
    const lastForKey = lastByKey.get(key)
    if (lastForKey !== undefined && nowMs - lastForKey < pairCooldownMs) return false
    if (lastGlobalAt !== null && nowMs - lastGlobalAt < globalCooldownMs) return false

    lastByKey.set(key, nowMs)
    lastGlobalAt = nowMs
    return true
  }

  return {
    tryEmit,
    reset: () => {
      lastByKey.clear()
      lastGlobalAt = null
    },
  }
}
