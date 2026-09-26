import styles from './StageClearBadge.module.css'

type Props = {
  /** いちばん よい ★の数（0 = まだクリアしていない）。 */
  stars: number
  /** ★の最大数。既定は3。 */
  max?: number
  /** カードの隅に重ねて置くときは true。 */
  corner?: boolean
}

/**
 * ステージ選択カードに添える「クリア済みバッジ＋★」の共通表示（Issue #784 A6）。
 * まだクリアしていないステージでは何も表示しない。色だけに頼らず「クリア」の文字も添える。
 */
export default function StageClearBadge({ stars, max = 3, corner = false }: Props) {
  if (stars <= 0) return null
  return (
    <span
      className={`${styles.badge} ${corner ? styles.corner : ''}`}
      role="img"
      aria-label={`クリアずみ ほし ${stars}こ`}
      data-stage-stars={stars}
    >
      <span className={styles.label} aria-hidden="true">クリア</span>
      <span className={styles.stars} aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <b key={i} className={i < stars ? styles.on : styles.off}>★</b>
        ))}
      </span>
    </span>
  )
}
