import { expect, type Locator } from '@playwright/test'

// PlaywrightのboundingBoxと同じ形式に統一する。right/bottomの混在は重なりを見逃す。
export type LayoutBox = { x: number; y: number; width: number; height: number }

/** 要素の余白ではなく、実際に描画される文字だけを囲む矩形を返す。 */
export async function visibleTextBox(locator: Locator): Promise<LayoutBox | null> {
  return locator.evaluate((element) => {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    const rects: DOMRect[] = []
    let node: Node | null

    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim()) continue
      const range = element.ownerDocument.createRange()
      range.selectNodeContents(node)
      rects.push(...Array.from(range.getClientRects()))
    }

    if (rects.length === 0) return null
    const x = Math.min(...rects.map((rect) => rect.left))
    const y = Math.min(...rects.map((rect) => rect.top))
    return {
      x,
      y,
      width: Math.max(...rects.map((rect) => rect.right)) - x,
      height: Math.max(...rects.map((rect) => rect.bottom)) - y,
    }
  })
}

export function boxesOverlap(a: LayoutBox | null, b: LayoutBox | null): boolean {
  return Boolean(a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y)
}

/** 設計上は画面に収まる拡縮盤面向け。丸め誤差だけを許容し、はみ出しは辺ごとに検査する。 */
export async function expectScaledBoardInViewport(locator: Locator, timeout?: number) {
  await expect.poll(() => locator.evaluate((element) => new Promise<number>((resolve) => {
    const observer = new IntersectionObserver(([entry]) => {
      observer.disconnect()
      const bounds = entry.boundingClientRect
      const visible = entry.intersectionRect
      resolve(entry.isIntersecting && visible.width > 0 && visible.height > 0
        ? Math.max(visible.left - bounds.left, visible.top - bounds.top,
          bounds.right - visible.right, bounds.bottom - visible.bottom)
        : Number.POSITIVE_INFINITY)
    })
    observer.observe(element)
  })), { timeout, message: '拡縮した盤面は各辺の丸め誤差1 CSS px以内で画面に収まる' })
    .toBeLessThanOrEqual(1)
}
