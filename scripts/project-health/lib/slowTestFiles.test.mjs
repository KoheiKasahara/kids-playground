import { expect, test } from 'vitest'
import { slowestTestFiles } from './slowTestFiles.mjs'

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
