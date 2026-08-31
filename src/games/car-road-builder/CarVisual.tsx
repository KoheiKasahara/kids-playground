import styles from './CarRoadBuilder.module.css'
import { getVehicleDefinition, type VehicleId } from './vehicleDefinitions'

type CarVisualProps = Readonly<{
  vehicleId?: VehicleId
  className?: string
}>

export default function CarVisual({ vehicleId = 'red-car', className }: CarVisualProps) {
  const vehicle = getVehicleDefinition(vehicleId)
  const bodyClassName = styles[vehicle.bodyClassName]

  return (
    <svg
      className={`${styles.carSvg} ${className ?? ''}`.trim()}
      data-testid="car-visual"
      data-vehicle-id={vehicle.id}
      data-front-direction="E"
      viewBox="-20 -13 40 26"
      aria-hidden="true"
    >
      <path className={styles.carShadow} d="M-14-9 Q-18 0-14 9 Q-11 12-5 12 H9 Q15 12 18 5 L20 0 18-5 Q15-12 9-12 H-5 Q-11-12-14-9Z" />
      {vehicle.id === 'bus' ? (
        <path className={`${styles.carBody} ${bodyClassName}`} d="M-15-9 Q-12-11-8-11 H9 Q15-11 17-6 L19 0 17 6 Q15 11 9 11 H-8 Q-12 11-15 9 Q-17 0-15-9Z" />
      ) : vehicle.id === 'truck' ? (
        <>
          <path className={`${styles.carBody} ${bodyClassName}`} d="M-15-8 Q-12-10-8-10 H3 V10 H-8 Q-12 10-15 8 Q-18 0-15-8Z" />
          <path className={styles.truckCargo} d="M3-9 H10 Q14-9 16-5 L19 0 16 5 Q14 9 10 9 H3Z" />
        </>
      ) : (
        <path className={`${styles.carBody} ${bodyClassName}`} d="M-15-8 Q-12-10-8-10 H8 Q14-10 16-5 L19 0 16 5 Q14 10 8 10 H-8 Q-12 10-15 8 Q-18 0-15-8Z" />
      )}
      {vehicle.id === 'bus' ? (
        <>
          <path className={styles.busWindow} d="M-10-7 H-4 V7 H-10 Q-12 0-10-7Z" />
          <path className={styles.busWindow} d="M-2-7 H4 V7 H-2Z" />
          <path className={styles.busFrontWindow} d="M6-7 H9 Q11-7 13-4 L15 0 13 4 Q11 7 9 7 H6Z" />
        </>
      ) : vehicle.id === 'truck' ? (
        <>
          <path className={styles.carRearWindow} d="M-10-6 H-3 V6 H-10 Q-12 0-10-6Z" />
          <path className={styles.carFrontWindshield} d="M-1-6 H2 V6 H-1Z" />
          <path className={styles.truckCargoDetail} d="M5-6 H10 Q12-6 14-3 L16 0 14 3 Q12 6 10 6 H5Z" />
        </>
      ) : (
        <>
          <path className={styles.carRearWindow} d="M-9-6 H-2 V6 H-9 Q-11 0-9-6Z" />
          <path className={styles.carFrontWindshield} d="M1-6 H7 Q10-6 12-3 L14 0 12 3 Q10 6 7 6 H1Z" />
        </>
      )}
      {vehicle.id !== 'bus' && <path className={styles.carCenterLine} d="M-1-6 V6" />}
      <rect className={styles.carWheel} x="-7" y="-11.5" width="5" height="3" rx="1.5" />
      <rect className={styles.carWheel} x="7" y="-11.5" width="5" height="3" rx="1.5" />
      <rect className={styles.carWheel} x="-7" y="8.5" width="5" height="3" rx="1.5" />
      <rect className={styles.carWheel} x="7" y="8.5" width="5" height="3" rx="1.5" />
      <circle className={styles.carHeadlight} cx="16" cy="-3.3" r="1.25" />
      <circle className={styles.carHeadlight} cx="16" cy="3.3" r="1.25" />
      <rect className={styles.carTailLight} x="-15.5" y="-4" width="1.7" height="2.6" rx=".7" />
      <rect className={styles.carTailLight} x="-15.5" y="1.4" width="1.7" height="2.6" rx=".7" />
    </svg>
  )
}
