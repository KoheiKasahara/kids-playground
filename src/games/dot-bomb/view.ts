// がめんがわの ちいさな どうぐ。

import { viewSize } from './render'
import type { Img } from './pixel'

export function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** canvas を 画面の 大きさに あわせ、ドットの ばいりつを かえす。 */
export function fitCanvas(canvas: HTMLCanvasElement, boardW?: number, boardH?: number) {
  const box = canvas.getBoundingClientRect()
  const dpr = Math.min(3, window.devicePixelRatio || 1)
  const view = viewSize(box.width || 640, box.height || 360, dpr, boardW, boardH)
  if (canvas.width !== view.dw) canvas.width = view.dw
  if (canvas.height !== view.dh) canvas.height = view.dh
  return view
}

export function blit(ctx: CanvasRenderingContext2D, img: Img | null, view: { w: number; h: number; scale: number }) {
  if (!img) return
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0, view.w * view.scale, view.h * view.scale)
}
