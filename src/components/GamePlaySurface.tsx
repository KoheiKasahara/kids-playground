import type { MouseEvent, ReactNode } from 'react'
import styles from './GamePlaySurface.module.css'

type Props = {
  children: ReactNode
}

/**
 * ゲームの実プレイ画面だけに適用する、長押しメニュー・文字選択・画像ドラッグの抑制（Issue #166）。
 * 状態やゲームロジック、レイアウトは一切持たず、classの付与とcontextmenuの抑制だけを行う。
 *
 * ラッパー要素は display: contents にしている。既存の各画面はflex/grid/100dvhの構造で
 * 組まれているため、ここに素の箱を割り込ませるとレイアウトを壊しかねない。
 * user-select / -webkit-touch-callout は継承プロパティなので、display: contents でも
 * 子孫要素にはそのまま効く（詳細はGamePlaySurface.module.cssのコメントを参照）。
 */
export default function GamePlaySurface({ children }: Props) {
  return (
    <div
      className={styles.surface}
      onContextMenu={(event: MouseEvent<HTMLDivElement>) => event.preventDefault()}
    >
      {children}
    </div>
  )
}
