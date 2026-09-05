import { existsSync, readFileSync, readdirSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

import { countGames } from './lib/gameCatalog.mjs'
import { parseVitestSummary } from './lib/vitestReport.mjs'
import { measureBundleSize } from './lib/bundleSize.mjs'
import { parseNpmAudit } from './lib/npmAudit.mjs'
import { parsePlaywrightSummary } from './lib/playwrightReport.mjs'
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

const rows = buildProjectHealthRows({ gamesCount, unitTests, bundle, dependencies, nightly, deploy, e2e })

const links = []
if (nightly?.htmlUrl) {
  links.push(`Nightly: ${nightly.htmlUrl}`)
}
if (deploy?.htmlUrl) {
  links.push(`Last deploy: ${deploy.htmlUrl}`)
}

const markdown = renderProjectHealthMarkdown(rows, { links })
appendFileSync(summaryPath, `${markdown}\n`)
