import { describe, expect, it } from 'vitest'
import { CATEGORIES, fitScale, PARTS, partsInCategory, scalesOf } from './parts'
import { createTown } from './maps'
import {
  applyTool, buildingCells, COLS, createEmptyTown, decodeTown, encodeTown, footprintOf, isConnected, populationOf, railMask,
  rankOf, RANKS, residentsAt, roadMask, ROWS, waterMask, wantsRoad, type Town,
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
  it('starts with a full starter town: a river, bridges, a railway and houses connected by a road', () => {
    const town = createTown()
    expect(town).toHaveLength(COLS * ROWS)
    expect(town.some((tile) => tile.ground === 'water' && tile.part === 'road')).toBe(true)
    expect(town.some((tile) => tile.ground === 'water' && tile.part === 'rail')).toBe(true)
    expect(town.some((tile) => tile.part === 'crossing')).toBe(true)
    expect(town.filter((tile) => tile.part === 'house' || tile.part === 'house-blue').length).toBeGreaterThan(3)
    expect(populationOf(town)).toBeGreaterThanOrEqual(RANKS[2].min)
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
    expect(decodeTown(save({ version: 3 }))).toBeNull()
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

  it('saves sizes and the corner of big buildings, and still reads old saves without sizes', () => {
    const town = build([[at(1, 1), 'house'], [at(5, 5), 'stadium'], [at(10, 0), 'tree']])
    const big = applyTool(applyTool(town, at(1, 1), 'house', 3), at(10, 0), 'tree', 2)
    const saved = JSON.parse(encodeTown(big))
    expect(saved.version).toBe(2)
    expect(saved.tiles[at(2, 2)]).toBe(`g:house:${at(1, 1)}:3`)
    expect(saved.tiles[at(6, 6)]).toBe(`g:stadium:${at(5, 5)}`)
    expect(decodeTown(encodeTown(big))).toEqual(big)

    // むかしの ほぞん（version 1）は おおきさが なく、1マスの ものと 2マスの たてものが よめる。
    const legacy = { version: 1, cols: COLS, rows: ROWS, tiles: JSON.parse(encodeTown(town)).tiles }
    expect(decodeTown(JSON.stringify(legacy))).toEqual(town)
    const tiles = createEmptyTown().map(() => 'g')
    const v2 = (first: string[]) => JSON.stringify({ version: 2, cols: COLS, rows: ROWS, tiles: [...first, ...tiles.slice(first.length)] })
    const v1 = (first: string[]) => JSON.stringify({ version: 1, cols: COLS, rows: ROWS, tiles: [...first, ...tiles.slice(first.length)] })
    expect(decodeTown(v1(['g:house:0:2', 'g:house:0:2']))).toBeNull()
    // おおきさは 2・3 だけ、えらべない おおきさや anchor の ない ものは こわれた ほぞん。
    expect(decodeTown(v2(['g:house:0:1']))).toBeNull()
    expect(decodeTown(v2(['g:house:0:4']))).toBeNull()
    expect(decodeTown(v2(['g:road:0:2']))).toBeNull()
    expect(decodeTown(v2(['g:house::2']))).toBeNull()
    expect(decodeTown(v2(['g:airport:0:3', 'g:airport:0:3']))).toBeNull()
    // マスが たりない おおきな たてもの。
    expect(decodeTown(v2(['g:house:0:2', 'g:house:0:2']))).toBeNull()
    const whole = createEmptyTown().map((_, index) => ([0, 1, COLS, COLS + 1].includes(index) ? 'g:house:0:2' : 'g'))
    expect(decodeTown(JSON.stringify({ version: 2, cols: COLS, rows: ROWS, tiles: whole }))?.[COLS + 1]).toEqual({ ground: 'grass', part: 'house', anchor: 0, scale: 2 })
  })
})

describe('sizes', () => {
  it('offers bigger sizes only for buildings, and fits the chosen size to each part', () => {
    expect(scalesOf('house')).toEqual([1, 2, 3])
    expect(scalesOf('stadium')).toEqual([1, 2])
    expect(scalesOf('road')).toEqual([1])
    expect(scalesOf('erase')).toEqual([1])
    expect(fitScale('stadium', 3)).toBe(2)
    expect(fitScale('water', 3)).toBe(1)
  })

  it('places a big house over 2×2 or 3×3 cells, shifted to stay on the map', () => {
    const empty = createEmptyTown()
    const big = applyTool(empty, at(4, 4), 'house', 2)
    expect(buildingCells(big, at(5, 5)).sort((a, b) => a - b)).toEqual([at(4, 4), at(5, 4), at(4, 5), at(5, 5)])
    expect(big[at(5, 5)]).toEqual({ ground: 'grass', part: 'house', anchor: at(4, 4), scale: 2 })
    // おなじ ものを おなじ おおきさで タップしても かわらない。
    expect(applyTool(big, at(5, 4), 'house', 2)).toBe(big)
    // ちずの はしでは うちがわへ ずらす。
    const corner = applyTool(empty, COLS * ROWS - 1, 'tree', 3)
    expect(footprintOf(corner[COLS * ROWS - 1].anchor!, 'tree', 3)).toContain(COLS * ROWS - 1)
    expect(corner[at(COLS - 3, ROWS - 3)].anchor).toBe(at(COLS - 3, ROWS - 3))
    // かわの うえに おくと うめたてる。
    const lake = applyTool(applyTool(empty, at(1, 1), 'water'), at(1, 1), 'house', 2)
    expect(lake[at(1, 1)].ground).toBe('grass')
    // みちや かわは おおきさを えらんでも 1マス。
    expect(applyTool(empty, 0, 'road', 3).filter((tile) => tile.part === 'road')).toHaveLength(1)
  })

  it('changes size in place, overwrites what is under it, and erases the whole building', () => {
    const town = build([[at(4, 4), 'tree'], [at(5, 5), 'stadium']])
    // 2×2 の スタジアムの うえに 3×3 の いえを おくと、かかる ものは まるごと どける。
    const house = applyTool(town, at(3, 3), 'house', 3)
    expect(house.filter((tile) => tile.part === 'stadium')).toHaveLength(0)
    expect(house.filter((tile) => tile.part === 'house')).toHaveLength(9)
    expect(house.filter((tile) => tile.part === 'tree')).toHaveLength(0)
    // おなじ いえを ちいさく しなおす。
    const small = applyTool(house, at(4, 4), 'house', 1)
    expect(small.filter((tile) => tile.part === 'house')).toHaveLength(1)
    expect(small[at(4, 4)]).toEqual({ ground: 'grass', part: 'house' })
    // どの マスを けしても まるごと きえる。
    const erased = applyTool(house, at(5, 5), 'erase')
    expect(erased.every((tile) => tile.part === null)).toBe(true)
    // みちを ひくと たてものは どいて、そこに みちが できる。
    const road = applyTool(house, at(4, 4), 'road')
    expect(road.filter((tile) => tile.part === 'house')).toHaveLength(0)
    expect(road[at(4, 4)].part).toBe('road')
  })

  it('counts more residents in bigger homes, once per building, when a road touches any cell', () => {
    let town = applyTool(createEmptyTown(), at(2, 2), 'house', 2)
    expect(populationOf(town)).toBe(0)
    expect(wantsRoad(town, at(3, 3))).toBe(true)
    town = applyTool(town, at(2, 1), 'road')
    expect(isConnected(town, at(2, 2))).toBe(true)
    expect(residentsAt(town, at(2, 2))).toBe(16)
    expect(residentsAt(town, at(3, 3))).toBe(0)
    expect(populationOf(applyTool(town, at(2, 2), 'house', 3))).toBe(36)
  })
})
