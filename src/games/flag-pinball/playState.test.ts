import { describe, expect, it } from 'vitest'
import { PINBALL_FLAG_IDS } from './data/pinballFlags'
import { parsePinballPlayState, parsePinballResultState } from './playState'

const VALID_NORMAL_IDS = ['jp', 'kr', 'cn']
const ALL_FLAG_IDS = [...PINBALL_FLAG_IDS]

describe('parsePinballPlayState', () => {
  it('normal: flagIdsが3件・重複なし・すべて既知のidなら正規化した state を返す', () => {
    expect(parsePinballPlayState({ mode: 'normal', flagIds: VALID_NORMAL_IDS })).toEqual({
      mode: 'normal',
      flagIds: VALID_NORMAL_IDS,
    })
  })

  it('allFlags: flagIdsが全国旗の並べ替えなら正規化した state を返す', () => {
    expect(parsePinballPlayState({ mode: 'allFlags', flagIds: ALL_FLAG_IDS })).toEqual({
      mode: 'allFlags',
      flagIds: ALL_FLAG_IDS,
    })
  })

  it('allFlags で3件だけ渡すと null（allFlagsは全件そろっていることが条件）', () => {
    expect(parsePinballPlayState({ mode: 'allFlags', flagIds: VALID_NORMAL_IDS })).toBeNull()
  })

  it('mode が無い（undefined）場合は normal として救済する（旧stateとの後方互換）', () => {
    expect(parsePinballPlayState({ flagIds: VALID_NORMAL_IDS })).toEqual({
      mode: 'normal',
      flagIds: VALID_NORMAL_IDS,
    })
  })

  it('不正な mode は null', () => {
    expect(parsePinballPlayState({ mode: 'hard', flagIds: VALID_NORMAL_IDS })).toBeNull()
    expect(parsePinballPlayState({ mode: 123, flagIds: VALID_NORMAL_IDS })).toBeNull()
  })

  it('state が null や配列など object 以外なら null', () => {
    expect(parsePinballPlayState(null)).toBeNull()
    expect(parsePinballPlayState(undefined)).toBeNull()
    expect(parsePinballPlayState('jp,kr,cn')).toBeNull()
  })

  it('flagIds が無い / 配列でないなら null', () => {
    expect(parsePinballPlayState({})).toBeNull()
    expect(parsePinballPlayState({ mode: 'normal', flagIds: 'jp,kr,cn' })).toBeNull()
  })

  it('normal で flagIds の長さが3でなければ null', () => {
    expect(parsePinballPlayState({ mode: 'normal', flagIds: ['jp', 'kr'] })).toBeNull()
    expect(parsePinballPlayState({ mode: 'normal', flagIds: ['jp', 'kr', 'cn', 'us'] })).toBeNull()
    expect(parsePinballPlayState({ mode: 'normal', flagIds: [] })).toBeNull()
  })

  it('flagIds に重複があれば null（allFlagsでも同様）', () => {
    expect(parsePinballPlayState({ mode: 'normal', flagIds: ['jp', 'jp', 'kr'] })).toBeNull()
    // 末尾を先頭と同じidに差し替える（長さ40のまま、末尾要素だけ重複させる）
    const withDuplicate = [...ALL_FLAG_IDS.slice(0, -1), ALL_FLAG_IDS[0]]
    expect(parsePinballPlayState({ mode: 'allFlags', flagIds: withDuplicate })).toBeNull()
  })

  it('flagIds に未知のidが含まれていれば null', () => {
    expect(parsePinballPlayState({ mode: 'normal', flagIds: ['jp', 'kr', 'xx'] })).toBeNull()
  })

  it('flagIds の要素が文字列でなければ null', () => {
    expect(parsePinballPlayState({ mode: 'normal', flagIds: ['jp', 'kr', 123] })).toBeNull()
  })
})

describe('parsePinballResultState', () => {
  it('normal: flagIdsが妥当で、scoresが同じ長さの有限数値配列なら正規化した state を返す', () => {
    expect(
      parsePinballResultState({ mode: 'normal', flagIds: VALID_NORMAL_IDS, scores: [100, 300, 1000] }),
    ).toEqual({ mode: 'normal', flagIds: VALID_NORMAL_IDS, scores: [100, 300, 1000] })
  })

  it('allFlags: flagIdsが全件・scoresが同じ長さなら正規化した state を返す', () => {
    const scores = ALL_FLAG_IDS.map(() => 100)
    expect(parsePinballResultState({ mode: 'allFlags', flagIds: ALL_FLAG_IDS, scores })).toEqual({
      mode: 'allFlags',
      flagIds: ALL_FLAG_IDS,
      scores,
    })
  })

  it('mode が無い場合は normal として救済する', () => {
    expect(parsePinballResultState({ flagIds: VALID_NORMAL_IDS, scores: [100, 300, 1000] })).toEqual({
      mode: 'normal',
      flagIds: VALID_NORMAL_IDS,
      scores: [100, 300, 1000],
    })
  })

  it('不正な mode は null', () => {
    expect(
      parsePinballResultState({ mode: 'hard', flagIds: VALID_NORMAL_IDS, scores: [100, 300, 1000] }),
    ).toBeNull()
  })

  it('flagIds が不正なら null（parsePinballPlayStateと同じ検証を共有する）', () => {
    expect(
      parsePinballResultState({ mode: 'normal', flagIds: ['jp', 'jp', 'kr'], scores: [100, 300, 1000] }),
    ).toBeNull()
    expect(
      parsePinballResultState({ mode: 'normal', flagIds: ['jp', 'kr', 'xx'], scores: [100, 300, 1000] }),
    ).toBeNull()
    expect(parsePinballResultState({ mode: 'allFlags', flagIds: VALID_NORMAL_IDS, scores: [100, 300, 1000] })).toBeNull()
  })

  it('scores が無い / 配列でないなら null', () => {
    expect(parsePinballResultState({ mode: 'normal', flagIds: VALID_NORMAL_IDS })).toBeNull()
    expect(
      parsePinballResultState({ mode: 'normal', flagIds: VALID_NORMAL_IDS, scores: '100,300,1000' }),
    ).toBeNull()
  })

  it('scores の長さが flagIds と一致しなければ null', () => {
    expect(parsePinballResultState({ mode: 'normal', flagIds: VALID_NORMAL_IDS, scores: [100, 300] })).toBeNull()
    expect(
      parsePinballResultState({ mode: 'normal', flagIds: VALID_NORMAL_IDS, scores: [100, 300, 1000, 100] }),
    ).toBeNull()
  })

  it('scores に数値以外・NaN・Infinity が含まれていれば null', () => {
    expect(
      parsePinballResultState({ mode: 'normal', flagIds: VALID_NORMAL_IDS, scores: [100, '300', 1000] }),
    ).toBeNull()
    expect(
      parsePinballResultState({ mode: 'normal', flagIds: VALID_NORMAL_IDS, scores: [100, Number.NaN, 1000] }),
    ).toBeNull()
    expect(
      parsePinballResultState({
        mode: 'normal',
        flagIds: VALID_NORMAL_IDS,
        scores: [100, Number.POSITIVE_INFINITY, 1000],
      }),
    ).toBeNull()
  })
})
