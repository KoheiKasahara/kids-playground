export const SIZE = 16
export const HEIGHT = 12
/** Worlds saved before the world was widened (same key and format, smaller floor). */
const LEGACY_SIZE = 12

type MaterialDef = {
  id: string; label: string; color: string; emoji: string
  opacity?: number; glow?: boolean; falls?: boolean
  /** くさばなのように ちいさく、とおりぬけられる。 */
  plant?: boolean
}
export const MATERIALS = [
  { id: 'grass', label: 'くさ', color: '#78ba50', emoji: '🌱' },
  { id: 'dirt', label: 'つち', color: '#ae7950', emoji: '🟫' },
  { id: 'stone', label: 'いし', color: '#9da9b5', emoji: '🪨' },
  { id: 'wood', label: 'き', color: '#bf894c', emoji: '🪵' },
  { id: 'leaf', label: 'はっぱ', color: '#398d56', emoji: '🌳' },
  { id: 'sand', label: 'すな', color: '#efd58d', emoji: '🏖️', falls: true },
  { id: 'brick', label: 'れんが', color: '#d46e59', emoji: '🧱' },
  { id: 'water', label: 'みず', color: '#53b9e4', emoji: '💧' },
  { id: 'plank', label: 'いた', color: '#e0b46c', emoji: '🪚' },
  { id: 'glass', label: 'ガラス', color: '#d9f4ff', emoji: '🪟', opacity: 0.4 },
  { id: 'snow', label: 'ゆき', color: '#f7fbff', emoji: '❄️' },
  { id: 'cactus', label: 'サボテン', color: '#4f9a3c', emoji: '🌵' },
  { id: 'pumpkin', label: 'かぼちゃ', color: '#ef8a1f', emoji: '🎃' },
  { id: 'lamp', label: 'ひかり', color: '#ffd84d', emoji: '💡', glow: true },
  { id: 'gold', label: 'きん', color: '#f4c430', emoji: '🪙' },
  { id: 'diamond', label: 'ダイヤ', color: '#5ee3e0', emoji: '💎' },
  { id: 'sapling', label: 'なえぎ', color: '#5fae3e', emoji: '🌿', plant: true },
  { id: 'flower', label: 'はな', color: '#f06fa4', emoji: '🌷', plant: true },
] as const satisfies readonly MaterialDef[]
export const MATERIAL_DEFS: readonly MaterialDef[] = MATERIALS
export type Material = typeof MATERIALS[number]['id']
export type Position = { x: number; y: number; z: number }
export type Block = Position & { material: Material }
export type World = readonly Block[]
export const key = ({ x, y, z }: Position) => `${x},${y},${z}`
export function inside(p: Position): boolean {
  return [p.x, p.y, p.z].every(Number.isInteger) && p.x >= 0 && p.x < SIZE && p.z >= 0 && p.z < SIZE && p.y >= 0 && p.y < HEIGHT
}
export const materialDef = (id: Material): MaterialDef => MATERIAL_DEFS.find(m => m.id === id)!
/** あるく ひとや どうぶつが ぶつかる ブロック（みずと くさばなは とおりぬけられる）。 */
export const isSolid = (material: Material) => material !== 'water' && !materialDef(material).plant

/** つちの なかに かくれた たから。ほると みつかる。 */
export const TREASURES: readonly Block[] = ([
  [4, 9, 'diamond'], [11, 14, 'diamond'], [7, 4, 'diamond'],
  [2, 13, 'gold'], [9, 10, 'gold'], [14, 9, 'gold'], [5, 5, 'gold'],
] as const).map(([x, z, material]) => ({ x, y: 1, z, material }))

function flatColumn(x: number, z: number): Block[] {
  const treasure = TREASURES.find(t => t.x === x && t.z === z)?.material
  return [
    { x, y: 0, z, material: 'stone' },
    { x, y: 1, z, material: z < 3 ? 'sand' : treasure ?? 'dirt' },
    { x, y: 2, z, material: z < 2 ? 'water' : z === 2 ? 'sand' : 'grass' },
  ]
}

const HILL = { x: 12, z: 6 }
const TREES = [[3, 11], [13, 13], [2, 6]] as const

