import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { BOARD_HEIGHT, BOARD_WIDTH } from './boardLayout'

/** PCで巨大化しすぎないための上限倍率 */
const MAX_SCALE = 1.6

export type BoardScale = {
  /** 計測対象（盤面を置く領域）に付ける ref */
  containerRef: RefObject<HTMLDivElement | null>
  scale: number
  /** BOARD_WIDTH * scale（px、整数に丸める） */
  width: number
  /** BOARD_HEIGHT * scale */
  height: number
}

/**
 * 利用できる幅・高さから倍率を求める。
 * 横幅だけに合わせると縦画面で下が余ったり、逆に横長画面で盤面がはみ出したりするため、
 * 幅・高さそれぞれから求めた倍率のうち小さい方（＝両方が必ず収まる方）を採用する。
 */
export function computeBoardScale(availableWidth: number, availableHeight: number): number {
  // 初回計測前やテスト環境（jsdomはレイアウトを持たず clientWidth/Height が常に0）では
  // 計測値が0のことがある。0除算やscale=0での描画崩れを避け、等倍にフォールバックする。
  if (availableWidth <= 0 || availableHeight <= 0) return 1
  // 下限は設けない。スマホ横向きなど利用可能高さが極端に小さい場面で下限クランプすると、
  // .fit の overflow: hidden によって盤面が見切れてしまう。見切れるより、盤面全体が
  // 小さく収まって見えるほうが子どもにとって分かりやすいため、計算結果をそのまま使う。
  return Math.min(
    availableWidth / BOARD_WIDTH,
    availableHeight / BOARD_HEIGHT,
    MAX_SCALE,
  )
}

/**
 * 論理座標 BOARD_WIDTH×BOARD_HEIGHT の盤面を、利用できる領域に収まる最大の倍率で
 * 拡縮するための Hook。
 * 盤面の見た目・物理は論理座標だけで組み立て、実機サイズへの反映はこの Hook が返す
 * scale ぶんの CSS transform（呼び出し側の責務）に一本化する。
 */
export function useBoardScale(): BoardScale {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

  // 初回は useLayoutEffect で計測する。useEffect だと「等倍で1フレーム描画→次のフレームで
  // 縮小」という表示のガタつきが起きるため、ブラウザが描画する前（コミット後・ペイント前）に
  // 同期的に測って scale を確定させる。
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      setScale(computeBoardScale(container.clientWidth, container.clientHeight))
    }
    measure()

    // jsdom（Vitestのテスト環境）は ResizeObserver を実装していないため、
    // 未対応の環境では window の resize イベントにフォールバックしてクラッシュを避ける。
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return {
    containerRef,
    scale,
    width: Math.round(BOARD_WIDTH * scale),
    height: Math.round(BOARD_HEIGHT * scale),
  }
}
