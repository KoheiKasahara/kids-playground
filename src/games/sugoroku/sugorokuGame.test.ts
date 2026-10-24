import { describe, expect, test } from 'vitest'
import { CELL, boardRows, pieceOffset, squareCenter } from './boardLayout'
import { COURSES, PIECES, courseById, goalIndex, squareAt, type Course } from './courses'
import { createGame, createPlayers, mustRest, playTurn, ranking, remainingSquares, rollDie, skipRest, type GameState } from './sugorokuGame'

const mori = courseById('mori')

function at(state: GameState, positions: number[], turn = 0): GameState {
  return { ...state, positions, turn }
}

describe('courses', () => {
  test('コースと コマの id が かさならない', () => {
    expect(new Set(COURSES.map((course) => course.id)).size).toBe(COURSES.length)
    expect(new Set(COURSES.map((course) => course.name)).size).toBe(COURSES.length)
    expect(new Set(PIECES.map((piece) => piece.id)).size).toBe(PIECES.length)
    expect(new Set(PIECES.map((piece) => piece.color)).size).toBe(PIECES.length)
  })

  test.each(COURSES.map((course) => [course.id, course] as const))('%s: マスが だんに ぴったり ならび、できごとの いきさきは ふつうの マス', (_, course: Course) => {
    expect(course.length % course.columns).toBe(0)
    expect(squareAt(course, 0)).toEqual({ kind: 'start' })
    expect(squareAt(course, goalIndex(course))).toEqual({ kind: 'goal' })
    for (const [key, event] of Object.entries(course.events)) {
      const index = Number(key)
      // スタート・ゴールの となりには しかけを おかず、さいしょと さいごは すなおに すすめる。
      expect(index, `${course.id}:${index}`).toBeGreaterThan(1)
      expect(index, `${course.id}:${index}`).toBeLessThan(goalIndex(course) - 1)
      const target = event.kind === 'forward' ? index + event.steps
        : event.kind === 'back' ? index - event.steps
          : event.kind === 'warp' ? event.to : index
      if (event.kind === 'warp') expect(target).toBeGreaterThan(index)
      if (event.kind === 'forward' || event.kind === 'back') expect(event.steps).toBeGreaterThan(0)
      expect(target, `${course.id}:${index}`).toBeLessThan(goalIndex(course))
      if (target !== index) expect(squareAt(course, target).kind, `${course.id}:${index} → ${target}`).toBe('normal')
    }
  })

  test('コースは みじかい じゅんに ならび、ぜんぶの しかけが どこかで つかわれる', () => {
    const lengths = COURSES.map((course) => course.length)
    expect([...lengths].sort((a, b) => a - b)).toEqual(lengths)
    const kinds = new Set(COURSES.flatMap((course) => Object.values(course.events).map((event) => event.kind)))
    expect([...kinds].sort()).toEqual(['again', 'back', 'forward', 'rest', 'warp'])
  })

  test('しらない コースは さいしょの コースに する', () => {
    expect(courseById('nai' as never).id).toBe(COURSES[0]!.id)
  })
})

describe('boardLayout', () => {
  test('ジグザグに ならび、となりの マスは いつも 1マスぶん はなれる', () => {
    for (const course of COURSES) {
      expect(squareCenter(course, 0)).toEqual({ x: CELL / 2, y: CELL / 2 })
      expect(squareCenter(course, course.columns)).toEqual({ x: (course.columns - 0.5) * CELL, y: CELL * 1.5 })
      expect(squareCenter(course, goalIndex(course)).y).toBe((boardRows(course) - 0.5) * CELL)
      for (let index = 1; index < course.length; index++) {
        const a = squareCenter(course, index - 1)
        const b = squareCenter(course, index)
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBe(CELL)
      }
    }
  })

  test('おなじ マスの コマは かさならない ばしょへ ずらす', () => {
    expect(pieceOffset(0, 1)).toEqual({ x: 0, y: 0 })
    for (const together of [2, 3, 4]) {
      const offsets = Array.from({ length: together }, (_, slot) => pieceOffset(slot, together))
      expect(new Set(offsets.map((offset) => `${offset.x},${offset.y}`)).size).toBe(together)
    }
  })
})

