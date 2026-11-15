import { expect, it } from 'vitest'
import { drawTownMap, mapColor } from './mapColors'
import { applyTool, COLS, createEmptyTown } from './town'

it('gives ground, ways, nature and buildings their own colours on the map', () => {
  const colors = [
    mapColor({ ground: 'grass', part: null }), mapColor({ ground: 'water', part: null }), mapColor({ ground: 'sand', part: null }),
    mapColor({ ground: 'snow', part: null }), mapColor({ ground: 'grass', part: 'road' }), mapColor({ ground: 'water', part: 'road' }),
    mapColor({ ground: 'grass', part: 'rail' }), mapColor({ ground: 'grass', part: 'crossing' }), mapColor({ ground: 'grass', part: 'tree' }),
    mapColor({ ground: 'grass', part: 'house' }),
  ]
  expect(new Set(colors).size).toBe(colors.length)
  // たてものは じめんが ちがっても おなじ めだつ いろ。
  expect(mapColor({ ground: 'snow', part: 'tower' })).toBe(mapColor({ ground: 'grass', part: 'house' }))
})

it('paints one square for every tile at its place', () => {
  const calls: [string, number, number, number, number][] = []
  const context = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { calls.push([this.fillStyle, x, y, w, h]) } }
  const town = applyTool(createEmptyTown(), COLS + 2, 'water')
  drawTownMap(context as unknown as CanvasRenderingContext2D, town, COLS, 4)
  expect(calls).toHaveLength(town.length)
  expect(calls[0]).toEqual([mapColor(town[0]), 0, 0, 4, 4])
  expect(calls[COLS + 2]).toEqual([mapColor(town[COLS + 2]), 8, 4, 4, 4])
})
