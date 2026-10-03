/**
 * おなじで ポン！ の純粋ロジック。
 * ばに ならんだ カードから、まんなかの カードと「おなじ いろ」か「おなじ どうぶつ」の カードを
 * つぎつぎ つなげていく ひとり あそび（トライピークス に ちかい ルール）。
 * くばりかたは まいかい ランダムだが、とる じゅんばんを かんがえると のこせる やまの まいすうが かわる。
 * 画面・タイマーは持たず、乱数関数を引数で受け取る（テストでは固定の乱数を渡す）。
 */

export type Rng = () => number

export type ColorId = 'red' | 'blue' | 'yellow' | 'green'
export type AnimalId = 'dog' | 'cat' | 'rabbit' | 'bear'

export type ColorDef = {
  name: string
  /** どうぶつの かおの いろ。 */
  fill: string
  /** ふちどり・みみの いろ。 */
  dark: string
  /** カードの したじの いろ。 */
  light: string
}

export const COLORS: Record<ColorId, ColorDef> = {
  red: { name: 'あか', fill: '#ff6b6b', dark: '#c92a2a', light: '#fff0f0' },
  blue: { name: 'あお', fill: '#4dabf7', dark: '#1864ab', light: '#e7f5ff' },
  yellow: { name: 'きいろ', fill: '#ffd43b', dark: '#e67700', light: '#fff9db' },
  green: { name: 'みどり', fill: '#69db7c', dark: '#2b8a3e', light: '#ebfbee' },
}

export const ANIMALS: Record<AnimalId, { name: string }> = {
  dog: { name: 'いぬ' },
  cat: { name: 'ねこ' },
  rabbit: { name: 'うさぎ' },
  bear: { name: 'くま' },
}

export type Card = {
  id: string
  color: ColorId
  animal: AnimalId
}

/** 「あかい いぬ」のような よみかた。 */
export function cardName(card: Pick<Card, 'color' | 'animal'>): string {
  const color = COLORS[card.color].name
  // 「あか」→「あかい」のように いろを かたちようしに する（みどりは「みどりの」）。
  const adjective = card.color === 'green' ? `${color}の` : `${color}い`
  return `${adjective} ${ANIMALS[card.animal].name}`
}

/** つながる ＝ おなじ いろ か おなじ どうぶつ。 */
export function canConnect(a: Pick<Card, 'color' | 'animal'>, b: Pick<Card, 'color' | 'animal'>): boolean {
  return a.color === b.color || a.animal === b.animal
}

/** ばの カードの おきば。x・y は カード1まいぶんを 1と した いち。 */
export type Slot = {
  x: number
  y: number
  /** この おきばに かさなっている（うえに のっている）おきば。ぜんぶ なくなると とれる。 */
  coveredBy: number[]
}

/** たてに かさねた れつ。いちばん したの カードから とれる。 */
export function columnsLayout(columns: number, depth: number, overlap = 0.34): Slot[] {
  const slots: Slot[] = []
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < depth; row += 1) {
      const index = column * depth + row
      slots.push({ x: column, y: row * overlap, coveredBy: row < depth - 1 ? [index + 1] : [] })
    }
  }
  return slots
}

/** さんかくの おやま。したの だんの 2まいが うえの 1まいに かさなる。 */
export function pyramidLayout(rows: number, overlap = 0.5): Slot[] {
  const rowStart = (row: number) => (row * (row + 1)) / 2
  const slots: Slot[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let i = 0; i <= row; i += 1) {
      const below = rowStart(row + 1)
      slots.push({
        x: (rows - 1 - row) / 2 + i,
        y: row * overlap,
        coveredBy: row < rows - 1 ? [below + i, below + i + 1] : [],
      })
    }
  }
  return slots
}

export type StageId = 'hajimete' | 'narabi' | 'oyama'

export type Stage = {
  id: StageId
  name: string
  hint: string
  colors: readonly ColorId[]
  animals: readonly AnimalId[]
  /** おなじ カードを なんまいずつ いれるか。 */
  copies: number
  slots: readonly Slot[]
  stockSize: number
}

