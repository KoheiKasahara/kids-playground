import { describe, expect, test } from 'vitest'
import { CANNON, DIFFICULTIES, LEVELS, WORLD, levelFeatures, requiredHits, starsFor, type Feature } from './levels'
import { MAX_ANGLE, angleTo, createGame, motionOffset, simulateShot, type Game } from './world'

/** いま うてば クリアに ひつような まとに あたる かくどを さがす（なければ null）。 */
function findShot(game: Game): number | null {
  for (let a = -MAX_ANGLE; a <= MAX_ANGLE; a += .01) {
    const hit = simulateShot(game, a)
    if (hit !== null && game.targets[hit].kind !== 'gold') return a
  }
  return null
}

/** とんでいる たまが ないときに だけ、あたる かくどを さがして うつ ロボット。 */
function autoplay(index: number) {
  const game = createGame(LEVELS[index])
  for (let frame = 0; frame < 60 * 90 && game.state === 'play'; frame++) {
    if (game.balls.length === 0 && game.canFire() && frame % 4 === 0) {
      const angle = findShot(game)
      if (angle !== null) game.fire(angle)
    }
    game.step()
  }
  return game
}

describe('mato-ate levels', () => {
  test('every difficulty has stages and names are unique', () => {
    expect(new Set(LEVELS.map(l => l.name)).size).toBe(LEVELS.length)
    for (const d of DIFFICULTIES) expect(LEVELS.filter(l => l.difficulty === d.id).length).toBeGreaterThanOrEqual(3)
    // やさしい じゅんに ならんでいる。
    const order = LEVELS.map(l => DIFFICULTIES.findIndex(d => d.id === l.difficulty))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  test('shapes are valid and everything stays inside the stage', () => {
    for (const level of LEVELS) {
      expect(level.balls, level.name).toBeGreaterThanOrEqual(requiredHits(level) + 2)
      for (const t of level.targets) {
        for (let time = 0; time < 12; time += .1) {
          const o = motionOffset(t.motion, time)
          expect(t.x + o.x, level.name).toBeGreaterThanOrEqual(20)
          expect(t.x + o.x, level.name).toBeLessThanOrEqual(WORLD.width - 20)
          expect(t.y + o.y, level.name).toBeGreaterThanOrEqual(80)
          expect(t.y + o.y, level.name).toBeLessThan(CANNON.y - 160)
        }
      }
      for (const w of level.walls) {
        const isCircle = w.r !== undefined
        const isRect = w.w !== undefined && w.h !== undefined
        expect(isCircle !== isRect, `${level.name}: wall must be a circle or a rectangle`).toBe(true)
      }
    }
  })

  test.each(LEVELS.map((level, i) => [i, level.name] as const))('stage %i (%s) can be cleared by careful aiming', index => {
    const game = autoplay(index)
    expect(game.state).toBe('clear')
    expect(starsFor(game.misses)).toBe(3)
  })

  test('the bouncy stage needs a bank shot to reach the target behind the wall', () => {
    const index = LEVELS.findIndex(l => l.name === 'ぽよんと はねかえり')
    const game = autoplay(index)
    expect(game.state).toBe('clear')
    expect(game.drainEvents().some(e => e.type === 'bounce')).toBe(true)
  })

  test('each gimmick shows up somewhere and harder stages bring new ones', () => {
    const all = new Set(LEVELS.flatMap(levelFeatures))
    expect([...all].sort()).toEqual((['blink', 'bouncy', 'gold', 'guard', 'hard', 'move', 'slide', 'wall'] as Feature[]).sort())
    const seen = new Set<Feature>()
    for (const d of DIFFICULTIES) {
      const fresh = LEVELS.filter(l => l.difficulty === d.id).flatMap(levelFeatures).filter(f => !seen.has(f))
      expect(fresh.length, d.label).toBeGreaterThan(0)
      fresh.forEach(f => seen.add(f))
    }
  })

  test('timing gimmicks are at most two per stage (moving targets count once, each sliding or blinking wall counts)', () => {
    for (const level of LEVELS) {
      const timedWalls = level.walls.filter(w => w.r === undefined && (w.motion || w.blink)).length
      const movingTargets = level.targets.some(t => t.motion) ? 1 : 0
      expect(timedWalls + movingTargets, level.name).toBeLessThanOrEqual(2)
    }
  })

  test('behind a fixed wall, aiming at the middle of a still target hits it', () => {
    for (const [i, level] of LEVELS.entries()) {
      if (level.walls.some(w => w.motion || w.blink || w.kind === 'bouncy')) continue
      level.targets.forEach((t, ti) => {
        if (t.motion) return
        // ほかの まとは もう たおした ことに して、この まとだけを ねらう。
        const game = createGame(level, { hp: level.targets.map((_, j) => (j === ti ? 1 : 0)) })
        expect(simulateShot(game, angleTo(t)), `stage ${i} target ${ti}`).toBe(ti)
      })
    }
  })

  test('the moving target behind the wall is easy to reach by aiming at its middle', () => {
    const level = LEVELS.find(l => l.name === 'かべの むこう')!
    const index = level.targets.findIndex(t => t.motion)
    const period = level.targets[index].motion!.period
    let hits = 0, tries = 0
    for (let time = 0; time < period; time += .05, tries++) {
      const game = createGame(level, { time, hp: level.targets.map((_, j) => (j === index ? 1 : 0)) })
      const o = motionOffset(level.targets[index].motion, time)
      if (simulateShot(game, angleTo({ x: level.targets[index].x + o.x, y: level.targets[index].y + o.y })) === index) hits++
    }
    expect(hits / tries).toBeGreaterThan(.2)
  })

  test('stars depend on misses', () => {
    expect([0, 1, 2, 3, 4, 9].map(starsFor)).toEqual([3, 3, 2, 2, 1, 1])
  })
})
