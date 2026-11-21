export const GOAL_COUNT = 30
export const METERS_PER_STAR = 10

export function flightSeconds(count: number) {
  return 2 + Math.min(4, Math.sqrt(count) * 0.4)
}

export type Progress = { points: number; level: number }
const key = 'star-parade-progress-v1'
export const upgradeCost = (level: number) => 5 + level * 3

export function loadProgress(): Progress {
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (Number.isSafeInteger(data?.points) && data.points >= 0 &&
        Number.isSafeInteger(data.level) && data.level >= 0 && data.level <= GOAL_COUNT) return data
  } catch { /* Storage may be unavailable. */ }
  return { points: 0, level: 0 }
}

export function saveProgress(progress: Progress) {
  try { localStorage.setItem(key, JSON.stringify(progress)) } catch { /* Keep playing in memory. */ }
}
