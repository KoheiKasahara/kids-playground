export type VehicleId = 'red-car' | 'blue-car' | 'bus' | 'truck'

export type VehicleDefinition = Readonly<{
  id: VehicleId
  label: string
  bodyClassName: string
}>

export const VEHICLE_DEFINITIONS: ReadonlyArray<VehicleDefinition> = [
  { id: 'red-car', label: 'あかい くるま', bodyClassName: 'carBodyRed' },
  { id: 'blue-car', label: 'あおい くるま', bodyClassName: 'carBodyBlue' },
  { id: 'bus', label: 'バス', bodyClassName: 'carBodyBus' },
  { id: 'truck', label: 'トラック', bodyClassName: 'carBodyTruck' },
]

export function getVehicleDefinition(id: VehicleId): VehicleDefinition {
  return VEHICLE_DEFINITIONS.find((vehicle) => vehicle.id === id) ?? VEHICLE_DEFINITIONS[0]
}
