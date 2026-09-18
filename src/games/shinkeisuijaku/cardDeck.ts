// しんけいすいじゃくの純粋ロジック（山札の生成・シャッフル・完成判定）。
// 物理・DOM状態を一切持たないため、UIを描画せずにテストできる。

export type ShinkeisuijakuDifficulty = 'easy' | 'hard'

/** むずかしさごとのペア数。 */
export const DIFFICULTY_PAIR_COUNT: Record<ShinkeisuijakuDifficulty, number> = {
  easy: 6,
  hard: 8,
}

/** カードの絵柄。動物の名前を添えて読み上げ・aria-labelにも使えるようにする。 */
export const CARD_SYMBOLS: readonly { symbol: string; name: string }[] = [
  { symbol: '🐶', name: 'いぬ' },
  { symbol: '🐱', name: 'ねこ' },
  { symbol: '🐰', name: 'うさぎ' },
  { symbol: '🐻', name: 'くま' },
  { symbol: '🐼', name: 'パンダ' },
  { symbol: '🐨', name: 'コアラ' },
  { symbol: '🐯', name: 'とら' },
  { symbol: '🦁', name: 'ライオン' },
]

export type CardStatus = 'hidden' | 'revealed' | 'matched'

export type MemoryCard = {
  id: string
  symbol: string
  name: string
  status: CardStatus
}

/** Fisher–Yates シャッフル。randomFnを注入できるようにして、テストで決定的に検証する。 */
export function shuffle<T>(items: readonly T[], randomFn: () => number = Math.random): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFn() * (index + 1))
    const current = result[index]!
    result[index] = result[swapIndex]!
    result[swapIndex] = current
  }
  return result
}

/** むずかしさに応じたペア数ぶんの絵柄を2枚ずつ並べ、シャッフルした山札を作る。 */
export function createShuffledDeck(
  difficulty: ShinkeisuijakuDifficulty,
  randomFn: () => number = Math.random,
): MemoryCard[] {
  const pairCount = DIFFICULTY_PAIR_COUNT[difficulty]
  const pairedCards = CARD_SYMBOLS.slice(0, pairCount).flatMap(({ symbol, name }) => [
    { symbol, name },
    { symbol, name },
  ])
  return shuffle(pairedCards, randomFn).map((card, index) => ({
    id: `card-${index}`,
    symbol: card.symbol,
    name: card.name,
    status: 'hidden' as const,
  }))
}

/** 全カードが揃ったかどうか。空の山札（未開始）は完成として扱わない。 */
export function isDeckComplete(cards: readonly MemoryCard[]): boolean {
  return cards.length > 0 && cards.every((card) => card.status === 'matched')
}

/** そろったペアの数。結果表示（"みつけた ペア: X / N"）に使う。 */
export function countMatchedPairs(cards: readonly MemoryCard[]): number {
  return cards.filter((card) => card.status === 'matched').length / 2
}
