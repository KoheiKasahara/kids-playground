import { createStageProgressStore, type StageProgress } from '../shared/progress/stageProgress'

/** ステージごとの いちばん よい ほしの 数（1〜3）。保存できなくても あそべる。 */
export type MatoProgress = StageProgress

// ステージ番号（0はじまりの数字）だけを受け付ける。保存キーは従来のまま引き継ぐ。
const store = createStageProgressStore('mato-ate-progress-v1', (id) => /^\d+$/.test(id))

export function readProgress(): MatoProgress {
  return store.read()
}

/** 前より よい ときだけ 上書きする。新しい きろくを かえす。 */
export function recordStars(index: number, stars: number): MatoProgress {
  return store.record(index, stars)
}
