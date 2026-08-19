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

  if (kind === 'jumppad') {
    // Phase B時点ではノーマルの盤面にジャンプ台は置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、押し出しおもちゃと似た簡素な絵にしておく。
    return (
      <span className={styles.normalJumppadMark}>
        <span className={styles.normalJumppadPad} />
        <span className={styles.normalJumppadRing} />
      </span>
    )
  }

  if (kind === 'seesaw') {
    // Phase C時点ではノーマルの盤面にシーソーは置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な板にしておく。
    return (
      <span className={styles.normalSeesawMark}>
        <span className={styles.normalSeesawPivot} />
        <span className={styles.normalSeesawPlank} />
      </span>
    )
  }

  if (kind === 'wind') {
    // Phase E時点ではノーマルの盤面に風toyは置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な矢印3本にしておく。
    return (
      <span className={styles.normalWindMark}>
        <span className={styles.normalWindArrow} />
        <span className={styles.normalWindArrow} />
        <span className={styles.normalWindArrow} />
      </span>
    )
  }

  if (kind === 'hammer') {
    // Phase D時点ではノーマルの盤面にハンマーは置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な棒＋ヘッドにしておく。
    return (
      <span className={styles.normalHammerMark}>
        <span className={styles.normalHammerHandle} />
        <span className={styles.normalHammerHead} />
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
