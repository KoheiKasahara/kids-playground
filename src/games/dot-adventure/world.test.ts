import { describe, expect, test } from 'vitest'
import { STAGES } from './stages'
import {
  TILE, createWorld, drainEvents, findPath, isSolidTile, nextGoal, parseLevel, stepWorld, tileCenter, trailPoint, walkTo,
  type Level, type Point, type World,
} from './world'

function walkUntil(world: World, done: () => boolean, max = 4000) {
  for (let i = 0; i < max && !done(); i++) stepWorld(world)
}

const openGates = (level: Level) => { for (const g of level.gates) level.solid[g.ty * level.w + g.tx] = 0 }
const reaches = (level: Level, p: Point) => {
  const path = findPath(level, level.start, p)
  if (!path) return false
  const end = path[path.length - 1]
  return Math.hypot(end.x - p.x, end.y - p.y) < TILE * 1.5
}

/** しかけを とく（なかまを つれて いく・スイッチを ふむ・たいまつを ともす）。 */
function solveGimmick(world: World) {
  const level = world.level
  const kind = world.gimmick.def.kind
  if (kind === 'boulder') {
    for (const f of world.friends) {
      expect(walkTo(world, f)).toBe(true)
      walkUntil(world, () => f.joined)
    }
    const gate = tileCenter(level.gates[0].tx, level.gates[0].ty)
    expect(walkTo(world, gate)).toBe(true)
  } else if (kind === 'bridge') {
    expect(walkTo(world, level.switches[0])).toBe(true)
  } else {
    for (const t of level.torches) {
      expect(walkTo(world, tileCenter(t.tx, t.ty))).toBe(true)
      walkUntil(world, () => world.path.length === 0)
    }
  }
  walkUntil(world, () => world.gimmick.open)
  expect(world.gimmick.open).toBe(true)
}

describe('dot-adventure stages', () => {
  test.each(STAGES.map(s => [s.id, s] as const))('%s の 地図が ととのっている', (_id, stage) => {
    const width = stage.map[0].length
    for (const row of stage.map) expect(row).toHaveLength(width)
    const level = parseLevel(stage)
    expect(level.shards).toHaveLength(5)
    expect(level.friendSpawns).toHaveLength(stage.friends.length)
    expect(isSolidTile(level, Math.floor(level.start.x / TILE), Math.floor(level.start.y / TILE))).toBe(false)
  })

  test.each(STAGES.map(s => [s.id, s] as const))('%s の かけら・なかま・たからばこに ぜんぶ とどく', (_id, stage) => {
    const level = parseLevel(stage)
    openGates(level)
    for (const p of [...level.shards, ...level.friendSpawns, level.chest]) expect(reaches(level, p), `${stage.id} (${p.x}, ${p.y})`).toBe(true)
  })

  test.each(STAGES.map(s => [s.id, s] as const))('%s の しかけは とくまで かけらを とおせんぼ する', (_id, stage) => {
    const level = parseLevel(stage)
    expect(level.gates.length).toBeGreaterThan(0)
    // しかけの むこうに かけらが ある。
    expect(level.shards.some(p => !reaches(level, p))).toBe(true)
    // たからばこ・なかま・しかけを とく ものには はじめから とどく。
    for (const p of [level.chest, ...level.friendSpawns, ...level.switches, ...level.torches.map(t => tileCenter(t.tx, t.ty))]) {
      expect(reaches(level, p), `${stage.id} (${p.x}, ${p.y})`).toBe(true)
    }
    for (const g of level.gates) expect(isSolidTile(level, g.tx, g.ty)).toBe(true)
  })

  test('ステージごとに ちがう しかけ', () => {
    const kinds = STAGES.map(s => s.gimmick.kind)
    expect(new Set(kinds).size).toBe(STAGES.length)
    const forest = parseLevel(STAGES.find(s => s.gimmick.kind === 'boulder')!)
    expect(forest.friendSpawns.length).toBeGreaterThanOrEqual((STAGES.find(s => s.gimmick.kind === 'boulder')!.gimmick as { need: number }).need)
    expect(parseLevel(STAGES.find(s => s.gimmick.kind === 'bridge')!).switches.length).toBeGreaterThan(0)
    expect(parseLevel(STAGES.find(s => s.gimmick.kind === 'torch')!).torches.length).toBeGreaterThan(0)
  })
})

