import { afterEach, describe, expect, test, vi } from 'vitest'
import { readProgress, recordStars } from './progress'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v) },
})
afterEach(() => store.clear())

describe('robo-kuzushi progress', () => {
  test('keeps the best stars per stage', () => {
    expect(recordStars(0, 2)).toEqual({ 0: 2 })
    expect(recordStars(0, 1)).toEqual({ 0: 2 })
    expect(recordStars(0, 3)).toEqual({ 0: 3 })
    expect(recordStars(4, 1)).toEqual({ 0: 3, 4: 1 })
  })
  test('ignores broken or tampered data', () => {
    store.set('robo-kuzushi-progress-v1', '{oops')
    expect(readProgress()).toEqual({})
    store.set('robo-kuzushi-progress-v1', JSON.stringify({ 0: 9, 1: 2, x: 3, 2: 1.5 }))
    expect(readProgress()).toEqual({ 1: 2 })
  })
})
