import type { QuizQuestion } from '../quiz-core/types'
import type { Prefecture } from './data/prefectures'

export const PREFECTURE_QUESTION_COUNT = 10
export const PREFECTURE_CHOICE_COUNT = 4

export type PrefectureQuizMode = 'shapeToName' | 'nameToShape' | 'nameToMap'

export const MODE_PATH: Record<PrefectureQuizMode, string> = {
  shapeToName: 'shape-to-name',
  nameToShape: 'name-to-shape',
  nameToMap: 'name-to-map',
}

export const MODE_LABEL: Record<PrefectureQuizMode, string> = {
  shapeToName: 'かたちを みて こたえる',
  nameToShape: 'なまえを みて かたちを えらぶ',
  nameToMap: 'にほんちず から さがす',
}

export type PrefectureQuestion = QuizQuestion<Prefecture>
