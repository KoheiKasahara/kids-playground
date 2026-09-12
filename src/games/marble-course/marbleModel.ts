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
/** The mouth sits above the bowl rim, so a circling ball can never meet the piece it came in on. */
export const FUNNEL_LIFT = 0.9
export const FUNNEL_INLET_Z = -1.4
export const FUNNEL_DROP = 1.55
export const SEESAW_ANGLE = 0.1
export const SEESAW_PIVOT = 0.12
export const SPINNER_ANGLE = Math.PI / 4
export const SPINNER_DROP = 0.45
export const MAX_PARTS = 36
export const BALL_RADIUS = 0.27
export const MIN_HEIGHT = 0.5
export const MAX_HEIGHT = 14
export const BOARD_LIMIT = 28
/** New pieces start high enough that several drops still fit above the floor. */
export const BUILD_HEIGHT = 5.4
/** Small hands aim roughly, so a mouth within half a piece still clicks together. */
export const SNAP_RADIUS = 2.4

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
  const mouth = part.kind === 'slope' ? 1.6 : part.kind === 'funnel' ? FUNNEL_LIFT : 0
  const ends: Connector[] = [{ position: { x: -length, y: mouth, z: part.kind === 'funnel' ? FUNNEL_INLET_Z : 0 }, direction: { x: -1, y: 0, z: 0 } }]
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

function insideBoard(part: MarblePart): boolean {
  const size = footprint(part)
  return Math.abs(part.position.x) + size.x <= BOARD_LIMIT && Math.abs(part.position.z) + size.z <= BOARD_LIMIT
}

function insideHeights(part: MarblePart): boolean {
  return connectors(part).every(end => end.position.y >= MIN_HEIGHT - 1e-6 && end.position.y <= MAX_HEIGHT + 1e-6)
}