const ALL_COLORS: readonly ColorId[] = ['red', 'blue', 'yellow', 'green']
const ALL_ANIMALS: readonly AnimalId[] = ['dog', 'cat', 'rabbit', 'bear']

export const STAGES: readonly Stage[] = [
  {
    id: 'hajimete',
    name: 'はじめて',
    hint: '3いろ・3どうぶつ',
    colors: ['red', 'blue', 'yellow'],
    animals: ['dog', 'cat', 'rabbit'],
    copies: 2,
    slots: columnsLayout(3, 3),
    stockSize: 4,
  },
  {
    id: 'narabi',
    name: 'ならんで',
    hint: '4いろ・4どうぶつ',
    colors: ALL_COLORS,
    animals: ALL_ANIMALS,
    copies: 2,
    slots: columnsLayout(4, 3),
    stockSize: 5,
  },
  {
    id: 'oyama',
    name: 'おやま',
    hint: 'さんかくの やま',
    colors: ALL_COLORS,
    animals: ALL_ANIMALS,
    copies: 2,
    slots: pyramidLayout(5),
    stockSize: 7,
  },
]

export function findStage(id: string): Stage | undefined {
  return STAGES.find((stage) => stage.id === id)
}

export function buildDeck(stage: Stage): Card[] {
  const cards: Card[] = []
  for (const color of stage.colors) {
    for (const animal of stage.animals) {
      for (let copy = 0; copy < stage.copies; copy += 1) cards.push({ id: `${color}-${animal}-${copy}`, color, animal })
    }
  }
  return cards
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

export type GameState = {
  stageId: StageId
  /** ばの カード。とった おきばは null。 */
  tableau: (Card | null)[]
  /** やま。まえから めくる。 */
  stock: Card[]
  /** まんなかに つんだ カード。さいごが いちばん うえ。 */
  pile: Card[]
  /** やまを めくらずに つづけて つないだ かず。 */
  combo: number
  bestCombo: number
  /**
   * この くばりかたで いちばん うまく とったときに のこせる やまの まいすう。
   * ★は これと くらべて きめるので、くばりかたの うんで ★が かわりにくい。
   */
  par: number
}

function stageOf(state: GameState): Stage {
  return findStage(state.stageId)!
}

export function topCard(state: GameState): Card {
  return state.pile[state.pile.length - 1]!
}

/** うえに なにも のっていない（とれる）おきばか。 */
export function isFree(state: GameState, slot: number): boolean {
  const slots = stageOf(state).slots
  return state.tableau[slot] !== null && slots[slot]!.coveredBy.every((cover) => state.tableau[cover] === null)
}

export function freeSlots(state: GameState): number[] {
  return state.tableau.flatMap((_, slot) => (isFree(state, slot) ? [slot] : []))
}

/** いま まんなかに つなげられる おきば。 */
export function playableSlots(state: GameState): number[] {
  const top = topCard(state)
  return freeSlots(state).filter((slot) => canConnect(state.tableau[slot]!, top))
}

export function remainingCount(state: GameState): number {
  return state.tableau.filter((card) => card !== null).length
}

export function isCleared(state: GameState): boolean {
  return remainingCount(state) === 0
}

/** やまも なく、つなげる カードも ない（おしまい）。 */
export function isStuck(state: GameState): boolean {
  return !isCleared(state) && state.stock.length === 0 && playableSlots(state).length === 0
}

export type PlayResult = {
  state: GameState
  ok: boolean
  /** この 1まいで あたらしく とれるように なった おきば。 */
  freed: number[]
}

export function playSlot(state: GameState, slot: number): PlayResult {
  const card = state.tableau[slot]
  if (!card || !isFree(state, slot) || !canConnect(card, topCard(state))) return { state, ok: false, freed: [] }
  const freeBefore = new Set(freeSlots(state))
  const tableau = state.tableau.map((current, index) => (index === slot ? null : current))
  const combo = state.combo + 1
  const next: GameState = {
    ...state,
    tableau,
    pile: [...state.pile, card],
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
  }
  const freed = freeSlots(next).filter((index) => !freeBefore.has(index))
  return { state: next, ok: true, freed }
}

/** やまから 1まい めくって まんなかに のせる。つづけた かずは もどる。 */
export function drawStock(state: GameState): GameState {
  const [card, ...rest] = state.stock
  if (!card) return state
  return { ...state, stock: rest, pile: [...state.pile, card], combo: 0 }
}

/**
 * クリアしたときの ★。いちばん うまい とりかた（par）と おなじだけ やまを のこせたら ★3。
 * 2まい いないの ちがいなら ★2、それより すくなくても クリアできたら ★1。
 */
export function starsFor(stockLeft: number, par: number): 1 | 2 | 3 {
  if (stockLeft >= par) return 3
  if (stockLeft >= par - 2) return 2
  return 1
}

/** こどもが すこし まちがえても クリアできるよう、うまく とれば これだけ やまが のこる くばりかたに する。 */
export const MIN_PAR = 2

const SOLVER_NODE_LIMIT = 200_000

/**
 * いまの じょうたいから、うまく とれば やまを なんまい のこして クリアできるか。
 * クリアできなければ -1、しらべきれなければ null。
 */
export function bestStockLeft(state: GameState, nodeLimit = SOLVER_NODE_LIMIT): number | null {
  const slots = stageOf(state).slots
  const cards = state.tableau
  const stock = state.stock
  let startMask = 0
  cards.forEach((card, index) => {
    if (card === null) startMask |= 1 << index
  })
  const full = (1 << cards.length) - 1
  const memo = new Map<string, number>()
  let nodes = 0

  const search = (mask: number, stockIndex: number, top: Card): number => {
    const left = stock.length - stockIndex
    if (mask === full) return left
    const key = `${mask}|${stockIndex}|${top.color}${top.animal}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    nodes += 1
    if (nodes > nodeLimit) throw new SolverLimit()
    let best = -1
    for (let slot = 0; slot < cards.length && best < left; slot += 1) {
      if (mask & (1 << slot)) continue
      if (!slots[slot]!.coveredBy.every((cover) => mask & (1 << cover))) continue
      const card = cards[slot]!
      if (!canConnect(card, top)) continue
      best = Math.max(best, search(mask | (1 << slot), stockIndex, card))
    }
    if (best < left - 1 && stockIndex < stock.length) best = Math.max(best, search(mask, stockIndex + 1, stock[stockIndex]!))
    memo.set(key, best)
    return best
  }

  try {
    return search(startMask, 0, topCard(state))
  } catch (error) {
    if (error instanceof SolverLimit) return null
    throw error
  }
}

class SolverLimit extends Error {}

/** カードを くばって あそびはじめる じょうたいを つくる（そのままで まだ 1まいも つないでいない）。 */
export function dealFromDeck(stage: Stage, deck: readonly Card[]): GameState {
  const slotCount = stage.slots.length
  return {
    stageId: stage.id,
    tableau: deck.slice(0, slotCount),
    pile: [deck[slotCount]!],
    stock: deck.slice(slotCount + 1, slotCount + 1 + stage.stockSize),
    combo: 0,
    bestCombo: 0,
    par: 0,
  }
}

const MAX_DEAL_ATTEMPTS = 80

/**
 * ランダムに くばる。ただし、こどもが こまらないように
 * 「さいしょから 1まいは つなげられる」「うまく とれば やまを MIN_PAR まい いじょう のこして クリアできる」
 * くばりかただけを えらぶ（かならず とける）。
 */
export function dealStage(stageId: StageId, rng: Rng): GameState {
  const stage = findStage(stageId)!
  const deck = buildDeck(stage)
  let fallback: GameState | null = null
  for (let attempt = 0; attempt < MAX_DEAL_ATTEMPTS; attempt += 1) {
    const state = dealFromDeck(stage, shuffle(deck, rng))
    if (playableSlots(state).length === 0) continue
    const par = bestStockLeft(state)
    if (par === null || par < 0) continue
    if (par >= MIN_PAR) return { ...state, par }
    fallback ??= { ...state, par }
  }
  // ここに くるのは 乱数が ひどく かたよったときだけ。とける ものが なければ やまを ふやして かならず おわれるようにする。
  return fallback ?? { ...dealFromDeck(stage, deck), stock: deck.slice(stage.slots.length + 1), par: 0 }
}
