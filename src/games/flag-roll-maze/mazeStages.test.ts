import { describe, expect, it } from 'vitest'
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
      ].join(',')
    })

    expect(new Set(signatures).size).toBe(MAZE_STAGES.length)
  })

  it('かんたんは危ない仕掛けのない練習ステージにする', () => {
    const stage = createMazeStageById('kantan')
    expect(stage.gimmicks.spinners).toHaveLength(0)
    expect(stage.gimmicks.bumpers).toHaveLength(0)
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
