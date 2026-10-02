/** ステージごとの きろく（クリアしたか・なかまの かず）。保存できなくても あそべる。 */
const KEY = 'dot-adventure-progress-v1'
const MUSIC_KEY = 'dot-adventure-music-v1'

export type StageRecord = { cleared: boolean; friends: number }
export type Progress = Record<string, StageRecord>

export function readProgress(): Progress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const out: Progress = {}
    for (const [id, rec] of Object.entries(value)) {
      if (!/^[a-z]+$/.test(id) || !rec || typeof rec !== 'object') continue
      const { cleared, friends } = rec as Record<string, unknown>
      if (cleared !== true) continue
      out[id] = { cleared: true, friends: typeof friends === 'number' && Number.isInteger(friends) && friends >= 0 && friends <= 9 ? friends : 0 }
    }
    return out
  } catch { return {} }
}

/** クリアを きろく。なかまの かずは よい ほうを のこす。 */
export function recordClear(id: string, friends: number): Progress {
  const progress = readProgress()
  progress[id] = { cleared: true, friends: Math.max(friends, progress[id]?.friends ?? 0) }
  try { localStorage.setItem(KEY, JSON.stringify(progress)) } catch { /* 保存できなくても つづけられる。 */ }
  return progress
}

export function readMusic(): boolean {
  try { return localStorage.getItem(MUSIC_KEY) !== 'off' } catch { return true }
}

export function writeMusic(on: boolean) {
  try { localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off') } catch { /* つづけられる。 */ }
}
