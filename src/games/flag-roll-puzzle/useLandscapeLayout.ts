import { useEffect, useState } from 'react'

/**
 * コロコロパズルで横画面専用の2ペイン表示を使う条件。
 * CSS の landscape media query と同じ条件にして、パーツ置き場のジェスチャー判定も
 * 見た目（縦スクロール／横方向ドラッグ）と常に一致させる。
 */
export const LANDSCAPE_LAYOUT_QUERY = '(orientation: landscape) and (max-height: 560px)'

function matchesLandscapeLayout() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(LANDSCAPE_LAYOUT_QUERY).matches
    : false
}

/** orientation 変更時にも、ゲーム状態を保ったまま横画面用の操作方法へ切り替える。 */
export function useLandscapeLayout() {
  const [isLandscapeLayout, setIsLandscapeLayout] = useState(matchesLandscapeLayout)

  useEffect(() => {
    const media = window.matchMedia?.(LANDSCAPE_LAYOUT_QUERY)
    if (!media) return

    const update = () => setIsLandscapeLayout(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  return isLandscapeLayout
}
