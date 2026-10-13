// ドット絵の コマを canvas に うつす どうぐ と、ぜんぶの いきもので つかう 1本の アニメーション ループ。

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SPRITE_H, SPRITE_W, type Frame } from './sprite'

const images = new WeakMap<Frame, ImageData>()

/** jsdom など 2D が つかえない ところでは null。 */
export function context2d(canvas: HTMLCanvasElement | null) {
  if (!canvas) return null
  try { return canvas.getContext('2d') } catch { return null }
}

export function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame) {
  let image = images.get(frame)
  if (!image) {
    image = new ImageData(frame.data, frame.w, frame.h)
    images.set(frame, image)
  }
  ctx.putImageData(image, 0, 0)
}

type Tick = (dt: number) => void
const ticks = new Set<Tick>()
let raf = 0
let last = 0

function loop(now: number) {
  const dt = last ? (now - last) / 1000 : 0
  last = now
  for (const tick of [...ticks]) tick(dt)
  raf = ticks.size ? requestAnimationFrame(loop) : 0
  if (!raf) last = 0
}

/** まいフレーム よばれる。かえりちで とめる。 */
export function onTick(tick: Tick) {
  ticks.add(tick)
  if (!raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(loop)
  return () => { ticks.delete(tick) }
}

/** 「うごきを へらす」せってい。 */
export function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches)
  useEffect(() => {
    const media = window.matchMedia?.(query)
    if (!media) return
    const change = () => setReduced(media.matches)
    media.addEventListener?.('change', change)
    return () => media.removeEventListener?.('change', change)
  }, [])
  return reduced
}

/**
 * canvas を はこ（box）の はばに いちばん ちかい「せいすう ばい」の おおきさに する。
 * 1ドットが いつも おなじ かずの がめんの てんに なるので、ドットの おおきさが そろう。
 * unit.current は 1ドットの CSS での おおきさ（アニメーションの なかで よむ）。
 */
export function usePixelCanvas() {
  const box = useRef<HTMLSpanElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const unit = useRef(1)
  useLayoutEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      const cv = canvas.current
      const width = el.clientWidth
      if (!cv || !width) return
      const dpr = window.devicePixelRatio || 1
      const k = Math.max(1, Math.round((width * dpr) / SPRITE_W))
      const px = k / dpr
      cv.style.width = `${px * SPRITE_W}px`
      cv.style.height = `${px * SPRITE_H}px`
      unit.current = px
    }
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    fit()
    return () => observer.disconnect()
  }, [])
  return { box, canvas, unit }
}
