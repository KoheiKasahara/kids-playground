import { describe, expect, test } from 'vitest'
import { STAGES } from './stages'
import { TILE, createWorld, drainEvents, findPath, isSolidTile, nextGoal, parseLevel, stepWorld, trailPoint, walkTo, type World } from './world'

function walkUntil(world: World, done: () => boolean, max = 4000) {
  for (let i = 0; i < max && !done(); i++) stepWorld(world)
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
    for (const p of [...level.shards, ...level.friendSpawns, level.chest]) {
      const path = findPath(level, level.start, p)
      expect(path, `${stage.id} (${p.x}, ${p.y})`).not.toBeNull()
      const end = path![path!.length - 1]
      expect(Math.hypot(end.x - p.x, end.y - p.y)).toBeLessThan(TILE * 1.5)
    }
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

  test('かけらを ぜんぶ ひろうと たからばこが でて、あけると クリア', () => {
    const world = createWorld(STAGES[0])
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
