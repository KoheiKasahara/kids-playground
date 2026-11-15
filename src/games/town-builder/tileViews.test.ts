import { expect, it } from 'vitest'
import { createMapTown, MAPS } from './maps'
import { PARTS, type Scale, type ToolId } from './parts'
import { applyTool, COLS, populationOf, ROWS } from './town'
import { boardOf, describeTile } from './tileViews'

function seeded(seed: number) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

const TOOLS: ToolId[] = [...PARTS.map((part) => part.id), 'erase']

it.each(MAPS.map((map) => [map.id]))('updates only the changed tiles of %s, and the result matches a full redraw', (id) => {
  const random = seeded(id.length * 31 + 7)
  let board = boardOf(createMapTown(id))
  for (let step = 1; step <= 120; step += 1) {
    const index = Math.floor(random() * COLS * ROWS)
    const tool = TOOLS[Math.floor(random() * TOOLS.length)]
    const scale = (1 + Math.floor(random() * 3)) as Scale
    const next = boardOf(applyTool(board.town, index, tool, scale), board)
    // まちが かわらない ときは みため も そのまま。
    if (next.town === board.town) expect(next.views).toBe(board.views)
    expect(next.views).toEqual(next.town.map((_, cell) => describeTile(next.town, cell)))
    expect(next.population).toBe(populationOf(next.town))
    // みため が おなじ マスは まえと おなじ もの を つかう（マスを かきなおさない）。
    next.views.forEach((view, cell) => {
      if (JSON.stringify(view) === JSON.stringify(board.views[cell])) expect(view).toBe(board.views[cell])
    })
    board = next
  }
})

it('redraws a whole big building when a road reaches any of its tiles', () => {
  let board = boardOf(applyTool(createMapTown('empty'), 2 * COLS + 2, 'house', 3))
  expect(board.views[4 * COLS + 4].wantsRoad || board.views[2 * COLS + 4].wantsRoad).toBe(true)
  expect(board.views[4 * COLS + 4].lit).toBe(false)
  board = boardOf(applyTool(board.town, 5 * COLS + 2, 'road'), board)
  // みちが さわった のは ひだりした だが、みぎうえの マスまで あかりが つき、しるしも きえる。
  expect(board.views[2 * COLS + 4].lit).toBe(true)
  expect(board.views[2 * COLS + 4].wantsRoad).toBe(false)
  expect(board.views[2 * COLS + 4].label).not.toContain('みちが ほしい')
})
