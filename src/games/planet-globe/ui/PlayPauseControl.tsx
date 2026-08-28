import styles from './PlayPauseControl.module.css'

type PlayPauseControlProps = {
  playing: boolean
  onToggle: () => void
  /** 右下のズーム操作と併用する場合は、その真上に退避する。 */
  aboveZoomControls?: boolean
}

/** 全体表示の公転を「うごかす/とめる」。 */
export default function PlayPauseControl({ playing, onToggle, aboveZoomControls = false }: PlayPauseControlProps) {
  return (
    <div className={`${styles.controls} ${aboveZoomControls ? styles.aboveZoomControls : ''}`}>
      <button type="button" className={styles.button} onClick={onToggle}>
        <span aria-hidden="true">{playing ? '⏸' : '▶'}</span>
        <span className={styles.label}>{playing ? 'とめる' : 'うごかす'}</span>
      </button>
    </div>
  )
}
