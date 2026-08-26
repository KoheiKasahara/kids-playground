import type { FeatureSpot } from '../types'
import styles from './FeatureCard.module.css'

type FeatureCardProps = {
  /** 選択中のスポット。nullなら何も描画しない(earth-globeのCountryCardと同じ方式)。 */
  spot: FeatureSpot | null
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
