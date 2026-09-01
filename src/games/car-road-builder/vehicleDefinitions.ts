export type VehicleId = 'car' | 'police-car' | 'bus' | 'bulldozer'

export type VehicleDefinition = Readonly<{
  id: VehicleId
  label: string
  bodyClassName: string
  /** Board-only wrapper size; route coordinates remain unchanged. */
  displayClassName: string
}>

export const VEHICLE_DEFINITIONS: ReadonlyArray<VehicleDefinition> = [
  {
    id: 'car',
    label: 'くるま',
    bodyClassName: 'carBodyCar',
    displayClassName: 'carDisplayStandard',
  },
  {
    id: 'police-car',
    label: 'パトカー',
    bodyClassName: 'carBodyPolice',
    displayClassName: 'carDisplayPolice',
  },
  {
    id: 'bus',
    label: 'バス',
    bodyClassName: 'carBodyBus',
    displayClassName: 'carDisplayBus',
  },
  {
    id: 'bulldozer',
    label: 'ブルドーザー',
    bodyClassName: 'carBodyBulldozer',
    displayClassName: 'carDisplayBulldozer',
  },
]

export function getVehicleDefinition(id: VehicleId): VehicleDefinition {
  return VEHICLE_DEFINITIONS.find((vehicle) => vehicle.id === id) ?? VEHICLE_DEFINITIONS[0]
}
