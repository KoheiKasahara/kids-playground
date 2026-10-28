import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { COURSES } from './courses'
import { isUnlocked, progressStore, readAnimal, writeAnimal } from './progress'

const store = new Map<string, string>()

describe('gochiso-race progress', () => {
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } })
  })
  afterEach(() => vi.unstubAllGlobals())

  test('only the first course is open at first, and winning opens the next one', () => {
    expect(COURSES.map((_, i) => isUnlocked({}, i))).toEqual(COURSES.map((_, i) => i === 0))
    const progress = progressStore.record(COURSES[0].id, 1)
    expect(isUnlocked(progress, 1)).toBe(true)
    expect(isUnlocked(progress, 2)).toBe(false)
  })

  test('keeps the best stars and drops unknown records', () => {
    progressStore.record(COURSES[1].id, 3)
    progressStore.record(COURSES[1].id, 2)
    expect(progressStore.read()).toEqual({ [COURSES[1].id]: 3 })
    store.set('gochiso-race-progress-v1', JSON.stringify({ meadow: 2, moon: 3 }))
    expect(progressStore.read()).toEqual({ meadow: 2 })
  })

  test('remembers the chosen animal, ignoring unknown ones', () => {
    expect(readAnimal()).toBeNull()
    writeAnimal('koala')
    expect(readAnimal()).toBe('koala')
    store.set('gochiso-race-animal-v1', 'dragon')
    expect(readAnimal()).toBeNull()
  })

  test('still works when storage is not available', () => {
    progressStore.record(COURSES[0].id, 2)
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    expect(() => writeAnimal('cat')).not.toThrow()
    expect(readAnimal()).toBeNull()
    expect(progressStore.read()).toEqual({ [COURSES[0].id]: 2 })
    const result = progressStore.recordWithStatus(COURSES[1].id, 3)
    expect(result.persisted).toBe(false)
    expect(progressStore.read()).toEqual({ [COURSES[0].id]: 2, [COURSES[1].id]: 3 })
    expect(isUnlocked(progressStore.read(), 2)).toBe(true)
  })
})
