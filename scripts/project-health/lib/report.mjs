import { formatBytes, formatTrendCell, ratioIcon, statusIcon, thresholdWarningIcon } from './format.mjs'
import { computeTrend, coveragePercent } from './historyTrend.mjs'

const DASH = '—'
const NO_TREND = ''

// 収集済みデータ（すべて null/undefined 許容）から Summary の行を組み立てる。
// ここではファイルI/OやAPI呼び出しを一切行わないため、失敗時の表示（—, ❓）を
// 外部依存なしにテストできる。
//
// `previous` は「直前の有効な履歴」から指標ごとに探した値（Issue #525）。
// 指標によって「増える/減る」の良し悪しが異なるため、ここで指標ごとに
// direction を指定して improved / worsened を判定する。
export function buildProjectHealthRows({
  gamesCount = null,
  unitTests = { total: null, passed: null },
  bundle = null,
  dependencies = null,
  nightly = null,
  deploy = null,
  e2e = null,
  lighthouse = { performance: null, accessibility: null },
  thresholds = { lighthousePerformance: null, accessibility: null },
  previous = {},
} = {}) {
  const unitTotal = unitTests?.total ?? null
  const unitPassed = unitTests?.passed ?? null
  const e2eTarget = e2e?.total ?? gamesCount ?? null
  const e2ePassed = e2e?.passed ?? null
  const bundleKb = bundle ? Math.round(bundle.total / 1024) : null
  const currentCoverage = coveragePercent(e2e?.passed ?? null, e2e?.total ?? null)
  const previousCoverage = coveragePercent(previous.e2eSmokePassed ?? null, previous.e2eSmokeTotal ?? null)

  const trends = {
    unitTests: computeTrend(unitTotal, previous.unitTests ?? null, 'neutral'),
    bundleKb: computeTrend(bundleKb, previous.bundleKb ?? null, 'lowerIsBetter'),
    lighthousePerformance: computeTrend(
      lighthouse?.performance ?? null,
      previous.lighthousePerformance ?? null,
      'higherIsBetter',
    ),
    accessibility: computeTrend(lighthouse?.accessibility ?? null, previous.accessibility ?? null, 'higherIsBetter'),
    vulnerabilities: computeTrend(dependencies?.total ?? null, previous.vulnerabilities ?? null, 'lowerIsBetter'),
    e2eCoverage: computeTrend(currentCoverage, previousCoverage, 'higherIsBetter'),
  }

  const dependencySeverity = (deps) => {
    if (!deps) {
      return '❓'
    }
    if (deps.total === 0) {
      return '✅'
    }
    if ((deps.critical ?? 0) > 0 || (deps.high ?? 0) > 0) {
      return '❌'
    }
    return '⚠️'
  }

  return [
    {
      metric: 'Games',
      value: gamesCount !== null ? String(gamesCount) : DASH,
      status: gamesCount !== null ? '' : '❓',
      trend: NO_TREND,
    },
    {
      metric: 'Unit tests',
      value: unitTotal !== null ? `${unitPassed ?? '?'} / ${unitTotal}` : DASH,
      status: ratioIcon(unitPassed, unitTotal),
      trend: formatTrendCell(trends.unitTests),
    },
    {
      metric: 'E2E smoke',
      value: e2eTarget !== null ? `${e2ePassed ?? '?'} / ${e2eTarget}` : DASH,
      status: ratioIcon(e2ePassed, e2eTarget),
      trend: formatTrendCell(trends.e2eCoverage, { unit: 'pt' }),
    },
    {
      metric: 'Bundle',
      value: bundle ? formatBytes(bundle.total) : DASH,
      status: bundle ? '' : '❓',
      trend: formatTrendCell(trends.bundleKb, { unit: 'KB' }),
    },
    {
      metric: 'Dependencies',
      value: dependencies ? `${dependencies.total} vulnerable` : DASH,
      status: dependencySeverity(dependencies),
      trend: formatTrendCell(trends.vulnerabilities),
    },
    {
      metric: 'Lighthouse Performance',
      value: lighthouse?.performance !== null && lighthouse?.performance !== undefined ? String(lighthouse.performance) : DASH,
      status: thresholdWarningIcon(lighthouse?.performance ?? null, thresholds?.lighthousePerformance ?? null),
      trend: formatTrendCell(trends.lighthousePerformance),
    },
    {
      metric: 'Accessibility',
      value: lighthouse?.accessibility !== null && lighthouse?.accessibility !== undefined ? String(lighthouse.accessibility) : DASH,
      status: thresholdWarningIcon(lighthouse?.accessibility ?? null, thresholds?.accessibility ?? null),
      trend: formatTrendCell(trends.accessibility),
    },
    {
      metric: 'Nightly',
      value: nightly ? (nightly.conclusion ?? nightly.status ?? DASH) : DASH,
      status: statusIcon(nightly?.conclusion ?? null),
      trend: NO_TREND,
    },
    {
      metric: 'Last deploy',
      value: deploy ? (deploy.conclusion ?? deploy.status ?? DASH) : DASH,
      status: statusIcon(deploy?.conclusion ?? null),
      trend: NO_TREND,
    },
  ]
}

export function renderProjectHealthMarkdown(rows, { links = [] } = {}) {
  const lines = [
    '## Project Health',
    '',
    '| Metric | Value | Status | Trend (前回比) |',
    '| --- | --- | :---: | :---: |',
    ...rows.map((row) => `| ${row.metric} | ${row.value} | ${row.status} | ${row.trend || DASH} |`),
    '',
  ]

  if (links.length > 0) {
    lines.push('<details><summary>Details</summary>', '', ...links.map((link) => `- ${link}`), '', '</details>', '')
  }

  lines.push(
    '_Games / Unit tests / Bundle / Dependencies はこのジョブの build・test 結果の再集計です。' +
      ' E2E smoke / Nightly / Last deploy / Lighthouse Performance / Accessibility は直近の' +
      ' Nightly・Deploy ワークフロー実行結果の再利用です（Dashboardのために再実行はしていません）。' +
      ' 取得に失敗した指標は — / ❓ で表示され、Dashboard全体は失敗しません。' +
      ' Lighthouse は実行環境でスコアが揺らぐため、閾値未達は⚠️（Warning）表示とし、現時点ではCIを失敗させません。' +
      ' Trend は `public/project-health/history.json`（Nightly実行時に日次更新）に保存された' +
      ' 直前の有効な値との差分です。▲/▼は増加/減少を示すだけで、良し悪しは指標により異なります' +
      '（例: Bundle/Dependenciesは▼が改善、Lighthouse/Accessibility/E2E smokeは▲が改善）。' +
      ' 履歴が無い場合は — と表示されます。_',
    '',
  )

  return lines.join('\n')
}
