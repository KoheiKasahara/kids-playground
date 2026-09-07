import { relative } from 'node:path'

/** Vitestのファイル開始/終了時刻。並列実行なので合計をCI所要時間と呼ばない。 */
export function slowestTestFiles(report, root = process.cwd(), limit = 10) {
  if (!Array.isArray(report?.testResults)) return []
  return report.testResults.flatMap((result) => {
    if (typeof result?.name !== 'string'
      || !Number.isFinite(result.startTime) || !Number.isFinite(result.endTime)
      || result.endTime < result.startTime) return []
    return [{ name: relative(root, result.name).replaceAll('\\', '/'),
      milliseconds: result.endTime - result.startTime, status: result.status ?? 'unknown' }]
  }).sort((a, b) => b.milliseconds - a.milliseconds).slice(0, limit)
}
