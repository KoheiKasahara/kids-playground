import { shuffle } from '../quiz-core/questionGenerator'
import { prefectureById, prefectures } from '../prefecture-quiz/data/prefectures'
import type { JapanTravelCourse, JapanTravelQuestion } from './types'
import { JAPAN_TRAVEL_CHOICE_COUNT, JAPAN_TRAVEL_QUESTION_COUNT } from './types'

export function answerPositionBag(random: () => number = Math.random): number[] {
  return shuffle([0, 1, 2, 3, 0, 1, 2, 3, 0, 1], random)
}

export function generateJapanTravelQuestions(
  course: JapanTravelCourse,
  random: () => number = Math.random,
): JapanTravelQuestion[] {
  const answers = course.prefectureIds.map((id) => prefectureById.get(id)).filter((item): item is (typeof prefectures)[number] => Boolean(item))
  if (answers.length !== JAPAN_TRAVEL_QUESTION_COUNT) throw new Error('Japan travel course must contain ten known prefectures.')
  const positions = answerPositionBag(random)
  return answers.map((answer, index) => {
    // 同じ地方の県を優先し、足りない分だけ全国から混ぜる。近い形・位置を考えるきっかけを作る。
    const nearby = prefectures.filter((prefecture) => prefecture.id !== answer.id && prefecture.region === answer.region)
    const others = prefectures.filter((prefecture) => prefecture.id !== answer.id && prefecture.region !== answer.region)
    const distractors = [...shuffle(nearby, random), ...shuffle(others, random)].slice(0, JAPAN_TRAVEL_CHOICE_COUNT - 1)
    const choices = [...distractors]
    choices.splice(positions[index], 0, answer)
    return { answer, choices, answerIndex: positions[index] }
  })
}
