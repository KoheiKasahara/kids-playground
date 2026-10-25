import { describe, expect, test } from 'vitest'
import { CELL, boardSize, cameraFor, gridToBoard, landmarkCells, pieceOffset, roadPath, scatterScenery, squareCenter, viewSize } from './boardLayout'
import { COURSES, PIECES, courseById, defineCourse, goalIndex, squareAt, traceRoute, type Course } from './courses'
import {
  createGame, createPlayers, drawRoute, drawWarp, mustRest, playTurn, ranking, remainingSquares, rollDice, rollDie, routeChoices, skipRest, swapTarget,
  type GameState,
} from './sugorokuGame'

const mori = courseById('mori')
const key = (cell: { x: number; y: number }) => `${cell.x},${cell.y}`
const okashi = courseById('okashi')

/** みちを たどった ときの マスどうしの はなれぐあい（すすむ・もどるの どちらでも 1マス 1）。 */
function graphDistances(course: Course, from: number): number[] {
  const neighbors = course.cells.map(() => new Set<number>())
  course.next.forEach((targets, id) => targets.forEach((target) => {
    neighbors[id]!.add(target)
    neighbors[target]!.add(id)
  }))
  const distance = course.cells.map(() => Infinity)
  distance[from] = 0
  const queue = [from]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const neighbor of neighbors[id]!) {
      if (distance[neighbor] !== Infinity) continue
      distance[neighbor] = distance[id]! + 1
      queue.push(neighbor)
    }
  }
  return distance
}

