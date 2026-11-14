import { describe, expect, it } from 'vitest'
import { createMapTown, findMap, mapProblems, MAPS, STAMP_LEFT, STAMP_SIZE, STAMP_TOP, type MapId, type StampMap } from './maps'
import { carriesRail, COLS, decodeTown, encodeTown, isConnected, neighborIndex, ROWS, wantsRoad, type Dir, type Town } from './town'
import { isOnTrack, stepVehicles, syncVehicles, vehicleTarget, type Vehicle } from './vehicles'
import { WORLDS } from './worlds'
import { advanceTracks, startTracks, trackPose } from './three/vehicleTracks'

function seeded(seed = 1) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

/** まっさらも せかいも ふくめ、どの ちずも さいしょから でんしゃが はしる。 */
const PRESETS = MAPS.map((map) => [map.id] as const)
const STAMPS = MAPS.filter((map): map is StampMap => map.kind === 'stamp')
/** せかいは たねが ちがっても でんしゃが はしる。 */
const SEEDS = [1, 7, 99, 2026, 123456789]

function railNeighbours(town: Town, index: number): number {
  let count = 0
  for (const dir of [0, 1, 2, 3] as Dir[]) {
    const next = neighborIndex(index, dir)
    if (next !== null && carriesRail(town[next].part)) count += 1
  }
  return count
}

function expectRunningTrains(town: Town, label: string, seed: number) {
  const rails = town.map((tile, index) => ({ tile, index })).filter(({ tile }) => carriesRail(tile.part))
  expect(rails.length, label).toBeGreaterThanOrEqual(12)
  // いきどまりの ない わ（どの せんろも 2ほう いじょうに つながる）。
  expect(rails.filter(({ index }) => railNeighbours(town, index) < 2).map(({ index }) => index), label).toEqual([])
  // えきは せんろの となりに あり、みちにも つながる。
  const stations = town.map((tile, index) => ({ tile, index })).filter(({ tile }) => tile.part === 'station')
  expect(stations.length, label).toBeGreaterThan(0)
  expect(stations.some(({ index }) => railNeighbours(town, index) > 0 && isConnected(town, index)), label).toBe(true)

  expect(vehicleTarget(town, 'train'), label).toBeGreaterThan(0)
  const random = seeded(seed)
  let vehicles: Vehicle[] = syncVehicles(town, [], random)
  const trains = vehicles.filter((vehicle) => vehicle.kind === 'train')
  expect(trains.length, label).toBe(vehicleTarget(town, 'train'))
  const visited = new Map(trains.map((train) => [train.id, new Set([train.index])]))
  for (let step = 0; step < 80; step += 1) {
    const next = stepVehicles(town, vehicles, random)
    for (const vehicle of next) {
      expect(isOnTrack(town, vehicle), label).toBe(true)
      const before = vehicles.find((item) => item.id === vehicle.id)
      // でんしゃは わを まわり つづけ、ひきかえさない。
      if (vehicle.kind === 'train' && before) expect(vehicle.dir, label).not.toBe((before.dir + 2) % 4)
      visited.get(vehicle.id)?.add(vehicle.index)
    }
    vehicles = next
  }
  for (const cells of visited.values()) expect(cells.size, label).toBeGreaterThanOrEqual(12)
}

