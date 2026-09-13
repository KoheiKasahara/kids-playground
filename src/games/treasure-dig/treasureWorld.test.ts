import { describe, expect, test } from 'vitest'
import { buildLayout, type Stage } from './stages'
import { Cell, TreasureWorld, type Point } from './treasureWorld'

// 1文字=1ますで小さな盤面を作り、落ち方・流れ方の決まりだけを確かめる。
// 'G' は たからのかたまり（'g' はステージ用の 4x4 展開なので ここでは使わない）。
function makeWorld(map: string[], need = 1, random: () => number = () => 0.75) {
  const stage: Stage = { id: 'test', name: 'てすと', hint: '', need, map }
  return new TreasureWorld(buildLayout(stage, 1), need, random)
}
function run(world: TreasureWorld, steps: number) { for (let i = 0; i < steps; i++) world.step() }
/** ゆらぎのある挙動（ながれが つぶを おす確率など）を見るときの、再現できる乱数。 */
function seeded(seed: number) { return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 }
function find(world: TreasureWorld, material: number): Point | null {
  for (let y = 0; y < world.height; y++) for (let x = 0; x < world.width; x++) if (world.get(x, y) === material) return { x, y }
  return null
}
function count(world: TreasureWorld, material: number) {
  let total = 0
  for (let y = 0; y < world.height; y++) for (let x = 0; x < world.width; x++) if (world.get(x, y) === material) total++
  return total
}

describe('つぶの おちかた', () => {
  test('すなは 下へ おち、ゆかの うえで とまる', () => {
    const world = makeWorld(['.s..', '....', '....', 'rrrr'])
    run(world, 6)
    expect(world.get(1, 2)).toBe(Cell.Sand)
    expect(world.activity).toBe(0)
  })

  test('つみあがった すなは ななめに くずれて やまに なる', () => {
    const world = makeWorld(['..s..', '..s..', '..s..', 'rrrrr'])
    run(world, 30)
    const bottom = [0, 1, 2, 3, 4].filter(x => world.get(x, 2) === Cell.Sand)
    expect(bottom.length).toBeGreaterThan(1)
    expect(count(world, Cell.Sand)).toBe(3)
  })

  test('つちと いわは ささえたまま うごかない', () => {
    const world = makeWorld(['d..r', '....', '....', '....'])
    run(world, 10)
    expect(world.get(0, 0)).toBe(Cell.Dirt)
    expect(world.get(3, 0)).toBe(Cell.Rock)
  })

  test('つぶは ばんめんの そとへ こぼれない', () => {
    const world = makeWorld(['s', 'G'])
    run(world, 10)
    expect(world.get(0, 1)).toBe(Cell.Gem)
    expect(world.gems).toBe(1)
  })
})

describe('みずの ながれ', () => {
  test('みずは よこへ ひろがって たいらに なる', () => {
    const world = makeWorld(['..w..', '..w..', 'rrrrr'])
    run(world, 24)
    expect(count(world, Cell.Water)).toBe(2)
    const surface = [0, 1, 2, 3, 4].filter(x => world.get(x, 1) === Cell.Water)
    expect(surface).toHaveLength(2)
  })

  test('みずの なかでは たからが すなより はやく しずむ', () => {
    const world = makeWorld(['sG', 'ww', 'ww', 'ww', 'rr'])
    run(world, 3)
    expect(find(world, Cell.Gem)!.y).toBeGreaterThan(find(world, Cell.Sand)!.y)
  })

  test('ながれる みずは ゆかの つぶを 下流へ はこび、たからばこへ おとす', () => {
    const world = makeWorld([
      'f........',
      '.........',
      '..GGGG...',
      'rrrrrrrrb',
    ], 1, seeded(5))
    run(world, 600)
    expect(world.collected).toBeGreaterThan(0)
    expect(world.cleared).toBe(true)
  })

  test('いずみは 下が あいている あいだ みずを わかせる', () => {
    const world = makeWorld(['f...', '....', '....', 'rrrr'])
    run(world, 40)
    expect(count(world, Cell.Water)).toBeGreaterThan(0)
    expect(world.get(0, 0)).toBe(Cell.Spring)
  })
})

