const DASH = '—'

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return DASH
  }

  const mb = bytes / (1024 * 1024)
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`
  }

  return `${(bytes / 1024).toFixed(1)} KB`
}

export function statusIcon(conclusion) {
  switch (conclusion) {
    case 'success':
      return '✅'
    case 'failure':
    case 'timed_out':
      return '❌'
    case 'skipped':
    case 'cancelled':
      return '⏭️'
    case null:
    case undefined:
      return '❓'
    default:
      return '⚠️'
  }
}

export function ratioIcon(passed, total) {
  if (passed === null || passed === undefined || total === null || total === undefined || total === 0) {
    return '❓'
  }
  return passed === total ? '✅' : '❌'
}

// Lighthouse等、実行環境で多少揺らぐ指標向けのアイコン。
// Issue #524: 揺らぎがある指標をいきなりFailure（❌）扱いにはせず、まずは
// Warning（⚠️）で観測を優先し、安定性が確認できてからゲート化する方針とする。
export function thresholdWarningIcon(value, threshold) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '❓'
  }
  if (threshold === null || threshold === undefined || !Number.isFinite(threshold)) {
    return ''
  }
  return value >= threshold ? '✅' : '⚠️'
}

// Issue #525: 前回値との差分を「▲ 32 KB」「▼ 1」「→」のように表示する。
// trend が無い（前回の有効な履歴が無い等）場合は — にする。
export function formatTrendCell(trend, { unit = '', formatMagnitude } = {}) {
  if (!trend) {
    return DASH
  }
  if (trend.trend === 'flat') {
    return '→'
  }

  const arrow = trend.trend === 'up' ? '▲' : '▼'
  const magnitude = formatMagnitude ? formatMagnitude(Math.abs(trend.delta)) : String(Math.abs(trend.delta))
  return unit ? `${arrow} ${magnitude} ${unit}` : `${arrow} ${magnitude}`
}
