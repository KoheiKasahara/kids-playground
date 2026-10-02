import type { ReactNode } from 'react'
import type { PinballThemeDefinition } from './types'
import type { ToyKind } from '../toyLayout'
import styles from './forestTheme.module.css'

function renderForestToy(kind: ToyKind): ReactNode {
  if (kind === 'jumppad') {
    // もりテーマ専用のきのこトランポリン。赤い水玉のかさが、ボールを跳ね上げた瞬間
    // （--toy-pulse）だけ少し沈んで横へ広がり、「ぽよん」と弾んだことを示す。
    return (
      <span className={styles.forestMushroomMark}>
        <span className={styles.forestMushroomStem} />
        <span className={styles.forestMushroomCap}>
          <span className={`${styles.forestMushroomDot} ${styles.forestMushroomDotLeft}`} />
          <span className={`${styles.forestMushroomDot} ${styles.forestMushroomDotCenter}`} />
          <span className={`${styles.forestMushroomDot} ${styles.forestMushroomDotRight}`} />
        </span>
      </span>
    )
  }

  if (kind === 'seesaw') {
    // もりテーマ専用のまるたシーソー。切り株（支点）は板の傾き(--toy-spin)を打ち消す向きへ
    // 回転させ、物理的な支点と同じく常に水平のまま見せる（海テーマのシーソーと同じ考え方）。
    return (
      <span className={styles.forestLogMark}>
        <span className={styles.forestStump} />
        <span className={styles.forestLog}>
          <span className={`${styles.forestLogEnd} ${styles.forestLogEndLeft}`} />
          <span className={`${styles.forestLogEnd} ${styles.forestLogEndRight}`} />
        </span>
      </span>
    )
  }

  if (kind === 'spinner') {
    // もりの盤面に回転toyは置かないが、テーマ定義としては全おもちゃ種別の見た目を
    // 返す必要があるため、葉っぱ4枚の風車にしておく。
    return (
      <span className={styles.forestLeafMark}>
        <span className={`${styles.forestLeaf} ${styles.forestLeafNorth}`} />
        <span className={`${styles.forestLeaf} ${styles.forestLeafEast}`} />
        <span className={`${styles.forestLeaf} ${styles.forestLeafSouth}`} />
        <span className={`${styles.forestLeaf} ${styles.forestLeafWest}`} />
        <span className={styles.forestLeafHub} />
      </span>
    )
  }

  if (kind === 'hammer') {
    // もりの盤面にハンマーは置かないが、全種別の見た目として木の枝＋どんぐりにしておく。
    return (
      <span className={styles.forestHammerMark}>
        <span className={styles.forestHammerHandle} />
        <span className={styles.forestHammerHead} />
      </span>
    )
  }

  if (kind === 'wind') {
    // もりの盤面に風toyは置かないが、全種別の見た目として舞う葉っぱ3枚にしておく。
    return (
      <span className={styles.forestWindMark}>
        <span className={styles.forestWindLeaf} />
        <span className={styles.forestWindLeaf} />
        <span className={styles.forestWindLeaf} />
      </span>
    )
  }

  if (kind === 'car') {
    // もりの盤面に車toyは置かないが、全種別の見た目としてころころ転がる丸太車にしておく。
    return (
      <span className={styles.forestCartMark}>
        <span className={styles.forestCartBody} />
        <span className={`${styles.forestCartWheel} ${styles.forestCartWheelRear}`} />
        <span className={`${styles.forestCartWheel} ${styles.forestCartWheelFront}`} />
      </span>
    )
  }

  // もりの盤面に押し出しtoyは置かないが、全種別の見た目としてどんぐりにしておく。
  return (
    <span className={styles.forestAcornMark}>
      <span className={styles.forestAcornCap} />
      <span className={styles.forestAcornNut} />
    </span>
  )
}

export const forestTheme: PinballThemeDefinition = {
  id: 'forest',
  labelJa: 'もり',
  emoji: '🌳',
  boardClassName: styles.forestBoard,
  toyClassName: styles.forestToy,
  renderBackdrop: () => <div className={styles.forestBackdrop} />,
  renderToy: renderForestToy,
}