export function createWorld(): World {
  const blocks: Block[] = []
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    const column = flatColumn(x, z)
    const rise = Math.max(0, 3 - Math.max(Math.abs(x - HILL.x), Math.abs(z - HILL.z)))
    if (rise) {
      column[2] = { x, y: 2, z, material: 'dirt' }
      for (let y = 3; y <= 2 + rise; y++) column.push({ x, y, z, material: y === 2 + rise ? (rise === 3 ? 'snow' : 'grass') : 'dirt' })
    }
    blocks.push(...column)
  }
  for (const [x, z] of TREES) blocks.push(...treeBlocks({ x, y: 3, z }))
  blocks.push({ x: 14, y: 3, z: 2, material: 'cactus' }, { x: 14, y: 4, z: 2, material: 'cactus' })
  blocks.push({ x: 7, y: 3, z: 12, material: 'pumpkin' })
  blocks.push({ x: 6, y: 3, z: 9, material: 'flower' }, { x: 10, y: 3, z: 12, material: 'flower' }, { x: 5, y: 3, z: 7, material: 'sapling' })
  return blocks
}

/** みきが 3だん、そのうえに はっぱ。 */
function treeBlocks({ x, y, z }: Position): Block[] {
  const blocks: Block[] = []
  for (let dy = 0; dy < 3; dy++) blocks.push({ x, y: y + dy, z, material: 'wood' })
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) blocks.push({ x: x + dx, y: y + 3, z: z + dz, material: 'leaf' })
  blocks.push({ x, y: y + 4, z, material: 'leaf' })
  return blocks
}

export function topBlock(world: World, x: number, z: number): Block {
  return world.filter(b => b.x === x && b.z === z).reduce((top, b) => b.y > top.y ? b : top)
}
export function blockAt(world: World, position: Position): Block | undefined {
  return world.find(b => b.x === position.x && b.y === position.y && b.z === position.z)
}

/** れつごとの いちばん うえの ブロック（くさばなは のぞく）。どうぶつが あるく じめん。 */
export function surfaceOf(world: World): (x: number, z: number) => Block | undefined {
  const tops = new Map<string, Block>()
  for (const b of world) {
    if (materialDef(b.material).plant) continue
    const column = `${b.x},${b.z}`
    const top = tops.get(column)
    if (!top || b.y > top.y) tops.set(column, b)
  }
  return (x, z) => tops.get(`${x},${z}`)
}

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
/** みずが よこへ ひろがる マスの かず。 */
export const FLOW_REACH = 3
/** 1かいで ふえる みずの さいだい（せかいが みずびたしに ならないように）。 */
export const FLOW_LIMIT = 60

/** みずは したが あいていれば おち、そこから よこへ すこし ひろがる。 */
function flow(cells: Map<string, Block>, sources: readonly Position[]) {
  const open = (p: Position) => inside(p) && p.y > 0 && !cells.has(key(p))
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

/** 「ひろく」の ときは、さわった めんに そった 3×3 を まとめて おく・こわす。 */
export function brushCells(center: Position, normal: Position, wide: boolean): Position[] {
  if (!wide) return [center]
  const cells = [center]
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    if (!a && !b) continue
    if (normal.x) cells.push({ x: center.x, y: center.y + a, z: center.z + b })
    else if (normal.z) cells.push({ x: center.x + a, y: center.y + b, z: center.z })
    else cells.push({ x: center.x + a, y: center.y, z: center.z + b })
  }
  return cells
}

export function editWorld(world: World, target: Position | readonly Position[], material: Material, mode: 'place' | 'remove'): World {
  const targets: readonly Position[] = Array.isArray(target) ? target : [target as Position]
  const cells = new Map(world.map(b => [key(b), b]))
  const valid = targets.filter(p => inside(p) && p.y > 0)
  if (mode === 'remove') {
    const removed = valid.filter(p => cells.has(key(p)))
    if (!removed.length) return world
    const holes = removed.filter(p => cells.get(key(p))!.material !== 'water')
    for (const p of removed) cells.delete(key(p))
    // みずの となりや したを ほると、みずが ながれこむ
    const isWater = (p: Position) => cells.get(key(p))?.material === 'water'
    const flooded = holes.filter(p => isWater({ ...p, y: p.y + 1 }) || SIDES.some(s => isWater({ x: p.x + s.x, y: p.y, z: p.z + s.z })))
    for (const p of flooded) cells.set(key(p), { ...p, material: 'water' })
    flow(cells, flooded)
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
    if (existing) cells.delete(key(p))
    cells.set(key(p), { ...p, material })
    placed.push(p)
  }
  if (!placed.length) return world
  if (material === 'water') flow(cells, placed)
  return settle([...cells.values()])
}

