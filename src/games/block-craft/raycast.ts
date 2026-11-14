import { definitionAt, type Position, type World } from './world'

export const BLOCK_WIDTH = 0.97
export const PLANT_WIDTH_SCALE = 0.45
export const plantCenterY = (y: number, height: number) => y - BLOCK_WIDTH / 2 * (1 - height)
const HALF = Math.fround(BLOCK_WIDTH / 2)
const AXES = ['x', 'y', 'z'] as const
type Axis = typeof AXES[number]
export type BlockHit = { position: Position; normal: Position; distance: number }

/** Grid DDA followed by a front-face test against the same scaled box as the renderer. */
export function hitBlock(world: World, origin: Position, direction: Position, far = Infinity): BlockHit | null {
  let enter = 0, exit = far
  for (const axis of AXES) {
    const max = (axis === 'y' ? world.height : world.size) - 0.5
    const from = origin[axis], delta = direction[axis]
    if (!delta) {
      if (from < -0.5 || from > max) return null
    } else {
      const a = (-0.5 - from) / delta, b = (max - from) / delta
      enter = Math.max(enter, Math.min(a, b))
      exit = Math.min(exit, Math.max(a, b))
    }
  }
  if (enter > exit) return null

  const cell = { x: 0, y: 0, z: 0 }
  const step = { x: 0, y: 0, z: 0 }
  const next = { x: Infinity, y: Infinity, z: Infinity }
  const interval = { ...next }
  for (const axis of AXES) {
    const delta = direction[axis]
    const coordinate = origin[axis] + enter * delta + 0.5
    const limit = (axis === 'y' ? world.height : world.size) - 1
    cell[axis] = Math.max(0, Math.min(limit, delta < 0 ? Math.ceil(coordinate) - 1 : Math.floor(coordinate)))
    if (!delta) continue
    step[axis] = Math.sign(delta)
    next[axis] = (cell[axis] + step[axis] / 2 - origin[axis]) / delta
    interval[axis] = 1 / Math.abs(delta)
  }
  while (true) {
    const code = world.codeAt(cell.x, cell.y, cell.z)
    if (code) {
      const def = definitionAt(code)
      const height = def.height ?? 0.6
      // Instanced matrices store scale and translation in Float32.
      const horizontal = HALF * (def.plant ? Math.fround(PLANT_WIDTH_SCALE) : 1)
      const vertical = HALF * (def.plant ? Math.fround(height) : 1)
      const centerY = def.plant ? Math.fround(plantCenterY(cell.y, height)) : cell.y
      let near = -Infinity, end = exit
      let face: Axis = 'x'
      for (const axis of AXES) {
        const half = axis === 'y' ? vertical : horizontal
        const relative = origin[axis] - (axis === 'y' ? centerY : cell[axis])
        const delta = direction[axis]
        if (!delta) {
          if (Math.abs(relative) > half) { end = -Infinity; break }
          continue
        }
        const a = (-half - relative) / delta, b = (half - relative) / delta
        const start = Math.min(a, b)
        if (start > near) { near = start; face = axis }
        end = Math.min(end, Math.max(a, b))
      }
      if (near >= 0 && near <= end) {
        const normal = { x: 0, y: 0, z: 0 }
        normal[face] = -step[face]
        return { position: cell, normal, distance: near }
      }
    }
    const boundary = Math.min(next.x, next.y, next.z)
    if (boundary > exit || boundary === Infinity) return null
    for (const axis of AXES) {
      if (next[axis] !== boundary) continue
      cell[axis] += step[axis]
      next[axis] += interval[axis]
    }
  }
}
