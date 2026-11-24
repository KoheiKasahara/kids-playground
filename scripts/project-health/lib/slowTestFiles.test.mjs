import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { slowestTestCases, slowestTestFiles } from './slowTestFiles.mjs'

test('失敗したファイルも含めて経過時間順に集計する', () => {
  const report = { testResults: [
    { name: '/repo/a.test.ts', startTime: 10, endTime: 20, status: 'passed' },
    { name: '/repo/b.test.ts', startTime: 5, endTime: 40, status: 'failed' },
    { name: '/repo/c.test.ts', startTime: null, endTime: 100 },
    null,
  ] }
  expect(slowestTestFiles(report, '/repo', 1)).toEqual([
    { name: 'b.test.ts', milliseconds: 35, status: 'failed' },
  ])
})

test('欠損や壊れたレポートでは空の結果を返す', () => {
  for (const report of [null, {}, { testResults: {} }, { testResults: [null, {}] }]) {
    expect(slowestTestFiles(report)).toEqual([])
  }
})

test('個別ケースをファイル経過時間でなく duration で並べ、失敗も含める', () => {
  const report = { testResults: [
    { name: '/repo/long-file.test.ts', startTime: 0, endTime: 50_000, assertionResults: [
      { fullName: 'multi-case short', status: 'passed', duration: 1_000 },
      { fullName: 'skipped', status: 'pending', duration: 90_000 },
      { fullName: 'missing duration', status: 'passed', duration: null },
    ] },
    { name: '/repo/single-case.test.ts', startTime: 0, endTime: 32_000, assertionResults: [
      { fullName: 'suite ran past deadline', title: 'short label', status: 'failed', duration: 31_000 },
      { title: 'title fallback', status: 'passed', duration: 20_000 },
    ] },
  ] }
  expect(slowestTestCases(report, '/repo', 2)).toEqual([
    { name: 'single-case.test.ts', title: 'suite ran past deadline', status: 'failed', milliseconds: 31_000 },
    { name: 'single-case.test.ts', title: 'title fallback', status: 'passed', milliseconds: 20_000 },
  ])
})

test('個別ケースの時間が未計測・不正ならファイル時間で代用しない', () => {
  for (const report of [null, {}, { testResults: {} }, { testResults: [null, {},
    { name: '/repo/bad.test.ts', startTime: 0, endTime: 99_000, assertionResults: [
      null, { title: 'text timing', status: 'passed', duration: '3000' },
      { title: 'negative', status: 'failed', duration: -1 },
    ] },
  ] }]) {
    expect(slowestTestCases(report)).toEqual([])
  }
})

test('CI サマリーは Nightly にだけ15秒以上のケースを非ブロッキングで表示する', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-summary-'))
  try {
    const report = join(dir, 'report.json')
    writeFileSync(report, JSON.stringify({ testResults: [
      { name: join(process.cwd(), 'slowFile.test.ts'), startTime: 1, endTime: 60_001,
        assertionResults: [
          { title: 'exact threshold', status: 'passed', duration: 15_000 },
          { fullName: 'time <limit> | failed\ncase', status: 'failed', duration: 38_882 },
          { title: 'under threshold', status: 'passed', duration: 14_999 },
        ] },
    ] }))
    const runSummary = (mode, resultFile = report) => {
      const summary = join(dir, 'summary.md')
      writeFileSync(summary, '')
      execFileSync(process.execPath, ['scripts/ci-summary.mjs'], { env: {
        ...process.env, CI_TEST_MODE: mode, CI_TEST_RESULTS_FILE: resultFile, GITHUB_STEP_SUMMARY: summary,
      } })
      return readFileSync(summary, 'utf8')
    }

    const full = runSummary('FULL / NIGHTLY')
    expect(full).toContain('| slowFile.test.ts | time &lt;limit&gt; &#124; failed case | failed | 38.88 |')
    expect(full).toContain('| slowFile.test.ts | exact threshold | passed | 15.00 |')
    expect(full).not.toContain('under threshold')
    expect(runSummary('QUICK CI')).not.toContain('## Slow test cases')
    expect(runSummary('FULL / NIGHTLY', join(dir, 'missing.json')))
      .toContain('Not available (missing or invalid case timings).')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
