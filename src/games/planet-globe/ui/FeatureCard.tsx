import type { FeatureSpot, SatelliteSpec } from '../types'
import styles from './FeatureCard.module.css'

export type FeatureCardItem = Pick<FeatureSpot | SatelliteSpec, 'displayName' | 'spokenName' | 'description'>

type FeatureCardProps = {
  /** 選択中の特徴スポット/衛星。nullなら何も描画しない。 */
  spot: FeatureCardItem | null
  onClose: () => void
}

export default function FeatureCard({ spot, onClose }: FeatureCardProps) {
  if (spot === null) return null

  return (
    <button
      type="button"
      className={styles.card}
      aria-label={`${spot.displayName}。${spot.description}。タップすると とじます`}
      onClick={onClose}
    >
      <span className={styles.name}>{spot.displayName}</span>
      <span className={styles.description}>{spot.description}</span>
      <span className={styles.hint}>タップで とじる</span>
    </button>
  )
}
