import { createStageProgressStore } from '../shared/progress/stageProgress'
import { STAGES } from './stages'

/** ステージごとの いちばん よい ★（とった ほしメダルの かず。ゴールすれば ★1）。 */
export const progressStore = createStageProgressStore('dot-run-progress-v1', id => STAGES.some(s => s.id === id))

const MUSIC_KEY = 'dot-run-music-v1'

export function readMusic(): boolean {
  try { return localStorage.getItem(MUSIC_KEY) !== 'off' } catch { return true }
}

export function writeMusic(on: boolean) {
  try { localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off') } catch { /* 保存できなくても つづけられる。 */ }
}
