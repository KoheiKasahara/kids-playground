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

/** Vitest JSON reporterの個別ケース実行時間。ファイル経過時間・timeout設定とは別。 */
export function slowestTestCases(report, root = process.cwd(), limit = 10) {
  if (!Array.isArray(report?.testResults)) return []
  return report.testResults.flatMap((file) => {
    if (typeof file?.name !== 'string' || !Array.isArray(file.assertionResults)) return []
    const name = relative(root, file.name).replaceAll('\\', '/')
    return file.assertionResults.flatMap((result) => {
      if (!['passed', 'failed'].includes(result?.status)
        || !Number.isFinite(result.duration) || result.duration < 0) return []
      const title = result.fullName || result.title
      if (typeof title !== 'string' || !title) return []
      return [{ name, title, milliseconds: result.duration, status: result.status }]
    })
  }).sort((a, b) => b.milliseconds - a.milliseconds).slice(0, limit)
}
