import { describe, expect, it } from 'vitest'
import { BALL_RADIUS } from './mazePhysics'
import {
  buildWallRects,
  CELL_SIZE,
  cellToWorld,
  createMazeStage,
  findMazePath,
  isMazeSolvable,
  MAZE_STAGE_ROWS,
  mazeStageBounds,
} from './mazeStage'

describe('cellToWorld', () => {
  it('グリッドの中心がワールド原点になる', () => {
    expect(cellToWorld(1, 1, 3, 3)).toEqual({ x: 0, z: 0 })
  })

  it('列は+X、行は+Zへ伸びる', () => {
    expect(cellToWorld(2, 1, 3, 3).x).toBeCloseTo(CELL_SIZE, 6)
    expect(cellToWorld(1, 2, 3, 3).z).toBeCloseTo(CELL_SIZE, 6)
  })
})

describe('buildWallRects', () => {
  it('横に連続する壁を1枚の矩形へまとめる', () => {
    const rects = buildWallRects(['###', '#.#'])
    // 1行目は3マスぶんの1枚、2行目は左右に1枚ずつ。
    expect(rects).toHaveLength(3)
    expect(rects[0]!.width).toBeCloseTo(3 * CELL_SIZE, 6)
    expect(rects[1]!.width).toBeCloseTo(CELL_SIZE, 6)
  })

  it('行末で終わる壁も取りこぼさない', () => {
    expect(buildWallRects(['..##'])).toHaveLength(1)
  })

  it('壁が無い行からは何も作らない', () => {
    expect(buildWallRects(['....'])).toHaveLength(0)
  })
})

describe('createMazeStage', () => {
  const stage = createMazeStage()

  it('グリッドの大きさから盤面サイズが決まる', () => {
    expect(stage.boardWidth).toBeCloseTo(stage.columnCount * CELL_SIZE, 6)
    expect(stage.boardDepth).toBeCloseTo(stage.rowCount * CELL_SIZE, 6)
  })

  it('行の長さが揃っていないグリッドは受け付けない', () => {
    expect(() => createMazeStage(['###', '#.'])).toThrow()
  })

  it('STARTとGOALが両方ある', () => {
    expect(() => createMazeStage(['###', '#.#', '###'])).toThrow()
    expect(stage.start).not.toEqual(stage.goal)
  })

  it('STARTとGOALが壁と重ならない', () => {
    for (const point of [stage.start, stage.goal]) {
      for (const wall of stage.walls) {
        const overlapX = Math.abs(point.x - wall.x) < wall.width / 2
        const overlapZ = Math.abs(point.z - wall.z) < wall.depth / 2
        expect(overlapX && overlapZ).toBe(false)
      }
    }
  })

  it('盤面境界がカメラ用に左右対称になる', () => {
    const bounds = mazeStageBounds(stage)
    expect(bounds.maxX).toBeCloseTo(-bounds.minX, 6)
    expect(bounds.maxZ).toBeCloseTo(-bounds.minZ, 6)
  })
})

describe('Phase 1のステージ', () => {
  it('外周がすべて壁で囲まれている', () => {
    const rows = MAZE_STAGE_ROWS
    const lastRow = rows.length - 1
    for (const [row, line] of rows.entries()) {
      if (row === 0 || row === lastRow) {
        expect(line).toBe('#'.repeat(line.length))
      } else {
        expect(line.startsWith('#')).toBe(true)
        expect(line.endsWith('#')).toBe(true)
      }
    }
  })

  it('STARTからGOALまで壁を通らずに行ける', () => {
    expect(isMazeSolvable(MAZE_STAGE_ROWS)).toBe(true)
  })

  it('通路幅がボール直径より広い', () => {
    expect(CELL_SIZE).toBeGreaterThan(BALL_RADIUS * 2)
  })

  it('幼児が迷わないよう、行き止まりを作らない', () => {
    const rows = MAZE_STAGE_ROWS
    for (const [row, line] of rows.entries()) {
      for (let column = 0; column < line.length; column += 1) {
        if (line[column] === '#') continue
        const openNeighbours = [
          rows[row]?.[column + 1],
          rows[row]?.[column - 1],
          rows[row + 1]?.[column],
          rows[row - 1]?.[column],
        ].filter((cell) => cell !== undefined && cell !== '#').length
        // START/GOALだけが端点になり、それ以外は必ず通り抜けられる。
        const isEndpoint = line[column] === 'S' || line[column] === 'G'
        expect(openNeighbours).toBeGreaterThanOrEqual(isEndpoint ? 1 : 2)
      }
    }
  })

  it('経路が短すぎず、遊びとして成立する長さになっている', () => {
    const path = findMazePath(MAZE_STAGE_ROWS)
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThanOrEqual(16)
  })
})

describe('findMazePath', () => {
  it('壁で分断された迷路はnullを返す', () => {
    expect(findMazePath(['#####', '#S..#', '#####', '#..G#', '#####'])).toBeNull()
    expect(isMazeSolvable(['#####', '#S..#', '#####', '#..G#', '#####'])).toBe(false)
  })

  it('経路の端がSTARTとGOALのマス中心になる', () => {
    const rows = ['#####', '#S..#', '#.#.#', '#..G#', '#####']
    const path = findMazePath(rows)!
    expect(path[0]).toEqual(cellToWorld(1, 1, 5, 5))
    expect(path[path.length - 1]).toEqual(cellToWorld(3, 3, 5, 5))
  })
})
