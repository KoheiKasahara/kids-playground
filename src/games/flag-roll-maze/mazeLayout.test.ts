import { describe, expect, it } from 'vitest'
import { BALL_RADIUS, GOAL_RADIUS } from './mazePhysics'
import { CELL_SIZE, cellToWorld } from './mazeGrid'
import { findMazePath, type MazeStage } from './mazeStage'
import { createMazeStageById, MAZE_STAGE_ROWS, MAZE_STAGES } from './mazeStages'
import { STAR_PICKUP_RADIUS } from './mazeStars'

const EPSILON = 1e-9

type CellRect = { x: number; z: number; width: number; depth: number }

/** 点から軸に平行な矩形までの水平距離。矩形の内側なら距離0になる。 */
function distanceToRect(point: { x: number; z: number }, rect: CellRect): number {
  const dx = Math.max(Math.abs(point.x - rect.x) - rect.width / 2, 0)
  const dz = Math.max(Math.abs(point.z - rect.z) - rect.depth / 2, 0)
  return Math.hypot(dx, dz)
}

/** 壁と穴を1マス矩形として列挙し、集約矩形の境界差による見落としを防ぐ。 */
function blockedCellRects(rows: readonly string[], stage: MazeStage): CellRect[] {
  const rects: CellRect[] = []
  for (const [row, line] of rows.entries()) {
    for (let column = 0; column < line.length; column += 1) {
      if (line[column] !== '#' && line[column] !== 'O') continue
      const center = cellToWorld(column, row, stage.columnCount, stage.rowCount)
      rects.push({
        x: center.x,
        z: center.z,
        width: stage.boardWidth / stage.columnCount,
        depth: stage.boardDepth / stage.rowCount,
      })
    }
  }
  return rects
}

function wallCellRects(rows: readonly string[], stage: MazeStage): CellRect[] {
  const rects: CellRect[] = []
  for (const [row, line] of rows.entries()) {
    for (let column = 0; column < line.length; column += 1) {
      if (line[column] !== '#') continue
      const center = cellToWorld(column, row, stage.columnCount, stage.rowCount)
      rects.push({
        x: center.x,
        z: center.z,
        width: stage.boardWidth / stage.columnCount,
        depth: stage.boardDepth / stage.rowCount,
      })
    }
  }
  return rects
}

function holeCellRects(rows: readonly string[], stage: MazeStage): CellRect[] {
  const rects: CellRect[] = []
  for (const [row, line] of rows.entries()) {
    for (let column = 0; column < line.length; column += 1) {
      if (line[column] !== 'O') continue
      const center = cellToWorld(column, row, stage.columnCount, stage.rowCount)
      rects.push({
        x: center.x,
        z: center.z,
        width: stage.boardWidth / stage.columnCount,
        depth: stage.boardDepth / stage.rowCount,
      })
    }
  }
  return rects
}

function horizontalDistance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function openCell(rows: readonly string[], column: number, row: number): boolean {
  const cell = rows[row]?.[column]
  return cell !== undefined && cell !== '#' && cell !== 'O'
}

type SamplePoint = { x: number; z: number }

type NearestSample = {
  index: number
  distance: number
}

function isPassableSample(
  point: SamplePoint,
  stage: MazeStage,
  walls: readonly CellRect[],
  holes: readonly CellRect[],
): boolean {
  if (walls.some((wall) => distanceToRect(point, wall) < BALL_RADIUS - EPSILON)) {
    return false
  }
  if (holes.some((hole) => distanceToRect(point, hole) < BALL_RADIUS * 0.5 - EPSILON)) {
    return false
  }
  return stage.gimmicks.spinners.every(
    (spinner) => horizontalDistance(point, spinner.center) > spinner.sweepRadius + BALL_RADIUS,
  )
}

function findNearestPassableSample(
  samples: readonly SamplePoint[],
  passable: readonly boolean[],
  target: SamplePoint,
): NearestSample | null {
  let nearest: NearestSample | null = null
  for (let index = 0; index < samples.length; index += 1) {
    if (!passable[index]) continue
    const sample = samples[index]
    if (sample === undefined) continue
    const distance = horizontalDistance(sample, target)
    if (nearest === null || distance < nearest.distance) {
      nearest = { index, distance }
    }
  }
  return nearest
}

