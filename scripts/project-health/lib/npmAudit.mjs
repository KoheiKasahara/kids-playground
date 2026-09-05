// `npm audit --json` の出力から脆弱性件数を取り出す。
// 0件の場合も実データとして {total: 0, ...} を返す（未取得時のみ null）。
export function parseNpmAudit(report) {
  const vulnerabilities = report?.metadata?.vulnerabilities
  if (!vulnerabilities || typeof vulnerabilities.total !== 'number') {
    return null
  }

  const { info = 0, low = 0, moderate = 0, high = 0, critical = 0, total } = vulnerabilities
  return { total, info, low, moderate, high, critical }
}
