import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { expect, test } from 'vitest'

test('直近の公開失敗と最後の公開成功を別々に取得する', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'health-context-'))
  const deployQueries = []
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost')
    let body
    if (url.pathname.endsWith('/nightly.yml/runs')) body = { workflow_runs: [] }
    else if (url.pathname.endsWith('/ci.yml/runs')) {
      deployQueries.push(url.searchParams)
      const success = url.searchParams.get('status') === 'success'
      body = { workflow_runs: [{ id: success ? 1 : 2, head_sha: (success ? 'a' : 'b').repeat(40) }] }
    } else body = { jobs: [{ name: 'deploy', conclusion: url.pathname.includes('/1/') ? 'success' : 'failure', completed_at: '2026-09-05T00:00:00Z' }] }
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify(body))
  })
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const status = await new Promise((resolveStatus, reject) => {
      const child = spawn(process.execPath, [resolve('scripts/project-health/fetch-github-context.mjs')], {
        env: { ...process.env, GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
          GITHUB_REPOSITORY: 'test/repo', GITHUB_TOKEN: '', GITHUB_OUTPUT: '', PROJECT_HEALTH_DIR: dir },
        stdio: 'ignore',
      })
      child.on('error', reject)
      child.on('exit', resolveStatus)
    })
    expect(status).toBe(0)
    expect(deployQueries).toHaveLength(2)
    for (const query of deployQueries) {
      expect(query.get('branch')).toBe('main')
      expect(query.has('event')).toBe(false) // workflow_dispatchによる公開も含める。
    }
    const context = JSON.parse(readFileSync(join(dir, 'github-context.json'), 'utf8'))
    expect(context.deploy).toMatchObject({ conclusion: 'failure', runId: '2', headSha: 'b'.repeat(40) })
    expect(context.publishedDeploy).toMatchObject({ conclusion: 'success', runId: '1', headSha: 'a'.repeat(40), completedAt: '2026-09-05T00:00:00Z' })
  } finally {
    await new Promise(resolve => server.close(resolve))
    rmSync(dir, { recursive: true, force: true })
  }
})
