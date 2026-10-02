import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  FAVORITE_GAMES_STORAGE_KEY,
  MAX_RECENT_GAMES,
  RECENT_GAMES_STORAGE_KEY,
  findGameIdByPathname,
  recordRecentGameVisit,
  resetGameShelfCache,
  toggleFavoriteGame,
  useFavoriteGameIds,
  useRecentGameIds,
} from './gameShelfStore'

beforeEach(() => {
  localStorage.clear()
  resetGameShelfCache()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('さいきん あそんだ', () => {
  test('最後に開いたゲームを先頭へ置き、同じゲームは重ねない', () => {
    const { result } = renderHook(() => useRecentGameIds())
    act(() => {
      recordRecentGameVisit('/games/flag-quiz')
      recordRecentGameVisit('/games/math-quiz')
      recordRecentGameVisit('/games/flag-quiz')
    })
    expect(result.current).toEqual(['flag-quiz', 'math-quiz'])
    expect(JSON.parse(localStorage.getItem(RECENT_GAMES_STORAGE_KEY)!)).toEqual([
      'flag-quiz',
      'math-quiz',
    ])
  })

  test(`保存するのは最近の${MAX_RECENT_GAMES}件まで`, () => {
    const visited = [
      'flag-quiz',
      'math-quiz',
      'piano-play',
      'crane-game',
      'putter-golf',
      'shinkeisuijaku',
      'pyoko-touch',
    ]
    for (const id of visited) recordRecentGameVisit(`/games/${id}`)
    const { result } = renderHook(() => useRecentGameIds())
    expect(result.current).toEqual(visited.slice(1).reverse())
  })

  test('ゲーム内の画面もそのゲームとして数え、ゲーム以外のURLは数えない', () => {
    expect(findGameIdByPathname('/games/car-road-builder/play')).toBe('car-road-builder')
    expect(findGameIdByPathname('/games/flag-roll-maze')).toBe('flag-roll-maze')
    expect(findGameIdByPathname('/')).toBeUndefined()
    expect(findGameIdByPathname('/games/unknown-game')).toBeUndefined()
    expect(findGameIdByPathname('/games/flag-quizzes')).toBeUndefined()

    recordRecentGameVisit('/')
    recordRecentGameVisit('/games/unknown-game')
    expect(localStorage.getItem(RECENT_GAMES_STORAGE_KEY)).toBeNull()
  })
})

describe('おきにいり', () => {
  test('入れた順に末尾へ足し、もう一度押すと外す', () => {
    const { result } = renderHook(() => useFavoriteGameIds())
    act(() => {
      toggleFavoriteGame('putter-golf')
      toggleFavoriteGame('flag-quiz')
    })
    expect(result.current).toEqual(['putter-golf', 'flag-quiz'])

    act(() => toggleFavoriteGame('putter-golf'))
    expect(result.current).toEqual(['flag-quiz'])
    expect(JSON.parse(localStorage.getItem(FAVORITE_GAMES_STORAGE_KEY)!)).toEqual(['flag-quiz'])
  })

  test('カタログに無いidは入れない', () => {
    toggleFavoriteGame('unknown-game')
    expect(localStorage.getItem(FAVORITE_GAMES_STORAGE_KEY)).toBeNull()
  })
})

describe('保存できない・保存内容が壊れている場合', () => {
  test('壊れた値・別形式の値・削除済みゲーム・重複は読み飛ばす', () => {
    localStorage.setItem(FAVORITE_GAMES_STORAGE_KEY, '{not json')
    localStorage.setItem(
      RECENT_GAMES_STORAGE_KEY,
      JSON.stringify(['math-quiz', 42, 'removed-game', 'math-quiz', 'flag-quiz']),
    )
    expect(renderHook(() => useFavoriteGameIds()).result.current).toEqual([])
    expect(renderHook(() => useRecentGameIds()).result.current).toEqual(['math-quiz', 'flag-quiz'])

    localStorage.setItem(FAVORITE_GAMES_STORAGE_KEY, JSON.stringify({ ids: ['flag-quiz'] }))
    resetGameShelfCache()
    expect(renderHook(() => useFavoriteGameIds()).result.current).toEqual([])
  })

  test('localStorageが使えなくても、その場ではメモリ上の値で切り替わる', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    const favorites = renderHook(() => useFavoriteGameIds())
    const recents = renderHook(() => useRecentGameIds())
    expect(favorites.result.current).toEqual([])

    act(() => {
      toggleFavoriteGame('crane-game')
      recordRecentGameVisit('/games/crane-game')
    })
    expect(favorites.result.current).toEqual(['crane-game'])
    expect(recents.result.current).toEqual(['crane-game'])
  })
})
