import { afterEach, describe, expect, test, vi } from 'vitest'
import { COURSES, DEFAULT_BUILD } from './data'
import { progressStore, readBuild, writeBuild } from './save'

afterEach(() => vi.unstubAllGlobals())

function storage() {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  })
  return values
}

describe('mini-4wd saved car and trophies', () => {
  test('restores the assembled car and repairs invalid parts', () => {
    const values = storage()
    expect(readBuild()).toEqual(DEFAULT_BUILD)
    const build = { ...DEFAULT_BUILD, body: 'wing', motor: 'dash', color: 'mint' }
    writeBuild(build)
    expect(readBuild()).toEqual(build)
    values.set('mini-4wd:build:v1', JSON.stringify({ ...build, motor: 'unknown' }))
    expect(readBuild()).toEqual({ ...build, motor: DEFAULT_BUILD.motor })
    values.set('mini-4wd:build:v1', '{broken')
    expect(readBuild()).toEqual(DEFAULT_BUILD)
  })

  test('keeps only the best trophy for a known course', () => {
    storage()
    expect(progressStore.record(COURSES[0].id, 2)).toEqual({ park: 2 })
    expect(progressStore.record(COURSES[0].id, 1)).toEqual({ park: 2 })
    expect(progressStore.record(COURSES[0].id, 3)).toEqual({ park: 3 })
    expect(progressStore.record('missing', 3)).toEqual({ park: 3 })
    expect(progressStore.read()).toEqual({ park: 3 })
  })

  test('blocked storage never prevents play or recording an in-memory result', () => {
    storage()
    progressStore.record('park', 2)
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(readBuild()).toEqual(DEFAULT_BUILD)
    expect(() => writeBuild(DEFAULT_BUILD)).not.toThrow()
    expect(progressStore.read()).toEqual({ park: 2 })
    expect(progressStore.record('forest', 3)).toEqual({ park: 2, forest: 3 })
    expect(progressStore.read()).toEqual({ park: 2, forest: 3 })
  })
})
