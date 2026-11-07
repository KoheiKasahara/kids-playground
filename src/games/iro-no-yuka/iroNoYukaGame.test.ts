import { describe, expect, test } from 'vitest'
import {
  BOARD_LONG_MAX,
  BOARD_SHORT,
  COUNTDOWN_MS,
  DEFAULT_BOARD,
  DIFFICULTY_SETTINGS,
  DROP_MS,
  FAKE_EXTRA_MS,
  RISE_MS,
  RUNNERS,
  YUKA_COLORS,
  advance,
  baseCallMs,
  boardFor,
  cpuMissChance,
  createInitialState,
  isAlive,
  player,
  rankOf,
  rankStars,
  safeTileCount,
  setPlayerTarget,
  setupRound,
  shownColor,
  standings,
  stepPlayerTarget,
  tileCol,
  tileCount,
  tileIndex,
  tileRow,
  tileUnder,
  type Board,
  type Difficulty,
  type GameEvent,
  type GameState,
  type Rng,
  type Runner,
} from './iroNoYukaGame'

const TICK = 33
const SQUARE = DEFAULT_BOARD
const BOARDS: readonly Board[] = [SQUARE, { cols: 5, rows: 9 }, { cols: 9, rows: 5 }, { cols: 5, rows: 7 }]

