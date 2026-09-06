import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { launch } from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { preview } from 'vite'

import { parseProjectHealthConfig } from './lib/projectHealthConfig.mjs'
import { roundScore } from './lib/lighthouseReport.mjs'

// Nightly / 手動 Full Test 専用の Lighthouse 計測。
// 通常PR CIには組み込まず、`.project-health.json` の lighthouse.targets に
// 定義された代表ページ（既定: トップページのみ）だけを対象にする。
// 1ターゲットの計測に失敗しても他のターゲット・Summary全体を壊さないよう、
// ここでの失敗は常に null スコアとして記録し、プロセス自体は exit 0 で終える
// （Nightlyワークフロー側の `continue-on-error` と組み合わせて運用する）。

const configPath = process.env.PROJECT_HEALTH_CONFIG ?? '.project-health.json'
const outputPath = process.env.PROJECT_HEALTH_LIGHTHOUSE_OUTPUT ?? 'project-health/lighthouse-summary.json'
const port = Number(process.env.PROJECT_HEALTH_LIGHTHOUSE_PORT ?? 4174)
const host = process.env.PROJECT_HEALTH_LIGHTHOUSE_HOST ?? '127.0.0.1'
const baseUrl = process.env.PROJECT_HEALTH_LIGHTHOUSE_BASE_URL ?? `http://${host}:${port}`

const readConfigFile = (path) => {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}

const { lighthouse: lighthouseConfig } = parseProjectHealthConfig(readConfigFile(configPath))
const targets = lighthouseConfig.targets

// CIでは既存 E2E ステップ（Nightly / Full Test）が `npx playwright install` 済みの
// Chromiumを、そのまま Lighthouse 計測用にも再利用する（新規ブラウザ導入をしない）。
// 未検出の場合は chrome-launcher 標準のシステムChrome検出へフォールバックする。
async function resolveChromePath() {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH
  }
  try {
    const { chromium } = await import('@playwright/test')
    const executablePath = chromium.executablePath()
    if (executablePath && existsSync(executablePath)) {
      return executablePath
    }
  } catch {
    // @playwright/test が使えない環境ではシステムのChromeへフォールバックする。
  }
  return undefined
}

async function measureTarget(chromePort, target) {
  const url = new URL(target.path ?? '/', baseUrl).toString()
  const runnerResult = await lighthouse(url, {
    port: chromePort,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility'],
  })

  const categories = runnerResult?.lhr?.categories
  return {
    name: target.name,
    path: target.path,
    performance: roundScore(categories?.performance?.score ?? null),
    accessibility: roundScore(categories?.accessibility?.score ?? null),
  }
}

async function run() {
  mkdirSync('project-health', { recursive: true })

  let server
  let chrome
  const results = []

  try {
    // `vite preview` をAPI経由で同一プロセス内に起動する。子プロセスをspawnしないため、
    // 停止漏れによるプロセスの取り残しが起きない。
    server = await preview({ preview: { host, port }, logLevel: 'silent' })

    const chromePath = await resolveChromePath()
    chrome = await launch({
      chromePath,
      chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    })

    for (const target of targets) {
      try {
        results.push(await measureTarget(chrome.port, target))
      } catch (error) {
        console.warn(
          `[project-health] Lighthouse measurement failed for "${target.name}" (${target.path}): ${
            error instanceof Error ? error.message : error
          }`,
        )
        results.push({ name: target.name, path: target.path, performance: null, accessibility: null })
      }
    }
  } catch (error) {
    console.warn(`[project-health] Lighthouse run could not start: ${error instanceof Error ? error.message : error}`)
    for (const target of targets) {
      results.push({ name: target.name, path: target.path, performance: null, accessibility: null })
    }
  } finally {
    if (chrome) {
      await chrome.kill()
    }
    if (server) {
      await server.close()
    }
  }

  writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), targets: results }, null, 2))
}

await run()
