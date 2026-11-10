import { describe, expect, it } from 'vitest'
import { CATEGORIES, PARTS, partsInCategory } from './parts'
import {
  applyTool, CENTER_INDEX, COLS, createEmptyTown, decodeTown, encodeTown, isConnected, populationOf, railMask,
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
    expect(createEmptyTown()).toHaveLength(COLS * ROWS)
    expect(empty.every((tile) => tile.ground === 'grass' && tile.part === null)).toBe(true)
    expect(CENTER_INDEX).toBe(Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2))
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

  it('lays sand and snow under whatever stands there, and builds on them without changing the ground', () => {
    const beach = build([[0, 'house'], [0, 'sand'], [1, 'sand'], [1, 'palm'], [2, 'road'], [2, 'snow'], [3, 'snow'], [3, 'igloo']])
    expect(beach.slice(0, 4)).toEqual([
      { ground: 'sand', part: 'house' }, { ground: 'sand', part: 'palm' }, { ground: 'snow', part: 'road' }, { ground: 'snow', part: 'igloo' },
    ])
    expect(applyTool(beach, 1, 'sand')).toBe(beach)
    expect(applyTool(beach, 1, 'palm')).toBe(beach)
    // すなに みずを ひくと、たてものは なくなり みちは はしに なる。
    expect(build([[0, 'water'], [2, 'water']], beach).slice(0, 3)).toEqual([
      { ground: 'water', part: null }, { ground: 'sand', part: 'palm' }, { ground: 'water', part: 'road' },
    ])
    // けすと まず のって いる もの、つぎに じめんが くさはらに もどる。
    const cleared = build([[1, 'erase'], [1, 'erase']], beach)
    expect(cleared[1]).toEqual({ ground: 'grass', part: null })
    expect(populationOf(build([[4, 'road']], beach))).toBe(2)
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
  it('round-trips every kind of tile in a compact form', () => {
    const town = build([
      [0, 'water'], [0, 'road'], [1, 'rail'], [1, 'road'], [2, 'ferris'], [3, 'water'], [4, 'tv-tower'], [5, 'sand'], [5, 'pyramid'],
      [6, 'snow'], [7, 'snow'], [7, 'snowman'], [COLS * ROWS - 1, 'lighthouse'],
    ])
    const raw = encodeTown(town)
    expect(decodeTown(raw)).toEqual(town)
    // なにも ない ところは まとめて ほぞん する。
    expect(raw.length).toBeLessThan(400)
    expect(decodeTown(encodeTown(createEmptyTown()))).toEqual(createEmptyTown())
  })

  it('keeps a town saved on the old small map, placed in the middle of the wide one', () => {
    const old = Array.from({ length: 14 * 14 }, () => 'g')
    old[0] = 'g:castle'
    old[1] = 'w:road'
    old[14 * 14 - 1] = 'g:house'
    const town = decodeTown(JSON.stringify({ version: 1, cols: 14, rows: 14, tiles: old }))
    const corner = at((COLS - 14) / 2, (ROWS - 14) / 2)
    expect(town).toHaveLength(COLS * ROWS)
    expect(town?.[corner]).toEqual({ ground: 'grass', part: 'castle' })
    expect(town?.[corner + 1]).toEqual({ ground: 'water', part: 'road' })
    expect(town?.[at((COLS - 14) / 2 + 13, (ROWS - 14) / 2 + 13)]).toEqual({ ground: 'grass', part: 'house' })
    expect(town?.filter((tile) => tile.part !== null)).toHaveLength(3)
  })

  it('rejects missing, broken, oversized or impossible saves', () => {
    const save = (patch: object) => JSON.stringify({ version: 2, cols: COLS, rows: ROWS, tiles: [`g*${COLS * ROWS}`], ...patch })
    const first = (tile: string) => save({ tiles: [tile, `g*${COLS * ROWS - 1}`] })
    expect(decodeTown(null)).toBeNull()
    expect(decodeTown('{broken')).toBeNull()
    expect(decodeTown('42')).toBeNull()
    expect(decodeTown(save({ version: 3 }))).toBeNull()
    expect(decodeTown(save({ cols: COLS + 1 }))).toBeNull()
    expect(decodeTown(save({ cols: 12 }))).toBeNull()
    expect(decodeTown(save({ rows: 0 }))).toBeNull()
    expect(decodeTown(save({ rows: 1.5 }))).toBeNull()
    expect(decodeTown(save({ tiles: 'g' }))).toBeNull()
    expect(decodeTown(save({ tiles: [`g*${COLS * ROWS - 1}`] }))).toBeNull()
    expect(decodeTown(save({ tiles: [`g*${COLS * ROWS + 1}`] }))).toBeNull()
    expect(decodeTown(save({ tiles: ['g*0', `g*${COLS * ROWS}`] }))).toBeNull()
    expect(decodeTown(save({ tiles: ['g*2*3', `g*${COLS * ROWS - 2}`] }))).toBeNull()
    // まえの かたちでは「*かず」を つかえない。
    expect(decodeTown(save({ version: 1 }))).toBeNull()
    expect(decodeTown(first('g:spaceship'))).toBeNull()
    expect(decodeTown(first('g:water'))).toBeNull()
    expect(decodeTown(first('g:sand'))).toBeNull()
    expect(decodeTown(first('w:house'))).toBeNull()
    expect(decodeTown(first('x'))).toBeNull()
    expect(decodeTown(first('g:road:x'))).toBeNull()
    expect(decodeTown(save({ tiles: [7, `g*${COLS * ROWS - 1}`] }))).toBeNull()
    expect(decodeTown(save({}))).toEqual(createEmptyTown())
    expect(decodeTown(first('s:cactus'))?.[0]).toEqual({ ground: 'sand', part: 'cactus' })
  })
})
