import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createLump } from './pottery'
import { addToShelf, readShelf, SHELF_SIZE, SHELF_STORAGE_KEY } from './shelf'

let store: Map<string, string>
let quota = Infinity

beforeEach(() => {
  store = new Map()
  quota = Infinity
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (value.length > quota) throw new Error('QuotaExceededError')
      store.set(key, value)
    },
    removeItem: (key: string) => store.delete(key),
  })
})
afterEach(() => vi.unstubAllGlobals())

const item = (thumbnail?: string) => ({ kind: 'cup' as const, base: 'blue' as const, profile: createLump(), thumbnail })

describe('たな', () => {
  test('あたらしい ものを さいしょに おき、いっぱいなら ふるい ものを おろす', () => {
    for (let i = 0; i < SHELF_SIZE + 3; i++) addToShelf(item(), 1000 + i)
    const shelf = readShelf()
    expect(shelf).toHaveLength(SHELF_SIZE)
    expect(shelf[0]!.id).toBe(1000 + SHELF_SIZE + 2)
    expect(shelf.at(-1)!.id).toBe(1003)
  })

  test('しゃしんと かたちを よみもどせる（かたちは 小さく まるめる）', () => {
    addToShelf({ ...item('data:image/webp;base64,AAAA'), profile: { height: 1.23456, radii: createLump().radii.map(r => r + 0.001234) } }, 5)
    expect(readShelf()).toEqual([{ id: 5, kind: 'cup', base: 'blue', thumbnail: 'data:image/webp;base64,AAAA', profile: { height: 1.23, radii: Array(40).fill(0.85) } }])
  })

  test('こわれた データや へんな しゃしんは よみすてる', () => {
    store.set(SHELF_STORAGE_KEY, '{broken')
    expect(readShelf()).toEqual([])
    store.set(SHELF_STORAGE_KEY, JSON.stringify([
      { id: 1, kind: 'cup', base: null, profile: createLump() },
      { id: 2, kind: 'spaceship', base: null, profile: createLump() },
      { id: 3, kind: 'cup', base: 'gold', profile: createLump() },
      { id: 4, kind: 'cup', base: null, profile: { height: 1, radii: [] } },
      { id: 5, kind: 'cup', base: null, profile: createLump(), thumbnail: 'javascript:alert(1)' },
    ]))
    expect(readShelf().map(entry => entry.id)).toEqual([1])
  })

  test('ようりょうが たりなければ ふるい ものを へらして のこす', () => {
    for (let i = 0; i < 4; i++) addToShelf(item('data:image/png;base64,' + 'A'.repeat(200)), i)
    quota = 900
    const result = addToShelf(item('data:image/png;base64,' + 'B'.repeat(200)), 10)
    expect(result[0]!.id).toBe(10)
    expect(result.length).toBeLessThan(5)
    expect(readShelf()).toEqual(result)
  })

  test('まったく ほぞん できなくても エラーに ならない', () => {
    quota = 0
    expect(() => addToShelf(item(), 1)).not.toThrow()
    expect(readShelf()).toEqual([])
  })
})
