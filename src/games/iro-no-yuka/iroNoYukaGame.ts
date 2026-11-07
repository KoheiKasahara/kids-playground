/**
 * のこれ！いろのゆか の進行ロジック（画面を持たない純粋関数）。
 *
 * かんばんに出た いろの ゆかへ はしり、時間ぎれで ほかの いろの ゆかが 水へ しずむ。
 * しずむ ゆかに いた なかまは ハートを 1つ なくし、0こで おしまい。さいごまで のこった なかまが 1い。
 * 乱数は呼出元から受け取り、テストでは決め打ちできるようにする。
 */

/** ゆかの ならび。画面の形にあわせて、みじかい辺を 5まい、ながい辺を 5〜9まいに する。 */
export type Board = { cols: number; rows: number }

export const BOARD_SHORT = 5
export const BOARD_LONG_MAX = 9
export const DEFAULT_BOARD: Board = { cols: BOARD_SHORT, rows: BOARD_SHORT }
/** おだいの ゆかの数は、5×5 の ときを きじゅんに ゆかの多さに あわせて ふやす。 */
const BASE_TILE_COUNT = BOARD_SHORT * BOARD_SHORT

/** フィールドに つかえる はば・たかさ[px]から、いちばん大きく見える ならびを えらぶ。 */
export function boardFor(width: number, height: number): Board {
  if (!(width > 0) || !(height > 0)) return DEFAULT_BOARD
  const long = (ratio: number) => clamp(Math.floor(BOARD_SHORT * ratio + 0.2), BOARD_SHORT, BOARD_LONG_MAX)
  return height >= width ? { cols: BOARD_SHORT, rows: long(height / width) } : { cols: long(width / height), rows: BOARD_SHORT }
}

export const tileCount = (board: Board): number => board.cols * board.rows

export type YukaColor = { id: string; name: string; color: string; symbol: string }

/** 色だけに頼らないよう、色ごとに形の記号も持つ。 */
export const YUKA_COLORS: readonly YukaColor[] = [
  { id: 'red', name: 'あか', color: '#ef5350', symbol: '●' },
  { id: 'blue', name: 'あお', color: '#3b8eea', symbol: '▲' },
  { id: 'yellow', name: 'きいろ', color: '#f9c62b', symbol: '★' },
  { id: 'green', name: 'みどり', color: '#43b05c', symbol: '■' },
]

export type RunnerId = 'me' | 'inu' | 'neko' | 'kuma'
export type RunnerDef = { id: RunnerId; name: string; emoji: string; cpu: boolean }

export const RUNNERS: readonly RunnerDef[] = [
  { id: 'me', name: 'きみ', emoji: '🐥', cpu: false },
  { id: 'inu', name: 'いぬ', emoji: '🐶', cpu: true },
  { id: 'neko', name: 'ねこ', emoji: '🐱', cpu: true },
  { id: 'kuma', name: 'くま', emoji: '🐻', cpu: true },
]

/** はじめに たつ ゆか（列, 段）。まんなかを かこむ 4すみに、きみ・いぬ・ねこ・くま の順で おく。 */
function startSpots(board: Board): [number, number][] {
  const left = Math.floor((board.cols - 1) / 2) - 1
  const right = Math.ceil((board.cols - 1) / 2) + 1
  const top = Math.floor((board.rows - 1) / 2) - 1
  const bottom = Math.ceil((board.rows - 1) / 2) + 1
  return [[left, bottom], [right, top], [left, top], [right, bottom]]
}

export type Difficulty = 'easy' | 'hard'

export type DifficultySettings = {
  lives: number
  /** かんばんが出てから ゆかが しずむまで[ms]。ラウンドごとに短くなる。 */
  callStartMs: number
  callMinMs: number
  callStepMs: number
  /** おだいの いろの ゆかの数。ラウンドが進むと へる。 */
  safeStart: number
  safeMin: number
  /** はしる はやさ[ゆか/秒]。 */
  playerSpeed: number
  cpuSpeed: number
  /** あいてが かんばんを見て うごきだすまで[ms]。 */
  cpuReactMinMs: number
  cpuReactMaxMs: number
  /** あいてが まちがえる・まよう確率。ラウンドごとに上がる。 */
  cpuMissBase: number
  cpuMissPerRound: number
  cpuMissMax: number
  /** かんばんが とちゅうで かわる「フェイント」が はじまるラウンドと確率。 */
  fakeFromRound: number
  fakeChance: number
}

