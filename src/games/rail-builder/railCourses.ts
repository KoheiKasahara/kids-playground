import { connectRailPieces, createRailPiece, worldConnectorForRailPiece, type RailPiece, type RailPieceKind } from './railModel'

type RailCourse = { id: string; label: string; parts: readonly RailPieceKind[] }
const corners: RailPieceKind[] = ['curve', 'curve']
function oval(side: RailPieceKind[], opposite: RailPieceKind[] = side): RailPieceKind[] {
  return [...side, ...corners, ...opposite, ...corners]
}
export const RAIL_COURSES: readonly RailCourse[] = [
  { id: 'circle', label: 'まんまる', parts: ['curve', 'curve', 'curve', 'curve'] },
  { id: 'oval', label: 'ながい まる', parts: oval(['straight', 'straight']) },
  { id: 'station', label: 'えきの まち', parts: oval(['station'], ['straight', 'straight']) },
  { id: 'tunnel', label: 'トンネル たんけん', parts: oval(['tunnel', 'tunnel', 'straight']) },
  { id: 'crossings', label: 'ふみきり めぐり', parts: oval(['crossing', 'straight', 'crossing']) },
  { id: 'bridge', label: 'はしを わたろう', parts: oval(['slope', 'bridge', 'down-slope'], ['long-straight', 'long-straight', 'straight']) },
  { id: 'wide', label: 'おおきな まる', parts: ['wide-curve', 'wide-curve', 'wide-curve', 'wide-curve'] },
  { id: 'gentle', label: 'こまかい カーブ', parts: Array<RailPieceKind>(8).fill('gentle-curve') },
  { id: 'square', label: 'しかくい たび', parts: Array.from({ length: 4 }, (): RailPieceKind[] => ['long-straight', 'curve']).flat() },
  { id: 'tour', label: 'ぐるっと だいぼうけん', parts: oval(['station', 'crossing', 'slope', 'bridge', 'down-slope', 'tunnel'], ['long-straight', 'tunnel', 'station', 'crossing', 'long-straight', 'crossing']) },
]

/** Each load owns its IDs so replacing a course also resets cached meshes and train cursors. */
export function createRailCourse(id: string, prefix: string): RailPiece[] {
  const course = RAIL_COURSES.find((candidate) => candidate.id === id)
  if (course === undefined) return []
  let pieces: RailPiece[] = []
  for (const kind of course.parts) {
    const piece = createRailPiece(kind, prefix + '-' + pieces.length)
    const previous = pieces.at(-1)
    pieces.push(piece)
    if (previous !== undefined) pieces = connectRailPieces(pieces, piece.id, 'a', previous.id, 'b')
  }
  const first = pieces[0]!
  const last = pieces.at(-1)!
  const start = worldConnectorForRailPiece(first, 'a').position
  const end = worldConnectorForRailPiece(last, 'b').position
  if (Math.hypot(start.x - end.x, start.y - end.y, start.z - end.z) > 1e-6) {
    throw new Error('Course must close: ' + id)
  }
  pieces = connectRailPieces(pieces, last.id, 'b', first.id, 'a', { position: last.position, rotationY: last.rotationY })
  const points = pieces.flatMap((piece) => (['a', 'b'] as const).map((connector) => worldConnectorForRailPiece(piece, connector).position))
  const centerX = (Math.min(...points.map((p) => p.x)) + Math.max(...points.map((p) => p.x))) / 2
  const centerZ = (Math.min(...points.map((p) => p.z)) + Math.max(...points.map((p) => p.z))) / 2
  return pieces.map((piece) => ({ ...piece, position: { ...piece.position, x: piece.position.x - centerX, z: piece.position.z - centerZ } }))
}

/** Fit within the short screen edge, leaving room for controls and facility roofs. */
export function railCourseZoom(pieces: readonly RailPiece[], baseViewSize: number): number {
  if (pieces.length === 0) return 1
  const points = pieces.flatMap((piece) => (['a', 'b'] as const).map((id) => worldConnectorForRailPiece(piece, id).position))
  const width = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))
  const depth = Math.max(...points.map((p) => p.z)) - Math.min(...points.map((p) => p.z))
  return Math.min(0.8, baseViewSize / (Math.hypot(width, depth) + 12))
}
