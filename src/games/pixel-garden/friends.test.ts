import { afterEach, describe, expect, test, vi } from 'vitest'
import { earnFriend, FRIENDS_KEY, readFriends, saveFriends, toggleFriend } from './friends'

afterEach(() => vi.unstubAllGlobals())

describe('庭の仲間の収集と保存', () => {
  test('花束ごとに一匹ずつ仲間になり、全員集めた後は増えない', () => {
    let friends = { unlocked: 0, decorations: [] as number[] }
    for (let i = 0; i < 3; i++) {
      friends = earnFriend(friends)
      expect(friends.unlocked).toBe(i + 1)
      expect(friends.decorations).toContain(i)
    }
    expect(earnFriend(friends)).toBe(friends)
    const hidden = toggleFriend(friends, 1)
    expect(hidden.decorations).toEqual([0, 2])
    expect(toggleFriend(hidden, 1).decorations).toEqual([0, 2, 1])
    for (const id of [-1, 3, 0.5, NaN]) expect(toggleFriend(hidden, id)).toBe(hidden)
  })

  test('記録と飾り方を保存・復元する', () => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key), setItem: (key: string, value: string) => data.set(key, value) })
    expect(readFriends()).toEqual({ unlocked: 0, decorations: [] })
    const friends = { unlocked: 2, decorations: [1] }
    expect(saveFriends(friends)).toBe(true)
    expect(readFriends()).toEqual(friends)
  })

  test('壊れた保存や未解放の飾りを取り込まない', () => {
    let raw = ''
    vi.stubGlobal('localStorage', { getItem: () => raw })
    for (raw of ['broken', 'null', '[]', '{"unlocked":-1,"decorations":[]}', '{"unlocked":1.5,"decorations":[]}', '{"unlocked":99,"decorations":[]}']) {
      expect(readFriends()).toEqual({ unlocked: 0, decorations: [] })
    }
    raw = JSON.stringify({ unlocked: 2, decorations: [0, 0, 1, 2, -1, '0', null, 0.5] })
    expect(readFriends()).toEqual({ unlocked: 2, decorations: [0, 1] })
  })

  test('保存拒否でも例外を出さず、次の保存で再試行できる', () => {
    const setItem = vi.fn().mockImplementationOnce(() => { throw new Error('quota') })
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied') }, setItem })
    const friends = earnFriend(readFriends())
    expect(saveFriends(friends)).toBe(false)
    expect(saveFriends(friends)).toBe(true)
    expect(setItem).toHaveBeenLastCalledWith(FRIENDS_KEY, JSON.stringify(friends))
  })
})
