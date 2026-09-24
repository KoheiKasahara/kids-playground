import { describe, expect, test } from 'vitest'
import {
  CONSTELLATIONS,
  COURSE_CONSTELLATION_IDS,
  centerOf,
  courseConstellations,
  createBoard,
  findStarNear,
  isComplete,
  tapStar,
  type BoardState,
  type Constellation,
} from './hoshiGame'

const fish = CONSTELLATIONS.find((item) => item.id === 'fish')!

function connectAll(constellation: Constellation): { board: BoardState; results: string[] } {
  let board = createBoard()
  const results: string[] = []
  constellation.points.forEach((_, index) => {
    const step = tapStar(board, constellation, index)
    board = step.board
    results.push(step.result)
  })
  return { board, results }
}

describe('星座データ', () => {
  test('idに重複がなく、星はすべて0〜100の中にあり、同じ位置の星がない', () => {
    const ids = CONSTELLATIONS.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const constellation of CONSTELLATIONS) {
      expect(constellation.points.length).toBeGreaterThanOrEqual(5)
      for (const [x, y] of constellation.points) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(100)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(100)
      }
      const keys = constellation.points.map(([x, y]) => `${x},${y}`)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  test('となりあう星は、指でふれる範囲が重ならないくらい離れている', () => {
    for (const constellation of CONSTELLATIONS) {
      constellation.points.forEach(([x, y], index) => {
        constellation.points.slice(index + 1).forEach(([otherX, otherY]) => {
          expect(Math.hypot(x - otherX, y - otherY)).toBeGreaterThanOrEqual(10)
        })
      })
    }
  })

  test('コースは実在する星座だけを重複なく参照し、かんたん → ふつう → むずかしい の順に星が多くなる', () => {
    const courses = (['easy', 'normal', 'hard'] as const).map((course) => {
      const constellations = courseConstellations(course)
      expect(constellations.length).toBe(8)
      expect(constellations.length).toBe(COURSE_CONSTELLATION_IDS[course].length)
      return constellations.map((item) => item.points.length)
    })
    const all = [...COURSE_CONSTELLATION_IDS.easy, ...COURSE_CONSTELLATION_IDS.normal, ...COURSE_CONSTELLATION_IDS.hard]
    expect(new Set(all).size).toBe(all.length)
    for (let index = 1; index < courses.length; index += 1) {
      expect(Math.max(...courses[index - 1]!)).toBeLessThan(Math.min(...courses[index]!))
    }
  })
})

describe('tapStar', () => {
  test('1から順につなぐと、最後の星で complete になる', () => {
    const { board, results } = connectAll(fish)
    expect(results.slice(0, -1).every((result) => result === 'connect')).toBe(true)
    expect(results.at(-1)).toBe('complete')
    expect(isComplete(board, fish)).toBe(true)
  })

  test('ちがう星をさわると wrong になり、つぎの星を光らせるヒントが出る。正しくつなぐと消える', () => {
    const wrong = tapStar(createBoard(), fish, 3)
    expect(wrong.result).toBe('wrong')
    expect(wrong.board).toEqual({ connected: 0, hint: true })
    const right = tapStar(wrong.board, fish, 0)
    expect(right.result).toBe('connect')
    expect(right.board).toEqual({ connected: 1, hint: false })
  })

  test('もうつないだ星・範囲外・できあがったあとは何もしない', () => {
    const board: BoardState = { connected: 2, hint: false }
    expect(tapStar(board, fish, 0)).toEqual({ board, result: 'none' })
    expect(tapStar(board, fish, -1)).toEqual({ board, result: 'none' })
    expect(tapStar(board, fish, 99)).toEqual({ board, result: 'none' })
    const done = connectAll(fish).board
    expect(tapStar(done, fish, 0)).toEqual({ board: done, result: 'none' })
  })
})

describe('findStarNear / centerOf', () => {
  test('ふれられる距離の中で、いちばん近い星をかえす', () => {
    const [x, y] = fish.points[2]!
    expect(findStarNear(fish, x + 2, y - 1, 7)).toBe(2)
    expect(findStarNear(fish, 50, 50, 1)).toBeUndefined()
  })

  test('中心は星の上下左右のまんなか', () => {
    expect(centerOf(fish)).toEqual([50, 50])
  })
})
