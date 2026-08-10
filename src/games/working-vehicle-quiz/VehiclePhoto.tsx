import type { Vehicle } from './types'
import styles from './VehiclePhoto.module.css'

type VehiclePhotoProps = {
  vehicle: Vehicle
  size?: 'large' | 'small' | 'choice'
  revealName?: boolean
  alt?: string
}

const sizeClass: Record<NonNullable<VehiclePhotoProps['size']>, string> = {
  large: styles.large,
  small: styles.small,
  choice: styles.choice,
}

export default function VehiclePhoto({
  vehicle,
  size = 'large',
  revealName = false,
  alt,
}: VehiclePhotoProps) {
  return (
    <img
      className={`${styles.photo} ${sizeClass[size]}`}
      src={import.meta.env.BASE_URL + vehicle.photo}
      alt={alt ?? (revealName ? `${vehicle.nameJa}の しゃしん` : '')}
      draggable={false}
    />
  )
}
