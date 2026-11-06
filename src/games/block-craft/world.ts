export const SIZE = 12
export const HEIGHT = 10
export const MATERIALS = [
  { id: 'grass', label: 'くさ', color: '#78ba50', emoji: '🌱' },
  { id: 'dirt', label: 'つち', color: '#ae7950', emoji: '🟫' },
  { id: 'stone', label: 'いし', color: '#9da9b5', emoji: '🪨' },
  { id: 'wood', label: 'き', color: '#bf894c', emoji: '🪵' },
  { id: 'leaf', label: 'はっぱ', color: '#398d56', emoji: '🌳' },
  { id: 'sand', label: 'すな', color: '#efd58d', emoji: '🏖️' },
  { id: 'brick', label: 'れんが', color: '#d46e59', emoji: '🧱' },
  { id: 'water', label: 'みず', color: '#53b9e4', emoji: '💧' },
] as const
export type Material = typeof MATERIALS[number]['id']
export type Position = { x: number; y: number; z: number }
export type Block = Position & { material: Material }
export type World = readonly Block[]
export const key = ({ x, y, z }: Position) => `${x},${y},${z}`
export function inside(p: Position): boolean {
  return [p.x, p.y, p.z].every(Number.isInteger) && p.x >= 0 && p.x < SIZE && p.z >= 0 && p.z < SIZE && p.y >= 0 && p.y < HEIGHT
}
export function createWorld(): World {
  const blocks: Block[] = []
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    blocks.push({ x, y: 0, z, material: 'stone' })
    blocks.push({ x, y: 1, z, material: z < 3 ? 'sand' : 'dirt' })
    blocks.push({ x, y: 2, z, material: z < 2 ? 'water' : z === 2 ? 'sand' : 'grass' })
  }
  for (const [x, z] of [[2, 8], [9, 9]]) {
    for (let y = 3; y < 6; y++) blocks.push({ x, y, z, material: 'wood' })
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      blocks.push({ x: x + dx, y: 6, z: z + dz, material: 'leaf' })
    }
    blocks.push({ x, y: 7, z, material: 'leaf' })
  }
  return blocks
}
export function topBlock(world: World, x: number, z: number): Block {
  return world.filter(b => b.x === x && b.z === z).reduce((top, b) => b.y > top.y ? b : top)
}
export function editWorld(world: World, position: Position, material: Material, mode: 'place' | 'remove'): World {
  if (!inside(position) || position.y === 0) return world
  const exists = world.some(b => key(b) === key(position))
  if (mode === 'remove') return exists ? world.filter(b => key(b) !== key(position)) : world
  if (exists) return world
  const attached = world.some(b => Math.abs(b.x - position.x) + Math.abs(b.y - position.y) + Math.abs(b.z - position.z) === 1)
  return attached ? [...world, { ...position, material }] : world
}

export const SAVE_KEY = 'kids-playground:block-craft:v1'
export function decodeWorld(raw: string | null): World | null {
  if (!raw || raw.length > 150000) return null
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data) || data.length < SIZE * SIZE || data.length > SIZE * SIZE * HEIGHT) return null
    const seen = new Set<string>()
    for (const block of data) {
      if (!block || !inside(block) || !MATERIALS.some(m => m.id === block.material) || seen.has(key(block))) return null
      seen.add(key(block))
    }
    for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) if (!seen.has(key({ x, y: 0, z }))) return null
    return data as Block[]
  } catch { return null }
}
