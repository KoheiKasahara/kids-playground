import type { ReactNode } from 'react'
import type { PinballThemeDefinition } from './types'
import type { ToyKind } from '../toyLayout'
import styles from './carTheme.module.css'

function renderCarToy(kind: ToyKind): ReactNode {
  if (kind === 'car') {
    // 小さな表示でも「前・中央・後ろ」が読み取れる、丸みのあるミニカー。
    // 物理Collider（carToy.tsの胴体＋円形キャビン）は変更せず、ここでは見た目だけを
    // ボディ／ボンネット／キャビン／前後の窓／タイヤへ分けて、車の向きを明確にする。
    return (
      <span className={styles.carMark}>
        <span className={styles.carShadow} />
        <span className={styles.carBody} />
        <span className={styles.carHood} />
        <span className={styles.carCabin} />
        <span className={styles.carWindowRear} />
        <span className={styles.carWindowFront} />
        <span className={styles.carWindowPillar} />
        <span className={styles.carDoor} />
        <span className={styles.carBumperRear} />
        <span className={styles.carBumperFront} />
        <span className={`${styles.carWheel} ${styles.carWheelRear}`} />
        <span className={`${styles.carWheel} ${styles.carWheelFront}`} />
        <span className={styles.carTailLight} />
        <span className={styles.carLight} />
        <span className={styles.carGrille} />
      </span>
    )
  }

  if (kind === 'spinner') {
    return (
      <span className={styles.carSpinnerMark}>
        <span className={`${styles.carSpinnerBlade} ${styles.carSpinnerBladeNorth}`} />
        <span className={`${styles.carSpinnerBlade} ${styles.carSpinnerBladeEast}`} />
        <span className={`${styles.carSpinnerBlade} ${styles.carSpinnerBladeSouth}`} />
        <span className={`${styles.carSpinnerBlade} ${styles.carSpinnerBladeWest}`} />
        <span className={styles.carSpinnerHub} />
      </span>
    )
  }

  if (kind === 'jumppad') {
    // Phase F時点ではくるまの盤面にジャンプ台は置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素なパッドにしておく。
    return (
      <span className={styles.carJumppadMark}>
        <span className={styles.carJumppadPad} />
        <span className={styles.carJumppadRing} />
      </span>
    )
  }

  if (kind === 'seesaw') {
    // Phase F時点ではくるまの盤面にシーソーは置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な板にしておく。
    return (
      <span className={styles.carSeesawMark}>
        <span className={styles.carSeesawPivot} />
        <span className={styles.carSeesawPlank} />
      </span>
    )
  }

  if (kind === 'wind') {
    // Phase F時点ではくるまの盤面に風toyは置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な矢印3本にしておく。
    return (
      <span className={styles.carWindMark}>
        <span className={styles.carWindArrow} />
        <span className={styles.carWindArrow} />
        <span className={styles.carWindArrow} />
      </span>
    )
  }

  if (kind === 'hammer') {
    // Phase F時点ではくるまの盤面にハンマーは置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な棒＋ヘッドにしておく。
    return (
      <span className={styles.carHammerMark}>
        <span className={styles.carHammerHandle} />
        <span className={styles.carHammerHead} />
      </span>
    )
  }

  return (
    <span className={styles.carLauncherMark}>
      <span className={styles.carLauncherBase} />
      <span className={styles.carLauncherSpring} />
      <span className={styles.carLauncherCap} />
      <span className={styles.carLauncherPop} />
    </span>
  )
}

export const carTheme: PinballThemeDefinition = {
  id: 'car',
  labelJa: 'くるま',
  emoji: '🚗',
  boardClassName: styles.carBoard,
  toyClassName: styles.carToy,
  renderBackdrop: () => <div className={styles.carBackdrop} />,
  renderToy: renderCarToy,
}
