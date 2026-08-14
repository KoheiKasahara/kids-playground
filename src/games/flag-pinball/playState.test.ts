import { describe, expect, it } from 'vitest'
import { isPinballPlayState, isPinballResultState } from './playState'

const VALID_IDS = ['jp', 'kr', 'cn']

describe('isPinballPlayState', () => {
  it('flagIdsが3件・重複なし・すべて既知のidなら true', () => {
    expect(isPinballPlayState({ flagIds: VALID_IDS })).toBe(true)
  })

  it('state が null や配列など object 以外なら false', () => {
    expect(isPinballPlayState(null)).toBe(false)
    expect(isPinballPlayState(undefined)).toBe(false)
    expect(isPinballPlayState('jp,kr,cn')).toBe(false)
  })

  it('flagIds が無い / 配列でないなら false', () => {
    expect(isPinballPlayState({})).toBe(false)
    expect(isPinballPlayState({ flagIds: 'jp,kr,cn' })).toBe(false)
  })

  it('flagIds の長さが3でなければ false', () => {
    expect(isPinballPlayState({ flagIds: ['jp', 'kr'] })).toBe(false)
    expect(isPinballPlayState({ flagIds: ['jp', 'kr', 'cn', 'us'] })).toBe(false)
    expect(isPinballPlayState({ flagIds: [] })).toBe(false)
  })

  it('flagIds に重複があれば false', () => {
    expect(isPinballPlayState({ flagIds: ['jp', 'jp', 'kr'] })).toBe(false)
  })

  it('flagIds に未知のidが含まれていれば false', () => {
    expect(isPinballPlayState({ flagIds: ['jp', 'kr', 'xx'] })).toBe(false)
  })

  it('flagIds の要素が文字列でなければ false', () => {
    expect(isPinballPlayState({ flagIds: ['jp', 'kr', 123] })).toBe(false)
  })
})

describe('isPinballResultState', () => {
  it('flagIdsが妥当で、scoresが同じ長さの有限数値配列なら true', () => {
    expect(isPinballResultState({ flagIds: VALID_IDS, scores: [100, 300, 1000] })).toBe(true)
  })

  it('flagIds が不正なら false（isPinballPlayStateと同じ検証を共有する）', () => {
    expect(isPinballResultState({ flagIds: ['jp', 'jp', 'kr'], scores: [100, 300, 1000] })).toBe(false)
    expect(isPinballResultState({ flagIds: ['jp', 'kr', 'xx'], scores: [100, 300, 1000] })).toBe(false)
  })

  it('scores が無い / 配列でないなら false', () => {
    expect(isPinballResultState({ flagIds: VALID_IDS })).toBe(false)
    expect(isPinballResultState({ flagIds: VALID_IDS, scores: '100,300,1000' })).toBe(false)
  })

  it('scores の長さが flagIds と一致しなければ false', () => {
    expect(isPinballResultState({ flagIds: VALID_IDS, scores: [100, 300] })).toBe(false)
    expect(isPinballResultState({ flagIds: VALID_IDS, scores: [100, 300, 1000, 100] })).toBe(false)
  })

  it('scores に数値以外・NaN・Infinity が含まれていれば false', () => {
    expect(isPinballResultState({ flagIds: VALID_IDS, scores: [100, '300', 1000] })).toBe(false)
    expect(isPinballResultState({ flagIds: VALID_IDS, scores: [100, Number.NaN, 1000] })).toBe(false)
    expect(isPinballResultState({ flagIds: VALID_IDS, scores: [100, Number.POSITIVE_INFINITY, 1000] })).toBe(false)
  })
})
