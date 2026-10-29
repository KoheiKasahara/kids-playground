export const COLUMNS = 5
export const ROWS = 6
export const GOAL = 5

export type Jelly = { id: number; tier: number; col: number; row: number }
export type JellyGame = {
  pieces: Jelly[]
  score: number
  current: number
  next: number[]
  seed: number
  nextId: number
  turn: number
  status: 'playing' | 'won' | 'full'
}
export type JellyFrame = {
  pieces: Jelly[]
  kind: 'spawn' | 'drop' | 'land' | 'pull' | 'merge' | 'fall'
  duration: number
  focus: Jelly
  affected: number[]
  chain: number
  score: number
}
export type JellyTurn = { frames: JellyFrame[]; result: JellyGame }

function draw(seed: number): [number, number] {
  let value = seed || 1
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  return [(value >>> 0) % 5 < 3 ? 1 : 2, value >>> 0]
}

export function createJellyGame(seed = Date.now()): JellyGame {
  const columns = [[1], [2], [1], [2], [1]]
  let id = 0
  return {
    pieces: columns.flatMap((column, col) => column.map((tier, row) => ({ id: id++, tier, col, row }))),
    score: 0, current: 1, next: [2, 1], seed: seed >>> 0 || 1, nextId: id, turn: 0, status: 'playing',
  }
}

export function landingRow(pieces: readonly Jelly[], col: number): number {
  return pieces.filter((piece) => piece.col === col).length
}

export function columnAt(clientX: number, left: number, width: number): number {
  if (!Number.isFinite(clientX) || !Number.isFinite(width) || width <= 0) return 2
  return Math.max(0, Math.min(COLUMNS - 1, Math.floor((clientX - left) / width * COLUMNS)))
}

function settle(pieces: Jelly[]): Jelly[] {
  return Array.from({ length: COLUMNS }, (_, col) => pieces.filter((piece) => piece.col === col)
    .sort((a, b) => a.row - b.row).map((piece, row) => ({ ...piece, row }))).flat()
}

function neighbor(pieces: Jelly[], target: Jelly): Jelly | undefined {
  return pieces.filter((piece) => piece.id !== target.id && piece.tier === target.tier &&
    Math.abs(piece.col - target.col) + Math.abs(piece.row - target.row) === 1)
    .sort((a, b) => a.row - b.row || a.col - b.col)[0]
}

/** Resolve before animating: each frame owns its snapshot, so undo/cancellation cannot mutate a turn. */
export function planJellyDrop(game: JellyGame, col: number): JellyTurn | null {
  if (game.status !== 'playing' || !Number.isInteger(col) || col < 0 || col >= COLUMNS) return null
  const row = landingRow(game.pieces, col)
  if (row >= ROWS - 1) return null
  const frames: JellyFrame[] = []
  let pieces = game.pieces.map((piece) => ({ ...piece }))
  let target: Jelly = { id: game.nextId, tier: game.current, col, row }
  let chain = 0
  let score = game.score
  const frame = (kind: JellyFrame['kind'], duration: number, affected: number[] = [target.id]) => {
    frames.push({ pieces: pieces.map((piece) => ({ ...piece })), kind, duration,
      focus: { ...target }, affected, chain, score })
  }
  pieces.push({ ...target, row: ROWS })
  frame('spawn', 32)
  pieces = pieces.map((piece) => piece.id === target.id ? target : piece)
  frame('drop', 300)
  frame('land', 220)
  while (true) {
    let partner = neighbor(pieces, target)
    if (!partner) {
      // Gravity can also bring other pairs together. Resolve those after the dropped jelly's chain.
      const other = [...pieces].sort((a, b) => a.row - b.row || a.col - b.col)
        .find((piece) => piece.tier < GOAL && neighbor(pieces, piece))
      if (!other) break
      target = other
      partner = neighbor(pieces, target)!
    }
    const remaining = pieces.filter((piece) => piece.id !== partner.id)
    pieces = pieces.map((piece) => piece.id === partner.id ? { ...piece, col: target.col, row: target.row } : piece)
    frame('pull', 150, [target.id, partner.id])
    chain += 1
    target = { ...target, tier: target.tier + 1 }
    score += 2 ** (target.tier - 1) * 10 * chain
    pieces = remaining.map((piece) => piece.id === target.id ? target : piece)
    frame('merge', 400)
    const unsettled = pieces
    pieces = settle(pieces)
    target = pieces.find((piece) => piece.id === target.id)!
    const falling = pieces.filter((piece) => unsettled.find((before) => before.id === piece.id)!.row !== piece.row)
    if (falling.length) frame('fall', 230, falling.map((piece) => piece.id))
    if (target.tier === GOAL) break
  }
  const won = pieces.some((piece) => piece.tier === GOAL)
  const [upcoming, seed] = draw(game.seed)
  return { frames, result: {
    ...game, pieces, score, seed, current: game.next[0], next: [game.next[1], upcoming],
    nextId: game.nextId + 1, turn: game.turn + 1,
    status: won ? 'won' : pieces.some((piece) => piece.row >= ROWS - 2) ? 'full' : 'playing',
  } }
}
