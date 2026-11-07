export const SIZE = 16
export const HEIGHT = 12
/** Worlds saved before the world was widened (same key and format, smaller floor). */
const LEGACY_SIZE = 12

type MaterialDef = { id: string; label: string; color: string; emoji: string; opacity?: number; glow?: boolean; falls?: boolean }
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

/** つちの なかに かくれた たから。ほると みつかる。 */
const TREASURES: readonly (readonly [number, number, Material])[] = [
  [4, 9, 'diamond'], [11, 14, 'diamond'], [7, 4, 'diamond'],
  [2, 13, 'gold'], [9, 10, 'gold'], [14, 9, 'gold'], [5, 5, 'gold'],
]

function flatColumn(x: number, z: number): Block[] {
  const treasure = TREASURES.find(([tx, tz]) => tx === x && tz === z)?.[2]
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
  for (const [x, z] of TREES) {
    for (let y = 3; y < 6; y++) blocks.push({ x, y, z, material: 'wood' })
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      blocks.push({ x: x + dx, y: 6, z: z + dz, material: 'leaf' })
    }
    blocks.push({ x, y: 7, z, material: 'leaf' })
  }
  blocks.push({ x: 14, y: 3, z: 2, material: 'cactus' }, { x: 14, y: 4, z: 2, material: 'cactus' })
  blocks.push({ x: 7, y: 3, z: 12, material: 'pumpkin' })
  return blocks
}
export function topBlock(world: World, x: number, z: number): Block {
  return world.filter(b => b.x === x && b.z === z).reduce((top, b) => b.y > top.y ? b : top)
}

/** すなは したが あいていると おちる。 */
function settle(world: Block[]): World {
  if (!world.some(b => MATERIAL_DEFS.find(m => m.id === b.material)?.falls)) return world
  const occupied = new Set(world.map(key))
  let moved = false
  const order = world.map((block, index) => ({ block, index })).sort((a, b) => a.block.y - b.block.y)
  for (const { block, index } of order) {
    if (!MATERIAL_DEFS.find(m => m.id === block.material)?.falls) continue
    let y = block.y
    while (y > 1 && !occupied.has(key({ ...block, y: y - 1 }))) y--
    if (y === block.y) continue
    occupied.delete(key(block))
    occupied.add(key({ ...block, y }))
    world[index] = { ...block, y }
    moved = true
  }
  return moved ? [...world] : world
}

export function editWorld(world: World, position: Position, material: Material, mode: 'place' | 'remove'): World {
  if (!inside(position) || position.y === 0) return world
  const exists = world.some(b => key(b) === key(position))
  if (mode === 'remove') return exists ? settle(world.filter(b => key(b) !== key(position))) : world
  if (exists) return world
  const attached = world.some(b => Math.abs(b.x - position.x) + Math.abs(b.y - position.y) + Math.abs(b.z - position.z) === 1)
  return attached ? settle([...world, { ...position, material }]) : world
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
