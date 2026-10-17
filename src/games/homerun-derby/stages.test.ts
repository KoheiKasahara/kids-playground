import { describe, expect, test } from 'vitest'
import { BALLS, PITCH_LABELS, PITCH_SPEED, STAGES, findStageIndex } from './stages'
import { PITCHER_HEIGHT } from './characters'

describe('homerun-derby stages', () => {
  test('ids and pitchers are unique and findable', () => {
    expect(new Set(STAGES.map(stage => stage.id)).size).toBe(STAGES.length)
    expect(new Set(STAGES.map(stage => stage.pitcher)).size).toBe(STAGES.length)
    STAGES.forEach((stage, i) => expect(findStageIndex(stage.id)).toBe(i))
    expect(findStageIndex('unknown')).toBe(-1)
  })

  test('every stage throws BALLS pitches and the goal can be reached', () => {
    for (const stage of STAGES) {
      expect(stage.pitches, stage.id).toHaveLength(BALLS)
      expect(stage.goal).toBeGreaterThanOrEqual(1)
      // ★3 まで とどく よう、めあて + 4 が なげる かず いないに おさまる。
      expect(stage.goal + 4).toBeLessThanOrEqual(BALLS)
      expect(stage.travel).toBeGreaterThan(.8)
      expect(stage.assist).toBeGreaterThanOrEqual(1)
      expect(PITCHER_HEIGHT[stage.pitcher]).toBeGreaterThan(0)
      for (const kind of stage.pitches) {
        expect(PITCH_LABELS[kind]).toBeTruthy()
        expect(PITCH_SPEED[kind]).toBeGreaterThan(0)
      }
    }
  })

  test('later opponents are not easier', () => {
    for (let i = 1; i < STAGES.length; i++) {
      expect(STAGES[i].goal).toBeGreaterThanOrEqual(STAGES[i - 1].goal)
      expect(STAGES[i].travel).toBeLessThanOrEqual(STAGES[i - 1].travel + .1)
      expect(STAGES[i].assist).toBeLessThanOrEqual(STAGES[i - 1].assist)
    }
  })
})
