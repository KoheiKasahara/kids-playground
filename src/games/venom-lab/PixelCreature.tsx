import { useEffect, useState } from 'react'
import type { Species } from './data'
import { context2d, drawFrame, onTick, usePixelCanvas, useReducedMotion } from './canvas'
import { actSeconds, profileOf } from './motion'
import { detailScale, frameOf, readyFrame, SPRITE_H, SPRITE_W } from './sprite'
import styles from './VenomLabPlay.module.css'

/** とくいわざを ときどき みせる まで（びょう）。 */
const ACT_EVERY = 6

/**
 * いきものの ドット絵。live なら いきづかいの ループと、ときどき とくいわざ。
 * actSignal が かわると すぐに とくいわざを みせる。small は ちいさな カード よう（64×48 ドット）、
 * そうでなければ がめんに あわせた こまかさ。
 */
export default function PixelCreature({ species, className, live = false, actSignal = 0, small = false }: {
  species: Species; className?: string; live?: boolean; actSignal?: number; small?: boolean
}) {
  const { box, canvas } = usePixelCanvas()
  const reduced = useReducedMotion()
  const [detail] = useState(detailScale)
  const scale = small ? 1 : detail

  useEffect(() => {
    const ctx = context2d(canvas.current)
    if (!ctx) return
    const p = profileOf(species)
    if (!live || reduced) {
      // うごきを へらす ときは、わざの いちばん わかりやすい ポーズを しばらく みせる。
      const showAct = live && actSignal > 0
      drawFrame(ctx, showAct ? frameOf(species, 'act', Math.floor(p.frames.act / 2), p.frames.act, scale) : frameOf(species, 'idle', 0, p.frames.idle, scale))
      if (!showAct) return
      const timer = setTimeout(() => drawFrame(ctx, frameOf(species, 'idle', 0, p.frames.idle, scale)), 2500)
      return () => clearTimeout(timer)
    }
    let mode: 'idle' | 'act' = actSignal > 0 ? 'act' : 'idle'
    let time = 0, calm = 0, shown = ''
    drawFrame(ctx, frameOf(species, mode, 0, p.frames[mode], scale))
    return onTick(dt => {
      time += Math.min(dt, .1)
      if (mode === 'act' && time >= actSeconds(p)) { mode = 'idle'; time = 0; calm = 0 }
      if (mode === 'idle' && (calm += Math.min(dt, .1)) > ACT_EVERY) { mode = 'act'; time = 0 }
      const count = p.frames[mode]
      const index = mode === 'act' ? Math.min(count - 1, Math.floor((time / actSeconds(p)) * count)) : Math.floor(time * p.fps.idle) % count
      const key = `${mode}${index}`
      if (key === shown) return
      const frame = readyFrame(species, mode, index, count, scale)
      if (!frame) return
      shown = key
      drawFrame(ctx, frame)
    })
  }, [species, live, reduced, actSignal, canvas, scale])

  return <span ref={box} className={`${styles.pixelBox} ${className ?? ''}`}>
    <canvas ref={canvas} width={SPRITE_W * scale} height={SPRITE_H * scale} aria-hidden="true" />
  </span>
}
