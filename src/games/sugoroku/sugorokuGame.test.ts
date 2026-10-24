import { describe, expect, test } from 'vitest'
import { CELL, boardSize, cameraFor, gridToBoard, landmarkCells, pieceOffset, roadPath, scatterScenery, squareCenter, viewSize } from './boardLayout'
import { COURSES, PIECES, courseById, goalIndex, squareAt, traceRoute, type Course } from './courses'
import { createGame, createPlayers, drawWarp, mustRest, playTurn, ranking, remainingSquares, rollDie, skipRest, type GameState } from './sugorokuGame'

const mori = courseById('mori')
const key = (cell: { x: number; y: number }) => `${cell.x},${cell.y}`

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

  test('みちじゅんを マスめの ならびに する', () => {
    expect(traceRoute('R2 D1 L1')).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 }])
    expect(() => traceRoute('R2 X1')).toThrow()
    expect(() => traceRoute('R0')).toThrow()
  })

  test.each(COURSES.map((course) => [course.id, course] as const))('%s: みちは かさならず、はなれた マスどうしは くっつかない', (_, course: Course) => {
    expect(course.length).toBe(course.path.length)
    expect(new Set(course.path.map(key)).size).toBe(course.length)
    for (let index = 1; index < course.length; index++) {
      const a = course.path[index - 1]!
      const b = course.path[index]!
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1)
    }
    // みちを まちがえない ように、3マス いじょう はなれた マスは ななめでも となりあわない。
    for (let i = 0; i < course.length; i++) {
      for (let j = i + 3; j < course.length; j++) {
        const a = course.path[i]!
        const b = course.path[j]!
        expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)), `${course.id}: ${i} と ${j}`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  test.each(COURSES.map((course) => [course.id, course] as const))('%s: おりかえすだけで なく、いろいろな むきへ なんども まがる', (_, course: Course) => {
    // ジグザグの おりかえしだけの たんちょうな コースに もどらない ように する。
    let turns = 0
    for (let index = 2; index < course.length; index++) {
      const [a, b, c] = [course.path[index - 2]!, course.path[index - 1]!, course.path[index]!]
      if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) turns += 1
    }
    expect(turns).toBeGreaterThanOrEqual(6)
    const directions = new Set(course.path.slice(1).map((cell, index) => key({ x: cell.x - course.path[index]!.x, y: cell.y - course.path[index]!.y })))
    expect(directions.size).toBeGreaterThanOrEqual(3)
  })

  test.each(COURSES.map((course) => [course.id, course] as const))('%s: できごとの いきさきは ふつうの マス', (_, course: Course) => {
    expect(squareAt(course, 0)).toEqual({ kind: 'start' })
    expect(squareAt(course, goalIndex(course))).toEqual({ kind: 'goal' })
    for (const [indexKey, event] of Object.entries(course.events)) {
      const index = Number(indexKey)
      // スタート・ゴールの となりには しかけを おかず、さいしょと さいごは すなおに すすめる。
      expect(index, `${course.id}:${index}`).toBeGreaterThan(1)
      expect(index, `${course.id}:${index}`).toBeLessThan(goalIndex(course) - 1)
      const targets = event.kind === 'forward' ? [index + event.steps]
        : event.kind === 'back' ? [index - event.steps]
          : event.kind === 'warp' ? event.to : []
      if (event.kind === 'forward' || event.kind === 'back') expect(event.steps).toBeGreaterThan(0)
      if (event.kind === 'warp') {
        expect(event.to.length).toBeGreaterThanOrEqual(2)
        expect(new Set(event.to).size).toBe(event.to.length)
        // くじびきでも たいていは さきへ とぶ。
        expect(event.to.filter((target) => target > index).length).toBeGreaterThan(event.to.length / 2)
      }
      for (const target of targets) {
        expect(target, `${course.id}:${index}`).toBeGreaterThan(0)
        expect(target, `${course.id}:${index}`).toBeLessThan(goalIndex(course))
        expect(squareAt(course, target).kind, `${course.id}:${index} → ${target}`).toBe('normal')
      }
    }
  })

  test.each(COURSES.map((course) => [course.id, course] as const))('%s: めじるしは みちに かからず、たがいに かさならない', (_, course: Course) => {
    const path = new Set(course.path.map(key))
    const xs = course.path.map((cell) => cell.x)
    const ys = course.path.map((cell) => cell.y)
    const used = new Set<string>()
    for (const landmark of course.landmarks) {
      for (const cell of landmarkCells(landmark)) {
        expect(path.has(key(cell)), `${course.id}:${landmark.kind} ${key(cell)}`).toBe(false)
        expect(used.has(key(cell)), `${course.id}:${landmark.kind} ${key(cell)}`).toBe(false)
        expect(cell.x).toBeGreaterThanOrEqual(Math.min(...xs))
        expect(cell.x).toBeLessThanOrEqual(Math.max(...xs))
        expect(cell.y).toBeGreaterThanOrEqual(Math.min(...ys))
        expect(cell.y).toBeLessThanOrEqual(Math.max(...ys))
        used.add(key(cell))
      }
    }
    expect(course.scenery.length).toBeGreaterThan(0)
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
  test('となりの マスは いつも 1マスぶん はなれ、ぜんぶ ばんめんの なかに ある', () => {
    for (const course of COURSES) {
      const size = boardSize(course)
      for (let index = 0; index < course.length; index++) {
        const point = squareCenter(course, index)
        expect(point.x).toBeGreaterThan(CELL / 2 - 1)
        expect(point.y).toBeGreaterThan(CELL / 2 - 1)
        expect(point.x).toBeLessThan(size.width - CELL / 2 + 1)
        expect(point.y).toBeLessThan(size.height - CELL / 2 + 1)
        if (index === 0) continue
        const before = squareCenter(course, index - 1)
        expect(Math.hypot(before.x - point.x, before.y - point.y)).toBe(CELL)
      }
      // みちは スタートから はじまり ゴールで おわる。
      const start = squareCenter(course, 0)
      const goal = squareCenter(course, goalIndex(course))
      expect(roadPath(course).startsWith(`M${start.x} ${start.y}`)).toBe(true)
      expect(roadPath(course).endsWith(`L${goal.x} ${goal.y}`)).toBe(true)
    }
  })

  test('こものは みちと めじるしを よけて、いつも おなじ ばしょに ちらばる', () => {
    for (const course of COURSES) {
      const items = scatterScenery(course)
      expect(items.length).toBeGreaterThan(5)
      expect(scatterScenery(course)).toEqual(items)
      const blocked = [...course.path, ...course.landmarks.flatMap(landmarkCells)].map((cell) => gridToBoard(course, cell))
      for (const item of items) {
        expect(course.scenery).toContain(item.kind)
        const inside = blocked.some((corner) => item.x >= corner.x && item.x < corner.x + CELL && item.y >= corner.y && item.y < corner.y + CELL)
        expect(inside, `${course.id}: ${item.kind} ${item.x},${item.y}`).toBe(false)
      }
    }
  })

  test('ちかくで みる ときは みじかい ほうに 6マス ならぶ', () => {
    expect(viewSize(0.5)).toEqual({ width: 600, height: 1200 })
    expect(viewSize(2)).toEqual({ width: 1200, height: 600 })
  })

  test('カメラは みたい ところを まんなかに おき、はしでは とまり、ちいさい むきは まんなかに よせる', () => {
    const board = { width: 1000, height: 2000 }
    const view = { width: 500, height: 800 }
    expect(cameraFor(board, view, { x: 500, y: 1000 }, false)).toEqual({ x: -250, y: -600, scale: 1 })
    expect(cameraFor(board, view, { x: 10, y: 10 }, false)).toEqual({ x: 0, y: 0, scale: 1 })
    expect(cameraFor(board, view, { x: 990, y: 1990 }, false)).toEqual({ x: -500, y: -1200, scale: 1 })
    expect(cameraFor(board, { width: 1200, height: 800 }, { x: 990, y: 1000 }, false)).toEqual({ x: 100, y: -600, scale: 1 })
    // ぜんたいを みる ときは ちぢめて まんなかに おさめる。
    expect(cameraFor(board, view, { x: 0, y: 0 }, true)).toEqual({ x: 50, y: 0, scale: 0.4 })
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

  test('ワープの とびさきは くじびきで ひとつ えらぶ', () => {
    expect(drawWarp([20, 24, 10], () => 0)).toBe(20)
    expect(drawWarp([20, 24, 10], () => 0.5)).toBe(24)
    expect(drawWarp([20, 24, 10], () => 0.9999)).toBe(10)
    expect(drawWarp([20, 24, 10], () => 1)).toBe(10)
  })

  test('でた めの かずだけ 1マスずつ すすみ、つぎの ひとの ばんに なる', () => {
    const plan = playTurn(createGame('mori', 2), 3)
    expect(plan).toMatchObject({ player: 0, roll: 3, walk: [1, 2, 3], event: null, eventWalk: [], goal: false })
    expect(plan.next.positions).toEqual([3, 0])
    expect(plan.next.turn).toBe(1)
    expect(playTurn(plan.next, 1).next.turn).toBe(0)
  })

  test('すすむ・もどる・ワープは とまった あとに うごき、つぎの しかけは よばない', () => {
    const game = createGame('mori', 2)
    const forward = playTurn(game, 2)
    expect(forward).toMatchObject({ walk: [1, 2], event: { kind: 'forward', steps: 2 }, eventWalk: [3, 4] })
    expect(forward.next.positions[0]).toBe(4)

    const back = playTurn(at(game, [5, 0]), 3)
    expect(back).toMatchObject({ walk: [6, 7, 8], event: { kind: 'back', steps: 1 }, eventWalk: [7] })
    expect(back.next.positions[0]).toBe(7)

    const warp = playTurn(at(game, [12, 0]), 2, mori, () => 0)
    expect(warp).toMatchObject({ walk: [13, 14], event: { kind: 'warp' }, eventWalk: [20] })
    expect(warp.next.positions[0]).toBe(20)
    // くじびき しだいで うしろへ とぶ ことも ある。
    const unlucky = playTurn(at(game, [12, 0]), 2, mori, () => 0.99)
    expect(unlucky).toMatchObject({ eventWalk: [10] })
    expect(unlucky.next.positions[0]).toBe(10)
  })

  test('もういちどの マスでは おなじ ひとが また ふれる', () => {
    const plan = playTurn(at(createGame('mori', 2), [0, 3], 1), 2)
    expect(plan.event).toEqual({ kind: 'again' })
    expect(plan.next.turn).toBe(1)
  })

  test('やすみの マスに とまると、つぎの じぶんの ばんを 1かい とばす', () => {
    const plan = playTurn(at(createGame('mori', 2), [10, 0]), 1)
    expect(plan.event).toEqual({ kind: 'rest' })
    expect(plan.next.resting).toEqual([true, false])
    const other = playTurn(plan.next, 1)
    expect(other.next.turn).toBe(0)
    expect(mustRest(other.next)).toBe(true)
    const skipped = skipRest(other.next)
    expect(skipped).toMatchObject({ turn: 1, resting: [false, false], positions: [11, 1] })
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
    const course: Course = {
      id: 'mori', name: 'test', tagline: '', path: traceRoute('R9'), length: 10,
      events: { 2: { kind: 'back', steps: 5 }, 7: { kind: 'forward', steps: 5 } }, landmarks: [], scenery: ['tree'],
    }
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
