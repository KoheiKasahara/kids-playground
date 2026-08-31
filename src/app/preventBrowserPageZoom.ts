/**
 * ブラウザの「ページ全体」のピンチズームだけを止める（Issue #166）。
 *
 * html の touch-action を pan-x pan-y にしても（src/styles/global.css参照）、
 * iOS Safari（WebKit）は viewport meta の user-scalable=no / maximum-scale を無視するのと同様に、
 * touch-action だけではページピンチズームを完全には止め切れない。WebKitはページの拡大縮小操作を
 * gesturestart/gesturechange/gestureend という、Touch/PointerイベントとはWebKit独自の別系統の
 * イベントとして発火するため、これらをpreventDefaultすることで確実に止める。
 *
 * これらのgestureイベントはページの拡大縮小専用であり、rail-builderの独自ピンチ実装や
 * OrbitControlsなど各ゲームのPointer Event/Touch Eventベースの入力処理とは無関係の別系統のため、
 * ここで止めてもゲーム側のジェスチャー処理には一切影響しない。
 */
const GESTURE_EVENT_NAMES = ['gesturestart', 'gesturechange', 'gestureend'] as const

function preventGesture(event: Event): void {
  event.preventDefault()
}

/**
 * gestureイベントのリスナーを登録し、解除するためのクリーンアップ関数を返す。
 * target はテストで差し替えられるようにデフォルト引数にしている。
 */
export function installBrowserPageZoomSuppression(target: Document = document): () => void {
  for (const name of GESTURE_EVENT_NAMES) {
    target.addEventListener(name, preventGesture, { passive: false })
  }

  return () => {
    for (const name of GESTURE_EVENT_NAMES) {
      target.removeEventListener(name, preventGesture)
    }
  }
}
