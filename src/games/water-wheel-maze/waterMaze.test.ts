import { beforeEach, describe, expect, test } from 'vitest'
import { WaterMaze } from './waterMaze'
import { CATCH_ROW, DISC, GRID_HEIGHT, GRID_WIDTH, POOL_RADIUS, RING_SLOTS, buildFixedWalls, gridIndex } from './scene'
import { STAGES } from './stages'
import type { Ring } from './rings'

/** テストの あいだは さいころを 固定して、おなじ けっかが 出るようにする。 */
let seed = 0
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
beforeEach(() => { seed = 20240915 })

/** そとの わっかだけに すきまの ない かべを持つ、いちばん たんじゅんな めいろ。 */
const closedRings: Ring[] = [{ slot: 0, gaps: [] }, { slot: 4, gaps: [] }]
/** した（90度）に すきまが そろった めいろ。まわさずに 水が おちる。 */
const openRings: Ring[] = [
  { slot: 0, gaps: [{ center: 90, width: 60 }] },
  { slot: 4, gaps: [{ center: 90, width: 60 }] },
]

function run(maze: WaterMaze, steps: number, spin = 0) {
  for (let step = 0; step < steps; step++) {
    if (spin) maze.rotate(spin)
    maze.step()
  }
}

function waterInsideWalls(maze: WaterMaze): number {
  let count = 0
  for (let index = 0; index < maze.water.length; index++) {
    if (maze.water[index] === 0) continue
    const x = index % GRID_WIDTH
    if (maze.isWall(x, (index - x) / GRID_WIDTH)) count++
  }
  return count
}

describe('はじめの ばんめん', () => {
  test('まんなかの みずたまりに 水を おき、かぞえられる', () => {
    const maze = new WaterMaze(closedRings, random)
    expect(maze.total).toBeGreaterThan(200)
    expect(maze.remaining).toBe(maze.total)
    expect(maze.caught).toBe(0)
    expect(maze.rotation).toBe(0)
  })

  test('水は みずたまりの 中だけに ある', () => {
    const maze = new WaterMaze(closedRings, random)
    for (let index = 0; index < maze.water.length; index++) {
      if (maze.water[index] === 0) continue
      const x = index % GRID_WIDTH
      const y = (index - x) / GRID_WIDTH
      expect(Math.hypot(x + 0.5 - DISC.x, y + 0.5 - DISC.y)).toBeLessThan(POOL_RADIUS)
    }
  })
})

describe('かべ', () => {
  test('すきまの ない わっかは、まわしても どこも かべのまま', () => {
    const maze = new WaterMaze(closedRings, random)
    const onRing = (degrees: number) => {
      const radians = degrees * Math.PI / 180
      const radius = (RING_SLOTS[4].inner + RING_SLOTS[4].outer) / 2
      return maze.isWall(Math.round(DISC.x + Math.cos(radians) * radius), Math.round(DISC.y + Math.sin(radians) * radius))
    }
    for (const degrees of [0, 45, 90, 180, 270]) expect(onRing(degrees)).toBe(true)
    maze.rotate(37)
    for (const degrees of [0, 45, 90, 180, 270]) expect(onRing(degrees)).toBe(true)
  })

  test('すきまは 円盤と いっしょに まわる', () => {
    const maze = new WaterMaze([{ slot: 4, gaps: [{ center: 90, width: 30 }] }], random)
    const radius = (RING_SLOTS[4].inner + RING_SLOTS[4].outer) / 2
    const at = (degrees: number) => {
      const radians = degrees * Math.PI / 180
      return maze.isWall(Math.round(DISC.x + Math.cos(radians) * radius), Math.round(DISC.y + Math.sin(radians) * radius))
    }
    expect(at(90)).toBe(false)
    expect(at(180)).toBe(true)
    maze.rotate(90)
    expect(at(90)).toBe(true)
    expect(at(180)).toBe(false)
  })

  test('ばんめんの そとは かべ あつかいで、つぶが こぼれない', () => {
    const maze = new WaterMaze(closedRings, random)
    expect(maze.isWall(-1, 50)).toBe(true)
    expect(maze.isWall(GRID_WIDTH, 50)).toBe(true)
    expect(maze.isWall(50, GRID_HEIGHT)).toBe(true)
  })

  test('うごかない シュートの かべは 回転しても のこる', () => {
    const fixed = buildFixedWalls()
    const wall = fixed.findIndex((cell) => cell === 1)
    expect(wall).toBeGreaterThanOrEqual(0)
    const maze = new WaterMaze(closedRings, random)
    const x = wall % GRID_WIDTH
    const y = (wall - x) / GRID_WIDTH
    expect(maze.isWall(x, y)).toBe(true)
    maze.rotate(123)
    expect(maze.isWall(x, y)).toBe(true)
  })
})

describe('水の ながれ', () => {
  test('すきまが よこを むいている あいだは、まわさなければ 水は おちない', () => {
    const maze = new WaterMaze(STAGES[0].rings, random)
    run(maze, 400)
    expect(maze.caught).toBe(0)
    expect(maze.remaining).toBe(maze.total)
  })

  test('すきまが したに そろっていれば、まわさなくても すいしゃへ とどく', () => {
    const maze = new WaterMaze(openRings, random)
    run(maze, 400)
    expect(maze.caught).toBeGreaterThan(0)
    expect(maze.caught + maze.remaining).toBe(maze.total)
  })

  test('水は かってに ふえも へりもしない', () => {
    const maze = new WaterMaze(STAGES[2].rings, random)
    for (let step = 0; step < 600; step++) {
      maze.rotate(2)
      maze.step()
      expect(maze.caught + maze.remaining).toBe(maze.total)
    }
  })

  test('とどいた 水は CATCH_ROW より 下に のこらない', () => {
    const maze = new WaterMaze(openRings, random)
    run(maze, 400)
    for (let y = CATCH_ROW; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) expect(maze.water[gridIndex(x, y)]).toBe(0)
    }
  })

  test('水が おちつくと うごきが とまる', () => {
    const maze = new WaterMaze(STAGES[0].rings, random)
    run(maze, 600, 2)
    run(maze, 900)
    expect(maze.activity).toBe(0)
  }, 15_000)
})

describe('円盤を まわす', () => {
  test('まわすと むきが 0..359 に おさまる', () => {
    const maze = new WaterMaze(closedRings, random)
    maze.rotate(400)
    expect(maze.rotation).toBe(40)
    maze.rotate(-80)
    expect(maze.rotation).toBe(320)
  })

  test('いっきに まわしても 水は かべを すり抜けない', () => {
    const maze = new WaterMaze(STAGES[0].rings, random)
    for (let step = 0; step < 200; step++) {
      maze.rotate(180)
      maze.step()
    }
    expect(maze.caught + maze.remaining).toBe(maze.total)
    expect(waterInsideWalls(maze)).toBe(0)
  })

  test('かべに のみこまれた つぶは おし出される', () => {
    const maze = new WaterMaze(STAGES[3].rings, random)
    run(maze, 300, 3)
    run(maze, 600)
    expect(waterInsideWalls(maze)).toBe(0)
  })
})

describe('やりなおし', () => {
  test('はじめの ばんめんに もどる', () => {
    const maze = new WaterMaze(STAGES[0].rings, random)
    run(maze, 400, 2)
    expect(maze.caught).toBeGreaterThan(0)
    maze.reset()
    expect(maze.caught).toBe(0)
    expect(maze.rotation).toBe(0)
    expect(maze.remaining).toBe(maze.total)
    expect(maze.activity).toBe(0)
  })
})
