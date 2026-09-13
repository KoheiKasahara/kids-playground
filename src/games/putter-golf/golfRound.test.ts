import { describe, expect, test } from 'vitest'
import { createRound, finishHole, loadBestStars, nextHole, recordShot, restartHole, roundTotals, saveBestStars, stampFor, starsFor } from './golfRound'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
}

describe('パターゴルフの成績', () => {
  test('スタンプと★は打った数とめやすで決まり、どれも前向きな言葉になる', () => {
    expect(stampFor(1, 3)).toBe('hole-in-one')
    expect(stampFor(2, 3)).toBe('great')
    expect(stampFor(3, 3)).toBe('par')
    expect(stampFor(7, 3)).toBe('clear')
    expect([starsFor(2, 2), starsFor(4, 2), starsFor(5, 2)]).toEqual([3, 2, 1])
  })

  test('3ホールを回ると、打った数と★を合計できる', () => {
    let round = createRound('meadow')
    round = recordShot(recordShot(round))
    round = finishHole(round, { id: 'a', par: 2 })
    // 同じホールを2回記録しない。
    round = finishHole(round, { id: 'a', par: 2 })
    round = nextHole(round)
    expect(round.strokes).toBe(0)
    round = finishHole(recordShot(round), { id: 'b', par: 3 })
    round = nextHole(round)
    round = finishHole(recordShot(recordShot(recordShot(recordShot(recordShot(round))))), { id: 'c', par: 2 })
    expect(round.scores.map(score => [score.strokes, score.stars, score.stamp])).toEqual([[2, 3, 'par'], [1, 3, 'hole-in-one'], [5, 1, 'clear']])
    expect(roundTotals(round.scores)).toEqual({ strokes: 8, par: 7, stars: 7 })
  })

  test('やりなおすと、いまのホールの打った数と記録だけが消える', () => {
    let round = finishHole(recordShot(createRound('beach')), { id: 'a', par: 2 })
    round = recordShot(recordShot(nextHole(round)))
    round = restartHole(round)
    expect(round.strokes).toBe(0)
    expect(round.scores).toHaveLength(1)
  })

  test('いちばん多い★だけを保存し、こわれた保存データは無視する', () => {
    const store = memoryStorage()
    expect(loadBestStars(store)).toEqual({})
    expect(saveBestStars('moon', 6, store)).toEqual({ moon: 6 })
    expect(saveBestStars('moon', 4, store)).toEqual({ moon: 6 })
    expect(saveBestStars('meadow', 9, store)).toEqual({ moon: 6, meadow: 9 })
    expect(loadBestStars(store)).toEqual({ moon: 6, meadow: 9 })
    expect(loadBestStars(memoryStorage({ 'putter-golf-best-v1': '{"moon":"x","mars":3,"beach":5}' }))).toEqual({ beach: 5 })
    expect(loadBestStars(memoryStorage({ 'putter-golf-best-v1': 'not json' }))).toEqual({})
    expect(loadBestStars(null)).toEqual({})
  })
})
