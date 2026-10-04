import { useEffect, useRef } from 'react'
import type { Img } from './pixel'

/** ドット絵を そのまま 大きく うつす ちいさな canvas。 */
export default function PixelIcon({ make, className }: { make: () => Img | null; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const img = make()
    const ctx = canvas?.getContext('2d')
    if (!canvas || !img || !ctx) return
    canvas.width = img.width
    canvas.height = img.height
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, img.width, img.height)
    ctx.drawImage(img, 0, 0)
  }, [make])
  return <canvas ref={ref} className={className} aria-hidden="true" />
}
