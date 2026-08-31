import { describe, expect, it } from 'vitest'
import { findKomaSpec, KOMA_SPECS, komaSpecsForCount } from './komaSpecs'

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
