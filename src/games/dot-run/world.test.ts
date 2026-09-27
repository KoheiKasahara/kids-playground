import { describe, expect, test } from 'vitest'
import { CHUNKS, STAGES, type ChunkName, type StageDef } from './stages'
import {
  GROUND_Y, HERO_H, HERO_W, READY_FRAMES, ROWS, TILE, autoPilot, cellAt, createWorld, drainEvents, pressJump, releaseJump, runResult,
  stageRows, stepWorld, type World, type WorldEvent,
} from './world'

function stageWith(chunks: ChunkName[], base: StageDef = STAGES[0]): StageDef {
  return { ...base, chunks }
}

/** よーい どん！ まで すすめる。 */
function start(world: World) {
  while (world.state === 'ready') stepWorld(world)
  drainEvents(world)
}

function run(world: World, frames: number, events: WorldEvent[] = []) {
  for (let i = 0; i < frames; i++) {
    stepWorld(world)
    events.push(...drainEvents(world))
  }
  return events
}

/** みじかく ぽんと おす ジャンプ。 */
function tap(world: World, events: WorldEvent[] = [], hold = 6) {
  pressJump(world)
  run(world, hold, events)
  releaseJump(world)
  return events
}

const colOf = (x: number) => Math.floor(x / TILE)

function playThrough(stage: StageDef, maxFrames = 60 * 150) {
  const world = createWorld(stage)
  const events: WorldEvent[] = []
  for (let i = 0; i < maxFrames && world.state !== 'done'; i++) {
    autoPilot(world)
    stepWorld(world)
    events.push(...drainEvents(world))
  }
  return { world, events }
}

