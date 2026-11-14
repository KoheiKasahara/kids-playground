import { describe, expect, it } from 'vitest'
import { createMapTown, findMap, mapProblems, MAPS } from './maps'
import { carriesRail, COLS, decodeTown, encodeTown, neighborIndex, ROWS, wantsRoad, type Dir, type Town } from './town'
import { isOnTrack, stepVehicles, syncVehicles, vehicleTarget, type Vehicle } from './vehicles'
import { advanceTracks, startTracks, trackPose } from './three/vehicleTracks'

function seeded(seed = 1) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

/** まっさらも ふくめ、どの ちずも さいしょから でんしゃが はしる。 */
const PRESETS = MAPS

function railNeighbours(town: Town, index: number): number {
  let count = 0
  for (const dir of [0, 1, 2, 3] as Dir[]) {
    const next = neighborIndex(index, dir)
    if (next !== null && carriesRail(town[next].part)) count += 1
  }
  return count
}

describe('maps', () => {
  it('has unique ids and names, a blank map, and several themed maps', () => {
    expect(new Set(MAPS.map((map) => map.id)).size).toBe(MAPS.length)
    expect(new Set(MAPS.map((map) => map.name)).size).toBe(MAPS.length)
    expect(MAPS.filter((map) => map.id !== 'empty').length).toBeGreaterThanOrEqual(5)
    // まっさらは せんろの わと えき（と えきの みち）の ほかは なにも ない。
    const empty = createMapTown('empty')
    expect(empty.every((tile) => tile.ground === 'grass')).toBe(true)
    expect(new Set(empty.map((tile) => tile.part))).toEqual(new Set([null, 'rail', 'station', 'road']))
    expect(empty.filter((tile) => tile.part === null).length).toBeGreaterThan(COLS * ROWS * 0.9)
  })

  it.each(PRESETS.map((map) => [map.id]))('%s is a valid 14×14 town that saves and loads unchanged', (id) => {
    const map = findMap(id)!
    expect(mapProblems(map)).toEqual([])
    const town = createMapTown(map.id)
    expect(town).toHaveLength(COLS * ROWS)
    expect(decodeTown(encodeTown(town))).toEqual(town)
    // おおきな たてもの（big）は ぜんぶ おかれて いる。
    for (const [col, row, part] of map.big ?? []) expect(town[row * COLS + col].part).toBe(part)
    // みちの ほしい たてものは みんな みちに つながって いる。
    const unconnected = town.map((tile, index) => ({ tile, index })).filter(({ index }) => wantsRoad(town, index))
    expect(unconnected.map(({ tile, index }) => `${tile.part}@${index % COLS}-${Math.floor(index / COLS)}`)).toEqual([])
  })

  it.each(PRESETS.map((map) => [map.id]))('%s has a closed railway loop with a station, and trains run from the start', (id) => {
    const town = createMapTown(findMap(id)!.id)
    const rails = town.map((tile, index) => ({ tile, index })).filter(({ tile }) => carriesRail(tile.part))
    expect(rails.length).toBeGreaterThanOrEqual(12)
    // いきどまりの ない わ（どの せんろも 2ほう いじょうに つながる）。
    expect(rails.filter(({ index }) => railNeighbours(town, index) < 2).map(({ index }) => index)).toEqual([])
    // えきは せんろの となりに ある。
    const stations = town.map((tile, index) => ({ tile, index })).filter(({ tile }) => tile.part === 'station')
    expect(stations.length).toBeGreaterThan(0)
    expect(stations.some(({ index }) => railNeighbours(town, index) > 0)).toBe(true)

    expect(vehicleTarget(town, 'train')).toBeGreaterThan(0)
    const random = seeded(id.length * 7 + 3)
    let vehicles: Vehicle[] = syncVehicles(town, [], random)
    const trains = vehicles.filter((vehicle) => vehicle.kind === 'train')
    expect(trains.length).toBe(vehicleTarget(town, 'train'))
    const visited = new Map(trains.map((train) => [train.id, new Set([train.index])]))
    for (let step = 0; step < 80; step += 1) {
      const next = stepVehicles(town, vehicles, random)
      for (const vehicle of next) {
        expect(isOnTrack(town, vehicle)).toBe(true)
        const before = vehicles.find((item) => item.id === vehicle.id)
        // でんしゃは わを まわり つづけ、ひきかえさない。
        if (vehicle.kind === 'train' && before) expect(vehicle.dir).not.toBe((before.dir + 2) % 4)
        visited.get(vehicle.id)?.add(vehicle.index)
      }
      vehicles = next
    }
    for (const cells of visited.values()) expect(cells.size).toBeGreaterThanOrEqual(Math.min(12, rails.length))
  })

  it.each(PRESETS.map((map) => [map.id]))('%s sends trains along the 3D track too', (id) => {
    const town = createMapTown(findMap(id)!.id)
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

