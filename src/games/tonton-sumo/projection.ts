import { BOX_HALF, type Point, type Side } from './sumoGame'

export type View = { x: number; y: number; width: number; height: number }

/** The box is seen from the front and a little above. Wide screens show the whole box. */
export const WIDE_VIEW: View = { x: 40, y: 20, width: 640, height: 460 }
/** Tall screens zoom in on the ring and let the box corners run off the sides. */
export const TALL_VIEW: View = { x: 130, y: 80, width: 460, height: 400 }
export const CENTER = { x: 360, y: 285 } as const
/** Screen pixels per ring radius, across and in depth. */
export const RING_PX = 205
export const DEPTH_PX = 112
/** Farther things are drawn a little smaller. */
const PERSPECTIVE = 0.1
/** A wrestler sheet shown at this size in the scene; only its folded half (80 px) faces the viewer. */
export const FIGURE_SCALE = 1.2

export const perspective = (z: number) => 1 - PERSPECTIVE * z

export function project(x: number, z: number) {
  return { x: CENTER.x + x * RING_PX * perspective(z), y: CENTER.y - z * DEPTH_PX }
}

/** Converts a point in SVG units back to the box top. Points off the box land on its rim. */
export function unproject(x: number, y: number): Point {
  const z = Math.max(-BOX_HALF.z, Math.min(BOX_HALF.z, (CENTER.y - y) / DEPTH_PX))
  return { x: (x - CENTER.x) / (RING_PX * perspective(z)), z }
}

/** Maps a pointer position to SVG units for an SVG drawn with preserveAspectRatio="xMidYMid meet". */
export function clientToView(view: View, rect: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number) {
  const scale = Math.min(rect.width / view.width, rect.height / view.height)
  if (!(scale > 0)) return null
  const offsetX = rect.left + (rect.width - view.width * scale) / 2
  const offsetY = rect.top + (rect.height - view.height * scale) / 2
  return { x: view.x + (clientX - offsetX) / scale, y: view.y + (clientY - offsetY) / scale }
}

export function ringPath(radius = 1, points = 72) {
  return Array.from({ length: points }, (_, index) => {
    const angle = (index / points) * Math.PI * 2
    const { x, y } = project(Math.cos(angle) * radius, Math.sin(angle) * radius)
    return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ') + 'Z'
}

export const SIDE_COLORS: Record<Side, { belt: string; ink: string }> = {
  left: { belt: '#cf5b4a', ink: '#b5473a' },
  right: { belt: '#3f8f95', ink: '#2f7378' },
}
