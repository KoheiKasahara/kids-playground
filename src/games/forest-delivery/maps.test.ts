import { describe, expect, test } from 'vitest'
import { COLUMNS, MAPS, ROWS, bridgeCells, isWater, tileAt } from './maps'
import { createWorld, getObjective, getPois, isWalkableCell, STAGES, targetPoi, TILE_SIZE, type PoiId, type World } from './model'

const cell = ([x, y]: readonly [number, number]) => ({ column: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) })

/** Cells reachable on foot from where the courier starts. */
function reachable(world: World): Set<string> {
  const start = { column: Math.floor(world.player.x / TILE_SIZE), row: Math.floor(world.player.y / TILE_SIZE) }
  const seen = new Set([`${start.column},${start.row}`])
  const queue = [start]
  while (queue.length) {
    const { column, row } = queue.shift()!
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { column: column + dx, row: row + dy }
      const key = `${next.column},${next.row}`
      if (!seen.has(key) && isWalkableCell(world, next.column, next.row)) {
        seen.add(key)
        queue.push(next)
      }
    }
  }
  return seen
}

function standingCell(world: World, id: PoiId) {
  const poi = getPois(world).find((point) => point.id === id)!
  return cell([poi.x, poi.y + (poi.kind === 'animal' ? TILE_SIZE : 0)])
}

describe('もりの ちず', () => {
  test('どの村も同じ大きさの格子で、使う記号は決まったものだけ', () => {
    expect(MAPS).toHaveLength(STAGES.length)
    for (const map of MAPS) {
      expect(map.tiles).toHaveLength(ROWS)
      for (const line of map.tiles) expect(line).toMatch(new RegExp(`^[.:~=#TPbr]{${COLUMNS}}$`))
    }
  })

  test.each(STAGES.map((stage, index) => [stage.name, index] as const))('%s は橋をなおすまで川の向こうへ行けず、なおすと全部の場所へ行ける', (_, index) => {
    const world = createWorld(index)
    const before = reachable(world)
    const key = (id: PoiId) => { const { column, row } = standingCell(world, id); return `${column},${row}` }
    // Everything needed to mend the bridge is on the starting bank.
    for (const id of ['post', 'wood', 'bridge'] as const) expect(before.has(key(id))).toBe(true)
    for (const id of ['squirrel', 'rabbit', 'bear'] as const) expect(before.has(key(id))).toBe(false)
    world.flags.bridgeRepaired = true
    const after = reachable(world)
    for (const poi of getPois(world)) expect(after.has(key(poi.id))).toBe(true)
  })

  test.each(MAPS.map((map, index) => [index, map] as const))('村 %i の橋はひとつながりで、両側が水にはさまれている', (_, map) => {
    const cells = bridgeCells(map)
    expect(cells.length).toBeGreaterThanOrEqual(2)
    const columns = new Set(cells.map(({ column }) => column))
    const rows = new Set(cells.map(({ row }) => row))
    // A straight span: either one row (across a north-south river) or one column.
    expect(columns.size === 1 || rows.size === 1).toBe(true)
    for (const { column, row } of cells) {
      const sides = columns.size === 1 ? [[column - 1, row], [column + 1, row]] : [[column, row - 1], [column, row + 1]]
      for (const [c, r] of sides) expect(tileAt(map, c, r)).toBe('~')
    }
  })

  test.each(MAPS.map((map, index) => [index, map] as const))('村 %i の飾りは水と道をふさがない場所にある', (index, map) => {
    const world = createWorld(index)
    for (const point of [...map.sunflowers, ...map.lanterns, ...map.melons, ...map.glowcaps]) {
      const { column, row } = cell(point)
      expect(tileAt(map, column, row), `${point}`).toBe('.')
    }
    for (const point of [...map.lilies, ...(map.moon ? [map.moon] : [])]) {
      const { column, row } = cell(point)
      expect(isWater(map, column, row), `${point}`).toBe(true)
    }
    if (map.ducks) {
      const [x0, x1, y] = map.ducks
      for (let x = x0; x <= x1; x += 4) expect(isWater(map, Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE))).toBe(true)
    }
    // Buildings and trees never stand in the water.
    for (const poi of getPois(world)) {
      const { column, row } = cell([poi.x, poi.y])
      for (let r = row - 3; r <= row; r++) for (let c = column - 1; c <= column + 1; c++) {
        if (poi.kind === 'post' || poi.kind === 'animal') expect(isWater(map, c, r), `${poi.id} ${c},${r}`).toBe(false)
      }
    }
  })

  test('2つめ以降の村は、はじめの村と川の流れる向きや形がちがう', () => {
    const shape = (index: number) => {
      const map = MAPS[index]
      const cells = bridgeCells(map)
      return { across: new Set(cells.map(({ row }) => row)).size === 1, water: map.tiles.join('').split('').filter((tile) => tile === '~').length }
    }
    // The summer river runs east-west, so its bridge runs north-south.
    expect(shape(0).across).toBe(true)
    expect(shape(1).across).toBe(false)
    // The night village widens its stream into a pond.
    expect(shape(2).water).toBeGreaterThan(shape(0).water)
    const pondRows = MAPS[2].tiles.filter((line) => (line.match(/~/g) ?? []).length >= 5)
    expect(pondRows.length).toBeGreaterThanOrEqual(3)
  })

  test('川向こうに実がなる村でも、案内は先に橋へ向かわせる', () => {
    const world = createWorld(2)
    // Pretend the courier already has everything but the apple, which grows across the water.
    world.delivered.push('squirrel', 'rabbit')
    expect(getObjective(world).targetId).toBe('wood')
    expect(targetPoi(world, 'apple')).toBe(false)
    expect(world.message).toContain('はし')
  })
})
