import { describe, expect, it } from 'vitest'
import {
  findKomaSpec,
  KOMA_SPECS,
  KOMA_TYPE_CONFIGS,
  komaSpecsForCount,
  komaSpecsForSelection,
} from './komaSpecs'

const TYPE_IDS = KOMA_TYPE_CONFIGS.map((type) => type.id)

describe('KOMA_SPECS', () => {
  it('IDが重複していない', () => {
    const ids = KOMA_SPECS.map((spec) => spec.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('2個を見分けられるよう、色が互いに異なる', () => {
    const colors = KOMA_SPECS.map((spec) => spec.color)
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('対戦する2個は逆向きに回る', () => {
    expect(KOMA_SPECS[0]!.spinDirection).toBe(-KOMA_SPECS[1]!.spinDirection)
  })
})

describe('KOMA_TYPE_CONFIGS', () => {
  it('4種類がすべて一意なIDと見た目を持つ', () => {
    expect(TYPE_IDS).toEqual(['balance', 'attack', 'stamina', 'defense'])
    expect(new Set(TYPE_IDS).size).toBe(TYPE_IDS.length)
    expect(
      new Set(
        KOMA_TYPE_CONFIGS.map((type) =>
          JSON.stringify({ visual: type.visual, accentColor: type.accentColor }),
        ),
      ).size,
    ).toBe(KOMA_TYPE_CONFIGS.length)

    for (const type of KOMA_TYPE_CONFIGS) {
      expect(type.name).not.toBe('')
      expect(type.description).not.toBe('')
      expect(type.icon).not.toBe('')
      expect(type.accentColor).toMatch(/^#[0-9a-f]{6}$/i)
      for (const value of [
        type.densityScale,
        type.diskFrictionScale,
        type.diskRestitutionScale,
        type.angularDampingScale,
        type.initialSpinScale,
        type.orbitSpeedScale,
        type.stabilizationScale,
        type.collisionImpulseScale,
        type.visual.diskRadiusScale,
        type.visual.diskThicknessScale,
        type.visual.upperTopScale,
        type.visual.upperBottomScale,
        type.visual.capScale,
        type.visual.knobScale,
        type.visual.ringScale,
      ]) {
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThan(0)
      }
      expect(type.densityScale).toBeGreaterThanOrEqual(0.75)
      expect(type.densityScale).toBeLessThanOrEqual(1.25)
      expect(type.diskRestitutionScale * type.collisionImpulseScale).toBeGreaterThanOrEqual(0.65)
      expect(type.diskRestitutionScale * type.collisionImpulseScale).toBeLessThanOrEqual(1.25)
    }
  })

  it('選択したタイプをプレイヤー枠へ割り当て、1個モードは1枠だけ返す', () => {
    const selected = komaSpecsForSelection(['attack', 'defense'], 2)
    expect(selected.map((spec) => spec.typeId)).toEqual(['attack', 'defense'])
    expect(selected.map((spec) => spec.slotId)).toEqual(['player1', 'player2'])
    expect(komaSpecsForSelection(['stamina', 'defense'], 1).map((spec) => spec.typeId)).toEqual([
      'stamina',
    ])
  })

  it('未知のタイプは安全な基準タイプへ戻る', () => {
    expect(komaSpecsForSelection(['unknown'], 1)[0]!.typeId).toBe('balance')
  })
})

describe('komaSpecsForCount', () => {
  it('選んだ数だけ返す', () => {
    expect(komaSpecsForCount(1)).toHaveLength(1)
    expect(komaSpecsForCount(2)).toHaveLength(2)
  })

  it('範囲外の数でも1〜定義数へ収める', () => {
    expect(komaSpecsForCount(0)).toHaveLength(1)
    expect(komaSpecsForCount(-3)).toHaveLength(1)
    expect(komaSpecsForCount(99)).toHaveLength(KOMA_SPECS.length)
    expect(komaSpecsForCount(Number.NaN)).toHaveLength(1)
  })
})

describe('findKomaSpec', () => {
  it('IDで引ける', () => {
    expect(findKomaSpec(KOMA_SPECS[0]!.id)?.id).toBe(KOMA_SPECS[0]!.id)
    expect(findKomaSpec('missing')).toBeUndefined()
  })
})
