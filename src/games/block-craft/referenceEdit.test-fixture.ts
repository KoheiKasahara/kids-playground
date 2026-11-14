// Full-scan reference from before the indexed grid, used only for compatibility tests.
import { FLOW_LIMIT, FLOW_REACH, inside, key, materialDef, type Block, type Dimensions, type Material, type Position } from './world'

const TILLABLE: readonly Material[] = ['dirt', 'grass', 'farmland']
/** すなは したが あいていると おちる。 */
function settle(world: Block[]): Block[] {
  if (!world.some(b => materialDef(b.material).falls)) return world
  const occupied = new Set(world.map(key))
  const order = world.map((block, index) => ({ block, index })).sort((a, b) => a.block.y - b.block.y)
  for (const { block, index } of order) {
    if (!materialDef(block.material).falls) continue
    let y = block.y
    while (y > 1 && !occupied.has(key({ ...block, y: y - 1 }))) y--
    if (y === block.y) continue
    occupied.delete(key(block))
    occupied.add(key({ ...block, y }))
    world[index] = { ...block, y }
  }
  return world
}

const SIDES = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }] as const
/** みずは したが あいていれば おち、そこから よこへ すこし ひろがる。 */
function flow(dimensions: Dimensions, cells: Map<string, Block>, sources: readonly Position[]) {
  const open = (p: Position) => inside(dimensions, p) && p.y > 0 && !cells.has(key(p))
  const queue = sources.map(p => ({ p, reach: 0 }))
  let added = 0
  const fill = (p: Position, reach: number) => {
    cells.set(key(p), { ...p, material: 'water' })
    queue.push({ p, reach })
    added++
  }
  while (queue.length && added < FLOW_LIMIT) {
    const { p, reach } = queue.shift()!
    const below = { ...p, y: p.y - 1 }
    if (open(below)) { fill(below, 0); continue }
    if (reach >= FLOW_REACH) continue
    for (const side of SIDES) {
      const next = { x: p.x + side.x, y: p.y, z: p.z + side.z }
      if (added < FLOW_LIMIT && open(next)) fill(next, reach + 1)
    }
  }
}

export function referenceEdit(dimensions: Dimensions, world: readonly Block[], target: Position | readonly Position[], material: Material, mode: 'place' | 'remove'): readonly Block[] {
  const targets: readonly Position[] = Array.isArray(target) ? target : [target as Position]
  const cells = new Map(world.map(b => [key(b), b]))
  const valid = targets.filter(p => inside(dimensions, p) && p.y > 0)
  if (mode === 'remove') {
    const removed = valid.filter(p => cells.has(key(p)))
    if (!removed.length) return world
    const holes = removed.filter(p => cells.get(key(p))!.material !== 'water')
    for (const p of removed) cells.delete(key(p))
    // みずの となりや したを ほると、みずが ながれこむ
    const isWater = (p: Position) => cells.get(key(p))?.material === 'water'
    const flooded = holes.filter(p => isWater({ ...p, y: p.y + 1 }) || SIDES.some(s => isWater({ x: p.x + s.x, y: p.y, z: p.z + s.z })))
    for (const p of flooded) cells.set(key(p), { ...p, material: 'water' })
    flow(dimensions, cells, flooded)
    // じめんが なくなった くさばなは いっしょに なくなる
    for (const p of removed) {
      const above = cells.get(key({ ...p, y: p.y + 1 }))
      if (above && materialDef(above.material).plant) cells.delete(key(above))
    }
    react(cells)
    return settle([...cells.values()])
  }
  const attached = (p: Position) => [...SIDES.map(s => ({ x: p.x + s.x, y: p.y, z: p.z + s.z })), { ...p, y: p.y - 1 }, { ...p, y: p.y + 1 }]
    .some(n => cells.has(key(n)))
  const placed: Position[] = []
  for (const p of valid) {
    const existing = cells.get(key(p))
    // みずの なかには ほかの ブロックを おける（みずを せきとめられる）
    if (existing && (existing.material !== 'water' || material === 'water')) continue
    if (!attached(p)) continue
    if (material === 'seed') {
      // たねは つち・くさの うえに うえ、そこを はたけに する
      const ground = cells.get(key({ ...p, y: p.y - 1 }))
      if (!ground || !TILLABLE.includes(ground.material)) continue
      cells.set(key(ground), { ...ground, material: 'farmland' })
    }
    if (existing) cells.delete(key(p))
    cells.set(key(p), { ...p, material })
    placed.push(p)
  }
  if (!placed.length) return world
  if (material === 'water') flow(dimensions, cells, placed)
  react(cells)
  return settle([...cells.values()])
}

const AROUND = [...SIDES.map(s => ({ ...s, y: 0 })), { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }]
/** ようがんは みず・こおりに ふれると くろいしに なり、こおりは ようがんで とけ、みずは ゆきに ふれると こおる。 */
function react(cells: Map<string, Block>) {
  for (let pass = 0; pass < 4; pass++) {
    const changes: Block[] = []
    for (const block of cells.values()) {
      const touches = (material: Material) => AROUND.some(d => cells.get(key({ x: block.x + d.x, y: block.y + d.y, z: block.z + d.z }))?.material === material)
      const next: Material | null = block.material === 'lava' && (touches('water') || touches('ice')) ? 'obsidian'
        : block.material === 'ice' && touches('lava') ? 'water'
          : block.material === 'water' && touches('snow') ? 'ice'
            : null
      if (next) changes.push({ ...block, material: next })
    }
    if (!changes.length) return
    for (const block of changes) cells.set(key(block), block)
  }
}
