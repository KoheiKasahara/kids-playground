import { MAX_PLAYERS, PIECES, courseById, goalIndex, type Course, type CourseId, type PieceId, type SquareEvent } from './courses'

export type Player = { piece: PieceId; computer: boolean }

export type GameState = {
  course: CourseId
  players: readonly Player[]
  positions: readonly number[]
  /** つぎの じぶんの ばんを 1かい やすむ ひと。 */
  resting: readonly boolean[]
  turn: number
  winner: number | null
}

/** 1かいの ばんで おきる ことの ぜんぶ。がめんは これを じゅんばんに みせてから next に すすむ。 */
export type TurnPlan = {
  player: number
  roll: number
  /** サイコロの かずだけ すすむ あいだに とおる マス（さいごが とまった マス）。 */
  walk: readonly number[]
  event: SquareEvent | null
  /** できごとで うごく あいだに とおる マス。ワープは とびさきの 1マスだけ。 */
  eventWalk: readonly number[]
  goal: boolean
  next: GameState
}

/** あそぶ ひとの かず（1〜4）。ひとりの ときは コンピュータの あいてを ひとり くわえる。 */
export function createPlayers(humans: number): Player[] {
  const count = Math.min(MAX_PLAYERS, Math.max(1, Math.floor(humans)))
  if (count === 1) return [{ piece: PIECES[0]!.id, computer: false }, { piece: PIECES[1]!.id, computer: true }]
  return PIECES.slice(0, count).map((piece) => ({ piece: piece.id, computer: false }))
}

export function createGame(course: CourseId, humans: number): GameState {
  const players = createPlayers(humans)
  return {
    course,
    players,
    positions: players.map(() => 0),
    resting: players.map(() => false),
    turn: 0,
    winner: null,
  }
}

export function rollDie(random: () => number = Math.random): number {
  return Math.min(6, Math.max(1, Math.floor(random() * 6) + 1))
}

function walkBetween(from: number, to: number): number[] {
  const direction = to >= from ? 1 : -1
  const path: number[] = []
  for (let square = from + direction; direction > 0 ? square <= to : square >= to; square += direction) path.push(square)
  return path
}

/** サイコロの め（1〜6）で いまの ひとを うごかす。ゴールを こえる めでも ゴールで とまる。 */
export function playTurn(state: GameState, roll: number, course: Course = courseById(state.course)): TurnPlan {
  const player = state.turn
  const goal = goalIndex(course)
  const from = state.positions[player]!
  const landed = Math.min(goal, from + roll)
  const walk = walkBetween(from, landed)
  const event = landed < goal ? course.events[landed] ?? null : null

  let final = landed
  let eventWalk: number[] = []
  if (event?.kind === 'forward') {
    final = Math.min(goal, landed + event.steps)
    eventWalk = walkBetween(landed, final)
  } else if (event?.kind === 'back') {
    final = Math.max(0, landed - event.steps)
    eventWalk = walkBetween(landed, final)
  } else if (event?.kind === 'warp') {
    final = Math.min(goal, Math.max(0, event.to))
    eventWalk = [final]
  }

  const reached = final >= goal
  const positions = state.positions.map((position, index) => (index === player ? final : position))
  const resting = state.resting.map((rest, index) => (index === player ? event?.kind === 'rest' : rest))
  const again = event?.kind === 'again'
  return {
    player,
    roll,
    walk,
    event,
    eventWalk,
    goal: reached,
    next: {
      ...state,
      positions,
      resting,
      turn: reached || again ? player : (player + 1) % state.players.length,
      winner: reached ? player : null,
    },
  }
}

/** いまの ひとが おやすみ なら、やすみを おえて つぎの ひとへ まわす。 */
export function skipRest(state: GameState): GameState {
  if (!state.resting[state.turn] || state.winner !== null) return state
  return {
    ...state,
    resting: state.resting.map((rest, index) => (index === state.turn ? false : rest)),
    turn: (state.turn + 1) % state.players.length,
  }
}

export function mustRest(state: GameState): boolean {
  return state.winner === null && Boolean(state.resting[state.turn])
}

export function remainingSquares(state: GameState, player: number, course: Course = courseById(state.course)): number {
  return Math.max(0, goalIndex(course) - state.positions[player]!)
}

export type RankEntry = { player: number; place: number }

/** ゴールした ひとが 1い。のこりは ゴールに ちかい じゅんで、おなじ マスなら おなじ くらい。 */
export function ranking(state: GameState): RankEntry[] {
  const order = state.players.map((_, index) => index).sort((a, b) => {
    if (a === state.winner) return -1
    if (b === state.winner) return 1
    return state.positions[b]! - state.positions[a]! || a - b
  })
  const entries: RankEntry[] = []
  order.forEach((player, index) => {
    const previous = entries[index - 1]
    const tied = previous && player !== state.winner && previous.player !== state.winner
      && state.positions[previous.player] === state.positions[player]
    entries.push({ player, place: tied ? previous.place : index + 1 })
  })
  return entries
}
