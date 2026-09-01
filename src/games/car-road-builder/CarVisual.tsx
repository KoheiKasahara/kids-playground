import styles from './CarRoadBuilder.module.css'
import { getVehicleDefinition, type VehicleId } from './vehicleDefinitions'

type CarVisualProps = Readonly<{
  vehicleId?: VehicleId
  className?: string
}>

export default function CarVisual({ vehicleId = 'car', className }: CarVisualProps) {
  const vehicle = getVehicleDefinition(vehicleId)
  const bodyClassName = styles[vehicle.bodyClassName]

  return (
    <svg
      className={`${styles.carSvg} ${className ?? ''}`.trim()}
      data-testid="car-visual"
      data-vehicle-id={vehicle.id}
      data-front-direction="E"
      data-front-feature={vehicle.id === 'police-car' ? 'siren-bar' : vehicle.id === 'bus' ? 'long-body' : vehicle.id === 'bulldozer' ? 'blade' : 'rounded-body'}
      viewBox="-22 -14 44 28"
      aria-hidden="true"
    >
      {vehicle.id === 'car' && (
        <>
          <path className={styles.carShadow} d="M-12-8 Q-15-5-15 0 Q-15 5-12 8 Q-9 10-5 10 H8 Q13 10 15 6 L17 0 15-6 Q13-10 8-10 H-5 Q-9-10-12-8Z" />
          <path className={`${styles.carBody} ${bodyClassName}`} data-vehicle-feature="rounded-body" d="M-12-8 Q-14-5-14 0 Q-14 5-12 8 Q-9 9-5 9 H8 Q12 9 14 5 L16 0 14-5 Q12-9 8-9 H-5 Q-9-9-12-8Z" />
          <path className={styles.carRearWindow} d="M-9-6 H-3 V6 H-9 Q-11 0-9-6Z" />
          <path className={styles.carFrontWindshield} d="M0-6 H6 Q10-6 12-3 L13 0 12 3 Q10 6 6 6 H0Z" />
          <path className={styles.carCenterLine} d="M-1-6 V6" />
          <VehicleWheels />
          <VehicleLights frontX={15} rearX={-13} />
        </>
      )}

      {vehicle.id === 'police-car' && (
        <>
          <path className={styles.carShadow} d="M-12-8 Q-15-5-15 0 Q-15 5-12 8 Q-9 10-5 10 H8 Q13 10 15 6 L17 0 15-6 Q13-10 8-10 H-5 Q-9-10-12-8Z" />
          <path className={`${styles.carBody} ${bodyClassName}`} d="M-12-8 Q-14-5-14 0 Q-14 5-12 8 Q-9 9-5 9 H8 Q12 9 14 5 L16 0 14-5 Q12-9 8-9 H-5 Q-9-9-12-8Z" />
          <path className={styles.policeBlackPanel} d="M-12-7 Q-14-4-14 0 Q-14 4-12 7 Q-9 8-5 8 H-2 V-8 H-5 Q-9-8-12-7Z" />
          <path className={styles.carRearWindow} d="M-9-6 H-3 V6 H-9 Q-11 0-9-6Z" />
          <path className={styles.policeFrontWindow} d="M0-6 H6 Q10-6 12-3 L13 0 12 3 Q10 6 6 6 H0Z" />
          <path className={styles.policeStripe} d="M-2-1 H13 V1 H-2Z" />
          <rect className={styles.policeLightBase} data-vehicle-feature="siren-bar" x="-1.7" y="-10.6" width="3.4" height="21.2" rx="1.4" />
          <rect className={styles.policeLightRed} x="-1" y="-9.8" width="1.35" height="9.2" rx=".6" />
          <rect className={styles.policeLightBlue} x="-.35" y=".6" width="1.35" height="9.2" rx=".6" />
          <VehicleWheels />
          <VehicleLights frontX={15} rearX={-13} />
        </>
      )}

      {vehicle.id === 'bus' && (
        <>
          <path className={styles.carShadow} d="M-18-9 Q-19-8-19-6 V6 Q-19 9-16 10 H15 Q19 10 19 6 V-6 Q19-10 15-10 H-16 Q-18-10-18-9Z" />
          <path className={`${styles.carBody} ${bodyClassName}`} data-vehicle-feature="long-body" d="M-18-8 Q-18-10-15-10 H15 Q18-10 18-7 V7 Q18 10 15 10 H-15 Q-18 10-18 8Z" />
          <path className={styles.busRoofBand} d="M-15-8 H10 V8 H-15Z" />
          <rect className={styles.busWindow} x="-14" y="-6" width="4" height="12" rx=".8" />
          <rect className={styles.busWindow} x="-8.5" y="-6" width="4" height="12" rx=".8" />
          <rect className={styles.busWindow} x="-3" y="-6" width="4" height="12" rx=".8" />
          <rect className={styles.busWindow} x="2.5" y="-6" width="4" height="12" rx=".8" />
          <path className={styles.busFrontWindow} d="M10-7 H14 Q16-7 16-5 V5 Q16 7 14 7 H10Z" />
          <path className={styles.busRoofDetail} d="M-15 0 H8" />
          <BusWheels />
          <VehicleLights frontX={17} rearX={-17} />
        </>
      )}

      {vehicle.id === 'bulldozer' && (
        <>
          <path className={styles.bulldozerBladeShadow} d="M9-12 Q15-13 20-10 L21-7 V7 L20 10 Q15 13 9 12Z" />
          <path className={styles.bulldozerBlade} data-vehicle-feature="blade" d="M9-11 Q15-12 19-9 Q20-8 20-6 V6 Q20 8 19 9 Q15 12 9 11Z" />
          <path className={styles.bulldozerBladeEdge} d="M18-7 V7" />
          <path className={styles.bulldozerBladeArm} d="M7-6 L12-7 M7 6 L12 7" />
          <path className={styles.carShadow} d="M-13-8 Q-15-5-15 0 Q-15 5-13 8 Q-10 10-5 10 H7 V-10 H-5 Q-10-10-13-8Z" />
          <path className={`${styles.carBody} ${bodyClassName}`} d="M-13-8 Q-15-5-15 0 Q-15 5-13 8 Q-10 9-5 9 H8 Q10 9 11 7 V-7 Q10-9 8-9 H-5 Q-10-9-13-8Z" />
          <rect className={styles.bulldozerTrack} x="-12" y="-10.5" width="18" height="3.2" rx="1.4" />
          <rect className={styles.bulldozerTrack} x="-12" y="7.3" width="18" height="3.2" rx="1.4" />
          <path className={styles.bulldozerTrackInner} d="M-9-8.9 H3 M-9 8.9 H3" />
          <rect className={styles.bulldozerCabin} x="-5.5" y="-6.5" width="8" height="13" rx="1.4" />
          <rect className={styles.bulldozerWindow} x="-4.2" y="-5.1" width="5.4" height="10.2" rx=".8" />
          <circle className={styles.bulldozerLight} cx="8.3" cy="-4.2" r="1.15" />
          <circle className={styles.bulldozerLight} cx="8.3" cy="4.2" r="1.15" />
        </>
      )}
    </svg>
  )
}

