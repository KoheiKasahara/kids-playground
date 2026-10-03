import { createStageProgressStore } from '../shared/progress/stageProgress'
import { STAGES } from './stages'

/** ステージごとの いちばん よい ★（あつめた ほしバッジの かず。クリアすれば ★1）。 */
export const progressStore = createStageProgressStore('jishaku-pitatto-progress-v1', (id) => STAGES.some((s) => s.id === id))

/** チャレンジの メダル（とれた ステージは 1）。 */
export const medalStore = createStageProgressStore('jishaku-pitatto-medal-v1', (id) => STAGES.some((s) => s.id === id))

const MUSIC_KEY = 'jishaku-pitatto-music-v1'

export function readMusic(): boolean {
  try {
    return localStorage.getItem(MUSIC_KEY) !== 'off'
  } catch {
    return true
  }
}

export function writeMusic(on: boolean) {
  try {
    localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off')
  } catch {
    // 保存できなくても つづけられる。
  }
}
