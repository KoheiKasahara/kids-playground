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
  dependencyStatusIcon,
  formatTrendCell,
  ratioIcon,
  statusIcon,
  thresholdWarningIcon,
} from '../../scripts/project-health/lib/format.mjs'
import type { ProjectHealthThresholds } from '../../scripts/project-health/lib/projectHealthConfig.mjs'

export const DASH = '—'

export type StatusIcon = '✅' | '⚠️' | '❌' | '❓' | '⏭️' | ''

export type OverallStatus = 'healthy' | 'warning' | 'error' | 'unknown'

export interface MetricViewModel {
  key: string
  label: string
  value: string
  status: StatusIcon
  trendText: string
  trendJudgement: 'improved' | 'worsened' | 'neutral' | null
  group?: 'quality' | 'loading' | 'delivery'
  description?: string
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
  const value = points.at(-1)
  return value === null || value === undefined ? DASH : String(value)
}

export function workflowLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    success: '成功', failure: '失敗', timed_out: '時間切れ', cancelled: '中止', skipped: '未実行',
    in_progress: '実行中', queued: '待機中', waiting: '待機中', pending: '待機中',
    action_required: '操作が必要', neutral: '判定なし', stale: '期限切れ', completed: '完了（結果不明）',
  }
  return value ? labels[value] ?? '状態不明' : DASH
}

