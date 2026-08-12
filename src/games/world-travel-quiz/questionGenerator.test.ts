import { describe, expect, test } from 'vitest'
import { countries } from '../flag-quiz/data/countries'
import { countryById } from './data/travelCountries'
import { travelCourses } from './data/travelCourses'
import { answerPositionBag, generateTravelQuestions } from './questionGenerator'

function seededRandom(seed: number): () => number { let value = seed; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 0x100000000 } }

describe('world travel courses', () => {
  test('各地域に3本あり、10か国が地域内で重複しない', () => {
    expect(new Set(travelCourses.map((course) => course.region))).toEqual(new Set(['asia', 'europe', 'africa', 'northAmerica', 'southAmerica', 'oceania']))
    for (const course of travelCourses) {
      expect(course.countryIds).toHaveLength(10)
      expect(new Set(course.countryIds).size).toBe(10)
      expect(travelCourses.filter((other) => other.region === course.region)).toHaveLength(3)
      for (const id of course.countryIds) expect(countryById.get(id)?.continent).toBe(course.region)
    }
  })
})

describe('generateTravelQuestions', () => {
  test('順番を保った10問、4択、正解1つ、選択肢重複なしを作る', () => {
    const course = travelCourses[0]; const questions = generateTravelQuestions(course, seededRandom(42))
    expect(questions).toHaveLength(10)
    expect(questions.map((question) => question.answer.id)).toEqual(course.countryIds)
    for (const question of questions) {
      expect(question.choices).toHaveLength(4)
      expect(new Set(question.choices.map((choice) => choice.id)).size).toBe(4)
      expect(question.choices.filter((choice) => choice.id === question.answer.id)).toHaveLength(1)
      expect(question.choices[question.answerIndex]).toBe(question.answer)
    }
  })

  test('国旗モード用に全国家プールから誤答を作っても4択条件を守る', () => {
    const course = travelCourses[0]
    const questions = generateTravelQuestions(course, seededRandom(17), countries)
    for (const question of questions) {
      expect(question.choices).toHaveLength(4)
      expect(new Set(question.choices.map((choice) => choice.id)).size).toBe(4)
      expect(question.choices.filter((choice) => choice.id === question.answer.id)).toHaveLength(1)
    }
    expect(questions.some((question) => question.choices.some((choice) => !course.countryIds.includes(choice.id)))).toBe(true)
  })

  test('正解位置バッグは元配列を壊さず、各位置が偏りすぎない', () => {
    const positions = answerPositionBag(seededRandom(8))
    expect(positions).toHaveLength(10)
    expect(positions.filter((value) => value === 0)).toHaveLength(3)
    expect(positions.filter((value) => value === 1)).toHaveLength(3)
    expect(positions.filter((value) => value === 2)).toHaveLength(2)
    expect(positions.filter((value) => value === 3)).toHaveLength(2)
  })
})