/** テスト用の決まった乱数（mulberry32）。 */
function seeded(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const always = (value: number): Rng => () => value

function run(state: GameState, ms: number, rng: Rng, each?: (s: GameState) => GameState) {
  const events: GameEvent[] = []
  let current = state
  for (let t = 0; t < ms; t += TICK) {
    if (each) current = each(current)
    const step = advance(current, TICK, rng)
    current = step.state
    events.push(...step.events)
  }
  return { state: current, events }
}

const under = (state: GameState) => (runner: Runner) => tileUnder(state.board, runner)
const col = (state: GameState, tile: number) => tileCol(state.board, tile)
const row = (state: GameState, tile: number) => tileRow(state.board, tile)

function nearestTile(state: GameState, runner: Runner, color: number): number {
  let best = -1
  let bestDistance = Infinity
  state.tiles.forEach((c, tile) => {
    const d = Math.hypot(col(state, tile) - runner.x, row(state, tile) - runner.y)
    if (c === color && d < bestDistance) { best = tile; bestDistance = d }
  })
  return best
}

/** いつも いちばん近い おだいの ゆかへ はしる プレイヤー。 */
const perfectPlayer = (state: GameState): GameState =>
  state.phase === 'call' && isAlive(player(state)) ? setPlayerTarget(state, nearestTile(state, player(state), shownColor(state))) : state

function withRunner(state: GameState, id: Runner['id'], patch: Partial<Runner>): GameState {
  return { ...state, runners: state.runners.map((runner) => (runner.id === id ? { ...runner, ...patch } : runner)) }
}

/** カウントダウンを おえて おだいが出た ところ。 */
function calling(difficulty: Difficulty, rng: Rng, board: Board = SQUARE): GameState {
  return advance({ ...createInitialState(difficulty, rng, board), phaseMs: COUNTDOWN_MS - 1 }, 1, rng).state
}

describe('ゆかの ならび', () => {
  test('たて長の画面では たてに、よこ長の画面では よこに ゆかを ふやし、5〜9まいに おさめる', () => {
    expect(boardFor(374, 374)).toEqual({ cols: 5, rows: 5 })
    expect(boardFor(374, 690)).toEqual({ cols: 5, rows: BOARD_LONG_MAX })
    expect(boardFor(344, 480)).toEqual({ cols: 5, rows: 7 })
    expect(boardFor(570, 310)).toEqual({ cols: BOARD_LONG_MAX, rows: 5 })
    expect(boardFor(400, 340)).toEqual({ cols: 6, rows: 5 })
    expect(boardFor(344, 400)).toEqual({ cols: 5, rows: 6 })
    expect(boardFor(300, 3000)).toEqual({ cols: BOARD_SHORT, rows: BOARD_LONG_MAX })
    // 大きさが はかれない（テスト環境など）ときは 5×5。
    expect(boardFor(0, 0)).toEqual(DEFAULT_BOARD)
  })

  test('おだいの ゆかの数は ゆかの多さに あわせて ふえる', () => {
    const settings = DIFFICULTY_SETTINGS.easy
    expect(safeTileCount(settings, 1, SQUARE)).toBe(settings.safeStart)
    expect(safeTileCount(settings, 1, { cols: 5, rows: 9 })).toBeGreaterThan(settings.safeStart)
    expect(safeTileCount(settings, 99, { cols: 5, rows: 9 })).toBeGreaterThanOrEqual(settings.safeMin)
  })
})

describe('ゆかと おだい', () => {
  test.each(['easy', 'hard'] as const)('%s: はじめは 4にんが ちがう ゆかに たち、だれの あしもとも おだいの いろではない', (difficulty) => {
    for (const board of BOARDS) {
      for (let seed = 1; seed <= 20; seed++) {
        const state = createInitialState(difficulty, seeded(seed), board)
        expect(state.phase).toBe('countdown')
        expect(state.tiles).toHaveLength(tileCount(board))
        expect(state.runners.map((r) => r.id)).toEqual(RUNNERS.map((r) => r.id))
        const spots = state.runners.map(under(state))
        expect(new Set(spots).size).toBe(4)
        for (const runner of state.runners) {
          expect(runner.x).toBeGreaterThanOrEqual(0)
          expect(runner.x).toBeLessThan(board.cols)
          expect(runner.y).toBeGreaterThanOrEqual(0)
          expect(runner.y).toBeLessThan(board.rows)
          expect(runner.lives).toBe(DIFFICULTY_SETTINGS[difficulty].lives)
          expect(state.tiles[tileUnder(board, runner)]).not.toBe(state.callColor)
        }
        expect(state.tiles.filter((c) => c === state.callColor)).toHaveLength(safeTileCount(DIFFICULTY_SETTINGS[difficulty], 1, board))
      }
    }
  })

  test('フェイントの ラウンドは さいしょに べつの いろを見せ、とちゅうで ほんとうの おだいに かわる', () => {
    const base = createInitialState('hard', seeded(3))
    const settings = DIFFICULTY_SETTINGS.hard
    // 乱数を 0 に すると フェイントの確率判定が かならず とおる。
    const round = settings.fakeFromRound
    const setup = setupRound('hard', SQUARE, round, base.runners, always(0))
    expect(setup.fakeColor).not.toBeNull()
    expect(setup.fakeColor).not.toBe(setup.callColor)
    expect(setup.callMs).toBe(baseCallMs(settings, round) + FAKE_EXTRA_MS)
    expect(setup.switchAt).toBeGreaterThan(0)
    expect(setup.switchAt).toBeLessThan(setup.callMs)
    const safe = safeTileCount(settings, round)
    expect(setup.tiles.filter((c) => c === setup.callColor)).toHaveLength(safe)
    expect(setup.tiles.filter((c) => c === setup.fakeColor)).toHaveLength(safe)
    for (const runner of base.runners) expect([setup.callColor, setup.fakeColor]).not.toContain(setup.tiles[tileUnder(SQUARE, runner)])

    const state: GameState = { ...base, phase: 'call', phaseMs: 0, round, ...setup }
    expect(shownColor(state)).toBe(setup.fakeColor)
    const { state: after, events } = run(state, setup.switchAt! + TICK, seeded(9))
    expect(events).toContain('switch')
    expect(shownColor(after)).toBe(setup.callColor)
  })

  test('フェイントは きまった ラウンドまで でない', () => {
    const base = createInitialState('easy', seeded(1))
    for (let round = 1; round < DIFFICULTY_SETTINGS.easy.fakeFromRound; round++) {
      expect(setupRound('easy', SQUARE, round, base.runners, always(0)).fakeColor).toBeNull()
    }
  })

  test('ラウンドが すすむと じかんは みじかく、ゆかは すくなく、あいては まちがえやすく なり、下限・上限で とまる', () => {
    for (const settings of Object.values(DIFFICULTY_SETTINGS)) {
      expect(baseCallMs(settings, 2)).toBeLessThan(baseCallMs(settings, 1))
      expect(baseCallMs(settings, 99)).toBe(settings.callMinMs)
      expect(safeTileCount(settings, 99)).toBe(settings.safeMin)
      expect(cpuMissChance(settings, 2)).toBeGreaterThan(cpuMissChance(settings, 1))
      expect(cpuMissChance(settings, 99)).toBe(settings.cpuMissMax)
    }
  })
})

describe('すすみかた', () => {
  test('3・2・1 の あと おだいが はじまる。カウント中は うごけない', () => {
    const start = createInitialState('easy', seeded(1))
    expect(setPlayerTarget(start, 0)).toBe(start)
    const { state, events } = run(start, COUNTDOWN_MS + TICK, seeded(2))
    expect(events.filter((e) => e === 'count')).toHaveLength(2)
    expect(events).toContain('go')
    expect(state.phase).toBe('call')
  })

  test('タップした ゆかへ はしって とまる。やじるしキーでは となりの ゆかへ', () => {
    const state = calling('easy', seeded(4))
    const me = player(state)
    const goal = tileIndex(SQUARE, 4, 0)
    const moving = setPlayerTarget(state, goal)
    const distance = Math.hypot(4 - me.x, 0 - me.y)
    const needMs = (distance / DIFFICULTY_SETTINGS.easy.playerSpeed) * 1000
    const halfway = player(run(moving, needMs / 2, seeded(5)).state)
    expect(tileUnder(SQUARE, halfway)).not.toBe(goal)
    const arrived = player(run(moving, needMs + TICK * 2, seeded(5)).state)
    expect([arrived.x, arrived.y]).toEqual([4, 0])

    const here = tileUnder(SQUARE, me)
    expect(player(stepPlayerTarget(state, 1, 0)).target).toBe(tileIndex(SQUARE, col(state, here) + 1, row(state, here)))
    const corner = withRunner(state, 'me', { x: 0, y: 0, target: null })
    expect(player(stepPlayerTarget(corner, -1, -1)).target).toBe(tileIndex(SQUARE, 0, 0))
    expect(setPlayerTarget(state, tileCount(SQUARE))).toBe(state)
  })

  test('よこ長の ならびでも はしの ゆかまで いける', () => {
    const board = { cols: 9, rows: 5 }
    const state = calling('easy', seeded(4), board)
    const far = tileIndex(board, 8, 4)
    const arrived = player(run(setPlayerTarget(state, far), 3000, seeded(5)).state)
    expect([arrived.x, arrived.y]).toEqual([8, 4])
    const edge = withRunner(state, 'me', { x: 8, y: 2, target: null })
    expect(player(stepPlayerTarget(edge, 1, 0)).target).toBe(tileIndex(board, 8, 2))
  })

  test('時間ぎれで おだいの ゆかに いれば セーフ、ちがう ゆかなら ハートが へる', () => {
    const state = calling('easy', seeded(6))
    const safeTile = state.tiles.findIndex((c) => c === state.callColor)
    const ready = withRunner(state, 'me', { x: col(state, safeTile), y: row(state, safeTile), target: null })
    const safe = run(ready, state.callMs + TICK, seeded(7))
    expect(safe.events).toContain('drop')
    expect(safe.events).toContain('safe')
    expect(player(safe.state).lives).toBe(3)
    expect(player(safe.state).status).toBe('safe')

    const idle = run(state, state.callMs + TICK, seeded(7))
    expect(idle.events).toContain('fall')
    expect(player(idle.state).lives).toBe(2)
    expect(player(idle.state).status).toBe('fell')
  })

  test('とちゅうで時間ぎれに なると、いちばん近い ゆかで きまる', () => {
    const state = calling('easy', seeded(8))
    const safeTile = state.tiles.findIndex((c) => c === state.callColor)
    const almost = withRunner(state, 'me', { x: col(state, safeTile) + 0.3, y: row(state, safeTile) - 0.2, target: null })
    const { state: dropped } = advance({ ...almost, phaseMs: state.callMs - 1 }, TICK, seeded(1))
    expect(player(dropped).status).toBe('safe')
    expect([player(dropped).x, player(dropped).y]).toEqual([col(state, safeTile), row(state, safeTile)])
  })

  test('しずんだ なかまは あいている ゆかへ もどり、つぎの ラウンドが はじまる', () => {
    for (const board of BOARDS) {
      const state = calling('easy', seeded(10), board)
      const dropped = run(state, state.callMs + TICK, seeded(11)).state
      expect(dropped.phase).toBe('drop')
      const { state: rising, events } = run(dropped, DROP_MS + TICK, seeded(12))
      expect(events).toContain('rise')
      expect(rising.phase).toBe('rise')
      expect(rising.round).toBe(2)
      expect(rising.board).toEqual(board)
      expect(player(rising).status).toBe('back')
      // のこった なかまどうしは おなじ ゆかに いてもよいが、もどってきた なかまは だれもいない ゆかに おりる。
      const alive = rising.runners.filter(isAlive)
      for (const back of alive.filter((r) => r.status === 'back')) {
        const others = alive.filter((r) => r !== back).map(under(rising))
        expect(others).not.toContain(under(rising)(back))
      }
      for (const spot of alive.map(under(rising))) expect(rising.tiles[spot]).not.toBe(rising.callColor)
      const next = run(rising, RISE_MS + TICK, seeded(13)).state
      expect(next.phase).toBe('call')
      expect(next.runners.filter(isAlive).every((r) => r.status === 'ready')).toBe(true)
    }
  })

  test('あいては かんがえたあと、いちばん近い おだいの ゆかへ むかう', () => {
    // 0.99 は「まちがえない」側に たおれる。
    const state = calling('easy', always(0.99))
    const cpu = state.runners.find((r) => r.id === 'inu')!
    const after = run(state, cpu.decideAt! + TICK, always(0.99)).state
    const target = after.runners.find((r) => r.id === 'inu')!.target!
    expect(after.tiles[target]).toBe(state.callColor)
    const best = Math.min(
      ...state.tiles.flatMap((c, tile) => (c === state.callColor ? [Math.hypot(col(state, tile) - cpu.x, row(state, tile) - cpu.y)] : [])),
    )
    expect(Math.hypot(col(state, target) - cpu.x, row(state, target) - cpu.y)).toBeCloseTo(best)
  })
})

describe('おしまいと じゅんい', () => {
  test('うごかないと ハートが なくなって おしまい。のこった あいてより下の じゅんい', () => {
    const { state, events } = run(createInitialState('easy', always(0.99)), 60_000, always(0.99))
    expect(state.phase).toBe('over')
    expect(events.at(-1)).toBe('lose')
    expect(player(state).outRound).toBe(DIFFICULTY_SETTINGS.easy.lives)
    expect(rankOf(state, 'me')).toBe(4)
    expect(rankStars(rankOf(state, 'me'))).toBe(0)
  })

  test('みんな おなじ ラウンドで しずむと、おなじ じゅんい', () => {
    // 乱数 0 では あいてが いつも まよって うごかない。
    const { state, events } = run(createInitialState('easy', always(0)), 60_000, always(0))
    expect(state.phase).toBe('over')
    expect(state.runners.every((r) => r.outRound === DIFFICULTY_SETTINGS.easy.lives)).toBe(true)
    expect(events.at(-1)).toBe('win')
    expect(standings(state).map((s) => s.rank)).toEqual([1, 1, 1, 1])
    expect(standings(state)[0]!.id).toBe('me')
  })

  test('あいてが ぜんいん いなくなったら 1い', () => {
    const state = calling('easy', seeded(20))
    let ready = state
    for (const id of ['inu', 'neko', 'kuma'] as const) ready = withRunner(ready, id, { lives: 1, decideAt: null })
    const safeTile = state.tiles.findIndex((c) => c === state.callColor)
    ready = withRunner(ready, 'me', { x: col(state, safeTile), y: row(state, safeTile) })
    const { state: end, events } = run(ready, state.callMs + DROP_MS + TICK * 2, seeded(21))
    expect(events).toContain('cpu-out')
    expect(events.at(-1)).toBe('win')
    expect(end.phase).toBe('over')
    expect(rankOf(end, 'me')).toBe(1)
    expect(rankStars(1)).toBe(3)
  })

  test.each(['easy', 'hard'] as const)('%s: いつも 近い ゆかへ はしれば、どの ならびでも おわりが来て かてる', (difficulty) => {
    for (const board of BOARDS) {
      for (let seed = 1; seed <= 8; seed++) {
        const { state } = run(createInitialState(difficulty, seeded(seed), board), 400_000, seeded(seed * 7), perfectPlayer)
        const label = `${board.cols}x${board.rows} seed ${seed}`
        expect(state.phase, label).toBe('over')
        expect(rankOf(state, 'me'), label).toBe(1)
        expect(state.round, label).toBeLessThan(60)
      }
    }
  })

  test('ゆかの いろには 形の記号もある（色だけに たよらない）', () => {
    expect(new Set(YUKA_COLORS.map((c) => c.symbol)).size).toBe(YUKA_COLORS.length)
    expect(new Set(YUKA_COLORS.map((c) => c.name)).size).toBe(YUKA_COLORS.length)
  })
})
