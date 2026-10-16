import { useEffect, useState } from 'react'
import type { Species } from './data'
import { context2d, drawFrame, onTick, usePixelCanvas, useReducedMotion } from './canvas'
import { clipSeconds, profileOf, type Special } from './motion'
import { detailScale, frameOf, readyFrame, SPRITE_H, SPRITE_W } from './sprite'
import styles from './VenomLabPlay.module.css'

/** とくいわざ・くらしの ようすを ときどき みせる まで（びょう）。 */
const ACT_EVERY = 6

/** みせて ほしい うごき。n が かわるたびに clip を はじめから みせる。 */
export type Cue = { clip: Special; n: number }

/**
 * いきものの ドット絵。live なら いきづかいの ループと、ときどき とくいわざ・くらしの ようす（かわりばんこ）。
 * cue が かわると すぐに その うごきを みせる。small は ちいさな カード よう（64×48 ドット）、
 * そうでなければ がめんに あわせた こまかさ。
 */
export default function PixelCreature({ species, className, live = false, cue, small = false }: {
  species: Species; className?: string; live?: boolean; cue?: Cue; small?: boolean
}) {
  const { box, canvas } = usePixelCanvas()
  const reduced = useReducedMotion()
  const [detail] = useState(detailScale)
  const scale = small ? 1 : detail
  const cueClip = cue?.clip ?? 'act', cueCount = cue?.n ?? 0

  useEffect(() => {
    const ctx = context2d(canvas.current)
    if (!ctx) return
    const p = profileOf(species)
    if (!live || reduced) {
      // うごきを へらす ときは、わざの いちばん わかりやすい ポーズを しばらく みせる。
      const show = live && cueCount > 0
      drawFrame(ctx, show ? frameOf(species, cueClip, Math.floor(p.frames[cueClip] / 2), p.frames[cueClip], scale) : frameOf(species, 'idle', 0, p.frames.idle, scale))
      if (!show) return
      const timer = setTimeout(() => drawFrame(ctx, frameOf(species, 'idle', 0, p.frames.idle, scale)), 2500)
      return () => clearTimeout(timer)
    }
    let mode: 'idle' | Special = cueCount > 0 ? cueClip : 'idle'
    let next: Special = cueClip === 'act' ? 'habit' : 'act'
    let time = 0, calm = 0, shown = ''
    drawFrame(ctx, frameOf(species, mode, 0, p.frames[mode], scale))
    return onTick(dt => {
      time += Math.min(dt, .1)
      if (mode !== 'idle' && time >= clipSeconds(p, mode)) { mode = 'idle'; time = 0; calm = 0 }
      if (mode === 'idle' && (calm += Math.min(dt, .1)) > ACT_EVERY) {
        mode = next
        next = next === 'act' ? 'habit' : 'act'
        time = 0
      }
      const count = p.frames[mode]
      const index = mode !== 'idle' ? Math.min(count - 1, Math.floor((time / clipSeconds(p, mode)) * count)) : Math.floor(time * p.fps.idle) % count
      const key = `${mode}${index}`
      if (key === shown) return
      const frame = readyFrame(species, mode, index, count, scale)
      if (!frame) return
      shown = key
      drawFrame(ctx, frame)
    })
  }, [species, live, reduced, cueClip, cueCount, canvas, scale])

  return <span ref={box} className={`${styles.pixelBox} ${className ?? ''}`}>
    <canvas ref={canvas} width={SPRITE_W * scale} height={SPRITE_H * scale} aria-hidden="true" />
  </span>
}
