import { asNumber } from './number.mjs'

// CI の quick test 実行で生成される vitest JSON reporter の出力を解釈する。
// Dashboard のためにテストを再実行せず、既存の vitest-results.json を再利用する。
export function parseVitestSummary(report) {
  if (!report || typeof report !== 'object') {
    return { total: null, passed: null }
  }

  return {
    total: asNumber(report.numTotalTests, report.numTotalTestResults),
    passed: asNumber(report.numPassedTests, report.numPassedTestResults),
  }
}