export function canPlace(part: MarblePart): boolean {
  return insideBoard(part) && insideHeights(part)
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

/**
 * Height is inherited only from a connector; dragging itself always stays on a horizontal plane.
 * `turn` lets a piece that has no chosen heading yet — one still coming out of the palette —
 * pick the heading that fits, so a rough drop alone is enough to join a course.
 */
export function snapPart(part: MarblePart, parts: readonly MarblePart[], options: { radius?: number; turn?: boolean } = {}): { part: MarblePart; snapped: boolean } {
  const headings = options.turn ? [0, 1, 2, 3].map(step => (part.rotation + step) % 4) : [part.rotation]
  let best: MarblePart | undefined
  let bestDistance = options.radius ?? SNAP_RADIUS
  for (const target of openConnectors(parts, part.id)) {
    for (const rotation of headings) {
      const turned = { ...part, rotation }
      for (const end of connectors(turned)) {
        if (!opposite(end.direction, target.direction)) continue
        // The gap the piece has to cross to click on: a rough drop nearby still joins.
        const d = Math.hypot(end.position.x - target.position.x, end.position.z - target.position.z)
        const position = {
          x: turned.position.x + target.position.x - end.position.x,
          y: turned.position.y + target.position.y - end.position.y,
          z: turned.position.z + target.position.z - end.position.z,
        }
        if (d < bestDistance && canPlace({ ...turned, position })) {
          best = { ...turned, position }
          bestDistance = d
        }
      }
    }
  }
  return { part: best ?? part, snapped: Boolean(best) }
}

export function createPart(kind: PartKind, id: string, position: Vec3 = { x: 0, y: BUILD_HEIGHT, z: 0 }): MarblePart {
  return kind === 'spinner' ? { id, kind, position, rotation: 0, settings: { speed: 'slow', reverse: false } } : { id, kind, position, rotation: 0 }
}

/** The mouth a tap continues from: the selected piece's own exit, otherwise the newest open one. */
function joinTarget(course: Course, selectedId: string | null): Connector | undefined {
  const selected = course.parts.find(item => item.id === selectedId)
  const ends = openConnectors(course.parts)
  const preferred = selected ? connectors(selected).slice(1).find(end => ends.some(open => distance(open.position, end.position) < 0.01)) : undefined
  return preferred ?? ends.at(-1)
}

/** Every heading that would meet the mouth, before board limits decide which of them fit. */
function joinPoses(part: MarblePart, target: Connector): MarblePart[] {
  const poses: MarblePart[] = []
  for (let rotation = 0; rotation < 4; rotation++) {
    const candidate = { ...part, rotation }
    const input = connectors(candidate)[0]!
    if (!opposite(input.direction, target.direction)) continue
    poses.push({ ...candidate, position: {
      x: candidate.position.x + target.position.x - input.position.x,
      y: candidate.position.y + target.position.y - input.position.y,
      z: candidate.position.z + target.position.z - input.position.z,
    } })
  }
  return poses
}

/**
 * The board has a floor but plenty of sky, so a piece whose drop would sink under the floor
 * takes the whole course up with it instead of refusing to join. Every piece keeps its place
 * relative to the others, so nothing that was connected comes apart.
 */
function liftToFit(course: Course, addition: MarblePart): MarblePart[] | null {
  const lift = MIN_HEIGHT - Math.min(...connectors(addition).map(end => end.position.y))
  if (lift <= 0) return null
  const raise = (part: MarblePart): MarblePart => ({ ...part, position: { ...part.position, y: part.position.y + lift } })
  const parts = [...course.parts.map(raise), raise(addition)]
  return parts.every(canPlace) ? parts : null
}

/** A piece fits the open mouth, but not even lifting the course keeps it on the board. */
export function needsMoreHeight(course: Course, kind: PartKind, selectedId: string | null): boolean {
  const target = joinTarget(course, selectedId)
  if (!target) return false
  const poses = joinPoses(createPart(kind, 'probe'), target)
  return poses.length > 0 && poses.every(pose => insideBoard(pose) && !insideHeights(pose) && !liftToFit(course, pose))
}

/** A palette tap also connects a piece, so building is possible without precision dragging. */
export function appendPart(course: Course, kind: PartKind, id: string, selectedId: string | null): Course {
  if (course.parts.length >= MAX_PARTS) return course
  const part = createPart(kind, id)
  const target = joinTarget(course, selectedId)
  const poses = target ? joinPoses(part, target) : []
  let placed = poses.filter(canPlace).at(-1) ?? part
  if (placed === part) {
    for (const pose of poses.filter(insideBoard)) {
      const lifted = liftToFit(course, pose)
      if (lifted) return { parts: lifted, startId: course.startId ?? (kind === 'goal' ? null : id) }
    }
  }
  if (placed === part && course.parts.length) {
    // Preview a clear alternative, even for a closed course. Never pile rejected taps at the origin.
    const candidates: MarblePart[] = []
    const size = footprint(part)
    const span = Math.floor((BOARD_LIMIT - 4) / 6) * 6
    for (let x = -span; x <= span; x += 6) for (let z = -span; z <= span; z += 6) candidates.push({ ...part, position: { x, y: BUILD_HEIGHT, z } })
    const clear = candidates.filter(candidate => canPlace(candidate) && course.parts.every(other => {
      const otherSize = footprint(other)
      return Math.abs(other.position.x - candidate.position.x) >= size.x + otherSize.x - 0.01 || Math.abs(other.position.z - candidate.position.z) >= size.z + otherSize.z - 0.01
    })).sort((a, b) => distance(a.position, target?.position ?? part.position) - distance(b.position, target?.position ?? part.position))[0]
    if (!clear) return course
    placed = clear
  }
  return { parts: [...course.parts, placed], startId: course.startId ?? (kind === 'goal' ? null : id) }
}

/** Removing one piece keeps the rest of the course, and hands the flag to a piece that can still roll. */
export function removePart(course: Course, id: string | null): Course {
  if (!id || !course.parts.some(part => part.id === id)) return course
  const parts = course.parts.filter(part => part.id !== id)
  return { parts, startId: course.startId === id ? parts.find(part => part.kind !== 'goal')?.id ?? null : course.startId }
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