export const DIFFICULTY_SETTINGS: Readonly<Record<Difficulty, DifficultySettings>> = {
  easy: {
    lives: 3,
    callStartMs: 3600,
    callMinMs: 2000,
    callStepMs: 140,
    safeStart: 6,
    safeMin: 3,
    playerSpeed: 4,
    cpuSpeed: 2.6,
    cpuReactMinMs: 700,
    cpuReactMaxMs: 1300,
    cpuMissBase: 0.12,
    cpuMissPerRound: 0.03,
    cpuMissMax: 0.7,
    fakeFromRound: 6,
    fakeChance: 0.3,
  },
  hard: {
    lives: 3,
    callStartMs: 2800,
    callMinMs: 1400,
    callStepMs: 120,
    safeStart: 5,
    safeMin: 2,
    playerSpeed: 4.6,
    cpuSpeed: 3.4,
    cpuReactMinMs: 450,
    cpuReactMaxMs: 850,
    cpuMissBase: 0.06,
    cpuMissPerRound: 0.02,
    cpuMissMax: 0.6,
    fakeFromRound: 3,
    fakeChance: 0.45,
  },
}

/** 3・2・1 の かぞえ（1つ ぶん[ms]）。 */
export const COUNT_STEP_MS = 800
export const COUNTDOWN_MS = COUNT_STEP_MS * 3
/** ゆかが しずむ演出の長さ[ms]。 */
export const DROP_MS = 1100
/** ゆかが うきあがって つぎの おだいが出るまで[ms]。 */
export const RISE_MS = 900
/** フェイントで かんばんが かわる位置（おだい時間に対する割合）と、かわりに足す時間[ms]。 */
export const FAKE_SWITCH_RATIO = 0.45
export const FAKE_EXTRA_MS = 450

export type Phase = 'countdown' | 'call' | 'drop' | 'rise' | 'over'

/**
 * ready: おだいの あいだ / safe: のこった / fell: しずんだ / back: ハートを へらして もどってきた
 */
export type RunnerStatus = 'ready' | 'safe' | 'fell' | 'back'

export type Runner = {
  id: RunnerId
  /** いる場所（ゆかの列・段。小数は とちゅう）。 */
  x: number
  y: number
  /** むかっている ゆか。 */
  target: number | null
  lives: number
  /** しずんで おしまいに なったラウンド。のこっている間は null。 */
  outRound: number | null
  status: RunnerStatus
  /** あいてが つぎに かんがえる時刻（phaseMs）。 */
  decideAt: number | null
}

export type GameState = {
  difficulty: Difficulty
  board: Board
  phase: Phase
  /** いまの phase に入ってからの時間[ms]。 */
  phaseMs: number
  round: number
  /** ゆかごとの いろ（YUKA_COLORS の番号）。 */
  tiles: number[]
  /** ほんとうの おだい。時間ぎれで この いろ以外が しずむ。 */
  callColor: number
  /** フェイントで さいしょに見せる いろ。フェイントでなければ null。 */
  fakeColor: number | null
  /** かんばんが ほんとうの おだいに かわる時刻（phaseMs）。 */
  switchAt: number | null
  callMs: number
  runners: Runner[]
}

export type GameEvent = 'count' | 'go' | 'switch' | 'drop' | 'safe' | 'fall' | 'cpu-fall' | 'cpu-out' | 'rise' | 'win' | 'lose'

export type Rng = () => number

export const tileIndex = (board: Board, col: number, row: number): number => row * board.cols + col
export const tileCol = (board: Board, tile: number): number => tile % board.cols
export const tileRow = (board: Board, tile: number): number => Math.floor(tile / board.cols)

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
const randInt = (rng: Rng, n: number) => Math.min(n - 1, Math.floor(rng() * n))
const allTiles = (board: Board) => Array.from({ length: tileCount(board) }, (_, i) => i)

/** その場所が のっている ゆか。とちゅうなら いちばん近い ゆか。 */
export function tileUnder(board: Board, runner: Pick<Runner, 'x' | 'y'>): number {
  return tileIndex(board, clamp(Math.round(runner.x), 0, board.cols - 1), clamp(Math.round(runner.y), 0, board.rows - 1))
}

export function isAlive(runner: Runner): boolean {
  return runner.outRound === null
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1)
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

