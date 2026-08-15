import type { CSSProperties } from 'react'
import type { AreaTheme } from './types'
import { ADVENTURE_LAYER_Z_INDEX } from './layerOrder'
import styles from './AreaBackground.module.css'

const themeClass: Record<AreaTheme, string> = {
  sky: styles.themeSky,
  forest: styles.themeForest,
  cave: styles.themeCave,
  goal: styles.themeGoal,
}

type AreaForegroundProps = {
  theme: AreaTheme
  style: Pick<CSSProperties, 'left' | 'top' | 'width' | 'height'>
}

/**
 * ボールより後ろ（上）に置く、エリア単位の前景レイヤー。
 * Phase 1では空だが、後の葉や光の装飾をボールの上へ追加できる場所を先に確保する。
 */
export default function AreaForeground({ theme, style }: AreaForegroundProps) {
  return (
    <div
      className={[styles.foreground, themeClass[theme]].join(' ')}
      style={{ ...style, zIndex: ADVENTURE_LAYER_Z_INDEX.foreground }}
      aria-hidden="true"
    />
  )
}
