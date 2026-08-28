import styles from './ZoomControls.module.css'

type ZoomControlsProps = {
  canZoomIn: boolean
  canZoomOut: boolean
  onZoomIn: () => void
  onZoomOut: () => void
}

/** 個別観察・全体表示で共通に使う、右下のカメラズーム操作。 */
export default function ZoomControls({ canZoomIn, canZoomOut, onZoomIn, onZoomOut }: ZoomControlsProps) {
  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.button}
        aria-label="もっと ちかづく"
        onClick={onZoomIn}
        disabled={!canZoomIn}
      >
        <span aria-hidden="true">＋</span>
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label="もっと はなれる"
        onClick={onZoomOut}
        disabled={!canZoomOut}
      >
        <span aria-hidden="true">−</span>
      </button>
    </div>
  )
}
