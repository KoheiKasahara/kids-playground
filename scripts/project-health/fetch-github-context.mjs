import { mkdirSync, writeFileSync } from 'node:fs'

import { findJob, parseLatestRun } from './lib/githubActions.mjs'

// Nightly / Deploy の直近状態を GitHub Actions API から取得する。
// Dashboard向けの取得失敗であって、既存CI自体の品質チェックとは無関係なので、
// ここでの失敗はジョブ全体を失敗させない（常に exit 0、結果は null で表現する）。
const apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
const repository = process.env.GITHUB_REPOSITORY
const token = process.env.GITHUB_TOKEN
const outputPath = process.env.GITHUB_OUTPUT
const outDir = process.env.PROJECT_HEALTH_DIR ?? 'project-health'

mkdirSync(outDir, { recursive: true })

const headers = {
  Accept: 'application/vnd.github+json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
}

async function getJson(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) })
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} ${response.statusText} (${url})`)
  }
  return response.json()
}

async function fetchNightlyStatus() {
  const payload = await getJson(
    `${apiUrl}/repos/${repository}/actions/workflows/nightly.yml/runs?status=completed&per_page=1`,
  )
  return parseLatestRun(payload)
}

async function fetchDeployStatus() {
  const payload = await getJson(
    `${apiUrl}/repos/${repository}/actions/workflows/ci.yml/runs?branch=main&event=push&status=completed&per_page=1`,
  )
  const run = parseLatestRun(payload)
  if (!run?.id) {
    return null
  }

  const jobsPayload = await getJson(`${apiUrl}/repos/${repository}/actions/runs/${run.id}/jobs`)
  return findJob(jobsPayload, 'deploy')
}

const context = { nightly: null, deploy: null }

if (!repository) {
  console.warn('[project-health] GITHUB_REPOSITORY is not set; skipping GitHub API lookups')
} else {
  const [nightlyResult, deployResult] = await Promise.allSettled([fetchNightlyStatus(), fetchDeployStatus()])

  if (nightlyResult.status === 'fulfilled') {
    context.nightly = nightlyResult.value
  } else {
    console.warn(`[project-health] failed to fetch Nightly status: ${nightlyResult.reason}`)
  }

  if (deployResult.status === 'fulfilled') {
    context.deploy = deployResult.value
  } else {
    console.warn(`[project-health] failed to fetch Deploy status: ${deployResult.reason}`)
  }
}

writeFileSync(`${outDir}/github-context.json`, JSON.stringify(context, null, 2))

if (outputPath && context.nightly?.id) {
  writeFileSync(outputPath, `nightly_run_id=${context.nightly.id}\n`, { flag: 'a' })
}
