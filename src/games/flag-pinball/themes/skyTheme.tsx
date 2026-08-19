import type { ReactNode } from 'react'
import type { PinballThemeDefinition } from './types'
import type { ToyKind } from '../toyLayout'
import styles from './skyTheme.module.css'

function renderSkyToy(kind: ToyKind): ReactNode {
  if (kind === 'wind') {
    // 空テーマ専用の風toy。3本の矢羽根が同じ向きへゆっくり流れ続けるアニメーションで、
    // 「ここに風が吹いている」ことを常に示す（--toy-pulse/--toy-activeとは無関係の
    // 常時アニメーションにし、実際にボールを流している瞬間だけ少し明るくなる）。
    // 見た目の向き（右向き/左向き）はCSS側で toy id ごとに反転させる
    // （renderToyはkindしか受け取らず個別の placement.wind を知らないため）。
    return (
      <span className={styles.skyWindMark}>
        <span className={styles.skyWindArrow} />
        <span className={styles.skyWindArrow} />
        <span className={styles.skyWindArrow} />
      </span>
    )
  }

  if (kind === 'spinner') {
    // 空テーマ専用のプロペラ。物理はspinnerToy.tsの十字コンパウンドと共通のため、
    // 見た目も他テーマの回転おもちゃと同じ十字の骨組み（--toy-blade-*）を使う。
    return (
      <span className={styles.skyPropellerMark}>
        <span className={`${styles.skyPropellerBlade} ${styles.skyPropellerBladeNorth}`} />
        <span className={`${styles.skyPropellerBlade} ${styles.skyPropellerBladeEast}`} />
        <span className={`${styles.skyPropellerBlade} ${styles.skyPropellerBladeSouth}`} />
        <span className={`${styles.skyPropellerBlade} ${styles.skyPropellerBladeWest}`} />
        <span className={styles.skyPropellerHub} />
      </span>
    )
  }

  if (kind === 'jumppad') {
    // Phase E時点では空の盤面にジャンプ台は置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な雲パッドにしておく。
    return (
      <span className={styles.skyJumppadMark}>
        <span className={styles.skyJumppadPad} />
        <span className={styles.skyJumppadRing} />
      </span>
    )
  }

  if (kind === 'seesaw') {
    // Phase E時点では空の盤面にシーソーは置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な板にしておく。
    return (
      <span className={styles.skySeesawMark}>
        <span className={styles.skySeesawPivot} />
        <span className={styles.skySeesawPlank} />
      </span>
    )
  }

  if (kind === 'hammer') {
    // Phase E時点では空の盤面にハンマーは置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な棒＋ヘッドにしておく。
    return (
      <span className={styles.skyHammerMark}>
        <span className={styles.skyHammerHandle} />
        <span className={styles.skyHammerHead} />
      </span>
    )
  }

  // Phase E時点では空の盤面に押し出しtoyは置かれないが、テーマ定義としては
  // 全おもちゃ種別の見た目を返す必要があるため、気球風の簡素な絵にしておく。
  return (
    <span className={styles.skyLauncherMark}>
      <span className={styles.skyLauncherBalloon} />
      <span className={styles.skyLauncherBasket} />
    </span>
  )
}

export const skyTheme: PinballThemeDefinition = {
  id: 'sky',
  labelJa: 'そら',
  emoji: '🌤️',
  boardClassName: styles.skyBoard,
  toyClassName: styles.skyToy,
  renderBackdrop: () => <div className={styles.skyBackdrop} />,
  renderToy: renderSkyToy,
}
