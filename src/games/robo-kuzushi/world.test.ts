import { describe, expect, test } from 'vitest'
import Matter from 'matter-js'
import { BALLOON_R, balloonAt, GROUND_Y, LEVELS, ROBOT_SIZE, SLING, SPRING_H, type BallKind, type Level, type Piece, type Point } from './levels'
import { BALL_BONUS, clampPull, createGame, launchVelocity, MAX_PULL, MAX_SPEED, predictPath, type Game, type GameEvent } from './world'

const pullAt = (degrees: number, length: number) => ({ x: -Math.cos(degrees * Math.PI / 180) * length, y: Math.sin(degrees * Math.PI / 180) * length })

function settle(game: Game, limit = 900) {
  for (let i = 0; i < limit && game.state === 'flying'; i++) game.step()
}

/** たしかめたい しかけ だけを おいた ちいさな ステージ。 */
function testLevel(balls: BallKind[], pieces: Piece[]): Level {
  return { name: 'てすと', hint: 'てすと', width: 1400, balls, pieces }
}

const post = (x: number, h: number, material: 'wood' | 'ice' | 'stone'): Piece => ({ type: 'block', material, x, y: GROUND_Y - h / 2, w: 24, h })
const groundRobot = (x: number, kind?: 'helmet'): Extract<Piece, { type: 'robot' }> => ({ type: 'robot', x, y: GROUND_Y - ROBOT_SIZE / 2, size: ROBOT_SIZE, kind })

/** みちすじの てんが target の ちかくを とおる ひっぱりかたを さがす。 */
function aimThrough(level: Level, kind: BallKind, target: Point, avoid?: Point) {
  for (let deg = -10; deg <= 80; deg += 1) {
    for (let len = 40; len <= MAX_PULL; len += 4) {
      const pull = pullAt(deg, len)
      const path = predictPath(pull, kind, 90, 1, level)
      const hit = path.findIndex(p => Math.hypot(p.x - target.x, p.y - target.y) < 14)
      if (hit < 0) continue
      if (avoid && path.slice(0, hit + 20).some(p => Math.hypot(p.x - avoid.x, p.y - avoid.y) < 60)) continue
      return pull
    }
  }
  throw new Error('ねらえる うちかたが ない')
}