export function safeTileCount(settings: DifficultySettings, round: number, board: Board = DEFAULT_BOARD): number {
  const base = Math.max(settings.safeMin, settings.safeStart - Math.floor((round - 1) / 2))
  return Math.round((base * tileCount(board)) / BASE_TILE_COUNT)
}

export function baseCallMs(settings: DifficultySettings, round: number): number {
  return Math.max(settings.callMinMs, settings.callStartMs - settings.callStepMs * (round - 1))
}

export function cpuMissChance(settings: DifficultySettings, round: number): number {
  return Math.min(settings.cpuMissMax, settings.cpuMissBase + settings.cpuMissPerRound * (round - 1))
}

type RoundSetup = Pick<GameState, 'tiles' | 'callColor' | 'fakeColor' | 'switchAt' | 'callMs'>

/**
 * つぎのラウンドの ゆかと おだいを きめる。
 * だれかが いま たっている ゆかは おだいの いろに しない（みんな かならず はしる）。
 */
export function setupRound(
  difficulty: Difficulty,
  board: Board,
  round: number,
  runners: readonly Runner[],
  rng: Rng,
): RoundSetup {
  const settings = DIFFICULTY_SETTINGS[difficulty]
  const callColor = randInt(rng, YUKA_COLORS.length)
  const fake = round >= settings.fakeFromRound && rng() < settings.fakeChance
  const fakeColor = fake ? (callColor + 1 + randInt(rng, YUKA_COLORS.length - 1)) % YUKA_COLORS.length : null
  const fillers = YUKA_COLORS.map((_, i) => i).filter((i) => i !== callColor && i !== fakeColor)

  const occupied = new Set(runners.filter(isAlive).map((runner) => tileUnder(board, runner)))
  const free = shuffle(
    allTiles(board).filter((i) => !occupied.has(i)),
    rng,
  )
  const safe = safeTileCount(settings, round, board)
  const tiles = allTiles(board).map(() => fillers[randInt(rng, fillers.length)]!)
  free.slice(0, safe).forEach((tile) => { tiles[tile] = callColor })
  if (fakeColor !== null) free.slice(safe, safe * 2).forEach((tile) => { tiles[tile] = fakeColor })

  const base = baseCallMs(settings, round)
  return {
    tiles,
    callColor,
    fakeColor,
    switchAt: fake ? Math.round(base * FAKE_SWITCH_RATIO) : null,
    callMs: fake ? base + FAKE_EXTRA_MS : base,
  }
}

export function createInitialState(difficulty: Difficulty, rng: Rng, board: Board = DEFAULT_BOARD): GameState {
  const settings = DIFFICULTY_SETTINGS[difficulty]
  const spots = startSpots(board)
  const runners: Runner[] = RUNNERS.map((def, i) => {
    const [x, y] = spots[i]!
    return { id: def.id, x, y, target: null, lives: settings.lives, outRound: null, status: 'ready', decideAt: null }
  })
  return {
    difficulty,
    board,
    phase: 'countdown',
    phaseMs: 0,
    round: 1,
    ...setupRound(difficulty, board, 1, runners, rng),
    runners,
  }
}

/** いま かんばんに 見えている いろ。 */
export function shownColor(state: GameState): number {
  if (state.fakeColor !== null && state.switchAt !== null && state.phase === 'call' && state.phaseMs < state.switchAt) {
    return state.fakeColor
  }
  return state.callColor
}

/** おだいの のこり時間の割合（1 → 0）。 */
export function callRemaining(state: GameState): number {
  if (state.phase !== 'call') return state.phase === 'countdown' || state.phase === 'rise' ? 1 : 0
  return clamp(1 - state.phaseMs / state.callMs, 0, 1)
}

export function player(state: GameState): Runner {
  return state.runners.find((runner) => runner.id === 'me')!
}

/** プレイヤーが ゆかを タップした。おだいの あいだだけ うごける。 */
export function setPlayerTarget(state: GameState, tile: number): GameState {
  if (state.phase !== 'call' || tile < 0 || tile >= tileCount(state.board)) return state
  const me = player(state)
  if (!isAlive(me) || me.target === tile) return state
  return { ...state, runners: state.runners.map((runner) => (runner.id === 'me' ? { ...runner, target: tile } : runner)) }
}

/** やじるしキーで となりの ゆかへ。むかっている先から1つ ずらす。 */
export function stepPlayerTarget(state: GameState, dCol: number, dRow: number): GameState {
  const me = player(state)
  const { board } = state
  const from = me.target ?? tileUnder(board, me)
  const col = clamp(tileCol(board, from) + dCol, 0, board.cols - 1)
  const row = clamp(tileRow(board, from) + dRow, 0, board.rows - 1)
  return setPlayerTarget(state, tileIndex(board, col, row))
}

