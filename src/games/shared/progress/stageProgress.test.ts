import { beforeEach, describe, expect, test } from 'vitest'
import { createStageProgressStore, totalStageStars } from './stageProgress'

describe('createStageProgressStore（Issue #784 A6）', () => {
  beforeEach(() => localStorage.clear())

  test('よりよい★のときだけ上書きする', () => {
    const store = createStageProgressStore('test-progress')
    expect(store.record('a', 2)).toEqual({ a: 2 })
    expect(store.record('a', 1)).toEqual({ a: 2 })
    expect(store.record('a', 3)).toEqual({ a: 3 })
    expect(store.record(4, 1)).toEqual({ a: 3, 4: 1 })
    expect(totalStageStars(store.read())).toBe(4)
  })

  test('範囲外の★は1〜3に丸め、壊れた値や知らないIDは読み捨てる', () => {
    const store = createStageProgressStore('test-progress', (id) => id !== 'gone')
    expect(store.record('a', 9)).toEqual({ a: 3 })
    localStorage.setItem('test-progress', JSON.stringify({ a: 2, b: 0, c: 4, d: 1.5, gone: 3, e: 'x' }))
    expect(store.read()).toEqual({ a: 2 })
    localStorage.setItem('test-progress', '{broken')
    expect(store.read()).toEqual({})
    localStorage.setItem('test-progress', '[1,2]')
    expect(store.read()).toEqual({})
  })

  test('知らないIDは保存しない', () => {
    const store = createStageProgressStore('test-progress', (id) => id === 'ok')
    expect(store.record('ng', 3)).toEqual({})
    expect(localStorage.getItem('test-progress')).toBeNull()
  })
})
