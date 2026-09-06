// Project Health Web Dashboard（Issue #526）のデータ組み立てロジック。
// 指標の計測・収集は一切行わず、Nightly が書き出す public/project-health/history.json
// （Issue #525）だけを入力にする純粋関数群。CI Summary（generate-summary.mjs /
// scripts/project-health/lib/report.mjs）と同じ判定関数を再利用し、Success/Warning/
// Error の判定やトレンド算出をここで二重に作り直さない。
import {
  findPreviousMetricValue,
  type ProjectHealthHistoryEntry,
} from '../../scripts/project-health/lib/history.mjs'
import { computeTrend, coveragePercent, type TrendDirection } from '../../scripts/project-health/lib/historyTrend.mjs'
import {
  formatBytes,
  formatTrendCell,
  ratioIcon,
  statusIcon,
  thresholdWarningIcon,
} from '../../scripts/project-health/lib/format.mjs'
import type { ProjectHealthThresholds } from '../../scripts/project-health/lib/projectHealthConfig.mjs'

export const DASH = '—'

export type StatusIcon = '✅' | '⚠️' | '❌' | '❓' | ''

export type OverallStatus = 'healthy' | 'warning' | 'error' | 'unknown'

export interface MetricViewModel {
  key: string
  label: string
  value: string
  status: StatusIcon
  trendText: string
  trendJudgement: 'improved' | 'worsened' | 'neutral' | null
}

export interface SparklineSeries {
  key: string
  label: string
  points: Array<number | null>
  latestText: string
}

export interface DashboardViewModel {
  hasHistory: boolean
  overallStatus: OverallStatus
  latestDate: string | null
  updatedAt: string | null
  metrics: MetricViewModel[]
  sparklines: SparklineSeries[]
}

const MAX_SPARKLINE_POINTS = 12

function previousOf<K extends keyof ProjectHealthHistoryEntry>(
  priorEntries: ProjectHealthHistoryEntry[],
  latestDate: string | null,
  key: K,
): ProjectHealthHistoryEntry[K] | null {
  return findPreviousMetricValue(priorEntries, latestDate, key)
}

