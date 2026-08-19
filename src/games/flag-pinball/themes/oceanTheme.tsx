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