/** その マスへ くる みちの かず。わきみちが もどってくる マスは 2。 */
function incoming(course: Course): number[] {
  const count = course.cells.map(() => 0)
  course.next.forEach((targets) => targets.forEach((target) => { count[target]! += 1 }))
  return count
}

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
    expect(course.length).toBe(course.cells.length)
    expect(course.cells.slice(0, course.path.length)).toEqual(course.path)
    expect(new Set(course.cells.map(key)).size).toBe(course.length)
    course.next.forEach((targets, id) => {
      for (const target of targets) {
        const a = course.cells[id]!
        const b = course.cells[target]!
        expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y), `${course.id}: ${id} → ${target}`).toBe(1)
      }
    })
    // みちを まちがえない ように、みちを たどって 3マス いじょう はなれた マスは ななめでも となりあわない。
    for (let i = 0; i < course.length; i++) {
      const distance = graphDistances(course, i)
      for (let j = i + 1; j < course.length; j++) {
        if (distance[j]! < 3) continue
        const a = course.cells[i]!
        const b = course.cells[j]!
        expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)), `${course.id}: ${i} と ${j}`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  test.each(COURSES.map((course) => [course.id, course] as const))('%s: わかれみちは ふたつに わかれ、どの みちも ゴールへ つづく', (_, course: Course) => {
    const forks = Object.entries(course.forks)
    expect(forks.length).toBeGreaterThan(0)
    for (const [forkKey, routes] of forks) {
      const fork = Number(forkKey)
      expect(routes).toHaveLength(2)
      expect(routes.map((route) => route.first)).toEqual(course.next[fork])
      expect(new Set(routes.map((route) => route.label)).size).toBe(2)
      // どちらの みちも ゴールまで おなじ ながさ。
      expect(new Set(routes.map((route) => course.toGoal[route.first])).size).toBe(1)
      expect(course.events[fork], `${course.id}:${fork}`).toBeUndefined()
      // わかれみちの すぐ となりには わかれみちを おかない。
      for (const route of routes) expect(course.forks[route.first]).toBeUndefined()
    }
    expect(course.roads).toHaveLength(forks.length + 1)
    for (let id = 0; id < course.length; id++) {
      expect(Number.isFinite(course.toGoal[id]), `${course.id}:${id}`).toBe(true)
      if (id !== goalIndex(course)) expect(course.next[id]!.length).toBeGreaterThan(0)
      if (id >= course.path.length) expect(course.routeOf[id], `${course.id}:${id}`).toBeTruthy()
    }
  })

  test.each(COURSES.map((course) => [course.id, course] as const))('%s: おりかえすだけで なく、いろいろな むきへ なんども まがる', (_, course: Course) => {
    // ジグザグの おりかえしだけの たんちょうな コースに もどらない ように する。
    let turns = 0
    for (let index = 2; index < course.path.length; index++) {
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
    const merges = incoming(course)
    for (const [indexKey, event] of Object.entries(course.events)) {
      const index = Number(indexKey)
      // スタート・ゴールの となりには しかけを おかず、さいしょと さいごは すなおに すすめる。
      expect(index, `${course.id}:${index}`).toBeGreaterThan(1)
      expect(course.toGoal[index], `${course.id}:${index}`).toBeGreaterThan(1)
      expect(course.forks[index], `${course.id}:${index}`).toBeUndefined()
      let targets: number[] = []
      if (event.kind === 'forward') {
        expect(event.steps).toBeGreaterThan(0)
        // すすむ とちゅうで わかれみちを とおらない（とまって しまい、かいた かずだけ すすめない）。
        let square = index
        for (let step = 0; step < event.steps; step++) {
          expect(course.next[square], `${course.id}:${index}`).toHaveLength(1)
          square = course.next[square]![0]!
        }
        targets = [square]
      } else if (event.kind === 'back') {
        expect(event.steps).toBeGreaterThan(0)
        // わきみちが もどってくる マスからは もどらない（どちらの みちへ もどるか きまらない）。
        let square = index
        for (let step = 0; step < event.steps; step++) {
          expect(merges[square], `${course.id}:${index}`).toBeLessThanOrEqual(1)
          square = course.prev[square]!
        }
        targets = [square]
      } else if (event.kind === 'warp') {
        expect(event.to.length).toBeGreaterThanOrEqual(2)
        expect(new Set(event.to).size).toBe(event.to.length)
        // くじびきでも たいていは さきへ とぶ。
        expect(event.to.filter((target) => course.toGoal[target]! < course.toGoal[index]!).length).toBeGreaterThan(event.to.length / 2)
        targets = [...event.to]
      }
      for (const target of targets) {
        expect(target, `${course.id}:${index}`).toBeGreaterThan(0)
        expect(target, `${course.id}:${index}`).toBeLessThan(course.length)
        expect(squareAt(course, target).kind, `${course.id}:${index} → ${target}`).toBe('normal')
      }
    }
  })

  test.each(COURSES.map((course) => [course.id, course] as const))('%s: めじるしは みちに かからず、たがいに かさならない', (_, course: Course) => {
    const path = new Set(course.cells.map(key))
    const xs = course.cells.map((cell) => cell.x)
    const ys = course.cells.map((cell) => cell.y)
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
    expect([...kinds].sort()).toEqual(['again', 'back', 'double', 'forward', 'rest', 'swap', 'warp'])
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
      }
      for (const road of course.roads) {
        for (let step = 1; step < road.length; step++) {
          const before = squareCenter(course, road[step - 1]!)
          const point = squareCenter(course, road[step]!)
          expect(Math.hypot(before.x - point.x, before.y - point.y)).toBe(CELL)
        }
      }
      // おおどおりは スタートから はじまり ゴールで おわる。わきみちは わかれみちから はじまる。
      const start = squareCenter(course, 0)
      const goal = squareCenter(course, goalIndex(course))
      expect(roadPath(course, course.roads[0]!).startsWith(`M${start.x} ${start.y}`)).toBe(true)
      expect(roadPath(course, course.roads[0]!).endsWith(`L${goal.x} ${goal.y}`)).toBe(true)
      for (const road of course.roads.slice(1)) {
        const fork = squareCenter(course, road[0]!)
        expect(course.forks[road[0]!]).toBeDefined()
        expect(roadPath(course, road).startsWith(`M${fork.x} ${fork.y}`)).toBe(true)
      }
    }
  })

  test('こものは みちと めじるしを よけて、いつも おなじ ばしょに ちらばる', () => {
    for (const course of COURSES) {
      const items = scatterScenery(course)
      expect(items.length).toBeGreaterThan(5)
      expect(scatterScenery(course)).toEqual(items)
      const blocked = [...course.cells, ...course.landmarks.flatMap(landmarkCells)].map((cell) => gridToBoard(course, cell))
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
    expect(game.doubles).toEqual([false, false, false, false])
    expect(game).toMatchObject({ course: 'umi', turn: 0, winner: null })
  })

  test('サイコロは 1〜6', () => {
    expect(rollDie(() => 0)).toBe(1)
    expect(rollDie(() => 0.5)).toBe(4)
    expect(rollDie(() => 0.9999)).toBe(6)
    expect(rollDie(() => 1)).toBe(6)
  })

  test('ワープの とびさきは くじびきで ひとつ えらぶ', () => {
    expect(drawWarp([24, 26, 10], () => 0)).toBe(24)
    expect(drawWarp([24, 26, 10], () => 0.5)).toBe(26)
    expect(drawWarp([24, 26, 10], () => 0.9999)).toBe(10)
    expect(drawWarp([24, 26, 10], () => 1)).toBe(10)
  })

  test('でた めの かずだけ 1マスずつ すすみ、つぎの ひとの ばんに なる', () => {
    const plan = playTurn(at(createGame('mori', 2), [6, 0]), 3)
    expect(plan).toMatchObject({ player: 0, roll: 3, walk: [7, 8, 9], event: null, eventWalk: [], goal: false })
    expect(plan.next.positions).toEqual([9, 0])
    expect(plan.next.turn).toBe(1)
    expect(playTurn(plan.next, 1).next.turn).toBe(0)
  })

  test('すすむ・もどる・ワープは とまった あとに うごき、つぎの しかけは よばない', () => {
    const game = createGame('mori', 2)
    const forward = playTurn(at(game, [2, 0]), 2)
    expect(forward).toMatchObject({ walk: [3, 4], event: { kind: 'forward', steps: 2 }, eventWalk: [5, 6] })
    expect(forward.next.positions[0]).toBe(6)

    const back = playTurn(at(game, [5, 0]), 3)
    expect(back).toMatchObject({ walk: [6, 7, 8], event: { kind: 'back', steps: 1 }, eventWalk: [7] })
    expect(back.next.positions[0]).toBe(7)

    const warp = playTurn(at(game, [12, 0]), 2, mori, () => 0)
    expect(warp).toMatchObject({ walk: [13, 14], event: { kind: 'warp' }, eventWalk: [24] })
    expect(warp.next.positions[0]).toBe(24)
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
    const course = defineCourse({
      id: 'mori', name: 'test', tagline: '', route: 'R9',
      events: { 2: { kind: 'back', steps: 5 }, 7: { kind: 'forward', steps: 5 } }, landmarks: [], scenery: ['tree'],
    })
    const game = createGame('mori', 2)
    expect(playTurn(game, 2, course)).toMatchObject({ eventWalk: [1, 0], goal: false })
    const forward = playTurn(at(game, [6, 0]), 1, course)
    expect(forward).toMatchObject({ eventWalk: [8, 9], goal: true })
    expect(forward.next.winner).toBe(0)
  })

  test('わきみちは もとの みちへ もどり、おおどおりと おなじ ながさで ないと つくれない', () => {
    const base = { id: 'mori' as const, name: 'test', tagline: '', route: 'R3 D3', events: {}, landmarks: [], scenery: ['tree' as const] }
    const branch = { label: 'a', hint: '', mainLabel: 'b', mainHint: '' }
    expect(() => defineCourse({ ...base, branches: [{ ...branch, from: 1, to: 5, route: 'D1 R3' }] })).toThrow()
    expect(() => defineCourse({ ...base, branches: [{ ...branch, from: 1, to: 3, route: 'D1 R2 U1' }] })).toThrow()
    const ok = defineCourse({ ...base, branches: [{ ...branch, from: 1, to: 5, route: 'D2 R2', events: { 2: { kind: 'rest' } } }] })
    expect(ok.length).toBe(10)
    expect(ok.next[1]).toEqual([2, 7])
    expect(ok.next[9]).toEqual([5])
    expect(ok.prev[7]).toBe(1)
    expect(ok.events[8]).toEqual({ kind: 'rest' })
    expect(ok.toGoal[2]).toBe(ok.toGoal[7])
  })

  test('わかれみちを とおりかかると、めが のこっていても そこで とまる', () => {
    const game = createGame('mori', 2)
    expect(squareAt(mori, 2)).toEqual({ kind: 'fork' })
    const stop = playTurn(game, 5)
    expect(stop).toMatchObject({ walk: [1, 2], forkStop: true, event: null, eventWalk: [] })
    expect(stop.next).toMatchObject({ positions: [2, 0], turn: 1 })
    // ちょうど とまっても、わかれみちの しかけは ない。
    expect(playTurn(game, 2)).toMatchObject({ walk: [1, 2], forkStop: false, event: null })
    expect(routeChoices(game)).toBeNull()
  })

  test('わかれみちからは えらんだ みちへ すすみ、わきみちを とおって もとの みちへ もどる', () => {
    const game = at(createGame('mori', 2), [2, 0])
    expect(routeChoices(game)?.map((route) => route.label)).toEqual(['たにの みち', 'おかの みち'])
    expect(playTurn(game, 1, mori, Math.random, 0).walk).toEqual([3])
    const branch = mori.forks[2]![1]!.first
    expect(playTurn(game, 1, mori, Math.random, 1).walk).toEqual([branch])

    // おかの みちの しかけ：サイコロ 2こと 2もどる。もどる ときも わきみちを とおる。
    expect(playTurn(game, 2, mori, Math.random, 1)).toMatchObject({ walk: [branch, branch + 1], event: { kind: 'double' } })
    expect(playTurn(game, 5, mori, Math.random, 1)).toMatchObject({ event: { kind: 'back', steps: 2 }, eventWalk: [branch + 3, branch + 2] })
    expect(playTurn(at(game, [branch + 7, 0]), 2)).toMatchObject({ walk: [11, 12] })

    const candy = okashi.forks[5]![1]!.first
    expect(playTurn(at(createGame('okashi', 2), [5, 0]), 2, okashi, Math.random, 1)).toMatchObject({ walk: [candy, candy + 1], event: { kind: 'double' } })
  })

  test('コンピュータの みちは くじびき', () => {
    expect(drawRoute(2, () => 0)).toBe(0)
    expect(drawRoute(2, () => 0.6)).toBe(1)
    expect(drawRoute(2, () => 1)).toBe(1)
  })

  test('サイコロ 2この マスに とまると、つぎの じぶんの ばんだけ 2こ ふる', () => {
    const game = createGame('mori', 2)
    const plan = playTurn(at(game, [15, 0]), 1)
    expect(plan.event).toEqual({ kind: 'double' })
    expect(plan.next.doubles).toEqual([true, false])
    expect(rollDice(plan.next, () => 0)).toEqual([1])
    const mine = { ...plan.next, turn: 0 }
    expect(rollDice(mine, () => 0.5)).toEqual([4, 4])
    const twice = playTurn(at(mine, [12, 0]), [3, 4])
    expect(twice).toMatchObject({ rolls: [3, 4], roll: 7, walk: [13, 14, 15, 16, 17, 18, 19] })
    expect(twice.next.doubles).toEqual([false, false])
  })

  test('いれかわりの マスでは いちばん まえの ひとと ばしょを かえ、じぶんが いちばん まえなら そのまま', () => {
    const game = createGame('mori', 3)
    expect(squareAt(mori, 21)).toEqual({ kind: 'swap' })
    const plan = playTurn(at(game, [19, 25, 23]), 2)
    expect(plan).toMatchObject({ event: { kind: 'swap' }, swapWith: 1, eventWalk: [25] })
    expect(plan.next.positions).toEqual([25, 21, 23])
    expect(swapTarget(at(game, [21, 10, 12]), 0, 21)).toBeNull()
    const alone = playTurn(at(game, [19, 10, 12]), 2)
    expect(alone).toMatchObject({ swapWith: null, eventWalk: [] })
    expect(alone.next.positions).toEqual([21, 10, 12])
  })

  test('じゅんいは ゴールした ひとが 1い、のこりは ちかい じゅんで、のこりが おなじなら おなじ くらい', () => {
    const state: GameState = { ...createGame('mori', 4), positions: [12, 32, 12, 15], winner: 1 }
    expect(ranking(state)).toEqual([
      { player: 1, place: 1 }, { player: 3, place: 2 }, { player: 0, place: 3 }, { player: 2, place: 3 },
    ])
    // わきみちに いても、のこりの マスで くらべる（おなじ ながさの みちなので おなじ くらい）。
    const branch = mori.forks[2]![1]!.first
    const mixed: GameState = { ...createGame('mori', 2), positions: [4, branch + 1], winner: null }
    expect(ranking(mixed)).toEqual([{ player: 0, place: 1 }, { player: 1, place: 1 }])
  })
})
