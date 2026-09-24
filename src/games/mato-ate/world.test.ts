import { describe, expect, test } from 'vitest'
import { CANNON, type Level } from './levels'
import { MAX_ANGLE, RELOAD, STEP, angleTo, blinkActive, blinkAlpha, createGame, motionOffset, type Game, type GameEvent } from './world'

const base = (patch: Partial<Level>): Level => ({ name: 'test', difficulty: 'easy', balls: 5, hint: '', targets: [{ x: 200, y: 200 }], walls: [], ...patch })

/** ぜんぶの できごとを ためながら すすめる。 */
function run(game: Game, frames: number, log: GameEvent[] = []) {
  for (let i = 0; i < frames; i++) { game.step(); log.push(...game.drainEvents()) }
  return log
}

describe('mato-ate world', () => {
  test('the ball flies for a while before it hits the target', () => {
    const game = createGame(base({ targets: [{ x: 200, y: 200 }, { x: 60, y: 120 }] }))
    expect(game.fire(0)).toBe(true)
    expect(game.drainEvents()).toEqual([expect.objectContaining({ type: 'fire' })])
    let hitFrame = -1
    for (let frame = 1; frame < 120 && hitFrame < 0; frame++) {
      game.step()
      if (game.drainEvents().some(e => e.type === 'hit')) hitFrame = frame
      if (hitFrame < 0) expect(game.targets[0].alive).toBe(true)
    }
    // まとに とどくまで 0.6びょう いじょう かかる。
    expect(hitFrame * STEP).toBeGreaterThan(.6)
    expect(game.targets[0].alive).toBe(false)
    expect(game.score).toBe(100)
    expect(game.balls).toHaveLength(0)
  })

  test('a solid wall stops the ball and counts as a miss', () => {
    const game = createGame(base({ walls: [{ x: 200, y: 400, w: 120, h: 20 }] }))
    game.fire(0)
    const log = run(game, 90)
    expect(log.some(e => e.type === 'block')).toBe(true)
    expect(game.targets[0].alive).toBe(true)
    expect(game.misses).toBe(1)
  })

  test('a bouncy wall reflects the ball', () => {
    const game = createGame(base({ targets: [{ x: 60, y: 120 }], walls: [{ x: 200, y: 400, w: 120, h: 20, kind: 'bouncy' }] }))
    game.fire(0)
    const log = run(game, 40)
    expect(log.some(e => e.type === 'bounce')).toBe(true)
    expect(game.balls[0].vy).toBeGreaterThan(0)
  })

  test('a blinking wall only blocks while it is visible', () => {
    const blink = { period: 4, on: .5 }
    expect(blinkActive(blink, .5)).toBe(true)
    expect(blinkActive(blink, 3)).toBe(false)
    expect(blinkAlpha(blink, 1)).toBe(1)
    expect(blinkAlpha(blink, 2.5)).toBe(0)
    expect(blinkAlpha(blink, 3.8)).toBeGreaterThan(0)
    // 見えない あいだに うてば とおりぬける。
    const game = createGame(base({ walls: [{ x: 200, y: 400, w: 200, h: 20, blink: { period: 4, on: .5, phase: .5 } }] }))
    expect(game.walls[0].active).toBe(false)
    game.fire(0)
    const log = run(game, 90)
    expect(log.some(e => e.type === 'hit')).toBe(true)
  })

  test('targets move along lines and orbits', () => {
    expect(motionOffset({ kind: 'line', dx: 100, dy: 0, period: 4 }, 1).x).toBeCloseTo(100)
    expect(motionOffset({ kind: 'orbit', radius: 50, period: 4 }, 1).y).toBeCloseTo(50)
    expect(motionOffset({ kind: 'orbit', radius: 50, period: 4, reverse: true }, 1).y).toBeCloseTo(-50)
    const game = createGame(base({ targets: [{ x: 200, y: 200, motion: { kind: 'line', dx: 100, dy: 0, period: 4 } }] }))
    run(game, 60)
    expect(game.targets[0].x).toBeCloseTo(300)
  })

  test('hard targets need two hits and combos add bonus points', () => {
    const game = createGame(base({ targets: [{ x: 200, y: 200, kind: 'hard' }, { x: 200, y: 110 }] }))
    game.fire(0)
    let log = run(game, 90)
    expect(log.find(e => e.type === 'hit')).toMatchObject({ broken: false, combo: 1, score: 50 })
    expect(game.targets[0].alive).toBe(true)
    game.fire(0)
    log = run(game, 90)
    expect(log.find(e => e.type === 'hit')).toMatchObject({ broken: true, combo: 2, score: 250 })
    game.fire(0)
    log = run(game, 90)
    expect(log.find(e => e.type === 'hit')).toMatchObject({ target: 1, combo: 3, score: 200 })
    expect(game.state).toBe('clear')
    expect(game.score).toBe(500)
  })

  test('reload time and aiming limits', () => {
    const game = createGame(base({}))
    expect(game.fire(0)).toBe(true)
    expect(game.fire(0)).toBe(false)
    run(game, Math.ceil(RELOAD / STEP))
    expect(game.fire(.2)).toBe(true)
    expect(game.ammo).toBe(3)
    expect(angleTo({ x: CANNON.x, y: 100 })).toBeCloseTo(0)
    expect(angleTo({ x: CANNON.x + 100, y: CANNON.y - 100 })).toBeCloseTo(Math.PI / 4)
    expect(angleTo({ x: 0, y: CANNON.y + 50 })).toBe(-MAX_ANGLE)
  })

  test('running out of balls fails; clearing removes balls still flying', () => {
    const fail = createGame(base({ balls: 2 }))
    fail.fire(-1)
    run(fail, 20)
    fail.fire(1)
    run(fail, 200)
    expect(fail.state).toBe('fail')
    expect(fail.misses).toBe(2)

    const clear = createGame(base({ balls: 5 }))
    clear.fire(0)
    run(clear, 20)
    clear.fire(-.4)
    const log = run(clear, 60)
    expect(clear.state).toBe('clear')
    expect(log.some(e => e.type === 'vanish')).toBe(true)
    expect(clear.balls).toHaveLength(0)
    expect(clear.misses).toBe(0)
    expect(clear.hits).toBe(1)
    expect(clear.shots).toBe(2)
    // クリアの あとは うてない。
    expect(clear.fire(0)).toBe(false)
  })

  test('gold targets are a bonus and not needed to clear', () => {
    const game = createGame(base({ targets: [{ x: 200, y: 200 }, { x: 60, y: 120, kind: 'gold' }] }))
    expect(game.targetsLeft).toBe(1)
    game.fire(0)
    run(game, 90)
    expect(game.state).toBe('clear')
  })
})
