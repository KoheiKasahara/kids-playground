import type { ReactNode } from 'react'
import type { PinballThemeDefinition } from './types'
import type { ToyKind } from '../toyLayout'
import styles from './spaceTheme.module.css'

function renderSpaceToy(kind: ToyKind): ReactNode {
  if (kind === 'spinner') {
    return (
      <span className={styles.spaceSpinnerMark}>
        <span className={styles.spaceSpinnerDome} />
        <span className={styles.spaceSpinnerDish} />
        <span className={styles.spaceSpinnerBand} />
        <span className={`${styles.spaceSpinnerLight} ${styles.spaceSpinnerLightNorth}`} />
        <span className={`${styles.spaceSpinnerLight} ${styles.spaceSpinnerLightEast}`} />
        <span className={`${styles.spaceSpinnerLight} ${styles.spaceSpinnerLightSouth}`} />
        <span className={`${styles.spaceSpinnerLight} ${styles.spaceSpinnerLightWest}`} />
        <span className={styles.spaceSpinnerCore} />
      </span>
    )
  }

  return (
    <span className={styles.spaceLauncherMark}>
      <span className={styles.spaceLauncherFlame}>
        <span className={styles.spaceLauncherFlameCore} />
      </span>
      <span className={styles.spaceLauncherBody}>
        <span className={styles.spaceLauncherWindow} />
      </span>
    </span>
  )
}

export const spaceTheme: PinballThemeDefinition = {
  id: 'space',
  labelJa: 'うちゅう',
  emoji: '🚀',
  boardClassName: styles.spaceBoard,
  toyClassName: styles.spaceToy,
  renderBackdrop: () => <div className={styles.spaceBackdrop} />,
  renderToy: renderSpaceToy,
}
