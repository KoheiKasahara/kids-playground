import { describe, expect, it } from 'vitest'
import { CELL_SIZE } from './mazeGrid'
import { BALL_RADIUS } from './mazePhysics'
import { findMazePath, isMazeSolvable } from './mazeStage'
import {
  createMazeStageById,
  DEFAULT_MAZE_STAGE_ID,
  isMazeStageId,
  MAZE_STAGE_IDS,
  MAZE_STAGES,
  nextMazeStageId,
} from './mazeStages'

function countSymbol(rows: readonly string[], symbol: string): number {
  return rows.reduce(
    (count, row) => count + [...row].filter((cell) => cell === symbol).length,
    0,
  )
}

describe('ステージカタログ', () => {
  it('各ステージに重複しないIDと表示情報がある', () => {
    expect(new Set(MAZE_STAGES.map((stage) => stage.id)).size).toBe(MAZE_STAGES.length)
    for (const stage of MAZE_STAGES) {
      expect(stage.nameJa.length).toBeGreaterThan(0)
      expect(stage.emoji.length).toBeGreaterThan(0)
      expect(stage.hintJa.length).toBeGreaterThan(0)
    }
  })

  it('各ステージはSTARTからGOALまで解け、両方を1つずつ持つ', () => {
    for (const stage of MAZE_STAGES) {
      expect(isMazeSolvable(stage.rows)).toBe(true)
      expect(countSymbol(stage.rows, 'S')).toBe(1)
      expect(countSymbol(stage.rows, 'G')).toBe(1)
    }
  })

  it('各ステージに星を3個ずつ置き、クリア条件とは別に管理する', () => {
    for (const definition of MAZE_STAGES) {
      const stage = createMazeStageById(definition.id)
      expect(definition.starCells).toHaveLength(3)
      expect(stage.stars).toHaveLength(3)
      expect(stage.stars.map((star) => star.id)).toEqual([
        'star-1',
        'star-2',
        'star-3',
      ])
    }
  })

  it('アスレチックは設計どおりの13列29行で、高低差と追加ギミックを持つ', () => {
    const definition = MAZE_STAGES.find((stage) => stage.id === 'athletic')
    expect(definition).toBeDefined()
    if (definition === undefined) return

    expect(definition.nameJa).toBe('アスレチック')
    expect(definition.emoji).toBe('🎢')
    expect(definition.hintJa).toBe('すべって とんで うちだす')
    expect(definition.rows).toEqual([
      '#############',
      '##.........##',
      '##....S....##',
      '##.........##',
      '##.........##',
      '##.........##',
      '##.........##',
      '##.........##',
      '#####...#####',
      '#####...#####',
      '#####...#####',
      '#####...#####',
      '##.........##',
      '##.........##',
      '##.........##',
      '##.........##',
      '#####...#####',
      '#####...#####',
      '#####...#####',
      '#####...#####',
      '#####...#####',
      '#####...#####',
      '##.........##',
      '##.........##',
      '#####...#####',
      '#####...#####',
      '#####...#####',
      '#####.G.#####',
      '#############',
    ])
    expect(definition.rows.every((row) => row.length === 13)).toBe(true)
    expect(definition.startY).toBe(6.0)
    expect(definition.gimmicks.map((gimmick) => gimmick.id)).toEqual([
      'car-athletic-near',
      'car-athletic-far',
      'jump-pad-athletic',
      'cannon-athletic',
      'spinner-athletic-final',
    ])
    expect(definition.checkpointCells).toHaveLength(7)
    expect(definition.starCells).toHaveLength(3)

    const stage = createMazeStageById('athletic')
    expect(stage.start.y).toBe(6.0)
    expect(stage.checkpoints.map((checkpoint) => checkpoint.radius)).toEqual([
      undefined,
      2.8,
      2.6,
      2.6,
      2.6,
      3.2,
      2.6,
    ])
    expect(stage.stars.map((star) => star.center.y)).toEqual([3.0, 0, 0])
    expect(stage.terrain.boxes).toHaveLength(31)
    expect(stage.terrain.bars).toHaveLength(14)
    expect(stage.gimmicks.cars.map((car) => car.id)).toEqual([
      'car-athletic-near',
      'car-athletic-far',
    ])
    expect(stage.gimmicks.jumpPads.map((jumpPad) => jumpPad.id)).toEqual([
      'jump-pad-athletic',
    ])
    expect(stage.gimmicks.cannons.map((cannon) => cannon.id)).toEqual([
      'cannon-athletic',
    ])
    expect(stage.gimmicks.spinners.map((spinner) => spinner.id)).toEqual([
      'spinner-athletic-final',
    ])
    const cannon = stage.gimmicks.cannons[0]
    expect(cannon).toBeDefined()
    if (cannon === undefined) return
    expect(cannon.center.x).toBeCloseTo(0, 8)
    expect(cannon.center.z).toBeCloseTo(12.852, 8)
    expect(cannon.muzzleY).toBe(1.0)
    expect(cannon.elevationRad).toBeCloseTo((42 * Math.PI) / 180, 8)
    expect(cannon.headingRad).toBe(0)
    expect(cannon.speed).toBe(7.6)
    expect(cannon.captureRadius).toBe(1.55)
    expect(stage.terrain.boxes.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'athletic-cannon-ridge',
        'athletic-cannon-guide-left',
        'athletic-cannon-guide-right',
        'athletic-landing-funnel-left',
        'athletic-landing-funnel-right',
      ]),
    )

    const spinner = stage.gimmicks.spinners[0]
    const spinnerRow = stage.rows[Math.floor(25.6)]
    expect(spinner).toBeDefined()
    expect(spinnerRow).toBeDefined()
    if (spinner === undefined || spinnerRow === undefined) return

    // 最終通路の実グリッド幅から、棒がどの向きでも残す両脇の退避レーンを測る。
    const corridorWidth = [...spinnerRow].filter((cell) => cell !== '#').length * CELL_SIZE
    const retreatLane = (corridorWidth - spinner.sweepRadius * 2) / 2
    expect(corridorWidth).toBeCloseTo(5.67, 8)
    expect(retreatLane).toBeGreaterThanOrEqual(BALL_RADIUS * 2)
  })

  it('最終回転棒は通路の片側へ寄せ、反対側にボール直径より広い逃げ道を残す', () => {
    const stage = createMazeStageById('athletic')
    const spinner = stage.gimmicks.spinners.find(
      ({ id }) => id === 'spinner-athletic-final',
    )
    expect(spinner).toBeDefined()
    if (spinner === undefined) return

    // 最終通路はcols 5〜7の3マス幅。棒を中央に置くと両脇が1.63ずつしか残らず、
    // どちらへ振られても壁ぎわで粘ってしまうため、必ず片側へ寄せる。
    const corridorHalfWidth = (CELL_SIZE * 3) / 2
    const leftLane = spinner.center.x - spinner.sweepRadius - -corridorHalfWidth
    const rightLane = corridorHalfWidth - (spinner.center.x + spinner.sweepRadius)
    const ballDiameter = BALL_RADIUS * 2

    expect(Math.max(leftLane, rightLane)).toBeGreaterThan(ballDiameter * 1.8)
    // 中央を通るボールには必ず当たり、飾りにならないことも同時に守る。
    expect(Math.abs(spinner.center.x)).toBeLessThan(spinner.sweepRadius)
  })

  it('GOAL手前の門は、棒に振られたボールをカップ正面へ戻せる広さにする', () => {
    const stage = createMazeStageById('athletic')
    const left = stage.terrain.boxes.find(({ id }) => id === 'athletic-goal-guide-left')
    const right = stage.terrain.boxes.find(({ id }) => id === 'athletic-goal-guide-right')
    expect(left).toBeDefined()
    expect(right).toBeDefined()
    if (left === undefined || right === undefined) return

    // 門はGOALの手前に置き、通り道の中心をカップのx座標に合わせる。
    expect(left.z).toBeLessThan(stage.goal.z)
    const gateLeftEdge = left.x + left.width / 2
    const gateRightEdge = right.x - right.width / 2
    expect((gateLeftEdge + gateRightEdge) / 2).toBeCloseTo(stage.goal.x, 6)
    // ボール直径ぶんだけでは擦って止まるため、直径の1.4倍以上の通り道を残す。
    expect(gateRightEdge - gateLeftEdge).toBeGreaterThan(BALL_RADIUS * 2 * 1.4)
  })

  it('各ステージの最短経路は短すぎず、遊びとして曲がる余地がある', () => {
    for (const stage of MAZE_STAGES) {
      const path = findMazePath(stage.rows)
      expect(path).not.toBeNull()
      expect(path!.length).toBeGreaterThanOrEqual(10)
    }
  })

  it('盤面の形とギミック構成が同じステージを重ねていない', () => {
    const signatures = MAZE_STAGES.map((definition) => {
      const stage = createMazeStageById(definition.id)
      return [
        stage.columnCount,
        stage.rowCount,
        stage.holes.length,
        stage.gimmicks.spinners.length,
        stage.gimmicks.bumpers.length,
        stage.gimmicks.cars.length,
        stage.gimmicks.jumpPads.length,
        stage.gimmicks.cannons.length,
      ].join(',')
    })

    expect(new Set(signatures).size).toBe(MAZE_STAGES.length)
  })

  it('かんたんは危ない仕掛けのない練習ステージにする', () => {
    const stage = createMazeStageById('kantan')
    expect(stage.gimmicks.spinners).toHaveLength(0)
    expect(stage.gimmicks.bumpers).toHaveLength(0)
    expect(stage.gimmicks.cars).toHaveLength(0)
    expect(stage.gimmicks.jumpPads).toHaveLength(0)
    expect(stage.gimmicks.cannons).toHaveLength(0)
    expect(stage.holes).toHaveLength(0)
  })

  it('既定ステージはカタログの最初に置く', () => {
    expect(DEFAULT_MAZE_STAGE_ID).toBe(MAZE_STAGES[0]?.id)
  })

  it('実データでも各ステージの最初のチェックポイントはSTARTになる', () => {
    for (const definition of MAZE_STAGES) {
      const stage = createMazeStageById(definition.id)
      expect(stage.checkpoints[0]).toEqual(stage.start)
    }
  })

  it('IDから対応するステージを組み立てる', () => {
    for (const id of MAZE_STAGE_IDS) {
      expect(createMazeStageById(id).id).toBe(id)
    }
  })

  it('未知のIDでも既定ステージを返して遊べるようにする', () => {
    expect(() => createMazeStageById('unknown-stage')).not.toThrow()
    expect(createMazeStageById('unknown-stage').id).toBe(DEFAULT_MAZE_STAGE_ID)
  })

  it('カタログ順で次のステージを返し、最後にはnullを返す', () => {
    for (const [index, id] of MAZE_STAGE_IDS.entries()) {
      expect(nextMazeStageId(id)).toBe(MAZE_STAGE_IDS[index + 1] ?? null)
    }
  })

  it('未知の値をステージIDとして受け付けない', () => {
    for (const value of ['unknown-stage', 1, null, {}]) {
      expect(isMazeStageId(value)).toBe(false)
    }
  })
})
