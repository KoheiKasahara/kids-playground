// Nightly の all-games E2E smoke（Playwright JSON reporter）の結果を解釈する。
// Dashboard生成のためにE2E smokeを再実行せず、Nightlyの実行結果を再利用する。
export function parsePlaywrightSummary(report) {
  const stats = report?.stats
  if (!stats) {
    return null
  }

  const counts = [stats.expected, stats.unexpected, stats.skipped, stats.flaky]
  if (counts.some((value) => !Number.isInteger(value) || value < 0)) return null
  const [expected, unexpected, skipped, flaky] = counts
  const total = expected + unexpected + skipped + flaky

  if (total === 0) {
    return null
  }

  return { total, passed: expected + flaky, skipped, flaky }
}