describe('たからばこと あな', () => {
  test('はこに はいった たからだけ かぞえ、すなや みずは すいこまれる', () => {
    const world = makeWorld(['Gsw.', 'bbb.', 'rrrr'], 1)
    run(world, 10)
    expect(world.collected).toBe(1)
    expect(world.gems).toBe(0)
    expect(world.lost).toBe(0)
    expect(count(world, Cell.Sand)).toBe(0)
  })

  test('あなに おちた たからは なくなり、のこりで とどかなければ やりなおしを すすめる', () => {
    const world = makeWorld(['G.G.', 'o.b.', 'rrrr'], 2)
    run(world, 10)
    expect(world.lost).toBe(1)
    expect(world.collected).toBe(1)
    expect(world.cleared).toBe(false)
    expect(world.hopeless).toBe(true)
  })

  test('ひつようなぶん あつめると クリア、ぜんぶ あつめると かんぺき', () => {
    const world = makeWorld(['G...', '.G..', 'bb..', 'rrrr'], 1)
    expect(world.total).toBe(2)
    run(world, 1)
    expect(world.cleared).toBe(true)
    expect(world.perfect).toBe(false)
    run(world, 4)
    expect(world.collected).toBe(2)
    expect(world.perfect).toBe(true)
  })
})

describe('どうぐ', () => {
  test('ほるは すな・つち・おいた いしだけ けずり、いわ・たから・しかけは のこす', () => {
    const world = makeWorld(['sdr', 'Gbo'])
    world.apply({ x: 0, y: 0 }, 'stone', 0)
    expect(world.get(0, 0)).toBe(Cell.Sand)
    for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) world.apply({ x, y }, 'dig', 0)
    expect(world.get(0, 0)).toBe(Cell.Empty)
    expect(world.get(1, 0)).toBe(Cell.Empty)
    expect(world.get(2, 0)).toBe(Cell.Rock)
    expect(world.get(0, 1)).toBe(Cell.Gem)
    expect(world.get(1, 1)).toBe(Cell.Box)
    expect(world.get(2, 1)).toBe(Cell.Drain)
  })

  test('おいた いしは ほりなおせる', () => {
    const world = makeWorld(['..', '..'])
    expect(world.apply({ x: 0, y: 0 }, 'stone', 0)).toBe(1)
    expect(world.get(0, 0)).toBe(Cell.Stone)
    expect(world.apply({ x: 0, y: 0 }, 'dig', 0)).toBe(1)
    expect(world.get(0, 0)).toBe(Cell.Empty)
  })

  test('すなと いしは みずを おしのけ、みずは あいた ますにだけ そそげる', () => {
    const world = makeWorld(['w.r', '...'])
    expect(world.apply({ x: 0, y: 0 }, 'sand', 0)).toBe(1)
    expect(world.get(0, 0)).toBe(Cell.Sand)
    expect(world.apply({ x: 1, y: 0 }, 'water', 0)).toBe(1)
    expect(world.apply({ x: 1, y: 0 }, 'water', 0)).toBe(0)
    expect(world.apply({ x: 2, y: 0 }, 'water', 0)).toBe(0)
    expect(world.get(2, 0)).toBe(Cell.Rock)
  })

  test('なぞると とちゅうの ますも けずれる', () => {
    const world = makeWorld(['ssss', 'ssss'])
    expect(world.stroke({ x: 0, y: 0 }, { x: 3, y: 0 }, 'dig', 0)).toBeGreaterThanOrEqual(4)
    expect(world.get(0, 0)).toBe(Cell.Empty)
    expect(world.get(3, 0)).toBe(Cell.Empty)
  })
})

test('やりなおしで ばんめんも かぞえも さいしょに もどる', () => {
  const world = makeWorld(['G...', '.s..', 'bbbb', 'rrrr'], 1)
  const before = world.cells.slice()
  run(world, 10)
  expect(world.collected).toBe(1)
  world.apply({ x: 3, y: 0 }, 'stone', 0)
  world.reset()
  expect(world.cells).toEqual(before)
  expect(world.collected).toBe(0)
  expect(world.gems).toBe(1)
  expect(world.lost).toBe(0)
})
