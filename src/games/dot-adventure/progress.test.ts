import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { readMusic, readProgress, recordClear, writeMusic } from './progress'

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } })
})
afterEach(() => vi.unstubAllGlobals())

describe('dot-adventure progress', () => {
  test('クリアと なかまの かずを のこし、よい ほうを たもつ', () => {
    expect(readProgress()).toEqual({})
    recordClear('forest', 2)
    recordClear('forest', 1)
    expect(readProgress()).toEqual({ forest: { cleared: true, friends: 2 } })
  })

  test('こわれた データは すてる', () => {
    store.set('dot-adventure-progress-v1', '{"forest":{"cleared":"yes"},"Bad!":{"cleared":true},"beach":{"cleared":true,"friends":99}}')
    expect(readProgress()).toEqual({ beach: { cleared: true, friends: 0 } })
    store.set('dot-adventure-progress-v1', 'oops')
    expect(readProgress()).toEqual({})
  })

  test('おんがくの せってい', () => {
    expect(readMusic()).toBe(true)
    writeMusic(false)
    expect(readMusic()).toBe(false)
  })
})
