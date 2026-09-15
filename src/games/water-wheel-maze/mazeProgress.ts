/** クリアした ステージの 記録。1=クリア、2=みずを のこさず とどけた。保存できなくても あそべる。 */
const KEY = 'water-wheel-maze-progress-v1'
export type MazeProgress = Record<string, number>

export function readMazeProgress(): MazeProgress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([, level]) =>
      typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 2))
  } catch { return {} }
}

export function saveMazeProgress(progress: MazeProgress): void {
  try { localStorage.setItem(KEY, JSON.stringify(progress)) } catch { /* 保存できなくても つづけられる。 */ }
}
