import { describe, expect, it } from 'vitest'
import { BALL_RADIUS } from './mazePhysics'
import {
  buildFloorRects,
  buildWallRects,
  CELL_SIZE,
  cellToWorld,
  createMazeStage,
  findMazePath,
  isMazeSolvable,
  mazeStageBounds,
} from './mazeStage'
import { createMazeStageById, MAZE_STAGE_ROWS } from './mazeStages'

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

describe('buildFloorRects', () => {
  it('穴とゴールカップのマスを通常の床に含めない', () => {
    const floors = buildFloorRects(MAZE_STAGE_ROWS)

    expect(floors).toHaveLength(7)
    for (const [row, line] of MAZE_STAGE_ROWS.entries()) {
      for (let column = 0; column < line.length; column += 1) {
        const point = cellToWorld(column, row, line.length, MAZE_STAGE_ROWS.length)
        const covered = floors.filter(
          (floor) =>
            Math.abs(point.x - floor.x) <= floor.width / 2 &&
            Math.abs(point.z - floor.z) <= floor.depth / 2,
        )
        expect(covered).toHaveLength(line[column] === 'O' || line[column] === 'G' ? 0 : 1)
      }
    }
  })

  it('床の総面積が穴とゴールカップを除く全マスの面積と一致する', () => {
    const floors = buildFloorRects(MAZE_STAGE_ROWS)
    const openCellCount = MAZE_STAGE_ROWS.reduce(
      (count, line) => count + [...line].filter((cell) => cell !== 'O' && cell !== 'G').length,
      0,
    )
    const floorArea = floors.reduce((area, floor) => area + floor.width * floor.depth, 0)
    expect(floorArea).toBeCloseTo(openCellCount * CELL_SIZE ** 2, 8)
  })
})

describe('createMazeStage', () => {
  const stage = createMazeStageById('adventure')

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

  it('starCellsをワールド座標へ変換し、配列順のIDを付ける', () => {
    const customStage = createMazeStage(MAZE_STAGE_ROWS, {
      starCells: [
        { column: 2, row: 1 },
        { column: 3, row: 2 },
      ],
    })

    expect(customStage.stars).toEqual([
      { id: 'star-1', center: cellToWorld(2, 1, 11, 11) },
      { id: 'star-2', center: cellToWorld(3, 2, 11, 11) },
    ])
  })

  it('starCellsを省略したステージは星を持たない', () => {
    expect(createMazeStage(MAZE_STAGE_ROWS).stars).toEqual([])
  })

  it('START・checkpoint・星へ指定した高さとcheckpoint半径を保つ', () => {
    const rows = [
      '#####',
      '#S.G#',
      '#####',
    ]
    const elevated = createMazeStage(rows, {
      startY: 4,
      checkpointCells: [
        { column: 1, row: 1, y: 4 },
        { column: 2, row: 1, y: 2, radius: 2.5 },
      ],
      starCells: [{ column: 2, row: 1, y: 2 }],
    })

    expect(elevated.start).toEqual({ ...cellToWorld(1, 1, 5, 3), y: 4 })
    expect(elevated.checkpoints).toEqual([
      { ...cellToWorld(1, 1, 5, 3), y: 4 },
      { ...cellToWorld(2, 1, 5, 3), y: 2, radius: 2.5 },
    ])
    expect(elevated.stars).toEqual([
      { id: 'star-1', center: { ...cellToWorld(2, 1, 5, 3), y: 2 } },
    ])
  })

  it('盤面境界がカメラ用に左右対称になる', () => {
    const bounds = mazeStageBounds(stage)
    expect(bounds.maxX).toBeCloseTo(-bounds.minX, 6)
    expect(bounds.maxZ).toBeCloseTo(-bounds.minZ, 6)
  })
})

describe('既定ステージ', () => {
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
    expect(CELL_SIZE).toBeGreaterThanOrEqual(BALL_RADIUS * 2.4)
  })

  it('大きなボールでも直角コーナー用の横余白を残す', () => {
    // 通路幅3Rの半分から球半径Rを引き、片側0.5R以上の余白を残す。
    expect(CELL_SIZE / 2 - BALL_RADIUS).toBeGreaterThanOrEqual(BALL_RADIUS * 0.5)
  })

  it('幼児が迷わないよう、行き止まりを作らない', () => {
    const rows = MAZE_STAGE_ROWS
    for (const [row, line] of rows.entries()) {
      for (let column = 0; column < line.length; column += 1) {
        if (line[column] === '#' || line[column] === 'O') continue
        const openNeighbours = [
          rows[row]?.[column + 1],
          rows[row]?.[column - 1],
          rows[row + 1]?.[column],
          rows[row - 1]?.[column],
        ].filter((cell) => cell !== undefined && cell !== '#' && cell !== 'O').length
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

  it('新しい11×11グリッドが穴を避けて解ける', () => {
    expect(MAZE_STAGE_ROWS).toEqual([
      '###########',
      '#S........#',
      '#.........#',
      '#.........#',
      '######O.###',
      '######O.###',
      '######O.###',
      '#.........#',
      '#G........#',
      '#.........#',
      '###########',
    ])
    expect(isMazeSolvable(MAZE_STAGE_ROWS)).toBe(true)
  })

  it('穴を通る経路を最短経路として返さない', () => {
    const path = findMazePath(MAZE_STAGE_ROWS)
    expect(path).not.toBeNull()
    const holes = new Set(
        [
          cellToWorld(6, 4, 11, 11),
          cellToWorld(6, 5, 11, 11),
          cellToWorld(6, 6, 11, 11),
        ].map(
        (point) => `${point.x},${point.z}`,
      ),
    )
    expect(path!.every((point) => !holes.has(`${point.x},${point.z}`))).toBe(true)
  })

  it('ステージの穴が指定された2マスにある', () => {
    const stage = createMazeStageById('adventure')
    expect(stage.holes).toHaveLength(3)
    expect(stage.holes.map((hole) => hole.center)).toEqual([
      cellToWorld(6, 4, 11, 11),
      cellToWorld(6, 5, 11, 11),
      cellToWorld(6, 6, 11, 11),
    ])
  })

  it('チェックポイントの先頭がSTARTと同じ位置になる', () => {
    const stage = createMazeStageById('adventure')
    expect(stage.checkpoints[0]).toEqual(stage.start)
    expect(stage.rows[7]?.[6]).not.toBe('O')
    expect(stage.checkpoints[2]).toEqual(cellToWorld(6, 7, 11, 11))
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
