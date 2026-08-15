import type { CSSProperties } from 'react'
import type { AreaCup, AreaEntry, AreaExit, AreaTheme } from './types'
import { EXIT_SENSOR_HEIGHT, EXIT_WIDTH } from './adventurePhysics'
import { cupFrontLipRect, entryPortalRect, portalFrontLipRect } from './adventureGeometry'
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
  entries: readonly AreaEntry[]
  exits: readonly AreaExit[]
  cup?: AreaCup
  style: Pick<CSSProperties, 'left' | 'top' | 'width' | 'height'>
}

/**
 * ボールより後ろ（上）に置く、エリア単位の前景レイヤー。
 * Phase 1では空だが、後の葉や光の装飾をボールの上へ追加できる場所を先に確保する。
 */
export default function AreaForeground({ theme, entries, exits, cup, style }: AreaForegroundProps) {
  return (
    <div
      className={[styles.foreground, themeClass[theme]].join(' ')}
      style={{ ...style, zIndex: ADVENTURE_LAYER_Z_INDEX.foreground }}
      aria-hidden="true"
    >
      {entries.map((entry) => (
        <div
          key={`entry-front-${entry.id}`}
          className={styles.portalFront}
          data-portal-kind={entry.kind}
          style={portalFrontLipRect(entryPortalRect(entry, EXIT_WIDTH, EXIT_SENSOR_HEIGHT))}
        />
      ))}
      {exits.map((exit) => (
        <div
          key={`exit-front-${exit.id}`}
          className={styles.portalFront}
          data-portal-kind={exit.kind}
          style={portalFrontLipRect(exit)}
        />
      ))}
      {cup && (
        <div
          className={styles.cupFront}
          style={cupFrontLipRect(cup)}
        >
          <span className={styles.cupFrontLip} />
        </div>
      )}
    </div>
  )
}