describe('maps', () => {
  it('lists every hand-made map and every world once, with unique names and icons, and ends with a blank map', () => {
    expect(new Set(MAPS.map((map) => map.id)).size).toBe(MAPS.length)
    expect(new Set(MAPS.map((map) => map.name)).size).toBe(MAPS.length)
    expect(new Set(MAPS.map((map) => map.emoji)).size).toBe(MAPS.length)
    expect(STAMPS.filter((map) => map.id !== 'empty').length).toBeGreaterThanOrEqual(5)
    for (const world of WORLDS) expect(findMap(`world-${world.id}`)?.name).toBe(world.label)
    for (const id of ['starter', 'seaside', 'island', 'lake', 'city', 'amusement', 'empty']) expect(findMap(id)?.kind, id).toBe('stamp')
    expect(MAPS.at(-1)?.id).toBe('empty')
    // まっさらは せんろの わと えき（と えきの みち）の ほかは なにも ない。
    const empty = createMapTown('empty')
    expect(empty.every((tile) => tile.ground === 'grass')).toBe(true)
    expect(new Set(empty.map((tile) => tile.part))).toEqual(new Set([null, 'rail', 'station', 'road']))
    expect(empty.filter((tile) => tile.part === null).length).toBeGreaterThan(COLS * ROWS * 0.95)
  })

  it.each(PRESETS)('%s fills the wide map with a valid town that saves and loads unchanged', (id) => {
    const town = createMapTown(id)
    expect(town).toHaveLength(COLS * ROWS)
    expect(decodeTown(encodeTown(town))).toEqual(town)
    // みちの ほしい たてものは みんな みちに つながって いる（てがきの ちず）。
    const map = findMap(id)!
    if (map.kind !== 'stamp') return
    expect(mapProblems(map)).toEqual([])
    const unconnected = town.map((tile, index) => ({ tile, index })).filter(({ index }) => wantsRoad(town, index))
    expect(unconnected.map(({ tile, index }) => `${tile.part}@${index % COLS}-${Math.floor(index / COLS)}`)).toEqual([])
    // てがきの ちずは まんなかに おき、おおきな たてもの（big）も ぜんぶ おかれて いる。
    const cell = (col: number, row: number) => town[(STAMP_TOP + row) * COLS + STAMP_LEFT + col]
    for (const [col, row, part] of map.big ?? []) expect(cell(col, row).part).toBe(part)
    expect(STAMP_LEFT + STAMP_SIZE <= COLS && STAMP_TOP + STAMP_SIZE <= ROWS).toBe(true)
  })

  it('lets rivers, seas and roads at the edge of a hand-made map run on to the edge of the wide map', () => {
    const island = createMapTown('island')
    // うみに かこまれた しまは、まわりも うみ。ながい はしは ちずの はしまで つづく。
    expect(island.filter((tile) => tile.ground === 'water').length).toBeGreaterThan(COLS * ROWS * 0.8)
    const bridgeRow = STAMP_TOP + 7
    expect(island[bridgeRow * COLS + COLS - 1]).toEqual({ ground: 'water', part: 'road' })
    const starter = createMapTown('starter')
    // かわは きたと みなみの はしまで ながれる。
    expect(starter[STAMP_LEFT + 9].ground).toBe('water')
    expect(starter[(ROWS - 1) * COLS + STAMP_LEFT + 9].ground).toBe('water')
    const seaside = createMapTown('seaside')
    expect(seaside[(ROWS - 1) * COLS].ground).toBe('water')
    expect(seaside[(STAMP_TOP + 9) * COLS].ground).toBe('sand')
  })

  it.each(PRESETS)('%s has a closed railway loop with a station, and trains run from the start', (id) => {
    expectRunningTrains(createMapTown(id), id, id.length * 7 + 3)
  })

  it.each(WORLDS.map((world) => [`world-${world.id}` as MapId] as const))('%s keeps its railway loop whatever shape the world takes', (id) => {
    for (const seed of SEEDS) expectRunningTrains(createMapTown(id, seed), `${id} ${seed}`, seed)
  })

  it.each(PRESETS)('%s sends trains along the 3D track too', (id) => {
    const town = createMapTown(id)
    const random = seeded(5)
    let tracks = startTracks(town, random)
    const trains = tracks.filter((track) => track.lead.kind === 'train')
    expect(trains.length).toBeGreaterThan(0)
    const start = trains.map((track) => trackPose(track, 0))
    for (let step = 0; step < 6; step += 1) tracks = advanceTracks(town, tracks, random)
    const moved = tracks.filter((track) => track.lead.kind === 'train').map((track, index) => {
      const pose = trackPose(track, 0)
      return Math.hypot(pose.x - start[index].x, pose.z - start[index].z)
    })
    expect(moved.every((distance) => distance > 1)).toBe(true)
  })
})
