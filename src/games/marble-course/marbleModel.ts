export type Vec3 = { x: number; y: number; z: number }
export type PartKind = 'straight' | 'slope' | 'curve' | 'branch' | 'goal'
export type MarblePart = { id: string; kind: PartKind; position: Vec3; rotation: number }
export type Course = { parts: MarblePart[]; startId: string | null }
export type Connector = { position: Vec3; direction: Vec3 }

export const PARTS: { kind: PartKind; label: string; color: string }[] = [
  { kind: 'straight', label: 'まっすぐ', color: '#39b9cb' },
  { kind: 'slope', label: 'さかみち', color: '#f5b74a' },
  { kind: 'curve', label: 'カーブ', color: '#9c80df' },
  { kind: 'branch', label: 'ぶんき', color: '#ee8caa' },
  { kind: 'goal', label: 'ゴール', color: '#64bc8a' },
]
export const MAX_PARTS = 36
export const BALL_RADIUS = 0.27
export const MIN_HEIGHT = 0.7
export const MAX_HEIGHT = 12
export const BOARD_LIMIT = 22

export function rotate(v: Vec3, rotation: number): Vec3 {
  const a = rotation * Math.PI / 2
  return { x: v.x * Math.cos(a) - v.z * Math.sin(a), y: v.y, z: v.x * Math.sin(a) + v.z * Math.cos(a) }
}

export function toWorld(part: MarblePart, point: Vec3): Vec3 {
  const v = rotate(point, part.rotation)
  return { x: v.x + part.position.x, y: v.y + part.position.y, z: v.z + part.position.z }
}

export function toLocal(part: MarblePart, point: Vec3): Vec3 {
  return rotate({ x: point.x - part.position.x, y: point.y - part.position.y, z: point.z - part.position.z }, -part.rotation)
}

export function connectors(part: MarblePart): Connector[] {
  const ends: Connector[] = [{ position: { x: -2, y: part.kind === 'slope' ? 1.6 : 0, z: 0 }, direction: { x: -1, y: 0, z: 0 } }]
  if (part.kind === 'curve') ends.push({ position: { x: 0, y: 0, z: 2 }, direction: { x: 0, y: 0, z: 1 } })
  else if (part.kind === 'branch') {
    for (const z of [-2, 2]) ends.push({ position: { x: 2, y: 0, z }, direction: { x: 1, y: 0, z: 0 } })
  } else if (part.kind !== 'goal') ends.push({ position: { x: 2, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } })
  return ends.map(end => ({ position: toWorld(part, end.position), direction: rotate(end.direction, part.rotation) }))
}

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const opposite = (a: Vec3, b: Vec3) => a.x * b.x + a.z * b.z < -0.99

export function openConnectors(parts: readonly MarblePart[], omitId?: string): Connector[] {
  const others = parts.filter(part => part.id !== omitId)
  return others.flatMap(part => connectors(part).filter(end => !others.some(other => other.id !== part.id && connectors(other).some(candidate => distance(end.position, candidate.position) < 0.08 && opposite(end.direction, candidate.direction)))))
}

/** Height is inherited only from a connector; dragging itself always stays on a horizontal plane. */
export function snapPart(part: MarblePart, parts: readonly MarblePart[], radius = 1.65): { part: MarblePart; snapped: boolean } {
  let best: MarblePart | undefined
  let bestDistance = radius
  for (const target of openConnectors(parts, part.id)) {
    for (const end of connectors(part)) {
      if (!opposite(end.direction, target.direction)) continue
      const d = Math.hypot(end.position.x - target.position.x, end.position.z - target.position.z)
      const position = {
        x: part.position.x + target.position.x - end.position.x,
        y: part.position.y + target.position.y - end.position.y,
        z: part.position.z + target.position.z - end.position.z,
      }
      if (d < bestDistance && position.y >= MIN_HEIGHT && position.y <= MAX_HEIGHT && Math.abs(position.x) <= BOARD_LIMIT && Math.abs(position.z) <= BOARD_LIMIT) {
        best = { ...part, position }
        bestDistance = d
      }
    }
  }
  return { part: best ?? part, snapped: Boolean(best) }
}

export function createPart(kind: PartKind, id: string, position: Vec3 = { x: 0, y: 2.4, z: 0 }): MarblePart {
  return { id, kind, position, rotation: 0 }
}

/** A palette tap also connects a piece, so building is possible without precision dragging. */
export function appendPart(course: Course, kind: PartKind, id: string, selectedId: string | null): Course {
  if (course.parts.length >= MAX_PARTS) return course
  const part = createPart(kind, id)
  const selected = course.parts.find(item => item.id === selectedId)
  const ends = openConnectors(course.parts)
  const preferred = selected ? connectors(selected).slice(1).find(end => ends.some(open => distance(open.position, end.position) < 0.01)) : undefined
  const target = preferred ?? ends.at(-1)
  let placed = part
  if (target) {
    for (let rotation = 0; rotation < 4; rotation++) {
      const candidate = { ...part, rotation }
      const input = connectors(candidate)[0]!
      if (!opposite(input.direction, target.direction)) continue
      const position = { x: target.position.x - input.position.x, y: target.position.y - input.position.y + part.position.y, z: target.position.z - input.position.z }
      if (position.y >= MIN_HEIGHT && position.y <= MAX_HEIGHT && Math.abs(position.x) <= BOARD_LIMIT && Math.abs(position.z) <= BOARD_LIMIT) placed = { ...candidate, position }
    }
    if (placed === part) placed = { ...part, position: { x: Math.max(-BOARD_LIMIT, Math.min(BOARD_LIMIT, target.position.x + 4)), y: 2.4, z: Math.max(-BOARD_LIMIT, Math.min(BOARD_LIMIT, target.position.z + 3)) } }
  }
  return { parts: [...course.parts, placed], startId: course.startId ?? (kind === 'goal' ? null : id) }
}

export function launchPose(course: Course, offset = 0): { position: Vec3; velocity: Vec3 } | null {
  const part = course.parts.find(item => item.id === course.startId && item.kind !== 'goal')
  if (!part) return null
  return {
    position: toWorld(part, { x: -1.45, y: (part.kind === 'slope' ? 1.38 : 0) + BALL_RADIUS + 0.06, z: offset }),
    velocity: rotate({ x: 2.5, y: part.kind === 'slope' ? -1 : 0, z: 0 }, part.rotation),
  }
}

export function initialCourse(): Course {
  return { parts: [createPart('slope', 'part-0')], startId: 'part-0' }
}
