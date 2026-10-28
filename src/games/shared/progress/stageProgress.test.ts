import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createStageProgressStore, totalStageStars } from './stageProgress'

describe('createStageProgressStore（Issue #784 A6）', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  test.each([false, true])('保存拒否でも複数面と最高記録を保持する（読込も拒否: %s）', (blockRead) => {
    localStorage.setItem('test-progress', JSON.stringify({ old: 2 }))
    const store = createStageProgressStore('test-progress')
    expect(store.read()).toEqual({ old: 2 })
    if (blockRead) vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(store.recordWithStatus('a', 3)).toEqual({ progress: { old: 2, a: 3 }, persisted: false })
    expect(store.record('b', 2)).toEqual({ old: 2, a: 3, b: 2 })
    expect(store.record('a', 1)).toEqual({ old: 2, a: 3, b: 2 })
    const snapshot = store.read()
    snapshot.a = 1
    expect(store.read().a).toBe(3)
  })

  test('保存が回復したら、同じ★の記録でも未保存分をまとめて保存する', () => {
    const store = createStageProgressStore('test-progress')
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    store.record('a', 3)
    store.record('b', 2)
    write.mockRestore()
    localStorage.setItem('test-progress', JSON.stringify({ otherTab: 1, b: 3 }))
    expect(store.recordWithStatus('a', 1)).toEqual({ progress: { a: 3, b: 3, otherTab: 1 }, persisted: true })
    expect(createStageProgressStore('test-progress').read()).toEqual({ a: 3, b: 3, otherTab: 1 })
    localStorage.removeItem('test-progress')
    expect(store.read()).toEqual({})
  })

  test('有限でない値は記録せず、保存キーが違うゲームへ記録を混ぜない', () => {
    const a = createStageProgressStore('a'), b = createStageProgressStore('b')
    expect(a.record('bad', NaN)).toEqual({})
    expect(a.record('bad', Infinity)).toEqual({})
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    a.record('stage', 3)
    expect(b.read()).toEqual({})
  })

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

  test('保存済みの最高記録を下回る操作では再書込せず、特殊なIDも数値として記録する', () => {
    const store = createStageProgressStore('test-progress')
    expect(store.record('constructor', 2)).toEqual({ constructor: 2 })
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(store.recordWithStatus('constructor', 1)).toEqual({ progress: { constructor: 2 }, persisted: true })
    expect(write).not.toHaveBeenCalled()
  })
})
