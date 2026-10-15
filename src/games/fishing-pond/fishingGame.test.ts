import { describe, expect, test } from 'vitest'
import { DECAY_GRACE_MS, ESCAPE_MS, FISH, fishingReducer, initialFishingState, reelStep, type FishingState } from './fishingGame'

function hooked(fishId: (typeof FISH)[number]['id'], from: FishingState = fishingReducer(initialFishingState(), { type: 'start' })) {
  return fishingReducer(from, { type: 'bite', fishId })
}

function reelTimes(state: FishingState, times: number) {
  for (let i = 0; i < times; i++) state = fishingReducer(state, { type: 'reel' })
  return state
}

describe('fishingGame', () => {
  test('6種類は重複せず、連打回数・速さ・深さが遊べる範囲にある', () => {
    expect(FISH).toHaveLength(6)
    expect(new Set(FISH.map((fish) => fish.id)).size).toBe(6)
    expect(new Set(FISH.map((fish) => fish.name)).size).toBe(6)
    for (const fish of FISH) {
      expect(fish.pulls).toBeGreaterThanOrEqual(4)
      expect(fish.pulls).toBeLessThanOrEqual(12)
      expect(fish.speed).toBeGreaterThan(0)
      expect(fish.depth).toBeGreaterThan(40)
      expect(fish.depth).toBeLessThan(88)
    }
  })

  test('かかる前の巻き上げ・タイトルでの合図は無視する', () => {
    const title = initialFishingState()
    expect(fishingReducer(title, { type: 'bite', fishId: 'puffer' })).toBe(title)
    const fishing = fishingReducer(title, { type: 'start' })
    expect(fishingReducer(fishing, { type: 'reel' })).toBe(fishing)
    expect(fishingReducer(fishing, { type: 'next' })).toBe(fishing)
    expect(fishingReducer(fishing, { type: 'tick', ms: 99_999 })).toBe(fishing)
    const biting = hooked('puffer', fishing)
    expect(fishingReducer(biting, { type: 'bite', fishId: 'tang' })).toBe(biting)
  })

  test('判定は緩め: 決められた回数より少し少なくても釣れる', () => {
    for (const fish of FISH) {
      const fewer = Math.ceil(1 / reelStep(fish))
      expect(fewer).toBeLessThanOrEqual(fish.pulls)
      const state = reelTimes(hooked(fish.id), fewer)
      expect(state.phase).toBe('caught')
      expect(state.caught).toEqual([fish.id])
    }
  })

  test('少し休んでも進みはゆっくりしか戻らず、長く放っておくと逃げる', () => {
    let state = reelTimes(hooked('sunfish'), 4)
    const before = state.progress
    state = fishingReducer(state, { type: 'tick', ms: DECAY_GRACE_MS })
    expect(state.progress).toBe(before)
    state = fishingReducer(state, { type: 'tick', ms: 1000 })
    expect(state.progress).toBeLessThan(before)
    expect(state.progress).toBeGreaterThan(before - 0.1)
    state = fishingReducer(state, { type: 'reel' })
    expect(state.idleMs).toBe(0)
    state = fishingReducer(state, { type: 'tick', ms: ESCAPE_MS - 1 })
    expect(state.phase).toBe('hooked')
    state = fishingReducer(state, { type: 'tick', ms: 1 })
    expect(state).toMatchObject({ phase: 'fishing', hookedId: null, progress: 0, escaped: true, caught: [] })
    expect(hooked('sunfish', state).escaped).toBe(false)
  })

  test('全種を集め、重複捕獲せず完成・再挑戦できる', () => {
    let state: FishingState = fishingReducer(initialFishingState(), { type: 'start' })
    for (const fish of [...FISH].reverse()) {
      state = reelTimes(hooked(fish.id, state), fish.pulls)
      expect(fishingReducer(state, { type: 'reel' })).toBe(state)
      if (state.caught.length < FISH.length) {
        state = fishingReducer(state, { type: 'next' })
        expect(fishingReducer(state, { type: 'bite', fishId: fish.id })).toBe(state)
      }
    }
    expect(state.phase).toBe('complete')
    expect(new Set(state.caught).size).toBe(6)
    expect(fishingReducer(state, { type: 'next' })).toBe(state)
    expect(fishingReducer(state, { type: 'start' })).toMatchObject({ phase: 'fishing', caught: [], hookedId: null })
  })

  test('タイトルへ戻ると釣果も合図も持ち越さない', () => {
    let state = hooked('sunfish')
    state = fishingReducer(state, { type: 'back' })
    expect(state).toEqual(initialFishingState())
    expect(fishingReducer(state, { type: 'reel' })).toBe(state)
  })
})
