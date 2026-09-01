import { describe, expect, test } from 'vitest'
import { getVehicleDefinition, VEHICLE_DEFINITIONS } from './vehicleDefinitions'

describe('car road vehicles', () => {
  test('provides the four requested vehicle choices with distinct visual variants', () => {
    expect(VEHICLE_DEFINITIONS.map((vehicle) => vehicle.id)).toEqual(['car', 'police-car', 'bus', 'bulldozer'])
    expect(VEHICLE_DEFINITIONS.map((vehicle) => vehicle.label)).toEqual(['くるま', 'パトカー', 'バス', 'ブルドーザー'])
    expect(new Set(VEHICLE_DEFINITIONS.map((vehicle) => vehicle.bodyClassName)).size).toBe(4)
    expect(new Set(VEHICLE_DEFINITIONS.map((vehicle) => vehicle.displayClassName)).size).toBe(4)
  })

  test('falls back to the default car for an unknown runtime id', () => {
    expect(getVehicleDefinition('car').id).toBe('car')
    expect(getVehicleDefinition('not-a-vehicle' as never).id).toBe('car')
  })

  test('uses a longer board display variant only for the bus', () => {
    expect(getVehicleDefinition('bus').displayClassName).toBe('carDisplayBus')
    expect(getVehicleDefinition('car').displayClassName).toBe('carDisplayStandard')
  })
})
