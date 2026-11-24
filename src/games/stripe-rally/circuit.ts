// Centerline in the painted circuit's native 1536 × 1024 coordinates.
// Control points follow the middle of the cobbles, inside the two kerbs.
const bends = [
  [1080, 739, 1285, 758, 1285, 572],
  [1285, 445, 1163, 449, 1061, 380],
  [954, 308, 1010, 182, 817, 169],
  [678, 160, 624, 211, 542, 258],
  [414, 331, 272, 233, 214, 358],
  [165, 463, 233, 511, 347, 559],
  [442, 599, 361, 739, 587, 739],
  [650, 739, 712, 739, 780, 739],
]
export const line = [{ x: 780, y: 739, length: 0 }]
for (const [ax, ay, bx, by, cx, cy] of bends) {
  const start = line[line.length - 1]
  for (let step = 1; step <= 80; step++) {
    const t = step / 80, u = 1 - t
    const x = u ** 3 * start.x + 3 * u * u * t * ax + 3 * u * t * t * bx + t ** 3 * cx
    const y = u ** 3 * start.y + 3 * u * u * t * ay + 3 * u * t * t * by + t ** 3 * cy
    const prev = line[line.length - 1]
    line.push({ x, y, length: prev.length + Math.hypot(x - prev.x, y - prev.y) })
  }
}
export const circuitLength = line[line.length - 1].length

// Interpolated normals keep a car away from the centerline moving smoothly
// across the joins between samples, including the start/finish seam.
const tangents = line.map((_, i) => {
  const count = line.length - 1
  const before = line[(i + count - 1) % count], after = line[(i + 1) % count]
  return Math.atan2(after.y - before.y, after.x - before.x)
})

export function pose(laps: number, offset = 0) {
  const length = (laps - Math.floor(laps)) * circuitLength
  let lo = 0, hi = line.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (line[mid].length <= length) lo = mid
    else hi = mid
  }
  const a = line[lo], b = line[hi]
  const t = (length - a.length) / (b.length - a.length)
  const turn = tangents[hi] - tangents[lo]
  const angle = tangents[lo] + t * Math.atan2(Math.sin(turn), Math.cos(turn))
  return { angle, x: a.x + (b.x - a.x) * t - offset * Math.sin(angle),
    y: a.y + (b.y - a.y) * t + offset * Math.cos(angle) }
}

export const roadLimit = 36

// Pull a closed string taut between cross-sections of the drivable road.
// The shortest detour through each section meets the chord to its neighbours,
// or touches the nearest edge if that chord passes outside the road.
function shortestLine() {
  const sampleCount = 96
  const sections = Array.from({ length: sampleCount }, (_, i) => {
    const center = pose(i / sampleCount)
    return { ...center, nx: -Math.sin(center.angle), ny: Math.cos(center.angle),
      px: center.x, py: center.y, offset: 0 }
  })
  for (let pass = 0; pass < 500; pass++) {
    let largestMove = 0
    sections.forEach((s, i) => {
      const prev = sections[(i + sections.length - 1) % sections.length]
      const next = sections[(i + 1) % sections.length]
      const dx = next.px - prev.px, dy = next.py - prev.py
      const chordOffset = ((prev.px - s.x) * dy - (prev.py - s.y) * dx) / (s.nx * dy - s.ny * dx)
      const offset = Math.max(-roadLimit, Math.min(roadLimit, chordOffset))
      largestMove = Math.max(largestMove, Math.abs(offset - s.offset))
      s.offset = offset
      s.px = s.x + offset * s.nx
      s.py = s.y + offset * s.ny
    })
    if (largestMove < 0.01) break
  }
  return sections.map(s => s.offset)
}

const racingOffsets = shortestLine()

export function racingLine(laps: number) {
  const sample = (laps - Math.floor(laps)) * racingOffsets.length
  const i = Math.floor(sample)
  const from = racingOffsets[i], to = racingOffsets[(i + 1) % racingOffsets.length]
  return from + (to - from) * (sample - i)
}
