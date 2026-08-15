import type { ReactNode } from 'react'
import type { PinballThemeDefinition } from './types'
import type { ToyKind } from '../toyLayout'
import styles from './normalTheme.module.css'

function renderNormalToy(kind: ToyKind): ReactNode {
  // ノーマルは盤面を変えず、おもちゃの絵だけを見慣れた形にする。
  if (kind === 'spinner') {
    return (
      <span className={styles.normalSpinnerMark}>
        <span className={`${styles.normalSpinnerBlade} ${styles.normalSpinnerBladeNorth}`} />
        <span className={`${styles.normalSpinnerBlade} ${styles.normalSpinnerBladeEast}`} />
        <span className={`${styles.normalSpinnerBlade} ${styles.normalSpinnerBladeSouth}`} />
        <span className={`${styles.normalSpinnerBlade} ${styles.normalSpinnerBladeWest}`} />
        <span className={styles.normalSpinnerHub} />
      </span>
    )
  }

  return (
    <span className={styles.normalLauncherMark}>
      <span className={styles.normalLauncherBase} />
      <span className={styles.normalLauncherSpring} />
      <span className={styles.normalLauncherCap} />
      <span className={styles.normalLauncherPop} />
    </span>
  )
}

export const normalTheme: PinballThemeDefinition = {
  id: 'normal',
  labelJa: 'ノーマル',
  emoji: '🌈',
  boardClassName: styles.normalBoard,
  toyClassName: styles.normalToy,
  renderBackdrop: undefined,
  renderToy: renderNormalToy,
}
