// historyTrend.mjs の型定義。format.d.mts / src/project-health 側から
// computeTrend / coveragePercent を同一ロジックのまま再利用するために用意する。
export type TrendDirection = 'higherIsBetter' | 'lowerIsBetter' | 'neutral'

export interface HistoryTrendResult {
  delta: number
  trend: 'up' | 'down' | 'flat'
  judgement: 'improved' | 'worsened' | 'neutral'
}

export function computeTrend(
  current: number | null | undefined,
  previous: number | null | undefined,
  direction?: TrendDirection,
): HistoryTrendResult | null

export function coveragePercent(
  passed: number | null | undefined,
  total: number | null | undefined,
): number | null
