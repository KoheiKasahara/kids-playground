import { MAX_PLAYERS, PIECES, courseById, goalIndex, type Course, type CourseId, type PieceId, type SquareEvent } from './courses'

export type Player = { piece: PieceId; computer: boolean }

export type GameState = {
  course: CourseId
  players: readonly Player[]
  positions: readonly number[]
  /** つぎの じぶんの ばんを 1かい やすむ ひと。 */
  resting: readonly boolean[]
  /** つぎの じぶんの ばんに サイコロを 2こ ふる ひと。 */
  doubles: readonly boolean[]
  turn: number
  winner: number | null
}

/** 1かいの ばんで おきる ことの ぜんぶ。がめんは これを じゅんばんに みせてから next に すすむ。 */
export type TurnPlan = {
  player: number
  /** でた サイコロの め（1こ か 2こ）。 */
  rolls: readonly number[]
  /** でた めの ごうけい。 */
  roll: number
  /** サイコロの かずだけ すすむ あいだに とおる マス（さいごが とまった マス）。 */
  walk: readonly number[]
  /** わかれみちを とおりかかって、めが のこっていても そこで とまった。 */
  forkStop: boolean
  event: SquareEvent | null
  /** できごとで うごく あいだに とおる マス。ワープと いれかわりは とびさきの 1マスだけ。 */
  eventWalk: readonly number[]
  /** いれかわった あいて。いれかわりの マスで まえに だれも いなければ null。 */
  swapWith: number | null
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
    doubles: players.map(() => false),
    turn: 0,
    winner: null,
  }
}

export function rollDie(random: () => number = Math.random): number {
  return Math.min(6, Math.max(1, Math.floor(random() * 6) + 1))
}

/** いまの ひとが ふる サイコロ（サイコロ 2この ばんなら 2こ）。 */
export function rollDice(state: GameState, random: () => number = Math.random): number[] {
  return Array.from({ length: state.doubles[state.turn] ? 2 : 1 }, () => rollDie(random))
}

/** ワープの とびさきを くじびきで えらぶ。 */
export function drawWarp(to: readonly number[], random: () => number = Math.random): number {
  const index = Math.min(to.length - 1, Math.max(0, Math.floor(random() * to.length)))
  return to[index]!
}

/** いまの ひとが わかれみちに いれば、えらべる みち。いなければ null。 */
export function routeChoices(state: GameState, course: Course = courseById(state.course)) {
  if (state.winner !== null) return null
  return course.forks[state.positions[state.turn]!] ?? null
}

/** コンピュータが えらぶ みち（くじびき）。 */
export function drawRoute(count: number, random: () => number = Math.random): number {
  return Math.min(count - 1, Math.max(0, Math.floor(random() * count)))
}

/**
 * from から steps マス すすむ あいだに とおる マス。ゴールに ついたら とまる。
 * とちゅうで わかれみちに はいったら、めが のこっていても そこで とまる。
 * from が わかれみちなら route ばんめの みちへ すすむ。
 */
function walkForward(course: Course, from: number, steps: number, route: number): { squares: number[]; forkStop: boolean } {
  const goal = goalIndex(course)
  const squares: number[] = []
  let square = from
  for (let step = 0; step < steps && square !== goal; step++) {
    const options = course.next[square]!
    square = options.length > 1 && step === 0 ? options[route] ?? options[0]! : options[0]!
    squares.push(square)
    if (course.forks[square] && step < steps - 1) return { squares, forkStop: true }
  }
  return { squares, forkStop: false }
}

/** from から steps マス もどる あいだに とおる マス。スタートより まえへは いかない。 */
function walkBack(course: Course, from: number, steps: number): number[] {
  const squares: number[] = []
  let square = from
  for (let step = 0; step < steps && square !== 0; step++) {
    square = course.prev[square]!
    squares.push(square)
  }
  return squares
}

/** いれかわる あいて。じぶんより ゴールに ちかい なかで いちばん まえの ひと（おなじなら さきの ばんの ひと）。 */
export function swapTarget(state: GameState, player: number, square: number, course: Course = courseById(state.course)): number | null {
  let target: number | null = null
  state.positions.forEach((position, other) => {
    if (other === player || course.toGoal[position]! >= course.toGoal[square]!) return
    if (target === null || course.toGoal[position]! < course.toGoal[state.positions[target]!]!) target = other
  })
  return target
}

/**
 * サイコロの め（1こ なら 1〜6、2こ なら その ごうけい）で いまの ひとを うごかす。
 * ゴールを こえる めでも ゴールで とまる。ワープの とびさきは random で きめる。
 * わかれみちに いる ときは route ばんめの みちへ すすむ。
 */
export function playTurn(
  state: GameState,
  dice: number | readonly number[],
  course: Course = courseById(state.course),
  random: () => number = Math.random,
  route = 0,
): TurnPlan {
  const rolls = typeof dice === 'number' ? [dice] : [...dice]
  const roll = rolls.reduce((sum, value) => sum + value, 0)
  const player = state.turn
  const goal = goalIndex(course)
  const from = state.positions[player]!
  const { squares: walk, forkStop } = walkForward(course, from, roll, route)
  const landed = walk.at(-1) ?? from
  const event = landed !== goal && !course.forks[landed] ? course.events[landed] ?? null : null

  let final = landed
  let eventWalk: number[] = []
  let swapWith: number | null = null
  if (event?.kind === 'forward') {
    eventWalk = walkForward(course, landed, event.steps, 0).squares
  } else if (event?.kind === 'back') {
    eventWalk = walkBack(course, landed, event.steps)
  } else if (event?.kind === 'warp') {
    const target = drawWarp(event.to, random)
    eventWalk = [target >= 0 && target < course.length ? target : landed]
  } else if (event?.kind === 'swap') {
    swapWith = swapTarget(state, player, landed, course)
    if (swapWith !== null) eventWalk = [state.positions[swapWith]!]
  }
  final = eventWalk.at(-1) ?? landed

  const reached = final === goal
  const positions = state.positions.map((position, index) => {
    if (index === player) return final
    if (index === swapWith) return landed
    return position
  })
  const resting = state.resting.map((rest, index) => (index === player ? event?.kind === 'rest' : rest))
  const doubles = state.doubles.map((double, index) => (index === player ? event?.kind === 'double' : double))
  const again = event?.kind === 'again'
  return {
    player,
    rolls,
    roll,
    walk,
    forkStop,
    event,
    eventWalk,
    swapWith,
    goal: reached,
    next: {
      ...state,
      positions,
      resting,
      doubles,
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
  return course.toGoal[state.positions[player]!] ?? 0
}

export type RankEntry = { player: number; place: number }

/** ゴールした ひとが 1い。のこりは ゴールに ちかい じゅんで、のこりが おなじなら おなじ くらい。 */
export function ranking(state: GameState, course: Course = courseById(state.course)): RankEntry[] {
  const left = (player: number) => remainingSquares(state, player, course)
  const order = state.players.map((_, index) => index).sort((a, b) => {
    if (a === state.winner) return -1
    if (b === state.winner) return 1
    return left(a) - left(b) || a - b
  })
  const entries: RankEntry[] = []
  order.forEach((player, index) => {
    const previous = entries[index - 1]
    const tied = previous && player !== state.winner && previous.player !== state.winner && left(previous.player) === left(player)
    entries.push({ player, place: tied ? previous.place : index + 1 })
  })
  return entries
}
