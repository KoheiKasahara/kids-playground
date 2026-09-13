/** クリアしたステージの記録。1=クリア、2=たからを ぜんぶ あつめた。保存できなくても遊べる。 */
const KEY = 'treasure-dig-progress-v1'
export type DigProgress = Record<string, number>

export function readDigProgress(): DigProgress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([, level]) =>
      typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 2))
  } catch { return {} }
}

export function saveDigProgress(progress: DigProgress): void {
  try { localStorage.setItem(KEY, JSON.stringify(progress)) } catch { /* 保存できなくても続ける。 */ }
}
