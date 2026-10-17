import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { isUnlocked, progressStore } from './progress'
import { STAGES } from './stages'

const store = new Map<string, string>()

describe('homerun-derby progress', () => {
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } })
  })
  afterEach(() => vi.unstubAllGlobals())

  test('only the first opponent is open at first, and winning opens the next one', () => {
    expect(STAGES.map((_, i) => isUnlocked({}, i))).toEqual(STAGES.map((_, i) => i === 0))
    const progress = progressStore.record(STAGES[0].id, 2)
    expect(isUnlocked(progress, 1)).toBe(true)
    expect(isUnlocked(progress, 2)).toBe(false)
  })

  test('keeps the best stars and drops unknown or broken records', () => {
    progressStore.record(STAGES[0].id, 3)
    progressStore.record(STAGES[0].id, 1)
    expect(progressStore.read()).toEqual({ [STAGES[0].id]: 3 })
    localStorage.setItem('homerun-derby-progress-v1', JSON.stringify({ [STAGES[1].id]: 2, unknown: 3, [STAGES[2].id]: 9 }))
    expect(progressStore.read()).toEqual({ [STAGES[1].id]: 2 })
    localStorage.setItem('homerun-derby-progress-v1', '{broken')
    expect(progressStore.read()).toEqual({})
  })
})