describe('dot-adventure しかけ', () => {
  test('もりの いわは なかまが たりないと うごかず、みんなで いくと どく', () => {
    const world = createWorld(STAGES.find(s => s.gimmick.kind === 'boulder')!)
    const gate = tileCenter(world.level.gates[0].tx, world.level.gates[0].ty)
    expect(walkTo(world, gate)).toBe(true)
    walkUntil(world, () => world.path.length === 0)
    expect(world.gimmick.open).toBe(false)
    const hint = drainEvents(world).find(e => e.type === 'gimmick-hint')
    expect(hint).toMatchObject({ kind: 'boulder', need: 2 - world.friends.filter(f => f.joined).length })
    solveGimmick(world)
    expect(drainEvents(world).some(e => e.type === 'gate-open')).toBe(true)
    expect(isSolidTile(world.level, world.level.gates[0].tx, world.level.gates[0].ty)).toBe(false)
  })

  test('はまべは スイッチを ふむと はしが のびる', () => {
    const world = createWorld(STAGES.find(s => s.gimmick.kind === 'bridge')!)
    solveGimmick(world)
    const events = drainEvents(world)
    expect(events.some(e => e.type === 'switch')).toBe(true)
    expect(events.some(e => e.type === 'gate-open' && e.kind === 'bridge')).toBe(true)
    expect(world.gimmick.pressed).toBe(true)
  })

  test('いせきは たいまつ ぜんぶに ひを ともすと とびらが ひらく', () => {
    const world = createWorld(STAGES.find(s => s.gimmick.kind === 'torch')!)
    solveGimmick(world)
    const torches = drainEvents(world).filter(e => e.type === 'torch')
    expect(torches.map(e => e.type === 'torch' && e.left)).toEqual([1, 0])
    expect(world.gimmick.lit.every(Boolean)).toBe(true)
  })

  test('しかけの むこうを タップすると とおせんぼの まえまで あるく', () => {
    const world = createWorld(STAGES.find(s => s.gimmick.kind === 'bridge')!)
    const level = world.level
    const behind = world.shards.find(s => !reaches(level, s))!
    expect(walkTo(world, behind)).toBe(true)
    walkUntil(world, () => world.path.length === 0)
    const gateNear = level.gates.some(g => { const c = tileCenter(g.tx, g.ty); return Math.hypot(c.x - world.hero.x, c.y - world.hero.y) < TILE * 1.6 })
    expect(gateNear).toBe(true)
  })

  test('のこりの かけらが しかけの むこうだけに なったら、しかけを とく ところを さす', () => {
    const world = createWorld(STAGES.find(s => s.gimmick.kind === 'bridge')!)
    for (const s of world.shards) if (reaches(world.level, s)) s.taken = true
    expect(nextGoal(world)).toEqual(world.level.switches[0])
    const ruins = createWorld(STAGES.find(s => s.gimmick.kind === 'torch')!)
    for (const s of ruins.shards) if (reaches(ruins.level, s)) s.taken = true
    const t = nextGoal(ruins)!
    expect(ruins.level.torches.some(tt => { const c = tileCenter(tt.tx, tt.ty); return c.x === t.x && c.y === t.y })).toBe(true)
  })
})

describe('dot-adventure world', () => {
  test('タップした ところへ あるいて、かべは すりぬけない', () => {
    const world = createWorld(STAGES[0])
    const start = { ...world.hero }
    expect(walkTo(world, { x: start.x + 64, y: start.y })).toBe(true)
    walkUntil(world, () => world.path.length === 0)
    expect(world.hero.x).toBeCloseTo(start.x + 64, 0)
    expect(world.hero.dir).toBe('right')
    // ひだりは 木の かべ。
    for (let i = 0; i < 120; i++) stepWorld(world, { x: -1, y: 0 })
    expect(world.hero.x).toBeGreaterThan(TILE * 1.5)
  })

  test.each(STAGES.map(s => [s.id, s] as const))('%s: しかけを といて かけらを ぜんぶ ひろうと たからばこが でて、あけると クリア', (_id, stage) => {
    const world = createWorld(stage)
    solveGimmick(world)
    drainEvents(world)
    for (const shard of world.shards) {
      expect(walkTo(world, shard)).toBe(true)
      walkUntil(world, () => shard.taken)
      expect(shard.taken).toBe(true)
    }
    const events = drainEvents(world)
    expect(events.filter(e => e.type === 'shard').map(e => e.type === 'shard' && e.left)).toEqual([4, 3, 2, 1, 0])
    expect(events.some(e => e.type === 'chest-appear')).toBe(true)
    expect(world.chest.visible).toBe(true)
    expect(nextGoal(world)).toBe(world.chest)
    expect(walkTo(world, world.chest)).toBe(true)
    walkUntil(world, () => world.state === 'clear')
    expect(world.state).toBe('clear')
    expect(drainEvents(world).some(e => e.type === 'chest-open')).toBe(true)
  })

  test('ちかづいた いきものは なかまに なって うしろを ついてくる', () => {
    const world = createWorld(STAGES[0])
    const friend = world.friends[0]
    expect(walkTo(world, friend)).toBe(true)
    walkUntil(world, () => friend.joined)
    expect(friend.joined).toBe(true)
    expect(drainEvents(world).some(e => e.type === 'join')).toBe(true)
    walkTo(world, { x: world.hero.x, y: world.hero.y - 64 })
    walkUntil(world, () => world.path.length === 0)
    for (let i = 0; i < 60; i++) stepWorld(world)
    const d = Math.hypot(friend.x - world.hero.x, friend.y - world.hero.y)
    expect(d).toBeGreaterThan(8)
    expect(d).toBeLessThan(30)
  })

  test('みずの なかは えらべず、ちかくの きしへ いく', () => {
    const world = createWorld(STAGES[0])
    const level = world.level
    let water: { x: number; y: number } | null = null
    for (let y = 4; y < level.h && !water; y++) for (let x = 3; x < 9; x++) if (level.ground[y * level.w + x] === '~') { water = { x: x * TILE + 8, y: y * TILE + 8 }; break }
    expect(walkTo(world, water!)).toBe(true)
    walkUntil(world, () => world.path.length === 0)
    expect(isSolidTile(level, Math.floor(world.hero.x / TILE), Math.floor(world.hero.y / TILE))).toBe(false)
  })

  test('trailPoint は うしろへ たどる', () => {
    const trail = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]
    expect(trailPoint(trail, 5)).toEqual({ x: 10, y: 5 })
    expect(trailPoint(trail, 15)).toEqual({ x: 5, y: 0 })
    expect(trailPoint(trail, 99)).toEqual({ x: 0, y: 0 })
  })
})
