import type { Prefecture, PrefectureId } from '../prefecture-quiz/data/prefectures'

export const JAPAN_TRAVEL_QUESTION_COUNT = 10
export const JAPAN_TRAVEL_CHOICE_COUNT = 4

export type JapanTravelCourse = {
  id: string
  name: string
  prefectureIds: readonly PrefectureId[]
}

export type JapanTravelQuestion = {
  answer: Prefecture
  choices: readonly Prefecture[]
  answerIndex: number
}

export type JapanTravelPhase = 'answering' | 'feedback' | 'traveling'
