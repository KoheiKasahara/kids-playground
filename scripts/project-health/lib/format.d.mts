// format.mjs の型定義。CI Summary（generate-summary.mjs）と Web Dashboard
// （src/project-health/）が同じアイコン/フォーマット判定を共有するために用意する。
import type { HistoryTrendResult } from './historyTrend.mjs'

export function formatBytes(bytes: number | null | undefined): string

export function statusIcon(conclusion: string | null | undefined): string

export function ratioIcon(
  passed: number | null | undefined,
  total: number | null | undefined,
): string

export function thresholdWarningIcon(
  value: number | null | undefined,
  threshold: number | null | undefined,
): string

export function formatTrendCell(
  trend: HistoryTrendResult | null | undefined,
  options?: { unit?: string; formatMagnitude?: (magnitude: number) => string },
): string
