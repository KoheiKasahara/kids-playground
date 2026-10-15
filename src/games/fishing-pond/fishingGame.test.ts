import { describe, expect, test } from 'vitest'
import { FISH, fishingReducer, initialFishingState, type FishingState } from './fishingGame'

describe('fishingGame', () => {
  test('6種類は重複せず、待ち時間は短く、位置は海の内側にある', () => {
    expect(FISH).toHaveLength(6)
    expect(new Set(FISH.map((fish) => fish.id)).size).toBe(6)
    expect(new Set(FISH.map((fish) => fish.name)).size).toBe(6)
    for (const fish of FISH) {
      expect(fish.waitMs).toBeGreaterThanOrEqual(1000)
      expect(fish.waitMs).toBeLessThanOrEqual(2500)
      expect(fish.x).toBeGreaterThan(15)
      expect(fish.x).toBeLessThan(85)
      expect(fish.y).toBeGreaterThan(30)
      expect(fish.y).toBeLessThan(90)
    }
  })

  test('早すぎる巻き上げや別の魚の合図では釣れない', () => {
    let state = fishingReducer(initialFishingState(), { type: 'start' })
    state = fishingReducer(state, { type: 'choose', fishId: 'puffer' })
    expect(fishingReducer(state, { type: 'reel' })).toBe(state)
    expect(fishingReducer(state, { type: 'bite', fishId: 'clownfish' })).toBe(state)
    expect(fishingReducer(state, { type: 'choose', fishId: 'tang' })).toBe(state)
    expect(fishingReducer(state, { type: 'next' })).toBe(state)
  })

  test('好きな順で全種を集め、重複捕獲せず完成・再挑戦できる', () => {
    let state: FishingState = fishingReducer(initialFishingState(), { type: 'start' })
    for (const fish of [...FISH].reverse()) {
      state = fishingReducer(state, { type: 'choose', fishId: fish.id })
      state = fishingReducer(state, { type: 'bite', fishId: fish.id })
      state = fishingReducer(state, { type: 'reel' })
      expect(fishingReducer(state, { type: 'reel' })).toBe(state)
      if (state.caught.length < FISH.length) {
        state = fishingReducer(state, { type: 'next' })
        expect(fishingReducer(state, { type: 'choose', fishId: fish.id })).toBe(state)
      }
    }
    expect(state.phase).toBe('complete')
    expect(new Set(state.caught).size).toBe(6)
    expect(fishingReducer(state, { type: 'next' })).toBe(state)
    expect(fishingReducer(state, { type: 'start' })).toEqual({ phase: 'choosing', caught: [], selectedId: null })
  })

  test('タイトルへ戻ったあとに遅い合図が来ても進行しない', () => {
    let state = fishingReducer(initialFishingState(), { type: 'start' })
    state = fishingReducer(state, { type: 'choose', fishId: 'sunfish' })
    state = fishingReducer(state, { type: 'back' })
    expect(state).toEqual(initialFishingState())
    expect(fishingReducer(state, { type: 'bite', fishId: 'sunfish' })).toBe(state)
  })
})
