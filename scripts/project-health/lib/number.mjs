// 複数候補の中から最初に有効な数値を返す小さなヘルパー。
// vitest / GitHub API 等、フィールド名がバージョンによって揺れる値の読み取りに使う。
export function asNumber(...values) {
  for (const value of values) {
    if (value === '' || value === null || value === undefined) {
      continue
    }
    const number = Number(value)
    if (Number.isFinite(number)) {
      return number
    }
  }
  return null
}
