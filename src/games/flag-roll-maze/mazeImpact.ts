/** これ未満の落差は転がり抵抗とみなし鳴らさない。 */
export const WALL_HIT_MIN_SPEED_DROP = 1.1
/** この落差で音量が最大になる。 */
export const WALL_HIT_MAX_SPEED_DROP = 3.2
/** ぶつかる前にこの速さが無ければ鳴らさない（そっと触れただけで鳴らさない）。 */
export const WALL_HIT_MIN_SPEED_BEFORE = 1.3
/** 「カカカカ」を防ぐ最小間隔(ms)。 */
export const WALL_HIT_COOLDOWN_MS = 120

export type ImpactTracker = { lastHitAtMs: number }

export function createImpactTracker(): ImpactTracker {
  // 初回の衝突は時刻0付近でも間引かず、実際の発火時刻だけを記録する。
  return { lastHitAtMs: -Infinity }
}

/**
 * 戻り値の intensity は 0〜1。null のときは鳴らさない。
 * 鳴らすと判断したときだけ tracker を新しい時刻へ更新する。
 */
export function updateImpactTracker(
  tracker: ImpactTracker,
  input: { speedBefore: number; speedAfter: number; nowMs: number },
): { tracker: ImpactTracker; intensity: number | null } {
  const { speedBefore, speedAfter, nowMs } = input
  if (
    !Number.isFinite(speedBefore) ||
    !Number.isFinite(speedAfter) ||
    !Number.isFinite(nowMs)
  ) {
    return { tracker, intensity: null }
  }
  if (speedBefore < WALL_HIT_MIN_SPEED_BEFORE) {
    return { tracker, intensity: null }
  }

  const drop = speedBefore - speedAfter
  if (!Number.isFinite(drop) || drop < WALL_HIT_MIN_SPEED_DROP) {
    return { tracker, intensity: null }
  }
  if (nowMs - tracker.lastHitAtMs < WALL_HIT_COOLDOWN_MS) {
    return { tracker, intensity: null }
  }

  const normalized = (drop - WALL_HIT_MIN_SPEED_DROP) /
    (WALL_HIT_MAX_SPEED_DROP - WALL_HIT_MIN_SPEED_DROP)
  const intensity = Math.min(1, Math.max(0, normalized))
  return { tracker: { lastHitAtMs: nowMs }, intensity }
}
