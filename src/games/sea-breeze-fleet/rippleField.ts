import { chartHeight, chartWidth, shoreDistance, type Chart } from './charts'

// Heights stay in chart space so a wave keeps travelling in the same direction
// when the screen rotates. Advance at a fixed rate to keep its speed stable.
export const waterCols = 181
export const waterRows = 97
const cells = waterCols * waterRows
const stepTime = 1 / 40
const cellWidth = chartWidth / (waterCols - 1)
const cellHeight = chartHeight / (waterRows - 1)

export function createRippleField(chart: Chart) {
  let height = new Float32Array(cells)
  let previous = new Float32Array(cells)
  const open = new Uint8Array(cells)
  const drag = new Float32Array(cells)
  let remainder = 0
  for (let y = 1; y < waterRows - 1; y++) {
    for (let x = 1; x < waterCols - 1; x++) {
      const i = y * waterCols + x
      const depth = shoreDistance(x * cellWidth, y * cellHeight, chart.islands)
      if (depth <= 0) continue
      open[i] = 1
      const edge = Math.min(x, y, waterCols - 1 - x, waterRows - 1 - y)
      drag[i] = 0.988 - 0.10 * Math.max(0, 1 - edge / 7) - 0.085 * Math.max(0, 1 - depth / 12)
    }
  }

  function disturb(x: number, y: number, amplitude: number, radius: number) {
    const cx = x / cellWidth, cy = y / cellHeight
    const r = radius / cellWidth
    for (let row = Math.max(1, Math.floor(cy - r)); row <= Math.min(waterRows - 2, cy + r); row++) {
      for (let col = Math.max(1, Math.floor(cx - r)); col <= Math.min(waterCols - 2, cx + r); col++) {
        const i = row * waterCols + col
        const d = ((col - cx) ** 2 + (row - cy) ** 2) / (r * r)
        if (!open[i] || d > 1) continue
        // A soft, finite bump avoids a square front even for a point splash.
        const lift = amplitude * (1 - d) ** 2
        height[i] += lift
        previous[i] += lift * 0.65
      }
    }
  }

  function advance(seconds: number) {
    remainder += Math.min(0.10, Math.max(0, seconds))
    while (remainder >= stepTime) {
      remainder -= stepTime
      for (let i = waterCols + 1; i < cells - waterCols - 1; i++) {
        if (!open[i]) continue
        const h = height[i]
        const curvature = height[i - 1] + height[i + 1] + height[i - waterCols] + height[i + waterCols] - 4 * h
        previous[i] = h + (h - previous[i]) * drag[i] + 0.43 * curvature
      }
      const swap = previous
      previous = height
      height = swap
    }
    return height
  }
  return { disturb, advance, open }
}
