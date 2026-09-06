// Project Health の履歴（Issue #525）を扱う純粋関数。
// ファイルI/Oは呼び出し側（write-history.mjs / generate-summary.mjs）が担当し、
// ここでは文字列/配列の変換ロジックだけを扱う。

const DEFAULT_MAX_ENTRIES = 180

// Nightly の cron（03:00 JST）を「その日」として扱うため、日付はJSTで計算する。
export function toJstDateString(date = new Date()) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

// 履歴ファイルが存在しない/壊れている場合も空履歴として扱い、初回実行を成功させる。
export function parseHistoryFile(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { entries: [] }
  }

  try {
    const parsed = JSON.parse(raw)
    return { entries: Array.isArray(parsed?.entries) ? parsed.entries : [] }
  } catch {
    return { entries: [] }
  }
}

// 同日に複数回実行された場合は、同じ date のレコードを新しい内容で上書きする
// （日付単位で1レコードに更新する方式。Issue #525「同日複数実行」）。
// 履歴が増え続けても処理が重くならないよう、maxEntries を超えた古い分は捨てる。
export function upsertHistoryEntry(entries, entry, { maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
  const withoutSameDate = (Array.isArray(entries) ? entries : []).filter(
    (existing) => existing?.date !== entry.date,
  )
  const merged = [...withoutSameDate, entry].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  if (Number.isFinite(maxEntries) && merged.length > maxEntries) {
    return merged.slice(merged.length - maxEntries)
  }

  return merged
}

// 「直前の有効な履歴」を指標ごとに探す。ある日の計測が欠損していても、
// その指標だけさらに過去へ遡って直近の値を探すことで、他の日の履歴全体を
// 無駄にしない（Issue #525「欠損値への耐性」）。
// currentDate を省略した場合は日付で絞り込まず、履歴内で最新の有効な値を返す
// （通常CIのSummary表示で「直近の履歴」と比較する用途）。
export function findPreviousMetricValue(entries, currentDate, key) {
  const candidates = (Array.isArray(entries) ? entries : [])
    .filter(
      (entry) =>
        entry?.date &&
        (currentDate === null || currentDate === undefined || entry.date < currentDate) &&
        entry[key] !== null &&
        entry[key] !== undefined,
    )
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  return candidates.length > 0 ? candidates[0][key] : null
}
