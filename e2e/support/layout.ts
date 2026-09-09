import type { Locator } from '@playwright/test'

export type LayoutBox = { x: number; y: number; right: number; bottom: number }

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
    return {
      x: Math.min(...rects.map((rect) => rect.left)),
      y: Math.min(...rects.map((rect) => rect.top)),
      right: Math.max(...rects.map((rect) => rect.right)),
      bottom: Math.max(...rects.map((rect) => rect.bottom)),
    }
  })
}

export function boxesOverlap(a: LayoutBox | null, b: LayoutBox | null): boolean {
  return Boolean(a && b && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y)
}
