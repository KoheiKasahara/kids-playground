import { describe, expect, test } from 'vitest'
import { getVehicleDefinition, VEHICLE_DEFINITIONS } from './vehicleDefinitions'

describe('car road vehicles', () => {
  test('provides four visually distinct vehicle choices', () => {
    expect(VEHICLE_DEFINITIONS.map((vehicle) => vehicle.id)).toEqual(['red-car', 'blue-car', 'bus', 'truck'])
    expect(new Set(VEHICLE_DEFINITIONS.map((vehicle) => vehicle.label)).size).toBe(4)
  })

  test('falls back to the default red car for an unknown runtime id', () => {
    expect(getVehicleDefinition('red-car').id).toBe('red-car')
    expect(getVehicleDefinition('not-a-vehicle' as never).id).toBe('red-car')
  })
})
