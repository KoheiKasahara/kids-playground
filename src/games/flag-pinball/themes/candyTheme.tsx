import type { ReactNode } from 'react'
import type { PinballThemeDefinition } from './types'
import type { ToyKind } from '../toyLayout'
import styles from './candyTheme.module.css'

function renderCandyToy(kind: ToyKind): ReactNode {
  if (kind === 'spinner') {
    return (
      <span className={styles.candySpinnerMark}>
        <span className={`${styles.candySpinnerBlade} ${styles.candySpinnerBladeNorth}`} />
        <span className={`${styles.candySpinnerBlade} ${styles.candySpinnerBladeEast}`} />
        <span className={`${styles.candySpinnerBlade} ${styles.candySpinnerBladeSouth}`} />
        <span className={`${styles.candySpinnerBlade} ${styles.candySpinnerBladeWest}`} />
        <span className={styles.candySpinnerHub}>
          <span className={styles.candySpinnerHubDot} />
        </span>
      </span>
    )
  }

  if (kind === 'jumppad') {
    // Phase B時点ではおかしの盤面にジャンプ台は置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素なグミのパッドにしておく。
    return (
      <span className={styles.candyJumppadMark}>
        <span className={styles.candyJumppadPad} />
        <span className={styles.candyJumppadRing} />
      </span>
    )
  }

  return (
    <span className={styles.candyLauncherMark}>
      <span className={styles.candyPopcornBurst}>
        <span className={`${styles.candyPopcornKernel} ${styles.candyPopcornKernelCenter}`} />
        <span className={`${styles.candyPopcornKernel} ${styles.candyPopcornKernelLeft}`} />
        <span className={`${styles.candyPopcornKernel} ${styles.candyPopcornKernelRight}`} />
        <span className={`${styles.candyPopcornKernel} ${styles.candyPopcornKernelFarLeft}`} />
        <span className={`${styles.candyPopcornKernel} ${styles.candyPopcornKernelFarRight}`} />
      </span>
      <span className={styles.candyPopcornBucket}>
        <span className={styles.candyPopcornBucketOpening} />
      </span>
    </span>
  )
}

export const candyTheme: PinballThemeDefinition = {
  id: 'candy',
  labelJa: 'おかし',
  emoji: '🍭',
  boardClassName: styles.candyBoard,
  toyClassName: styles.candyToy,
  renderBackdrop: () => <div className={styles.candyBackdrop} />,
  renderToy: renderCandyToy,
}
