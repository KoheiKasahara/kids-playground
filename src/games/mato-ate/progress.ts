/** ステージごとの いちばん よい ほしの 数（1〜3）。保存できなくても あそべる。 */
const KEY = 'mato-ate-progress-v1'
export type MatoProgress = Record<string, number>

export function readProgress(): MatoProgress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([key, stars]) =>
      /^\d+$/.test(key) && typeof stars === 'number' && Number.isInteger(stars) && stars >= 1 && stars <= 3))
  } catch { return {} }
}

/** 前より よい ときだけ 上書きする。新しい きろくを かえす。 */
export function recordStars(index: number, stars: number): MatoProgress {
  const progress = readProgress()
  if ((progress[index] ?? 0) < stars) {
    progress[index] = stars
    try { localStorage.setItem(KEY, JSON.stringify(progress)) } catch { /* 保存できなくても つづけられる。 */ }
  }
  return progress
}
