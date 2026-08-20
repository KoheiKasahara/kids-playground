import type { ZoomLevel } from '../types'
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from '../types'
import styles from './ZoomControls.module.css'

type ZoomControlsProps = {
  zoomLevel: ZoomLevel
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

export default function ZoomControls({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onReset,
}: ZoomControlsProps) {
  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.button}
        aria-label="もっと ちかづく"
        onClick={onZoomIn}
        disabled={zoomLevel >= MAX_ZOOM_LEVEL}
      >
        <span aria-hidden="true">＋</span>
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label="もっと はなれる"
        onClick={onZoomOut}
        disabled={zoomLevel <= MIN_ZOOM_LEVEL}
      >
        <span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        className={`${styles.button} ${styles.reset}`}
        aria-label="ぜんたいに もどる"
        onClick={onReset}
      >
        <span aria-hidden="true">🏠</span>
      </button>
    </div>
  )
}
