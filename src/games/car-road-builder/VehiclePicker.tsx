import type { VehicleId } from './vehicleDefinitions'
import { VEHICLE_DEFINITIONS } from './vehicleDefinitions'
import CarVisual from './CarVisual'
import styles from './CarRoadBuilder.module.css'

type VehiclePickerProps = Readonly<{
  selectedVehicleId: VehicleId
  disabled?: boolean
  onSelect: (vehicleId: VehicleId) => void
}>

export default function VehiclePicker({ selectedVehicleId, disabled = false, onSelect }: VehiclePickerProps) {
  return (
    <section className={styles.vehiclePicker} aria-label="くるまを えらぶ">
      <p className={styles.vehiclePickerTitle}>くるまを えらんでね</p>
      <div className={styles.vehicleOptions} role="group" aria-label="くるま選択">
        {VEHICLE_DEFINITIONS.map((vehicle) => (
          <button
            key={vehicle.id}
            type="button"
            className={`${styles.vehicleOption} ${selectedVehicleId === vehicle.id ? styles.vehicleOptionSelected : ''}`}
            aria-label={vehicle.label}
            aria-pressed={selectedVehicleId === vehicle.id}
            data-vehicle-id={vehicle.id}
            disabled={disabled}
            onClick={() => onSelect(vehicle.id)}
          >
            <span className={styles.vehiclePreview} aria-hidden="true">
              <CarVisual vehicleId={vehicle.id} />
            </span>
            <span className={styles.vehicleOptionLabel}>{vehicle.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
