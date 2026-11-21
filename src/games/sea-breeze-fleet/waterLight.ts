import { type Chart } from './charts'
import { createRippleField, waterCols, waterRows } from './rippleField'
import type { Voyage } from './voyage'

export function createWaterLight(chart: Chart) {
  const field = createRippleField(chart)
  const layer = document.createElement('canvas')
  layer.width = waterCols
  layer.height = waterRows
  const ctx = layer.getContext('2d')!
  const image = ctx.createImageData(waterCols, waterRows)
  const light = chart.kind === 'flagship' ? [255, 219, 166] : [202, 241, 229]
  const seen = new WeakSet<object>()
  let wakeClock = 0
  let beat = 0

  return (v: Voyage, dt: number) => {
    for (const shot of v.shots) {
      if (seen.has(shot)) continue
      seen.add(shot)
      field.disturb(shot.start.x, shot.start.y, 5.5, 11)
    }
    for (const b of v.bursts) {
      if (seen.has(b)) continue
      seen.add(b)
      field.disturb(b.x, b.y, b.type === 'stars' ? 17 : 12, b.type === 'stars' ? 16 : 12)
    }
    wakeClock += dt
    if (wakeClock >= 0.21) {
      wakeClock %= 0.21
      beat++
      for (const s of [v.player, ...v.pirates, ...(v.mail ? [v.mail] : [])]) {
        if (!s.hp) continue
        const dx = Math.cos(s.heading), dy = Math.sin(s.heading)
        if (s.speed > 0.15) {
          // Two shoulders at the bow and a trough astern form a moving wake.
          for (const side of [-1, 1]) {
            field.disturb(s.x + 24 * dx - side * 7 * dy, s.y + 24 * dy + side * 7 * dx, 0.85 * s.speed, 8)
          }
          field.disturb(s.x - 29 * dx, s.y - 29 * dy, -1.25 * s.speed, 10)
        } else if (beat % 7 === 0) {
          field.disturb(s.x - 17 * dx, s.y - 17 * dy, 1.8, 10)
        }
      }
    }
    const heights = field.advance(dt)
    const data = image.data
    for (let i = waterCols + 1; i < heights.length - waterCols - 1; i++) {
      if (!field.open[i]) continue
      const slopeX = heights[i - 1] - heights[i + 1]
      const slopeY = heights[i - waterCols] - heights[i + waterCols]
      const slope = slopeY * 0.66 + slopeX * 0.34
      const k = i * 4
      const face = slope > 0
      data[k] = face ? light[0] : 10
      data[k + 1] = face ? light[1] : 38
      data[k + 2] = face ? light[2] : 55
      data[k + 3] = Math.min(face ? 150 : 128, Math.abs(slope) * (face ? 40 : 51))
    }
    ctx.putImageData(image, 0, 0)
    return layer
  }
}
