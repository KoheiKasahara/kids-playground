import type { ReactNode } from 'react'
import type { PinballThemeDefinition } from './types'
import type { ToyKind } from '../toyLayout'
import styles from './oceanTheme.module.css'

function renderOceanToy(kind: ToyKind): ReactNode {
  if (kind === 'spinner') {
    return (
      <span className={styles.oceanSpinnerMark}>
        <span className={`${styles.oceanSpinnerArm} ${styles.oceanSpinnerArmNorth}`} />
        <span className={`${styles.oceanSpinnerArm} ${styles.oceanSpinnerArmEast}`} />
        <span className={`${styles.oceanSpinnerArm} ${styles.oceanSpinnerArmSouth}`} />
        <span className={`${styles.oceanSpinnerArm} ${styles.oceanSpinnerArmWest}`} />
        <span className={styles.oceanSpinnerCore}>
          <span className={styles.oceanSpinnerCoreDot} />
        </span>
      </span>
    )
  }

  if (kind === 'jumppad') {
    // Phase B時点では海の盤面にジャンプ台は置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な泡が弾けるパッドにしておく。
    return (
      <span className={styles.oceanJumppadMark}>
        <span className={styles.oceanJumppadPad} />
        <span className={styles.oceanJumppadRing} />
      </span>
    )
  }

  if (kind === 'seesaw') {
    // 海テーマ専用のシーソーtoy。木の板が岩（支点）の上で傾く「浮き橋」のイメージ。
    // 支点の岩だけは板の傾き(--toy-spin)を打ち消す向きに回転させ、常に水平を保つ
    // （実際の物理的な支点は動かないため、見た目もそれに合わせる）。
    return (
      <span className={styles.oceanSeesawMark}>
        <span className={styles.oceanSeesawPivot} />
        <span className={styles.oceanSeesawPlank}>
          <span className={`${styles.oceanSeesawPlankEnd} ${styles.oceanSeesawPlankEndLeft}`} />
          <span className={`${styles.oceanSeesawPlankEnd} ${styles.oceanSeesawPlankEndRight}`} />
        </span>
      </span>
    )
  }

  if (kind === 'wind') {
    // Phase E時点では海の盤面に風toyは置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な矢印3本にしておく。
    return (
      <span className={styles.oceanWindMark}>
        <span className={styles.oceanWindArrow} />
        <span className={styles.oceanWindArrow} />
        <span className={styles.oceanWindArrow} />
      </span>
    )
  }

  if (kind === 'hammer') {
    // Phase D時点では海の盤面にハンマーは置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な棒＋ヘッドにしておく。
    return (
      <span className={styles.oceanHammerMark}>
        <span className={styles.oceanHammerHandle} />
        <span className={styles.oceanHammerHead} />
      </span>
    )
  }

  return (
    <span className={styles.oceanLauncherMark}>
      <span className={styles.oceanWhaleSpout}>
        <span className={styles.oceanWhaleWaterMain} />
        <span className={`${styles.oceanWhaleWaterDrop} ${styles.oceanWhaleWaterDropLeft}`} />
        <span className={`${styles.oceanWhaleWaterDrop} ${styles.oceanWhaleWaterDropRight}`} />
      </span>
      <span className={styles.oceanWhaleTail} />
      <span className={styles.oceanWhaleBody}>
        <span className={styles.oceanWhaleBelly} />
        <span className={styles.oceanWhaleFin} />
        <span className={styles.oceanWhaleEye} />
      </span>
      <span className={styles.oceanWhaleBlowhole} />
    </span>
  )
}

export const oceanTheme: PinballThemeDefinition = {
  id: 'ocean',
  labelJa: 'うみ',
  emoji: '🌊',
  boardClassName: styles.oceanBoard,
  toyClassName: styles.oceanToy,
  renderBackdrop: () => <div className={styles.oceanBackdrop} />,
  renderToy: renderOceanToy,
}
