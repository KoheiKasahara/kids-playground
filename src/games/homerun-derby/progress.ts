import { createStageProgressStore, type StageProgress } from '../shared/progress/stageProgress'
import { STAGES } from './stages'

/** あいてごとの いちばん よい ★。保存できなくても あそべる。 */
export const progressStore = createStageProgressStore('homerun-derby-progress-v1', id => STAGES.some(stage => stage.id === id))

/** えらべる あいてか（ひとつ まえの あいてに かっていれば えらべる）。 */
export function isUnlocked(progress: StageProgress, index: number): boolean {
  return index === 0 || Boolean(progress[STAGES[index - 1]?.id ?? ''])
}