describe('stage data', () => {
  test('チャンクは 10ぎょうで よこはばが そろい、つかえる もじだけ', () => {
    for (const [name, rows] of Object.entries(CHUNKS)) {
      expect(rows, name).toHaveLength(ROWS)
      expect(new Set(rows.map(r => r.length)).size, name).toBe(1)
      for (const row of rows) expect(row, name).toMatch(/^[.#=?rcMebSG]+$/)
      // いきもの・ばね・いわ・ゴールは なにかの うえに いる。
      for (let r = 0; r < ROWS - 1; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          if ('eSrG'.includes(rows[r][c])) expect('#=r?'.includes(rows[r + 1][c]), `${name} ${r},${c}`).toBe(true)
        }
      }
    }
  })

  test('どの ステージも スタートと ゴールが あり、ほしメダルは 3こ', () => {
    expect(new Set(STAGES.map(s => s.id)).size).toBe(STAGES.length)
    for (const stage of STAGES) {
      expect(stage.chunks[0]).toBe('start')
      expect(stage.chunks.at(-1)).toBe('goal')
      const rows = stageRows(stage).join('')
      expect(rows.split('M').length - 1, stage.id).toBe(3)
      expect(rows.split('G').length - 1, stage.id).toBe(1)
      const world = createWorld(stage)
      expect(world.medals).toHaveLength(3)
      expect(world.carrotTotal).toBeGreaterThan(30)
      expect(world.goalX).toBeGreaterThan(world.width * .8)
    }
  })
})

describe('dot-run world', () => {
  test('よーい どん！ の あと じぶんで はしりだす', () => {
    const world = createWorld(STAGES[0])
    const x = world.hero.x
    const events = run(world, READY_FRAMES - 1)
    expect(world.hero.x).toBe(x)
    run(world, 30, events)
    expect(events.some(e => e.type === 'go')).toBe(true)
    expect(world.state).toBe('play')
    expect(world.hero.x).toBeGreaterThan(x + 30)
    expect(world.hero.onGround).toBe(true)
  })

  test('なにも しないと いわの まえで とまって ヒントを だす。ジャンプで こえられる', () => {
    const world = createWorld(stageWith(['start', 'rock', 'goal']))
    start(world)
    const events = run(world, 60 * 12)
    const rockX = (20 + 10) * TILE
    expect(world.hero.x + HERO_W).toBeLessThanOrEqual(rockX)
    expect(world.hero.x + HERO_W).toBeGreaterThan(rockX - 1)
    expect(events.filter(e => e.type === 'hint')).toHaveLength(1)
    tap(world, events, 12)
    run(world, 60, events)
    expect(world.hero.x).toBeGreaterThan(rockX + TILE)
  })

  test('ながおし すると たかく とび、くうちゅうで もう1かい とべる', () => {
    const heights = [6, 40].map(hold => {
      const world = createWorld(stageWith(['start', 'run', 'goal']))
      start(world)
      let top = world.hero.y
      pressJump(world)
      for (let i = 0; i < 80; i++) {
        if (i === hold) releaseJump(world)
        stepWorld(world)
        top = Math.min(top, world.hero.y)
      }
      return GROUND_Y - HERO_H - top
    })
    expect(heights[0]).toBeGreaterThan(TILE * 2)
    expect(heights[1]).toBeGreaterThan(heights[0] + 12)

    const world = createWorld(stageWith(['start', 'run', 'goal']))
    start(world)
    const events = tap(world)
    run(world, 10, events)
    tap(world, events)
    expect(events.map(e => e.type)).toEqual(expect.arrayContaining(['jump', 'double']))
    // 3かいめは とべない。
    const vy = world.hero.vy
    pressJump(world)
    stepWorld(world)
    expect(drainEvents(world).some(e => e.type === 'jump' || e.type === 'double')).toBe(false)
    expect(world.hero.vy).toBeGreaterThan(vy)
  })

  test('にんじんを とると かずが ふえる', () => {
    const world = createWorld(stageWith(['start', 'goal']))
    start(world)
    const events = run(world, 60 * 5)
    expect(events.filter(e => e.type === 'carrot')).toHaveLength(4)
    expect(world.got.carrots).toBe(4)
  })

  test('はてなブロックを したから たたくと にんじんが でて、からっぽに なる', () => {
    const world = createWorld(stageWith(['start', 'blocks', 'goal']))
    start(world)
    const blockX = (20 + 6) * TILE
    const events: WorldEvent[] = []
    while (world.hero.x + HERO_W / 2 < blockX - 4) run(world, 1, events)
    tap(world, events)
    run(world, 30, events)
    expect(events.some(e => e.type === 'block')).toBe(true)
    expect(cellAt(world, 26, 5)).toBe('u')
    const before = world.got.carrots
    // からっぽの ブロックは もう でない。
    world.hero.x = blockX - 2
    world.hero.y = GROUND_Y - HERO_H
    tap(world, events)
    run(world, 30, events)
    expect(events.filter(e => e.type === 'block')).toHaveLength(1)
    expect(world.got.carrots).toBe(before)
  })

  test('あなに おちると あわで たすけられて、あなの さきに おりる', () => {
    const world = createWorld(stageWith(['start', 'hole', 'goal']))
    start(world)
    const events = run(world, 60 * 8)
    expect(events.some(e => e.type === 'fall')).toBe(true)
    expect(events.some(e => e.type === 'rescue')).toBe(true)
    const holeEnd = (20 + 10) * TILE
    expect(world.hero.x).toBeGreaterThan(holeEnd)
    expect(world.hero.onGround || world.state !== 'play').toBe(true)
  })

  test('いきものを うえから ふむと ぽよんと はねる', () => {
    const world = createWorld(stageWith(['start', 'walker', 'goal']))
    start(world)
    const enemy = world.enemies[0]
    const events: WorldEvent[] = []
    while (enemy.x - (world.hero.x + HERO_W) > 38) run(world, 1, events)
    tap(world, events)
    for (let i = 0; i < 60 && !events.some(e => e.type === 'stomp'); i++) run(world, 1, events)
    expect(events.some(e => e.type === 'stomp')).toBe(true)
    expect(events.some(e => e.type === 'hurt')).toBe(false)
    expect(enemy.state).toBe('bye')
    expect(world.hero.vy).toBeLessThan(0)
  })

  test('よこから ぶつかると にんじんを おとすが、また ひろえる', () => {
    const world = createWorld(stageWith(['start', 'walker', 'goal']))
    start(world)
    world.got.carrots = 5
    const events = run(world, 60 * 9)
    const hurt = events.find(e => e.type === 'hurt')
    expect(hurt).toMatchObject({ dropped: 3 })
    expect(events.filter(e => e.type === 'hurt')).toHaveLength(1)
    const regained = events.filter(e => e.type === 'carrot').length
    expect(world.got.carrots).toBe(2 + regained)
    expect(regained).toBeGreaterThan(0)
  })

  test('ばねに のると たかく とびあがる', () => {
    const world = createWorld(stageWith(['start', 'spring', 'goal']))
    start(world)
    const events: WorldEvent[] = []
    let top = world.hero.y
    for (let i = 0; i < 60 * 6; i++) {
      run(world, 1, events)
      top = Math.min(top, world.hero.y)
    }
    expect(events.some(e => e.type === 'spring')).toBe(true)
    expect(GROUND_Y - HERO_H - top).toBeGreaterThan(80)
    expect(events.filter(e => e.type === 'carrot').length).toBeGreaterThanOrEqual(9)
  })

  test('ばねの ほしメダルは ばねで とると とれる', () => {
    const world = createWorld(stageWith(['start', 'medalSpring', 'goal']))
    start(world)
    const events = run(world, 60 * 8)
    expect(events.filter(e => e.type === 'medal')).toHaveLength(1)
  })

  test('たかい あしばの ほしメダルは あしばを のぼると とれる', () => {
    for (const stage of STAGES) {
      const world = createWorld(stageWith(['start', 'medalTower', 'goal'], stage))
      start(world)
      let hold = 0
      for (let i = 0; i < 60 * 10; i++) {
        const { hero } = world
        const feetRow = Math.floor((hero.y + HERO_H + 1) / TILE)
        if (hero.onGround && hold === 0) {
          // まえの ほうに ひとつ うえの あしばが あれば、ぽんと のる。
          for (let dx = 0; dx <= 24; dx += 4) if (cellAt(world, colOf(hero.x + HERO_W + dx), feetRow - 2) === '=') hold = 8
        }
        if (hold === 8) pressJump(world)
        if (hold > 0 && --hold === 0) releaseJump(world)
        stepWorld(world)
      }
      expect(world.got.medals, stage.id).toBe(1)
    }
  })

  test('あなの うえの ほしメダルは 2だんジャンプで とれる', () => {
    for (const stage of STAGES) {
      const world = createWorld(stageWith(['start', 'medalHole', 'goal'], stage))
      start(world)
      const events: WorldEvent[] = []
      while (world.hero.x + HERO_W < (20 + 8) * TILE - 6) run(world, 1, events)
      tap(world, events)
      run(world, 8, events)
      tap(world, events)
      run(world, 90, events)
      expect(world.got.medals, stage.id).toBe(1)
      expect(events.some(e => e.type === 'fall'), stage.id).toBe(false)
    }
  })

  test('ゴールすると よろこんで おわる', () => {
    const world = createWorld(stageWith(['start', 'goal']))
    start(world)
    const events = run(world, 60 * 12)
    const types = events.map(e => e.type)
    expect(types).toContain('goal')
    expect(types.at(-1)).toBe('done')
    expect(world.state).toBe('done')
    expect(runResult(world)).toMatchObject({ carrots: 4, medals: 0, stars: 1 })
  })

  test.each(STAGES.map(s => [s.id, s] as const))('%s は さいごまで あそべる', (_id, stage) => {
    const { world, events } = playThrough(stage)
    expect(world.state).toBe('done')
    const result = runResult(world)
    expect(result.stars).toBeGreaterThanOrEqual(1)
    expect(result.carrots).toBeGreaterThan(result.carrotTotal * .35)
    expect(events.filter(e => e.type === 'fall').length).toBeLessThanOrEqual(1)
    // 1ステージは だいたい 1ぷん くらい。
    expect(world.frame).toBeLessThan(60 * 90)
  })
})
