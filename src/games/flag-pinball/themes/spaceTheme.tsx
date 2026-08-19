import type { ReactNode } from 'react'
import type { PinballThemeDefinition } from './types'
import type { ToyKind } from '../toyLayout'
import styles from './spaceTheme.module.css'

function renderSpaceToy(kind: ToyKind): ReactNode {
  if (kind === 'spinner') {
    return (
      <span className={styles.spaceSpinnerMark}>
        <span className={`${styles.spaceSpinnerPanel} ${styles.spaceSpinnerPanelNorth}`} />
        <span className={`${styles.spaceSpinnerPanel} ${styles.spaceSpinnerPanelEast}`} />
        <span className={`${styles.spaceSpinnerPanel} ${styles.spaceSpinnerPanelSouth}`} />
        <span className={`${styles.spaceSpinnerPanel} ${styles.spaceSpinnerPanelWest}`} />
        <span className={styles.spaceSpinnerCore} />
      </span>
    )
  }

  if (kind === 'jumppad') {
    return (
      <span className={styles.spaceJumppadMark}>
        <span className={styles.spaceJumppadPlume}>
          <span className={styles.spaceJumppadPlumeCore} />
        </span>
        <span className={styles.spaceJumppadPad}>
          <span className={styles.spaceJumppadRing} />
          <span className={styles.spaceJumppadHatch} />
        </span>
      </span>
    )
  }

  if (kind === 'seesaw') {
    // Phase C時点では宇宙の盤面にシーソーは置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な板にしておく。
    return (
      <span className={styles.spaceSeesawMark}>
        <span className={styles.spaceSeesawPivot} />
        <span className={styles.spaceSeesawPlank} />
      </span>
    )
  }

  if (kind === 'hammer') {
    // Phase D時点では宇宙の盤面にハンマーは置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な棒＋ヘッドにしておく。
    return (
      <span className={styles.spaceHammerMark}>
        <span className={styles.spaceHammerHandle} />
        <span className={styles.spaceHammerHead} />
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
