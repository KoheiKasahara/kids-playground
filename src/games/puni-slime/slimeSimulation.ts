/** Small deterministic soft body. One step is 1/60 second; no DOM or renderer dependency. */
export const WIDTH = 600
export const HEIGHT = 500
export const FLOOR = 456
const COUNT = 48
const RX = 145
const RY = 112
export type Point = { x: number; y: number }
export type Particle = Point & { px: number; py: number }
export type Slime = { points: Particle[] }
export type Grab = { index: number; target: Point; offset: Point }
export type Feel = 'soft' | 'bouncy'
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const rest = Array.from({ length: COUNT }, (_, i) => ({ x: Math.cos(i * Math.PI * 2 / COUNT) * RX, y: Math.sin(i * Math.PI * 2 / COUNT) * RY }))
const links = rest.flatMap((p, i) => [1, 3].map((gap) => {
  const j = (i + gap) % COUNT
  return { i, j, length: Math.hypot(p.x - rest[j].x, p.y - rest[j].y) }
}))
export function createSlime(): Slime {
  return { points: rest.map((p) => ({ x: p.x + 300, y: p.y + 265, px: p.x + 300, py: p.y + 265 })) }
}
export function center(slime: Slime): Point {
  return slime.points.reduce((c, p) => ({ x: c.x + p.x / COUNT, y: c.y + p.y / COUNT }), { x: 0, y: 0 })
}
export function area(slime: Slime): number {
  return slime.points.reduce((sum, p, i) => {
    const q = slime.points[(i + 1) % COUNT]
    return sum + p.x * q.y - q.x * p.y
  }, 0) / 2
}
const REST_AREA = area(createSlime())
export function beginGrab(slime: Slime, target: Point, occupied: readonly Grab[] = []): Grab | null {
  // Polygon hit-test, with a forgiving 28-unit rim for small fingers.
  let inside = false
  let nearest = -1
  let distance = Infinity
  for (let i = 0, j = COUNT - 1; i < COUNT; j = i++) {
    const p = slime.points[i], q = slime.points[j]
    if ((p.y > target.y) !== (q.y > target.y) && target.x < (q.x - p.x) * (target.y - p.y) / (q.y - p.y) + p.x) inside = !inside
    const d = Math.hypot(p.x - target.x, p.y - target.y)
    if (d < distance && !occupied.some((g) => Math.min(Math.abs(g.index - i), COUNT - Math.abs(g.index - i)) < 5)) { nearest = i; distance = d }
  }
  if (nearest < 0 || (!inside && distance > 28)) return null
  const p = slime.points[nearest]
  return { index: nearest, target: { ...target }, offset: { x: p.x - target.x, y: p.y - target.y } }
}
export function stepSlime(slime: Slime, grabs: readonly Grab[] = [], feel: Feel = 'soft'): void {
  const c = center(slime)
  const spring = feel === 'soft' ? 0.004 : 0.013
  for (let i = 0; i < COUNT; i++) {
    const p = slime.points[i]
    const vx = clamp((p.x - p.px) * 0.985, -18, 18)
    const vy = clamp((p.y - p.py) * 0.985, -18, 18)
    p.px = p.x; p.py = p.y
    p.x += vx + (c.x + rest[i].x - p.x) * spring
    p.y += vy + 0.38 + (c.y + rest[i].y - p.y) * spring
  }
  for (let pass = 0; pass < 5; pass++) {
    for (const link of links) {
      const a = slime.points[link.i], b = slime.points[link.j]
      const dx = b.x - a.x, dy = b.y - a.y
      const length = Math.hypot(dx, dy) || 1
      const correction = (length - link.length) / length * 0.16
      a.x += dx * correction; a.y += dy * correction
      b.x -= dx * correction; b.y -= dy * correction
    }
    // Area preservation gives the squish its sideways bulge. Cap corrections during extreme drags.
    const gradients = slime.points.map((_, i) => {
      const prev = slime.points[(i + COUNT - 1) % COUNT], next = slime.points[(i + 1) % COUNT]
      return { x: (next.y - prev.y) / 2, y: (prev.x - next.x) / 2 }
    })
    const norm = gradients.reduce((n, g) => n + g.x * g.x + g.y * g.y, 0)
    const pressure = clamp((REST_AREA - area(slime)) / Math.max(norm, 1), -0.12, 0.12)
    slime.points.forEach((p, i) => { p.x += gradients[i].x * pressure; p.y += gradients[i].y * pressure })
    for (const grab of grabs) {
      const p = slime.points[grab.index]
      p.x += (clamp(grab.target.x + grab.offset.x, 16, WIDTH - 16) - p.x) * 0.3
      p.y += (clamp(grab.target.y + grab.offset.y, 16, FLOOR) - p.y) * 0.3
    }
    for (const p of slime.points) {
      if (p.y > FLOOR) { p.y = FLOOR; p.py = FLOOR + Math.max(0, p.y - p.py) * 0.18; p.px += (p.x - p.px) * 0.12 }
      p.x = clamp(p.x, 12, WIDTH - 12)
      p.y = Math.max(12, p.y)
    }
  }
}
/** A brief tap also leaves a visible ripple, even if the finger never moves. */
export function poke(slime: Slime, index: number): void {
  for (let offset = -5; offset <= 5; offset++) {
    const p = slime.points[(index + offset + COUNT) % COUNT]
    p.py -= (1 - Math.abs(offset) / 6) * 5
  }
}
export function squish(slime: Slime): void {
  const c = center(slime)
  for (const p of slime.points) {
    // Change position and velocity together: visible flattening, followed by an elastic recovery.
    p.x = clamp(c.x + (p.x - c.x) * 1.2, 12, WIDTH - 12)
    p.y = clamp(c.y + (p.y - c.y) * 0.62 + 20, 12, FLOOR)
    p.px = p.x; p.py = p.y - 2
  }
}
export function lift(slime: Slime): void {
  const c = center(slime)
  const top = Math.min(...slime.points.map((p) => p.y))
  const shift = Math.max(12 - top, Math.min(-80, 175 - c.y))
  for (const p of slime.points) { p.y += shift; p.py = p.y + 3; p.px = p.x }
}
export function outline(slime: Slime): string {
  const points = slime.points
  const mid = (a: Point, b: Point) => `${((a.x + b.x) / 2).toFixed(1)},${((a.y + b.y) / 2).toFixed(1)}`
  return `M${mid(points[COUNT - 1], points[0])} ` + points.map((p, i) => `Q${p.x.toFixed(1)},${p.y.toFixed(1)} ${mid(p, points[(i + 1) % COUNT])}`).join(' ') + 'Z'
}
