import type { ReactNode } from 'react'
import type { PinballThemeDefinition } from './types'
import type { ToyKind } from '../toyLayout'
import styles from './carTheme.module.css'

function renderCarToy(kind: ToyKind): ReactNode {
  if (kind === 'car') {
    // デフォルメされたミニカー。物理Collider（carToy.tsのmainBody+cabin）と見た目の
    // 比率をできるだけ合わせ、見た目とCollider（丸みのある胴体＋屋根）が大きくズレない
    // ようにしてある。向きの反転（右向き/左向き）はこの.carMarkごとCSSでscaleXする
    // （renderToyはkindしか受け取らず個別のtoy.carを知らないため、data-toy-facingを目印にする）。
    return (
      <span className={styles.carMark}>
        <span className={styles.carShadow} />
        <span className={styles.carBody} />
        <span className={styles.carCabin} />
        <span className={styles.carWindow} />
        <span className={`${styles.carWheel} ${styles.carWheelRear}`} />
        <span className={`${styles.carWheel} ${styles.carWheelFront}`} />
        <span className={styles.carLight} />
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
