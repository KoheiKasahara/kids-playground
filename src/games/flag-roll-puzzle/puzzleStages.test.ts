import { describe, expect, test } from 'vitest'
import { PUZZLE_STAGES, puzzleStage } from './puzzleStages'

describe('puzzleStages', () => {
  test('かんたん・ふつう・むずかしいをデータとして定義している', () => {
    expect(PUZZLE_STAGES.map((stage) => stage.id)).toEqual(['easy', 'normal', 'hard'])
    expect(PUZZLE_STAGES.map((stage) => stage.nameJa)).toEqual(['かんたん', 'ふつう', 'むずかしい'])
  })

  test('難易度ごとにボール数、開始位置、ゴール、使用パーツが変わる', () => {
    const easy = puzzleStage('easy')
    const normal = puzzleStage('normal')
    const hard = puzzleStage('hard')

    expect(easy.balls).toHaveLength(1)
    expect(normal.balls).toHaveLength(1)
    expect(hard.balls).toHaveLength(2)
    expect(new Set(hard.balls.map((ball) => ball.id)).size).toBe(2)
    expect(hard.balls.map((ball) => ball.startPosition.x)).toEqual([90, 270])
    expect(easy.goalArea.width).toBeGreaterThan(normal.goalArea.width)
    expect(normal.goalArea.x).toBeGreaterThan(easy.goalArea.x)
    expect(normal.availablePartTypeIds).not.toContain('bumper')
    expect(easy.availablePartTypeIds).toContain('bumper')
  })
})

