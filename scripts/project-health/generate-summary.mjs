import { existsSync, readFileSync, readdirSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

import { countGames } from './lib/gameCatalog.mjs'
import { parseVitestSummary } from './lib/vitestReport.mjs'
import { measureBundleSize } from './lib/bundleSize.mjs'
import { parseNpmAudit } from './lib/npmAudit.mjs'
import { parsePlaywrightSummary } from './lib/playwrightReport.mjs'
import { parseLighthouseSummary } from './lib/lighthouseReport.mjs'
import { parseProjectHealthConfig } from './lib/projectHealthConfig.mjs'
import { findPreviousMetricValue, parseHistoryFile } from './lib/history.mjs'
import { buildProjectHealthRows, renderProjectHealthMarkdown } from './lib/report.mjs'

// Project Health Dashboard の本体。既存 CI（quick test / build）が生成した
// 成果物と、Nightly / Deploy ワークフローの直近実行結果だけを読み取って
// GITHUB_STEP_SUMMARY に追記する。Dashboardのためだけの再実行は行わない。
const summaryPath = process.env.GITHUB_STEP_SUMMARY
if (!summaryPath) {
  process.exit(0)
}

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

// 各指標の取得失敗は他の指標の表示を妨げない。
const safe = (label, fn, fallback = null) => {
  try {
    return fn()
  } catch (error) {
    console.warn(`[project-health] ${label}: ${error instanceof Error ? error.message : error}`)
    return fallback
  }
}

const gameCatalogPath = process.env.PROJECT_HEALTH_GAME_CATALOG ?? 'src/games/gameCatalog.ts'
const gamesCount = safe('games', () => countGames(readFileSync(gameCatalogPath, 'utf8')))

const vitestResultsPath = process.env.PROJECT_HEALTH_VITEST_RESULTS ?? 'vitest-results.json'
const unitTests = safe('unit tests', () => parseVitestSummary(readJson(vitestResultsPath)), {
  total: null,
  passed: null,
})

const distDir = process.env.PROJECT_HEALTH_DIST_DIR ?? 'dist'
const bundle = safe('bundle size', () => measureBundleSize(distDir))

const auditPath = process.env.PROJECT_HEALTH_AUDIT_FILE ?? 'project-health/npm-audit.json'
const dependencies = safe('dependencies', () => parseNpmAudit(readJson(auditPath)))

const contextPath = process.env.PROJECT_HEALTH_GITHUB_CONTEXT ?? 'project-health/github-context.json'
const context = readJson(contextPath) ?? {}
const nightly = context.nightly ?? null
const deploy = context.deploy ?? null

const e2eReportDir = process.env.PROJECT_HEALTH_NIGHTLY_E2E_DIR ?? 'project-health/nightly-e2e'
const e2e = safe('e2e smoke', () => {
  if (!existsSync(e2eReportDir)) {
    return null
  }
  const file = readdirSync(e2eReportDir).find((name) => name.endsWith('.json'))
  return file ? parsePlaywrightSummary(readJson(join(e2eReportDir, file))) : null
})

// 閾値・計測対象ページは `.project-health.json` に集約する（Issue #524）。
const configPath = process.env.PROJECT_HEALTH_CONFIG ?? '.project-health.json'
const { thresholds, lighthouse: lighthouseConfig } = parseProjectHealthConfig(
  safe('project-health config', () => readFileSync(configPath, 'utf8'), undefined),
)

// Lighthouse計測はNightly / 手動 Full Test 側でのみ実行し、通常CIは
// そこで生成されたサマリJSONを読み取って表示するだけ（再計測はしない）。
const lighthouseSummaryPath =
  process.env.PROJECT_HEALTH_LIGHTHOUSE_SUMMARY ?? 'project-health/lighthouse-nightly/lighthouse-summary.json'
const lighthouse = safe(
  'lighthouse',
  () => parseLighthouseSummary(readJson(lighthouseSummaryPath)),
  { name: null, performance: null, accessibility: null },
)

// Issue #525: 履歴（Nightly実行時に日次更新）内で直近の有効な値を指標ごとに
// 探し、前回値との差分をSummaryに表示する。履歴ファイルが無い/壊れている
// 場合も空履歴として扱われるため、初回実行時もDashboard生成は失敗しない。
const historyPath = process.env.PROJECT_HEALTH_HISTORY_FILE ?? 'public/project-health/history.json'
const { entries: historyEntries } = safe(
  'history',
  () => parseHistoryFile(readFileSync(historyPath, 'utf8')),
  { entries: [] },
) ?? { entries: [] }

const previous = {
  unitTests: findPreviousMetricValue(historyEntries, undefined, 'unitTests'),
  bundleKb: findPreviousMetricValue(historyEntries, undefined, 'bundleKb'),
  lighthousePerformance: findPreviousMetricValue(historyEntries, undefined, 'lighthousePerformance'),
  accessibility: findPreviousMetricValue(historyEntries, undefined, 'accessibility'),
  vulnerabilities: findPreviousMetricValue(historyEntries, undefined, 'vulnerabilities'),
  e2eSmokePassed: findPreviousMetricValue(historyEntries, undefined, 'e2eSmokePassed'),
  e2eSmokeTotal: findPreviousMetricValue(historyEntries, undefined, 'e2eSmokeTotal'),
}

const rows = buildProjectHealthRows({
  gamesCount,
  unitTests,
  bundle,
  dependencies,
  nightly,
  deploy,
  e2e,
  lighthouse,
  thresholds,
  previous,
})

const links = []
if (nightly?.htmlUrl) {
  links.push(`Nightly: ${nightly.htmlUrl}`)
}
if (deploy?.htmlUrl) {
  links.push(`Last deploy: ${deploy.htmlUrl}`)
}
links.push(
  `Lighthouse target: ${lighthouse?.name ?? lighthouseConfig.targets[0]?.name ?? 'Top'} (${
    lighthouseConfig.targets.map((target) => target.path).join(', ')
  })`,
)

const markdown = renderProjectHealthMarkdown(rows, { links })
appendFileSync(summaryPath, `${markdown}\n`)
