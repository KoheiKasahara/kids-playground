import { describe, expect, test } from 'vitest'
import {
  DIFFICULTY_PAIR_COUNT,
  countMatchedPairs,
  createShuffledDeck,
  isDeckComplete,
  shuffle,
  type MemoryCard,
} from './cardDeck'
import { THEMES, THEME_ORDER, type ShinkeisuijakuTheme } from './cardFaces'

const themes = Object.keys(THEMES) as ShinkeisuijakuTheme[]

describe('shuffle', () => {
  test('randomFnを固定すると、Fisher-Yatesの手順どおりの決定的な並びになる', () => {
    // index=3: swapIndex=0 → [4,2,3,1] / index=2: swapIndex=0 → [3,2,4,1] / index=1: swapIndex=0 → [2,3,4,1]
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1])
  })

  test('要素数・中身は変わらず、参照元の配列は書き換えない', () => {
    const source = [1, 2, 3, 4, 5]
    const result = shuffle(source, () => 0.5)
    expect(result).toHaveLength(source.length)
    expect([...result].sort()).toEqual([...source].sort())
    expect(source).toEqual([1, 2, 3, 4, 5])
  })

  test('空配列を渡しても空配列を返す', () => {
    expect(shuffle([], () => 0.5)).toEqual([])
  })
})

describe('createShuffledDeck', () => {
  test.each(['easy', 'hard'] as const)('%sは、むずかしさどおりのペア数×2枚を返す', (difficulty) => {
    const deck = createShuffledDeck('animal', difficulty, () => 0.5)
    expect(deck).toHaveLength(DIFFICULTY_PAIR_COUNT[difficulty] * 2)
  })

  test.each(themes)('%sでも、各絵柄がちょうど2枚ずつ含まれる', (theme) => {
    const deck = createShuffledDeck(theme, 'hard', () => 0.3)
    const counts = new Map<string, number>()
    for (const card of deck) {
      counts.set(card.face.id, (counts.get(card.face.id) ?? 0) + 1)
    }
    expect(counts.size).toBe(DIFFICULTY_PAIR_COUNT.hard)
    for (const count of counts.values()) {
      expect(count).toBe(2)
    }
  })

  test.each(themes)('%sは、そのテーマの絵柄だけで山札を作る', (theme) => {
    const deck = createShuffledDeck(theme, 'hard', () => 0.4)
    const faceIds = new Set(THEMES[theme].faces.map((face) => face.id))
    for (const card of deck) {
      expect(faceIds.has(card.face.id)).toBe(true)
    }
  })

  test('テーマが違えば絵柄も入れ替わる', () => {
    const animalIds = new Set(createShuffledDeck('animal', 'easy', () => 0.5).map((card) => card.face.id))
    const flagIds = new Set(createShuffledDeck('flag', 'easy', () => 0.5).map((card) => card.face.id))
    for (const id of flagIds) {
      expect(animalIds.has(id)).toBe(false)
    }
  })

  test('idが重複しない', () => {
    const deck = createShuffledDeck('animal', 'easy', () => 0.1)
    expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length)
  })

  test('生成直後は全カードがhidden', () => {
    const deck = createShuffledDeck('number', 'easy', () => 0.7)
    expect(deck.every((card) => card.status === 'hidden')).toBe(true)
  })

  test.each(THEME_ORDER)('%sのペア数は、そのテーマの絵柄の種類数を超えない', (theme) => {
    expect(DIFFICULTY_PAIR_COUNT.hard).toBeLessThanOrEqual(THEMES[theme].faces.length)
  })
})

describe('isDeckComplete', () => {
  function makeCards(statuses: MemoryCard['status'][]): MemoryCard[] {
    return statuses.map((status, index) => ({
      id: `card-${index}`,
      face: { id: 'dog', name: 'いぬ', symbol: '🐶' },
      status,
    }))
  }

  test('空の山札は未完成として扱う', () => {
    expect(isDeckComplete([])).toBe(false)
  })

  test('1枚でもhidden/revealedが残っていれば未完成', () => {
    expect(isDeckComplete(makeCards(['matched', 'hidden']))).toBe(false)
    expect(isDeckComplete(makeCards(['matched', 'revealed']))).toBe(false)
  })

  test('全カードがmatchedなら完成', () => {
    expect(isDeckComplete(makeCards(['matched', 'matched', 'matched']))).toBe(true)
  })
})

describe('countMatchedPairs', () => {
  test('matchedのカード枚数の半分を返す', () => {
    const deck = createShuffledDeck('animal', 'easy', () => 0.2).map((card, index) => ({
      ...card,
      status: index < 4 ? ('matched' as const) : card.status,
    }))
    expect(countMatchedPairs(deck)).toBe(2)
  })

  test('matchedが無ければ0', () => {
    const deck = createShuffledDeck('animal', 'easy', () => 0.2)
    expect(countMatchedPairs(deck)).toBe(0)
  })
})