describe('sugorokuGame', () => {
  test('ひとりの ときは コンピュータの くまさんと、ふたり いじょうは みんな ひとで あそぶ', () => {
    expect(createPlayers(1)).toEqual([{ piece: 'usagi', computer: false }, { piece: 'kuma', computer: true }])
    expect(createPlayers(3)).toEqual([
      { piece: 'usagi', computer: false }, { piece: 'kuma', computer: false }, { piece: 'neko', computer: false },
    ])
    expect(createPlayers(9)).toHaveLength(4)
    expect(createPlayers(0)).toHaveLength(2)
    const game = createGame('umi', 4)
    expect(game.positions).toEqual([0, 0, 0, 0])
    expect(game.resting).toEqual([false, false, false, false])
    expect(game).toMatchObject({ course: 'umi', turn: 0, winner: null })
  })

  test('サイコロは 1〜6', () => {
    expect(rollDie(() => 0)).toBe(1)
    expect(rollDie(() => 0.5)).toBe(4)
    expect(rollDie(() => 0.9999)).toBe(6)
    expect(rollDie(() => 1)).toBe(6)
  })

  test('でた めの かずだけ 1マスずつ すすみ、つぎの ひとの ばんに なる', () => {
    const plan = playTurn(createGame('mori', 2), 2)
    expect(plan).toMatchObject({ player: 0, roll: 2, walk: [1, 2], event: null, eventWalk: [], goal: false })
    expect(plan.next.positions).toEqual([2, 0])
    expect(plan.next.turn).toBe(1)
    expect(playTurn(plan.next, 1).next.turn).toBe(0)
  })

  test('すすむ・もどる・ワープは とまった あとに うごき、つぎの しかけは よばない', () => {
    const game = createGame('mori', 2)
    const forward = playTurn(game, 3)
    expect(forward).toMatchObject({ walk: [1, 2, 3], event: { kind: 'forward', steps: 2 }, eventWalk: [4, 5] })
    expect(forward.next.positions[0]).toBe(5)

    const back = playTurn(at(game, [5, 0]), 3)
    expect(back).toMatchObject({ walk: [6, 7, 8], event: { kind: 'back', steps: 1 }, eventWalk: [7] })
    expect(back.next.positions[0]).toBe(7)

    const warp = playTurn(at(game, [9, 0]), 2)
    expect(warp).toMatchObject({ walk: [10, 11], event: { kind: 'warp', to: 15 }, eventWalk: [15] })
    expect(warp.next.positions[0]).toBe(15)
  })

  test('もういちどの マスでは おなじ ひとが また ふれる', () => {
    const plan = playTurn(at(createGame('mori', 2), [0, 4], 1), 2)
    expect(plan.event).toEqual({ kind: 'again' })
    expect(plan.next.turn).toBe(1)
  })

  test('やすみの マスに とまると、つぎの じぶんの ばんを 1かい とばす', () => {
    const plan = playTurn(at(createGame('mori', 2), [10, 0]), 3)
    expect(plan.event).toEqual({ kind: 'rest' })
    expect(plan.next.resting).toEqual([true, false])
    const other = playTurn(plan.next, 1)
    expect(other.next.turn).toBe(0)
    expect(mustRest(other.next)).toBe(true)
    const skipped = skipRest(other.next)
    expect(skipped).toMatchObject({ turn: 1, resting: [false, false], positions: [13, 1] })
    expect(mustRest(skipped)).toBe(false)
    expect(skipRest(skipped)).toBe(skipped)
  })

  test('ゴールを こえる めでも ゴールで とまって かち', () => {
    const goal = goalIndex(mori)
    const plan = playTurn(at(createGame('mori', 3), [0, goal - 2, 0], 1), 6)
    expect(plan.walk).toEqual([goal - 1, goal])
    expect(plan).toMatchObject({ goal: true, event: null })
    expect(plan.next).toMatchObject({ winner: 1, turn: 1 })
    expect(remainingSquares(plan.next, 1)).toBe(0)
    expect(remainingSquares(plan.next, 0)).toBe(goal)
    expect(mustRest({ ...plan.next, resting: [false, true, false] })).toBe(false)
  })

  test('できごとで スタートより まえ・ゴールより さきへは いかない', () => {
    const course: Course = { id: 'mori', name: 'test', tagline: '', columns: 5, length: 10, events: { 2: { kind: 'back', steps: 5 }, 7: { kind: 'forward', steps: 5 } } }
    const game = createGame('mori', 2)
    expect(playTurn(game, 2, course)).toMatchObject({ eventWalk: [1, 0], goal: false })
    const forward = playTurn(at(game, [6, 0]), 1, course)
    expect(forward).toMatchObject({ eventWalk: [8, 9], goal: true })
    expect(forward.next.winner).toBe(0)
  })

  test('じゅんいは ゴールした ひとが 1い、のこりは ちかい じゅんで、おなじ マスは おなじ くらい', () => {
    const state: GameState = { ...createGame('mori', 4), positions: [12, 19, 12, 15], winner: 1 }
    expect(ranking(state)).toEqual([
      { player: 1, place: 1 }, { player: 3, place: 2 }, { player: 0, place: 3 }, { player: 2, place: 3 },
    ])
  })
})
