import { describe, expect, test } from 'vitest'
import Matter from 'matter-js'
import { LEVELS, SLING } from './levels'
import { BALL_BONUS, clampPull, createGame, launchVelocity, MAX_PULL, MAX_SPEED, predictPath, type Game } from './world'

const pullAt = (degrees: number, length: number) => ({ x: -Math.cos(degrees * Math.PI / 180) * length, y: Math.sin(degrees * Math.PI / 180) * length })

function settle(game: Game, limit = 900) {
  for (let i = 0; i < limit && game.state === 'flying'; i++) game.step()
}

describe('robo-kuzushi world', () => {
  test('the pull is capped and sends the ball the opposite way', () => {
    expect(Math.hypot(...Object.values(clampPull({ x: -500, y: 0 })) as [number, number])).toBeCloseTo(MAX_PULL)
    const v = launchVelocity({ x: -MAX_PULL, y: 0 })
    expect(v.x).toBeCloseTo(MAX_SPEED)
    expect(v.y).toBeCloseTo(0)
  })

  test('untouched towers stay still in every level, even when woken up', () => {
    for (const level of LEVELS) {
      const game = createGame(level)
      for (const p of game.pieces) Matter.Sleeping.set(p.body, false)
      const before = game.pieces.map(p => ({ ...p.body.position }))
      for (let i = 0; i < 300; i++) game.step()
      expect(game.robotsLeft, level.name).toBe(level.pieces.filter(p => p.type === 'robot').length)
      game.pieces.forEach((p, i) => expect(Math.hypot(p.body.position.x - before[i].x, p.body.position.y - before[i].y), level.name).toBeLessThan(4))
      expect(game.drainEvents().filter(e => e.type === 'break' || e.type === 'robot')).toEqual([])
      game.destroy()
    }
  })

  test('a short tug does not shoot; a good shot clears stage 1 with a ball bonus', () => {
    const game = createGame(LEVELS[0])
    expect(game.launch({ x: -5, y: 3 })).toBe(false)
    expect(game.queue).toHaveLength(3)
    expect(game.launch(pullAt(-10, 90))).toBe(true)
    expect(game.state).toBe('flying')
    expect(game.launch(pullAt(-10, 90))).toBe(false)
    settle(game)
    expect(game.state).toBe('clear')
    expect(game.robotsLeft).toBe(0)
    const events = game.drainEvents()
    expect(events.some(e => e.type === 'robot')).toBe(true)
    expect(events).toContainEqual({ type: 'bonus', score: 2 * BALL_BONUS })
    expect(game.score).toBeGreaterThanOrEqual(500 + 2 * BALL_BONUS)
    game.destroy()
  })

  test('missing with every ball ends in fail, and the last path is kept as a trail', () => {
    const game = createGame(LEVELS[0])
    for (let shot = 0; shot < 3; shot++) {
      expect(game.state).toBe('aim')
      game.launch(pullAt(-60, 40)) // すぐ 地面に おちる
      settle(game)
      expect(game.trail.length).toBeGreaterThan(0)
    }
    expect(game.state).toBe('fail')
    expect(game.projectiles).toHaveLength(0)
    game.destroy()
  })

  test('a tower that topples after the turn ends still clears the stage', () => {
    const game = createGame(LEVELS[0])
    game.launch(pullAt(-60, 40))
    settle(game)
    expect(game.state).toBe('aim')
    const robot = game.pieces.find(p => p.kind === 'robot')!
    Matter.Sleeping.set(robot.body, false)
    Matter.Body.setVelocity(robot.body, { x: 0, y: -1 })
    Matter.Body.setPosition(robot.body, { x: robot.body.position.x, y: 2000 })
    game.step()
    expect(game.state).toBe('clear')
    game.destroy()
  })

  test('the blue ball splits into three by itself partway through the flight, only once', () => {
    const game = createGame(LEVELS[6])
    expect(game.split()).toBe(false)
    game.launch(pullAt(40, 100))
    for (let i = 0; i < 5; i++) game.step()
    // パチンコの すぐ そばでは まだ わかれない。
    expect(game.projectiles).toHaveLength(1)
    let splitAt = -1
    for (let i = 5; i < 60 && splitAt < 0; i++) {
      const vy = game.projectiles[0].body.velocity.y
      game.step()
      if (game.projectiles.length === 3) { splitAt = i; expect(vy > -1 || i >= 35).toBe(true) }
    }
    expect(splitAt).toBeGreaterThan(5)
    expect(game.canSplit).toBe(false)
    expect(game.split()).toBe(false)
    const events = game.drainEvents()
    expect(events.filter(e => e.type === 'split')).toHaveLength(1)
    // わかれた たまは かさなっていても はじきあわず、空中で ぶつかる音も でない。
    const speeds = game.projectiles.map(p => p.body.speed)
    game.step()
    expect(game.projectiles).toHaveLength(3)
    expect(game.drainEvents().filter(e => e.type === 'hit')).toEqual([])
    game.projectiles.forEach((p, i) => expect(p.body.speed).toBeCloseTo(speeds[i], 0))
    game.destroy()
  })

  test('a flat shot with the blue ball still splits on the way', () => {
    const game = createGame(LEVELS[6])
    game.launch(pullAt(0, 60))
    for (let i = 0; i < 40; i++) game.step()
    expect(game.drainEvents().some(e => e.type === 'split')).toBe(true)
    game.destroy()
  })

  test('the stage of the blue ball can be cleared with a single well aimed shot', () => {
    const game = createGame(LEVELS[6])
    game.launch(pullAt(20, 100))
    settle(game)
    expect(game.state).toBe('clear')
    game.destroy()
  })

  test('the preview dots follow the real flight until it hits something', () => {
    const pull = pullAt(45, 100)
    const path = predictPath(pull, 'normal', 30, 3)
    const game = createGame(LEVELS[0])
    game.launch(pull)
    for (let i = 1; i <= 30; i++) {
      game.step()
      if (i % 3 === 0) {
        const p = game.projectiles[0].body.position
        expect(p.x).toBeCloseTo(path[i / 3 - 1].x, 3)
        expect(p.y).toBeCloseTo(path[i / 3 - 1].y, 3)
      }
    }
    expect(path[0].x).toBeGreaterThan(SLING.x + pull.x)
    expect(path[0].y).toBeLessThan(SLING.y + pull.y)
    game.destroy()
  })

  test('a jack-in-the-box blast knocks things around', () => {
    const game = createGame(LEVELS[5])
    game.launch(pullAt(15, 120))
    settle(game)
    const events = game.drainEvents()
    expect(events.some(e => e.type === 'blast')).toBe(true)
    game.destroy()
  })
})
