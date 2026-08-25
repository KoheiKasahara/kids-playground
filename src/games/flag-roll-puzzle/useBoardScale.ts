import { useCallback, useLayoutEffect, useState } from 'react'
import { BOARD_HEIGHT, BOARD_WIDTH } from './boardLayout'

/** PCで巨大化しすぎないための上限倍率 */
const MAX_SCALE = 1.4

export type BoardScale = {
  /** 盤面を置く領域（計測対象）に付ける ref。DOMへ実際に付いたタイミングを
   * 検知できるよう、RefObjectではなくコールバック関数にしてある。 */
  containerRef: (node: HTMLDivElement | null) => void
  scale: number
  /** 実際に占める大きさ(px)。盤面の外枠に使う */
  width: number
  height: number
}

/**
 * 使える幅・高さの両方に収まる倍率を求める。
 * 幅だけに合わせると縦画面で下がはみ出すため、幅・高さそれぞれの倍率のうち
 * 小さい方（＝必ず両方に収まる方）を採る。
 */
export function computeBoardScale(availableWidth: number, availableHeight: number): number {
  // 初回計測前やjsdom（レイアウトを持たず clientWidth/Height が常に0）では0が来る。
  // 0除算やscale=0での描画崩れを避け、等倍へフォールバックする。
  if (availableWidth <= 0 || availableHeight <= 0) return 1
  return Math.min(availableWidth / BOARD_WIDTH, availableHeight / BOARD_HEIGHT, MAX_SCALE)
}

/**
 * 論理座標 BOARD_WIDTH×BOARD_HEIGHT の盤面を、使える領域へ収まる最大倍率で拡縮する。
 * 盤面の描画も物理も論理座標だけで組み立て、実機サイズへの変換はこのフックが返す
 * scale ぶんの CSS transform に一本化する。ドラッグ位置の逆変換
 * （boardPointFromClient）も同じ scale を使う。
 */
export function useBoardScale(): BoardScale {
  // ステージ選択画面から盤面へ切り替わるまでは、この要素はまだDOMに無い。
  // useRefだとDOMへ付いた瞬間を検知できず計測できないため、stateで持って
  // ノードが変わるたびに（＝実際に付いたタイミングで）effectを再実行する。
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

  // 等倍で1フレーム描いてから縮む、というガタつきを避けるためペイント前に測る。
  useLayoutEffect(() => {
    if (!container) return

    const measure = () => {
      setScale(computeBoardScale(container.clientWidth, container.clientHeight))
    }
    measure()

    // jsdom は ResizeObserver を持たないため、未対応環境では resize へフォールバックする。
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [container])

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainer(node)
  }, [])

  return {
    containerRef,
    scale,
    width: Math.round(BOARD_WIDTH * scale),
    height: Math.round(BOARD_HEIGHT * scale),
  }
}
