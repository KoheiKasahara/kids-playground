export type Point = { x: number; y: number }

// Reused from the former falling drawing toy (Ramer–Douglas–Peucker).
export function simplify(points: Point[]): Point[] {
  if (points.length <= 2) return points
  const first = points[0], last = points.at(-1)!
  const dx = last.x - first.x, dy = last.y - first.y
  let furthest = 0, distance = 3
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    const t = Math.max(0, Math.min(1, ((p.x - first.x) * dx + (p.y - first.y) * dy) / (dx * dx + dy * dy || 1)))
    const d = Math.hypot(p.x - first.x - t * dx, p.y - first.y - t * dy)
    if (d > distance) { distance = d; furthest = i }
  }
  if (!furthest) return [first, last]
  return [...simplify(points.slice(0, furthest + 1)).slice(0, -1), ...simplify(points.slice(furthest))]
}

