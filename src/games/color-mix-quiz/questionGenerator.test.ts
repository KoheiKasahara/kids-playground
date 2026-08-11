import { describe, expect, test } from 'vitest'
import { labFromHex } from './colorDifference'
import { colorMixProblems, problemsForColorMix } from './data/colorMixQuestions'
import {
  EASY_MIN_DELTA_E,
  generateColorMixQuestions,
  HARD_FAR_MIN_DELTA_E,
  HARD_NEAR_MAX_DELTA_E,
  HARD_NEAR_MIN_DELTA_E,
  HARD_THREE_COLOR_QUOTA,
  MIN_CHOICE_PAIR_DELTA_E,
  NORMAL_MIN_DELTA_E,
  OWN_TIER_QUOTA,
  validateColorMixProblems,
} from './questionGenerator'
import { QUESTION_COUNT } from '../quiz-core/types'
import { deltaE2000 } from './colorDifference'

// 赤緑の見分けが難しい色覚特性でも判別できるよう、色相だけでなく明るさ(L*)にも
// 最低限これだけの差を求める。12 は「並べたときに暗い/明るいがはっきり分かる」目安。
const L_STAR_GUARD = 12

function distractorsOf(problem: (typeof colorMixProblems)[number]) {
  return problem.choices.filter((color) => color.toLowerCase() !== problem.resultColor.toLowerCase())
}

describe('color mix data pools', () => {
  test('easy プールは十分な数がある', () => {
    const easy = problemsForColorMix('easy')
    expect(easy).toHaveLength(12)
    expect(easy.length).toBeGreaterThanOrEqual(QUESTION_COUNT + 1)
  })

  test('easy は normal に含まれる', () => {
    const easyIds = new Set(problemsForColorMix('easy').map((p) => p.id))
    const normalIds = new Set(problemsForColorMix('normal').map((p) => p.id))
    for (const id of easyIds) expect(normalIds.has(id)).toBe(true)
  })

  test('normal は hard に含まれる', () => {
    const normalIds = new Set(problemsForColorMix('normal').map((p) => p.id))
    const hardIds = new Set(problemsForColorMix('hard').map((p) => p.id))
    for (const id of normalIds) expect(hardIds.has(id)).toBe(true)
  })

  test('hard には3色の問題が6問以上あり、easy/normal には3色問題がない', () => {
    const hard = problemsForColorMix('hard')
    const threeColor = hard.filter((p) => p.inputColors.length === 3)
    expect(threeColor.length).toBeGreaterThanOrEqual(6)
    for (const problem of colorMixProblems) {
      if (problem.level !== 'hard') expect(problem.inputColors.length).toBe(2)
    }
  })

  test('easy の問題はすべての選択肢がEASY_MIN_DELTA_E以上離れている', () => {
    for (const problem of colorMixProblems.filter((p) => p.level === 'easy')) {
      for (const color of distractorsOf(problem)) {
        expect(deltaE2000(problem.resultColor, color)).toBeGreaterThanOrEqual(EASY_MIN_DELTA_E)
      }
    }
  })

  test('normal の新規問題はすべての選択肢がNORMAL_MIN_DELTA_E以上離れている', () => {
    for (const problem of colorMixProblems.filter((p) => p.level === 'normal')) {
      for (const color of distractorsOf(problem)) {
        expect(deltaE2000(problem.resultColor, color)).toBeGreaterThanOrEqual(NORMAL_MIN_DELTA_E)
      }
    }
  })

  test('hard の新規問題は近いおとりが最大1つまで', () => {
    for (const problem of colorMixProblems.filter((p) => p.level === 'hard')) {
      const deltas = distractorsOf(problem).map((color) => deltaE2000(problem.resultColor, color))
      const nearCount = deltas.filter((delta) => delta >= HARD_NEAR_MIN_DELTA_E && delta <= HARD_NEAR_MAX_DELTA_E).length
      expect(nearCount).toBeLessThanOrEqual(1)
    }
  })

  test('hard の新規問題は選べないほど近い選択肢がなく、遠い選択肢は十分離れている', () => {
    for (const problem of colorMixProblems.filter((p) => p.level === 'hard')) {
      const deltas = distractorsOf(problem).map((color) => deltaE2000(problem.resultColor, color))
      for (const delta of deltas) {
        expect(delta).toBeGreaterThanOrEqual(HARD_NEAR_MIN_DELTA_E)
        const isNear = delta <= HARD_NEAR_MAX_DELTA_E
        if (!isNear) expect(delta).toBeGreaterThanOrEqual(HARD_FAR_MIN_DELTA_E)
      }
    }
  })

  test('すべての問題で4つの選択肢が異なり、どの2つも十分離れている', () => {
    for (const problem of colorMixProblems) {
      expect(new Set(problem.choices.map((c) => c.toLowerCase())).size).toBe(4)
      for (let i = 0; i < problem.choices.length; i += 1) {
        for (let j = i + 1; j < problem.choices.length; j += 1) {
          expect(deltaE2000(problem.choices[i], problem.choices[j])).toBeGreaterThanOrEqual(MIN_CHOICE_PAIR_DELTA_E)
        }
      }
    }
  })

  test('すべての問題で正解の色がちょうど1回だけ選択肢に含まれる', () => {
    for (const problem of colorMixProblems) {
      expect(problem.choices.filter((c) => c === problem.resultColor)).toHaveLength(1)
    }
  })

  test('色覚特性ガード: どの問題にも明るさ(L*)が十分離れたおとりが1つ以上ある', () => {
    for (const problem of colorMixProblems) {
      const resultLab = labFromHex(problem.resultColor)
      expect(resultLab).toBeDefined()
      const lDiffs = distractorsOf(problem).map((color) => {
        const lab = labFromHex(color)
        expect(lab).toBeDefined()
        return Math.abs((lab as NonNullable<typeof lab>).L - (resultLab as NonNullable<typeof resultLab>).L)
      })
      expect(lDiffs.some((diff) => diff >= L_STAR_GUARD)).toBe(true)
    }
  })

  test('出題データは整合している', () => {
    expect(validateColorMixProblems()).toEqual([])
  })

  test('不整合データ(重複した選択肢)は検出する', () => {
    const broken = colorMixProblems.map((p) => (p.id === colorMixProblems[0].id ? { ...p, choices: ['#ff0000', '#ff0000', '#00ff00', '#0000ff'] as const } : p))
    expect(validateColorMixProblems(broken)).toContain(`${colorMixProblems[0].id}: duplicate choices`)
  })

  test('不整合データ(同じ入力色の組み合わせ)は検出する', () => {
    const first = colorMixProblems[0]
    const broken = [
      ...colorMixProblems,
      { id: 'conflicting-input', level: 'normal' as const, inputColors: first.inputColors, resultColor: '#111111', choices: ['#111111', '#222222', '#333333', '#444444'] as const },
    ]
    expect(validateColorMixProblems(broken)).toContain(`conflicting-input: input colors duplicate ${first.id}`)
  })

  test('不整合データ(3色問題がhard以外)は検出する', () => {
    const broken = [
      ...colorMixProblems,
      { id: 'bad-tier-trio', level: 'easy' as const, inputColors: ['#e94b3c', '#f6d743', '#fffdf7'], resultColor: '#123456', choices: ['#123456', '#654321', '#abcdef', '#fedcba'] as const },
    ]
    expect(validateColorMixProblems(broken)).toContain('bad-tier-trio: three-colour problem must be hard')
  })
})