// 小数（E2E coverageの%など）は current - previous の浮動小数点誤差で
// 「7.099999999999994」のような表示になり得るため、小数第1位に丸める。
// 整数指標（bundleKb / lighthouse等）はdeltaが常に整数なので影響しない。
const formatMagnitude = (magnitude: number) => {
  const rounded = Math.round(magnitude * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function trendText(
  current: number | null,
  previous: number | null,
  direction: TrendDirection,
  unit = '',
): { text: string; judgement: 'improved' | 'worsened' | 'neutral' | null } {
  const trend = computeTrend(current, previous, direction)
  return { text: formatTrendCell(trend, { unit, formatMagnitude }), judgement: trend?.judgement ?? null }
}

function recentValues(
  entries: ProjectHealthHistoryEntry[],
  key: keyof ProjectHealthHistoryEntry,
): Array<number | null> {
  return entries.slice(-MAX_SPARKLINE_POINTS).map((entry) => {
    const value = entry[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  })
}

function latestValueText(points: Array<number | null>): string {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const point = points[i]
    if (point !== null) {
      return String(point)
    }
  }
  return DASH
}

/** データが一切無い/壊れている場合も落ちない空のビューモデル。 */
export function emptyDashboardViewModel(): DashboardViewModel {
  return {
    hasHistory: false,
    overallStatus: 'unknown',
    latestDate: null,
    updatedAt: null,
    metrics: [],
    sparklines: [],
  }
}

export function buildDashboardViewModel(
  entries: ProjectHealthHistoryEntry[],
  thresholds: ProjectHealthThresholds,
  updatedAt: string | null,
): DashboardViewModel {
  if (!Array.isArray(entries) || entries.length === 0) {
    return emptyDashboardViewModel()
  }

  const latest = entries[entries.length - 1]
  const priorEntries = entries.slice(0, -1)
  const latestDate = latest.date ?? null

  const bundleKb = latest.bundleKb ?? null
  const previousBundleKb = previousOf(priorEntries, latestDate, 'bundleKb')
  const bundleTrend = trendText(bundleKb, previousBundleKb, 'lowerIsBetter', 'KB')

  const lighthousePerformance = latest.lighthousePerformance ?? null
  const previousLighthouse = previousOf(priorEntries, latestDate, 'lighthousePerformance')
  const lighthouseTrend = trendText(lighthousePerformance, previousLighthouse, 'higherIsBetter')

  const accessibility = latest.accessibility ?? null
  const previousAccessibility = previousOf(priorEntries, latestDate, 'accessibility')
  const accessibilityTrend = trendText(accessibility, previousAccessibility, 'higherIsBetter')

  const unitTests = latest.unitTests ?? null
  const previousUnitTests = previousOf(priorEntries, latestDate, 'unitTests')
  const unitTestsTrend = trendText(unitTests, previousUnitTests, 'neutral')

  const vulnerabilities = latest.vulnerabilities ?? null
  const previousVulnerabilities = previousOf(priorEntries, latestDate, 'vulnerabilities')
  const vulnerabilitiesTrend = trendText(vulnerabilities, previousVulnerabilities, 'lowerIsBetter')

  const e2ePassed = latest.e2eSmokePassed ?? null
  const e2eTotal = latest.e2eSmokeTotal ?? null
  const currentCoverage = coveragePercent(e2ePassed, e2eTotal)
  const previousPassed = previousOf(priorEntries, latestDate, 'e2eSmokePassed')
  const previousTotal = previousOf(priorEntries, latestDate, 'e2eSmokeTotal')
  const previousCoverage = coveragePercent(previousPassed, previousTotal)
  const e2eTrend = trendText(currentCoverage, previousCoverage, 'higherIsBetter', 'pt')

  const games = latest.games ?? null

  const metrics: MetricViewModel[] = [
    {
      key: 'games',
      label: 'Games',
      value: games !== null ? String(games) : DASH,
      status: games !== null ? '' : '❓',
      trendText: DASH,
      trendJudgement: null,
    },
    {
      key: 'unitTests',
      label: 'Unit tests',
      value: unitTests !== null ? String(unitTests) : DASH,
      status: unitTests !== null ? '' : '❓',
      trendText: unitTestsTrend.text,
      trendJudgement: unitTestsTrend.judgement,
    },
    {
      key: 'e2eSmoke',
      label: 'E2E smoke',
      value: e2eTotal !== null ? `${e2ePassed ?? '?'} / ${e2eTotal}` : DASH,
      status: ratioIcon(e2ePassed, e2eTotal) as StatusIcon,
      trendText: e2eTrend.text,
      trendJudgement: e2eTrend.judgement,
    },
    {
      key: 'bundle',
      label: 'Bundle size',
      value: bundleKb !== null ? formatBytes(bundleKb * 1024) : DASH,
      status: bundleKb !== null ? '' : '❓',
      trendText: bundleTrend.text,
      trendJudgement: bundleTrend.judgement,
    },
    {
      key: 'lighthousePerformance',
      label: 'Lighthouse Performance',
      value: lighthousePerformance !== null ? String(lighthousePerformance) : DASH,
      status: thresholdWarningIcon(lighthousePerformance, thresholds.lighthousePerformance) as StatusIcon,
      trendText: lighthouseTrend.text,
      trendJudgement: lighthouseTrend.judgement,
    },
    {
      key: 'accessibility',
      label: 'Accessibility',
      value: accessibility !== null ? String(accessibility) : DASH,
      status: thresholdWarningIcon(accessibility, thresholds.accessibility) as StatusIcon,
      trendText: accessibilityTrend.text,
      trendJudgement: accessibilityTrend.judgement,
    },
    {
      key: 'vulnerabilities',
      label: 'Vulnerabilities',
      value: vulnerabilities !== null ? `${vulnerabilities} vulnerable` : DASH,
      status: vulnerabilities === null ? '❓' : vulnerabilities === 0 ? '✅' : '⚠️',
      trendText: vulnerabilitiesTrend.text,
      trendJudgement: vulnerabilitiesTrend.judgement,
    },
    {
      key: 'nightly',
      label: 'Nightly',
      value: latest.nightly ?? DASH,
      status: statusIcon(latest.nightly) as StatusIcon,
      trendText: DASH,
      trendJudgement: null,
    },
    {
      key: 'deploy',
      label: 'Last deploy',
      value: latest.deploy ?? DASH,
      status: statusIcon(latest.deploy) as StatusIcon,
      trendText: DASH,
      trendJudgement: null,
    },
  ]

  const sparklines: SparklineSeries[] = [
    { key: 'bundle', label: 'Bundle (KB)', points: recentValues(entries, 'bundleKb'), latestText: '' },
    {
      key: 'lighthousePerformance',
      label: 'Lighthouse Performance',
      points: recentValues(entries, 'lighthousePerformance'),
      latestText: '',
    },
    { key: 'accessibility', label: 'Accessibility', points: recentValues(entries, 'accessibility'), latestText: '' },
    { key: 'unitTests', label: 'Unit tests', points: recentValues(entries, 'unitTests'), latestText: '' },
  ].map((series) => ({ ...series, latestText: latestValueText(series.points) }))

  return {
    hasHistory: true,
    overallStatus: computeOverallStatus(metrics),
    latestDate,
    updatedAt,
    metrics,
    sparklines,
  }
}

/**
 * 全体Healthの判定。Phase 1〜3に既存の集約ロジックは無いため、Phase 4独自の
 * 複雑な評価は作らず、各指標が既に持っているステータスアイコン（❌/⚠️/✅/❓）を
 * そのまま素直に集約するだけにする（❌が1つでもあればerror、次に⚠️があればwarning）。
 */
export function computeOverallStatus(metrics: MetricViewModel[]): OverallStatus {
  if (metrics.length === 0) {
    return 'unknown'
  }
  if (metrics.some((metric) => metric.status === '❌')) {
    return 'error'
  }
  if (metrics.some((metric) => metric.status === '⚠️')) {
    return 'warning'
  }
  return 'healthy'
}
