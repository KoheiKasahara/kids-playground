import { STAMP_SCALE, type Paper, type Pattern } from './rollerData'
import type { Stamp } from './rollerStroke'

const paths = new Map<string, Path2D>()
function path(value: string) {
  let cached = paths.get(value)
  if (!cached) { cached = new Path2D(value); paths.set(value, cached) }
  return cached
}

export function drawStamps(ctx: CanvasRenderingContext2D, stamps: Stamp[], pattern: Pattern, color: string) {
  for (const stamp of stamps) {
    ctx.save()
    ctx.translate(stamp.x, stamp.y)
    // Motifs point up in their source artwork; turn that axis toward travel.
    ctx.rotate(stamp.angle + (pattern.id === 'stripe' ? 0 : Math.PI / 2))
    ctx.scale(STAMP_SCALE, STAMP_SCALE)
    ctx.fillStyle = color
    ctx.fill(path(pattern.path))
    if (pattern.detail) {
      ctx.fillStyle = '#ffffff99'
      ctx.fill(path(pattern.detail))
    }
    ctx.restore()
  }
}

export function drawPaper(ctx: CanvasRenderingContext2D, paper: Paper) {
  const { width, height } = ctx.canvas
  ctx.fillStyle = paper.color
  ctx.fillRect(0, 0, width, height)
  if (paper.id === 'plain') return
  ctx.save()
  ctx.fillStyle = paper.id === 'night' ? '#ffffff50' : '#ffffffaa'
  for (let y = 45; y < height; y += 115) {
    for (let x = 45 + (Math.floor(y / 115) % 2) * 50; x < width; x += 140) {
      ctx.beginPath()
      if (paper.id === 'sky') {
        ctx.ellipse(x, y, 27, 10, 0, 0, Math.PI * 2)
        ctx.ellipse(x - 7, y - 7, 12, 12, 0, 0, Math.PI * 2)
        ctx.ellipse(x + 8, y - 10, 13, 13, 0, 0, Math.PI * 2)
      } else if (paper.id === 'meadow') {
        ctx.ellipse(x, y, 3, 8, -0.5, 0, Math.PI * 2)
        ctx.ellipse(x + 7, y, 3, 8, 0.5, 0, Math.PI * 2)
      } else {
        ctx.moveTo(x, y - 6); ctx.lineTo(x + 2, y - 2); ctx.lineTo(x + 6, y)
        ctx.lineTo(x + 2, y + 2); ctx.lineTo(x, y + 6); ctx.lineTo(x - 2, y + 2)
        ctx.lineTo(x - 6, y); ctx.lineTo(x - 2, y - 2); ctx.closePath()
      }
      ctx.fill()
    }
  }
  ctx.restore()
}