describe('generateColorMixQuestions', () => {
  test.each(['easy', 'normal', 'hard'] as const)('%s は10問の4択を作る', (level) => {
    const questions = generateColorMixQuestions(level, QUESTION_COUNT, () => 0.37)
    expect(questions).toHaveLength(QUESTION_COUNT)
    for (const question of questions) {
      expect(question.choices).toHaveLength(4)
      expect(new Set(question.choices.map((color) => color.toLowerCase())).size).toBe(4)
      expect(question.choices.filter((color) => color === question.problem.resultColor)).toHaveLength(1)
    }
  })

  test('小さいプールを循環しても同じ問題・同じ結果が連続しない', () => {
    const questions = generateColorMixQuestions('easy', 18, () => 0.01)
    expect(questions).toHaveLength(18)
    for (let index = 1; index < questions.length; index += 1) {
      expect(questions[index].problem.id).not.toBe(questions[index - 1].problem.id)
      expect(questions[index].problem.resultColor).not.toBe(questions[index - 1].problem.resultColor)
    }
  })

  test('通常サイズのプールでも同じ問題・同じ結果が連続しない', () => {
    let seed = 0
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    for (let trial = 0; trial < 20; trial += 1) {
      const questions = generateColorMixQuestions('hard', QUESTION_COUNT, pseudoRandom)
      for (let index = 1; index < questions.length; index += 1) {
        expect(questions[index].problem.id).not.toBe(questions[index - 1].problem.id)
        expect(questions[index].problem.resultColor).not.toBe(questions[index - 1].problem.resultColor)
      }
    }
  })

  test('hard のゲームは own-tier クオータを満たす', () => {
    let seed = 1
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    for (let trial = 0; trial < 30; trial += 1) {
      const questions = generateColorMixQuestions('hard', QUESTION_COUNT, pseudoRandom)
      const hardTierCount = questions.filter((q) => q.problem.level === 'hard').length
      const threeColorCount = questions.filter((q) => q.problem.inputColors.length === 3).length
      expect(hardTierCount).toBeGreaterThanOrEqual(OWN_TIER_QUOTA.hard)
      expect(threeColorCount).toBeGreaterThanOrEqual(HARD_THREE_COLOR_QUOTA)
    }
  })

  test('normal のゲームは own-tier クオータを満たす', () => {
    let seed = 2
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    for (let trial = 0; trial < 30; trial += 1) {
      const questions = generateColorMixQuestions('normal', QUESTION_COUNT, pseudoRandom)
      const normalTierCount = questions.filter((q) => q.problem.level === 'normal').length
      expect(normalTierCount).toBeGreaterThanOrEqual(OWN_TIER_QUOTA.normal)
    }
  })
})
