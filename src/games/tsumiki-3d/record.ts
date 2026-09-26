const KEY = 'tsumiki-3d:best-height'

/** いちばん たかく つめた きろく。よめない かんきょう では 0。 */
export function readBestHeight(): number {
  try {
    const value = Number(localStorage.getItem(KEY))
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

export function saveBestHeight(height: number): void {
  try {
    if (height > readBestHeight()) localStorage.setItem(KEY, String(Math.round(height * 100) / 100))
  } catch {
    // ほぞん できなくても あそべる。
  }
}
