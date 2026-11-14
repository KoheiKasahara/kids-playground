import { describe, expect, it } from 'vitest'
import { createTown } from './maps'
import { applyTool, carriesRail, carriesRoad, COLS, createEmptyTown, neighborIndex, type Dir, type Town } from './town'
import { isOnTrack, stepVehicle, stepVehicles, syncVehicles, vehiclePose, vehicleTarget, type Vehicle } from './vehicles'

const at = (col: number, row: number) => row * COLS + col

function seeded(seed = 1) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function line(tool: 'road' | 'rail', row: number, from: number, to: number, town: Town = createEmptyTown()): Town {
  let result = town
  for (let col = from; col <= to; col += 1) result = applyTool(result, at(col, row), tool)
  return result
}

describe('vehicles', () => {
  it('sends more cars and trains as the network grows', () => {
    expect(vehicleTarget(createEmptyTown(), 'car')).toBe(0)
    expect(vehicleTarget(line('road', 0, 0, 0), 'car')).toBe(0)
    expect(vehicleTarget(line('road', 0, 0, 1), 'car')).toBe(1)
    expect(vehicleTarget(line('road', 0, 0, 8), 'car')).toBe(3)
    expect(vehicleTarget(line('rail', 0, 0, 1), 'train')).toBe(0)
    expect(vehicleTarget(line('rail', 0, 0, 2), 'train')).toBe(1)
    let big = createEmptyTown()
    for (let row = 0; row < 12; row += 1) big = line('road', row, 0, COLS - 1, big)
    expect(vehicleTarget(big, 'car')).toBe(10)
  })

  it('spawns only on connected track, drops vehicles whose track was erased and keeps ids unique', () => {
    const random = seeded(3)
    const town = line('rail', 4, 0, 5, line('road', 1, 0, 7))
    const vehicles = syncVehicles(town, [], random)
    expect(vehicles.filter((vehicle) => vehicle.kind === 'car')).toHaveLength(2)
    expect(vehicles.filter((vehicle) => vehicle.kind === 'train')).toHaveLength(1)
    for (const vehicle of vehicles) {
      expect(isOnTrack(town, vehicle)).toBe(true)
      expect((vehicle.kind === 'car' ? carriesRoad : carriesRail)(town[neighborIndex(vehicle.index, vehicle.dir)!].part)).toBe(true)
    }
    expect(new Set(vehicles.map((vehicle) => vehicle.id)).size).toBe(vehicles.length)

    const train = vehicles.find((vehicle) => vehicle.kind === 'train')!
    const withoutRail = applyTool(town, train.index, 'erase')
    const next = syncVehicles(withoutRail, vehicles, random)
    expect(next.some((vehicle) => vehicle.id === train.id)).toBe(false)
    expect(next.every((vehicle) => isOnTrack(withoutRail, vehicle))).toBe(true)
    expect(syncVehicles(createEmptyTown(), vehicles, random)).toEqual([])
  })

  it('drives forward along the road, turning corners and reversing only at dead ends', () => {
    const random = seeded(7)
    // └ のかたち：よこに すすみ、かどで まがる。
    let town = line('road', 5, 2, 6)
    town = applyTool(town, at(6, 4), 'road')
    let car: Vehicle = { id: 1, kind: 'car', index: at(2, 5), dir: 1, variant: 0 }
    const visited = [car.index]
    for (let step = 0; step < 5; step += 1) {
      car = stepVehicle(town, car, random)
      visited.push(car.index)
    }
    expect(visited).toEqual([at(2, 5), at(3, 5), at(4, 5), at(5, 5), at(6, 5), at(6, 4)])
    expect(car.dir).toBe(0)
    // いきどまりでは ひきかえす。
    car = stepVehicle(town, car, random)
    expect(car.index).toBe(at(6, 5))
    expect(car.dir).toBe(2 as Dir)
    // ひとつだけの みちでは うごかない。
    const alone = applyTool(createEmptyTown(), 0, 'road')
    const parked: Vehicle = { id: 2, kind: 'car', index: 0, dir: 1, variant: 0 }
    expect(stepVehicle(alone, parked, random)).toBe(parked)
  })

  it('keeps every vehicle on the network over many steps in the starter town', () => {
    const random = seeded(11)
    let town = createTown()
    town = line('rail', 2, 2, 8, town)
    let vehicles = syncVehicles(town, [], random)
    for (let step = 0; step < 60; step += 1) {
      vehicles = stepVehicles(town, vehicles, random)
      expect(vehicles.every((vehicle) => isOnTrack(town, vehicle))).toBe(true)
    }
  })

  it('draws cars on the left lane of their direction and trains in the middle', () => {
    const north = vehiclePose({ id: 1, kind: 'car', index: at(3, 3), dir: 0, variant: 0 })
    expect(north.x).toBeLessThan(3.5)
    expect(north.y).toBeCloseTo(3.5)
    expect(north.angle).toBe(0)
    const east = vehiclePose({ id: 1, kind: 'car', index: at(3, 3), dir: 1, variant: 0 })
    expect(east.y).toBeLessThan(3.5)
    expect(east.angle).toBe(90)
    expect(vehiclePose({ id: 1, kind: 'train', index: at(3, 3), dir: 2, variant: 0 })).toEqual({ x: 3.5, y: 3.5, angle: 180 })
  })
})