function VehicleWheels() {
  return (
    <>
      <rect className={styles.carWheel} x="-8" y="-10.6" width="5" height="3" rx="1.4" />
      <rect className={styles.carWheel} x="7" y="-10.6" width="5" height="3" rx="1.4" />
      <rect className={styles.carWheel} x="-8" y="7.6" width="5" height="3" rx="1.4" />
      <rect className={styles.carWheel} x="7" y="7.6" width="5" height="3" rx="1.4" />
    </>
  )
}

function BusWheels() {
  return (
    <>
      <rect className={styles.carWheel} x="-13" y="-10.7" width="5" height="3" rx="1.4" />
      <rect className={styles.carWheel} x="10" y="-10.7" width="5" height="3" rx="1.4" />
      <rect className={styles.carWheel} x="-13" y="7.7" width="5" height="3" rx="1.4" />
      <rect className={styles.carWheel} x="10" y="7.7" width="5" height="3" rx="1.4" />
    </>
  )
}

function VehicleLights({ frontX, rearX }: Readonly<{ frontX: number; rearX: number }>) {
  return (
    <>
      <circle className={styles.carHeadlight} cx={frontX} cy="-3.3" r="1.15" />
      <circle className={styles.carHeadlight} cx={frontX} cy="3.3" r="1.15" />
      <rect className={styles.carTailLight} x={rearX - 0.6} y="-4" width="1.6" height="2.5" rx=".7" />
      <rect className={styles.carTailLight} x={rearX - 0.6} y="1.5" width="1.6" height="2.5" rx=".7" />
    </>
  )
}
