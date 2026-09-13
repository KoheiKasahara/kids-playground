import { describe, expect, test } from 'vitest'
import { CELL_SCALE, MAP_HEIGHT, MAP_WIDTH, STAGES, WORLD_HEIGHT, WORLD_WIDTH, buildLayout } from './stages'
import { Cell, TreasureWorld, type Point, type Tool } from './treasureWorld'

describe('ステージのデータ', () => {
  test('idが一意で、なまえとヒントがある', () => {
    expect(new Set(STAGES.map(stage => stage.id)).size).toBe(STAGES.length)
    for (const stage of STAGES) {
      expect(stage.id).toMatch(/^[a-z][a-z-]*$/)
      expect(stage.name.length).toBeGreaterThan(0)
      expect(stage.hint.length).toBeGreaterThan(0)
    }
  })

  test('マップの大きさと使える文字がそろっている', () => {
    for (const stage of STAGES) {
      expect(stage.map, stage.id).toHaveLength(MAP_HEIGHT)
      for (const row of stage.map) {
        expect(row, `${stage.id}: ${row}`).toHaveLength(MAP_WIDTH)
        expect(row, stage.id).toMatch(/^[.swdrobfgG]+$/)
      }
    }
  })

  test('どのステージにも たからばこと、ひつよう数いじょうの たからが ある', () => {
    for (const stage of STAGES) {
      const layout = buildLayout(stage)
      expect(layout.width).toBe(WORLD_WIDTH)
      expect(layout.height).toBe(WORLD_HEIGHT)
      expect(stage.need, stage.id).toBeGreaterThan(0)
      expect(layout.gems, stage.id).toBeGreaterThanOrEqual(stage.need)
      expect([...layout.cells].filter(cell => cell === Cell.Box).length, stage.id).toBeGreaterThan(0)
    }
  })

  test('gは すなの なかの つぶ、Gは かたまりとして 展開される', () => {
    const layout = buildLayout({ id: 'x', name: 'x', hint: 'x', need: 1, map: ['gG'] })
    expect(layout.width).toBe(2 * CELL_SCALE)
    expect(layout.gems).toBe(4 + CELL_SCALE * CELL_SCALE)
    expect(layout.cells[0]).toBe(Cell.Sand)
    expect(layout.cells[CELL_SCALE + 1]).toBe(Cell.Gem)
  })
})

// マップ座標（1文字ぶん）の まんなかを ばんめん座標へ直す。
const at = (column: number, row: number): Point => ({ x: column * CELL_SCALE + 2, y: row * CELL_SCALE + 2 })
function seeded(seed: number) { return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 }
function playable(index: number) {
  const stage = STAGES[index]
  const world = new TreasureWorld(buildLayout(stage), stage.need, seeded(7))
  return {
    world,
    dig: (from: [number, number], to: [number, number], tool: Tool = 'dig', radius = 5) =>
      world.stroke(at(...from), at(...to), tool, radius),
    settle: (steps: number) => { for (let i = 0; i < steps; i++) world.step() },
    pour: (column: number, row: number, frames: number) => {
      for (let frame = 0; frame < frames; frame++) { world.apply(at(column, row), 'water', 5); world.step(); world.step() }
    },
  }
}

// 遊び方が こわれていないことの 見張り。ステージごとに「ふつうに 思いつく手」を打ち、
// クリア条件へ届くことを確かめる（物理の調整で ステージが 詰むのを防ぐ）。
describe('ステージが クリアできる', () => {
  test('1 まっすぐ ほる', () => {
    const game = playable(0)
    game.dig([11, 8], [11, 10])
    game.settle(1800)
    expect(game.world.cleared).toBe(true)
  })
  test('2 いわの よこを ほる', () => {
    const game = playable(1)
    game.dig([8, 6], [8, 12])
    game.dig([15, 6], [15, 12])
    game.settle(1800)
    expect(game.world.cleared).toBe(true)
  })
  test('3 ダムを ほって みずを かける', () => {
    const game = playable(2)
    game.dig([7, 6], [7, 10])
    game.settle(1500)
    game.pour(9, 5, 200)
    game.settle(1500)
    expect(game.world.cleared).toBe(true)
  })
  test('4 たからばこの まうえを ほる', () => {
    const game = playable(3)
    game.dig([11, 6], [11, 9])
    game.settle(2000)
    expect(game.world.cleared).toBe(true)
  })
  test('5 いしで すべりだいを かく', () => {
    const game = playable(4)
    game.dig([3, 8], [16, 24], 'stone', 3)
    game.dig([4, 5], [4, 6])
    game.settle(2400)
    expect(game.world.cleared).toBe(true)
  })
  test('6 いずみの せんを ひらく', () => {
    const game = playable(5)
    game.dig([7, 13], [7, 14])
    game.settle(3000)
    expect(game.world.cleared).toBe(true)
  })
  test('7 たからばこ側の みちを ひらく', () => {
    const game = playable(6)
    game.dig([16, 6], [16, 12])
    game.dig([9, 6], [16, 6])
    game.settle(2400)
    expect(game.world.cleared).toBe(true)
  })
  test('8 みずの そこを ほる', () => {
    const game = playable(7)
    game.dig([11, 11], [11, 12])
    game.settle(2400)
    expect(game.world.cleared).toBe(true)
  })
  test('9 めいろを つなぐ', () => {
    const game = playable(8)
    game.dig([9, 6], [13, 11], 'dig', 6)
    game.dig([13, 11], [9, 18], 'dig', 6)
    game.dig([9, 18], [12, 25], 'dig', 6)
    game.dig([12, 25], [12, 27], 'dig', 6)
    game.settle(3000)
    expect(game.world.cleared).toBe(true)
  })
  test('10 やまの したの つちを ほる', () => {
    const game = playable(9)
    game.dig([12, 8], [12, 13])
    game.settle(3000)
    expect(game.world.cleared).toBe(true)
  })
})