for (const definition of MAZE_STAGES) {
  describe(`${definition.id}の配置安全性`, () => {
    const stage = createMazeStageById(definition.id)
    const rows = definition.rows

    it('回転棒の掃引円が壁マスへ食い込まない', () => {
      for (const spinner of stage.gimmicks.spinners) {
        for (const wall of wallCellRects(rows, stage)) {
          expect(distanceToRect(spinner.center, wall)).toBeGreaterThanOrEqual(
            spinner.sweepRadius - EPSILON,
          )
        }
      }
    })

    /**
     * 回転棒が通路を塞ぎ切ると、掃引円に入ったボールが回され続けて出られなくなる。
     * 実際にPhase 4のレビューで、2マス幅の通路に長い棒を置いた配置が
     * 173秒間まったく突破できない状態を作った。
     * 「掃引円へ一度も入らずにゴールできる」ことを配置の必須条件として固定する。
     */
    it('回転棒の掃引円へ一度も入らずにSTARTからGOALまで到達できる', () => {
      const samplesPerCell = 8
      const sampleStep = CELL_SIZE / samplesPerCell
      const sampleColumnCount = stage.columnCount * samplesPerCell
      const sampleRowCount = stage.rowCount * samplesPerCell
      const samples: SamplePoint[] = []
      const boardMinX = -stage.boardWidth / 2
      const boardMinZ = -stage.boardDepth / 2

      for (let row = 0; row < sampleRowCount; row += 1) {
        for (let column = 0; column < sampleColumnCount; column += 1) {
          samples.push({
            x: boardMinX + sampleStep * (column + 0.5),
            z: boardMinZ + sampleStep * (row + 0.5),
          })
        }
      }

      const walls = wallCellRects(rows, stage)
      const holes = holeCellRects(rows, stage)
      const passable = samples.map((sample) => isPassableSample(sample, stage, walls, holes))
      const startSample = findNearestPassableSample(samples, passable, stage.start)
      const goalSample = findNearestPassableSample(samples, passable, stage.goal)

      expect(startSample).not.toBeNull()
      expect(goalSample).not.toBeNull()
      if (startSample === null || goalSample === null) return

      expect(startSample.distance).toBeLessThanOrEqual(BALL_RADIUS + EPSILON)
      expect(goalSample.distance).toBeLessThanOrEqual(BALL_RADIUS + EPSILON)

      const visited = new Uint8Array(samples.length)
      const queue = new Int32Array(samples.length)
      let queueHead = 0
      let queueTail = 0
      let exploredSampleCount = 0
      queue[queueTail] = startSample.index
      queueTail += 1
      visited[startSample.index] = 1

      while (queueHead < queueTail) {
        const current = queue[queueHead]
        queueHead += 1
        exploredSampleCount += 1
        if (current === goalSample.index) break

        const column = current % sampleColumnCount
        const row = Math.floor(current / sampleColumnCount)
        const neighbors = [
          [column - 1, row],
          [column + 1, row],
          [column, row - 1],
          [column, row + 1],
        ] as const
        for (const [nextColumn, nextRow] of neighbors) {
          if (
            nextColumn < 0 ||
            nextColumn >= sampleColumnCount ||
            nextRow < 0 ||
            nextRow >= sampleRowCount
          ) {
            continue
          }
          const next = nextRow * sampleColumnCount + nextColumn
          if (!passable[next] || visited[next] !== 0) continue
          visited[next] = 1
          queue[queueTail] = next
          queueTail += 1
        }
      }

      expect(exploredSampleCount).toBeGreaterThan(0)
      expect(visited[goalSample.index]).toBe(1)
    })

    it('バンパーの周りに壁からボール2個ぶんの余白がある', () => {
      for (const bumper of stage.gimmicks.bumpers) {
        for (const wall of wallCellRects(rows, stage)) {
          expect(distanceToRect(bumper.center, wall)).toBeGreaterThanOrEqual(
            bumper.radius + BALL_RADIUS * 2 - EPSILON,
          )
        }
      }
    })

    it('バンパー同士の間隔がボール直径と両半径の合計以上になる', () => {
      for (let first = 0; first < stage.gimmicks.bumpers.length; first += 1) {
        for (let second = first + 1; second < stage.gimmicks.bumpers.length; second += 1) {
          const a = stage.gimmicks.bumpers[first]!
          const b = stage.gimmicks.bumpers[second]!
          expect(horizontalDistance(a.center, b.center)).toBeGreaterThanOrEqual(
            BALL_RADIUS * 2 + a.radius + b.radius - EPSILON,
          )
        }
      }
    })

    it('チェックポイントが壁・穴・ギミックからボール半径以上離れている', () => {
      const blocked = blockedCellRects(rows, stage)
      for (const checkpoint of stage.checkpoints) {
        for (const rect of blocked) {
          expect(distanceToRect(checkpoint, rect)).toBeGreaterThanOrEqual(
            BALL_RADIUS - EPSILON,
          )
        }
        for (const spinner of stage.gimmicks.spinners) {
          expect(horizontalDistance(checkpoint, spinner.center)).toBeGreaterThanOrEqual(
            spinner.sweepRadius + BALL_RADIUS - EPSILON,
          )
        }
        for (const bumper of stage.gimmicks.bumpers) {
          expect(horizontalDistance(checkpoint, bumper.center)).toBeGreaterThanOrEqual(
            bumper.radius + BALL_RADIUS - EPSILON,
          )
        }
      }
    })

    it('ギミックがSTARTとGOALに重ならない', () => {
      for (const point of [stage.start, stage.goal]) {
        for (const spinner of stage.gimmicks.spinners) {
          expect(horizontalDistance(point, spinner.center)).toBeGreaterThanOrEqual(
            spinner.sweepRadius + BALL_RADIUS - EPSILON,
          )
        }
        for (const bumper of stage.gimmicks.bumpers) {
          expect(horizontalDistance(point, bumper.center)).toBeGreaterThanOrEqual(
            bumper.radius + BALL_RADIUS - EPSILON,
          )
        }
      }
    })

    it('星が壁・穴からボール半径以上離れている', () => {
      const blocked = blockedCellRects(rows, stage)
      for (const star of stage.stars) {
        for (const rect of blocked) {
          expect(distanceToRect(star.center, rect)).toBeGreaterThanOrEqual(
            BALL_RADIUS - EPSILON,
          )
        }
      }
    })

    it('星がバンパー・回転棒の掃引円と重ならない', () => {
      for (const star of stage.stars) {
        for (const spinner of stage.gimmicks.spinners) {
          expect(horizontalDistance(star.center, spinner.center)).toBeGreaterThanOrEqual(
            spinner.sweepRadius + BALL_RADIUS - EPSILON,
          )
        }
        for (const bumper of stage.gimmicks.bumpers) {
          expect(horizontalDistance(star.center, bumper.center)).toBeGreaterThanOrEqual(
            bumper.radius + BALL_RADIUS - EPSILON,
          )
        }
      }
    })

    it('星がSTARTとGOALに重ならない', () => {
      for (const star of stage.stars) {
        expect(horizontalDistance(star.center, stage.start)).toBeGreaterThanOrEqual(
          STAR_PICKUP_RADIUS + BALL_RADIUS - EPSILON,
        )
        expect(horizontalDistance(star.center, stage.goal)).toBeGreaterThanOrEqual(
          STAR_PICKUP_RADIUS + GOAL_RADIUS - EPSILON,
        )
      }
    })

    it('星を1つも取らなくてもSTARTからGOALへ到達できる', () => {
      // 星は寄り道の収集要素であり、1つも取らなくてもクリアできることをデータで保証する。
      expect(findMazePath(definition.rows)).not.toBeNull()
    })

    it('各ステージに星が3個ある', () => {
      expect(stage.stars).toHaveLength(3)
    })
  })
}