/** なえぎを タッチすると きに そだつ。うえが つかえていると そだたない。 */
export function growTree(world: World, sapling: Position): World {
  if (blockAt(world, sapling)?.material !== 'sapling') return world
  const cells = new Map(world.map(b => [key(b), b]))
  const trunk = [1, 2].map(dy => ({ ...sapling, y: sapling.y + dy }))
  if (!trunk.every(p => inside(p) && !cells.has(key(p)))) return world
  for (const block of treeBlocks(sapling)) {
    if (!inside(block)) continue
    const existing = cells.get(key(block))
    if (existing && existing.material !== 'sapling') continue
    cells.delete(key(block))
    cells.set(key(block), block)
  }
  return [...cells.values()]
}

/** ほりだした たから（もとの ばしょから なくなった もの）。 */
export function foundTreasures(world: World): Block[] {
  const present = new Set(world.map(b => `${key(b)}:${b.material}`))
  return TREASURES.filter(t => !present.has(`${key(t)}:${t.material}`))
}

function solidCells(world: World) {
  return new Set(world.filter(b => isSolid(b.material)).map(key))
}
/** あしもとが かたい ところまで おりる（いちばん したの ゆかは こわせない）。 */
function fall(solid: Set<string>, p: Position): Position {
  let y = p.y
  while (y > 1 && !solid.has(key({ ...p, y: y - 1 }))) y--
  return { ...p, y }
}
/** あるく ひとの からだ（あしもとと あたまの 2マス）が あいている。 */
const bodyFree = (solid: Set<string>, p: Position) => !solid.has(key(p)) && (p.y + 1 >= HEIGHT || !solid.has(key({ ...p, y: p.y + 1 })))

/** ブロックが おかれて うまったら うえへ、あしもとが なくなったら したへ。 */
export function settleWalker(world: World, walker: Position): Position {
  const solid = solidCells(world)
  let y = walker.y
  while (y < HEIGHT - 1 && !bodyFree(solid, { ...walker, y })) y++
  return fall(solid, { ...walker, y })
}
export function startWalker(world: World, x: number, z: number): Position {
  return settleWalker(world, { x, y: 1, z })
}

/** 1マス すすむ。1だんまでは のぼれ、たかい ところからは おりられる。 */
export function walk(world: World, from: Position, dir: { x: number; z: number }): Position {
  const next = { x: from.x + dir.x, y: from.y, z: from.z + dir.z }
  if (!inside(next)) return from
  const solid = solidCells(world)
  if (bodyFree(solid, next)) return fall(solid, next)
  const up = { ...next, y: from.y + 1 }
  const headroom = from.y + 2 >= HEIGHT || !solid.has(key({ ...from, y: from.y + 2 }))
  if (up.y < HEIGHT && headroom && bodyFree(solid, up)) return up
  return from
}

export const SAVE_KEY = 'kids-playground:block-craft:v1'
export const MAX_SAVE_LENGTH = 250000
function hasFloor(seen: Set<string>, size: number) {
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) if (!seen.has(key({ x, y: 0, z }))) return false
  return true
}
export function decodeWorld(raw: string | null): World | null {
  if (!raw || raw.length > MAX_SAVE_LENGTH) return null
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data) || data.length < LEGACY_SIZE * LEGACY_SIZE || data.length > SIZE * SIZE * HEIGHT) return null
    const seen = new Set<string>()
    for (const block of data) {
      if (!block || !inside(block) || !MATERIALS.some(m => m.id === block.material) || seen.has(key(block))) return null
      seen.add(key(block))
    }
    const blocks = data as Block[]
    if (hasFloor(seen, SIZE)) return blocks
    // ひろくなる まえの せかいは、まわりに たいらな じめんを たして つづきから あそべるようにする
    if (blocks.some(b => b.x >= LEGACY_SIZE || b.z >= LEGACY_SIZE) || !hasFloor(seen, LEGACY_SIZE)) return null
    const expanded = [...blocks]
    for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
      if (x >= LEGACY_SIZE || z >= LEGACY_SIZE) expanded.push(...flatColumn(x, z))
    }
    return expanded
  } catch { return null }
}