function nearestTiles(board: Board, runner: Runner, tiles: readonly number[], color: number): number[] {
  let best = Infinity
  let found: number[] = []
  tiles.forEach((c, tile) => {
    if (c !== color) return
    const d = Math.hypot(tileCol(board, tile) - runner.x, tileRow(board, tile) - runner.y)
    if (d < best - 1e-6) { best = d; found = [tile] } else if (Math.abs(d - best) <= 1e-6) found.push(tile)
  })
  return found
}

/** あいての きめかた。ふつうは いちばん近い おだいの ゆかへ。たまに まちがえたり まよったりする。 */
function decideCpu(state: GameState, runner: Runner, rng: Rng): Runner {
  const settings = DIFFICULTY_SETTINGS[state.difficulty]
  const color = shownColor(state)
  if (rng() < cpuMissChance(settings, state.round)) {
    // まよって その場に のこるか、となりの ちがう いろへ うっかり いく。
    if (rng() < 0.5) return { ...runner, target: null, decideAt: null }
    const { board } = state
    const here = tileUnder(board, runner)
    const wrong: number[] = []
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const col = tileCol(board, here) + dc
        const row = tileRow(board, here) + dr
        const inside = col >= 0 && col < board.cols && row >= 0 && row < board.rows
        if ((dc || dr) && inside && state.tiles[tileIndex(board, col, row)] !== color) wrong.push(tileIndex(board, col, row))
      }
    }
    return { ...runner, target: wrong.length ? wrong[randInt(rng, wrong.length)]! : null, decideAt: null }
  }
  const choices = nearestTiles(state.board, runner, state.tiles, color)
  return { ...runner, target: choices.length ? choices[randInt(rng, choices.length)]! : null, decideAt: null }
}

function reactDelay(settings: DifficultySettings, rng: Rng): number {
  return settings.cpuReactMinMs + rng() * (settings.cpuReactMaxMs - settings.cpuReactMinMs)
}

function moveRunner(board: Board, runner: Runner, speed: number, dtMs: number): Runner {
  if (runner.target === null) return runner
  const tx = tileCol(board, runner.target)
  const ty = tileRow(board, runner.target)
  const dx = tx - runner.x
  const dy = ty - runner.y
  const distance = Math.hypot(dx, dy)
  const reach = (speed * dtMs) / 1000
  if (distance <= reach) return { ...runner, x: tx, y: ty }
  return { ...runner, x: runner.x + (dx / distance) * reach, y: runner.y + (dy / distance) * reach }
}

function startCall(state: GameState, rng: Rng): GameState {
  const settings = DIFFICULTY_SETTINGS[state.difficulty]
  return {
    ...state,
    phase: 'call',
    phaseMs: 0,
    runners: state.runners.map((runner) =>
      isAlive(runner)
        ? { ...runner, status: 'ready', target: null, decideAt: RUNNERS.find((d) => d.id === runner.id)!.cpu ? reactDelay(settings, rng) : null }
        : runner,
    ),
  }
}

/** 時間ぎれ。おだい以外の ゆかに いた なかまは しずむ。 */
function resolveDrop(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = ['drop']
  const runners = state.runners.map((runner): Runner => {
    if (!isAlive(runner)) return runner
    const tile = tileUnder(state.board, runner)
    const snapped = { ...runner, x: tileCol(state.board, tile), y: tileRow(state.board, tile), target: null, decideAt: null }
    if (state.tiles[tile] === state.callColor) return { ...snapped, status: 'safe' }
    const lives = runner.lives - 1
    return { ...snapped, status: 'fell', lives, outRound: lives <= 0 ? state.round : null }
  })
  const me = runners.find((runner) => runner.id === 'me')!
  events.push(me.status === 'fell' ? 'fall' : 'safe')
  const cpus = runners.filter((runner) => runner.id !== 'me')
  if (cpus.some((runner) => runner.status === 'fell')) events.push('cpu-fall')
  if (cpus.some((runner) => runner.outRound === state.round)) events.push('cpu-out')
  return { state: { ...state, phase: 'drop', phaseMs: 0, runners }, events }
}

