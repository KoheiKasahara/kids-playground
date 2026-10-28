/** 容量の基準は.project-health.jsonでレビューする。欠損を無制限扱いにしない。 */
export function parseLoadingBudgets(raw) {
  const budgets = JSON.parse(raw).loadingBudgets
  for (const key of ['initialJsGzipKb', 'initialCssGzipKb', 'precacheWarnKb', 'precacheBaselineKb', 'precacheGrowthWarnKb']) {
    if (!Number.isFinite(budgets?.[key]) || budgets[key] <= 0) throw new Error(`Invalid loading budget: ${key}`)
  }
  return budgets
}

export function evaluateLoadingBudgets(metrics, budgets) {
  const errors = [], warnings = []
  const check = (bytes, limitKb, label, target) => {
    if (!Number.isFinite(bytes) || bytes < 0) throw new Error(`Missing loading measurement: ${label}`)
    if (bytes > limitKb * 1024) target.push(`${label}: ${(bytes / 1024).toFixed(1)} KiB > ${limitKb} KiB`)
  }
  check(metrics.initial.js.gzip, budgets.initialJsGzipKb, '初期JS gzip', errors)
  check(metrics.initial.css.gzip, budgets.initialCssGzipKb, '初期CSS gzip', errors)
  check(metrics.precache.bytes, budgets.precacheWarnKb, 'PWA保存容量', warnings)
  const growth = metrics.precache.bytes / 1024 - budgets.precacheBaselineKb
  if (growth > budgets.precacheGrowthWarnKb) {
    warnings.push(`PWA保存容量の基準からの増加: +${growth.toFixed(1)} KiB > ${budgets.precacheGrowthWarnKb} KiB`)
  }
  return { errors, warnings }
}

export function renderLoadingBudgetMarkdown(metrics, budgets) {
  const { errors, warnings } = evaluateLoadingBudgets(metrics, budgets)
  return '\n### 読込容量の予算\n\n'
    + `初期JS / CSSの上限（gzip換算）: ${budgets.initialJsGzipKb} / ${budgets.initialCssGzipKb} KiB。\n\n`
    + `PWAは ${budgets.precacheWarnKb} KiB超、または基準 ${budgets.precacheBaselineKb} KiBから ${budgets.precacheGrowthWarnKb} KiB超の増加で警告。\n\n`
    + [...errors.map(message => `- ❌ ${message}`), ...warnings.map(message => `- ⚠️ ${message}`),
      ...(errors.length + warnings.length === 0 ? ['予算内です。'] : [])].join('\n') + '\n'
}
