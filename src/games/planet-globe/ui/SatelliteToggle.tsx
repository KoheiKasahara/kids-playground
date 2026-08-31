import styles from './SatelliteToggle.module.css'

type SatelliteToggleProps = {
  pressed: boolean
  onToggle: () => void
}

export default function SatelliteToggle({ pressed, onToggle }: SatelliteToggleProps) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${pressed ? styles.pressed : styles.off}`}
      aria-pressed={pressed}
      aria-label={pressed ? 'つきを かくす' : 'つきも みる'}
      onClick={onToggle}
    >
      <span aria-hidden="true" className={styles.icon}>🌙</span>
      <span>{pressed ? 'つきを かくす' : 'つきも みる'}</span>
    </button>
  )
}
