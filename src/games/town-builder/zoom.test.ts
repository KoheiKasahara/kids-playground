import { expect, it } from 'vitest'
import { CENTER_INDEX, COLS, ROWS } from './town'
import { centerOfTile, comfortableZoom, tileAtCenter, tileSizeFor, visibleRange, ZOOM_LEVELS } from './zoom'

it('makes tiles bigger with each zoom step and starts at a finger-friendly size', () => {
  for (const [width, height] of [[360, 520], [820, 900], [900, 380]] as const) {
    const sizes = Array.from({ length: ZOOM_LEVELS }, (_, zoom) => tileSizeFor(width, height, zoom))
    for (let zoom = 1; zoom < ZOOM_LEVELS; zoom += 1) expect(sizes[zoom]).toBeGreaterThan(sizes[zoom - 1])
    const comfortable = tileSizeFor(width, height, comfortableZoom(width, height))
    expect(comfortable).toBeGreaterThanOrEqual(48)
    expect(comfortable).toBeLessThanOrEqual(110)
  }
  expect(tileSizeFor(100, 100, 0)).toBe(24)
  expect(tileSizeFor(4000, 4000, 99)).toBe(150)
})

it('draws only the tiles around the place being looked at, however wide the map is', () => {
  const middle = visibleRange(centerOfTile(CENTER_INDEX), 360, 520, 60)
  expect(middle).toEqual({ col0: 19, col1: 29, row0: 18, row1: 30 })
  // どの ズームでも、えがく マスは ちず ぜんたいより ずっと すくない。
  for (const [width, height] of [[360, 520], [1280, 720]] as const) {
    for (let zoom = 0; zoom < ZOOM_LEVELS; zoom += 1) {
      const range = visibleRange({ x: 0.5, y: 0.5 }, width, height, tileSizeFor(width, height, zoom))
      const count = (range.col1 - range.col0 + 1) * (range.row1 - range.row0 + 1)
      expect(count).toBeLessThan(COLS * ROWS * 0.5)
    }
  }
  // はしでは ちずの そとへ はみださない。
  expect(visibleRange({ x: 0, y: 0 }, 360, 520, 60)).toEqual({ col0: 0, col1: 8, row0: 0, row1: 10 })
  expect(visibleRange({ x: 1, y: 1 }, 360, 520, 60)).toEqual({ col0: COLS - 8, col1: COLS - 1, row0: ROWS - 11, row1: ROWS - 1 })
  // ちずが わくより ちいさければ ぜんぶ えがく。
  expect(visibleRange({ x: 0.5, y: 0.5 }, 5000, 5000, 24)).toEqual({ col0: 0, col1: COLS - 1, row0: 0, row1: ROWS - 1 })
})

it('converts between a tile and the place to look at', () => {
  for (const index of [0, CENTER_INDEX, COLS * ROWS - 1, 5 * COLS + 40]) expect(tileAtCenter(centerOfTile(index))).toBe(index)
  expect(tileAtCenter({ x: -1, y: 2 })).toBe((ROWS - 1) * COLS)
})
