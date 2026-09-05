// Nightly の all-games E2E smoke（Playwright JSON reporter）の結果を解釈する。
// Dashboard生成のためにE2E smokeを再実行せず、Nightlyの実行結果を再利用する。
export function parsePlaywrightSummary(report) {
  const stats = report?.stats
  if (!stats) {
    return null
  }

  const expected = Number(stats.expected) || 0
  const unexpected = Number(stats.unexpected) || 0
  const skipped = Number(stats.skipped) || 0
  const flaky = Number(stats.flaky) || 0
  const total = expected + unexpected + skipped + flaky

  if (total === 0) {
    return null
  }

  return { total, passed: expected + flaky }
}
