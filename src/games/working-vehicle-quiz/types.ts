import type { QuizLevel, QuizQuestion } from '../quiz-core/types'

export type { QuizLevel } from '../quiz-core/types'
export {
  CHOICE_COUNT,
  isQuizLevel,
  LEVEL_LABEL,
  LEVEL_RANK,
  LEVEL_STARS,
  QUESTION_COUNT,
} from '../quiz-core/types'

export type Vehicle = {
  /** URL・問題判定・ファイル名に共通して使う安定したID。 */
  id: string
  /** 子ども向けの日本語名。 */
  nameJa: string
  /** 素材照合や文書で使う英語名。 */
  nameEn: string
  /** BASE_URLからの相対パス。先頭にスラッシュを付けない。 */
  photo: string
  /** この車両が最初に出題対象になるむずかしさ。 */
  level: QuizLevel
}

export type VehicleQuestion = QuizQuestion<Vehicle>

/** photoToName: 写真を見て名前を選ぶ / nameToPhoto: 名前を見て写真を選ぶ。 */
export type VehicleQuizMode = 'photoToName' | 'nameToPhoto'

export const MODE_PATH: Record<VehicleQuizMode, string> = {
  photoToName: 'photo-to-name',
  nameToPhoto: 'name-to-photo',
}

export const MODE_LABEL: Record<VehicleQuizMode, string> = {
  photoToName: 'しゃしん → なまえ',
  nameToPhoto: 'なまえ → しゃしん',
}

export const LEVEL_DESCRIPTION: Record<QuizLevel, string> = {
  easy: 'よく みる 12しゅるい',
  normal: '18しゅるい',
  hard: 'ぜんぶで 24しゅるい',
}
