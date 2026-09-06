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
