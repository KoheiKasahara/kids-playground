import { createStageProgressStore, type StageProgress } from '../shared/progress/stageProgress'
import { findAnimal, type AnimalId } from './animals'
import { COURSES } from './courses'

/** コースごとの いちばん よい ★。保存できなくても あそべる。 */
export const progressStore = createStageProgressStore('gochiso-race-progress-v1', id => COURSES.some(course => course.id === id))

/** えらべる コースか（ひとつ まえの コースで かっていれば えらべる）。 */
export function isUnlocked(progress: StageProgress, index: number): boolean {
  return index === 0 || Boolean(progress[COURSES[index - 1]?.id ?? ''])
}

const ANIMAL_KEY = 'gochiso-race-animal-v1'

/** まえに えらんだ どうぶつ（なければ null）。 */
export function readAnimal(): AnimalId | null {
  try {
    const id = localStorage.getItem(ANIMAL_KEY)
    return id && findAnimal(id) ? (id as AnimalId) : null
  } catch {
    return null
  }
}

export function writeAnimal(id: AnimalId): void {
  try {
    localStorage.setItem(ANIMAL_KEY, id)
  } catch {
    // 保存できなくても つづけて あそべる。
  }
}
