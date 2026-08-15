import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { AREA_HEIGHT, AREA_WIDTH } from './adventurePhysics'

/** PCで縦の遊び場が必要以上に巨大化しないための上限倍率。 */
const MAX_SCALE = 1.6

export type AreaScale = {
  /** 1エリアを置く領域に付けるref */
  containerRef: RefObject<HTMLDivElement | null>
  scale: number
  width: number
  height: number
}

/**
 * 480×720の1エリアを利用可能な幅・高さへ収める倍率。
 * 幅だけ、または高さだけで決めると端末によってコースが見切れるため、小さい方を採用する。
 */
export function computeAreaScale(availableWidth: number, availableHeight: number): number {
  // jsdomや初回レイアウト前は0になる。等倍へ戻して、scale=0でボールが消えるのを防ぐ。
  if (availableWidth <= 0 || availableHeight <= 0) return 1
  return Math.min(availableWidth / AREA_WIDTH, availableHeight / AREA_HEIGHT, MAX_SCALE)
}

/**
 * useBoardScaleとは別に持つ。
 * こちらは1画面だけを拡縮する一方、内部のworldはカメラのtranslateで全エリアを覗くため、
 * 将来分岐でカメラのオフセットや表示領域の責務が変わってもピンボール側へ影響させない。
 */
export function useAreaScale(): AreaScale {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      setScale(computeAreaScale(container.clientWidth, container.clientHeight))
    }
    measure()

    // ResizeObserverがないVitest/jsdomではwindow.resizeへフォールバックする。
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
    width: Math.round(AREA_WIDTH * scale),
    height: Math.round(AREA_HEIGHT * scale),
  }
}
