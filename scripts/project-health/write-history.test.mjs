import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { afterEach, expect, test } from 'vitest'

let dir
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = undefined })

test('既存の計測成果物から追加指標を保存し、過去のレコードも維持する', () => {
  dir = mkdtempSync(join(tmpdir(), 'health-history-'))
  const writeJson = (name, value) => writeFileSync(join(dir, name), JSON.stringify(value))
  mkdirSync(join(dir, 'dist/.vite'), { recursive: true })
  writeFileSync(join(dir, 'dist/main.js'), 'x'.repeat(2000))
  writeFileSync(join(dir, 'dist/main.css'), 'y'.repeat(1000))
  writeFileSync(join(dir, 'dist/model.glb'), 'z'.repeat(3000))
  writeJson('dist/.vite/manifest.json', { 'index.html': { src: 'index.html', isEntry: true, file: 'main.js', css: ['main.css'] } })
  writeJson('dist/.vite/precache.json', ['main.js', 'main.css', 'model.glb'].map((url) => ({ url })))
  writeFileSync(join(dir, 'catalog.ts'), "export const GAME_CATALOG = [{ slug: 'one' }, { slug: 'two' }]")
  writeJson('vitest.json', { numTotalTests: 100, numPassedTests: 99 })
  writeJson('e2e.json', { stats: { expected: 9, unexpected: 0, skipped: 0, flaky: 1 } })
  writeJson('audit.json', { metadata: { vulnerabilities: { total: 2, moderate: 1, high: 1 } } })
  writeJson('lighthouse.json', { targets: [{ name: 'ホーム画面', performance: 91, accessibility: 100 }] })
  writeJson('context.json', { deploy: { conclusion: 'failure' }, publishedDeploy: {
    conclusion: 'success', headSha: 'b'.repeat(40), runId: '123', completedAt: '2026-09-01T18:00:00Z',
  } })
  writeJson('history.json', { entries: [{ date: '2026-09-01', games: 1, vulnerabilities: 3 }] })
  const env = {
    ...process.env,
    GITHUB_SHA: 'a'.repeat(40),
    PROJECT_HEALTH_GAME_CATALOG: join(dir, 'catalog.ts'),
    PROJECT_HEALTH_DIST_DIR: join(dir, 'dist'),
    PROJECT_HEALTH_VITEST_RESULTS: join(dir, 'vitest.json'),
    PROJECT_HEALTH_NIGHTLY_E2E_REPORT: join(dir, 'e2e.json'),
    PROJECT_HEALTH_AUDIT_FILE: join(dir, 'audit.json'),
    PROJECT_HEALTH_LIGHTHOUSE_SUMMARY: join(dir, 'lighthouse.json'),
    PROJECT_HEALTH_GITHUB_CONTEXT: join(dir, 'context.json'),
    PROJECT_HEALTH_HISTORY_FILE: join(dir, 'history.json'),
    PROJECT_HEALTH_HISTORY_DATE: '2026-09-02',
    PROJECT_HEALTH_NIGHTLY_LINT_OUTCOME: 'success',
    PROJECT_HEALTH_NIGHTLY_TEST_OUTCOME: 'failure',
    PROJECT_HEALTH_NIGHTLY_BUILD_OUTCOME: 'success',
    PROJECT_HEALTH_NIGHTLY_E2E_OUTCOME: 'success',
  }
  const script = resolve('scripts/project-health/write-history.mjs')
  const result = spawnSync(process.execPath, [script], { env, encoding: 'utf8' })
  expect(result.status, result.stderr).toBe(0)
  const history = JSON.parse(readFileSync(join(dir, 'history.json'), 'utf8'))
  expect(history.entries[0]).toEqual({ date: '2026-09-01', games: 1, vulnerabilities: 3 })
  expect(history.entries[1]).toMatchObject({
    date: '2026-09-02', games: 2, unitTests: 100, unitTestsPassed: 99,
    e2eSmokeTotal: 10, e2eSmokePassed: 10, e2eSmokeFlaky: 1, e2eSmokeSkipped: 0,
    vulnerabilities: 2, vulnerabilitiesCritical: 0, vulnerabilitiesHigh: 1, vulnerabilitiesModerate: 1,
    precacheKb: 6000 / 1024, precacheEntries: 3, nightly: 'failure', deploy: 'failure', lighthouseTarget: 'ホーム画面',
    sourceSha: 'a'.repeat(40), publishedSha: 'b'.repeat(40), publishedRunId: '123', publishedAt: '2026-09-01T18:00:00Z',
  })
  expect(history.entries[1].initialJsGzipKb).toBeTypeOf('number')
  expect(history.entries[1].initialCssGzipKb).toBeTypeOf('number')

  // 誤った成功情報を受け取っても、失敗した版を公開済みとして記録しない。
  writeJson('context.json', { publishedDeploy: { conclusion: 'failure', headSha: 'c'.repeat(40), runId: '456' } })
  expect(spawnSync(process.execPath, [script], { env, encoding: 'utf8' }).status).toBe(0)
  const failedDeploy = JSON.parse(readFileSync(join(dir, 'history.json'), 'utf8')).entries[1]
  expect(failedDeploy).toMatchObject({ publishedSha: null, publishedRunId: null, publishedAt: null })

  // 出力先がディレクトリの場合は、更新成功と偽らずジョブに失敗を返す。
  const failed = spawnSync(process.execPath, [script], {
    env: { ...env, PROJECT_HEALTH_HISTORY_FILE: dir }, encoding: 'utf8',
  })
  expect(failed.status).not.toBe(0)
})
