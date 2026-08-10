import type { Prefecture } from '../data/prefectures'
import { createProjection, pathForGeometry, projectedBoundsForGeometry } from './geometry'
import { displayPiecesForPrefecture } from './features'
import styles from './PrefectureShape.module.css'

type PrefectureShapeProps = { prefecture: Prefecture; label?: string; className?: string; revealed?: boolean }

/** 県を一つだけ大きく表示する。離島を含む元データをそのまま path にしている。 */
export default function PrefectureShape({ prefecture, label, className, revealed = false }: PrefectureShapeProps) {
  const pieces = displayPiecesForPrefecture(prefecture)
  const path = pathForGeometry(pieces.main, createProjection(projectedBoundsForGeometry(pieces.main), 240, 170, 14))
  return (
    <svg className={[styles.shape, className].filter(Boolean).join(' ')} viewBox="0 0 240 170" role="img" aria-label={label ?? (revealed ? prefecture.nameHiragana : '都道府県の かたち')}>
      <path d={path} className={styles.path} fillRule="evenodd" />
      {pieces.insets.map((inset, index) => <path key={index} d={pathForGeometry(inset.geometry, createProjection(projectedBoundsForGeometry(inset.geometry), inset.width * 2 / 3, inset.height * 0.6, 3))} transform={`translate(${inset.x * 2 / 3} ${inset.y * 0.6})`} className={styles.path} fillRule="evenodd" />)}
    </svg>
  )
}
