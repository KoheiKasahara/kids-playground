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
