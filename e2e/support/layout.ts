import type { Locator } from '@playwright/test'

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
