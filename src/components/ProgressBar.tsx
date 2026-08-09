import styles from './ProgressBar.module.css'

type ProgressBarProps = {
  current: number
  total: number
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const safeTotal = Math.max(total, 1)
  const ratio = Math.min(Math.max(current / safeTotal, 0), 1)

  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${current} / ${total} もん`}
    >
      <div className={styles.fill} style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}