export function isHistoryStale(recordedAt: string | null, now = Date.now()): boolean {
  const timestamp = recordedAt ? Date.parse(recordedAt) : NaN
  return !Number.isFinite(timestamp) || timestamp > now + 60_000 || now - timestamp >= 48 * 60 * 60 * 1000
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
  // アプリ追加による総量増加を性能劣化とは判定しない。初期読込量を別途見る。
  const bundleTrend = trendText(bundleKb, previousBundleKb, 'neutral', 'KB')

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
  const previousE2e = [...priorEntries].reverse().find((entry) => coveragePercent(entry.e2eSmokePassed, entry.e2eSmokeTotal) !== null)
  const previousCoverage = coveragePercent(previousE2e?.e2eSmokePassed ?? null, previousE2e?.e2eSmokeTotal ?? null)
  const e2eTrend = trendText(currentCoverage, previousCoverage, 'higherIsBetter', 'pt')

  const games = latest.games ?? null
  const unitPassed = latest.unitTestsPassed ?? null
  const e2eStatus = ratioIcon(e2ePassed, e2eTotal) as StatusIcon
  const target = latest.lighthouseTarget && latest.lighthouseTarget !== 'Top' ? latest.lighthouseTarget : 'ホーム画面'
  const severityKnown = [latest.vulnerabilitiesCritical, latest.vulnerabilitiesHigh, latest.vulnerabilitiesModerate,
    latest.vulnerabilitiesLow, latest.vulnerabilitiesInfo].every((value) => typeof value === 'number')

  const metrics: MetricViewModel[] = [
    {
      key: 'games',
      label: '計測時のアプリ数',
      value: games !== null ? String(games) : DASH,
      status: games !== null ? '' : '❓',
      trendText: DASH,
      trendJudgement: null,
      group: 'quality',
      description: '定期チェック時点のアプリ一覧から集計',
    },
    {
      key: 'unitTests',
      label: '単体・画面テスト',
      value: unitTests !== null ? `${unitPassed ?? '?'} / ${unitTests}` : DASH,
      status: ratioIcon(unitPassed, unitTests) as StatusIcon,
      trendText: unitTestsTrend.text,
      trendJudgement: unitTestsTrend.judgement,
      group: 'quality',
      description: '成功 / 総件数（時間のかかるテストを含む）',
    },
    {
      key: 'e2eSmoke',
      label: 'ブラウザ動作テスト',
      value: e2eTotal !== null ? `${e2ePassed ?? '?'} / ${e2eTotal}` : DASH,
      status: e2eStatus === '✅' && (latest.e2eSmokeFlaky ?? 0) > 0 ? '⚠️' : e2eStatus,
      trendText: e2eTrend.text,
      trendJudgement: e2eTrend.judgement,
      group: 'quality',
      description: `成功 / 総ケース数（アプリ数とは別）${latest.e2eSmokeFlaky != null
        ? `。再試行で成功 ${latest.e2eSmokeFlaky}件・未実行 ${latest.e2eSmokeSkipped ?? '?'}件` : ''}`,
    },
    {
      key: 'bundle',
      label: '全アプリのJS・CSS容量',
      value: bundleKb !== null ? formatBytes(bundleKb * 1024) : DASH,
      status: bundleKb !== null ? '' : '❓',
      trendText: bundleTrend.text,
      trendJudgement: bundleTrend.judgement,
      group: 'loading',
      description: '圧縮前の合計。画像・音声・3Dモデルは含まない',
    },
    {
      key: 'lighthousePerformance',
      label: '表示速度',
      value: lighthousePerformance !== null ? String(lighthousePerformance) : DASH,
      status: thresholdWarningIcon(lighthousePerformance, thresholds.lighthousePerformance) as StatusIcon,
      trendText: lighthouseTrend.text,
      trendJudgement: lighthouseTrend.judgement,
      group: 'loading',
      description: `${target}のLighthouse測定・目標 ${thresholds.lighthousePerformance}点以上`,
    },
    {
      key: 'accessibility',
      label: 'アクセシビリティ',
      value: accessibility !== null ? String(accessibility) : DASH,
      status: thresholdWarningIcon(accessibility, thresholds.accessibility) as StatusIcon,
      trendText: accessibilityTrend.text,
      trendJudgement: accessibilityTrend.judgement,
      group: 'loading',
      description: `${target}の自動検査・目標 ${thresholds.accessibility}点以上`,
    },
    {
      key: 'vulnerabilities',
      label: '依存関係の脆弱性',
      value: vulnerabilities !== null ? `${vulnerabilities}件` : DASH,
      status: dependencyStatusIcon({ total: vulnerabilities, high: latest.vulnerabilitiesHigh,
        critical: latest.vulnerabilitiesCritical }) as StatusIcon,
      trendText: vulnerabilitiesTrend.text,
      trendJudgement: vulnerabilitiesTrend.judgement,
      group: 'quality',
      description: severityKnown
        ? `重大 ${latest.vulnerabilitiesCritical}・高 ${latest.vulnerabilitiesHigh}・中 ${latest.vulnerabilitiesModerate}・低 ${latest.vulnerabilitiesLow}・情報 ${latest.vulnerabilitiesInfo}（開発用を含む）`
        : '開発用を含む依存パッケージ数。重大度の内訳は次回計測から表示',
    },
    {
      key: 'nightly',
      label: '毎日の定期チェック',
      value: workflowLabel(latest.nightly),
      status: statusIcon(latest.nightly) as StatusIcon,
      trendText: DASH,
      trendJudgement: null,
      group: 'delivery',
      description: '日本時間 午前3時に開始。全テスト・ビルドを確認',
    },
    {
      key: 'deploy',
      label: 'サイトの公開処理',
      value: workflowLabel(latest.deploy),
      status: statusIcon(latest.deploy) as StatusIcon,
      trendText: DASH,
      trendJudgement: null,
      group: 'delivery',
      description: '定期チェック時点で取得した直近の公開結果',
    },
  ]

  for (const [key, label, description, direction] of [
    ['initialJsGzipKb', '初期読込のJS', 'ホーム画面の静的依存・gzip換算。遅延読込のゲーム処理は含まない', 'lowerIsBetter'],
    ['initialCssGzipKb', '初期読込のCSS', 'ホーム画面のスタイル・gzip換算', 'lowerIsBetter'],
    ['precacheKb', 'オフライン保存容量', `PWAが事前保存する画像・音声・3Dモデル等を含む圧縮前の合計${latest.precacheEntries != null ? `（${latest.precacheEntries}ファイル）` : ''}`, 'neutral'],
  ] as const) {
    const current = latest[key] ?? null
    const trend = trendText(current, previousOf(priorEntries, latestDate, key) ?? null, direction, 'KB')
    metrics.push({ key, label, description, group: 'loading', value: current !== null ? formatBytes(current * 1024) : DASH,
      status: current !== null ? '' : '❓', trendText: trend.text, trendJudgement: trend.judgement })
  }

  const sparklines: SparklineSeries[] = [
    { key: 'games', label: '計測時のアプリ数', points: recentValues(entries, 'games'), latestText: '' },
    { key: 'initialJsGzipKb', label: '初期JS（gzip換算・KB）', points: recentValues(entries, 'initialJsGzipKb'), latestText: '' },
    { key: 'bundle', label: '全アプリのJS・CSS（KB）', points: recentValues(entries, 'bundleKb'), latestText: '' },
    {
      key: 'lighthousePerformance',
      label: '表示速度（点）',
      points: recentValues(entries, 'lighthousePerformance'),
      latestText: '',
    },
    { key: 'vulnerabilities', label: '脆弱性（件）', points: recentValues(entries, 'vulnerabilities'), latestText: '' },
    { key: 'unitTests', label: '単体・画面テスト（総件数）', points: recentValues(entries, 'unitTests'), latestText: '' },
  ].map((series) => ({ ...series, latestText: latestValueText(series.points) }))

  return {
    hasHistory: true,
    overallStatus: computeOverallStatus(metrics),
    latestDate,
    updatedAt: latest.recordedAt ?? updatedAt,
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
  if (metrics.some((metric) => metric.status === '⚠️' || metric.status === '⏭️')) {
    return 'warning'
  }
  if (metrics.some((metric) => metric.status === '❓')) return 'unknown'
  return 'healthy'
}
