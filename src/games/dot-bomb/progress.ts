import { createStageProgressStore, type StageProgress } from '../shared/progress/stageProgress'
import { STAGES } from './stages'

/** ステージごとの いちばん よい ★（クリア・ハートを へらさない・ほしの かけら）。 */
export const progressStore = createStageProgressStore('dot-bomb-progress-v1', id => STAGES.some(s => s.id === id))

const SEEN_KEY = 'dot-bomb-seen-v1'
const MUSIC_KEY = 'dot-bomb-music-v1'
const ALLY_KEY = 'dot-bomb-ally-v1'

/** もう みた おはなし。 */
export function readSeen(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')
    return new Set(Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

export function markSeen(id: string) {
  const seen = readSeen()
  seen.add(id)
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])) } catch { /* 保存できなくても つづけられる。 */ }
}

export function readMusic(): boolean {
  try { return localStorage.getItem(MUSIC_KEY) !== 'off' } catch { return true }
}

export function writeMusic(on: boolean) {
  try { localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off') } catch { /* 保存できなくても つづけられる。 */ }
}

/** なかまの ロボンを つれていくか（さいしょは つれていかない）。 */
export function readAlly(): boolean {
  try { return localStorage.getItem(ALLY_KEY) === 'on' } catch { return false }
}

export function writeAlly(on: boolean) {
  try { localStorage.setItem(ALLY_KEY, on ? 'on' : 'off') } catch { /* 保存できなくても つづけられる。 */ }
}

/** まだ クリアしていない さいしょの ステージ（ぜんぶ クリアなら -1）。 */
export function nextStageIndex(progress: StageProgress) {
  return STAGES.findIndex(s => !progress[s.id])
}

/** えらべる ステージか（ひとつ まえを クリアしていれば えらべる）。 */
export function isUnlocked(progress: StageProgress, index: number) {
  return index === 0 || !!progress[STAGES[index - 1]?.id]
}
