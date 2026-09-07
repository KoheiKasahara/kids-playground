export type Point = { x: number; y: number }
export type Stamp = Point & { angle: number }
export type StrokeCursor = { point: Point; remaining: number; started: boolean }

export function startStroke(point: Point): StrokeCursor {
  return { point, remaining: 0, started: false }
}

/** Carry arc-length remainder between events: event frequency never changes density.
 * The first mark waits for movement so it also faces the actual travel direction.
 */
export function advanceStroke(cursor: StrokeCursor, point: Point, spacing: number): Stamp[] {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(spacing) || spacing <= 0) return []
  const dx = point.x - cursor.point.x
  const dy = point.y - cursor.point.y
  const distance = Math.hypot(dx, dy)
  if (distance < 0.00001) return []
  const angle = Math.atan2(dy, dx)
  const stamps: Stamp[] = []
  let offset = cursor.remaining
  while (offset <= distance) {
    stamps.push({ x: cursor.point.x + dx * offset / distance, y: cursor.point.y + dy * offset / distance, angle })
    offset += spacing
  }
  cursor.point = point
  cursor.remaining = offset - distance
  cursor.started = true
  return stamps
}

export function finishStroke(cursor: StrokeCursor): Stamp[] {
  return cursor.started ? [] : [{ ...cursor.point, angle: 0 }]
}