/** しずんだ演出のあと。おしまいか、つぎのラウンドへ。 */
function finishDrop(state: GameState, rng: Rng): { state: GameState; events: GameEvent[] } {
  const me = player(state)
  const cpusLeft = state.runners.filter((runner) => runner.id !== 'me' && isAlive(runner)).length
  if (!isAlive(me) || cpusLeft === 0) {
    return { state: { ...state, phase: 'over', phaseMs: 0 }, events: [rankOf(state, 'me') === 1 ? 'win' : 'lose'] }
  }
  // ハートが のこっている なかまは、あいている ゆかへ もどってくる。
  const { board } = state
  const taken = new Set(state.runners.filter((r) => isAlive(r) && r.status !== 'fell').map((r) => tileUnder(board, r)))
  const runners = state.runners.map((runner): Runner => {
    if (!isAlive(runner)) return runner
    if (runner.status !== 'fell') return { ...runner, status: 'ready' }
    const open = allTiles(board).filter((i) => !taken.has(i))
    const tile = open[randInt(rng, open.length)]!
    taken.add(tile)
    return { ...runner, x: tileCol(board, tile), y: tileRow(board, tile), status: 'back' }
  })
  const round = state.round + 1
  return {
    state: { ...state, phase: 'rise', phaseMs: 0, round, runners, ...setupRound(state.difficulty, board, round, runners, rng) },
    events: ['rise'],
  }
}

/** ゲームを dtMs だけ すすめる。音や振動の きっかけは events で返す。 */
export function advance(state: GameState, dtMs: number, rng: Rng): { state: GameState; events: GameEvent[] } {
  const now = state.phaseMs + dtMs
  switch (state.phase) {
    case 'countdown': {
      if (now >= COUNTDOWN_MS) return { state: startCall(state, rng), events: ['go'] }
      const crossed = Math.floor(now / COUNT_STEP_MS) > Math.floor(state.phaseMs / COUNT_STEP_MS)
      return { state: { ...state, phaseMs: now }, events: crossed ? ['count'] : [] }
    }
    case 'call': {
      const settings = DIFFICULTY_SETTINGS[state.difficulty]
      const events: GameEvent[] = []
      let next: GameState = { ...state, phaseMs: now }
      if (state.switchAt !== null && state.phaseMs < state.switchAt && now >= state.switchAt) {
        events.push('switch')
        // あいても かんばんが かわったのを見て、少しおくれて かんがえなおす。
        next = {
          ...next,
          runners: next.runners.map((runner) =>
            isAlive(runner) && runner.id !== 'me' ? { ...runner, decideAt: now + reactDelay(settings, rng) } : runner,
          ),
        }
      }
      next = {
        ...next,
        runners: next.runners.map((runner) => {
          if (!isAlive(runner)) return runner
          let current = runner
          if (current.decideAt !== null && now >= current.decideAt) current = decideCpu(next, current, rng)
          return moveRunner(next.board, current, current.id === 'me' ? settings.playerSpeed : settings.cpuSpeed, dtMs)
        }),
      }
      if (now >= state.callMs) {
        const dropped = resolveDrop(next)
        return { state: dropped.state, events: [...events, ...dropped.events] }
      }
      return { state: next, events }
    }
    case 'drop':
      if (now >= DROP_MS) return finishDrop(state, rng)
      return { state: { ...state, phaseMs: now }, events: [] }
    case 'rise':
      if (now >= RISE_MS) return { state: startCall(state, rng), events: [] }
      return { state: { ...state, phaseMs: now }, events: [] }
    case 'over':
      return { state, events: [] }
  }
}

/** じゅんい（1から）。おなじラウンドで おしまいに なった なかまは おなじ じゅんい。 */
export function rankOf(state: GameState, id: RunnerId): number {
  const score = (runner: Runner) => runner.outRound ?? Infinity
  const target = state.runners.find((runner) => runner.id === id)!
  return 1 + state.runners.filter((runner) => score(runner) > score(target)).length
}

/** けっかの ならび（じゅんい順）。 */
export function standings(state: GameState): { id: RunnerId; rank: number }[] {
  return state.runners
    .map((runner) => ({ id: runner.id, rank: rankOf(state, runner.id) }))
    .sort((a, b) => a.rank - b.rank || (a.id === 'me' ? -1 : b.id === 'me' ? 1 : 0))
}

/** ★の数。1い=3、2い=2、3い=1、4い=0。 */
export function rankStars(rank: number): number {
  return Math.max(0, 4 - rank)
}
