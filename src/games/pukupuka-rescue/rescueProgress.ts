/** クリアした面ごとの最高獲得数。保存不可でもゲームは遊べる。 */
const KEY = 'pukupuka-rescue-stars-v1'
export type RescueProgress = Record<string, number>
export function readRescueProgress(): RescueProgress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([, count]) =>
      typeof count === 'number' && Number.isInteger(count) && count >= 0 && count <= 3))
  } catch { return {} }
}
export function saveRescueProgress(progress: RescueProgress): void {
  try { localStorage.setItem(KEY, JSON.stringify(progress)) } catch { /* 保存不可でも続ける。 */ }
}
