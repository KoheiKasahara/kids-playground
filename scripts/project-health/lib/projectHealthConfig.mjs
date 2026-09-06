// `.project-health.json` の内容を解釈する純粋関数。
// 閾値や計測対象ページを一箇所（.project-health.json）に集約し、コード各所へ
// 散在させないための設定読み込み口。ファイル自体が存在しない/壊れている場合も
// デフォルト値へフォールバックし、Dashboard生成を止めない。
const DEFAULT_THRESHOLDS = {
  lighthousePerformance: 90,
  accessibility: 90,
}

const DEFAULT_LIGHTHOUSE_TARGETS = [{ name: 'Top', path: '/' }]

// Issue #525: 履歴の保持件数（Nightly 単位で1件、既定180件 ≒ 半年分）。
// 増え続けても読み込み・差分計算が重くならないよう上限を設ける。
const DEFAULT_HISTORY_MAX_ENTRIES = 180

export function parseProjectHealthConfig(raw) {
  let parsed = {}
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = {}
    }
  }

  const thresholds = { ...DEFAULT_THRESHOLDS, ...(parsed.thresholds ?? {}) }

  const targets =
    Array.isArray(parsed.lighthouse?.targets) && parsed.lighthouse.targets.length > 0
      ? parsed.lighthouse.targets
      : DEFAULT_LIGHTHOUSE_TARGETS

  const maxEntries =
    Number.isFinite(parsed.history?.maxEntries) && parsed.history.maxEntries > 0
      ? parsed.history.maxEntries
      : DEFAULT_HISTORY_MAX_ENTRIES

  return { thresholds, lighthouse: { targets }, history: { maxEntries } }
}