describe('ぼうけんステージの配置特性', () => {
  const stage = createMazeStageById('adventure')

  it('spinner-topの掃引円が主要経路上にある', () => {
    const path = findMazePath(MAZE_STAGE_ROWS)
    const spinner = stage.gimmicks.spinners.find(({ id }) => id === 'spinner-top')

    expect(path).not.toBeNull()
    expect(spinner).toBeDefined()
    // spinner-goalは部屋の中央に置き、上下に退避レーンを設ける設計なので、このテストの対象外とする。
    if (path === null || spinner === undefined) return

    expect(
      path.some(
        (point) =>
          horizontalDistance(point, spinner.center) <=
          spinner.sweepRadius + BALL_RADIUS + EPSILON,
      ),
    ).toBe(true)
  })

  it('縦通路には穴のない連続したレーンが1本あり、ボール直径以上の幅を持つ', () => {
    const corridorRows = [4, 5, 6]
    const safeColumns = Array.from({ length: stage.columnCount }, (_, column) => column).filter(
      (column) => corridorRows.every((row) => openCell(MAZE_STAGE_ROWS, column, row)),
    )

    expect(safeColumns).toEqual([7])
    expect(safeColumns.length * CELL_SIZE).toBeGreaterThanOrEqual(
      BALL_RADIUS * 2 - EPSILON,
    )
  })
})
