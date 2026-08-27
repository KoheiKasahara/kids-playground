import styles from './PlayPauseControl.module.css'

type PlayPauseControlProps = {
  playing: boolean
  onToggle: () => void
}

/** 全体表示の公転を「うごかす/とめる」。ZoomControlsと同じ右下の位置に、片方だけ表示する。 */
export default function PlayPauseControl({ playing, onToggle }: PlayPauseControlProps) {
  return (
    <div className={styles.controls}>
      <button type="button" className={styles.button} onClick={onToggle}>
        <span aria-hidden="true">{playing ? '⏸' : '▶'}</span>
        <span className={styles.label}>{playing ? 'とめる' : 'うごかす'}</span>
      </button>
    </div>
  )
}
