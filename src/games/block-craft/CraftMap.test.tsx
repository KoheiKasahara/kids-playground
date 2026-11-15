import { render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import CraftMap from './CraftMap'
import { mapPixels } from './mapPixels'
import { createWorld, editWorld, materialDef } from './world'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('colors the map by the top block, brighter on high ground', () => {
  const world = createWorld()
  const pixels = mapPixels(world)
  expect(pixels).toHaveLength(world.area * 4)
  const at = (x: number, z: number) => [...pixels.slice((x + z * world.size) * 4, (x + z * world.size) * 4 + 4)]
  const rgb = (id: 'water' | 'grass') => { const v = Number.parseInt(materialDef(id).color.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255] }
  // みずうみ（z<2）は あおく、くさはらは みどり
  const [water, grass] = [at(4, 0), at(8, 8)]
  expect(water[2]).toBeGreaterThan(water[0])
  expect(grass[1]).toBeGreaterThan(grass[2])
  expect(water[3]).toBe(255)
  const scale = (color: number[], base: number[]) => color[1] / base[1]
  expect(scale(grass, rgb('grass'))).toBeCloseTo(scale(water, rgb('water')), 1)
  // おかの うえ（12, 6）は ひくい くさはらより あかるい
  expect(at(11, 8)[1]).toBeGreaterThan(grass[1])
})

it('draws the world, redraws after edits, and marks the place and the hidden treasures', () => {
  const put = vi.fn()
  vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ putImageData: put } as unknown as CanvasRenderingContext2D)
  const world = createWorld()
  const view = render(<CraftMap world={world} at={{ x: 3, z: 12 }} found={0} />)
  expect(put).toHaveBeenCalledTimes(1)
  expect(put.mock.calls[0][0]).toMatchObject({ width: world.size, height: world.size })
  expect(view.container.querySelectorAll('[data-treasure]')).toHaveLength(world.treasures.length)
  const here = view.container.querySelector<HTMLElement>('[data-here]')!
  expect([here.style.left, here.style.top]).toEqual([`${3.5 / 16 * 100}%`, `${12.5 / 16 * 100}%`])
  const [treasure] = world.treasures
  editWorld(world, [{ ...treasure, y: 2 }, treasure], 'stone', 'remove')
  expect(put).toHaveBeenCalledTimes(2)
  view.rerender(<CraftMap world={world} at={{ x: 3, z: 12 }} found={1} />)
  expect(view.container.querySelectorAll('[data-treasure]')).toHaveLength(world.treasures.length - 1)
  view.unmount()
  editWorld(world, { x: 8, y: 3, z: 8 }, 'stone', 'place')
  expect(put).toHaveBeenCalledTimes(2)
})

it('shows the markers even where a canvas cannot be drawn', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const world = createWorld()
  const view = render(<CraftMap world={world} at={{ x: 0, z: 0 }} found={0} />)
  expect(view.container.querySelector('[data-here]')).not.toBeNull()
})
