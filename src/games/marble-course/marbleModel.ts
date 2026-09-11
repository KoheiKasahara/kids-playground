export type Vec3 = { x: number; y: number; z: number }
export type GadgetKind = 'jump' | 'spinner' | 'funnel' | 'booster' | 'seesaw'
export type PartKind = 'straight' | 'slope' | 'curve' | 'branch' | 'goal' | GadgetKind
export type SpinnerSettings = { speed: 'slow' | 'fast'; reverse: boolean }
export type MarblePart = { id: string; position: Vec3; rotation: number } & (
  { kind: 'spinner'; settings: SpinnerSettings } | { kind: Exclude<PartKind, 'spinner'> }
)
export type Course = { parts: MarblePart[]; startId: string | null }
export type Connector = { position: Vec3; direction: Vec3 }

export const PARTS: { kind: PartKind; label: string; color: string }[] = [
  { kind: 'straight', label: 'まっすぐ', color: '#39b9cb' },
  { kind: 'slope', label: 'さかみち', color: '#f5b74a' },
  { kind: 'curve', label: 'カーブ', color: '#9c80df' },
  { kind: 'branch', label: 'ぶんき', color: '#ee8caa' },
  { kind: 'goal', label: 'ゴール', color: '#64bc8a' },
  { kind: 'jump', label: 'ジャンプ', color: '#ee9850' },
  { kind: 'spinner', label: 'くるくる', color: '#dd799e' },
  { kind: 'funnel', label: 'ぐるぐる', color: '#9480d7' },
  { kind: 'booster', label: 'びゅーん', color: '#37afbb' },
  { kind: 'seesaw', label: 'ぎったん', color: '#82b459' },
]
export const GADGET_HINTS: Record<GadgetKind, string> = {
  jump: 'さかみちの つぎに つないで とぼう！',
  spinner: 'はやさや まわりかたを かえてみよう！',
  funnel: 'ぐるぐる まわって したの みちへ！',
  booster: 'やじるしに のると びゅーん！',
  seesaw: 'ビーだまが のると ぎったん！',
}
export const isGadget = (kind: PartKind): kind is GadgetKind => kind in GADGET_HINTS
export const FUNNEL_DROP = 1.65
export const SEESAW_ANGLE = 0.1
export const SEESAW_PIVOT = 0.12
export const SPINNER_ANGLE = Math.PI / 4
export const SPINNER_DROP = 0.45
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
  const length = isGadget(part.kind) && part.kind !== 'booster' ? 3 : 2
  const ends: Connector[] = [{ position: { x: -length, y: part.kind === 'slope' ? 1.6 : 0, z: part.kind === 'funnel' ? -1.4 : 0 }, direction: { x: -1, y: 0, z: 0 } }]
  if (part.kind === 'curve') ends.push({ position: { x: 0, y: 0, z: 2 }, direction: { x: 0, y: 0, z: 1 } })
  else if (part.kind === 'branch') {
    for (const z of [-2, 2]) ends.push({ position: { x: 2, y: 0, z }, direction: { x: 1, y: 0, z: 0 } })
  } else if (part.kind !== 'goal') ends.push({ position: { x: length, y: part.kind === 'funnel' ? -FUNNEL_DROP : part.kind === 'spinner' ? -SPINNER_DROP : 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } })
  return ends.map(end => ({ position: toWorld(part, end.position), direction: rotate(end.direction, part.rotation) }))
}

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const opposite = (a: Vec3, b: Vec3) => a.x * b.x + a.z * b.z < -0.99

function footprint(part: MarblePart): { x: number; z: number } {
  const halfLength = isGadget(part.kind) && part.kind !== 'booster' ? 3 : 2
  const halfWidth = part.kind === 'funnel' ? 2.5 : part.kind === 'spinner' ? 2.3 : part.kind === 'jump' ? 1.32 : part.kind === 'seesaw' ? 1.1 : part.kind === 'branch' || part.kind === 'curve' ? 2.82 : part.kind === 'goal' ? 1.46 : 0.82
  return part.rotation % 2 === 0 ? { x: halfLength, z: halfWidth } : { x: halfWidth, z: halfLength }
}

export function canPlace(part: MarblePart): boolean {
  const size = footprint(part)
  const insideBoard = Math.abs(part.position.x) + size.x <= BOARD_LIMIT && Math.abs(part.position.z) + size.z <= BOARD_LIMIT
  return insideBoard && connectors(part).every(end => end.position.y >= MIN_HEIGHT - 1e-6 && end.position.y <= MAX_HEIGHT + 1e-6)
}

/** A loose placement stays available for experiments, but never silently changes a connector height. */
export function hasConnectedInput(part: MarblePart, parts: readonly MarblePart[]): boolean {
  const input = connectors(part)[0]!
  return parts.some(other => other.id !== part.id && connectors(other).slice(1).some(end => distance(input.position, end.position) < 0.08 && opposite(input.direction, end.direction)))
}

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
      if (d < bestDistance && canPlace({ ...part, position })) {
        best = { ...part, position }
        bestDistance = d
      }
    }
  }
  return { part: best ?? part, snapped: Boolean(best) }
}

export function createPart(kind: PartKind, id: string, position: Vec3 = { x: 0, y: 2.4, z: 0 }): MarblePart {
  return kind === 'spinner' ? { id, kind, position, rotation: 0, settings: { speed: 'slow', reverse: false } } : { id, kind, position, rotation: 0 }
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
      if (canPlace({ ...candidate, position })) placed = { ...candidate, position }
    }
  }
  if (placed === part && course.parts.length) {
    // Preview a clear alternative, even for a closed course. Never pile rejected taps at the origin.
    const candidates: MarblePart[] = []
    const size = footprint(part)
    for (let x = -18; x <= 18; x += 6) for (let z = -18; z <= 18; z += 6) candidates.push({ ...part, position: { x, y: 2.4, z } })
    const clear = candidates.filter(candidate => canPlace(candidate) && course.parts.every(other => {
      const otherSize = footprint(other)
      return Math.abs(other.position.x - candidate.position.x) >= size.x + otherSize.x - 0.01 || Math.abs(other.position.z - candidate.position.z) >= size.z + otherSize.z - 0.01
    })).sort((a, b) => distance(a.position, target?.position ?? part.position) - distance(b.position, target?.position ?? part.position))[0]
    if (!clear) return course
    placed = clear
  }
  return { parts: [...course.parts, placed], startId: course.startId ?? (kind === 'goal' ? null : id) }
}

export function launchPose(course: Course, offset = 0): { position: Vec3; velocity: Vec3 } | null {
  const part = course.parts.find(item => item.id === course.startId && item.kind !== 'goal')
  if (!part) return null
  const input = toLocal(part, connectors(part)[0]!.position)
  // A release from the jump itself supplies the momentum otherwise provided by its preceding slope.
  const speed = part.kind === 'jump' ? 4 : 2.5
  return {
    position: toWorld(part, { x: input.x + 0.55, y: (part.kind === 'slope' ? 1.38 : input.y) + BALL_RADIUS + 0.06, z: input.z + offset }),
    velocity: rotate({ x: speed, y: part.kind === 'slope' ? -1 : 0, z: 0 }, part.rotation),
  }
}

export function initialCourse(): Course {
  return { parts: [createPart('slope', 'part-0')], startId: 'part-0' }
}
