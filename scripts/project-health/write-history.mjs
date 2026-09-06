import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { countGames } from './lib/gameCatalog.mjs'
import { parseVitestSummary } from './lib/vitestReport.mjs'
import { measureBundleSize } from './lib/bundleSize.mjs'
import { parseNpmAudit } from './lib/npmAudit.mjs'
import { parsePlaywrightSummary } from './lib/playwrightReport.mjs'
import { parseLighthouseSummary } from './lib/lighthouseReport.mjs'
import { parseProjectHealthConfig } from './lib/projectHealthConfig.mjs'
import { findPreviousMetricValue, parseHistoryFile, toJstDateString, upsertHistoryEntry } from './lib/history.mjs'

// Project Health の履歴保存（Issue #525）。Nightly 完了時にこのスクリプトを実行し、
// 既存の Nightly 実行が生成した成果物（vitest / dist / e2e / lighthouse）を
// 再利用して1レコードを追記する。履歴保存専用の追加テスト・追加計測は行わない。
//
// 失敗しても Nightly 自体や通常開発を止めないよう、ここでは常に exit 0 とする
// （呼び出し側の workflow でも continue-on-error にしている）。

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

const readText = (path) => {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

// 各指標の取得失敗は他の指標に影響させない（Issue #525「欠損値への耐性」）。
const safe = (label, fn, fallback = null) => {
  try {
    return fn()
  } catch (error) {
    console.warn(`[project-health] history: ${label}: ${error instanceof Error ? error.message : error}`)
    return fallback
  }
}

function resolveNightlyOutcome() {
  const outcomes = [
    process.env.PROJECT_HEALTH_NIGHTLY_LINT_OUTCOME,
    process.env.PROJECT_HEALTH_NIGHTLY_TEST_OUTCOME,
    process.env.PROJECT_HEALTH_NIGHTLY_BUILD_OUTCOME,
    process.env.PROJECT_HEALTH_NIGHTLY_E2E_OUTCOME,
  ]
  // 呼び出し側がこの実行の成否を渡さない場合（ローカル実行等）は判定不能として null にする。
  if (outcomes.some((outcome) => !outcome)) {
    return null
  }
  return outcomes.every((outcome) => outcome === 'success') ? 'success' : 'failure'
}

function main() {
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

  const e2eReportPath = process.env.PROJECT_HEALTH_NIGHTLY_E2E_REPORT ?? 'project-health-e2e-nightly.json'
  const e2e = safe('e2e smoke', () => parsePlaywrightSummary(readJson(e2eReportPath)))

  const lighthouseSummaryPath = process.env.PROJECT_HEALTH_LIGHTHOUSE_SUMMARY ?? 'project-health/lighthouse-summary.json'
  const lighthouse = safe(
    'lighthouse',
    () => parseLighthouseSummary(readJson(lighthouseSummaryPath)),
    { name: null, performance: null, accessibility: null },
  )

  const contextPath = process.env.PROJECT_HEALTH_GITHUB_CONTEXT ?? 'project-health/github-context.json'
  const context = safe('github context', () => readJson(contextPath)) ?? {}
  const deploy = context.deploy ?? null

  const configPath = process.env.PROJECT_HEALTH_CONFIG ?? '.project-health.json'
  const config = parseProjectHealthConfig(safe('project-health config', () => readText(configPath), undefined))

  const date = process.env.PROJECT_HEALTH_HISTORY_DATE || toJstDateString()
  const recordedAt = new Date().toISOString()
  const runId = process.env.GITHUB_RUN_ID || null

  const entry = {
    date,
    games: gamesCount ?? null,
    unitTests: unitTests?.total ?? null,
    e2eSmokePassed: e2e?.passed ?? null,
    e2eSmokeTotal: e2e?.total ?? null,
    bundleKb: bundle ? Math.round(bundle.total / 1024) : null,
    lighthousePerformance: lighthouse?.performance ?? null,
    accessibility: lighthouse?.accessibility ?? null,
    vulnerabilities: dependencies?.total ?? null,
    nightly: resolveNightlyOutcome(),
    deploy: deploy?.conclusion ?? null,
    recordedAt,
    runId,
  }

  const historyPath = process.env.PROJECT_HEALTH_HISTORY_FILE ?? 'public/project-health/history.json'
  const existing = parseHistoryFile(safe('read history', () => readText(historyPath), undefined))
  const entries = upsertHistoryEntry(existing.entries, entry, { maxEntries: config.history.maxEntries })

  mkdirSync(dirname(historyPath), { recursive: true })
  writeFileSync(historyPath, `${JSON.stringify({ updatedAt: recordedAt, entries }, null, 2)}\n`)

  const previousBundleKb = findPreviousMetricValue(entries.slice(0, -1), date, 'bundleKb')
  const previousLighthouse = findPreviousMetricValue(entries.slice(0, -1), date, 'lighthousePerformance')
  console.log(
    `[project-health] history updated: date=${date} entries=${entries.length}` +
      ` bundleKb=${entry.bundleKb ?? 'null'} (prev ${previousBundleKb ?? 'null'})` +
      ` lighthouse=${entry.lighthousePerformance ?? 'null'} (prev ${previousLighthouse ?? 'null'})`,
  )
}

try {
  main()
} catch (error) {
  console.warn(`[project-health] failed to update history: ${error instanceof Error ? error.message : error}`)
}

process.exit(0)
