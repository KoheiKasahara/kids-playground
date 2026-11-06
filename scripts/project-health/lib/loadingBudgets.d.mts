export interface LoadingBudgets {
  initialJsGzipKb: number
  initialCssGzipKb: number
  precacheWarnKb: number
  precacheBaselineKb: number
  precacheGrowthWarnKb: number
}
export function parseLoadingBudgets(raw: string): LoadingBudgets
export function evaluateLoadingMetric(
  key: 'initialJsGzipKb' | 'initialCssGzipKb' | 'precacheKb',
  valueKb: number | null,
  budgets: LoadingBudgets,
): { status: 'unknown' | 'warning' | 'error' | 'healthy'; limitKb: number; overLimit: boolean; overGrowth: boolean }
interface LoadingMetrics {
  initial: { js: { gzip: number }; css: { gzip: number } }
  precache: { bytes: number }
}
export function evaluateLoadingBudgets(metrics: LoadingMetrics, budgets: LoadingBudgets): { errors: string[]; warnings: string[] }
export function renderLoadingBudgetMarkdown(metrics: LoadingMetrics, budgets: LoadingBudgets): string