function drain(game: Game, frames: number) {
  const events: GameEvent[] = []
  for (let i = 0; i < frames; i++) { game.step(); events.push(...game.drainEvents()) }
  return events
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
      for (let i = 0; i < 317; i++) game.step()
      expect(game.robotsLeft, level.name).toBe(level.pieces.filter(p => p.type === 'robot').length)
      // うごく かべ だけは うごいていて よい。
      game.pieces.forEach((p, i) => p.kind !== 'mover' && expect(Math.hypot(p.body.position.x - before[i].x, p.body.position.y - before[i].y), level.name).toBeLessThan(4))
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

  test('a bomb bursts at the first touch and breaks even stone', () => {
    const game = createGame(testLevel(['bomb'], [post(700, 160, 'stone'), groundRobot(800)]))
    game.launch(pullAt(0, 120))
    const events: GameEvent[] = []
    for (let i = 0; i < 60 && !events.some(e => e.type === 'blast'); i++) { game.step(); events.push(...game.drainEvents()) }
    expect(events).toContainEqual(expect.objectContaining({ type: 'blast', source: 'bomb' }))
    expect(game.projectiles).toHaveLength(0)
    game.step()
    expect(game.pieces.some(p => p.material === 'stone')).toBe(false)
    expect(game.robotsLeft).toBe(0)
    game.destroy()
  })

  test('the drill runs through wood, ice and robots but stops at stone', () => {
    const game = createGame(testLevel(['drill'], [post(600, 200, 'wood'), post(680, 200, 'ice'), groundRobot(760), post(860, 200, 'stone')]))
    game.launch(pullAt(0, 120))
    const events = drain(game, 120)
    expect(events.filter(e => e.type === 'pierce')).toHaveLength(3)
    expect(game.robotsLeft).toBe(0)
    expect(game.pieces.map(p => p.material ?? p.kind).sort()).toEqual(['stone'])
    game.destroy()
  })

  test('a popped balloon drops its robot, which a helmet robot survives without its helmet', () => {
    for (const kind of [undefined, 'helmet'] as const) {
      const hanging = { ...groundRobot(800, kind), y: 380 - ROBOT_SIZE / 2, balloon: 60 }
      const level = testLevel(['normal'], [hanging])
      const game = createGame(level)
      const balloon = balloonAt(hanging)!
      game.launch(aimThrough(level, 'normal', balloon, { x: hanging.x, y: hanging.y }))
      const events = drain(game, 200)
      expect(events.filter(e => e.type === 'pop')).toHaveLength(1)
      expect(game.pieces.some(p => p.kind === 'balloon')).toBe(false)
      if (kind === 'helmet') {
        expect(game.robotsLeft).toBe(1)
        expect(events.some(e => e.type === 'helmet')).toBe(true)
        expect(game.pieces.find(p => p.kind === 'robot')!.helmet).toBe(false)
      } else {
        expect(game.robotsLeft).toBe(0)
      }
      game.destroy()
    }
  })

  test('a hanging robot stays put until its balloon pops', () => {
    const level = testLevel(['normal'], [{ ...groundRobot(800), y: 300, balloon: 80 }])
    const game = createGame(level)
    const robot = game.pieces.find(p => p.kind === 'robot')!
    Matter.Sleeping.set(robot.body, false)
    for (let i = 0; i < 200; i++) game.step()
    expect(robot.body.position.y).toBeCloseTo(300, 0)
    expect(balloonAt(level.pieces[0])!.y + BALLOON_R).toBeLessThan(300 - ROBOT_SIZE / 2)
    game.destroy()
  })

  test('the trampoline throws whatever lands on it back up', () => {
    const spring: Piece = { type: 'spring', x: 760, y: GROUND_Y - SPRING_H / 2, w: 140 }
    const level = testLevel(['normal'], [spring, groundRobot(1300)])
    const game = createGame(level)
    game.launch(aimThrough(level, 'normal', { x: 760, y: GROUND_Y - SPRING_H - 22 }))
    let bounced: Point | null = null
    for (let i = 0; i < 200 && !bounced; i++) {
      game.step()
      if (game.drainEvents().some(e => e.type === 'spring')) bounced = { ...game.projectiles[0].body.velocity }
    }
    expect(bounced).not.toBeNull()
    expect(bounced!.y).toBeLessThan(-12)
    expect(bounced!.x).toBeGreaterThan(0)
    game.destroy()
  })

  test('a portal moves the ball to its exit, and the aim dots warp the same way', () => {
    const level = testLevel(['normal'], [{ type: 'portal', x: 640, y: 380, to: { x: 1100, y: 300 } }, groundRobot(1300)])
    const jumps = (path: Point[]) => path.some((p, i) => i > 0 && Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y) > 300)
    let pull: Point | null = null
    for (let deg = 0; deg <= 60 && !pull; deg += 2) for (let len = 60; len <= MAX_PULL && !pull; len += 6) {
      if (jumps(predictPath(pullAt(deg, len), 'normal', 60, 1, level))) pull = pullAt(deg, len)
    }
    expect(pull).not.toBeNull()
    // ワープの ない みちすじは とばない。
    expect(jumps(predictPath(pull!, 'normal', 60, 1))).toBe(false)
    const path = predictPath(pull!, 'normal', 60, 1, level)
    const game = createGame(level)
    game.launch(pull!)
    const events: GameEvent[] = []
    for (let i = 0; i < 60 && game.projectiles.length; i++) {
      game.step()
      events.push(...game.drainEvents())
      // ぶつかるか せかいの そとへ でたら よそうは おわり。
      if (events.some(e => e.type === 'hit') || !game.projectiles.length) break
      const p = game.projectiles[0].body.position
      expect(p.x).toBeCloseTo(path[i].x, 3)
      expect(p.y).toBeCloseTo(path[i].y, 3)
    }
    expect(events.filter(e => e.type === 'warp')).toHaveLength(1)
    game.destroy()
  })

  test('the fan carries a ball up, and the aim dots ride the same wind', () => {
    const level = testLevel(['normal'], [{ type: 'fan', x: 700, w: 140, top: 200 }, groundRobot(1300)])
    const pull = pullAt(15, 90)
    const still = predictPath(pull, 'normal', 60, 1)
    const blown = predictPath(pull, 'normal', 60, 1, level)
    expect(Math.min(...blown.map(p => p.y))).toBeLessThan(Math.min(...still.map(p => p.y)) - 100)
    const game = createGame(level)
    game.launch(pull)
    for (let i = 0; i < 60; i++) {
      game.step()
      expect(game.projectiles[0].body.position.y).toBeCloseTo(blown[i].y, 3)
    }
    game.destroy()
  })

  test('the moving wall goes back and forth on its own', () => {
    const game = createGame(testLevel(['normal'], [{ type: 'mover', x: 800, y: 360, w: 30, h: 160, dx: 0, dy: 80, period: 120 }, groundRobot(1300)]))
    const wall = game.pieces.find(p => p.kind === 'mover')!
    const ys: number[] = []
    for (let i = 0; i < 120; i++) { game.step(); ys.push(wall.body.position.y) }
    expect(Math.max(...ys)).toBeCloseTo(440, 0)
    expect(Math.min(...ys)).toBeCloseTo(280, 0)
    expect(ys[ys.length - 1]).toBeCloseTo(360, 0)
    game.destroy()
  })

  test('the bouncy ball keeps its speed off a wall, unlike the red ball', () => {
    const rebound = (kind: BallKind) => {
      const game = createGame(testLevel([kind], [{ type: 'steel', x: 700, y: GROUND_Y - 150, w: 30, h: 300 }, groundRobot(1300)]))
      game.launch(pullAt(5, 100))
      let before = 0
      for (let i = 0; i < 60; i++) {
        const v = { ...game.projectiles[0].body.velocity }
        game.step()
        if (v.x > 0 && game.projectiles[0].body.velocity.x < 0) { before = v.x; break }
      }
      const after = -game.projectiles[0].body.velocity.x
      game.destroy()
      return after / before
    }
    expect(rebound('bouncy')).toBeGreaterThan(.8)
    expect(rebound('normal')).toBeLessThan(.5)
  })

  // 新しい ステージは ねらった とおりに うてば しかけを つかって クリアできる。
  const SOLUTIONS: Record<string, { shots: [number, number, number?][]; uses?: GameEvent['type'] }> = {
    'ドッカン ばくだん': { shots: [[20, 90], [-20, 120]], uses: 'blast' },
    'ふうせん ロボ': { shots: [[30, 120], [-20, 105]], uses: 'pop' },
    'つきぬけ ドリル': { shots: [[10, 105], [-20, 120]], uses: 'pierce' },
    'トランポリン': { shots: [[0, 75], [-20, 75]], uses: 'spring' },
    'ワープ ゲート': { shots: [[35, 105], [60, 75]], uses: 'warp' },
    'かぜの エレベーター': { shots: [[10, 90], [30, 120]] },
    'ヘルメット ロボ': { shots: [[-20, 105], [-20, 75]], uses: 'helmet' },
    'うごく かべ': { shots: [[10, 120, 80], [-20, 75]] },
    'ぽよんぽよん': { shots: [[50, 90], [25, 120]] },
    'おやぶんロボの しろ': { shots: [[75, 120], [-5, 120]], uses: 'pop' },
  }
  test.each(Object.entries(SOLUTIONS))('%s can be cleared with the planned shots', (name, { shots, uses }) => {
    const game = createGame(LEVELS.find(l => l.name === name)!)
    const events: GameEvent[] = []
    for (const [deg, len, wait = 0] of shots) {
      events.push(...drain(game, wait))
      expect(game.launch(pullAt(deg, len))).toBe(true)
      for (let i = 0; i < 1200 && game.state === 'flying'; i++) { game.step(); events.push(...game.drainEvents()) }
    }
    for (let i = 0; i < 200 && game.state === 'aim'; i++) game.step()
    expect(game.state).toBe('clear')
    if (uses) expect(events.some(e => e.type === uses)).toBe(true)
    game.destroy()
  })
})
