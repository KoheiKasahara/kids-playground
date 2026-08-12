import { describe, expect, test } from 'vitest'
import { prefectureById, prefectures } from '../prefecture-quiz/data/prefectures'
import { japanTravelCourses } from './data/travelCourses'
import { answerPositionBag, generateJapanTravelQuestions } from './questionGenerator'

function seededRandom(seed: number): () => number { let value = seed; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 0x100000000 } }

describe('japan travel courses', () => {
  test('各コースは10県で重複せず、すべて実在する', () => {
    expect(japanTravelCourses).toHaveLength(20)
    for (const course of japanTravelCourses) {
      expect(course.prefectureIds).toHaveLength(10)
      expect(new Set(course.prefectureIds).size).toBe(10)
      for (const id of course.prefectureIds) expect(prefectureById.has(id)).toBe(true)
    }
  })

  test('コース全体で47都道府県をすべて少なくとも一度は通る', () => {
    const covered = new Set(japanTravelCourses.flatMap((course) => course.prefectureIds))
    expect(covered).toEqual(new Set(prefectures.map((prefecture) => prefecture.id)))
  })
})

describe('generateJapanTravelQuestions', () => {
  test('順番を保った10問、4択、正解1つ、選択肢重複なしを作る', () => {
    const course = japanTravelCourses[0]; const questions = generateJapanTravelQuestions(course, seededRandom(42))
    expect(questions).toHaveLength(10)
    expect(questions.map((question) => question.answer.id)).toEqual(course.prefectureIds)
    for (const question of questions) {
      expect(question.choices).toHaveLength(4)
      expect(new Set(question.choices.map((choice) => choice.id)).size).toBe(4)
      expect(question.choices.filter((choice) => choice.id === question.answer.id)).toHaveLength(1)
      expect(question.choices[question.answerIndex]).toBe(question.answer)
    }
  })

  test('正解位置バッグは各位置を大きく偏らせない', () => {
    const positions = answerPositionBag(seededRandom(8))
    expect(positions).toHaveLength(10)
    expect(positions.filter((value) => value === 0)).toHaveLength(3)
    expect(positions.filter((value) => value === 1)).toHaveLength(3)
    expect(positions.filter((value) => value === 2)).toHaveLength(2)
    expect(positions.filter((value) => value === 3)).toHaveLength(2)
  })
})
