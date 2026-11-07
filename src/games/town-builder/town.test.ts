import { describe, expect, it } from 'vitest'
import { CATEGORIES, PARTS, partsInCategory } from './parts'
import {
  applyTool, COLS, createEmptyTown, createTown, decodeTown, encodeTown, isConnected, populationOf, railMask,
  rankOf, RANKS, roadMask, ROWS, waterMask, wantsRoad, type Town,
} from './town'

const at = (col: number, row: number) => row * COLS + col

function build(steps: readonly [number, Parameters<typeof applyTool>[2]][], town: Town = createEmptyTown()): Town {
  return steps.reduce((current, [index, tool]) => applyTool(current, index, tool), town)
}

describe('parts', () => {
  it('has unique ids and every category offers something to place', () => {
    expect(new Set(PARTS.map((part) => part.id)).size).toBe(PARTS.length)
    for (const category of CATEGORIES) {
      expect(partsInCategory(category.id).length).toBeGreaterThan(0)
      expect(partsInCategory(category.id).some((part) => part.id === category.icon)).toBe(true)
    }
  })
})

describe('town', () => {
  it('starts with a full starter town: a river, a bridge and houses connected by a road', () => {
    const town = createTown()
    expect(town).toHaveLength(COLS * ROWS)
    expect(town.some((tile) => tile.ground === 'water' && tile.part === 'road')).toBe(true)
    expect(town.filter((tile) => tile.part === 'house' || tile.part === 'house-blue')).toHaveLength(2)
    expect(populationOf(town)).toBe(8)
    expect(createEmptyTown().every((tile) => tile.ground === 'grass' && tile.part === null)).toBe(true)
  })

  it('places and replaces buildings, filling in water, and ignores repeats', () => {
    const empty = createEmptyTown()
    const house = applyTool(empty, 0, 'house')
    expect(house[0]).toEqual({ ground: 'grass', part: 'house' })
    expect(applyTool(house, 0, 'house')).toBe(house)
    expect(applyTool(house, 0, 'castle')[0].part).toBe('castle')
    const lake = applyTool(empty, 5, 'water')
    expect(lake[5]).toEqual({ ground: 'water', part: null })
    expect(applyTool(lake, 5, 'water')).toBe(lake)
    expect(applyTool(lake, 5, 'tree')[5]).toEqual({ ground: 'grass', part: 'tree' })
    expect(applyTool(empty, -1, 'house')).toBe(empty)
    expect(applyTool(empty, COLS * ROWS, 'house')).toBe(empty)
  })

  it('turns roads over water into bridges, crossing roads and rails into level crossings', () => {
    const bridge = build([[0, 'water'], [0, 'road']])
    expect(bridge[0]).toEqual({ ground: 'water', part: 'road' })
    const flooded = build([[1, 'rail'], [1, 'water'], [2, 'house'], [2, 'water']])
    expect(flooded[1]).toEqual({ ground: 'water', part: 'rail' })
    expect(flooded[2]).toEqual({ ground: 'water', part: null })
    const crossing = build([[3, 'road'], [3, 'rail']])
    expect(crossing[3].part).toBe('crossing')
    expect(applyTool(crossing, 3, 'road')).toBe(crossing)
    expect(build([[4, 'rail'], [4, 'road']])[4].part).toBe('crossing')
  })

  it('erases the part first, then the water, and does nothing on bare grass', () => {
    const bridge = build([[0, 'water'], [0, 'road']])
    const river = applyTool(bridge, 0, 'erase')
    expect(river[0]).toEqual({ ground: 'water', part: null })
    expect(applyTool(river, 0, 'erase')[0]).toEqual({ ground: 'grass', part: null })
    const empty = createEmptyTown()
    expect(applyTool(empty, 0, 'erase')).toBe(empty)
  })

  it('connects neighbours by direction bits and only counts residents next to a road', () => {
    const center = at(5, 5)
    const town = build([[at(5, 4), 'road'], [at(6, 5), 'rail'], [at(5, 6), 'road'], [at(4, 5), 'water'], [center, 'road']])
    expect(roadMask(town, center)).toBe(0b0101)
    expect(railMask(town, center)).toBe(0b0010)
    expect(waterMask(town, center)).toBe(0b1000)
    expect(roadMask(town, 0)).toBe(0)

    const lonely = build([[at(0, 0), 'apartment']])
    expect(populationOf(lonely)).toBe(0)
    expect(wantsRoad(lonely, at(0, 0))).toBe(true)
    const connected = applyTool(lonely, at(1, 0), 'road')
    expect(isConnected(connected, at(0, 0))).toBe(true)
    expect(wantsRoad(connected, at(0, 0))).toBe(false)
    expect(populationOf(connected)).toBe(12)
    expect(wantsRoad(build([[0, 'tree']]), 0)).toBe(false)
    // ふみきりも みちとして つながる。
    expect(populationOf(build([[at(2, 2), 'house'], [at(3, 2), 'rail'], [at(3, 2), 'road']]))).toBe(4)
  })

  it('grows through ranks as the population passes each threshold', () => {
    expect(rankOf(0)).toBe(0)
    RANKS.forEach((rank, index) => {
      expect(rankOf(rank.min)).toBe(index)
      if (index > 0) expect(rankOf(rank.min - 1)).toBe(index - 1)
    })
    expect(rankOf(100000)).toBe(RANKS.length - 1)
  })
})

describe('saving', () => {
  it('round-trips every kind of tile', () => {
    const town = build([[0, 'water'], [0, 'road'], [1, 'rail'], [1, 'road'], [2, 'ferris'], [3, 'water'], [4, 'tv-tower']], createTown())
    expect(decodeTown(encodeTown(town))).toEqual(town)
  })

  it('rejects missing, broken, resized or impossible saves', () => {
    const tiles = createEmptyTown().map(() => 'g')
    const save = (patch: object) => JSON.stringify({ version: 1, cols: COLS, rows: ROWS, tiles, ...patch })
    expect(decodeTown(null)).toBeNull()
    expect(decodeTown('{broken')).toBeNull()
    expect(decodeTown('42')).toBeNull()
    expect(decodeTown(save({ version: 2 }))).toBeNull()
    expect(decodeTown(save({ cols: 12 }))).toBeNull()
    expect(decodeTown(save({ tiles: tiles.slice(1) }))).toBeNull()
    expect(decodeTown(save({ tiles: ['g:spaceship', ...tiles.slice(1)] }))).toBeNull()
    expect(decodeTown(save({ tiles: ['g:water', ...tiles.slice(1)] }))).toBeNull()
    expect(decodeTown(save({ tiles: ['w:house', ...tiles.slice(1)] }))).toBeNull()
    expect(decodeTown(save({ tiles: ['x', ...tiles.slice(1)] }))).toBeNull()
    expect(decodeTown(save({ tiles: [7, ...tiles.slice(1)] }))).toBeNull()
    expect(decodeTown(save({ tiles: ['g:road:x', ...tiles.slice(1)] }))).toBeNull()
    expect(decodeTown(save({}))).toEqual(createEmptyTown())
  })
})
