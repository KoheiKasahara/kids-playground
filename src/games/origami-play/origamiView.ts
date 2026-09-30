import { bounds, centroid, type Bounds, type Point } from './origamiEngine'
import { origamiSequence, type OrigamiId } from './origamiTemplates'

type View = { scale: number; x: number; y: number }

/** Where the paper may sit inside the 400×360 board, leaving room for the desk label. */
const AREA = { x: 44, y: 28, width: 312, height: 272 }
const MAX_SCALE = 2.1
/** Decorations drawn past the paper edge on the finished model. */
const FINISH_EXTRA: Partial<Record<OrigamiId, Bounds>> = {
  tulip: { minX: -60, minY: -140, maxX: 60, maxY: 150 },
  boat: { minX: -120, minY: -100, maxX: 120, maxY: 58 },
}

function merge(a: Bounds, b: Bounds): Bounds {
  return { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) }
}

function fit(box: Bounds): View {
  const scale = Math.min(AREA.width / (box.maxX - box.minX), AREA.height / (box.maxY - box.minY), MAX_SCALE)
  return {
    scale,
    x: AREA.x + AREA.width / 2 - scale * (box.minX + box.maxX) / 2,
    y: AREA.y + AREA.height / 2 - scale * (box.minY + box.maxY) / 2,
  }
}

/** Frame both the paper and the shape it is about to become, so the guide and the fold stay on the desk. */
export function paperView(templateId: OrigamiId, step: number): View {
  const { states } = origamiSequence(templateId)
  let box = bounds(states[step]!)
  if (step + 1 < states.length) box = merge(box, bounds(states[step + 1]!))
  const extra = FINISH_EXTRA[templateId]
  if (step === states.length - 1 && extra) box = merge(box, extra)
  return fit(box)
}

/** The spot (in board coordinates) a child should tap for the next fold. */
export function foldHint(templateId: OrigamiId, step: number): { x: number; y: number } {
  const { states, frames } = origamiSequence(templateId)
  const frame = frames[step]
  const view = paperView(templateId, step)
  let point: Point
  if (!frame || frame.type === 'flip') {
    const box = bounds(states[step]!)
    point = [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2]
  } else if (frame.type === 'reshape') {
    point = centroid(states[step]!.filter((face) => frame.removed.has(face.id)))
  } else {
    point = centroid(frame.before.filter((face) => frame.moving.has(face.id)))
  }
  return { x: view.x + point[0] * view.scale, y: view.y + point[1] * view.scale }
}
