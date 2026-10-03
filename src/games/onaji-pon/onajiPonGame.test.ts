import { describe, expect, test } from 'vitest'
import {
  MIN_PAR,
  STAGES,
  bestStockLeft,
  buildDeck,
  canConnect,
  cardName,
  columnsLayout,
  dealFromDeck,
  dealStage,
  drawStock,
  findStage,
  freeSlots,
  isCleared,
  isFree,
  isStuck,
  playSlot,
  playableSlots,
  pyramidLayout,
  shuffle,
  starsFor,
  topCard,
  type AnimalId,
  type Card,
  type ColorId,
  type GameState,
  type Rng,
} from './onajiPonGame'

/** たねから きまる 乱数（mulberry32）。 */
function seeded(seed: number): Rng {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let nextId = 0
function card(color: ColorId, animal: AnimalId): Card {
  nextId += 1
  return { id: `${color}-${animal}-t${nextId}`, color, animal }
}

/** はじめて（3れつ×3まい）の ばを じぶんで つくる。 */
function hajimete(tableau: Card[], pileTop: Card, stock: Card[], par = 0): GameState {
  return { stageId: 'hajimete', tableau, pile: [pileTop], stock, combo: 0, bestCombo: 0, par }
}

/** やまを めくらずに あと なんまい つなげられるか。 */
function runLength(state: GameState): number {
  let longest = 0
  for (const slot of playableSlots(state)) longest = Math.max(longest, 1 + runLength(playSlot(state, slot).state))
  return longest
}

/** その ときに いちばん ながく つなげられる じゅんばんで とる（かんがえて あそぶ子）。 */
function longestRunFirst(state: GameState): number {
  let best = { length: -1, slot: -1 }
  for (const slot of playableSlots(state)) {
    const length = 1 + runLength(playSlot(state, slot).state)
    if (length > best.length) best = { length, slot }
  }
  return best.slot
}

function playOut(start: GameState, choose: (state: GameState, playable: number[]) => number): GameState {
  let state = start
  while (!isCleared(state) && !isStuck(state)) {
    const playable = playableSlots(state)
    state = playable.length > 0 ? playSlot(state, choose(state, playable)).state : drawStock(state)
  }
  return state
}

describe('カードの よみかた・つながる ルール', () => {
  test('いろを かたちようしに して よむ', () => {
    expect(cardName({ color: 'red', animal: 'dog' })).toBe('あかい いぬ')
    expect(cardName({ color: 'yellow', animal: 'rabbit' })).toBe('きいろい うさぎ')
    expect(cardName({ color: 'green', animal: 'bear' })).toBe('みどりの くま')
  })

  test('おなじ いろ か おなじ どうぶつ なら つながる', () => {
    expect(canConnect({ color: 'red', animal: 'dog' }, { color: 'red', animal: 'cat' })).toBe(true)
    expect(canConnect({ color: 'red', animal: 'dog' }, { color: 'blue', animal: 'dog' })).toBe(true)
    expect(canConnect({ color: 'red', animal: 'dog' }, { color: 'blue', animal: 'cat' })).toBe(false)
  })
})

describe('ならびかた', () => {
  test('たての れつは、いちばん したの カードだけが うえに なにも ない', () => {
    const slots = columnsLayout(2, 3)
    expect(slots).toHaveLength(6)
    expect(slots.map((slot) => slot.coveredBy)).toEqual([[1], [2], [], [4], [5], []])
  })

  test('おやまは したの だんの 2まいが うえの 1まいに かさなる', () => {
    const slots = pyramidLayout(5)
    expect(slots).toHaveLength(15)
    expect(slots[0]!.coveredBy).toEqual([1, 2])
    expect(slots[4]!.coveredBy).toEqual([7, 8])
    expect(slots.filter((slot) => slot.coveredBy.length === 0)).toHaveLength(5)
    // かさなる おきばは かならず したの だん（あとの ばんごう）にある。
    slots.forEach((slot, index) => slot.coveredBy.forEach((cover) => expect(cover).toBeGreaterThan(index)))
  })

  test('どの ステージも、ばの カード・まんなかの 1まい・やまを くばれるだけの カードが ある', () => {
    for (const stage of STAGES) {
      const deck = buildDeck(stage)
      expect(new Set(deck.map((item) => item.id)).size).toBe(deck.length)
      expect(deck.length).toBeGreaterThanOrEqual(stage.slots.length + 1 + stage.stockSize)
    }
  })
})

describe('あそびの すすみかた', () => {
  const tableau = [
    card('blue', 'cat'),
    card('blue', 'rabbit'),
    card('red', 'cat'), // 0れつめの いちばん した
    card('yellow', 'cat'),
    card('yellow', 'rabbit'),
    card('blue', 'rabbit'), // 1れつめの いちばん した
    card('red', 'rabbit'),
    card('blue', 'rabbit'),
    card('yellow', 'dog'), // 2れつめの いちばん した
  ]

  test('さいしょは いちばん したの カードだけ とれる', () => {
    const state = hajimete(tableau, card('red', 'dog'), [card('blue', 'cat')])
    expect(freeSlots(state)).toEqual([2, 5, 8])
    expect(playableSlots(state)).toEqual([2, 8])
  })

  test('つなぐと まんなかに のり、うえの カードが とれるように なって、つづけた かずが ふえる', () => {
    const state = hajimete(tableau, card('red', 'dog'), [card('blue', 'cat')])
    const result = playSlot(state, 2)
    expect(result.ok).toBe(true)
    expect(topCard(result.state)).toBe(tableau[2])
    expect(result.state.tableau[2]).toBeNull()
    expect(result.freed).toEqual([1])
    expect(isFree(result.state, 1)).toBe(true)
    expect(result.state.combo).toBe(1)

    const second = playSlot(result.state, 1) // あかい ねこ → あおい うさぎ は つながらない
    expect(second.ok).toBe(false)
    expect(second.state).toBe(result.state)
    const third = playSlot(result.state, 8) // あかい ねこ → きいろい いぬ も つながらない
    expect(third.ok).toBe(false)
  })

  test('うえに カードが のっている カードや、つながらない カードは とれない', () => {
    const state = hajimete(tableau, card('red', 'dog'), [])
    expect(playSlot(state, 0).ok).toBe(false)
    expect(playSlot(state, 5).ok).toBe(false)
  })

  test('やまを めくると まんなかが かわり、つづけた かずは 0に もどる', () => {
    const drawn = card('blue', 'cat')
    const start = playSlot(hajimete(tableau, card('red', 'dog'), [drawn, card('red', 'bear')]), 2).state
    const next = drawStock(start)
    expect(topCard(next)).toBe(drawn)
    expect(next.stock).toHaveLength(1)
    expect(next.combo).toBe(0)
    expect(next.bestCombo).toBe(1)
    expect(drawStock({ ...next, stock: [] }).pile).toHaveLength(next.pile.length)
  })

  test('やまが なく、つなげる カードも なければ おしまい', () => {
    const stuck = hajimete(tableau, card('green', 'bear'), [])
    expect(isStuck(stuck)).toBe(true)
    expect(isStuck({ ...stuck, stock: [card('red', 'cat')] })).toBe(false)
  })

  test('ぜんぶ とると クリア', () => {
    const allRed = Array.from({ length: 9 }, (_, index) => card('red', (['dog', 'cat', 'rabbit'] as const)[index % 3]))
    const cleared = playOut(hajimete(allRed, card('red', 'bear'), [card('blue', 'dog')]), (_, playable) => playable[0]!)
    expect(isCleared(cleared)).toBe(true)
    expect(cleared.stock).toHaveLength(1)
    expect(cleared.bestCombo).toBe(9)
  })
})

describe('いちばん うまい とりかた', () => {
  test('ぜんぶ つながるなら やまを ぜんぶ のこせる', () => {
    const allRed = Array.from({ length: 9 }, () => card('red', 'cat'))
    expect(bestStockLeft(hajimete(allRed, card('red', 'dog'), [card('blue', 'dog'), card('green', 'bear')]))).toBe(2)
  })

  test('どう とっても つなげられなければ -1', () => {
    const blueCats = Array.from({ length: 9 }, () => card('blue', 'cat'))
    expect(bestStockLeft(hajimete(blueCats, card('red', 'dog'), [card('yellow', 'rabbit')]))).toBe(-1)
  })

  test('やまを 1まい めくれば つながるなら、のこりは 1まい へる', () => {
    const blueCats = Array.from({ length: 9 }, () => card('blue', 'cat'))
    expect(bestStockLeft(hajimete(blueCats, card('red', 'dog'), [card('blue', 'dog'), card('red', 'bear')]))).toBe(1)
  })
})

describe('くばりかた', () => {
  test('くばるたびに ちがう ならびに なる（ランダム）', () => {
    const first = dealStage('narabi', seeded(1))
    const second = dealStage('narabi', seeded(2))
    expect(first.tableau.map((item) => item?.id)).not.toEqual(second.tableau.map((item) => item?.id))
  })

  test.each(STAGES.map((stage) => stage.id))('%s: さいしょから つなげられて、うまく とれば かならず クリアできる', (stageId) => {
    const stage = findStage(stageId)!
    for (let seed = 1; seed <= 12; seed += 1) {
      const state = dealStage(stageId, seeded(seed))
      expect(state.tableau).toHaveLength(stage.slots.length)
      expect(state.stock).toHaveLength(stage.stockSize)
      expect(state.pile).toHaveLength(1)
      expect(playableSlots(state).length).toBeGreaterThan(0)
      expect(state.par).toBeGreaterThanOrEqual(MIN_PAR)
      expect(bestStockLeft(state)).toBe(state.par)
    }
  })

  test('乱数が かたよっていても かならず くばれる', () => {
    const state = dealStage('oyama', () => 0)
    expect(state.tableau.every((item) => item !== null)).toBe(true)
    expect(state.par).toBeGreaterThanOrEqual(0)
  })

  test('かんがえて とると、てきとうに とるより ★3（いちばん うまい とりかた）に とどきやすい', () => {
    const rng = seeded(99)
    let thoughtful = 0
    let random = 0
    const games = 40
    for (let i = 0; i < games; i += 1) {
      const state = dealStage('narabi', rng)
      const smart = playOut(state, (current) => longestRunFirst(current))
      const lucky = playOut(state, (_, playable) => playable[Math.floor(rng() * playable.length)]!)
      if (isCleared(smart) && starsFor(smart.stock.length, state.par) === 3) thoughtful += 1
      if (isCleared(lucky) && starsFor(lucky.stock.length, state.par) === 3) random += 1
    }
    expect(thoughtful).toBeGreaterThan(random * 2)
  })
})

describe('★', () => {
  test('いちばん うまい とりかたと おなじなら ★3、2まい いないの ちがいなら ★2', () => {
    expect(starsFor(3, 3)).toBe(3)
    expect(starsFor(4, 3)).toBe(3)
    expect(starsFor(2, 3)).toBe(2)
    expect(starsFor(1, 3)).toBe(2)
    expect(starsFor(0, 3)).toBe(1)
  })
})

describe('shuffle', () => {
  test('もとの はいれつを かえず、おなじ ものを ならべかえる', () => {
    const items = [1, 2, 3, 4, 5]
    const shuffled = shuffle(items, seeded(3))
    expect(items).toEqual([1, 2, 3, 4, 5])
    expect([...shuffled].sort()).toEqual(items)
  })

  test('dealFromDeck は まえから ばの カード・まんなか・やまの じゅんに くばる', () => {
    const stage = findStage('hajimete')!
    const deck = buildDeck(stage)
    const state = dealFromDeck(stage, deck)
    expect(state.tableau).toEqual(deck.slice(0, 9))
    expect(state.pile).toEqual([deck[9]])
    expect(state.stock).toEqual(deck.slice(10, 14))
  })
})
