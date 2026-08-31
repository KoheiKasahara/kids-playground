import { describe, expect, test } from 'vitest'
import { installBrowserPageZoomSuppression } from './preventBrowserPageZoom'

// gesturestart/gesturechange/gestureendはWebKit(iOS Safari)がページの拡大縮小操作にだけ
// 発火する独自イベントで、Touch/Pointerイベントとは別系統。ここを止めても
// ゲーム側のPointer Event/Touch Eventベースの入力処理には影響しない（Issue #166）。
const GESTURE_EVENT_NAMES = ['gesturestart', 'gesturechange', 'gestureend'] as const

describe('installBrowserPageZoomSuppression(Issue #166)', () => {
  test.each(GESTURE_EVENT_NAMES)('%sをpreventDefaultし、ページピンチズームを止める', (eventName) => {
    const uninstall = installBrowserPageZoomSuppression(document)
    try {
      const event = new Event(eventName, { cancelable: true })
      document.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    } finally {
      uninstall()
    }
  })

  test.each(GESTURE_EVENT_NAMES)('クリーンアップ後は%sをpreventDefaultしなくなる', (eventName) => {
    const uninstall = installBrowserPageZoomSuppression(document)
    uninstall()

    const event = new Event(eventName, { cancelable: true })
    document.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  test('渡したtargetにだけ登録される（他のEventTargetには影響しない）', () => {
    const target = document.createElement('div')
    const uninstall = installBrowserPageZoomSuppression(target as unknown as Document)
    try {
      const onDocument = new Event('gesturestart', { cancelable: true })
      document.dispatchEvent(onDocument)
      expect(onDocument.defaultPrevented).toBe(false)

      const onTarget = new Event('gesturestart', { cancelable: true })
      target.dispatchEvent(onTarget)
      expect(onTarget.defaultPrevented).toBe(true)
    } finally {
      uninstall()
    }
  })
})
