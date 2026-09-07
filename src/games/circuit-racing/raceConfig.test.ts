import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CAR_VEHICLES } from '../car-builder/carVehicles'
import { DEFAULT_SELECTIONS, RACE_CARS, RACE_COLORS } from './raceConfig'

describe('raceConfig', () => {
  it('reuses exactly the three raceable car ids', () => {
    expect(RACE_CARS.map((car) => car.id)).toEqual(['sportsCar', 'car', 'suv'])
    expect(new Set(RACE_CARS.map((car) => car.id)).size).toBe(RACE_CARS.length)
  })

  it('keeps tuning values positive and in the expected speed range', () => {
    for (const car of RACE_CARS) {
      expect(car.maxSpeed).toBeGreaterThanOrEqual(38)
      expect(car.maxSpeed).toBeLessThanOrEqual(50)
      expect(car.acceleration).toBeGreaterThan(0)
      expect(car.braking).toBeGreaterThan(0)
      expect(car.cornering).toBeGreaterThan(0)
      expect(car.description.length).toBeGreaterThan(0)
    }
  })

  it('provides two distinct, valid defaults and paint choices', () => {
    expect(DEFAULT_SELECTIONS).toHaveLength(2)
    expect(DEFAULT_SELECTIONS[0].carId).not.toBe(DEFAULT_SELECTIONS[1].carId)
    for (const selection of DEFAULT_SELECTIONS) {
      expect(RACE_CARS.some((car) => car.id === selection.carId)).toBe(true)
      expect(RACE_COLORS.some((color) => color.value === selection.color)).toBe(true)
    }
  })

  it('points each reusable race car at an existing CC0 model', () => {
    for (const car of RACE_CARS) {
      expect(existsSync(resolve('public', 'models', 'car-builder', CAR_VEHICLES[car.id].modelFile))).toBe(true)
    }
  })
})
